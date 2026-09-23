import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useMemo, useState, useEffect } from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Whisper } from "@/src/mockData";
import { colors, font, radii, spacing } from "@/src/theme";
import { auth } from "@/src/firebase";
import { subscribeToWhispers } from "@/src/services/whisperService";
import { useSecurity } from "@/src/contexts/SecurityContext";
import { authenticateWithBiometrics } from "@/src/services/biometricService";

const BASE_URL = `${process.env.EXPO_PUBLIC_APP_URL || "https://privatevoices.vercel.app"}/w`;

const SHARE_TARGETS = [
  { key: "whatsapp", label: "WhatsApp", icon: "logo-whatsapp", color: "#25D366" },
  { key: "instagram", label: "Instagram", icon: "logo-instagram", color: "#E4405F" },
  { key: "twitter", label: "X", icon: "logo-twitter", color: "#F8FAFC" },
  { key: "snapchat", label: "Snap", icon: "logo-snapchat", color: "#FFFC00" },
  { key: "tiktok", label: "TikTok", icon: "musical-notes", color: "#EC4899" },
  { key: "sms", label: "SMS", icon: "chatbox", color: "#06B6D4" },
];

const MOOD_STYLES: Record<string, { label: string; color: string; icon: string }> = {
  kind: { label: "Kind", color: "#EC4899", icon: "heart" },
  curious: { label: "Curious", color: "#06B6D4", icon: "help-circle" },
  confession: { label: "Confession", color: "#8B5CF6", icon: "moon" },
  question: { label: "Question", color: "#F59E0B", icon: "chatbubble-ellipses" },
};

// Simple deterministic "QR" pattern generated from the handle
function buildPattern(seed: string, size = 13): boolean[][] {
  const rng = (n: number) => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i) + n) | 0;
    return ((h ^ (h >>> 5)) & 0xffff) / 0xffff;
  };
  const grid: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      const isCorner =
        (r < 3 && c < 3) ||
        (r < 3 && c >= size - 3) ||
        (r >= size - 3 && c < 3);
      if (isCorner) {
        // Fill the finder-square outer ring
        const localR = r < 3 ? r : r - (size - 3);
        const localC = c < 3 ? c : c - (size - 3);
        const filled =
          localR === 0 || localR === 2 || localC === 0 || localC === 2 || (localR === 1 && localC === 1);
        row.push(filled);
      } else {
        row.push(rng(r * size + c) > 0.55);
      }
    }
    grid.push(row);
  }
  return grid;
}

export default function Whispers() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [accepting, setAccepting] = useState(true);
  const [prompt, setPrompt] = useState("Send me an anonymous whisper 🎙️");
  const [filter, setFilter] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [messages, setMessages] = useState<Whisper[]>([]);
  const { settings, biometricInfo } = useSecurity();
  const [inboxUnlocked, setInboxUnlocked] = useState(!settings.protectInbox);

  useEffect(() => {
    if (!settings.protectInbox || Platform.OS === "web") {
      setInboxUnlocked(true);
      return;
    }

    if (!biometricInfo.available) {
      setInboxUnlocked(true);
      return;
    }

    let isMounted = true;
    authenticateWithBiometrics("Verify identity to open Anonymous Inbox").then((res) => {
      if (!isMounted) return;
      if (res.success) {
        setInboxUnlocked(true);
      } else {
        router.back();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [settings.protectInbox, biometricInfo.available]);

  // ── Real user handle ──────────────────────────────────────
  const user = auth?.currentUser;
  const rawHandle: string =
    user?.displayName?.trim()
      ? user.displayName.trim()
      : user?.email?.split("@")[0] ?? user?.uid ?? "anonymous";
  const handle = rawHandle.replace(/^@/, "").trim();
  const fullLink = `${BASE_URL}/${handle}`;
  // ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!handle) return;
    const unsub = subscribeToWhispers(handle, user?.uid, (liveWhispers) => {
      setMessages(liveWhispers as Whisper[]);
    });
    return () => unsub();
  }, [handle, user?.uid]);

  const stats = useMemo(() => {
    const total = messages.length;
    const unread = messages.filter((m) => m.unread).length;
    const today = messages.filter((m) => /m|h/.test(m.time)).length;
    return { total, unread, today };
  }, [messages]);

  const filtered = useMemo(() => {
    if (filter === 1) return messages.filter((m) => m.unread);
    if (filter === 2) return messages.filter((m) => (m.reactions ?? 0) > 0);
    return messages;
  }, [messages, filter]);

  const qr = useMemo(() => buildPattern(handle, 13), [handle]);

  const onCopy = async () => {
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(fullLink);
      }
    } catch (_) {}
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onShare = async () => {
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({
          title: "Send me an anonymous whisper",
          text: prompt,
          url: fullLink,
        });
        return;
      }
    } catch (_) {}
    // Fallback: copy to clipboard
    await onCopy();
  };

  if (!inboxUnlocked) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <LinearGradient colors={["#0F172A", "#0B1220"]} style={StyleSheet.absoluteFillObject} />
        <Ionicons name="lock-closed" size={32} color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="whispers-screen">
      <LinearGradient colors={["#0F172A", "#0B1220"]} style={StyleSheet.absoluteFillObject} />
      <View style={[styles.blob, { top: -80, right: -60, backgroundColor: "rgba(139,92,246,0.20)" }]} />
      <View style={[styles.blob, { top: 240, left: -80, backgroundColor: "rgba(6,182,212,0.15)" }]} />

      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="whispers-back">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.headerTitle}>Whispers</Text>
            <Text style={styles.headerSub}>Anonymous messages inbox</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} testID="whispers-settings">
            <Ionicons name="options-outline" size={20} color={colors.onSurface} />
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
        >
        {/* Link Card */}
        <View style={styles.linkCard}>
          <LinearGradient
            colors={["rgba(139,92,246,0.35)", "rgba(6,182,212,0.20)", "rgba(15,23,42,0.6)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.linkCardInner}>
            <View style={styles.linkHead}>
              <View style={styles.linkIconWrap}>
                <LinearGradient
                  colors={["#8B5CF6", "#06B6D4"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <Ionicons name="link" size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkKicker}>YOUR PERSONAL LINK</Text>
                <Text style={styles.linkHandle} numberOfLines={1}>@{handle}</Text>
              </View>
              <View style={[styles.statusPill, accepting ? styles.statusOn : styles.statusOff]}>
                <View style={[styles.statusDot, { backgroundColor: accepting ? colors.success : colors.error }]} />
                <Text style={[styles.statusText, { color: accepting ? colors.success : colors.error }]}>
                  {accepting ? "Accepting" : "Paused"}
                </Text>
              </View>
            </View>

            {/* Prompt */}
            <View style={styles.promptWrap}>
              <Ionicons name="chatbubble-ellipses" size={14} color={colors.brand} />
              <TextInput
                value={prompt}
                onChangeText={setPrompt}
                placeholder="Set your prompt"
                placeholderTextColor={colors.onSurfaceDim}
                style={styles.promptInput}
                maxLength={60}
                testID="whispers-prompt-input"
              />
              <Ionicons name="pencil" size={12} color={colors.onSurfaceDim} />
            </View>

            {/* Link row */}
            <View style={styles.linkRow}>
              <View style={styles.linkPill}>
                <Ionicons name="lock-closed" size={12} color={colors.brand} />
                <Text style={styles.linkText} numberOfLines={1}>{fullLink}</Text>
              </View>
              <TouchableOpacity onPress={onCopy} style={styles.copyBtn} activeOpacity={0.85} testID="whispers-copy-link">
                <Ionicons name={copied ? "checkmark" : "copy"} size={14} color="#0F172A" />
                <Text style={styles.copyText}>{copied ? "Copied" : "Copy"}</Text>
              </TouchableOpacity>
            </View>

            {/* Actions */}
            <View style={styles.linkActions}>
              <TouchableOpacity
                onPress={() => setShowQR((v) => !v)}
                style={styles.linkActionBtn}
                activeOpacity={0.8}
                testID="whispers-toggle-qr"
              >
                <Ionicons name={showQR ? "close-outline" : "qr-code-outline"} size={16} color={colors.onSurface} />
                <Text style={styles.linkActionText}>{showQR ? "Hide QR" : "Show QR"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push({ pathname: "/w/[handle]", params: { handle } } as any)}
                style={styles.linkActionBtn}
                activeOpacity={0.8}
                testID="whispers-preview"
              >
                <Ionicons name="eye-outline" size={16} color={colors.onSurface} />
                <Text style={styles.linkActionText}>Preview</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onShare}
                style={styles.linkActionBtn}
                activeOpacity={0.8}
                testID="whispers-story"
              >
                <Ionicons name="share-outline" size={16} color={colors.onSurface} />
                <Text style={styles.linkActionText}>Share</Text>
              </TouchableOpacity>
            </View>

            {/* QR expandable */}
            {showQR && (
              <View style={styles.qrWrap}>
                <View style={styles.qr}>
                  {qr.map((row, r) => (
                    <View key={r} style={{ flexDirection: "row" }}>
                      {row.map((on, c) => (
                        <View
                          key={c}
                          style={{
                            width: 12,
                            height: 12,
                            backgroundColor: on ? "#0F172A" : "transparent",
                            borderRadius: 2,
                          }}
                        />
                      ))}
                    </View>
                  ))}
                  <View style={styles.qrCenter}>
                    <LinearGradient
                      colors={["#8B5CF6", "#06B6D4"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Ionicons name="mic" size={18} color="#FFFFFF" />
                  </View>
                </View>
                <Text style={styles.qrHint}>Point a camera to open your whispers link</Text>
              </View>
            )}
          </View>
        </View>

        {/* Share targets */}
        <View style={styles.shareSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionKicker}>Share to receive</Text>
            <Text style={styles.sectionTitle}>Pick where to drop your link</Text>
          </View>
          <FlatList
            horizontal
            data={SHARE_TARGETS}
            keyExtractor={(t) => t.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.shareChip} activeOpacity={0.85} testID={`whispers-share-${item.key}`}>
                <View style={[styles.shareIcon, { backgroundColor: item.color + "1F", borderColor: item.color + "50" }]}>
                  <Ionicons name={item.icon as any} size={20} color={item.color} />
                </View>
                <Text style={styles.shareLabel}>{item.label}</Text>
              </TouchableOpacity>
            )}
            ListFooterComponent={
              <TouchableOpacity style={styles.shareChip} activeOpacity={0.85} testID="whispers-share-more">
                <View style={[styles.shareIcon, { backgroundColor: "rgba(255,255,255,0.06)" }]}>
                  <Ionicons name="ellipsis-horizontal" size={20} color={colors.onSurface} />
                </View>
                <Text style={styles.shareLabel}>More</Text>
              </TouchableOpacity>
            }
          />
        </View>

        {/* Stats + toggle */}
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total whispers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={[styles.statNum, { color: colors.brand }]}>{stats.unread}</Text>
              <Text style={styles.statLabel}>Unread</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={[styles.statNum, { color: colors.success }]}>{stats.today}</Text>
              <Text style={styles.statLabel}>Today</Text>
            </View>
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Accept anonymous whispers</Text>
              <Text style={styles.toggleSub}>Pause anytime — link stays yours forever.</Text>
            </View>
            <Switch
              value={accepting}
              onValueChange={(v) => {
                setAccepting(v);
                Haptics.selectionAsync();
              }}
              trackColor={{ false: "rgba(255,255,255,0.15)", true: colors.brand }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="rgba(255,255,255,0.15)"
              testID="whispers-accepting-toggle"
            />
          </View>
        </View>

        {/* Preferences quick chips */}
        <View style={styles.prefsRow}>
          <View style={styles.prefChip}>
            <Ionicons name="shield-checkmark" size={12} color={colors.success} />
            <Text style={styles.prefText}>Kindness filter</Text>
          </View>
          <View style={styles.prefChip}>
            <Ionicons name="image-outline" size={12} color={colors.brand} />
            <Text style={styles.prefText}>Images allowed</Text>
          </View>
          <View style={styles.prefChip}>
            <Ionicons name="ban-outline" size={12} color={colors.warning} />
            <Text style={styles.prefText}>3 blocked</Text>
          </View>
        </View>

        {/* Inbox */}
        <View style={styles.inboxHeader}>
          <Text style={styles.inboxTitle}>Your Inbox</Text>
          <View style={styles.inboxTabs}>
            {["All", "Unread", "Reacted"].map((label, i) => {
              const active = i === filter;
              return (
                <TouchableOpacity
                  key={label}
                  onPress={() => setFilter(i)}
                  style={[styles.tabChip, active && styles.tabChipActive]}
                  testID={`whispers-tab-${i}`}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="mail-open-outline" size={30} color={colors.brand} />
            </View>
            <Text style={styles.emptyTitle}>No whispers yet</Text>
            <Text style={styles.emptySub}>Share your link and let the honest ones find you.</Text>
          </View>
        ) : (
          <View style={styles.inboxList}>
            {filtered.map((w) => {
              const mood = w.mood ? MOOD_STYLES[w.mood] : null;
              return (
                <TouchableOpacity
                  key={w.id}
                  activeOpacity={0.85}
                  onPress={() => openWhisper(w.id)}
                  style={[styles.whisperCard, w.unread && styles.whisperUnread]}
                  testID={`whisper-${w.id}`}
                >
                  <View style={styles.whisperTop}>
                    <View style={styles.avatarAnon}>
                      <Ionicons name="help" size={18} color={colors.onSurfaceMuted} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={styles.metaRow}>
                        <Text style={styles.anonLabel}>Anonymous</Text>
                        <Text style={styles.metaDot}>·</Text>
                        <Text style={styles.timeText}>{w.time}</Text>
                        {mood && (
                          <View style={[styles.moodChip, { backgroundColor: mood.color + "1F", borderColor: mood.color + "55" }]}>
                            <Ionicons name={mood.icon as any} size={9} color={mood.color} />
                            <Text style={[styles.moodText, { color: mood.color }]}>{mood.label}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {w.unread && <View style={styles.unreadDot} />}
                  </View>

                  <Text style={styles.whisperText}>{w.message}</Text>

                  <View style={styles.whisperActions}>
                    <TouchableOpacity style={styles.wAction} testID={`whisper-reply-${w.id}`}>
                      <Ionicons name="arrow-undo-outline" size={16} color={colors.brand} />
                      <Text style={[styles.wActionText, { color: colors.brand }]}>Reply publicly</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.wAction} testID={`whisper-repost-${w.id}`}>
                      <Ionicons name="share-outline" size={16} color={colors.onSurfaceMuted} />
                      <Text style={styles.wActionText}>Share as post</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    {(w.reactions ?? 0) > 0 && (
                      <View style={styles.reactPill}>
                        <Ionicons name="heart" size={11} color="#EC4899" />
                        <Text style={styles.reactCount}>{w.reactions}</Text>
                      </View>
                    )}
                    <TouchableOpacity style={styles.wIconBtn} testID={`whisper-more-${w.id}`}>
                      <Ionicons name="ellipsis-horizontal" size={16} color={colors.onSurfaceMuted} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Safety footer */}
        <View style={styles.safetyRow}>
          <Ionicons name="shield-checkmark" size={13} color={colors.success} />
          <Text style={styles.safetyText}>
            Senders remain fully anonymous. Report or block one-tap on any whisper.
          </Text>
        </View>
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
  headerTitle: { ...font.h2, fontSize: 18 },
  headerSub: { ...font.small, marginTop: 1 },

  // Link card
  linkCard: {
    marginHorizontal: spacing.lg,
    borderRadius: radii.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.35)",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
  linkCardInner: { padding: spacing.lg },
  linkHead: { flexDirection: "row", alignItems: "center" },
  linkIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  linkKicker: {
    ...font.small,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "800",
    color: colors.onSurfaceMuted,
  },
  linkHandle: { ...font.h3, fontSize: 17, marginTop: 1 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 5,
  },
  statusOn: { backgroundColor: "rgba(16,185,129,0.15)", borderColor: "rgba(16,185,129,0.4)" },
  statusOff: { backgroundColor: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.4)" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  promptWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: "rgba(15,23,42,0.55)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandBorder,
    gap: 8,
  },
  promptInput: { flex: 1, color: colors.onSurface, fontSize: 13, fontWeight: "600" },
  linkRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 },
  linkPill: {
    flex: 1,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: "rgba(15,23,42,0.55)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  linkText: { color: colors.onSurface, fontSize: 13, fontWeight: "600" },
  copyBtn: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: colors.brand,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  copyText: { color: "#0F172A", fontWeight: "800", fontSize: 12 },
  linkActions: { flexDirection: "row", marginTop: 10, gap: 8 },
  linkActionBtn: {
    flex: 1,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  linkActionText: { color: colors.onSurface, fontSize: 12, fontWeight: "700" },
  qrWrap: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  qr: { padding: 4, position: "relative" },
  qrCenter: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 36,
    height: 36,
    marginLeft: -18,
    marginTop: -18,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  qrHint: { ...font.small, color: "#334155", marginTop: 8, fontWeight: "600" },

  // Share section
  shareSection: { marginTop: spacing.xl },
  sectionHeader: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  sectionKicker: {
    ...font.small,
    color: colors.onSurfaceDim,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    fontSize: 10,
  },
  sectionTitle: { ...font.h3, fontSize: 16, marginTop: 2 },
  shareChip: { alignItems: "center", width: 68 },
  shareIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 6,
  },
  shareLabel: { ...font.small, color: colors.onSurface, fontWeight: "600", fontSize: 11 },

  // Stats
  statsCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    overflow: "hidden",
  },
  statsRow: { flexDirection: "row", padding: spacing.md, alignItems: "center" },
  statCol: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 26, backgroundColor: colors.divider },
  statNum: { ...font.h2, fontSize: 20, letterSpacing: -0.3 },
  statLabel: {
    ...font.small,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: 10,
    fontWeight: "700",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  toggleTitle: { ...font.title, fontSize: 14 },
  toggleSub: { ...font.small, marginTop: 2 },

  // Prefs
  prefsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  prefChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    gap: 5,
  },
  prefText: { ...font.small, color: colors.onSurface, fontWeight: "600", fontSize: 11 },

  // Inbox
  inboxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  inboxTitle: { ...font.h2, fontSize: 18 },
  inboxTabs: { flexDirection: "row", gap: 6 },
  tabChip: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  tabChipActive: { backgroundColor: colors.brandSoft, borderColor: colors.brandBorder },
  tabText: { ...font.small, fontWeight: "700", fontSize: 11 },
  tabTextActive: { color: colors.brand },

  inboxList: { paddingHorizontal: spacing.lg },
  whisperCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    marginBottom: 10,
  },
  whisperUnread: {
    borderColor: colors.brandBorder,
    backgroundColor: "rgba(6,182,212,0.06)",
  },
  whisperTop: { flexDirection: "row", alignItems: "center" },
  avatarAnon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  anonLabel: { ...font.title, fontSize: 13, color: colors.onSurface },
  metaDot: { color: colors.onSurfaceDim, marginHorizontal: 2 },
  timeText: { ...font.small },
  moodChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 3,
    marginLeft: 4,
  },
  moodText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
    marginLeft: 6,
  },
  whisperText: { ...font.body, fontSize: 14, lineHeight: 20, marginTop: 10 },
  whisperActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    gap: 12,
  },
  wAction: { flexDirection: "row", alignItems: "center", gap: 5 },
  wActionText: { ...font.small, color: colors.onSurfaceMuted, fontWeight: "700", fontSize: 12 },
  reactPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: "rgba(236,72,153,0.15)",
    gap: 4,
  },
  reactCount: { color: "#EC4899", fontSize: 11, fontWeight: "800" },
  wIconBtn: { padding: 4, marginLeft: 4 },

  // Empty
  emptyWrap: { alignItems: "center", padding: spacing.xxl, marginHorizontal: spacing.lg },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandBorder,
  },
  emptyTitle: { ...font.title, fontSize: 15, marginTop: spacing.md },
  emptySub: { ...font.caption, textAlign: "center", marginTop: 6 },

  // Safety
  safetyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: "rgba(16,185,129,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(16,185,129,0.25)",
    gap: 8,
  },
  safetyText: { ...font.small, flex: 1, color: colors.onSurface, lineHeight: 17 },
});
