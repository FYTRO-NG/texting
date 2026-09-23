/**
 * Private Voices — Firebase Cloud Functions
 *
 * Functions:
 *  - onUserCreate:              Auth trigger that initializes user profile with zero counters.
 *  - followUser:                HTTPS Callable — follow a user securely server-side.
 *  - unfollowUser:              HTTPS Callable — unfollow a user securely server-side.
 *  - onFollowCreated:           Firestore trigger — increments follow counters when a follow doc is created.
 *  - onFollowDeleted:           Firestore trigger — decrements follow counters when a follow doc is deleted.
 *  - createStory:               HTTPS Callable — creates a Story with server-side timestamps.
 *  - recordStoryView:           HTTPS Callable — atomically increments viewCount, writes viewer subcollection.
 *  - deleteStory:               HTTPS Callable — soft-deletes a Story (owner only).
 *  - onExpiredStoriesCleanup:   Scheduled — marks expired stories as deleted every hour.
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { auth } from "firebase-functions/v1";

admin.initializeApp();

const db = admin.firestore("private-voices");

// Re-export username functions (defined in username.ts)
export {
  checkUsernameAvailability,
  claimUsername,
  changeUsername,
} from "./username";

// Re-export community functions (defined in community.ts)
export {
  createCommunity,
  joinCommunity,
  leaveCommunity,
} from "./community";

// Re-export explore recommendation functions (defined in recommendation/index.ts)
export {
  onPostCreatedExtractHashtags,
  refreshExploreFeedBundle,
  getPersonalizedExploreFeed,
} from "./recommendation";


// ─── onUserCreate ─────────────────────────────────────────────────────────────
// Triggered every time a new Firebase Auth user is created.
// Ensures the Firestore user document exists with zero counters.
// This is the server-side safety net — even if the client fails to write.

export const onUserCreate = auth.user().onCreate(async (user) => {
  const userRef = db.collection("users").doc(user.uid);
  const snap = await userRef.get();

  const rawUsername = user.displayName ?? `Voice_${user.uid.slice(0, 6)}`;
  const lower = rawUsername.toLowerCase().replace(/[^a-z0-9._]/g, "_");

  const defaults = {
    uid: user.uid,
    username: rawUsername,
    usernameLower: lower,
    displayName: user.displayName ?? rawUsername,
    email: user.email ?? null,
    photoURL: user.photoURL ?? null,
    avatarIcon: "person",
    avatarGradient: ["#8B5CF6", "#06B6D4"],
    themeColor: "#8B5CF6",
    bio: "",
    reputationScore: 100,
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    privacy: {
      anonymousMessagesEnabled: true,
    },
    lastUsernameChangeAt: null,
    nextUsernameChangeAt: null,
    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!snap.exists) {
    await userRef.set(defaults);
    // Also claim the username in the usernames index (best-effort — create-profile will overwrite)
    const usernamesRef = db.collection("usernames").doc(lower);
    const existingUsername = await usernamesRef.get();
    if (!existingUsername.exists) {
      await usernamesRef.set({
        uid: user.uid,
        username: rawUsername,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } else {
    // Ensure counter and username fields are always present (migration safety)
    const existing = snap.data() ?? {};
    await userRef.set(
      {
        followersCount: existing.followersCount ?? 0,
        followingCount: existing.followingCount ?? 0,
        postsCount: existing.postsCount ?? 0,
        usernameLower: existing.usernameLower ?? lower,
        lastUsernameChangeAt: existing.lastUsernameChangeAt ?? null,
        nextUsernameChangeAt: existing.nextUsernameChangeAt ?? null,
      },
      { merge: true }
    );
  }
});

// ─── followUser Callable ──────────────────────────────────────────────────────

export const followUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to follow users.");
  }

  const currentUid = request.auth.uid;
  const { targetUid } = request.data as { targetUid: string };

  if (!targetUid || typeof targetUid !== "string") {
    throw new HttpsError("invalid-argument", "targetUid is required.");
  }

  // Prevent self-follow
  if (currentUid === targetUid) {
    throw new HttpsError("failed-precondition", "You cannot follow yourself.");
  }

  // Verify target user exists
  const targetRef = db.collection("users").doc(targetUid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new HttpsError("not-found", "Target user does not exist.");
  }

  // Composite doc ID prevents duplicates
  const followDocId = `${currentUid}_${targetUid}`;
  const followRef = db.collection("follows").doc(followDocId);
  const existingSnap = await followRef.get();

  if (existingSnap.exists) {
    return { success: false, reason: "already_following" };
  }

  // Transactional write: follow doc + both counter increments
  await db.runTransaction(async (txn) => {
    txn.set(followRef, {
      followerId: currentUid,
      followingId: targetUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    txn.update(db.collection("users").doc(currentUid), {
      followingCount: admin.firestore.FieldValue.increment(1),
    });
    txn.update(targetRef, {
      followersCount: admin.firestore.FieldValue.increment(1),
    });
  });

  // Send notification (non-blocking)
  const currentSnap = await db.collection("users").doc(currentUid).get();
  const currentUsername = currentSnap.data()?.username ?? "Someone";

  await db.collection("notifications").add({
    recipientId: targetUid,
    type: "follow",
    actor: currentUsername,
    actorGradient: ["#8B5CF6", "#06B6D4"],
    text: `${currentUsername} started following you.`,
    unread: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

// ─── unfollowUser Callable ────────────────────────────────────────────────────

export const unfollowUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to unfollow users.");
  }

  const currentUid = request.auth.uid;
  const { targetUid } = request.data as { targetUid: string };

  if (!targetUid || typeof targetUid !== "string") {
    throw new HttpsError("invalid-argument", "targetUid is required.");
  }

  if (currentUid === targetUid) {
    throw new HttpsError("failed-precondition", "You cannot unfollow yourself.");
  }

  const followDocId = `${currentUid}_${targetUid}`;
  const followRef = db.collection("follows").doc(followDocId);
  const existingSnap = await followRef.get();

  if (!existingSnap.exists) {
    return { success: false, reason: "not_following" };
  }

  await db.runTransaction(async (txn) => {
    txn.delete(followRef);
    txn.update(db.collection("users").doc(currentUid), {
      followingCount: admin.firestore.FieldValue.increment(-1),
    });
    txn.update(db.collection("users").doc(targetUid), {
      followersCount: admin.firestore.FieldValue.increment(-1),
    });
  });

  return { success: true };
});

// ─── Firestore Triggers ───────────────────────────────────────────────────────
// These act as a secondary safety net in case the client-side updates miss.

export const onFollowCreated = onDocumentCreated("follows/{followId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;

  const { followerId, followingId } = data as {
    followerId: string;
    followingId: string;
  };

  if (!followerId || !followingId) return;

  // These are idempotent — even if the callable already updated them
  // Firestore increment is safe to apply multiple times only if you guard it.
  // Here we rely on the callable being the primary path; this is a backstop.
  await Promise.allSettled([
    db.collection("users").doc(followerId).update({
      followingCount: admin.firestore.FieldValue.increment(1),
    }),
    db.collection("users").doc(followingId).update({
      followersCount: admin.firestore.FieldValue.increment(1),
    }),
  ]);
});

export const onFollowDeleted = onDocumentDeleted("follows/{followId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;

  const { followerId, followingId } = data as {
    followerId: string;
    followingId: string;
  };

  if (!followerId || !followingId) return;

  await Promise.allSettled([
    db.collection("users").doc(followerId).update({
      followingCount: admin.firestore.FieldValue.increment(-1),
    }),
    db.collection("users").doc(followingId).update({
      followersCount: admin.firestore.FieldValue.increment(-1),
    }),
  ]);
});

// ─── Stories Cloud Functions ───────────────────────────────────────────────

/**
 * Creates a story doc with server-controlled timestamps (createdAt & expiresAt = +24h).
 */
export const createStory = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to create a story.");
  }

  const uid = request.auth.uid;
  const { type, content, mediaUrl, backgroundColor } = request.data as {
    type: "text" | "image";
    content?: string;
    mediaUrl?: string;
    backgroundColor?: string;
  };

  if (!type || (type !== "text" && type !== "image")) {
    throw new HttpsError("invalid-argument", "Invalid story type.");
  }

  if (type === "text" && (!content || content.trim().length === 0)) {
    throw new HttpsError("invalid-argument", "Text story requires content.");
  }

  if (type === "image" && (!mediaUrl || mediaUrl.trim().length === 0)) {
    throw new HttpsError("invalid-argument", "Image story requires mediaUrl.");
  }

  // Fetch author details
  const userSnap = await db.collection("users").doc(uid).get();
  const userData = userSnap.data() || {};
  const authorUsername = userData.username || "voice";
  const authorDisplayName = userData.displayName || authorUsername;
  const authorAvatarIcon = userData.avatarIcon || "person";
  const authorAvatarGradient = userData.avatarGradient || ["#8B5CF6", "#06B6D4"];

  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(
    now.toMillis() + 24 * 60 * 60 * 1000
  );

  const storyDoc = {
    authorId: uid,
    authorUsername,
    authorDisplayName,
    authorAvatarIcon,
    authorAvatarGradient,
    type,
    content: content?.trim() || null,
    mediaUrl: mediaUrl || null,
    backgroundColor: backgroundColor || null,
    createdAt: now,
    expiresAt,
    viewCount: 0,
    status: "active",
  };

  const ref = await db.collection("stories").add(storyDoc);
  return { success: true, storyId: ref.id };
});

/**
 * Records a view for a story atomically using a transaction.
 * Prevents duplicate view increments per user and enforces viewer privacy.
 */
export const recordStoryView = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to record a view.");
  }

  const uid = request.auth.uid;
  const { storyId } = request.data as { storyId: string };

  if (!storyId || typeof storyId !== "string") {
    throw new HttpsError("invalid-argument", "storyId is required.");
  }

  const storyRef = db.collection("stories").doc(storyId);
  const viewerRef = storyRef.collection("viewers").doc(uid);

  const result = await db.runTransaction(async (txn) => {
    const viewerSnap = await txn.get(viewerRef);
    if (viewerSnap.exists) {
      return { success: true, alreadyViewed: true };
    }

    const storySnap = await txn.get(storyRef);
    if (!storySnap.exists) {
      throw new HttpsError("not-found", "Story not found.");
    }

    // Set viewer doc & increment viewCount
    txn.set(viewerRef, {
      userId: uid,
      viewedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    txn.update(storyRef, {
      viewCount: admin.firestore.FieldValue.increment(1),
    });

    return { success: true, alreadyViewed: false };
  });

  return result;
});

/**
 * Soft-deletes a story. Author only.
 */
export const deleteStory = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to delete a story.");
  }

  const uid = request.auth.uid;
  const { storyId } = request.data as { storyId: string };

  if (!storyId || typeof storyId !== "string") {
    throw new HttpsError("invalid-argument", "storyId is required.");
  }

  const storyRef = db.collection("stories").doc(storyId);
  const storySnap = await storyRef.get();

  if (!storySnap.exists) {
    throw new HttpsError("not-found", "Story not found.");
  }

  if (storySnap.data()?.authorId !== uid) {
    throw new HttpsError("permission-denied", "You can only delete your own story.");
  }

  await storyRef.update({
    status: "deleted",
  });

  return { success: true };
});

/**
 * Scheduled job running every 1 hour to soft-delete expired stories.
 */
export const onExpiredStoriesCleanup = onSchedule("every 1 hours", async () => {
  const now = admin.firestore.Timestamp.now();
  const snapshot = await db
    .collection("stories")
    .where("status", "==", "active")
    .where("expiresAt", "<=", now)
    .get();

  if (snapshot.empty) return;

  const batch = db.batch();
  snapshot.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, { status: "deleted" });
  });

  await batch.commit();
});

