import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import { Alert, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Avatar from "@/src/components/Avatar";
import PostCard from "@/src/components/PostCard";
import { AVATAR_GRADIENTS, Post } from "@/src/mockData";
import { colors, font, radii, spacing } from "@/src/theme";
import { auth } from "@/src/firebase";
import {
  followUser,
  unfollowUser,
  isFollowing,
  subscribeToUserProfile,
  type PublicUserProfile,
} from "@/src/services/userService";
import { getUidByUsername } from "@/src/services/usernameService";
import { trackFollowUser, trackUnfollowUser, trackProfileViewed } from "@/src/services/analyticsService";
import { subscribeToPostsByUser } from "@/src/services/postService";
import {
  blockUserInFirestore,
  unblockUserInFirestore,
  isUserBlockedInFirestore,
} from "@/src/services/safetyService";
import ReportModal from "@/src/components/ReportModal";

const TABS = [
  { key: "posts", label: "Posts", count: 0 },
  { key: "media", label: "Media", count: 0 },
  { key: "replies", label: "Replies", count: 0 },
];

export default function PublicProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const displayHandle = handle || "MidnightEcho";

  const [resolvedUid, setResolvedUid] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const [targetProfile, setTargetProfile] = useState<PublicUserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);

  const currentUid = auth?.currentUser?.uid;
  const currentUsername = auth?.currentUser?.displayName ?? "Anonymous";

  // Track profile view on mount
  useEffect(() => {
    trackProfileViewed(false);
  }, []);

  // Resolve username -> uid
  useEffect(() => {
    if (!handle) return;
    getUidByUsername(handle).then((uid) => {
      // Fallback: if username lookup snap doesn't exist, assume handle might be uid directly
      setResolvedUid(uid || handle);
    });
  }, [handle]);

  // Live-subscribe to the target user's profile and posts
  useEffect(() => {
    if (!resolvedUid) return;
    const unsubProfile = subscribeToUserProfile(resolvedUid, (p) => {
      if (p) setTargetProfile(p);
    });
    const unsubPosts = subscribeToPostsByUser(resolvedUid, (posts) => {
      setUserPosts(posts);
    });
    return () => {
      unsubProfile();
      unsubPosts();
    };
  }, [resolvedUid]);

  // Check initial follow state
  useEffect(() => {
    if (!currentUid || !resolvedUid) return;
    isFollowing(currentUid, resolvedUid).then(setFollowing);
  }, [currentUid, resolvedUid]);

  const onFollow = useCallback(async () => {
    if (!currentUid) {
      Alert.alert("Sign In Required", "Please sign in to follow users.");
      return;
    }
    if (!resolvedUid) return;

    if (currentUid === resolvedUid) {
      Alert.alert("Action Not Allowed", "You cannot follow yourself.");
      return;
    }

    setFollowLoading(true);
    try {
      if (following) {
        const res = await unfollowUser(currentUid, resolvedUid);
        if (res.success) {
          setFollowing(false);
          trackUnfollowUser();
        }
      } else {
        const res = await followUser(currentUid, resolvedUid, currentUsername);
        if (res.success) {
          setFollowing(true);
          trackFollowUser();
        } else if (res.reason === "already_following") {
          setFollowing(true);
        }
      }
    } catch (e) {
      console.warn("Follow action failed:", e);
    } finally {
      setFollowLoading(false);
    }
  }, [currentUid, resolvedUid, following, currentUsername]);

  const [isBlocked, setIsBlocked] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  // Check if current user has blocked this user
  useEffect(() => {
    if (!currentUid || !resolvedUid || currentUid === resolvedUid) return;
    isUserBlockedInFirestore(currentUid, resolvedUid).then(setIsBlocked);
  }, [currentUid, resolvedUid]);

  const onToggleBlock = useCallback(async () => {
    if (!currentUid) {
      Alert.alert("Sign In Required", "Please sign in to manage blocked users.");
      return;
    }
    if (!resolvedUid || currentUid === resolvedUid) return;

    if (isBlocked) {
      await unblockUserInFirestore(resolvedUid);
      setIsBlocked(false);
      Alert.alert("Unblocked", `@${displayHandle} has been unblocked.`);
    } else {
      Alert.alert(
        "Block User",
        `Are you sure you want to block @${displayHandle}? You will no longer see their posts or messages, and they will not be able to interact with you.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Block",
            style: "destructive",
            onPress: async () => {
              await blockUserInFirestore(resolvedUid);
              setIsBlocked(true);
              if (following) {
                await unfollowUser(currentUid, resolvedUid).catch(() => {});
                setFollowing(false);
              }
              Alert.alert("User Blocked", `@${displayHandle} is now blocked.`);
            },
          },
        ]
      );
    }
  }, [currentUid, resolvedUid, isBlocked, displayHandle, following]);

  const onMoreOptions = useCallback(() => {
    if (!currentUid || currentUid === resolvedUid) {
      Alert.alert(
        `@${displayHandle}`,
        "Public anonymous profile on Private Voices.",
        [{ text: "OK" }]
      );
      return;
    }

    Alert.alert(
      `@${displayHandle}`,
      "Manage interactions or report this user.",
      [
        {
          text: isBlocked ? "Unblock User" : "Block User",
          style: isBlocked ? "default" : "destructive",
          onPress: onToggleBlock,
        },
        {
          text: "Report User",
          style: "destructive",
          onPress: () => setReportModalVisible(true),
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }, [currentUid, resolvedUid, displayHandle, isBlocked, onToggleBlock]);

  const feed = userPosts;

  // Communities in common with this user — not yet implemented, render nothing safely
  const commonCommunities: Array<{ id: string; emoji: string; name: string; members: string }> = [];

  // Achievements/badges — safe fallback while not yet connected to Firestore
  const achievements: Array<{ id: string; name: string; icon: string; color: string; unlocked: boolean }> = [];

  const onMessage = () => {
    if (isBlocked) {
      Alert.alert("Blocked", "You cannot message a blocked account.");
      return;
    }
    router.push({ pathname: "/chat/[id]", params: { id: "new", name: displayHandle } } as any);
  };

  const onSendWhisper = () => {
    if (isBlocked) {
      Alert.alert("Blocked", "You cannot send whispers to a blocked account.");
      return;
    }
    router.push({ pathname: "/w/[handle]", params: { handle: displayHandle } } as any);
  };

  return (
    <View style={styles.container} testID="public-profile-screen">
      <LinearGradient colors={["#0F172A", "#0B1220"]} style={StyleSheet.absoluteFillObject} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover */}
        <View style={styles.cover}>
          <LinearGradient
            colors={["#7C3AED", "#0F172A", "#0F172A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[styles.coverBlob, { top: -40, right: -30, backgroundColor: "rgba(139,92,246,0.35)" }]} />
          <View style={[styles.coverBlob, { top: 40, left: -60, backgroundColor: "rgba(236,72,153,0.25)" }]} />

          <SafeAreaView edges={["top"]} style={styles.coverTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="public-back">
              <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
            </TouchableOpacity>
            <View style={styles.coverActions}>
              <TouchableOpacity style={styles.iconBtn} testID="public-share">
                <Ionicons name="share-outline" size={18} color={colors.onSurface} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={onMoreOptions} testID="public-more">
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.onSurface} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.body}>
          {/* Identity */}
          <View style={styles.identityCard}>
            <View style={styles.identityTop}>
              <View style={styles.avatarWrap}>
                <Avatar size={88} gradient={AVATAR_GRADIENTS[1]} icon="moon" />
                <View style={styles.avatarStatus} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md, paddingTop: 6 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>{displayHandle}</Text>
                  <View style={styles.verifiedTick}>
                    <Ionicons name="checkmark" size={11} color="#0F172A" />
                  </View>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="shield-checkmark" size={11} color={colors.brand} />
                  <Text style={styles.metaText}>Public Profile</Text>
                </View>
              </View>
            </View>

            <Text style={styles.bio}>
              {targetProfile?.bio || "Softer conversations, kinder internet. Recognizable pseudonyms, honest expressions."}
            </Text>

            {/* Mutual connections */}
            <View style={styles.mutualRow}>
              <View style={styles.mutualAvatars}>
                {[0, 2, 4].map((i) => (
                  <View
                    key={i}
                    style={[styles.mutualAvatarWrap, { marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }]}
                  >
                    <Avatar size={22} gradient={AVATAR_GRADIENTS[i]} icon="planet" />
                  </View>
                ))}
              </View>
              <Text style={styles.mutualText}>
                Followed by active community voices
              </Text>
            </View>
          </View>

          {/* Stats — real Firestore counts */}
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{targetProfile?.postsCount ?? 0}</Text>
              <Text style={styles.statLabel}>Echoes</Text>
            </View>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statCol} testID="public-followers">
              <Text style={styles.statNum}>
                {targetProfile?.followersCount != null
                  ? targetProfile.followersCount >= 1000
                    ? `${(targetProfile.followersCount / 1000).toFixed(1)}K`
                    : String(targetProfile.followersCount)
                  : "0"}
              </Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statCol} testID="public-following">
              <Text style={styles.statNum}>{targetProfile?.followingCount ?? 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
          </View>

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={onFollow}
              activeOpacity={0.85}
              disabled={followLoading}
              style={[styles.primaryBtn, following && styles.followingBtn, followLoading && { opacity: 0.6 }]}
              testID="public-follow-btn"
            >
              {!following && (
                <LinearGradient
                  colors={["#8B5CF6", "#06B6D4"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
              )}
              <Ionicons
                name={following ? "checkmark" : "person-add"}
                size={16}
                color={following ? colors.brand : "#FFFFFF"}
              />
              <Text style={[styles.primaryText, following && { color: colors.brand }]}>
                {followLoading ? "..." : following ? "Following" : "Follow"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onMessage} style={styles.secondaryBtn} activeOpacity={0.85} testID="public-message-btn">
              <Ionicons name="chatbubble-outline" size={16} color={colors.onSurface} />
              <Text style={styles.secondaryText}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSendWhisper} style={styles.whisperBtn} activeOpacity={0.85} testID="public-whisper-btn">
              <Ionicons name="mic" size={18} color={colors.brand} />
            </TouchableOpacity>
          </View>


          {/* Whisper CTA banner */}
          <TouchableOpacity
            onPress={onSendWhisper}
            style={styles.whisperBanner}
            activeOpacity={0.9}
            testID="public-whisper-banner"
          >
            <LinearGradient
              colors={["rgba(139,92,246,0.35)", "rgba(6,182,212,0.20)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.whisperBannerIcon}>
              <LinearGradient
                colors={["#8B5CF6", "#06B6D4"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Ionicons name="mic" size={16} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.whisperBannerTitle}>Send an anonymous whisper</Text>
              <Text style={styles.whisperBannerSub}>They won&apos;t know it was you.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurface} />
          </TouchableOpacity>

          {/* Communities in common — only shown when there is data */}
          {commonCommunities.length > 0 && (
            <View style={styles.commonSection}>
              <Text style={styles.sectionKicker}>In common</Text>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>{commonCommunities.length} communities</Text>
                <TouchableOpacity><Text style={styles.sectionLink}>View all</Text></TouchableOpacity>
              </View>
              <FlatList
                horizontal
                data={commonCommunities}
                keyExtractor={(c) => c.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: "/community/[id]", params: { id: item.id } } as any)}
                    style={styles.commonCard}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.commonEmoji}>{item.emoji}</Text>
                    <Text style={styles.commonName}>{item.name}</Text>
                    <Text style={styles.commonMeta}>{item.members}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {/* Badges — only shown when there are unlocked achievements */}
          {achievements.filter((a) => a.unlocked).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionKicker}>Achievements</Text>
              <View style={styles.badgesRow}>
                {achievements.filter((a) => a.unlocked).map((a) => (
                  <View key={a.id} style={[styles.badge, { borderColor: a.color + "55", backgroundColor: a.color + "1F" }]}>
                    <Ionicons name={a.icon as any} size={13} color={a.color} />
                    <Text style={[styles.badgeText, { color: a.color }]}>{a.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Tabs */}
          <View style={styles.tabsRow}>
            {TABS.map((t, i) => {
              const active = i === tab;
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setTab(i)}
                  style={styles.tabBtn}
                  activeOpacity={0.7}
                  testID={`public-tab-${i}`}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {t.label} <Text style={[styles.tabCount, active && styles.tabCountActive]}>{t.count}</Text>
                  </Text>
                  {active && <View style={styles.tabUnderline} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {isBlocked ? (
            <View style={{ marginTop: spacing.xl, alignItems: "center", padding: spacing.xl, backgroundColor: "rgba(239,68,68,0.08)", borderRadius: radii.lg, borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" }}>
              <Ionicons name="hand-left-outline" size={36} color={colors.error} />
              <Text style={{ ...font.title, color: colors.onSurface, marginTop: spacing.sm }}>User Blocked</Text>
              <Text style={{ ...font.caption, color: colors.onSurfaceMuted, textAlign: "center", marginTop: 4 }}>
                You have blocked @{displayHandle}. You will not see their posts or messages.
              </Text>
              <TouchableOpacity
                onPress={onToggleBlock}
                style={{ marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: "rgba(255,255,255,0.08)" }}
              >
                <Text style={{ color: colors.onSurface, fontWeight: "600" }}>Unblock</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ marginTop: spacing.lg }}>
              {feed.map((p) => <PostCard key={p.id} post={p} />)}
            </View>
          )}
        </View>
      </ScrollView>

      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        targetType="user"
        targetId={resolvedUid || displayHandle}
        targetContent={`Profile @${displayHandle}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  cover: { height: 200, overflow: "hidden" },
  coverBlob: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 220,
  },
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

  body: { paddingHorizontal: spacing.lg, marginTop: -46 },

  identityCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  identityTop: { flexDirection: "row", alignItems: "flex-start" },
  avatarWrap: {
    marginTop: -46,
    padding: 4,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 999,
  },
  avatarStatus: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 3,
    borderColor: colors.surfaceSecondary,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { ...font.h2, fontSize: 20, flexShrink: 1 },
  verifiedTick: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 4, flexWrap: "wrap" },
  metaText: { ...font.small, marginLeft: 4, color: colors.onSurfaceMuted, fontWeight: "600" },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.onSurfaceDim, marginHorizontal: 8 },
  bio: { ...font.body, fontSize: 14, lineHeight: 20, color: colors.onSurfaceMuted, marginTop: spacing.md },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.md },
  interestTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  interestText: { color: colors.onSurface, fontWeight: "600", fontSize: 11 },

  mutualRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  mutualAvatars: { flexDirection: "row", marginRight: 8 },
  mutualAvatarWrap: {
    borderRadius: 999,
    padding: 1.5,
    backgroundColor: colors.surfaceSecondary,
  },
  mutualText: { ...font.small, flex: 1 },

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

  actionsRow: { flexDirection: "row", gap: 8, marginTop: spacing.md },
  primaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.md,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  followingBtn: {
    backgroundColor: colors.brandSoft,
    borderWidth: 1.5,
    borderColor: colors.brandBorder,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
  secondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryText: { color: colors.onSurface, fontWeight: "700", fontSize: 14 },
  whisperBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.brandSoft,
    borderWidth: 1.5,
    borderColor: colors.brandBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  whisperBanner: {
    marginTop: spacing.md,
    borderRadius: radii.xl,
    overflow: "hidden",
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.35)",
  },
  whisperBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  whisperBannerTitle: { ...font.title, fontSize: 14, color: "#FFFFFF" },
  whisperBannerSub: { ...font.small, color: "rgba(248,250,252,0.75)", marginTop: 2 },

  section: { marginTop: spacing.xl },
  commonSection: { marginTop: spacing.xl },
  sectionKicker: {
    ...font.small,
    color: colors.onSurfaceDim,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    fontSize: 10,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 2,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...font.h3, fontSize: 16 },
  sectionLink: { ...font.caption, color: colors.brand, fontWeight: "700" },
  commonCard: {
    width: 110,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  commonEmoji: { fontSize: 22 },
  commonName: { ...font.title, fontSize: 12, marginTop: 6 },
  commonMeta: { ...font.small, marginTop: 2 },

  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    gap: 5,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },

  tabsRow: {
    flexDirection: "row",
    marginTop: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  tabBtn: { marginRight: 22, paddingBottom: 10, position: "relative" },
  tabText: { ...font.title, fontSize: 14, color: colors.onSurfaceMuted, fontWeight: "600" },
  tabTextActive: { color: colors.onSurface, fontWeight: "700" },
  tabCount: { color: colors.onSurfaceDim, fontWeight: "600" },
  tabCountActive: { color: colors.brand, fontWeight: "700" },
  tabUnderline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -1,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.brand,
  },
});
