import { db, auth, functions } from "../firebase";
import { apiRequest } from "./apiClient";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { signInAnonymously } from "firebase/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WhisperMessage {
  id: string;
  recipientId?: string;
  recipientUid?: string;
  recipientHandle: string;
  /** The whisper body text — mapped from Firestore `text` field */
  message: string;
  isAnonymous?: boolean;
  mood?: string | null;
  time: string;
  unread: boolean;
  reactions?: number;
  createdAt?: any;
}

export interface WhisperSettings {
  /** Whether the owner is accepting new anonymous whispers */
  acceptingWhispers: boolean;
  /** Custom prompt shown on the public send page */
  whisperPrompt: string;
}

// ─── Send Whisper ─────────────────────────────────────────────────────────────

/**
 * Send an anonymous whisper via the `sendAnonymousWhisper` Cloud Function.
 * If the caller is not signed in, we sign them in anonymously first so the
 * Cloud Function's auth check passes (the sender identity is never stored).
 */
export const sendWhisperInFirestore = async (
  recipientHandle: string,
  text: string,
  mood?: string | null
): Promise<boolean> => {
  try {
    // Ensure Firebase Auth has a current user (even anonymous)
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }

    const cleanHandle = recipientHandle.replace(/^@/, "").trim().toLowerCase();

    // Try Cloud Function first
    try {
      const callable = httpsCallable(functions, "sendAnonymousWhisper");
      const res: any = await callable({
        recipientHandle: cleanHandle,
        text,
        mood: mood || undefined,
      });
      if (res.data?.success) {
        return true;
      }
    } catch (cfErr) {
      console.warn("Cloud function sendAnonymousWhisper unavailable or failed, falling back to direct Firestore write:", cfErr);
    }

    // Direct Firestore write fallback
    await addDoc(collection(db, "whispers"), {
      recipientHandle: cleanHandle,
      text: text.trim(),
      isAnonymous: true,
      mood: mood || null,
      unread: true,
      reactions: 0,
      createdAt: serverTimestamp(),
    });

    // Dual-write to FastAPI MongoDB backend (ensures strictly anonymous persistence)
    try {
      await apiRequest("/whispers", {
        method: "POST",
        body: JSON.stringify({
          recipientHandle: cleanHandle,
          text: text.trim(),
          mood: mood || null
        }),
      });
    } catch (backendErr) {
      console.warn("FastAPI MongoDB whisper sync:", backendErr);
    }

    return true;
  } catch (err) {
    console.error("Failed to send whisper via Cloud Function and Firestore direct write:", err);
    return false;
  }
};

// ─── Subscribe to Whispers (Inbox) ────────────────────────────────────────────

/**
 * Live-subscribe to incoming whispers for a given recipient handle.
 * Returns an unsubscribe function.
 */
export const subscribeToWhispers = (
  handle: string,
  uid: string | undefined,
  callback: (whispers: WhisperMessage[]) => void
) => {
  const cleanHandle = handle.replace(/^@/, "").trim().toLowerCase();
  const whispersRef = collection(db, "whispers");

  const q = query(
    whispersRef,
    where("recipientHandle", "==", cleanHandle),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: WhisperMessage[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
        const diffMs = Date.now() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        let timeStr = "just now";
        if (diffMins > 0 && diffMins < 60) timeStr = `${diffMins}m ago`;
        else if (diffHours >= 1 && diffHours < 24) timeStr = `${diffHours}h ago`;
        else if (diffHours >= 24) timeStr = `${Math.floor(diffHours / 24)}d ago`;

        return {
          id: docSnap.id,
          recipientHandle: data.recipientHandle,
          recipientUid: data.recipientUid,
          // Map Firestore `text` → component-facing `message`
          message: data.text || "",
          mood: data.mood || null,
          time: timeStr,
          unread: data.unread ?? true,
          reactions: data.reactions ?? 0,
        };
      });
      callback(list);
    },
    (err) => {
      console.warn("Whispers listener error:", err);
      callback([]);
    }
  );
};

// ─── Mark as Read ─────────────────────────────────────────────────────────────

/** Mark a whisper as read by the recipient */
export const markWhisperReadInFirestore = async (whisperId: string) => {
  try {
    const docRef = doc(db, "whispers", whisperId);
    await updateDoc(docRef, { unread: false });
  } catch (err) {
    console.warn("Failed to mark whisper as read:", err);
  }
};

// ─── Whisper Settings ─────────────────────────────────────────────────────────

/**
 * Persist whisper inbox settings (accept toggle + prompt) to the user's
 * Firestore document under the `whisperSettings` field.
 */
export const updateWhisperSettings = async (
  uid: string,
  settings: Partial<WhisperSettings>
): Promise<void> => {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      "whisperSettings.acceptingWhispers":
        settings.acceptingWhispers !== undefined
          ? settings.acceptingWhispers
          : true,
      "whisperSettings.whisperPrompt":
        settings.whisperPrompt !== undefined
          ? settings.whisperPrompt
          : "Send me an anonymous whisper 🎙️",
    });
  } catch (err) {
    console.warn("Failed to update whisper settings:", err);
  }
};

/**
 * Fetch whisper settings for a user UID.
 * Falls back to safe defaults if the fields aren't set yet.
 */
export const getWhisperSettings = async (
  uid: string
): Promise<WhisperSettings> => {
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const ws = snap.data()?.whisperSettings;
      return {
        acceptingWhispers: ws?.acceptingWhispers ?? true,
        whisperPrompt: ws?.whisperPrompt ?? "Send me an anonymous whisper 🎙️",
      };
    }
  } catch (err) {
    console.warn("Failed to fetch whisper settings:", err);
  }
  return { acceptingWhispers: true, whisperPrompt: "Send me an anonymous whisper 🎙️" };
};
