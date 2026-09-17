/**
 * biometricService.ts
 *
 * Thin wrapper around expo-local-authentication.
 *
 * PRIVACY GUARANTEE: This module NEVER captures, processes, serialises,
 * stores, or transmits any biometric data. The only value that ever
 * leaves this module is a plain boolean (success / failure) that the
 * operating system returns after it has performed its own secure
 * biometric comparison entirely within its hardware enclave.
 */

import { Platform } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BiometricAvailability = {
  /** True when the device has biometric hardware AND the user has enrolled */
  available: boolean;
  /** True when hardware is present but no credentials enrolled */
  enrolled: boolean;
  /** Human-readable name: "Face ID", "Touch ID", or "Biometrics" */
  typeName: string;
};

export type BiometricResult = {
  /** Only value returned — OS success/failure boolean, no biometric data */
  success: boolean;
  /** Human-readable error from OS (not biometric data) */
  error?: string;
};

// ─── Web guard ────────────────────────────────────────────────────────────────

const IS_WEB = Platform.OS === "web";

// Lazy-load so web bundler never errors on native-only imports
let LocalAuth: typeof import("expo-local-authentication") | null = null;
async function getLocalAuth() {
  if (IS_WEB) return null;
  if (!LocalAuth) {
    LocalAuth = await import("expo-local-authentication");
  }
  return LocalAuth;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check whether biometric authentication is available AND enrolled.
 * Always returns { available: false } on web.
 */
export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  const LA = await getLocalAuth();
  if (!LA) return { available: false, enrolled: false, typeName: "Biometrics" };

  try {
    const hasHardware = await LA.hasHardwareAsync();
    const isEnrolled = await LA.isEnrolledAsync();
    const typeName = await getBiometricTypeName();
    return {
      available: hasHardware && isEnrolled,
      enrolled: isEnrolled,
      typeName,
    };
  } catch {
    return { available: false, enrolled: false, typeName: "Biometrics" };
  }
}

/**
 * Returns "Face ID", "Touch ID", or "Biometrics" based on supported types.
 */
export async function getBiometricTypeName(): Promise<string> {
  const LA = await getLocalAuth();
  if (!LA) return "Biometrics";

  try {
    const types = await LA.supportedAuthenticationTypesAsync();
    // AuthenticationType.FACIAL_RECOGNITION = 2, FINGERPRINT = 1
    if (types.includes(2)) return "Face ID";
    if (types.includes(1)) {
      // iOS calls fingerprint "Touch ID"; Android calls it "Biometrics"
      return Platform.OS === "ios" ? "Touch ID" : "Biometrics";
    }
    return "Biometrics";
  } catch {
    return "Biometrics";
  }
}

/**
 * Prompt the user with a biometric challenge.
 *
 * Returns ONLY { success: boolean, error?: string }.
 * No biometric data, templates, hashes, or raw sensor output ever
 * passes through this function or exists in app memory.
 *
 * @param reason   Prompt text shown to the user by the OS
 */
export async function authenticateWithBiometrics(
  reason = "Verify your identity to continue"
): Promise<BiometricResult> {
  if (IS_WEB) {
    return { success: false, error: "Biometrics not available on web" };
  }

  const LA = await getLocalAuth();
  if (!LA) return { success: false, error: "Biometrics module unavailable" };

  try {
    const result = await LA.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: "Use Passcode",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });

    // result.success is the ONLY data we use — the OS boolean outcome.
    return { success: result.success, error: result.error };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Authentication failed" };
  }
}
