import { apiRequest } from "./apiClient";

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
  createdAt: any;
  expiresAt: any;
  viewCount: number;
  status: StoryStatus;
};

export type StoryAuthorGroup = {
  authorId: string;
  authorUsername: string;
  authorDisplayName?: string;
  authorAvatarIcon?: string;
  authorAvatarGradient?: [string, string];
  stories: Story[];
  hasUnviewed: boolean;
};

export const createStoryInFirestore = async (input: {
  type: StoryType;
  content?: string;
  mediaUrl?: string;
  backgroundColor?: string;
}) => {
  const res = await apiRequest("/features/stories", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
};

export const subscribeToStoryTray = (
  currentUserId: string,
  callback: (groups: StoryAuthorGroup[]) => void
) => {
  let isMounted = true;
  apiRequest("/features/stories/feed").then((res) => {
    if (res.data && isMounted) callback(res.data);
  });
  return () => { isMounted = false; };
};

export const recordStoryViewInFirestore = async (storyId: string) => {
  await apiRequest(`/features/stories/${storyId}/view`, { method: "POST" });
};

export const deleteStoryInFirestore = async (storyId: string) => {
  await apiRequest(`/features/stories/${storyId}`, { method: "DELETE" });
};
