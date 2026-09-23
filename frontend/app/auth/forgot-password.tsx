import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, font, radii, spacing } from "@/src/theme";
import { resetPassword, getFriendlyError } from "@/src/services/authService";

export default function ForgotPassword() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [focus, setFocus] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = /^\S+@\S+\.\S+$/.test(value.trim());

  const onSend = async () => {
    if (!canSend || loading) return;
    setError(null);
    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await resetPassword(value.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // For security, don't reveal if email exists — show success anyway
      if (err.code === "auth/user-not-found") {
        setSent(true);
      } else {
        setError(getFriendlyError(err.code));
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <View style={styles.container} testID="forgot-password-screen">
      <LinearGradient colors={["#0F172A", "#0B1220"]} style={StyleSheet.absoluteFillObject} />
      <View style={[styles.blob, { top: -80, left: -60, backgroundColor: "rgba(139,92,246,0.15)" }]} />
      <View style={[styles.blob, { top: 200, right: -80, backgroundColor: "rgba(6,182,212,0.12)" }]} />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="forgot-back">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerBarTitle}>Account recovery</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Intro */}
            <View style={styles.intro}>
              <View style={styles.iconWrap}>
                <LinearGradient
                  colors={sent ? ["#10B981", "#06B6D4"] : ["#8B5CF6", "#06B6D4"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconInner}
                >
                  <Ionicons name={sent ? "checkmark" : "key"} size={28} color="#FFFFFF" />
                </LinearGradient>
              </View>
              <Text style={styles.title}>
                {sent ? "Reset link sent" : "Recover Your Account"}
              </Text>
              <Text style={styles.subtitle}>
                {sent
                  ? `We've sent a secure recovery link to ${value}. Follow the steps to regain access to your private voice.`
                  : "Enter the email or username tied to your Private Voices account and we'll send a secure reset link."}
              </Text>
            </View>

            {/* Card */}
            {!sent ? (
              <View style={styles.card}>
                {/* Error Banner */}
                {error && (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={16} color={colors.error} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
                <Text style={styles.label}>Email</Text>
                <View style={[styles.inputWrap, focus && styles.inputFocused]}>
                  <Ionicons name="mail-outline" size={18} color={focus ? colors.brand : colors.onSurfaceMuted} />
                  <TextInput
                    value={value}
                    onChangeText={(t) => { setValue(t); setError(null); }}
                    placeholder="Enter your account email"
                    placeholderTextColor={colors.onSurfaceDim}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    onFocus={() => setFocus(true)}
                    onBlur={() => setFocus(false)}
                    style={styles.input}
                    testID="forgot-input"
                    editable={!loading}
                    onSubmitEditing={onSend}
                    returnKeyType="send"
                  />
                </View>

                <TouchableOpacity
                  onPress={onSend}
                  disabled={!canSend || loading}
                  activeOpacity={0.85}
                  style={[styles.primaryBtn, (!canSend || loading) && { opacity: 0.5, shadowOpacity: 0 }]}
                  testID="forgot-submit-btn"
                >
                  <LinearGradient
                    colors={["#8B5CF6", "#06B6D4"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="send" size={16} color="#FFFFFF" />
                      <Text style={styles.primaryText}>Send Reset Link</Text>
                    </>
                  )}
                </TouchableOpacity>


                <View style={styles.safeRow}>
                  <Ionicons name="shield-checkmark" size={13} color={colors.success} />
                  <Text style={styles.safeText}>
                    We never share your recovery details. Links expire in 15 minutes.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.successRow}>
                  <View style={styles.successIcon}>
                    <Ionicons name="mail-open" size={20} color={colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.successTitle}>Check your inbox</Text>
                    <Text style={styles.successSub}>
                      If you don&apos;t see it in a minute, check the spam folder.
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setSent(false)}
                  style={styles.secondaryBtn}
                  activeOpacity={0.85}
                  testID="forgot-resend-btn"
                >
                  <Ionicons name="refresh" size={16} color={colors.brand} />
                  <Text style={styles.secondaryText}>Send again</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.replace("/auth/login")}
                  style={styles.primaryBtn}
                  activeOpacity={0.85}
                  testID="forgot-back-to-login"
                >
                  <LinearGradient
                    colors={["#8B5CF6", "#06B6D4"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <Text style={styles.primaryText}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity onPress={() => router.replace("/auth/login")} style={styles.altLink}>
              <Text style={styles.altLinkText}>
                Remembered it? <Text style={{ color: colors.brand, fontWeight: "700" }}>Back to login</Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  blob: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 300,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  headerBarTitle: { ...font.title, fontSize: 15 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  intro: { alignItems: "center", marginTop: spacing.lg, marginBottom: spacing.xl },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2,
    backgroundColor: "rgba(255,255,255,0.06)",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 10,
  },
  iconInner: {
    flex: 1,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...font.h1, fontSize: 24, marginTop: spacing.md, textAlign: "center", letterSpacing: -0.3 },
  subtitle: {
    ...font.caption,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 6,
  },
  label: {
    ...font.caption,
    color: colors.onSurface,
    fontWeight: "700",
    fontSize: 12,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  inputWrap: {
    height: 52,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inputFocused: { borderColor: colors.brand, backgroundColor: "rgba(6,182,212,0.06)" },
  input: { flex: 1, color: colors.onSurface, fontSize: 15, fontWeight: "500" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: { ...font.caption, color: colors.error, flex: 1 },
  primaryBtn: {
    height: 54,
    borderRadius: radii.md,
    marginTop: spacing.lg,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15, letterSpacing: 0.3 },
  secondaryBtn: {
    height: 50,
    marginTop: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.brandSoft,
    borderWidth: 1.5,
    borderColor: colors.brandBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryText: { color: colors.brand, fontWeight: "700", fontSize: 14 },
  safeRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: spacing.md },
  safeText: { ...font.small, flex: 1, color: colors.onSurfaceMuted, lineHeight: 16 },
  successRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  successIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(16,185,129,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(16,185,129,0.4)",
  },
  successTitle: { ...font.title, fontSize: 15 },
  successSub: { ...font.small, marginTop: 2 },
  altLink: { alignItems: "center", marginTop: spacing.xl },
  altLinkText: { ...font.caption, color: colors.onSurfaceMuted },
});
