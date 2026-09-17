/**
 * PrivacyScreen.tsx
 *
 * Renders a full-screen blur overlay when the app is backgrounded,
 * preventing Private Voices content from appearing in the OS app switcher.
 *
 * Web: always returns null (no-op).
 * iOS/Android: shows blur + dark overlay when isBackgrounded is true
 * and privacyScreenEnabled is true.
 */

import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useSecurity } from "../contexts/SecurityContext";
import { colors, font } from "../theme";

export default function PrivacyScreen() {
  const { isBackgrounded, settings } = useSecurity();

  // Never render on web
  if (Platform.OS === "web") return null;

  // Only show when the user has privacy screen enabled and app is backgrounded
  if (!settings.privacyScreenEnabled || !isBackgrounded) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
      <LinearGradient
        colors={["rgba(10,15,30,0.92)", "rgba(15,23,42,0.97)"]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="eye-off" size={40} color={colors.brand} />
        </View>
        <Text style={styles.label}>Private Voices</Text>
        <Text style={styles.sub}>Content hidden for privacy</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(6,182,212,0.12)",
    borderWidth: 1,
    borderColor: "rgba(6,182,212,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  label: {
    ...font.h2,
    fontSize: 22,
    color: colors.onSurface,
    marginBottom: 6,
  },
  sub: {
    ...font.body,
    fontSize: 14,
    color: colors.onSurfaceMuted,
  },
});
