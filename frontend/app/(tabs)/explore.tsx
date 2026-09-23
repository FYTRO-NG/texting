import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Avatar from "@/src/components/Avatar";
import PostCard from "@/src/components/PostCard";
import { colors, font, radii, spacing } from "@/src/theme";
import { subscribeToCommunities } from "@/src/services/communityService";
import { subscribeToSuggestedCreators, PublicUserProfile } from "@/src/services/userService";
import { subscribeToPosts } from "@/src/services/postService";
import {
  getExploreFeed,
  subscribeToTrendingHashtags,
  TrendingHashtag,
  getPostsByHashtag,
} from "@/src/services/exploreRecommendationService";
import { Community, Post } from "@/src/mockData";

const TABS = ["🔥 Trending", "For You", "💬 Popular Voices", "Communities"];

export default function Explore() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState("");
  const [liveCommunities, setLiveCommunities] = useState<Community[]>([]);
  const [livePosts, setLivePosts] = useState<Post[]>([]);
  const [recommendedPosts, setRecommendedPosts] = useState<Post[]>([]);
  const [liveCreators, setLiveCreators] = useState<PublicUserProfile[]>([]);
  const [indexedHashtags, setIndexedHashtags] = useState<TrendingHashtag[]>([]);
  const [activeHashtagFilter, setActiveHashtagFilter] = useState<string | null>(null);

  React.useEffect(() => {
    const unsubComm = subscribeToCommunities(setLiveCommunities);
    const unsubPosts = subscribeToPosts(setLivePosts);
    const unsubCreators = subscribeToSuggestedCreators(setLiveCreators);
    const unsubTags = subscribeToTrendingHashtags(setIndexedHashtags);

    // Fetch pre-computed explore recommendation bundle
    getExploreFeed(40).then((res) => {
      if (res.posts && res.posts.length > 0) {
        setRecommendedPosts(res.posts);
      }
    });

    return () => {
      unsubComm();
      unsubPosts();
      unsubCreators();
      unsubTags();
    };
  }, []);

  // When clicking a hashtag, fetch dedicated feed
  React.useEffect(() => {
    if (activeHashtagFilter) {
      getPostsByHashtag(activeHashtagFilter, 30).then((posts) => {
        if (posts.length > 0) {
          setRecommendedPosts(posts);
        }
      });
    }
  }, [activeHashtagFilter]);

  // Merge indexed hashtags with live post tags
  const tagsMap = React.useMemo(() => {
    if (indexedHashtags.length > 0) {
      return indexedHashtags.map((h) => ({
        tag: h.tag.startsWith("#") ? h.tag : `#${h.tag}`,
        posts: `${h.postCount}`,
        momentum: h.momentumScore || 1.0,
      }));
    }

    const counts: Record<string, number> = {};
    livePosts.forEach((p) => {
      const hashtags = p.text.match(/#[a-zA-Z0-9_]+/g);
      if (hashtags) {
        hashtags.forEach((tag) => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      }
    });
    return Object.entries(counts)
      .map(([tag, count]) => ({ tag, posts: `${count}`, momentum: 1.0 }))
      .sort((a, b) => parseInt(b.posts) - parseInt(a.posts));
  }, [indexedHashtags, livePosts]);

  const filteredTags = tagsMap.filter(
    (t) => !query || t.tag.toLowerCase().includes(query.toLowerCase())
  );

  const filteredCreators = liveCreators.filter(
    (c) => !query || c.username.toLowerCase().includes(query.toLowerCase())
  );

  const filteredCommunities = liveCommunities.filter(
    (cm) => !query || cm.name.toLowerCase().includes(query.toLowerCase()) || cm.description.toLowerCase().includes(query.toLowerCase())
  );


  return (
    <View style={styles.container} testID="explore-screen">
      <LinearGradient
        colors={["#0F172A", "#0B1220"]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.blob, { top: 40, left: -80 }]} />

      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Explore</Text>
          <TouchableOpacity style={styles.iconBtn} testID="explore-filter-btn">
            <Ionicons name="options-outline" size={20} color={colors.onSurface} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.onSurfaceMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search creators, tags, communities…"
            placeholderTextColor={colors.onSurfaceDim}
            style={styles.searchInput}
            testID="explore-search-input"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color={colors.onSurfaceDim} />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          horizontal
          data={TABS}
          keyExtractor={(t) => t}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
          renderItem={({ item, index }) => {
            const active = index === tab;
            return (
              <TouchableOpacity
                onPress={() => setTab(index)}
                style={[styles.tabChip, active && styles.tabChipActive]}
                testID={`explore-tab-${index}`}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <TouchableOpacity style={styles.hero} activeOpacity={0.9} testID="explore-hero">
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1576344581549-060a332463d2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTZ8MHwxfHNlYXJjaHw0fHxjeWJlcnB1bmslMjBuZW9uJTIwY2l0eSUyMG5pZ2h0JTIwcGhvdG9ncmFwaHl8ZW58MHx8fHwxNzg1ODc0NTA3fDA&ixlib=rb-4.1.0&q=85" }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
          />
          <LinearGradient
            colors={["rgba(15,23,42,0.1)", "rgba(15,23,42,0.9)"]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.heroBadge}>
            <Ionicons name="flame" size={12} color={colors.warning} />
            <Text style={styles.heroBadgeText}>TRENDING NOW</Text>
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.heroTitle}>The Anonymity Renaissance</Text>
            <Text style={styles.heroSub}>How honest communities are outperforming social feeds.</Text>
            <View style={styles.heroMeta}>
              <View style={styles.heroDot} />
              <Text style={styles.heroMetaText}>12.4K echoes · Technology</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Trending Tags */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trending hashtags</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.tagsGrid}>
            {filteredTags.map((t, i) => (
              <TouchableOpacity
                key={t.tag}
                style={[styles.tagCard, activeHashtagFilter === t.tag && { borderColor: colors.brand, backgroundColor: colors.brandSoft }]}
                onPress={() => setActiveHashtagFilter((prev) => (prev === t.tag ? null : t.tag))}
                activeOpacity={0.8}
                testID={`trend-tag-${i}`}
              >
                <View style={styles.tagRank}>
                  <Text style={styles.tagRankText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tagName}>{t.tag}</Text>
                  <Text style={styles.tagCount}>{t.posts} posts {t.momentum > 1.2 ? "• 🔥 Spiking" : ""}</Text>
                </View>
                <Ionicons name="trending-up" size={16} color={colors.success} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Suggested Creators */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular creators</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>See all</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            horizontal
            data={filteredCreators}
            keyExtractor={(c) => c.uid}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 12 }}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={styles.creatorCard}
                onPress={() => router.push({ pathname: "/user/[handle]", params: { handle: item.username } } as any)}
                activeOpacity={0.85}
                testID={`creator-card-${index}`}
              >
                <Avatar size={64} gradient={item.avatarGradient} icon={item.avatarIcon} />
                <Text style={styles.creatorName} numberOfLines={1}>@{item.username}</Text>
                <Text style={styles.creatorFollowers}>{item.followersCount} followers</Text>
                <TouchableOpacity style={styles.creatorBtn}>
                  <Text style={styles.creatorBtnText}>Follow</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Communities */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular communities</Text>
            <TouchableOpacity onPress={() => router.push("/communities")}>
              <Text style={styles.sectionLink}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.commGrid}>
            {filteredCommunities.slice(0, 4).map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => router.push({ pathname: "/community/[id]", params: { id: c.id } } as any)}
                style={styles.commCard}
                activeOpacity={0.85}
                testID={`explore-comm-${c.id}`}
              >
                <Image source={{ uri: c.cover }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                <LinearGradient
                  colors={["rgba(15,23,42,0.3)", "rgba(15,23,42,0.95)"]}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.commContent}>
                  <Text style={styles.commEmoji}>{c.emoji}</Text>
                  <Text style={styles.commName}>{c.name}</Text>
                  <Text style={styles.commMembers}>{c.members} members</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Explore Recommendation Feed */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {activeHashtagFilter ? `Posts in ${activeHashtagFilter}` : "Recommended for you"}
            </Text>
            {activeHashtagFilter && (
              <TouchableOpacity onPress={() => setActiveHashtagFilter(null)}>
                <Text style={styles.sectionLink}>Clear tag</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={{ paddingHorizontal: spacing.lg, gap: 14 }}>
            {(recommendedPosts.length > 0 ? recommendedPosts : livePosts).slice(0, 15).map((post) => (
              <PostCard key={`rec-${post.id}`} post={post} />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  blob: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 260,
    backgroundColor: "rgba(139,92,246,0.10)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: { ...font.h1, fontSize: 28 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  searchWrap: {
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: { flex: 1, marginLeft: 10, color: colors.onSurface, fontSize: 14 },
  tabsRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 8,
  },
  tabChip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    flexShrink: 0,
  },
  tabChipActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brandBorder,
  },
  tabText: { ...font.caption, fontWeight: "600" },
  tabTextActive: { color: colors.brand },
  hero: {
    marginHorizontal: spacing.lg,
    height: 200,
    borderRadius: radii.xl,
    overflow: "hidden",
    marginBottom: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  heroBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.8)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  heroBadgeText: { ...font.small, color: colors.warning, marginLeft: 5, fontWeight: "700", letterSpacing: 1 },
  heroBody: { position: "absolute", bottom: 16, left: 16, right: 16 },
  heroTitle: { ...font.h2, fontSize: 20 },
  heroSub: { ...font.body, fontSize: 13, color: colors.onSurfaceMuted, marginTop: 4 },
  heroMeta: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand, marginRight: 6 },
  heroMetaText: { ...font.small, color: colors.brand, fontWeight: "600" },
  section: { marginBottom: spacing.xl },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...font.title, fontSize: 16 },
  sectionLink: { ...font.caption, color: colors.brand, fontWeight: "600" },
  tagsGrid: { paddingHorizontal: spacing.lg, gap: 8 },
  tagCard: {
    flexDirection: "row",
    alignItems: "center",
    height: 60,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  tagRank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brandSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandBorder,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  tagRankText: { ...font.small, color: colors.brand, fontWeight: "800" },
  tagName: { ...font.title, fontSize: 14 },
  tagCount: { ...font.small },
  creatorCard: {
    width: 130,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  creatorName: { ...font.title, fontSize: 13, marginTop: 10 },
  creatorFollowers: { ...font.small, marginTop: 2 },
  creatorBtn: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandBorder,
  },
  creatorBtnText: { color: colors.brand, fontWeight: "700", fontSize: 12 },
  commGrid: {
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  commCard: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  commContent: { position: "absolute", bottom: 12, left: 12, right: 12 },
  commEmoji: { fontSize: 22 },
  commName: { ...font.title, fontSize: 15, marginTop: 4 },
  commMembers: { ...font.small, color: colors.brand, marginTop: 2, fontWeight: "600" },
});
