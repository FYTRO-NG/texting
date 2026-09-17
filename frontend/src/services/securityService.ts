/**
 * securityService.ts
 *
 * Persists the user's security preference toggles using AsyncStorage.
 *
 * PRIVACY GUARANTEE: Only boolean flags and timeout strings are stored.
 * No biometric data, keys, hashes, or templates are ever written here.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutoLockTimeout =
  | "immediate"   // Lock as soon as app leaves foreground
  | "1min"        // Lock 1 minute after backgrounding
  | "5min"        // Lock 5 minutes after backgrounding
  | "15min"       // Lock 15 minutes after backgrounding
  | "on-background"; // Lock only when app is fully backgrounded (not just inactive)

export type SecuritySettings = {
  /** Whether biometric lock is enabled */
  biometricLockEnabled: boolean;
  /** Auto-lock timeout preference */
  autoLockTimeout: AutoLockTimeout;
  /** Whether anonymous inbox (whispers) requires biometric to open */
  protectInbox: boolean;
  /** Whether to show a privacy blur when app is backgrounded */
  privacyScreenEnabled: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "@pv_security_settings";

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  biometricLockEnabled: false,
  autoLockTimeout: "1min",
  protectInbox: false,
  privacyScreenEnabled: true,
};

export const AUTO_LOCK_TIMEOUT_LABELS: Record<AutoLockTimeout, string> = {
  immediate: "Immediately",
  "1min": "After 1 minute",
  "5min": "After 5 minutes",
  "15min": "After 15 minutes",
  "on-background": "When switching apps",
};

/** Timeout in milliseconds — null means lock immediately */
export const AUTO_LOCK_TIMEOUT_MS: Record<AutoLockTimeout, number | null> = {
  immediate: null,
  "1min": 60_000,
  "5min": 300_000,
  "15min": 900_000,
  "on-background": null,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load persisted security settings. Returns defaults if nothing stored yet.
 */
export async function getSecuritySettings(): Promise<SecuritySettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SECURITY_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<SecuritySettings>;
    return { ...DEFAULT_SECURITY_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SECURITY_SETTINGS };
  }
}

/**
 * Save (merge) partial settings changes.
 */
export async function saveSecuritySettings(
  changes: Partial<SecuritySettings>
): Promise<SecuritySettings> {
  try {
    const current = await getSecuritySettings();
    const updated = { ...current, ...changes };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return { ...DEFAULT_SECURITY_SETTINGS, ...changes };
  }
}

/**
 * Reset all security settings to defaults.
 */
export async function resetSecuritySettings(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently fail — defaults will be used on next load
  }
}
