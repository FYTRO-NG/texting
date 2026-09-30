import { db, auth } from "../firebase";
import { apiRequest } from "./apiClient";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  getDocs,
  where
} from "firebase/firestore";
import { ChatThread } from "../mockData";

export type MessageItem = {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
  fromMe?: boolean;
  time?: string;
};

export const subscribeToChatThreads = (
  userId: string,
  callback: (threads: ChatThread[]) => void
) => {
  const threadsRef = collection(db, "chats");
  const q = query(threadsRef, where("participants", "array-contains", userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ChatThread[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const otherParticipant = data.participantDetails?.find(
          (p: any) => p.uid !== userId
        ) || {
          uid: (data.participants || []).find((p: string) => p !== userId) || "",
          nickname: "Anonymous Voice",
          avatarColor: ["#06B6D4", "#0284C7"],
          avatarIcon: "flash",
        };

        return {
          id: docSnap.id,
          nickname: otherParticipant.nickname,
          avatarColor: otherParticipant.avatarColor,
          avatarIcon: otherParticipant.avatarIcon,
          lastMessage: data.lastMessage || "",
          time: data.updatedAt ? "Just now" : "1m",
          unread: data.unreadCount?.[userId] || 0,
          online: true,
          otherUserId: otherParticipant.uid || (data.participants || []).find((p: string) => p !== userId),
        };
      });
      callback(list);
    },
    (err) => {
      console.warn("Firestore chat threads listener warning:", err);
      callback([]);
    }
  );
};

export const subscribeToMessages = (
  chatId: string,
  currentUserId: string,
  callback: (messages: MessageItem[]) => void
) => {
  const messagesRef = collection(db, "chats", chatId, "messages");
  const q = query(messagesRef, orderBy("createdAt", "asc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: MessageItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          senderId: data.senderId,
          text: data.text,
          createdAt: data.createdAt,
          fromMe: data.senderId === currentUserId,
          time: data.createdAt ? "Just now" : "1m",
        };
      });
      callback(list);
    },
    (err) => {
      console.warn("Firestore messages listener warning:", err);
      callback([]);
    }
  );
};

export const sendMessageInFirestore = async (
  chatId: string,
  senderId: string,
  text: string
) => {
  const messagesRef = collection(db, "chats", chatId, "messages");
  const chatRef = doc(db, "chats", chatId);

  await addDoc(messagesRef, {
    senderId,
    text,
    createdAt: serverTimestamp(),
  });

  await setDoc(
    chatRef,
    {
      lastMessage: text,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Dual-write message to FastAPI MongoDB backend
  try {
    await apiRequest(`/chats/${chatId}/messages`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  } catch (backendErr) {
    console.warn("FastAPI MongoDB chat message sync:", backendErr);
  }
};
