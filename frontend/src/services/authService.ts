import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

import { auth, db } from "../firebase";
import { apiRequest, setAuthToken, clearAuthToken, setUserData, getUserData } from "./apiClient";

export { auth, db };

// ─── Types ────────────────────────────────────────────────────────────────────

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
  lastUsernameChangeAt?: any;
  nextUsernameChangeAt?: any;
  joinedAt?: any;
};

export type AuthError = {
  code: string;
  message: string;
};

// ─── Auth State Hook ──────────────────────────────────────────────────────────

export const useAuthState = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local FastAPI authenticated session
    getUserData().then((localUser) => {
      if (localUser && !user) {
        setUser({
          uid: localUser.uid || localUser._id,
          email: localUser.email,
          displayName: localUser.username,
        } as any);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, loading };
};

// ─── Friendly Error Messages ──────────────────────────────────────────────────

export const getFriendlyError = (code: string): string => {
  const map: Record<string, string> = {
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/user-not-found": "No account found with that email or username.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "Network error. Please check your connection.",
    "auth/popup-closed-by-user": "Sign-in popup was closed before completing.",
    "auth/cancelled-popup-request": "Another sign-in popup is already open.",
    "auth/invalid-credential": "Incorrect email or password. Please try again.",
  };
  return map[code] ?? "Something went wrong. Please try again.";
};

// ─── Email / Password Register ────────────────────────────────────────────────

export const ensureUserProfile = async (user: User): Promise<UserProfile> => {
  if (!user || !user.uid) {
    throw new Error("Cannot ensure profile for unauthenticated user.");
  }

  const userRef = doc(db, "users", user.uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }

    // Document does not exist — repair orphan account with initial default profile
    const derivedUsername =
      user.displayName ??
      (user.email ? user.email.split("@")[0] : `User_${user.uid.slice(0, 6)}`);

    const newProfile: UserProfile = {
      uid: user.uid,
      username: derivedUsername,
      displayName: user.displayName ?? derivedUsername,
      email: user.email ?? undefined,
      photoURL: user.photoURL ?? undefined,
      avatarIcon: "person",
      avatarGradient: ["#8B5CF6", "#06B6D4"],
      themeColor: "#8B5CF6",
      bio: "",
      reputationScore: 100,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      privacy: {
        anonymousMessagesEnabled: true,
      },
      joinedAt: serverTimestamp(),
    };

    await setDoc(userRef, newProfile);
    return newProfile;
  } catch (e: any) {
    console.error("🚨 FIRESTORE USER PROFILE SYNC ERROR:", {
      name: e?.name,
      code: e?.code,
      message: e?.message,
      path: `users/${user.uid}`,
      databaseId: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_ID ?? "private-voices",
    });
    throw new Error(
      e?.message || "Failed to synchronize user profile. Please check your internet connection."
    );
  }
};

export const registerWithEmail = async (
  email: string,
  password: string,
  username: string
): Promise<User> => {
  // 1. Primary: Register on FastAPI + MongoDB
  let fastApiUser: any = null;
  const apiRes = await apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, username }),
  });

  if (apiRes.data?.access_token) {
    await setAuthToken(apiRes.data.access_token);
    if (apiRes.data.user) {
      await setUserData(apiRes.data.user);
      fastApiUser = apiRes.data.user;
    }
  } else if (apiRes.error) {
    throw new Error(apiRes.error);
  }

  // 2. Secondary / Fallback: Firebase Auth bridge
  let user: User;
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    user = credential.user;
    await updateProfile(user, { displayName: username }).catch(() => {});
  } catch (err: any) {
    // If Firebase fails or already exists, construct user object from FastAPI session
    if (fastApiUser) {
      return {
        uid: fastApiUser.uid || fastApiUser._id,
        email: fastApiUser.email,
        displayName: fastApiUser.username,
      } as any;
    }
    throw err;
  }

  // Sync to Firestore profile if available
  const userRef = doc(db, "users", user.uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      await updateDoc(userRef, { username, displayName: username, email });
    } else {
      const profile: UserProfile = {
        uid: user.uid,
        username,
        displayName: username,
        email,
        avatarIcon: "person",
        avatarGradient: ["#8B5CF6", "#06B6D4"],
        themeColor: "#8B5CF6",
        bio: "",
        reputationScore: 100,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        privacy: { anonymousMessagesEnabled: true },
        joinedAt: serverTimestamp(),
      };
      await setDoc(userRef, profile);
    }
  } catch (e: any) {
    console.warn("Firestore profile sync skipped or failed (using MongoDB):", e?.message);
  }

  return user;
};


// ─── Email / Password Login ───────────────────────────────────────────────────

export const loginWithEmail = async (
  email: string,
  password: string
): Promise<User> => {
  // 1. Primary: Authenticate via FastAPI + MongoDB
  let fastApiUser: any = null;
  const apiRes = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (apiRes.data?.access_token) {
    await setAuthToken(apiRes.data.access_token);
    if (apiRes.data.user) {
      await setUserData(apiRes.data.user);
      fastApiUser = apiRes.data.user;
    }
  } else if (apiRes.error) {
    throw new Error(apiRes.error);
  }

  // 2. Secondary / Fallback: Firebase Auth bridge
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserProfile(credential.user).catch(() => {});
    return credential.user;
  } catch (e: any) {
    // If Firebase Auth fails (or is bypassed), return session constructed from FastAPI
    if (fastApiUser) {
      return {
        uid: fastApiUser.uid || fastApiUser._id,
        email: fastApiUser.email,
        displayName: fastApiUser.username,
      } as any;
    }
    throw e;
  }
};

// ─── Google Sign-In (Web popup) ───────────────────────────────────────────────

export const loginWithGoogle = async (): Promise<User> => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(auth, provider);
  const user = credential.user;
  // Repair or create profile if missing
  await ensureUserProfile(user);
  return user;
};

// ─── Anonymous Sign-In ────────────────────────────────────────────────────────

export const ensureAnonymousAuth = async (): Promise<User> => {
  if (auth?.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
};

// ─── Password Reset ───────────────────────────────────────────────────────────

export const resetPassword = async (email: string): Promise<void> => {
  await sendPasswordResetEmail(auth, email);
};

// ─── Sign Out ─────────────────────────────────────────────────────────────────

export const logout = async (): Promise<void> => {
  await clearAuthToken();
  await signOut(auth);
};

// ─── Profile Helpers ──────────────────────────────────────────────────────────

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    return snap.data() as UserProfile;
  }

  // If current logged-in user profile document is missing, auto-repair
  if (auth?.currentUser?.uid === uid) {
    try {
      return await ensureUserProfile(auth.currentUser);
    } catch (e) {
      console.error("[getUserProfile] Auto-repair failed for current user:", e);
    }
  }

  return null;
};

export const createUserProfile = async (
  uid: string,
  profileData: Omit<UserProfile, "uid" | "reputationScore">
): Promise<UserProfile> => {
  const fullProfile: UserProfile = {
    uid,
    ...profileData,
    reputationScore: 100,
    privacy: profileData.privacy ?? { anonymousMessagesEnabled: true },
    joinedAt: serverTimestamp(),
  };
  await setDoc(doc(db, "users", uid), fullProfile, { merge: true });
  return fullProfile;
};

export const updateUserProfile = async (
  uid: string,
  updates: Partial<UserProfile>
) => {
  await updateDoc(doc(db, "users", uid), updates as any);
};

export const subscribeToUserProfile = (
  uid: string,
  callback: (profile: UserProfile | null) => void
) => {
  if (!uid) return () => {};
  return onSnapshot(doc(db, "users", uid), (snap) => {
    if (snap.exists()) {
      callback(snap.data() as UserProfile);
    } else {
      callback(null);
    }
  });
};
