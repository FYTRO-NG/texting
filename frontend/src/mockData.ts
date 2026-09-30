import { colors, gradients } from "./theme";

export type Post = {
  id: string;
  username: string;
  authorId?: string;
  userId?: string;
  avatarColor: readonly [string, string];
  avatarIcon: string;
  community: string;
  communityEmoji: string;
  time: string;
  text: string;
  image?: string;
  voiceNote?: { duration: number; audioUrl?: string };
  poll?: { question: string; options: { label: string; votes: number }[]; total: number };
  likes: number;
  comments: number;
  reposts: number;
  viewCount?: number;
  liked?: boolean;
  saved?: boolean;
};

export type Community = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  members: string;
  cover: string;
  gradient: readonly [string, string];
  joined?: boolean;
};

export type ChatThread = {
  id: string;
  nickname: string;
  avatarColor: readonly [string, string];
  avatarIcon: string;
  lastMessage: string;
  time: string;
  unread: number;
  online?: boolean;
  otherUserId?: string;
};

export type Notification = {
  id: string;
  type: "like" | "comment" | "follow" | "mention" | "community";
  actor: string;
  actorGradient: readonly [string, string];
  text: string;
  time: string;
  unread: boolean;
};

export type Whisper = {
  id: string;
  message: string;
  time: string;
  unread: boolean;
  mood?: "kind" | "curious" | "confession" | "question";
  reactions?: number;
};

export type Comment = {
  id: string;
  username: string;
  authorId?: string;
  userId?: string;
  avatarColor: readonly [string, string];
  avatarIcon: string;
  time: string;
  text: string;
  likes: number;
  liked?: boolean;
  op?: boolean;
  replies?: Comment[];
};

export const AVATAR_GRADIENTS: readonly (readonly [string, string])[] = [
  ["#06B6D4", "#0284C7"],
  ["#8B5CF6", "#EC4899"],
  ["#10B981", "#06B6D4"],
  ["#F59E0B", "#EF4444"],
  ["#EC4899", "#8B5CF6"],
  ["#22D3EE", "#3B82F6"],
];

export const AVATAR_ICONS = [
  "planet",
  "flash",
  "flame",
  "diamond",
  "sparkles",
  "moon",
  "leaf",
  "paw",
  "rocket",
  "cube",
  "hexagon",
  "aperture",
];

export const THEME_COLORS = [
  "#06B6D4",
  "#8B5CF6",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#EF4444",
];

// Empty real arrays — all data is loaded from Firebase backend
export const posts: Post[] = [];
export const communities: Community[] = [];
export const trendingTags: { tag: string; posts: string; category: string }[] = [];
export const suggestedCreators: { name: string; followers: string; icon: string; gradient: readonly [string, string] }[] = [];
export const chats: ChatThread[] = [];
export const conversation: { id: string; fromMe: boolean; text: string; time: string }[] = [];
export const notifications: Notification[] = [];
export const achievements: { id: string; name: string; icon: string; color: string; unlocked: boolean }[] = [];
export const whispers: Whisper[] = [];
export const comments: Comment[] = [];
