import { db, auth } from "../firebase";
import { apiRequest } from "./apiClient";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from "firebase/firestore";
import { Post } from "../mockData";

export type PostImage = { url: string; storagePath: string };
export type ReplyPermission = "everyone" | "followers" | "none";

export type CreatePostInput = {
  username: string;
  avatarColor: [string, string];
  avatarIcon: string;
  avatarUrl?: string;
  community: string;
  communityEmoji: string;
  text: string;
  images?: PostImage[];
  poll?: { question: string; options: { label: string; votes: number }[]; total: number };
  userId: string;
  replyPermission?: ReplyPermission;
  visibility?: "public" | "followers";
  status?: "published" | "pending_review";
};

function resolveFirstImage(data: any): string | undefined {
  if (data.image) return data.image;
  if (data.images && data.images.length > 0) {
    const first = data.images[0];
    return typeof first === "string" ? first : first?.url;
  }
  return undefined;
}

function mapDocToPost(docSnap: any, saved = false): Post {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    username: data.username || "Anonymous Voice",
    authorId: data.authorId || data.userId || undefined,
    userId: data.userId || data.authorId || undefined,
    avatarColor: data.avatarColor || ["#06B6D4", "#0284C7"],
    avatarIcon: data.avatarIcon || "flash",
    community: data.community || "General",
    communityEmoji: data.communityEmoji || "💬",
    time: data.createdAt ? "Just now" : "1m",
    text: data.text || "",
    image: resolveFirstImage(data),
    poll: data.poll,
    likes: data.likes || 0,
    comments: data.commentsCount || 0,
    reposts: data.reposts || 0,
    viewCount: data.viewCount || 0,
    liked: false,
    saved,
  };
}

export const subscribeToPosts = (callback: (posts: Post[]) => void) => {
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50));
  return onSnapshot(q, (s) => callback(s.docs.map((d) => mapDocToPost(d))), (err) => { console.warn("posts listener:", err); callback([]); });
};

export const createPostInFirestore = async (postData: CreatePostInput) => {
  const { images, userId, replyPermission = "everyone", visibility = "public", status = "published", avatarUrl, ...rest } = postData;
  const firestoreDoc: Record<string, any> = {
    ...rest, authorId: userId, userId, replyPermission, visibility, status,
    imageCount: images?.length ?? 0, likes: 0, commentsCount: 0, reposts: 0,
    likedBy: [], savedBy: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  if (avatarUrl) firestoreDoc.avatarUrl = avatarUrl;
  if (images && images.length > 0) { firestoreDoc.images = images; firestoreDoc.image = images[0].url; }
  const cleanDoc: Record<string, any> = {};
  Object.entries(firestoreDoc).forEach(([k, v]) => { if (v !== undefined) cleanDoc[k] = v; });
  // Dual-write to FastAPI MongoDB backend
  try {
    await apiRequest("/posts", {
      method: "POST",
      body: JSON.stringify({
        text: postData.text,
        community: postData.community,
        communityEmoji: postData.communityEmoji,
        images: postData.images || [],
        poll: postData.poll,
        replyPermission: postData.replyPermission,
        visibility: postData.visibility
      }),
    });
  } catch (backendErr) {
    console.warn("FastAPI MongoDB post creation sync:", backendErr);
  }

  return docRef;
};

import { functions } from "../firebase";
import { httpsCallable } from "firebase/functions";

export const toggleLikePost = async (postId: string, userId: string, isLiked: boolean) => {
  // Sync like with FastAPI backend
  try {
    await apiRequest(`/posts/${postId}/like`, { method: "POST" });
  } catch (backendErr) {
    console.warn("FastAPI MongoDB like sync:", backendErr);
  }

  try {
    const callable = httpsCallable(functions, "toggleLikePostCallable");
    await callable({ postId });
  } catch (e) {
    console.warn("toggleLikePost error:", e);
  }
};

export const voteOnPollInFirestore = async (postId: string, optionIndex: number, currentPoll: any) => {
  try {
    const callable = httpsCallable(functions, "voteOnPollCallable");
    await callable({ postId, optionIndex });
  } catch (e) {
    console.warn("voteOnPoll error:", e);
  }
};

export const subscribeToComments = (postId: string, callback: (comments: any[]) => void) => {
  const q = query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (s) => callback(s.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      username: data.username || "Anonymous",
      authorId: data.authorId || data.userId || undefined,
      userId: data.userId || data.authorId || undefined,
      avatarColor: data.avatarColor || ["#06B6D4", "#0284C7"],
      avatarIcon: data.avatarIcon || "flash",
      time: "Just now",
      text: data.text || "",
      likes: data.likes || 0,
      liked: false,
      op: data.isOp || false
    };
  })));
};

export const addCommentToFirestore = async (
  postId: string,
  commentData: {
    username: string;
    authorId?: string;
    userId?: string;
    avatarColor: [string, string];
    avatarIcon: string;
    text: string;
    isOp?: boolean;
  }
) => {
  const currentUid = auth.currentUser?.uid;
  const authorId = commentData.authorId || commentData.userId || currentUid;
  await addDoc(collection(db, "posts", postId, "comments"), {
    ...commentData,
    authorId,
    userId: authorId,
    likes: 0,
    createdAt: serverTimestamp(),
  });
};

export const toggleSavePost = async (postId: string, userId: string, isSaved: boolean) => {
  try {
    const callable = httpsCallable(functions, "toggleSavePostCallable");
    await callable({ postId });
  } catch (e) {
    console.warn("toggleSavePost error:", e);
  }
};

export const repostPostInFirestore = async (postId: string) => {
  try {
    const callable = httpsCallable(functions, "repostPostCallable");
    await callable({ postId });
  } catch (e) {
    console.warn("repostPost error:", e);
  }
};

export const reportPostInFirestore = async (postId: string, userId: string, reason: string) => {
  await addDoc(collection(db, "reports"), { postId, userId, reason, createdAt: serverTimestamp() });
};

export const getPostById = async (postId: string): Promise<Post | null> => {
  const snap = await getDoc(doc(db, "posts", postId));
  if (!snap.exists()) return null;
  return mapDocToPost(snap);
};

export const subscribeToPostsByUser = (userId: string, callback: (posts: Post[]) => void) => {
  const q = query(collection(db, "posts"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(30));
  return onSnapshot(q, (s) => callback(s.docs.map((d) => mapDocToPost(d))), () => callback([]));
};

export const subscribeToPostsByCommunity = (communityName: string, callback: (posts: Post[]) => void) => {
  const q = query(collection(db, "posts"), where("community", "==", communityName), orderBy("createdAt", "desc"), limit(50));
  return onSnapshot(q, (s) => callback(s.docs.map((d) => mapDocToPost(d))), () => callback([]));
};

export const subscribeToSavedPosts = (userId: string, callback: (posts: Post[]) => void) => {
  const q = query(collection(db, "posts"), where("savedBy", "array-contains", userId), orderBy("createdAt", "desc"), limit(30));
  return onSnapshot(q, (s) => callback(s.docs.map((d) => mapDocToPost(d, true))), () => callback([]));
};

/** Increment viewCount once per post open (fire-and-forget, no throw). */
export const incrementViewCount = async (postId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, "posts", postId), { viewCount: increment(1) });
  } catch (_) {
    // non-critical — ignore errors silently
  }
};

export type PostAnalytics = {
  postId: string;
  text: string;
  viewCount: number;
  likes: number;
  comments: number;
  reposts: number;
  saves: number;
  createdAt: Date | null;
};

/** Live subscription returning analytics metrics for a single post. */
export const subscribeToPostAnalytics = (
  postId: string,
  callback: (data: PostAnalytics | null) => void
) => {
  return onSnapshot(doc(db, "posts", postId), (snap) => {
    if (!snap.exists()) { callback(null); return; }
    const d = snap.data();
    callback({
      postId: snap.id,
      text: d.text || "",
      viewCount: d.viewCount || 0,
      likes: d.likes || 0,
      comments: d.commentsCount || 0,
      reposts: d.reposts || 0,
      saves: (d.savedBy?.length) || 0,
      createdAt: d.createdAt?.toDate?.() ?? null,
    });
  }, () => callback(null));
};

/** Live subscription returning aggregated analytics across all of a user's posts. */
export const subscribeToUserPostsAnalytics = (
  userId: string,
  callback: (posts: PostAnalytics[]) => void
) => {
  const q = query(collection(db, "posts"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(50));
  return onSnapshot(q, (s) => {
    const results: PostAnalytics[] = s.docs.map((snap) => {
      const d = snap.data();
      return {
        postId: snap.id,
        text: d.text || "",
        viewCount: d.viewCount || 0,
        likes: d.likes || 0,
        comments: d.commentsCount || 0,
        reposts: d.reposts || 0,
        saves: (d.savedBy?.length) || 0,
        createdAt: d.createdAt?.toDate?.() ?? null,
      };
    });
    callback(results);
  }, () => callback([]));
};
