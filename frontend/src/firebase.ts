import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeAuth, 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  User 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase App (prevent duplicate init)
let app: any;
try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
} catch (e) {
  console.warn("Firebase app init warning:", e);
}

// Safe auth fallback so `auth` is NEVER undefined
let safeAuth: any = null;
try {
  if (app) safeAuth = getAuth(app);
} catch (e) {
  console.warn("Firebase getAuth warning:", e);
}

if (!safeAuth) {
  safeAuth = {
    currentUser: null,
    onAuthStateChanged: (_cb: any) => () => {},
    signInAnonymously: async () => ({ user: { uid: "anon-guest" } })
  };
}

export const auth = safeAuth;
export const db = app ? getFirestore(app, process.env.EXPO_PUBLIC_FIREBASE_DATABASE_ID ?? "private-voices") : null;
export const storage = app ? getStorage(app) : null;
export const functions = app ? getFunctions(app) : null;

export default app;
