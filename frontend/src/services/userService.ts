import { apiRequest } from "./apiClient";
import type { UserProfile } from "./authService";

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

export const followUser = async (currentUserId: string, targetUserId: string): Promise<boolean> => {
  const res = await apiRequest(`/social/follow/${targetUserId}`, { method: "POST" });
  return !res.error;
};

export const unfollowUser = async (currentUserId: string, targetUserId: string): Promise<boolean> => {
  const res = await apiRequest(`/social/unfollow/${targetUserId}`, { method: "POST" });
  return !res.error;
};

export const isFollowing = async (currentUserId: string, targetUserId: string): Promise<boolean> => {
  const res = await apiRequest(`/social/is-following/${targetUserId}`);
  return !!res.data?.isFollowing;
};

export const subscribeIsFollowing = (
  currentUserId: string,
  targetUserId: string,
  callback: (following: boolean) => void
) => {
  let isMounted = true;
  isFollowing(currentUserId, targetUserId).then((res) => {
    if (isMounted) callback(res);
  });
  return () => { isMounted = false; };
};

export const subscribeToUserProfile = (
  userId: string,
  callback: (profile: UserProfile | null) => void
) => {
  let isMounted = true;
  apiRequest(`/users/${userId}`).then((res) => {
    if (res.data && isMounted) callback(res.data);
  });
  return () => { isMounted = false; };
};

export const searchUsers = async (queryStr: string): Promise<PublicUserProfile[]> => {
  const res = await apiRequest(`/users/search?q=${encodeURIComponent(queryStr)}`);
  return res.data || [];
};

export const uploadProfilePhoto = async (userId: string, uri: string): Promise<string> => {
  const formData = new FormData();
  formData.append("file", { uri, name: "avatar.jpg", type: "image/jpeg" } as any);
  const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL || "https://private-voices-api.onrender.com/api"}/media/upload`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  return data?.url || uri;
};
