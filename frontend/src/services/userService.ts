/**
 * userService.ts
 * Complete user & follow system for Private Voices.
 * Implements follow/unfollow with Firestore sub-collections,
 * atomic counter updates, duplicate-follow prevention,
 * self-follow prevention, and real-time profile subscriptions.
 */

import {
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  increment,
  updateDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "../firebase";
import { createNotificationInFirestore } from "./notificationService";
import { isUserBlockedInFirestore } from "./safetyService";
import type { UserProfile } from "./authService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FollowRelationship = {
  followerId: string;
  followingId: string;
  createdAt: any;
};

export type PublicUserProfile = {
  uid: string;
  username: string;
  avatarIcon: string;
  avatarGradient: [string, string];
  avatarUrl?: string;
  bio?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
};

// ─── Follow / Unfollow ────────────────────────────────────────────────────────

/**
 * Follow a user.
 * - Prevents self-follow.
 * - Prevents duplicate follows.
 * - Atomically increments both users' counters.
 * - Creates a notification for the target user.
 */
export const followUser = async (
  currentUid: string,
  targetUid: string,
  currentUsername: string = "Someone"
): Promise<{ success: boolean; reason?: string }> => {
  if (currentUid === targetUid) {
    return { success: false, reason: "self_follow" };
  }

  // Check if either user has blocked the other
  const [targetBlockedMe, iBlockedTarget] = await Promise.all([
    isUserBlockedInFirestore(targetUid, currentUid),
    isUserBlockedInFirestore(currentUid, targetUid),
  ]);

  if (targetBlockedMe || iBlockedTarget) {
    return { success: false, reason: "blocked" };
  }

  // Uniqueness check — document ID is composite to enforce uniqueness
  const followDocId = `${currentUid}_${targetUid}`;
  const followRef = doc(db, "follows", followDocId);
  const existing = await getDoc(followRef);

  if (existing.exists()) {
    return { success: false, reason: "already_following" };
  }

  const relationship: FollowRelationship = {
    followerId: currentUid,
    followingId: targetUid,
    createdAt: serverTimestamp(),
  };

  await setDoc(followRef, relationship);

  // Atomic counter updates
  await updateDoc(doc(db, "users", currentUid), {
    followingCount: increment(1),
  });
  await updateDoc(doc(db, "users", targetUid), {
    followersCount: increment(1),
  });

  // Notify the target user (fire-and-forget)
  createNotificationInFirestore({
    recipientId: targetUid,
    type: "follow",
    actor: currentUsername,
    actorGradient: ["#8B5CF6", "#06B6D4"],
    text: `${currentUsername} started following you.`,
  }).catch(() => {});

  return { success: true };
};

/**
 * Unfollow a user.
 * Atomically decrements counters (floors at 0).
 */
export const unfollowUser = async (
  currentUid: string,
  targetUid: string
): Promise<{ success: boolean; reason?: string }> => {
  if (currentUid === targetUid) {
    return { success: false, reason: "self_follow" };
  }

  const followDocId = `${currentUid}_${targetUid}`;
  const followRef = doc(db, "follows", followDocId);
  const existing = await getDoc(followRef);

  if (!existing.exists()) {
    return { success: false, reason: "not_following" };
  }

  await deleteDoc(followRef);

  // Decrement, guarded by Firestore rules to not go below 0
  await updateDoc(doc(db, "users", currentUid), {
    followingCount: increment(-1),
  });
  await updateDoc(doc(db, "users", targetUid), {
    followersCount: increment(-1),
  });

  return { success: true };
};

/**
 * Check if currentUid is following targetUid.
 */
export const isFollowing = async (
  currentUid: string,
  targetUid: string
): Promise<boolean> => {
  if (!currentUid || !targetUid || currentUid === targetUid) return false;
  const followDocId = `${currentUid}_${targetUid}`;
  const snap = await getDoc(doc(db, "follows", followDocId));
  return snap.exists();
};

// ─── Followers / Following Lists ──────────────────────────────────────────────

/**
 * Get list of users who follow uid.
 */
export const getFollowers = async (uid: string, maxItems = 50): Promise<FollowRelationship[]> => {
  const q = query(
    collection(db, "follows"),
    where("followingId", "==", uid),
    orderBy("createdAt", "desc"),
    limit(maxItems)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as FollowRelationship);
};

/**
 * Get list of users that uid follows.
 */
export const getFollowing = async (uid: string, maxItems = 50): Promise<FollowRelationship[]> => {
  const q = query(
    collection(db, "follows"),
    where("followerId", "==", uid),
    orderBy("createdAt", "desc"),
    limit(maxItems)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as FollowRelationship);
};

// ─── User Profile ─────────────────────────────────────────────────────────────

/**
 * Fetch a user's public profile from Firestore.
 */
export const getUserPublicProfile = async (uid: string): Promise<PublicUserProfile | null> => {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const d = snap.data() as UserProfile;
  return {
    uid: d.uid,
    username: d.username,
    avatarIcon: d.avatarIcon,
    avatarGradient: d.avatarGradient,
    avatarUrl: d.avatarUrl,
    bio: d.bio,
    followersCount: d.followersCount ?? 0,
    followingCount: d.followingCount ?? 0,
    postsCount: d.postsCount ?? 0,
  };
};

/**
 * Real-time subscription to a user's profile.
 */
export const subscribeToUserProfile = (
  uid: string,
  callback: (profile: PublicUserProfile | null) => void
): (() => void) => {
  return onSnapshot(doc(db, "users", uid), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    const d = snap.data() as UserProfile;
    callback({
      uid: d.uid,
      username: d.username,
      avatarIcon: d.avatarIcon,
      avatarGradient: d.avatarGradient,
      avatarUrl: d.avatarUrl,
      bio: d.bio,
      followersCount: d.followersCount ?? 0,
      followingCount: d.followingCount ?? 0,
      postsCount: d.postsCount ?? 0,
    });
  });
};

/**
 * Real-time subscription to popular creators in Firestore.
 */
export const subscribeToSuggestedCreators = (
  callback: (creators: PublicUserProfile[]) => void
): (() => void) => {
  const usersRef = collection(db, "users");
  const q = query(usersRef, orderBy("followersCount", "desc"), limit(20));

  return onSnapshot(
    q,
    (snapshot) => {
      const creators: PublicUserProfile[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data() as UserProfile;
        return {
          uid: d.uid,
          username: d.username || "Anonymous Creator",
          avatarIcon: d.avatarIcon || "planet",
          avatarGradient: d.avatarGradient || ["#8B5CF6", "#EC4899"],
          avatarUrl: d.avatarUrl,
          bio: d.bio,
          followersCount: d.followersCount ?? 0,
          followingCount: d.followingCount ?? 0,
          postsCount: d.postsCount ?? 0,
        };
      });
      callback(creators);
    },
    () => callback([])
  );
};

// ─── Firebase Storage Uploads ────────────────────────────────────────────────

/**
 * Upload a profile photo to Firebase Storage.
 * Returns the public download URL and saves it to Firestore.
 */
export const uploadProfilePhoto = async (
  uid: string,
  imageUri: string,
  onProgress?: (pct: number) => void
): Promise<string> => {
  const path = `uploads/${uid}/profile.jpg`;
  const storageRef = ref(storage, path);

  const response = await fetch(imageUri);
  const blob = await response.blob();

  const task = uploadBytesResumable(storageRef, blob, { contentType: "image/jpeg" });

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        if (onProgress) onProgress((snap.bytesTransferred / snap.totalBytes) * 100);
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        // Persist to Firestore
        await updateDoc(doc(db, "users", uid), { avatarUrl: url });
        resolve(url);
      }
    );
  });
};

/**
 * Upload a post image to Firebase Storage.
 * Returns the public download URL.
 */
export const uploadPostImage = async (
  uid: string,
  imageUri: string,
  onProgress?: (pct: number) => void
): Promise<string> => {
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  const path = `uploads/${uid}/posts/${filename}`;
  const storageRef = ref(storage, path);

  const response = await fetch(imageUri);
  const blob = await response.blob();

  const task = uploadBytesResumable(storageRef, blob, { contentType: "image/jpeg" });

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        if (onProgress) onProgress((snap.bytesTransferred / snap.totalBytes) * 100);
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
};
