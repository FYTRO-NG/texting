import { Community } from "../mockData";
import { apiRequest } from "./apiClient";

export interface CommunityFull {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  visibility: "public" | "private";
  requireApproval: boolean;
  allowAnonymousPosts: boolean;
  avatarUrl?: string;
  coverUrl?: string;
  emoji?: string;
  ownerId: string;
  memberCount: number;
  postCount: number;
  rules: string[];
  joined?: boolean;
  createdAt?: any;
}

export const createCommunityInFirestore = async (data: {
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
  emoji?: string;
}) => {
  const apiRes = await apiRequest("/features/communities", {
    method: "POST",
    body: JSON.stringify(data),
  });

  if (apiRes.error) {
    throw new Error(apiRes.error);
  }
  return apiRes.data;
};

export const joinCommunityInFirestore = async (communityId: string) => {
  await apiRequest(`/features/communities/${communityId}/join`, { method: "POST" });
};

export const leaveCommunityInFirestore = async (communityId: string) => {
  await apiRequest(`/features/communities/${communityId}/leave`, { method: "POST" });
};

export const subscribeToCommunities = (callback: (communities: Community[]) => void) => {
  let isMounted = true;
  apiRequest("/features/communities").then((res) => {
    if (res.data && isMounted) callback(res.data);
  });
  return () => { isMounted = false; };
};

export const getCommunityBySlug = async (slug: string): Promise<CommunityFull | null> => {
  const res = await apiRequest(`/features/communities/${slug}`);
  return res.data || null;
};
