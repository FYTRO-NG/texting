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
  apiKey: "AIzaSyBEDGgppNSjEDkgHOu1LP8bZbMzCde2mak",
  authDomain: "private-vioces.firebaseapp.com",
  projectId: "private-vioces",
  storageBucket: "private-vioces.firebasestorage.app",
  messagingSenderId: "907006277416",
  appId: "1:907006277416:web:525a4e2ad124fd597e021d",
  measurementId: "G-M1253VCTC5"
};

// Initialize Firebase App (prevent duplicate init)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app, "privatevoices");
export const storage = getStorage(app);
export const functions = getFunctions(app);

export default app;
