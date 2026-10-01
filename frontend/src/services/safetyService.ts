import { apiRequest } from "./apiClient";

const userLastActions: Record<string, number[]> = {};

export type SafetyCheckResult = {
  safe: boolean;
  reason?: string;
  flaggedType?: "profanity" | "threat" | "harassment" | "spam" | "rate_limit";
  toxicityScore: number;
};

const PROFANITY_PATTERNS = [
  /\b(fuck|shit|bitch|asshole|cunt|dick|pussy)\b/i,
];

const THREAT_HARASSMENT_PATTERNS = [
  /\b(kill yourself|kys|die|hope you die|i will kill you|attack|murder)\b/i,
  /\b(nigger|faggot|retard|chink|spic)\b/i,
];

export const checkRateLimit = (actionType: "post" | "message" | "comment"): boolean => {
  const key = `user_${actionType}`;
  const now = Date.now();
  const windowMs = 60 * 1000;

  if (!userLastActions[key]) {
    userLastActions[key] = [];
  }

  userLastActions[key] = userLastActions[key].filter((t) => now - t < windowMs);

  const limits = { post: 5, message: 12, comment: 8 };

  if (userLastActions[key].length >= limits[actionType]) {
    return false;
  }

  userLastActions[key].push(now);
  return true;
};

export const evaluateContentSafety = (text: string): SafetyCheckResult => {
  if (!text || text.trim().length === 0) {
    return { safe: true, toxicityScore: 0 };
  }

  let toxicityScore = 0;

  for (const pattern of THREAT_HARASSMENT_PATTERNS) {
    if (pattern.test(text)) {
      return {
        safe: false,
        reason: "Content flagged for threats, hate speech, or severe harassment.",
        flaggedType: "threat",
        toxicityScore: 95,
      };
    }
  }

  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(text)) {
      toxicityScore += 40;
    }
  }

  if (toxicityScore >= 80) {
    return {
      safe: false,
      reason: "Content contains explicit profanity or offensive language.",
      flaggedType: "profanity",
      toxicityScore,
    };
  }

  return { safe: true, toxicityScore };
};

export const blockUserInFirestore = async (targetUserId: string) => {
  await apiRequest(`/social/block/${targetUserId}`, { method: "POST" });
};

export const unblockUserInFirestore = async (targetUserId: string) => {
  await apiRequest(`/social/unblock/${targetUserId}`, { method: "POST" });
};

export const getBlockedUsersInFirestore = async (userId: string): Promise<string[]> => {
  const res = await apiRequest(`/social/blocked-users`);
  return res.data || [];
};

export const isUserBlockedInFirestore = async (userId: string, targetUserId: string): Promise<boolean> => {
  const blocked = await getBlockedUsersInFirestore(userId);
  return blocked.includes(targetUserId);
};

export const muteUserInFirestore = async (targetUserId: string) => {
  await apiRequest(`/social/mute/${targetUserId}`, { method: "POST" });
};

export const unmuteUserInFirestore = async (targetUserId: string) => {
  await apiRequest(`/social/unmute/${targetUserId}`, { method: "POST" });
};

export const submitContentReport = async (data: {
  targetType: "post" | "message" | "user" | "comment" | "whisper" | "profile";
  targetId: string;
  targetContent?: string;
  reason: string;
  details?: string;
}) => {
  await apiRequest("/social/reports", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const submitUserAppeal = async (data: {
  userHandle: string;
  reason: string;
  contactEmail?: string;
}) => {
  await apiRequest("/social/appeals", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const submitBugReport = async (data: {
  title: string;
  description: string;
  category?: string;
  platform?: string;
}) => {
  await apiRequest("/social/bugs", {
    method: "POST",
    body: JSON.stringify(data),
  });
};
