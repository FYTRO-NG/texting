import { apiRequest } from "./apiClient";
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
  let isMounted = true;
  apiRequest("/features/chats").then((res) => {
    if (res.data && isMounted) callback(res.data);
  });
  return () => { isMounted = false; };
};

export const subscribeToChatMessages = (
  threadId: string,
  currentUserId: string,
  callback: (messages: MessageItem[]) => void
) => {
  let isMounted = true;
  const fetchMessages = async () => {
    const res = await apiRequest(`/features/chats/${threadId}/messages`);
    if (res.data && isMounted) {
      callback(res.data);
    }
  };
  fetchMessages();
  const interval = setInterval(fetchMessages, 3000);
  return () => {
    isMounted = false;
    clearInterval(interval);
  };
};

export const sendMessageInFirestore = async (
  threadId: string,
  senderId: string,
  text: string,
  otherUserId?: string
) => {
  await apiRequest(`/features/chats/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text, recipientId: otherUserId }),
  });
};

export const createOrGetChatThread = async (
  currentUserId: string,
  otherUserId: string,
  otherUserData?: { nickname: string; avatarColor: [string, string]; avatarIcon: string }
): Promise<string> => {
  const res = await apiRequest("/features/chats", {
    method: "POST",
    body: JSON.stringify({ recipientId: otherUserId }),
  });
  return res.data?.id || `chat_${Date.now()}`;
};
