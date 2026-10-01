import { useEffect, useState } from "react";
import { apiRequest, setAuthToken, clearAuthToken, setUserData, getUserData } from "./apiClient";

export type UserProfile = {
  uid: string;
  username: string;
  usernameLower?: string;
  displayName?: string;
  email?: string;
  avatarIcon: string;
  avatarGradient: [string, string];
  avatarUrl?: string;
  photoURL?: string;
  themeColor: string;
  bio?: string;
  reputationScore: number;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  privacy: {
    anonymousMessagesEnabled: boolean;
  };
  blockedUsers?: string[];
  mutedUsers?: string[];
  joinedAt?: any;
};

export type AuthError = {
  code: string;
  message: string;
};

// ─── Auth State Hook ──────────────────────────────────────────────────────────

export const useAuthState = () => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserData().then((localUser) => {
      if (localUser) {
        setUser({
          uid: localUser.uid || localUser.id || localUser._id,
          email: localUser.email,
          displayName: localUser.username || localUser.displayName,
        });
      }
      setLoading(false);
    });
  }, []);

  return { user, loading };
};

// ─── Error Messages ──────────────────────────────────────────────────────────

export const getFriendlyError = (code: string): string => {
  const map: Record<string, string> = {
    "invalid-email": "That email address doesn't look right.",
    "user-not-found": "No account found with that email or username.",
    "wrong-password": "Incorrect password. Please try again.",
    "email-already-in-use": "An account with this email already exists.",
    "weak-password": "Password must be at least 6 characters.",
  };
  return map[code] ?? code ?? "Something went wrong. Please try again.";
};

// ─── Email / Password Register ────────────────────────────────────────────────

export const registerWithEmail = async (
  email: string,
  password: string,
  username: string
): Promise<any> => {
  const apiRes = await apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, username }),
  });

  if (apiRes.data?.access_token) {
    await setAuthToken(apiRes.data.access_token);
    if (apiRes.data.user) {
      await setUserData(apiRes.data.user);
      return apiRes.data.user;
    }
  }
  
  if (apiRes.error) {
    throw new Error(apiRes.error);
  }

  throw new Error("Registration failed");
};

// ─── Email / Password Login ───────────────────────────────────────────────────

export const loginWithEmail = async (
  email: string,
  password: string
): Promise<any> => {
  const apiRes = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (apiRes.data?.access_token) {
    await setAuthToken(apiRes.data.access_token);
    if (apiRes.data.user) {
      await setUserData(apiRes.data.user);
      return apiRes.data.user;
    }
  }

  if (apiRes.error) {
    throw new Error(apiRes.error);
  }

  throw new Error("Login failed");
};

// ─── Anonymous Authentication ─────────────────────────────────────────────────

export const ensureAnonymousAuth = async (): Promise<any> => {
  const localUser = await getUserData();
  const token = await apiRequest("/auth/me");
  if (localUser && token.data) {
    return localUser;
  }

  const res = await apiRequest("/auth/anonymous", { method: "POST" });
  if (res.data?.access_token) {
    await setAuthToken(res.data.access_token);
    if (res.data.user) {
      await setUserData(res.data.user);
      return res.data.user;
    }
  }
  return localUser || { uid: "anon_" + Date.now(), username: "Anonymous" };
};

// ─── Password Reset ───────────────────────────────────────────────────────────

export const resetPassword = async (email: string): Promise<void> => {
  const apiRes = await apiRequest("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

  if (apiRes.error) {
    throw new Error(apiRes.error);
  }
};

// ─── Sign Out ─────────────────────────────────────────────────────────────────

export const logout = async (): Promise<void> => {
  await clearAuthToken();
};

// ─── Profile Helpers ──────────────────────────────────────────────────────────

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const apiRes = await apiRequest(`/users/${uid}`);
  if (apiRes.data) {
    return apiRes.data as UserProfile;
  }
  return null;
};

export const updateUserProfile = async (
  uid: string,
  updates: Partial<UserProfile>
) => {
  const apiRes = await apiRequest(`/users/me`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });

  if (apiRes.error) {
    throw new Error(apiRes.error);
  }
  return apiRes.data;
};

export const subscribeToUserProfile = (
  uid: string,
  callback: (profile: UserProfile | null) => void
) => {
  getUserProfile(uid).then(callback);
  return () => {};
};
