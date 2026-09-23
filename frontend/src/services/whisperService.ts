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

/** Send an anonymous whisper message to a specific handle in Firestore */
export const sendWhisperInFirestore = async (
  recipientHandle: string,
  text: string,
  mood?: string | null
): Promise<boolean> => {
  try {
    const cleanHandle = recipientHandle.replace(/^@/, "").trim().toLowerCase();
    let recipientUid: string | null = null;
    
    try {
      recipientUid = await getUidByUsername(cleanHandle);
    } catch (_) {}

    const whispersRef = collection(db, "whispers");
    await addDoc(whispersRef, {
      recipientId: recipientUid || null,
      recipientUid: recipientUid || null,
      recipientHandle: cleanHandle,
      text,
      isAnonymous: true,
      mood: mood || null,
      unread: true,
      reactions: 0,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error("Failed to send whisper in Firestore:", err);
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
