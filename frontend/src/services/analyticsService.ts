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

export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  logAnalyticsEvent(eventName, params);
};

export const trackLogin = (method: string) => {
  logAnalyticsEvent("login", { method });
};

export const trackAccountCreated = (method: string) => {
  logAnalyticsEvent("sign_up", { method });
};

export const trackProfileViewed = (userIdOrHandle: string) => {
  logAnalyticsEvent("profile_viewed", { target: userIdOrHandle });
};

export const trackFollowUser = (targetUserId: string) => {
  logAnalyticsEvent("follow_user", { targetUserId });
};

export const trackUnfollowUser = (targetUserId: string) => {
  logAnalyticsEvent("unfollow_user", { targetUserId });
};

export const trackUsernameChanged = (newUsername: string) => {
  logAnalyticsEvent("username_changed", { newUsername });
};
