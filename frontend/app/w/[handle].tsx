import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Avatar from "@/src/components/Avatar";
import { AVATAR_GRADIENTS } from "@/src/mockData";
import { colors, font, radii, spacing } from "@/src/theme";

const MOODS = [
  { key: "kind", label: "Kind words", icon: "heart", color: "#EC4899" },
  { key: "curious", label: "Curious", icon: "help-circle", color: "#06B6D4" },
  { key: "confession", label: "Confession", icon: "moon", color: "#8B5CF6" },
  { key: "question", label: "Question", icon: "chatbubble-ellipses", color: "#F59E0B" },
];

const MAX = 500;

import { evaluateAIModeration, ModerationResult } from "@/src/services/aiModerationService";
import { createModerationEventInFirestore } from "@/src/services/moderationService";
import { checkRateLimit } from "@/src/services/safetyService";
import { sendWhisperInFirestore } from "@/src/services/whisperService";

export default function WhisperSend() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const cleanHandleParam = handle ? handle.replace(/^@/, "").trim() : "";
  const displayHandle = cleanHandleParam || "ShadowFox_42";
  const [message, setMessage] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [moderationResult, setModerationResult] = useState<ModerationResult | null>(null);

  const canSend = message.trim().length >= 3;

  const onSend = async () => {
    if (!canSend) return;

    // Rate limiting check
    if (!checkRateLimit("message")) {
      setModerationResult({
        decision: "BLOCK",
        riskLevel: "HIGH",
        categories: ["rate_limit"],
        confidence: 1.0,
        reason: "Rate limit reached",
        action: "Block delivery",
      });
      setSent(true);
      return;
    }

    // AI Moderation Evaluation Pipeline
    const result = evaluateAIModeration(message, "anonymous_message");
    setModerationResult(result);

    if (result.decision === "REVIEW") {
      await createModerationEventInFirestore(`msg_${Date.now()}`, "anonymous_message", result);
    } else if (result.decision === "BLOCK") {
      await createModerationEventInFirestore(`msg_${Date.now()}`, "anonymous_message", result);
    } else {
      // Allow -> Write whisper to Firestore
      const ok = await sendWhisperInFirestore(displayHandle, message.trim(), mood);
      if (!ok) {
        setModerationResult({
          decision: "BLOCK",
          riskLevel: "HIGH",
          categories: ["network_error"],
          confidence: 1.0,
          reason: "Delivery failed",
          action: "Block delivery",
        });
        setSent(true);
        return;
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSent(true);
  };

  if (sent) {
    const decision = moderationResult?.decision || "ALLOW";
    const isBlock = decision === "BLOCK";
    const isReview = decision === "REVIEW";

    return (
      <View style={styles.container} testID="whisper-sent-screen">
        <LinearGradient colors={["#0F172A", "#0B1220"]} style={StyleSheet.absoluteFillObject} />
        <View style={[styles.blob, { top: -80, left: -40, backgroundColor: isBlock ? "rgba(239,68,68,0.20)" : isReview ? "rgba(245,158,11,0.20)" : "rgba(16,185,129,0.20)" }]} />

        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          <View style={styles.sentBody}>
            <View style={styles.sentIcon}>
              <LinearGradient
                colors={isBlock ? ["#EF4444", "#DC2626"] : isReview ? ["#F59E0B", "#D97706"] : ["#10B981", "#06B6D4"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Ionicons name={isBlock ? "shield-disagree" : isReview ? "time-outline" : "paper-plane"} size={38} color="#FFFFFF" />
            </View>

            <Text style={styles.sentTitle}>
              {isBlock ? "Message not sent" : isReview ? "Message pending" : "Whisper sent"}
            </Text>

            <Text style={styles.sentSub}>
              {isBlock
                ? "This message doesn't meet Private Voices' community guidelines."
                : isReview
                ? "We're checking this message before it can be delivered."
                : `@${displayHandle} won't know who sent this. Your identity is safe.`}
            </Text>

            <View style={styles.sentTrust}>
              <View style={styles.trustRow}>
                <Ionicons name="lock-closed" size={14} color={colors.success} />
                <Text style={styles.trustText}>End-to-end anonymous</Text>
              </View>
              <View style={styles.trustRow}>
                <Ionicons name="eye-off" size={14} color={colors.success} />
                <Text style={styles.trustText}>No IP or device stored</Text>
              </View>
              <View style={styles.trustRow}>
                <Ionicons name="shield-checkmark" size={14} color={colors.success} />
                <Text style={styles.trustText}>Recipient can&apos;t reveal you</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                setSent(false);
                setMessage("");
                setMood(null);
              }}
              activeOpacity={0.85}
              style={styles.sendAnotherBtn}
              testID="whisper-send-another"
            >
              <LinearGradient
                colors={["#8B5CF6", "#06B6D4"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.sendAnotherText}>Send another whisper</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.replace("/auth/register")}
              style={styles.claimBtn}
              activeOpacity={0.85}
              testID="whisper-claim-link"
            >
              <Ionicons name="mic" size={16} color={colors.brand} />
              <Text style={styles.claimText}>Get your own whispers link</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="whisper-send-screen">
      <LinearGradient colors={["#0F172A", "#0B1220"]} style={StyleSheet.absoluteFillObject} />
      <View style={[styles.blob, { top: -80, right: -60, backgroundColor: "rgba(139,92,246,0.20)" }]} />
      <View style={[styles.blob, { top: 300, left: -80, backgroundColor: "rgba(6,182,212,0.15)" }]} />

      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="whisper-send-close">
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <View style={styles.headerBrand}>
            <View style={styles.brandIcon}>
              <LinearGradient
                colors={["#8B5CF6", "#06B6D4"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Ionicons name="mic" size={12} color="#FFFFFF" />
            </View>
            <Text style={styles.brandName}>Private Voices</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} testID="whisper-report">
            <Ionicons name="alert-circle-outline" size={20} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Recipient card */}
          <View style={styles.hero}>
            <LinearGradient
              colors={["rgba(139,92,246,0.35)", "rgba(6,182,212,0.20)", "rgba(15,23,42,0.6)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.heroInner}>
              <View style={styles.avatarGlow}>
                <Avatar size={80} gradient={AVATAR_GRADIENTS[0]} icon="flash" ring />
              </View>
              <Text style={styles.heroKicker}>SEND AN ANONYMOUS WHISPER TO</Text>
              <Text style={styles.heroHandle}>@{displayHandle}</Text>
              <View style={styles.heroPromptWrap}>
                <Ionicons name="chatbubble-ellipses" size={13} color={colors.brand} />
                <Text style={styles.heroPrompt}>Send me an anonymous whisper 🎙️</Text>
              </View>
            </View>
          </View>

          {/* Mood picker */}
          <Text style={styles.sectionKicker}>How do you want to sound?</Text>
          <View style={styles.moodRow}>
            {MOODS.map((m) => {
              const active = mood === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => {
                    setMood(active ? null : m.key);
                    Haptics.selectionAsync();
                  }}
                  style={[
                    styles.moodChip,
                    active && { backgroundColor: m.color + "1F", borderColor: m.color + "80" },
                  ]}
                  testID={`whisper-mood-${m.key}`}
                >
                  <Ionicons name={m.icon as any} size={13} color={active ? m.color : colors.onSurfaceMuted} />
                  <Text style={[styles.moodText, active && { color: m.color, fontWeight: "800" }]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Message input */}
          <View style={styles.inputCard}>
            <View style={styles.inputHeader}>
              <View style={styles.anonRow}>
                <View style={styles.anonAvatar}>
                  <Ionicons name="help" size={14} color={colors.onSurfaceMuted} />
                </View>
                <Text style={styles.anonLabel}>Sending as Anonymous</Text>
              </View>
              <Text style={styles.counter}>
                <Text style={message.length > MAX - 50 ? { color: colors.warning } : {}}>
                  {message.length}
                </Text>
                <Text style={{ color: colors.onSurfaceDim }}>/{MAX}</Text>
              </Text>
            </View>
            <TextInput
              value={message}
              onChangeText={(v) => v.length <= MAX && setMessage(v)}
              placeholder="Write anything — a compliment, a confession, a question. They&#39;ll never know it was you."
              placeholderTextColor={colors.onSurfaceDim}
              multiline
              style={styles.textArea}
              testID="whisper-textarea"
            />

            {/* Toolbar */}
            <View style={styles.tools}>
              <TouchableOpacity style={styles.toolBtn} testID="whisper-emoji-btn">
                <Ionicons name="happy-outline" size={18} color={colors.onSurfaceMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolBtn} testID="whisper-image-btn">
                <Ionicons name="image-outline" size={18} color={colors.onSurfaceMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolBtn} testID="whisper-voice-btn">
                <Ionicons name="mic-outline" size={18} color={colors.onSurfaceMuted} />
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <View style={styles.anonToggle}>
                <Ionicons name="lock-closed" size={12} color={colors.brand} />
                <Text style={styles.anonToggleText}>Anonymous · locked</Text>
              </View>
            </View>
          </View>

          {/* Send button */}
          <TouchableOpacity
            onPress={onSend}
            disabled={!canSend}
            activeOpacity={0.85}
            style={[styles.sendBtn, !canSend && { opacity: 0.5, shadowOpacity: 0 }]}
            testID="whisper-send-btn"
          >
            <LinearGradient
              colors={["#8B5CF6", "#06B6D4"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name="send" size={16} color="#FFFFFF" />
            <Text style={styles.sendText}>Send Anonymously</Text>
          </TouchableOpacity>

          {/* Trust */}
          <View style={styles.trustCard}>
            <Text style={styles.trustHeader}>Your identity is protected</Text>
            <View style={styles.trustList}>
              <View style={styles.trustItem}>
                <Ionicons name="shield-checkmark" size={14} color={colors.success} />
                <Text style={styles.trustItemText}>No account required to send</Text>
              </View>
              <View style={styles.trustItem}>
                <Ionicons name="eye-off" size={14} color={colors.success} />
                <Text style={styles.trustItemText}>We never share IP, device, or metadata</Text>
              </View>
              <View style={styles.trustItem}>
                <Ionicons name="lock-closed" size={14} color={colors.success} />
                <Text style={styles.trustItemText}>Whispers are one-way — no back-tracing</Text>
              </View>
            </View>
          </View>

          {/* Footer CTA to sign up */}
          <TouchableOpacity
            onPress={() => router.push("/auth/register")}
            style={styles.footerCta}
            activeOpacity={0.85}
            testID="whisper-signup-cta"
          >
            <View style={styles.footerCtaIcon}>
              <Ionicons name="mic" size={16} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.footerCtaTitle}>Want your own whispers link?</Text>
              <Text style={styles.footerCtaSub}>Join Private Voices — takes 30 seconds.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.brand} />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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

  header: {
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
  headerBrand: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: { color: colors.onSurface, fontSize: 13, fontWeight: "700" },

  hero: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radii.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.35)",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
  heroInner: { alignItems: "center", padding: spacing.xl },
  avatarGlow: {
    padding: 4,
    borderRadius: 999,
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 10,
  },
  heroKicker: {
    ...font.small,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "rgba(248,250,252,0.75)",
    marginTop: spacing.md,
  },
  heroHandle: { ...font.h1, fontSize: 24, marginTop: 4, letterSpacing: -0.3 },
  heroPromptWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(15,23,42,0.55)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandBorder,
    gap: 6,
  },
  heroPrompt: { color: colors.onSurface, fontWeight: "600", fontSize: 13 },

  sectionKicker: {
    ...font.caption,
    fontWeight: "700",
    letterSpacing: 0.4,
    fontSize: 12,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    color: colors.onSurface,
  },
  moodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginHorizontal: spacing.lg,
  },
  moodChip: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  moodText: { ...font.small, color: colors.onSurfaceMuted, fontSize: 12, fontWeight: "700" },

  inputCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    padding: spacing.md,
  },
  inputHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  anonRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  anonAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  anonLabel: { ...font.title, fontSize: 12 },
  counter: { fontSize: 11, fontWeight: "700" },
  textArea: {
    minHeight: 140,
    maxHeight: 260,
    marginTop: 10,
    color: colors.onSurface,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  tools: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  toolBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  anonToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandBorder,
  },
  anonToggleText: { color: colors.brand, fontWeight: "700", fontSize: 11 },

  sendBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    height: 56,
    borderRadius: radii.md,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  sendText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },

  trustCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: "rgba(16,185,129,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(16,185,129,0.30)",
  },
  trustHeader: { ...font.title, fontSize: 13, color: colors.success, letterSpacing: 0.3 },
  trustList: { marginTop: 10, gap: 8 },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  trustItemText: { ...font.caption, fontSize: 12, color: colors.onSurface },

  footerCta: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandBorder,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  footerCtaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandBorder,
  },
  footerCtaTitle: { ...font.title, fontSize: 13 },
  footerCtaSub: { ...font.small, marginTop: 2 },

  // Sent state
  sentBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  sentIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 12,
  },
  sentTitle: { ...font.h1, fontSize: 28, marginTop: spacing.xl, letterSpacing: -0.5 },
  sentSub: {
    ...font.body,
    color: colors.onSurfaceMuted,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  sentTrust: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: "rgba(16,185,129,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(16,185,129,0.30)",
    width: "100%",
    gap: 10,
  },
  trustRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  trustText: { color: colors.onSurface, fontSize: 13, fontWeight: "600" },
  sendAnotherBtn: {
    marginTop: spacing.xl,
    height: 54,
    width: "100%",
    borderRadius: radii.md,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sendAnotherText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  claimBtn: {
    marginTop: spacing.md,
    height: 50,
    width: "100%",
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.brandBorder,
    backgroundColor: colors.brandSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  claimText: { color: colors.brand, fontWeight: "700", fontSize: 14 },
});
