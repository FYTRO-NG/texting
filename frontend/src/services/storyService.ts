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
  const res = await apiRequest("/stories", {
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
  apiRequest("/stories").then((res) => {
    if (res.data && isMounted) {
      // Group stories by author
      const groupedMap: Record<string, StoryAuthorGroup> = {};
      (res.data as Story[]).forEach((story) => {
        if (!groupedMap[story.authorId]) {
          groupedMap[story.authorId] = {
            authorId: story.authorId,
            authorUsername: story.authorUsername,
            authorDisplayName: story.authorDisplayName,
            authorAvatarIcon: story.authorAvatarIcon,
            authorAvatarGradient: story.authorAvatarGradient,
            stories: [],
            hasUnviewed: false,
          };
        }
        groupedMap[story.authorId].stories.push(story);
        if (!(story as any).viewed) {
          groupedMap[story.authorId].hasUnviewed = true;
        }
      });
      callback(Object.values(groupedMap));
    }
  });
  return () => { isMounted = false; };
};

export const recordStoryViewInFirestore = async (storyId: string) => {
  await apiRequest(`/stories/${storyId}/view`, { method: "POST" });
};

export const deleteStoryInFirestore = async (storyId: string) => {
  await apiRequest(`/stories/${storyId}`, { method: "DELETE" });
};
