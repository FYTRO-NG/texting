import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Avatar from "@/src/components/Avatar";
import PostCard from "@/src/components/PostCard";
import InviteFriendsModal from "@/src/components/InviteFriendsModal";
import { AVATAR_GRADIENTS } from "@/src/mockData";
import { colors, font, radii, spacing } from "@/src/theme";
import { getUserProfile, UserProfile } from "@/src/services/authService";
import { subscribeToUserProfile, type PublicUserProfile } from "@/src/services/userService";
import { auth } from "@/src/firebase";
import { trackProfileViewed } from "@/src/services/analyticsService";
import { subscribeToPostsByUser, subscribeToSavedPosts } from "@/src/services/postService";
import { subscribeToCommunities } from "@/src/services/communityService";
import { Post, Community } from "@/src/mockData";

const TABS = ["Posts", "Saved", "Communities"] as const;

export default function Profile() {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [liveProfile, setLiveProfile] = useState<PublicUserProfile | null>(null);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [joinedCommunities, setJoinedCommunities] = useState<Community[]>([]);

  useEffect(() => {
    trackProfileViewed(true);

    const uid = auth?.currentUser?.uid;
    if (!uid) return;

    // One-time fetch for full profile (bio, theme, etc.)
    getUserProfile(uid).then((p) => {
      if (p) setUserProfile(p);
    });

    // Live subscription for real-time social counts
    const unsubProfile = subscribeToUserProfile(uid, (p) => {
      if (p) setLiveProfile(p);
    });

    // Live subscription for own posts
    const unsubPosts = subscribeToPostsByUser(uid, setRecentPosts);

    // Live subscription for saved posts
    const unsubSaved = subscribeToSavedPosts(uid, setSavedPosts);

    // Live subscription for communities (filtered to joined ones)
    const unsubComm = subscribeToCommunities((all) => {
      // Communities the current user has joined are tracked client-side via memberIds
      // For now show all communities the user is a member of (if communityService exposes it)
      // We'll show all communities until per-user membership is wired up
      setJoinedCommunities(all);
    });

    return () => {
      unsubProfile();
      unsubPosts();
      unsubSaved();
      unsubComm();
    };
  }, []);

  const handle =
    userProfile?.displayName ??
    auth?.currentUser?.displayName ??
    "Anonymous";
  const bio = userProfile?.bio ?? "";

  return (
    <View style={styles.root} testID="profile-screen">
      <LinearGradient
        colors={["#0F172A", "#0B1220"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── Top bar ── */}
      <SafeAreaView edges={["top"]} style={styles.topBar}>
        <Text style={styles.topBarTitle}>My Profile</Text>
        <View style={styles.topBarActions}>
          <TouchableOpacity
            onPress={() => router.push("/post-analytics" as any)}
            style={styles.iconBtn}
            testID="profile-analytics-btn"
          >
            <Ionicons name="bar-chart-outline" size={20} color={colors.brand} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/settings")}
            style={styles.iconBtn}
            testID="profile-settings-btn"
          >
            <Ionicons name="settings-outline" size={20} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Avatar + Identity ── */}
        <View style={styles.identitySection}>
          <View style={styles.avatarGlow} />
          <Avatar size={90} gradient={AVATAR_GRADIENTS[0]} icon="flash" />

          <View style={styles.anonBadge}>
            <Ionicons name="shield-checkmark" size={11} color={colors.brand} />
            <Text style={styles.anonBadgeText}>Public Profile</Text>
          </View>

          <Text style={styles.handle}>@{handle}</Text>

          <Text style={styles.joinedText}>
            Joined{" "}
            {userProfile?.createdAt
              ? new Date(userProfile.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })
              : "Recently"}
          </Text>

          {bio ? (
            <Text style={styles.bio}>{bio}</Text>
          ) : (
            <TouchableOpacity onPress={() => router.push("/create-profile")}>
              <Text style={styles.addBioText}>+ Add a bio</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <StatCell
            value={liveProfile?.postsCount != null ? String(liveProfile.postsCount) : "0"}
            label="Posts"
          />
          <View style={styles.statDivider} />
          <StatCell
            value={
              liveProfile?.followersCount != null
                ? liveProfile.followersCount >= 1000
                  ? `${(liveProfile.followersCount / 1000).toFixed(1)}K`
                  : String(liveProfile.followersCount)
                : "0"
            }
            label="Followers"
          />
          <View style={styles.statDivider} />
          <StatCell
            value={liveProfile?.followingCount != null ? String(liveProfile.followingCount) : "0"}
            label="Following"
          />
        </View>


        {/* ── Action buttons ── */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.editBtn}
            activeOpacity={0.85}
            onPress={() => router.push("/create-profile")}
            testID="profile-edit-btn"
          >
            <Ionicons name="create-outline" size={16} color={colors.onSurface} />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.inviteBtn}
            activeOpacity={0.85}
            onPress={() => setInviteModalVisible(true)}
            testID="profile-invite-btn"
          >
            <LinearGradient
              colors={["#8B5CF6", "#06B6D4"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name="person-add-outline" size={16} color="#fff" />
            <Text style={styles.inviteBtnText}>Invite</Text>
          </TouchableOpacity>
        </View>

        {/* ── Whispers card ── */}
        <TouchableOpacity
          style={styles.whispersCard}
          activeOpacity={0.85}
          onPress={() => router.push("/whispers")}
          testID="profile-whispers-cta"
        >
          <View style={styles.whispersLeft}>
            <View style={styles.whispersIconWrap}>
              <LinearGradient
                colors={["#8B5CF6", "#06B6D4"]}
                style={StyleSheet.absoluteFillObject}
              />
              <Ionicons name="mic" size={18} color="#fff" />
            </View>
            <View>
              <Text style={styles.whispersTitle}>Whispers</Text>
              <Text style={styles.whispersSub}>Receive anonymous messages</Text>
            </View>
          </View>
          <View style={styles.whispersBadge}>
            <Text style={styles.whispersBadgeText}>3 new</Text>
          </View>
        </TouchableOpacity>

        {/* ── Tab pill switcher ── */}
        <View style={styles.tabsRow}>
          {TABS.map((label, i) => {
            const active = i === tab;
            return (
              <TouchableOpacity
                key={label}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => setTab(i)}
                activeOpacity={0.7}
                testID={`profile-tab-${i}`}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Tab content ── */}
        <View style={styles.contentArea}>
          {tab === 0 &&
            (recentPosts.length > 0 ? (
              <>
                {/* Analytics banner */}
                <TouchableOpacity
                  style={styles.analyticsBanner}
                  activeOpacity={0.82}
                  onPress={() => router.push("/post-analytics" as any)}
                >
                  <Ionicons name="bar-chart-outline" size={16} color={colors.brand} />
                  <Text style={styles.analyticsBannerText}>View Post Insights</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.brand} />
                </TouchableOpacity>
                {recentPosts.map((p) => (
                  <View key={p.id} style={styles.postWithAnalytics}>
                    <PostCard post={p} />
                    <TouchableOpacity
                      style={styles.analyticsRowBtn}
                      onPress={() => router.push("/post-analytics" as any)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="eye-outline" size={12} color={colors.onSurfaceDim} />
                      <Text style={styles.analyticsRowText}>
                        {(p.viewCount ?? 0).toLocaleString()} views
                      </Text>
                      <Text style={styles.analyticsRowDot}>·</Text>
                      <Ionicons name="stats-chart-outline" size={12} color={colors.brand} />
                      <Text style={styles.analyticsRowInsights}>Insights</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            ) : (
              <EmptyState
                icon="chatbubble-ellipses-outline"
                title="No posts yet"
                sub="Share your first anonymous thought."
              />
            ))}

          {tab === 1 &&
            (savedPosts.length > 0 ? (
              savedPosts.map((p) => <PostCard key={p.id} post={p} />)
            ) : (
              <EmptyState
                icon="bookmark-outline"
                title="Nothing saved yet"
                sub="Tap the bookmark icon on any post to save it."
              />
            ))}

          {tab === 2 && (
            <View>
              {joinedCommunities.length > 0 ? (
                joinedCommunities.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.communityRow}
                    activeOpacity={0.8}
                  >
                    <View style={styles.communityEmoji}>
                      <Text style={{ fontSize: 22 }}>{c.emoji}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.communityName}>{c.name}</Text>
                      <Text style={styles.communityMeta}>
                        {c.members} members
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={colors.onSurfaceDim}
                    />
                  </TouchableOpacity>
                ))
              ) : (
                <EmptyState
                  icon="people-outline"
                  title="No communities"
                  sub="Join spaces that matter to you."
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <InviteFriendsModal
        visible={inviteModalVisible}
        onClose={() => setInviteModalVisible(false)}
      />
    </View>
  );
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({
  icon,
  title,
  sub,
}: {
  icon: string;
  title: string;
  sub: string;
}) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon as any} size={28} color={colors.brand} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },

  /* Top bar */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  topBarTitle: { ...font.h3, fontSize: 17 },
  topBarActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },

  scroll: { paddingBottom: 120 },

  /* Identity */
  identitySection: {
    alignItems: "center",
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  avatarGlow: {
    position: "absolute",
    top: spacing.xl - 20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(139,92,246,0.18)",
  },
  anonBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: "rgba(6,182,212,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(6,182,212,0.35)",
  },
  anonBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand,
    letterSpacing: 0.5,
  },
  handle: {
    ...font.h2,
    fontSize: 22,
    marginTop: spacing.sm,
    letterSpacing: -0.3,
  },
  joinedText: {
    ...font.small,
    color: colors.onSurfaceDim,
    marginTop: 4,
  },
  bio: {
    ...font.body,
    color: colors.onSurfaceMuted,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 20,
    maxWidth: 280,
  },
  addBioText: {
    ...font.small,
    color: colors.brand,
    fontWeight: "700",
    marginTop: spacing.sm,
  },

  /* Stats */
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  statCell: { flex: 1, alignItems: "center" },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.onSurface,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.onSurfaceDim,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  /* Action buttons */
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  editBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  editBtnText: {
    color: colors.onSurface,
    fontWeight: "700",
    fontSize: 14,
  },
  inviteBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    overflow: "hidden",
  },
  inviteBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

  /* Whispers */
  whispersCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: "rgba(139,92,246,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(139,92,246,0.30)",
  },
  whispersLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  whispersIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  whispersTitle: { ...font.title, fontSize: 15, color: colors.onSurface },
  whispersSub: {
    ...font.small,
    color: colors.onSurfaceDim,
    marginTop: 2,
  },
  whispersBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: "rgba(6,182,212,0.20)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(6,182,212,0.40)",
  },
  whispersBadgeText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: "800",
  },

  /* Tabs */
  tabsRow: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radii.md,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.07)",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radii.sm,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.onSurfaceDim,
  },
  tabLabelActive: {
    color: colors.onSurface,
    fontWeight: "700",
  },

  /* Content */
  contentArea: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  /* Communities */
  communityRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 8,
  },
  communityEmoji: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(139,92,246,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(139,92,246,0.25)",
  },
  communityName: { ...font.title, fontSize: 14 },
  communityMeta: {
    ...font.small,
    marginTop: 2,
    color: colors.onSurfaceDim,
  },

  /* Empty */
  emptyWrap: { alignItems: "center", paddingVertical: spacing.xxl },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(6,182,212,0.10)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(6,182,212,0.25)",
    marginBottom: spacing.md,
  },
  emptyTitle: { ...font.title, fontSize: 15, color: colors.onSurface },
  emptySub: {
    ...font.small,
    textAlign: "center",
    color: colors.onSurfaceDim,
    marginTop: 6,
    maxWidth: 220,
  },

  /* Analytics */
  analyticsBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: "rgba(6,182,212,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(6,182,212,0.30)",
    marginBottom: spacing.sm,
  },
  analyticsBannerText: {
    ...font.caption,
    color: colors.brand,
    fontWeight: "700",
    flex: 1,
  },
  postWithAnalytics: { marginBottom: 4 },
  analyticsRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginBottom: spacing.sm,
  },
  analyticsRowText: { ...font.small, color: colors.onSurfaceDim },
  analyticsRowDot: { ...font.small, color: colors.onSurfaceDim },
  analyticsRowInsights: { ...font.small, color: colors.brand, fontWeight: "700" },
});
