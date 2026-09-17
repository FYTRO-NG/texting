import { db } from "../firebase";
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
  const docRef = await addDoc(collection(db, "posts"), cleanDoc);
  try { await updateDoc(doc(db, "users", userId), { postsCount: increment(1) }); } catch (e) { console.warn("postsCount increment:", e); }
  return docRef;
};

export const toggleLikePost = async (postId: string, userId: string, isLiked: boolean) => {
  const ref = doc(db, "posts", postId);
  if (isLiked) { await updateDoc(ref, { likes: increment(-1), likedBy: arrayRemove(userId) }); }
  else { await updateDoc(ref, { likes: increment(1), likedBy: arrayUnion(userId) }); }
};

export const voteOnPollInFirestore = async (postId: string, optionIndex: number, currentPoll: any) => {
  const opts = [...currentPoll.options];
  opts[optionIndex] = { ...opts[optionIndex], votes: opts[optionIndex].votes + 1 };
  await updateDoc(doc(db, "posts", postId), { "poll.options": opts, "poll.total": increment(1) });
};

export const subscribeToComments = (postId: string, callback: (comments: any[]) => void) => {
  const q = query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (s) => callback(s.docs.map((d) => {
    const data = d.data();
    return { id: d.id, username: data.username || "Anonymous", avatarColor: data.avatarColor || ["#06B6D4", "#0284C7"], avatarIcon: data.avatarIcon || "flash", time: "Just now", text: data.text || "", likes: data.likes || 0, liked: false, op: data.isOp || false };
  })));
};

export const addCommentToFirestore = async (postId: string, commentData: { username: string; avatarColor: [string, string]; avatarIcon: string; text: string; isOp?: boolean }) => {
  await addDoc(collection(db, "posts", postId, "comments"), { ...commentData, likes: 0, createdAt: serverTimestamp() });
  await updateDoc(doc(db, "posts", postId), { commentsCount: increment(1) });
};

export const toggleSavePost = async (postId: string, userId: string, isSaved: boolean) => {
  const ref = doc(db, "posts", postId);
  if (isSaved) { await updateDoc(ref, { savedBy: arrayRemove(userId) }); }
  else { await updateDoc(ref, { savedBy: arrayUnion(userId) }); }
};

export const repostPostInFirestore = async (postId: string) => { await updateDoc(doc(db, "posts", postId), { reposts: increment(1) }); };

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
