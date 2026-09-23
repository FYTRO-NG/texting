import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
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
import { registerWithEmail, loginWithGoogle, getFriendlyError } from "@/src/services/authService";
import { trackAccountCreated } from "@/src/services/analyticsService";

function passwordStrength(pwd: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  const label = ["Weak", "Weak", "Fair", "Strong", "Excellent"][score];
  const color = ["#EF4444", "#EF4444", "#F59E0B", "#10B981", "#06B6D4"][score];
  return { score, label, color };
}

export default function Register() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = useMemo(() => passwordStrength(password), [password]);
  const passwordsMatch = password.length > 0 && password === confirm;

  const onSubmit = async () => {
    if (loading) return;
    if (username.trim().length < 3) {
      setError("Anonymous handle must be at least 3 characters.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!agreed) {
      setError("Please agree to the Community Guidelines to continue.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // 12-second timeout safety guard so button never hangs on loading forever
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out. Please check your network connection.")), 12000)
      );

      await Promise.race([
        registerWithEmail(email.trim(), password, username.trim()),
        timeoutPromise,
      ]);

      trackAccountCreated("email");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/create-profile");
    } catch (err: any) {
      console.error("Account registration error:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(getFriendlyError(err.code) || err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onGoogleSignup = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      trackAccountCreated("google");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/create-profile");
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError(getFriendlyError(err.code));
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <View style={styles.container} testID="register-screen">
      <LinearGradient colors={["#0F172A", "#0B1220"]} style={StyleSheet.absoluteFillObject} />
      <View style={[styles.blob, { top: -80, right: -60, backgroundColor: "rgba(139,92,246,0.18)" }]} />
      <View style={[styles.blob, { top: 300, left: -80, backgroundColor: "rgba(6,182,212,0.12)" }]} />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="register-back">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerBarTitle}>Sign up</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
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
                  colors={["#8B5CF6", "#06B6D4"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconInner}
                >
                  <Ionicons name="shield-checkmark" size={26} color="#FFFFFF" />
                </LinearGradient>
              </View>
              <Text style={styles.title}>Create Your Private Voice</Text>
              <Text style={styles.subtitle}>
                One anonymous account. Zero identity leaks.
              </Text>
            </View>

            {/* Error Banner */}
            {error && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Form Card */}
            <View style={styles.card}>
              {/* Google signup */}
              <TouchableOpacity
                style={styles.socialBtn}
                activeOpacity={0.85}
                onPress={onGoogleSignup}
                disabled={loading}
              >
                <Ionicons name="logo-google" size={18} color="#F8FAFC" />
                <Text style={styles.socialText}>Continue with Google</Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Username */}
              <Text style={styles.label}>Anonymous username</Text>
              <View style={[styles.inputWrap, focus === "u" && styles.inputFocused]}>
                <Ionicons name="person-outline" size={18} color={focus === "u" ? colors.brand : colors.onSurfaceMuted} />
                <TextInput
                  value={username}
                  onChangeText={(t) => { setUsername(t); setError(null); }}
                  placeholder="Choose your anonymous username"
                  placeholderTextColor={colors.onSurfaceDim}
                  autoCapitalize="none"
                  maxLength={20}
                  onFocus={() => setFocus("u")}
                  onBlur={() => setFocus(null)}
                  style={styles.input}
                  testID="register-username-input"
                  editable={!loading}
                />
                {username.length >= 3 && (
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                )}
              </View>

              {/* Email */}
              <Text style={[styles.label, { marginTop: spacing.md }]}>Email</Text>
              <View style={[styles.inputWrap, focus === "e" && styles.inputFocused]}>
                <Ionicons name="mail-outline" size={18} color={focus === "e" ? colors.brand : colors.onSurfaceMuted} />
                <TextInput
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(null); }}
                  placeholder="Used only for account security"
                  placeholderTextColor={colors.onSurfaceDim}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  onFocus={() => setFocus("e")}
                  onBlur={() => setFocus(null)}
                  style={styles.input}
                  testID="register-email-input"
                  editable={!loading}
                />
              </View>
              <View style={styles.hintRow}>
                <Ionicons name="information-circle" size={12} color={colors.onSurfaceDim} />
                <Text style={styles.hintText}>Your email is never shown on your profile.</Text>
              </View>

              {/* Password */}
              <Text style={[styles.label, { marginTop: spacing.md }]}>Password</Text>
              <View style={[styles.inputWrap, focus === "p" && styles.inputFocused]}>
                <Ionicons name="lock-closed-outline" size={18} color={focus === "p" ? colors.brand : colors.onSurfaceMuted} />
                <TextInput
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(null); }}
                  placeholder="Create a secure password"
                  placeholderTextColor={colors.onSurfaceDim}
                  secureTextEntry={!showPwd}
                  autoComplete="new-password"
                  onFocus={() => setFocus("p")}
                  onBlur={() => setFocus(null)}
                  style={styles.input}
                  testID="register-password-input"
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowPwd((v) => !v)}>
                  <Ionicons
                    name={showPwd ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={colors.onSurfaceMuted}
                  />
                </TouchableOpacity>
              </View>

              {/* Strength */}
              {password.length > 0 && (
                <View style={styles.strengthRow}>
                  <View style={styles.strengthBars}>
                    {[0, 1, 2, 3].map((i) => (
                      <View
                        key={i}
                        style={[
                          styles.strengthBar,
                          { backgroundColor: i < strength.score ? strength.color : "rgba(255,255,255,0.08)" },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                </View>
              )}

              {/* Confirm */}
              <Text style={[styles.label, { marginTop: spacing.md }]}>Confirm password</Text>
              <View
                style={[
                  styles.inputWrap,
                  focus === "c" && styles.inputFocused,
                  confirm.length > 0 && !passwordsMatch && styles.inputError,
                ]}
              >
                <Ionicons name="lock-closed-outline" size={18} color={focus === "c" ? colors.brand : colors.onSurfaceMuted} />
                <TextInput
                  value={confirm}
                  onChangeText={(t) => { setConfirm(t); setError(null); }}
                  placeholder="Re-enter your password"
                  placeholderTextColor={colors.onSurfaceDim}
                  secureTextEntry={!showPwd}
                  onFocus={() => setFocus("c")}
                  onBlur={() => setFocus(null)}
                  style={styles.input}
                  testID="register-confirm-input"
                  editable={!loading}
                  onSubmitEditing={onSubmit}
                  returnKeyType="go"
                />
                {confirm.length > 0 && passwordsMatch && (
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                )}
                {confirm.length > 0 && !passwordsMatch && (
                  <Ionicons name="close-circle" size={18} color={colors.error} />
                )}
              </View>

              {/* Terms */}
              <TouchableOpacity
                onPress={() => setAgreed((v) => !v)}
                style={styles.termsRow}
                activeOpacity={0.7}
                testID="register-terms-toggle"
              >
                <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                  {agreed && <Ionicons name="checkmark" size={12} color="#0F172A" />}
                </View>
                <Text style={styles.termsText}>
                  I agree to the{" "}
                  <Text style={styles.termsLink}>Community Guidelines</Text> and{" "}
                  <Text style={styles.termsLink}>Privacy Promise</Text>.
                </Text>
              </TouchableOpacity>

              {/* Submit */}
              <TouchableOpacity
                onPress={onSubmit}
                activeOpacity={0.85}
                disabled={loading}
                style={[styles.primaryBtn, loading && { opacity: 0.5, shadowOpacity: 0 }]}
                testID="register-submit-btn"
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
                    <Text style={styles.primaryText}>Create Account</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => router.replace("/auth/login")} style={styles.footerLinkWrap} testID="register-to-login">
              <Text style={styles.footerHint}>
                Already have an account? <Text style={styles.footerLink}>Log in</Text>
              </Text>
            </TouchableOpacity>

            <View style={styles.privacyRow}>
              <Ionicons name="lock-closed" size={13} color={colors.success} />
              <Text style={styles.privacyText}>
                Your real identity is never shown publicly.
              </Text>
            </View>
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
  intro: { alignItems: "center", marginTop: spacing.md, marginBottom: spacing.xl },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...font.h1, fontSize: 24, marginTop: spacing.md, letterSpacing: -0.3 },
  subtitle: { ...font.caption, marginTop: 6, textAlign: "center" },
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
  socialBtn: {
    height: 50,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  socialText: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.md,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.divider },
  dividerText: {
    ...font.small,
    marginHorizontal: 12,
    letterSpacing: 2,
    fontWeight: "700",
    color: colors.onSurfaceDim,
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
  inputError: { borderColor: colors.error, backgroundColor: "rgba(239,68,68,0.05)" },
  input: { flex: 1, color: colors.onSurface, fontSize: 15, fontWeight: "500" },
  hintRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 4 },
  hintText: { ...font.small, fontSize: 11 },
  strengthRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  strengthBars: { flex: 1, flexDirection: "row", gap: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { ...font.small, marginLeft: 10, fontWeight: "700", fontSize: 11 },
  termsRow: { flexDirection: "row", alignItems: "flex-start", marginTop: spacing.lg, gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },
  termsText: { ...font.caption, flex: 1, lineHeight: 18 },
  termsLink: { color: colors.brand, fontWeight: "700" },
  primaryBtn: {
    height: 54,
    borderRadius: radii.md,
    marginTop: spacing.lg,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15, letterSpacing: 0.3 },
  footerLinkWrap: { alignItems: "center", marginTop: spacing.xl },
  footerHint: { ...font.caption, color: colors.onSurfaceMuted },
  footerLink: { color: colors.brand, fontWeight: "700" },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
    gap: 6,
  },
  privacyText: { ...font.small, color: colors.onSurfaceMuted, fontSize: 12 },
});
