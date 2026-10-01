import { apiRequest } from "./apiClient";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
}

export const subscribeToNotifications = (
  userId: string,
  callback: (notifications: NotificationItem[]) => void
) => {
  let isMounted = true;
  apiRequest("/social/notifications").then((res) => {
    if (res.data && isMounted) callback(res.data);
  });
  return () => { isMounted = false; };
};

export const createNotificationInFirestore = async (data: any) => {
  await apiRequest("/social/notifications", {
    method: "POST",
    body: JSON.stringify(data),
  });
};
