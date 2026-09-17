/**
 * SecurityContext.tsx
 *
 * Provides app-wide biometric lock state and auto-lock logic.
 * Listens to AppState transitions and locks the app based on timeout settings.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus, Platform } from "react-native";

import {
  authenticateWithBiometrics,
  checkBiometricAvailability,
  BiometricAvailability,
} from "../services/biometricService";
import {
  SecuritySettings,
  DEFAULT_SECURITY_SETTINGS,
  AUTO_LOCK_TIMEOUT_MS,
  getSecuritySettings,
  saveSecuritySettings,
} from "../services/securityService";

// ─── Context type ─────────────────────────────────────────────────────────────

type SecurityContextValue = {
  /** Whether the app is currently locked */
  isLocked: boolean;
  /** Whether app is in background (for privacy screen) */
  isBackgrounded: boolean;
  /** Current persisted security settings */
  settings: SecuritySettings;
  /** Biometric hardware/enrollment status */
  biometricInfo: BiometricAvailability;
  /** Trigger biometric unlock. Returns true on success. */
  unlock: () => Promise<boolean>;
  /** Immediately lock the app */
  lock: () => void;
  /** Persist updated settings and re-apply state */
  updateSettings: (changes: Partial<SecuritySettings>) => Promise<void>;
  /** Reload biometric availability (e.g. after settings change) */
  refreshBiometricInfo: () => Promise<void>;
};

const SecurityContext = createContext<SecurityContextValue>({
  isLocked: false,
  isBackgrounded: false,
  settings: DEFAULT_SECURITY_SETTINGS,
  biometricInfo: { available: false, enrolled: false, typeName: "Biometrics" },
  unlock: async () => true,
  lock: () => {},
  updateSettings: async () => {},
  refreshBiometricInfo: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const [isBackgrounded, setIsBackgrounded] = useState(false);
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SECURITY_SETTINGS);
  const [biometricInfo, setBiometricInfo] = useState<BiometricAvailability>({
    available: false,
    enrolled: false,
    typeName: "Biometrics",
  });

  // Timestamp when app last went into background
  const backgroundedAtRef = useRef<number | null>(null);
  // Track if we're currently in the middle of an unlock attempt
  const unlockingRef = useRef(false);

  // ── Load settings on mount ───────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const [savedSettings, bioInfo] = await Promise.all([
        getSecuritySettings(),
        checkBiometricAvailability(),
      ]);
      setSettings(savedSettings);
      setBiometricInfo(bioInfo);
    })();
  }, []);

  // ── AppState listener — auto-lock ────────────────────────────────────────

  useEffect(() => {
    if (Platform.OS === "web") return; // No auto-lock on web

    const handleAppStateChange = async (nextState: AppStateStatus) => {
      const currentSettings = await getSecuritySettings();
      const currentBioInfo = await checkBiometricAvailability();

      const isGoingBackground =
        nextState === "background" || nextState === "inactive";
      const isComingForegrond = nextState === "active";

      if (isGoingBackground) {
        setIsBackgrounded(true);
        backgroundedAtRef.current = Date.now();

        // Lock immediately if setting says so
        if (
          currentSettings.biometricLockEnabled &&
          currentBioInfo.available &&
          (currentSettings.autoLockTimeout === "immediate" ||
            currentSettings.autoLockTimeout === "on-background")
        ) {
          setIsLocked(true);
        }
      }

      if (isComingForegrond) {
        setIsBackgrounded(false);

        if (
          currentSettings.biometricLockEnabled &&
          currentBioInfo.available &&
          backgroundedAtRef.current !== null
        ) {
          const elapsed = Date.now() - backgroundedAtRef.current;
          const threshold = AUTO_LOCK_TIMEOUT_MS[currentSettings.autoLockTimeout];

          if (currentSettings.autoLockTimeout !== "never") {
            const shouldLock =
              threshold === null || // immediate / on-background already locked
              elapsed >= threshold;

            if (shouldLock && !unlockingRef.current) {
              setIsLocked(true);
            }
          }
        }
        backgroundedAtRef.current = null;
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, []);

  // ── Unlock ───────────────────────────────────────────────────────────────

  const unlock = useCallback(async (): Promise<boolean> => {
    unlockingRef.current = true;
    try {
      const result = await authenticateWithBiometrics(
        "Unlock Private Voices"
      );
      if (result.success) {
        setIsLocked(false);
        return true;
      }
      return false;
    } finally {
      unlockingRef.current = false;
    }
  }, []);

  // ── Lock ─────────────────────────────────────────────────────────────────

  const lock = useCallback(() => {
    if (Platform.OS !== "web") {
      setIsLocked(true);
    }
  }, []);

  // ── Update settings ──────────────────────────────────────────────────────

  const updateSettings = useCallback(
    async (changes: Partial<SecuritySettings>) => {
      const updated = await saveSecuritySettings(changes);
      setSettings(updated);

      // If biometric lock was just disabled, ensure we unlock
      if (changes.biometricLockEnabled === false) {
        setIsLocked(false);
      }
    },
    []
  );

  // ── Refresh biometric info ───────────────────────────────────────────────

  const refreshBiometricInfo = useCallback(async () => {
    const info = await checkBiometricAvailability();
    setBiometricInfo(info);
  }, []);

  return (
    <SecurityContext.Provider
      value={{
        isLocked,
        isBackgrounded,
        settings,
        biometricInfo,
        unlock,
        lock,
        updateSettings,
        refreshBiometricInfo,
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSecurity() {
  return useContext(SecurityContext);
}
