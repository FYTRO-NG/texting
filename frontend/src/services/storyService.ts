import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions, auth } from "../firebase";
import { apiRequest } from "./apiClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StoryType = "text" | "image";
export type StoryStatus = "active" | "deleted" | "moderation_review" | "blocked";

export type Story = {
  id: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName?: string;
  authorAvatarIcon?: string;
  authorAvatarGradient?: [string, string];
  type: StoryType;
  content?: string;
  mediaUrl?: string;
  backgroundColor?: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  viewCount: number;
  status: StoryStatus;
};

/** One entry per author in the Story Tray. Groups that author's active stories. */
export type StoryAuthorGroup = {
  authorId: string;
  authorUsername: string;
  authorDisplayName?: string;
  authorAvatarIcon?: string;
  authorAvatarGradient?: [string, string];
  stories: Story[];
  hasUnviewed: boolean;
};

// ─── Callable Function Wrappers ───────────────────────────────────────────────

export type CreateStoryInput = {
  type: StoryType;
  content?: string;
  mediaUrl?: string;
  backgroundColor?: string;
};

export type CreateStoryResult = {
  success: boolean;
  storyId?: string;
  error?: string;
};

/** Calls the server-side createStory Cloud Function (sets timestamps server-side). */
export const callCreateStory = async (
  input: CreateStoryInput
): Promise<CreateStoryResult> => {
  // Dual-write story to FastAPI MongoDB backend (24h TTL automatic expiration)
  try {
    await apiRequest("/stories", {
      method: "POST",
      body: JSON.stringify({
        type: input.type,
        content: input.content,
        mediaUrl: input.mediaUrl,
        backgroundColor: input.backgroundColor
      }),
    });
  } catch (backendErr) {
    console.warn("FastAPI MongoDB story creation sync:", backendErr);
  }

  const fn = httpsCallable<CreateStoryInput, CreateStoryResult>(
    functions,
    "createStory"
  );
  const result = await fn(input);
  return result.data;
};

export type RecordStoryViewResult = {
  success: boolean;
  alreadyViewed?: boolean;
};

/** Calls the server-side recordStoryView Cloud Function (atomic viewCount increment). */
export const callRecordStoryView = async (
  storyId: string
): Promise<RecordStoryViewResult> => {
  // Sync view count to FastAPI backend
  try {
    await apiRequest(`/stories/${storyId}/view`, { method: "POST" });
  } catch (backendErr) {
    console.warn("FastAPI MongoDB story view sync:", backendErr);
  }

  const fn = httpsCallable<{ storyId: string }, RecordStoryViewResult>(
    functions,
    "recordStoryView"
  );
  const result = await fn({ storyId });
  return result.data;
};

export type DeleteStoryResult = { success: boolean };

/** Calls server-side deleteStory Cloud Function (soft-deletes the story). */
export const callDeleteStory = async (
  storyId: string
): Promise<DeleteStoryResult> => {
  const fn = httpsCallable<{ storyId: string }, DeleteStoryResult>(
    functions,
    "deleteStory"
  );
  const result = await fn({ storyId });
  return result.data;
};

// ─── Viewed State Cache ───────────────────────────────────────────────────────

/**
 * Fetches the current user's viewed-story IDs from their lightweight cache doc.
 * This is a single read — used to render unviewed rings in the tray
 * without issuing one read per story.
 */
export const getViewedStoryIds = async (uid: string): Promise<Set<string>> => {
  try {
    const snap = await getDoc(doc(db, "users", uid, "storyViewState", "cache"));
    if (!snap.exists()) return new Set();
    const data = snap.data();
    return new Set<string>(data?.viewedStoryIds ?? []);
  } catch {
    return new Set();
  }
};

/**
 * Updates the local viewed-state cache after a user watches a story.
 * This is best-effort/optimistic — the authoritative record is the viewer subcollection.
 */
export const markStoryViewedLocally = async (
  uid: string,
  storyId: string
): Promise<void> => {
  try {
    const ref = doc(db, "users", uid, "storyViewState", "cache");
    const snap = await getDoc(ref);
    const existing: string[] = snap.exists()
      ? (snap.data()?.viewedStoryIds ?? [])
      : [];
    if (existing.includes(storyId)) return;
    await setDoc(
      ref,
      { viewedStoryIds: [...existing, storyId], updatedAt: Timestamp.now() },
      { merge: true }
    );
  } catch {
    // best-effort — ignore
  }
};

// ─── Story Subscriptions ──────────────────────────────────────────────────────

/**
 * Subscribes to all active stories (expiresAt > now, status == active).
 * Returns one real-time listener — NOT one per story.
 * Groups results by author for the tray.
 */
export const subscribeToActiveStories = (
  callback: (groups: StoryAuthorGroup[], rawStories: Story[]) => void,
  viewedIds: Set<string> = new Set()
): (() => void) => {
  const now = Timestamp.now();
  const q = query(
    collection(db, "stories"),
    where("status", "==", "active"),
    where("expiresAt", ">", now),
    orderBy("expiresAt", "asc"),
    limit(100)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const stories: Story[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          authorId: data.authorId,
          authorUsername: data.authorUsername ?? "voice",
          authorDisplayName: data.authorDisplayName,
          authorAvatarIcon: data.authorAvatarIcon ?? "person",
          authorAvatarGradient: data.authorAvatarGradient ?? ["#8B5CF6", "#06B6D4"],
          type: data.type ?? "text",
          content: data.content,
          mediaUrl: data.mediaUrl,
          backgroundColor: data.backgroundColor,
          createdAt: data.createdAt,
          expiresAt: data.expiresAt,
          viewCount: data.viewCount ?? 0,
          status: data.status ?? "active",
        } as Story;
      });

      // Group by author (preserve insertion order = earliest expiry first per author)
      const authorMap = new Map<string, StoryAuthorGroup>();
      for (const story of stories) {
        if (!authorMap.has(story.authorId)) {
          authorMap.set(story.authorId, {
            authorId: story.authorId,
            authorUsername: story.authorUsername,
            authorDisplayName: story.authorDisplayName,
            authorAvatarIcon: story.authorAvatarIcon,
            authorAvatarGradient: story.authorAvatarGradient,
            stories: [],
            hasUnviewed: false,
          });
        }
        const group = authorMap.get(story.authorId)!;
        group.stories.push(story);
        if (!viewedIds.has(story.id)) {
          group.hasUnviewed = true;
        }
      }

      callback(Array.from(authorMap.values()), stories);
    },
    (err) => {
      console.warn("[storyService] stories listener error:", err);
      callback([], []);
    }
  );
};

/**
 * Fetches a single author's active stories ordered chronologically.
 * Used when opening the Story Viewer.
 */
export const subscribeToAuthorStories = (
  authorId: string,
  callback: (stories: Story[]) => void
): (() => void) => {
  const now = Timestamp.now();
  const q = query(
    collection(db, "stories"),
    where("authorId", "==", authorId),
    where("status", "==", "active"),
    where("expiresAt", ">", now),
    orderBy("expiresAt", "asc"),
    limit(20)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const stories: Story[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          authorId: data.authorId,
          authorUsername: data.authorUsername ?? "voice",
          authorDisplayName: data.authorDisplayName,
          authorAvatarIcon: data.authorAvatarIcon ?? "person",
          authorAvatarGradient: data.authorAvatarGradient ?? ["#8B5CF6", "#06B6D4"],
          type: data.type ?? "text",
          content: data.content,
          mediaUrl: data.mediaUrl,
          backgroundColor: data.backgroundColor,
          createdAt: data.createdAt,
          expiresAt: data.expiresAt,
          viewCount: data.viewCount ?? 0,
          status: data.status ?? "active",
        } as Story;
      });
      callback(stories);
    },
    (err) => {
      console.warn("[storyService] author stories listener error:", err);
      callback([]);
    }
  );
};

/** Returns the current user's active stories (for the "Your Story" bubble). */
export const subscribeToMyStories = (
  uid: string,
  callback: (stories: Story[]) => void
): (() => void) => {
  return subscribeToAuthorStories(uid, callback);
};

/** Helper — relative time string for story header. */
export const storyRelativeTime = (createdAt: Timestamp): string => {
  const diffMs = Date.now() - createdAt.toMillis();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return "23h";
};
