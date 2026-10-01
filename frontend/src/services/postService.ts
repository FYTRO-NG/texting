import { apiRequest } from "./apiClient";
import { Post } from "../mockData";

export type PostImage = { url: string; storagePath?: string };
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

export const subscribeToPosts = (callback: (posts: Post[]) => void) => {
  let isMounted = true;
  const fetchPosts = async () => {
    const res = await apiRequest("/posts");
    if (res.data && isMounted) {
      callback(res.data);
    }
  };
  fetchPosts();
  const interval = setInterval(fetchPosts, 5000);
  return () => {
    isMounted = false;
    clearInterval(interval);
  };
};

export const createPostInFirestore = async (postData: CreatePostInput) => {
  const apiRes = await apiRequest("/posts", {
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
  if (apiRes.error) {
    throw new Error(apiRes.error);
  }
  return apiRes.data || { id: "post_" + Date.now() };
};

export const toggleLikePost = async (postId: string, userId: string, isLiked: boolean) => {
  await apiRequest(`/posts/${postId}/like`, { method: "POST" });
};

export const voteOnPollInFirestore = async (postId: string, optionIndex: number, currentPoll: any) => {
  await apiRequest(`/posts/${postId}/vote`, {
    method: "POST",
    body: JSON.stringify({ optionIndex }),
  });
};

export const subscribeToComments = (postId: string, callback: (comments: any[]) => void) => {
  let isMounted = true;
  const fetchComments = async () => {
    const res = await apiRequest(`/posts/${postId}/comments`);
    if (res.data && isMounted) {
      callback(res.data);
    }
  };
  fetchComments();
  const interval = setInterval(fetchComments, 4000);
  return () => {
    isMounted = false;
    clearInterval(interval);
  };
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
  await apiRequest(`/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ text: commentData.text }),
  });
};

export const toggleSavePost = async (postId: string, userId: string, isSaved: boolean) => {
  await apiRequest(`/posts/${postId}/save`, { method: "POST" });
};

export const repostPostInFirestore = async (postId: string) => {
  await apiRequest(`/posts/${postId}/repost`, { method: "POST" });
};

export const reportPostInFirestore = async (postId: string, userId: string, reason: string) => {
  await apiRequest(`/posts/${postId}/report`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
};

export const getPostById = async (postId: string): Promise<Post | null> => {
  const res = await apiRequest(`/posts/${postId}`);
  return res.data || null;
};

export const subscribeToPostsByUser = (userId: string, callback: (posts: Post[]) => void) => {
  let isMounted = true;
  apiRequest(`/users/${userId}/posts`).then((res) => {
    if (res.data && isMounted) callback(res.data);
  });
  return () => { isMounted = false; };
};

export const subscribeToPostsByCommunity = (communityName: string, callback: (posts: Post[]) => void) => {
  let isMounted = true;
  apiRequest(`/posts?community=${encodeURIComponent(communityName)}`).then((res) => {
    if (res.data && isMounted) callback(res.data);
  });
  return () => { isMounted = false; };
};

export const subscribeToSavedPosts = (userId: string, callback: (posts: Post[]) => void) => {
  let isMounted = true;
  apiRequest(`/users/me/saved-posts`).then((res) => {
    if (res.data && isMounted) callback(res.data);
  });
  return () => { isMounted = false; };
};

export const incrementViewCount = async (postId: string): Promise<void> => {
  await apiRequest(`/posts/${postId}/view`, { method: "POST" });
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

export const subscribeToPostAnalytics = (
  postId: string,
  callback: (data: PostAnalytics | null) => void
) => {
  let isMounted = true;
  apiRequest(`/posts/${postId}/analytics`).then((res) => {
    if (res.data && isMounted) callback(res.data);
  });
  return () => { isMounted = false; };
};

export const subscribeToUserPostsAnalytics = (
  userId: string,
  callback: (posts: PostAnalytics[]) => void
) => {
  let isMounted = true;
  apiRequest(`/users/${userId}/analytics`).then((res) => {
    if (res.data && isMounted) callback(res.data);
  });
  return () => { isMounted = false; };
};
