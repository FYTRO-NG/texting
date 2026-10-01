import { apiRequest } from "./apiClient";

export const getExploreRecommendations = async () => {
  const res = await apiRequest("/posts?explore=true");
  return res.data || [];
};
