import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Modal,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";

import { colors, font, radii, spacing } from "@/src/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const SHARE_CHANNELS = [
  { name: "WhatsApp", icon: "logo-whatsapp", color: "#25D366" },
  { name: "Instagram Stories", icon: "logo-instagram", color: "#E4405F" },
  { name: "X (Twitter)", icon: "logo-twitter", color: "#F8FAFC" },
  { name: "Snapchat", icon: "logo-snapchat", color: "#FFFC00" },
  { name: "Copy Link", icon: "copy-outline", color: colors.brand },
];

export default function InviteFriendsModal({ visible, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const handle = auth.currentUser?.displayName || auth.currentUser?.email?.split("@")[0] || "ShadowFox_42";
  const baseUrl = process.env.EXPO_PUBLIC_APP_URL || "https://private-voices-api.onrender.com";
  const inviteUrl = `${baseUrl}/w/@${handle}`;

  const handleShare = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "Private Voices Anonymous Invite",
          text: `Send me an anonymous whisper on Private Voices! 🎙️`,
          url: inviteUrl,
        });
      } else {
        await Share.share({
          message: `Send me an anonymous whisper on Private Voices! 🎙️\n${inviteUrl}`,
          url: inviteUrl,
          title: "Private Voices Anonymous Invite",
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopy = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <LinearGradient colors={["#1E293B", "#0F172A"]} style={StyleSheet.absoluteFillObject} />

          <View style={styles.handleBar} />

          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="gift" size={24} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Invite Friends to Private Voices</Text>
              <Text style={styles.sub}>
                Share your personal link & QR to receive honest anonymous whispers!
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.onSurfaceMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.linkCard}>
            <Text style={styles.linkText} numberOfLines={1}>{inviteUrl}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
              <Ionicons name={copied ? "checkmark" : "copy-outline"} size={16} color="#0F172A" />
              <Text style={styles.copyBtnText}>{copied ? "Copied!" : "Copy"}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.shareTitle}>Share via</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelsRow}>
            {SHARE_CHANNELS.map((ch) => (
              <TouchableOpacity key={ch.name} style={styles.channelItem} onPress={handleShare} activeOpacity={0.8}>
                <View style={[styles.channelIcon, { backgroundColor: ch.color + "22", borderColor: ch.color + "44" }]}>
                  <Ionicons name={ch.icon as any} size={22} color={ch.color} />
                </View>
                <Text style={styles.channelName}>{ch.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.primaryShareBtn} onPress={handleShare} activeOpacity={0.85}>
            <LinearGradient colors={["#06B6D4", "#0284C7"]} style={styles.btnInner}>
              <Ionicons name="share-social" size={18} color="#0F172A" />
              <Text style={styles.btnText}>Share Invite Link</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: "rgba(6,182,212,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontFamily: font.family,
    fontSize: 18,
    fontWeight: "700",
    color: colors.onSurface,
  },
  sub: {
    fontFamily: font.family,
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(6,182,212,0.3)",
  },
  linkText: {
    flex: 1,
    fontFamily: font.family,
    fontSize: 14,
    color: colors.brand,
    marginRight: spacing.sm,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  copyBtnText: {
    fontFamily: font.family,
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  shareTitle: {
    fontFamily: font.family,
    fontSize: 13,
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
    marginBottom: spacing.md,
  },
  channelsRow: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  channelItem: {
    alignItems: "center",
    width: 72,
  },
  channelIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  channelName: {
    fontFamily: font.family,
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    textAlign: "center",
  },
  primaryShareBtn: {
    borderRadius: radii.pill,
    overflow: "hidden",
    marginTop: spacing.md,
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  btnText: {
    fontFamily: font.family,
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
});
