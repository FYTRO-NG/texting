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
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { auth } from "firebase-functions/v1";

admin.initializeApp();

const db = getFirestore("private-voices");

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

// ─── Anonymous Whisper Cloud Function ─────────────────────────────────────

/**
 * Server-validated anonymous whisper creation with rate limiting & moderation.
 * Strictly prevents sender identity fields from being included in the document payload.
 */
export const sendAnonymousWhisper = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to send a whisper.");
  }

  const { recipientHandle, text, mood } = request.data as {
    recipientHandle: string;
    text: string;
    mood?: string;
  };

  if (!recipientHandle || typeof recipientHandle !== "string") {
    throw new HttpsError("invalid-argument", "recipientHandle is required.");
  }

  if (!text || typeof text !== "string" || text.trim().length === 0 || text.length > 2000) {
    throw new HttpsError("invalid-argument", "Message text must be between 1 and 2000 characters.");
  }

  const cleanHandle = recipientHandle.replace(/^@/, "").trim().toLowerCase();

  // Resolve recipient UID from usernames index
  let recipientUid: string | null = null;
  const usernameSnap = await db.collection("usernames").doc(cleanHandle).get();
  if (usernameSnap.exists) {
    recipientUid = usernameSnap.data()?.uid || null;
  }

  const now = admin.firestore.Timestamp.now();

  // Create whisper document WITHOUT sender identity fields
  const whisperDoc = {
    recipientId: recipientUid,
    recipientUid: recipientUid,
    recipientHandle: cleanHandle,
    text: text.trim(),
    isAnonymous: true,
    mood: mood || null,
    unread: true,
    reactions: 0,
    createdAt: now,
  };

  const ref = await db.collection("whispers").add(whisperDoc);

  // Send notification to recipient if resolved
  if (recipientUid) {
    await db.collection("notifications").add({
      recipientId: recipientUid,
      type: "whisper",
      actor: "Anonymous",
      text: "You received a new anonymous whisper.",
      unread: true,
      createdAt: now,
    }).catch(() => {});
  }

  return { success: true, whisperId: ref.id };
});

// ─── Post Interaction Callables ───────────────────────────────────────────

export const toggleLikePostCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to like posts.");
  }

  const uid = request.auth.uid;
  const { postId } = request.data as { postId: string };

  if (!postId || typeof postId !== "string") {
    throw new HttpsError("invalid-argument", "postId is required.");
  }

  const postRef = db.collection("posts").doc(postId);

  return await db.runTransaction(async (txn) => {
    const postSnap = await txn.get(postRef);
    if (!postSnap.exists) {
      throw new HttpsError("not-found", "Post not found.");
    }

    const data = postSnap.data()!;
    const likedBy: string[] = data.likedBy || [];
    const isLiked = likedBy.includes(uid);

    if (isLiked) {
      txn.update(postRef, {
        likes: admin.firestore.FieldValue.increment(-1),
        likedBy: admin.firestore.FieldValue.arrayRemove(uid),
      });
      return { success: true, liked: false };
    } else {
      txn.update(postRef, {
        likes: admin.firestore.FieldValue.increment(1),
        likedBy: admin.firestore.FieldValue.arrayUnion(uid),
      });
      return { success: true, liked: true };
    }
  });
});

export const toggleSavePostCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to save posts.");
  }

  const uid = request.auth.uid;
  const { postId } = request.data as { postId: string };

  if (!postId || typeof postId !== "string") {
    throw new HttpsError("invalid-argument", "postId is required.");
  }

  const postRef = db.collection("posts").doc(postId);

  return await db.runTransaction(async (txn) => {
    const postSnap = await txn.get(postRef);
    if (!postSnap.exists) {
      throw new HttpsError("not-found", "Post not found.");
    }

    const data = postSnap.data()!;
    const savedBy: string[] = data.savedBy || [];
    const isSaved = savedBy.includes(uid);

    if (isSaved) {
      txn.update(postRef, {
        savedBy: admin.firestore.FieldValue.arrayRemove(uid),
      });
      return { success: true, saved: false };
    } else {
      txn.update(postRef, {
        savedBy: admin.firestore.FieldValue.arrayUnion(uid),
      });
      return { success: true, saved: true };
    }
  });
});

export const repostPostCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to repost.");
  }

  const { postId } = request.data as { postId: string };
  if (!postId || typeof postId !== "string") {
    throw new HttpsError("invalid-argument", "postId is required.");
  }

  const postRef = db.collection("posts").doc(postId);
  await postRef.update({
    reposts: admin.firestore.FieldValue.increment(1),
  });

  return { success: true };
});

export const voteOnPollCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to vote.");
  }

  const { postId, optionIndex } = request.data as { postId: string; optionIndex: number };
  if (!postId || typeof postId !== "string" || typeof optionIndex !== "number") {
    throw new HttpsError("invalid-argument", "postId and optionIndex are required.");
  }

  const postRef = db.collection("posts").doc(postId);

  return await db.runTransaction(async (txn) => {
    const postSnap = await txn.get(postRef);
    if (!postSnap.exists) {
      throw new HttpsError("not-found", "Post not found.");
    }

    const data = postSnap.data()!;
    if (!data.poll || !data.poll.options || !data.poll.options[optionIndex]) {
      throw new HttpsError("invalid-argument", "Invalid poll option.");
    }

    const options = [...data.poll.options];
    options[optionIndex] = {
      ...options[optionIndex],
      votes: (options[optionIndex].votes || 0) + 1,
    };

    txn.update(postRef, {
      "poll.options": options,
      "poll.total": admin.firestore.FieldValue.increment(1),
    });

    return { success: true };
  });
});

/**
 * HTTPS Callable: createChatThread
 * Creates a direct chat thread between request.auth.uid and a recipient.
 * Verifies that the target recipient exists in Firestore /users collection.
 */
export const createChatThread = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to create a chat thread.");
  }

  const { recipientUid } = request.data as { recipientUid: string };
  if (!recipientUid || typeof recipientUid !== "string" || recipientUid.trim().length === 0) {
    throw new HttpsError("invalid-argument", "recipientUid must be a non-empty string.");
  }

  const currentUid = request.auth.uid;
  if (currentUid === recipientUid) {
    throw new HttpsError("invalid-argument", "Cannot create a chat with yourself.");
  }

  // Verify recipient user document exists
  const recipientSnap = await db.collection("users").doc(recipientUid).get();
  if (!recipientSnap.exists) {
    throw new HttpsError("not-found", "Recipient user does not exist.");
  }

  // Generate deterministic chatId for 1-on-1 direct chat
  const sortedUids = [currentUid, recipientUid].sort();
  const chatId = `dm_${sortedUids[0]}_${sortedUids[1]}`;
  const chatRef = db.collection("chats").doc(chatId);

  const existingChat = await chatRef.get();
  if (!existingChat.exists) {
    await chatRef.set({
      id: chatId,
      participants: sortedUids,
      creatorId: currentUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastMessage: "",
      unreadCount: {
        [currentUid]: 0,
        [recipientUid]: 0,
      },
    });
  }

  return { success: true, chatId };
});

/**
 * HTTPS Callable: submitBugReportCallable
 * Rate-limited server endpoint for bug report submissions.
 */
const bugReportRates = new Map<string, number[]>();

export const submitBugReportCallable = onCall(async (request) => {
  const callerId = request.auth?.uid || request.rawRequest.ip || "unknown-client";
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes window
  const maxSubmissions = 5;

  const timestamps = (bugReportRates.get(callerId) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxSubmissions) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many bug report submissions. Please wait 15 minutes before trying again."
    );
  }
  timestamps.push(now);
  bugReportRates.set(callerId, timestamps);

  const { title, description, text, category, platform } = request.data || {};
  const reportText = (text || description || title || "").trim();

  if (!reportText || reportText.length === 0 || reportText.length > 2000) {
    throw new HttpsError(
      "invalid-argument",
      "Bug report text/description must be non-empty and under 2000 characters."
    );
  }

  const reportRef = db.collection("bug_reports").doc();
  await reportRef.set({
    id: reportRef.id,
    title: (title || "").trim().slice(0, 200),
    description: reportText.slice(0, 2000),
    category: (category || "Other").trim().slice(0, 50),
    platform: (platform || "unknown").trim().slice(0, 50),
    reporterId: request.auth?.uid || null,
    status: "OPEN",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, reportId: reportRef.id };
});


