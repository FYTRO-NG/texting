/**
 * LockScreen.tsx
 *
 * Full-screen biometric lock overlay. Rendered on top of the entire app
 * when isLocked === true. Only shows on iOS/Android; no-op on web.
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, font, radii, spacing } from "../theme";
import { useSecurity } from "../contexts/SecurityContext";

export default function LockScreen() {
  const { unlock, biometricInfo } = useSecurity();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Never render on web
  if (Platform.OS === "web") return null;

  const handleUnlock = async () => {
    setErrorMsg("");
    setLoading(true);
    try {
      const success = await unlock();
      if (!success) {
        setErrorMsg("Authentication failed. Please try again.");
      }
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <LinearGradient
        colors={["#0A0F1E", "#0F172A", "#0A0F1E"]}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.container}>
        {/* Lock icon */}
        <View style={styles.iconWrap}>
          <LinearGradient
            colors={["#06B6D4", "#0284C7"]}
            style={styles.iconGrad}
          >
            <Ionicons name="lock-closed" size={36} color="#0F172A" />
          </LinearGradient>
        </View>

        {/* App name */}
        <Text style={styles.appName}>Private Voices</Text>
        <Text style={styles.subtitle}>
          {biometricInfo.available
            ? `Unlock with ${biometricInfo.typeName} to continue`
            : "Your privacy is protected"}
        </Text>

        {/* Unlock button */}
        {biometricInfo.available ? (
          <TouchableOpacity
            style={styles.unlockBtn}
            onPress={handleUnlock}
            disabled={loading}
            activeOpacity={0.85}
            accessibilityLabel={`Unlock with ${biometricInfo.typeName}`}
          >
            <LinearGradient
              colors={["#06B6D4", "#0284C7"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.unlockBtnGrad}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#0F172A" />
              ) : (
                <>
                  <Ionicons
                    name={
                      biometricInfo.typeName === "Face ID"
                        ? "scan-outline"
                        : "finger-print-outline"
                    }
                    size={20}
                    color="#0F172A"
                  />
                  <Text style={styles.unlockBtnText}>
                    {`Unlock with ${biometricInfo.typeName}`}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={styles.unavailableBox}>
            <Ionicons name="warning-outline" size={18} color={colors.warning} />
            <Text style={styles.unavailableText}>
              Biometrics are not available on this device
            </Text>
          </View>
        )}

        {/* Error message */}
        {errorMsg ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={14} color={colors.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* Privacy note */}
        <View style={styles.privacyNote}>
          <Ionicons name="shield-checkmark" size={13} color={colors.brand} />
          <Text style={styles.privacyNoteText}>
            Your identity and messages are protected
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  iconWrap: {
    marginBottom: spacing.xl,
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  iconGrad: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    ...font.h1,
    fontSize: 28,
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...font.body,
    fontSize: 15,
    color: colors.onSurfaceMuted,
    textAlign: "center",
    marginBottom: spacing.xxl,
    lineHeight: 22,
  },
  unlockBtn: {
    width: "100%",
    maxWidth: 300,
    borderRadius: radii.pill,
    overflow: "hidden",
    marginBottom: spacing.lg,
  },
  unlockBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  unlockBtnText: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 16,
  },
  unavailableBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: spacing.md,
    backgroundColor: "rgba(245,158,11,0.1)",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
    marginBottom: spacing.lg,
  },
  unavailableText: {
    ...font.body,
    fontSize: 13,
    color: colors.warning,
    flex: 1,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing.lg,
  },
  errorText: {
    ...font.small,
    color: colors.error,
  },
  privacyNote: {
    position: "absolute",
    bottom: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  privacyNoteText: {
    ...font.caption,
    color: colors.brand,
    fontSize: 12,
  },
});
