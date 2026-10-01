import { apiRequest } from "./apiClient";

export const logAnalyticsEvent = (eventName: string, params?: Record<string, any>) => {
  try {
    apiRequest("/analytics/event", {
      method: "POST",
      body: JSON.stringify({ eventName, params }),
    }).catch(() => {});
  } catch (_) {}
};

export const logScreenView = (screenName: string) => {
  logAnalyticsEvent("screen_view", { screen_name: screenName });
};
