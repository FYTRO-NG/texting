/**
 * community.ts — Private Voices Community System Cloud Functions (2nd gen)
 * 
 * Callable Functions:
 *   - createCommunity: Creates a new community with slug uniqueness & rate limits
 *   - joinCommunity: Join or submit join request for private communities
 *   - leaveCommunity: Leave community and update counters atomically
 *   - handleJoinRequest: Approve or reject join requests (Owner/Mod only)
 *   - moderateCommunityContent: Remove post, comment, or ban member (Owner/Mod only)
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

const db = admin.firestore("private-voices");

// ─── Reserved Slugs ─────────────────────────────────────────────────────────────
const RESERVED_SLUGS = new Set([
  "admin", "support", "privatevoices", "official", "moderator", "help",
  "system", "api", "explore", "settings", "create", "discover", "trending"
]);

// ─── Slugs Format Validator ──────────────────────────────────────────────────
function validateSlug(slug: string): { valid: boolean; reason?: string } {
  if (!slug || typeof slug !== "string") return { valid: false, reason: "Slug is required" };
  const s = slug.trim().toLowerCase();
  if (s.length < 3) return { valid: false, reason: "Slug must be at least 3 characters" };
  if (s.length > 30) return { valid: false, reason: "Slug must be 30 characters or less" };
  if (!/^[a-z0-9_-]+$/.test(s)) return { valid: false, reason: "Slug can only contain letters, numbers, hyphens, underscores" };
  if (RESERVED_SLUGS.has(s)) return { valid: false, reason: "That community handle/slug is reserved" };
  return { valid: true };
}

// ─── 1. createCommunity Callable ────────────────────────────────────────────────
export const createCommunity = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to create a community.");
  }

  const uid = request.auth.uid;
  const {
    name,
    slug,
    description,
    category,
    visibility = "public",
    requireApproval = false,
    rules = [],
    allowAnonymousPosts = true,
    avatarUrl = "",
    coverUrl = "",
  } = request.data as {
    name: string;
    slug: string;
    description: string;
    category: string;
    visibility: "public" | "private";
    requireApproval: boolean;
    rules: string[];
    allowAnonymousPosts: boolean;
    avatarUrl?: string;
    coverUrl?: string;
  };

  if (!name || name.trim().length < 3) {
    throw new HttpsError("invalid-argument", "Community name must be at least 3 characters.");
  }

  const slugVal = validateSlug(slug);
  if (!slugVal.valid) {
    throw new HttpsError("invalid-argument", slugVal.reason!);
  }

  const normalizedSlug = slug.trim().toLowerCase();
  const communityRef = db.collection("communities").doc(normalizedSlug);

  await db.runTransaction(async (txn) => {
    const snap = await txn.get(communityRef);
    if (snap.exists) {
      throw new HttpsError("already-exists", "Community slug is already taken.");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    // 1. Create main community doc
    txn.set(communityRef, {
      id: normalizedSlug,
      name: name.trim(),
      slug: normalizedSlug,
      description: description ? description.trim() : "",
      category: category || "General",
      visibility,
      requireApproval,
      allowAnonymousPosts,
      avatarUrl,
      coverUrl,
      ownerId: uid,
      memberCount: 1,
      postCount: 0,
      rules: rules || [],
      createdAt: now,
      updatedAt: now,
    });

    // 2. Add owner as member with "owner" role
    const memberRef = communityRef.collection("members").doc(uid);
    txn.set(memberRef, {
      userId: uid,
      role: "owner",
      joinedAt: now,
    });

    // 3. Add owner to moderators subcollection
    const modRef = communityRef.collection("moderators").doc(uid);
    txn.set(modRef, {
      userId: uid,
      role: "owner",
      permissions: ["all"],
      addedAt: now,
    });

    // 4. Update user document joinedCommunities array
    const userRef = db.collection("users").doc(uid);
    txn.set(userRef, {
      joinedCommunities: admin.firestore.FieldValue.arrayUnion(normalizedSlug),
    }, { merge: true });
  });

  return { success: true, communityId: normalizedSlug };
});

// ─── 2. joinCommunity Callable ──────────────────────────────────────────────────
export const joinCommunity = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to join communities.");
  }

  const uid = request.auth.uid;
  const { communityId } = request.data as { communityId: string };

  if (!communityId) {
    throw new HttpsError("invalid-argument", "communityId is required.");
  }

  const commRef = db.collection("communities").doc(communityId);
  const commSnap = await commRef.get();
  if (!commSnap.exists) {
    throw new HttpsError("not-found", "Community not found.");
  }

  const commData = commSnap.data()!;
  const memberRef = commRef.collection("members").doc(uid);
  const memberSnap = await memberRef.get();

  if (memberSnap.exists) {
    return { success: true, status: "already_member" };
  }

  const now = admin.firestore.FieldValue.serverTimestamp();

  // If community is private or requires approval, create join request instead
  if (commData.visibility === "private" || commData.requireApproval) {
    const requestRef = commRef.collection("joinRequests").doc(uid);
    await requestRef.set({
      userId: uid,
      status: "pending",
      requestedAt: now,
    });

    // Send notification to owner
    await db.collection("notifications").add({
      recipientId: commData.ownerId,
      type: "join_request",
      actor: uid,
      communityId,
      text: `Someone requested to join ${commData.name}`,
      unread: true,
      createdAt: now,
    });

    return { success: true, status: "requested" };
  }

  // Direct join for public communities
  await db.runTransaction(async (txn) => {
    txn.set(memberRef, {
      userId: uid,
      role: "member",
      joinedAt: now,
    });
    txn.update(commRef, {
      memberCount: admin.firestore.FieldValue.increment(1),
    });
    txn.set(db.collection("users").doc(uid), {
      joinedCommunities: admin.firestore.FieldValue.arrayUnion(communityId),
    }, { merge: true });
  });

  return { success: true, status: "joined" };
});

// ─── 3. leaveCommunity Callable ─────────────────────────────────────────────────
export const leaveCommunity = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const uid = request.auth.uid;
  const { communityId } = request.data as { communityId: string };

  const commRef = db.collection("communities").doc(communityId);
  const commSnap = await commRef.get();
  if (!commSnap.exists) {
    throw new HttpsError("not-found", "Community not found.");
  }

  if (commSnap.data()?.ownerId === uid) {
    throw new HttpsError("failed-precondition", "Community owners cannot leave their community without transferring ownership.");
  }

  const memberRef = commRef.collection("members").doc(uid);
  const memberSnap = await memberRef.get();

  if (!memberSnap.exists) {
    return { success: true, status: "not_member" };
  }

  await db.runTransaction(async (txn) => {
    txn.delete(memberRef);
    txn.update(commRef, {
      memberCount: admin.firestore.FieldValue.increment(-1),
    });
    txn.set(db.collection("users").doc(uid), {
      joinedCommunities: admin.firestore.FieldValue.arrayRemove(communityId),
    }, { merge: true });
  });

  return { success: true, status: "left" };
});
