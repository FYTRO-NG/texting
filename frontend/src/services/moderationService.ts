import { apiRequest } from "./apiClient";

export const reportContent = async (targetType: string, targetId: string, reason: string) => {
  const res = await apiRequest("/social/reports", {
    method: "POST",
    body: JSON.stringify({ targetType, targetId, reason }),
  });
  return !res.error;
};
