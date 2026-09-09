import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Avatar from "@/src/components/Avatar";
import PostCard from "@/src/components/PostCard";
import InviteFriendsModal from "@/src/components/InviteFriendsModal";
import { AVATAR_GRADIENTS, Post } from "@/src/mockData";
import { colors, font, radii, spacing } from "@/src/theme";
import {
  getCommunityDetails,
  joinCommunityCallable,
  leaveCommunityCallable,
  CommunityFull,
} from "@/src/services/communityService";
import { subscribeToPostsByCommunity } from "@/src/services/postService";
import { auth } from "@/src/firebase";

const TABS = ["Feed", "Trending", "About"];

const RULES = [
  { id: "r1", title: "Kindness first", body: "Disagreement is welcome. Cruelty is not." },
  { id: "r2", title: "Anonymity is sacred", body: "Never try to identify or dox another member — instant ban." },
  { id: "r3", title: "Add substance", body: "Low-effort posts get quietly filtered out of the main feed." },
  { id: "r4", title: "Report, don't fight", body: "Use report over reply. Moderators respond within 24h." },
  { id: "r5", title: "No commerce", body: "Sales pitches and referral spam are removed on sight." },
];

const MODS = [
  { name: "SilentDrift", role: "Head Mod", gradient: AVATAR_GRADIENTS[0], icon: "planet" },
  { name: "VelvetGhost", role: "Moderator", gradient: AVATAR_GRADIENTS[1], icon: "leaf" },
  { name: "NovaWhisper", role: "Moderator", gradient: AVATAR_GRADIENTS[2], icon: "sparkles" },
];

const ACTIVE_MEMBERS = [
  AVATAR_GRADIENTS[0],
  AVATAR_GRADIENTS[1],
  AVATAR_GRADIENTS[2],
  AVATAR_GRADIENTS[3],
  AVATAR_GRADIENTS[4],
];

export default function CommunityDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [communityData, setCommunityData] = React.useState<CommunityFull | null>(null);
  const [communityPosts, setCommunityPosts] = React.useState<Post[]>([]);
  const [tab, setTab] = useState(0);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [notify, setNotify] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);

  React.useEffect(() => {
    if (!id) return;
    getCommunityDetails(id).then((data) => {
      if (data) setCommunityData(data);
    });
    const unsub = subscribeToPostsByCommunity(id, (posts) => {
      setCommunityPosts(posts);
    });
    return () => unsub();
  }, [id]);

  const name = communityData?.name || id || "Community";
  const description = communityData?.description || "A safe space for anonymous conversations.";
  const emoji = communityData?.emoji || "💬";
  const cover = communityData?.coverUrl || "";
  const memberCount = communityData?.memberCount ?? 0;
  const rules = communityData?.rules || RULES.map((r) => r.body);

  const feed = communityPosts;

  const onJoin = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setJoining(true);
    try {
      if (joined) {
        await leaveCommunityCallable(id);
        setJoined(false);
      } else {
        const res = await joinCommunityCallable(id);
        if (res.status === "requested") {
          Alert.alert("Request Sent", "Your request to join this private community has been submitted.");
        } else {
          setJoined(true);
        }
      }
    } catch (err: any) {
      console.warn("Join/leave error:", err);
    } finally {
      setJoining(false);
    }
  };


  return (
    <View style={styles.container} testID="community-detail-screen">
      <LinearGradient colors={["#0F172A", "#0B1220"]} style={StyleSheet.absoluteFillObject} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover */}
        <View style={styles.cover}>
          {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFillObject} contentFit="cover" /> : null}
          <LinearGradient
            colors={["rgba(15,23,42,0.35)", "rgba(15,23,42,0.98)"]}
            style={StyleSheet.absoluteFillObject}
          />

          <SafeAreaView edges={["top"]} style={styles.coverTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="community-back">
              <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
            </TouchableOpacity>
            <View style={styles.coverActions}>
              <TouchableOpacity style={styles.iconBtn} testID="community-search">
                <Ionicons name="search" size={18} color={colors.onSurface} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} testID="community-share">
                <Ionicons name="share-outline" size={18} color={colors.onSurface} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.body}>
          {/* Identity */}
          <View style={styles.identityCard}>
            <View style={styles.identityHead}>
              <View style={styles.emojiWrap}>
                <LinearGradient
                  colors={AVATAR_GRADIENTS[0]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <Text style={styles.emojiText}>{emoji}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.name}>{name}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="people" size={12} color={colors.onSurfaceMuted} />
                  <Text style={styles.metaText}>{memberCount} members</Text>
                  <View style={styles.metaDot} />
                  <View style={styles.livePulse} />
                  <Text style={[styles.metaText, { color: colors.success }]}>2.4K online</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setNotify((v) => !v)}
                style={[styles.notifyBtn, notify && styles.notifyBtnActive]}
                testID="community-notify"
              >
                <Ionicons
                  name={notify ? "notifications" : "notifications-outline"}
                  size={18}
                  color={notify ? colors.brand : colors.onSurface}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.description}>{description}. A safe, moderated space to share what actually matters — under a mask.</Text>

            {/* Active members */}
            <View style={styles.activeRow}>
              <View style={styles.activeAvatars}>
                {ACTIVE_MEMBERS.map((g, i) => (
                  <View key={i} style={[styles.activeAvatarWrap, { marginLeft: i === 0 ? 0 : -8, zIndex: 5 - i }]}>
                    <Avatar size={22} gradient={g} icon="planet" />
                  </View>
                ))}
                <View style={[styles.activeAvatarWrap, styles.activeMore, { marginLeft: -8 }]}>
                  <Text style={styles.activeMoreText}>+42</Text>
                </View>
              </View>
              <Text style={styles.activeText}>chatting right now</Text>
            </View>

            {/* Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                onPress={onJoin}
                activeOpacity={0.85}
                style={[styles.primaryBtn, joined && styles.joinedBtn]}
                testID="community-join-btn"
              >
                {!joined && (
                  <LinearGradient
                    colors={["#06B6D4", "#0284C7"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                )}
                <Ionicons name={joined ? "checkmark" : "add"} size={18} color={joined ? colors.brand : "#0F172A"} />
                <Text style={[styles.primaryText, joined && { color: colors.brand }]}>
                  {joined ? "Joined" : "Join community"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.85}
                testID="community-invite-btn"
                onPress={() => setInviteModalVisible(true)}
              >
                <Ionicons name="paper-plane-outline" size={16} color={colors.onSurface} />
                <Text style={styles.secondaryText}>Invite</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statNum}>1.4K</Text>
              <Text style={styles.statLabel}>Posts today</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={[styles.statNum, { color: colors.brand }]}>98%</Text>
              <Text style={styles.statLabel}>Kindness</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNum}>2019</Text>
              <Text style={styles.statLabel}>Founded</Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            {TABS.map((t, i) => {
              const active = i === tab;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTab(i)}
                  style={styles.tabBtn}
                  activeOpacity={0.7}
                  testID={`community-tab-${i}`}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{t}</Text>
                  {active && <View style={styles.tabUnderline} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tab content */}
          {tab < 2 ? (
            <View style={{ marginTop: spacing.lg }}>
              {feed.map((p) => <PostCard key={p.id} post={p} />)}
            </View>
          ) : (
            <View style={{ marginTop: spacing.lg }}>
              {/* Rules */}
              <Text style={styles.sectionKicker}>Community rules</Text>
              <View style={styles.rulesCard}>
                {RULES.map((r, i) => (
                  <View key={r.id} style={[styles.ruleRow, i < RULES.length - 1 && styles.ruleDivider]}>
                    <View style={styles.ruleNum}>
                      <Text style={styles.ruleNumText}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ruleTitle}>{r.title}</Text>
                      <Text style={styles.ruleBody}>{r.body}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Moderators */}
              <Text style={[styles.sectionKicker, { marginTop: spacing.xl }]}>Moderators</Text>
              <FlatList
                horizontal
                data={MODS}
                keyExtractor={(m) => m.name}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: "/user/[handle]", params: { handle: item.name } } as any)}
                    style={styles.modCard}
                    activeOpacity={0.85}
                  >
                    <Avatar size={48} gradient={item.gradient} icon={item.icon} />
                    <Text style={styles.modName} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.modRolePill}>
                      <Ionicons name="shield-checkmark" size={9} color={colors.brand} />
                      <Text style={styles.modRoleText}>{item.role}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />

              {/* Meta */}
              <Text style={[styles.sectionKicker, { marginTop: spacing.xl }]}>Details</Text>
              <View style={styles.detailsCard}>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={16} color={colors.onSurfaceMuted} />
                  <Text style={styles.detailLabel}>Created</Text>
                  <Text style={styles.detailValue}>March 12, 2019</Text>
                </View>
                <View style={[styles.detailRow, styles.detailDivider]}>
                  <Ionicons name="globe-outline" size={16} color={colors.onSurfaceMuted} />
                  <Text style={styles.detailLabel}>Visibility</Text>
                  <Text style={styles.detailValue}>Public</Text>
                </View>
                <View style={[styles.detailRow, styles.detailDivider]}>
                  <Ionicons name="language-outline" size={16} color={colors.onSurfaceMuted} />
                  <Text style={styles.detailLabel}>Language</Text>
                  <Text style={styles.detailValue}>English</Text>
                </View>
                <View style={[styles.detailRow, styles.detailDivider]}>
                  <Ionicons name="flag-outline" size={16} color={colors.onSurfaceMuted} />
                  <Text style={styles.detailLabel}>Report content</Text>
                  <Text style={[styles.detailValue, { color: colors.brand }]}>Open form</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating post FAB */}
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/create")}
        activeOpacity={0.85}
        style={[styles.fab, { bottom: 24 + insets.bottom }]}
        testID="community-fab"
      >
        <LinearGradient
          colors={["#06B6D4", "#0284C7"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Ionicons name="add" size={26} color="#0F172A" />
      </TouchableOpacity>

      <InviteFriendsModal
        visible={inviteModalVisible}
        onClose={() => setInviteModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  cover: { height: 220 },
  coverTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  coverActions: { flexDirection: "row", gap: 10 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(15,23,42,0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },

  body: { paddingHorizontal: spacing.lg, marginTop: -70 },

  identityCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  identityHead: { flexDirection: "row", alignItems: "center" },
  emojiWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  emojiText: { fontSize: 30 },
  name: { ...font.h2, fontSize: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 4, flexWrap: "wrap" },
  metaText: { ...font.small, marginLeft: 4, fontWeight: "600" },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.onSurfaceDim, marginHorizontal: 8 },
  livePulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  notifyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  notifyBtnActive: { backgroundColor: colors.brandSoft, borderColor: colors.brandBorder },

  description: { ...font.body, fontSize: 14, lineHeight: 20, color: colors.onSurfaceMuted, marginTop: spacing.md },

  activeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  activeAvatars: { flexDirection: "row", marginRight: 10 },
  activeAvatarWrap: { borderRadius: 999, padding: 1.5, backgroundColor: colors.surfaceSecondary },
  activeMore: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brandSoft,
    borderWidth: 1.5,
    borderColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  activeMoreText: { color: colors.brand, fontSize: 9, fontWeight: "800" },
  activeText: { ...font.small, flex: 1 },

  actionsRow: { flexDirection: "row", gap: 8, marginTop: spacing.md },
  primaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: radii.md,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  joinedBtn: {
    backgroundColor: colors.brandSoft,
    borderWidth: 1.5,
    borderColor: colors.brandBorder,
  },
  primaryText: { color: "#0F172A", fontWeight: "800", fontSize: 14 },
  secondaryBtn: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  secondaryText: { color: colors.onSurface, fontWeight: "700", fontSize: 14 },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  statCol: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 26, backgroundColor: colors.divider },
  statNum: { ...font.h3, fontSize: 17, letterSpacing: -0.2 },
  statLabel: {
    ...font.small,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: 10,
    fontWeight: "700",
  },

  tabsRow: {
    flexDirection: "row",
    marginTop: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  tabBtn: { marginRight: 22, paddingBottom: 10, position: "relative" },
  tabText: { ...font.title, fontSize: 14, color: colors.onSurfaceMuted, fontWeight: "600" },
  tabTextActive: { color: colors.onSurface, fontWeight: "700" },
  tabUnderline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -1,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.brand,
  },

  sectionKicker: {
    ...font.small,
    color: colors.onSurfaceDim,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    fontSize: 10,
    marginBottom: spacing.sm,
  },
  rulesCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    overflow: "hidden",
  },
  ruleRow: { flexDirection: "row", padding: spacing.md, alignItems: "flex-start" },
  ruleDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  ruleNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandBorder,
    marginTop: 1,
  },
  ruleNumText: { color: colors.brand, fontWeight: "800", fontSize: 12 },
  ruleTitle: { ...font.title, fontSize: 14 },
  ruleBody: { ...font.small, marginTop: 3, lineHeight: 17 },

  modCard: {
    width: 110,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  modName: { ...font.title, fontSize: 12, marginTop: 8 },
  modRolePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandBorder,
    marginTop: 6,
    gap: 3,
  },
  modRoleText: { color: colors.brand, fontWeight: "700", fontSize: 10 },

  detailsCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: 10,
  },
  detailDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  detailLabel: { ...font.caption, color: colors.onSurfaceMuted, flex: 1 },
  detailValue: { ...font.title, fontSize: 13 },

  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
});
