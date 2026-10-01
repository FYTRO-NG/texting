import { apiRequest } from "./apiClient";

export const checkUsernameAvailability = async (username: string): Promise<boolean> => {
  const res = await apiRequest(`/auth/check-username?username=${encodeURIComponent(username)}`);
  return !!res.data?.available;
};

export const claimUsername = async (username: string): Promise<boolean> => {
  const res = await apiRequest("/auth/claim-username", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
  return !res.error;
};
