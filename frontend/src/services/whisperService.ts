import { db } from "../firebase";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp,
  doc,
  updateDoc
} from "firebase/firestore";
import { getUidByUsername } from "./usernameService";

export interface WhisperMessage {
  id: string;
  recipientId?: string;
  recipientUid?: string;
  recipientHandle: string;
  text: string;
  isAnonymous?: boolean;
  mood?: string | null;
  time: string;
  unread: boolean;
  reactions?: number;
  createdAt?: any;
}

import { functions } from "../firebase";
import { httpsCallable } from "firebase/functions";

/** Send an anonymous whisper message securely via server Cloud Function */
export const sendWhisperInFirestore = async (
  recipientHandle: string,
  text: string,
  mood?: string | null
): Promise<boolean> => {
  try {
    const callable = httpsCallable(functions, "sendAnonymousWhisper");
    const res: any = await callable({
      recipientHandle,
      text,
      mood: mood || undefined,
    });
    return Boolean(res.data?.success);
  } catch (err) {
    console.error("Failed to send whisper via Cloud Function:", err);
    return false;
  }
};

/** Live-subscribe to incoming whispers for a given recipient handle or UID */
export const subscribeToWhispers = (
  handle: string,
  uid: string | undefined,
  callback: (whispers: WhisperMessage[]) => void
) => {
  const cleanHandle = handle.replace(/^@/, "").trim().toLowerCase();
  const whispersRef = collection(db, "whispers");
  
  // Query by recipientHandle (case-insensitive clean handle)
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
          text: data.text || "",
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

/** Mark a whisper message as read */
export const markWhisperReadInFirestore = async (whisperId: string) => {
  try {
    const docRef = doc(db, "whispers", whisperId);
    await updateDoc(docRef, { unread: false });
  } catch (err) {
    console.warn("Failed to mark whisper as read:", err);
  }
};
