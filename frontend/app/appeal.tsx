import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, font, radii, spacing } from "@/src/theme";
import { submitUserAppeal } from "@/src/services/safetyService";

export default function Appeal() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!handle.trim() || !reason.trim()) return;
    setSubmitting(true);
    try {
      await submitUserAppeal({
        userHandle: handle.trim(),
        reason: reason.trim(),
        contactEmail: email.trim(),
      });
      setSubmitted(true);
    } catch (e) {
      console.error("Failed to submit appeal:", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container} testID="appeal-screen">
      <LinearGradient colors={["#0F172A", "#0B1220"]} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="appeal-back">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Account Safety Appeal</Text>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}>
          <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
            {submitted ? (
              <View style={styles.submittedWrap}>
                <Ionicons name="checkmark-circle" size={56} color={colors.success} />
                <Text style={styles.title}>Appeal Received</Text>
                <Text style={styles.sub}>
                  Your appeal has been added to the moderation review queue. We will review your account history fairly.
                </Text>
                <TouchableOpacity style={styles.btn} onPress={() => router.replace("/(tabs)")}>
                  <Text style={styles.btnText}>Return to App</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.banner}>
                  <Ionicons name="information-circle" size={20} color={colors.brand} />
                  <Text style={styles.bannerText}>
                    If your account or posts were restricted, you can submit an appeal for human moderation review.
                  </Text>
                </View>

                <Text style={styles.label}>Your Pseudonym / Handle</Text>
                <TextInput
                  value={handle}
                  onChangeText={setHandle}
                  placeholder="@ShadowFox_42"
                  placeholderTextColor={colors.onSurfaceDim}
                  style={styles.input}
                />

                <Text style={styles.label}>Contact Email (Optional for updates)</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  placeholderTextColor={colors.onSurfaceDim}
                  keyboardType="email-address"
                  style={styles.input}
                />

                <Text style={styles.label}>Reason for Appeal</Text>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Explain why you believe the flag or restriction was a mistake..."
                  placeholderTextColor={colors.onSurfaceDim}
                  style={[styles.input, { minHeight: 120, textAlignVertical: "top" }]}
                  multiline
                />

                <TouchableOpacity
                  style={[styles.submitBtn, (!handle.trim() || !reason.trim()) && { opacity: 0.5 }]}
                  onPress={handleSubmit}
                  disabled={!handle.trim() || !reason.trim() || submitting}
                >
                  <LinearGradient colors={["#06B6D4", "#0284C7"]} style={styles.submitInner}>
                    {submitting ? (
                      <ActivityIndicator size="small" color="#0F172A" />
                    ) : (
                      <Text style={styles.submitText}>Submit Appeal</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: font.family,
    fontSize: 18,
    fontWeight: "700",
    color: colors.onSurface,
  },
  banner: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: "rgba(6,182,212,0.12)",
    borderRadius: radii.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(6,182,212,0.3)",
  },
  bannerText: {
    flex: 1,
    fontFamily: font.family,
    fontSize: 13,
    lineHeight: 18,
    color: colors.onSurfaceSecondary,
  },
  label: {
    fontFamily: font.family,
    fontSize: 14,
    fontWeight: "600",
    color: colors.onSurface,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.onSurface,
    fontFamily: font.family,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  submitBtn: {
    marginTop: spacing.xl,
    borderRadius: radii.md,
    overflow: "hidden",
  },
  submitInner: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  submitText: {
    fontFamily: font.family,
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  submittedWrap: {
    alignItems: "center",
    paddingVertical: spacing.xl * 1.5,
  },
  title: {
    fontFamily: font.family,
    fontSize: 22,
    fontWeight: "700",
    color: colors.onSurface,
    marginTop: spacing.md,
  },
  sub: {
    fontFamily: font.family,
    fontSize: 14,
    color: colors.onSurfaceSecondary,
    textAlign: "center",
    marginVertical: spacing.md,
    lineHeight: 20,
  },
  btn: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.md,
  },
  btnText: {
    fontFamily: font.family,
    fontSize: 14,
    fontWeight: "600",
    color: colors.onSurface,
  },
});
