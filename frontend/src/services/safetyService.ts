import { db, auth } from "../firebase";
import { ensureAnonymousAuth } from "./authService";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  getDoc
} from "firebase/firestore";

// Local state tracking for client-side rate limiting
const userLastActions: Record<string, number[]> = {};

export type SafetyCheckResult = {
  safe: boolean;
  reason?: string;
  flaggedType?: "profanity" | "threat" | "harassment" | "spam" | "rate_limit";
  toxicityScore: number;
};

// Common profanity and threat patterns
const PROFANITY_PATTERNS = [
  /\b(fuck|shit|bitch|asshole|cunt|dick|pussy)\b/i,
];

const THREAT_HARASSMENT_PATTERNS = [
  /\b(kill yourself|kys|die|hope you die|i will kill you|attack|murder)\b/i,
  /\b(nigger|faggot|retard|chink|spic)\b/i,
];

export const checkRateLimit = (actionType: "post" | "message" | "comment"): boolean => {
  const userId = auth.currentUser?.uid || "anon-user";
  const key = `${userId}_${actionType}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window

  if (!userLastActions[key]) {
    userLastActions[key] = [];
  }

  // Filter actions in current window
  userLastActions[key] = userLastActions[key].filter((t) => now - t < windowMs);

  const limits = {
    post: 5,
    message: 12,
    comment: 8,
  };

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

  // 1. Check severe threats & harassment
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

  // 2. Check profanity
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
  const currentUserId = auth.currentUser?.uid;
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) return;

  const userRef = doc(db, "users", currentUserId);
  await updateDoc(userRef, {
    blockedUsers: arrayUnion(targetUserId),
  });
};

export const unblockUserInFirestore = async (targetUserId: string) => {
  const currentUserId = auth.currentUser?.uid;
  if (!currentUserId || !targetUserId) return;

  const userRef = doc(db, "users", currentUserId);
  await updateDoc(userRef, {
    blockedUsers: arrayRemove(targetUserId),
  });
};

export const getBlockedUsersInFirestore = async (userId: string): Promise<string[]> => {
  if (!userId) return [];
  try {
    const snap = await getDoc(doc(db, "users", userId));
    if (snap.exists()) {
      return (snap.data()?.blockedUsers as string[]) || [];
    }
  } catch (err) {
    console.warn("Failed to get blocked users:", err);
  }
  return [];
};

export const isUserBlockedInFirestore = async (userId: string, targetUserId: string): Promise<boolean> => {
  if (!userId || !targetUserId) return false;
  try {
    const blocked = await getBlockedUsersInFirestore(userId);
    return blocked.includes(targetUserId);
  } catch {
    return false;
  }
};

export const muteUserInFirestore = async (targetUserId: string) => {
  const currentUserId = auth.currentUser?.uid;
  if (!currentUserId || !targetUserId) return;

  const userRef = doc(db, "users", currentUserId);
  await updateDoc(userRef, {
    mutedUsers: arrayUnion(targetUserId),
  });
};

export const unmuteUserInFirestore = async (targetUserId: string) => {
  const currentUserId = auth.currentUser?.uid;
  if (!currentUserId || !targetUserId) return;

  const userRef = doc(db, "users", currentUserId);
  await updateDoc(userRef, {
    mutedUsers: arrayRemove(targetUserId),
  });
};

export const submitContentReport = async (data: {
  targetType: "post" | "message" | "user" | "comment" | "whisper" | "profile";
  targetId: string;
  targetContent?: string;
  reason: string;
  details?: string;
}) => {
  let currentUserId = auth.currentUser?.uid;
  if (!currentUserId) {
    const anon = await ensureAnonymousAuth().catch(() => null);
    currentUserId = anon?.uid || "anon-user";
  }
  const reportsRef = collection(db, "moderation_reports");

  await addDoc(reportsRef, {
    reporterId: currentUserId,
    ...data,
    status: "pending",
    createdAt: serverTimestamp(),
  });
};

export const submitUserAppeal = async (data: {
  userHandle: string;
  reason: string;
  contactEmail?: string;
}) => {
  const currentUserId = auth?.currentUser?.uid || "anon-user";
  const appealsRef = collection(db, "user_appeals");

  await addDoc(appealsRef, {
    userId: currentUserId,
    ...data,
    status: "pending",
    createdAt: serverTimestamp(),
  });
};

export const submitBugReport = async (data: {
  title: string;
  description: string;
  category?: string;
  platform?: string;
}) => {
  let user = auth?.currentUser;
  if (!user) {
    user = await ensureAnonymousAuth().catch(() => null);
  }
  const currentUserId = user?.uid || "anon-user";
  const bugsRef = collection(db, "bug_reports");

  await addDoc(bugsRef, {
    userId: currentUserId,
    ...data,
    status: "OPEN",
    createdAt: serverTimestamp(),
  });
};
