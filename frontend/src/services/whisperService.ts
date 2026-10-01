import { apiRequest } from "./apiClient";

export interface WhisperMessage {
  id: string;
  recipientId?: string;
  recipientHandle: string;
  message: string;
  isAnonymous?: boolean;
  mood?: string | null;
  time: string;
  unread: boolean;
  reactions?: number;
  createdAt?: any;
}

export interface WhisperSettings {
  acceptingWhispers: boolean;
  whisperPrompt: string;
}

export const sendWhisperInFirestore = async (
  recipientHandle: string,
  text: string,
  mood?: string | null
): Promise<boolean> => {
  const res = await apiRequest("/social/whispers", {
    method: "POST",
    body: JSON.stringify({ recipientHandle, text, mood }),
  });
  return !res.error;
};

export const subscribeToWhispers = (
  recipientHandle: string,
  callback: (whispers: WhisperMessage[]) => void
) => {
  let isMounted = true;
  const fetchWhispers = async () => {
    const res = await apiRequest(`/social/whispers?recipientHandle=${encodeURIComponent(recipientHandle)}`);
    if (res.data && isMounted) {
      callback(res.data);
    }
  };
  fetchWhispers();
  const interval = setInterval(fetchWhispers, 4000);
  return () => {
    isMounted = false;
    clearInterval(interval);
  };
};

export const markWhisperReadInFirestore = async (whisperId: string): Promise<void> => {
  await apiRequest(`/social/whispers/${whisperId}/read`, { method: "POST" });
};

export const getWhisperSettings = async (recipientHandle: string): Promise<WhisperSettings> => {
  const res = await apiRequest(`/social/whisper-settings/${recipientHandle}`);
  return res.data || { acceptingWhispers: true, whisperPrompt: "Send me an anonymous whisper..." };
};

export const updateWhisperSettings = async (
  uid: string,
  settings: Partial<WhisperSettings>
): Promise<void> => {
  await apiRequest(`/social/whisper-settings`, {
    method: "PATCH",
    body: JSON.stringify(settings),
  });
};
