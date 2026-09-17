import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { auth } from "@/src/firebase";
import {
  subscribeToUserPostsAnalytics,
  type PostAnalytics,
} from "@/src/services/postService";
import { colors, font, radii, spacing } from "@/src/theme";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function relativeDate(d: Date | null): string {
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function engagementRate(p: PostAnalytics): string {
  const interactions = p.likes + p.comments + p.reposts;
  const rate = interactions / Math.max(p.viewCount, 1);
  return `${(rate * 100).toFixed(1)}%`;
}

type StatChipProps = { icon: string; label: string; value: string; color?: string };
function StatChip({ icon, label, value, color = colors.brand }: StatChipProps) {
  return (
    <View style={[styles.chip, { borderColor: `${color}33` }]}>
      <View style={[styles.chipIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon as any} size={14} color={color} />
      </View>
      <Text style={styles.chipValue}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

function SummaryCard({ posts }: { posts: PostAnalytics[] }) {
  const totals = posts.reduce(
    (acc, p) => ({
      views: acc.views + p.viewCount,
      likes: acc.likes + p.likes,
      comments: acc.comments + p.comments,
      reposts: acc.reposts + p.reposts,
      saves: acc.saves + p.saves,
    }),
    { views: 0, likes: 0, comments: 0, reposts: 0, saves: 0 }
  );
  const items = [
    { icon: "eye-outline", label: "Views", value: fmt(totals.views), color: colors.brand },
    { icon: "heart-outline", label: "Likes", value: fmt(totals.likes), color: "#EC4899" },
    { icon: "chatbubble-outline", label: "Comments", value: fmt(totals.comments), color: "#8B5CF6" },
    { icon: "repeat-outline", label: "Reposts", value: fmt(totals.reposts), color: "#10B981" },
    { icon: "bookmark-outline", label: "Saves", value: fmt(totals.saves), color: "#F59E0B" },
  ];
  return (
    <View style={styles.summaryCard}>
      <LinearGradient
        colors={["rgba(6,182,212,0.12)", "rgba(139,92,246,0.06)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.summaryHeader}>
        <Ionicons name="stats-chart" size={16} color={colors.brand} />
        <Text style={styles.summaryTitle}>Overall Performance</Text>
        <Text style={styles.summaryCount}>{posts.length} posts</Text>
      </View>
      <View style={styles.chipsRow}>
        {items.map((it) => (
          <StatChip key={it.label} icon={it.icon} label={it.label} value={it.value} color={it.color} />
        ))}
      </View>
    </View>
  );
}

function MetricCell({ icon, value, color }: { icon: string; value: string; color: string }) {
  return (
    <View style={styles.metricCell}>
      <Ionicons name={icon as any} size={13} color={color} />
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

function PostRow({ item }: { item: PostAnalytics }) {
  const er = engagementRate(item);
  const erNum = parseFloat(er);
  const erColor = erNum >= 5 ? colors.success : erNum >= 2 ? colors.warning : colors.onSurfaceDim;
  const preview = item.text.length > 80 ? item.text.slice(0, 77) + "…" : item.text || "(no text)";
  return (
    <View style={styles.postCard}>
      <View style={styles.postCardHeader}>
        <Text style={styles.postPreview} numberOfLines={2}>{preview}</Text>
        <Text style={styles.postDate}>{relativeDate(item.createdAt)}</Text>
      </View>
      <View style={styles.metricRow}>
        <MetricCell icon="eye-outline" value={fmt(item.viewCount)} color={colors.brand} />
        <MetricCell icon="heart-outline" value={fmt(item.likes)} color="#EC4899" />
        <MetricCell icon="chatbubble-outline" value={fmt(item.comments)} color="#8B5CF6" />
        <MetricCell icon="repeat-outline" value={fmt(item.reposts)} color="#10B981" />
        <MetricCell icon="bookmark-outline" value={fmt(item.saves)} color="#F59E0B" />
        <View style={[styles.erPill, { borderColor: `${erColor}44`, marginLeft: "auto" as any }]}>
          <Text style={[styles.erText, { color: erColor }]}>{er} ER</Text>
        </View>
      </View>
    </View>
  );
}

export default function PostAnalyticsScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<PostAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<"viewCount" | "likes" | "comments" | "reposts" | "saves">("viewCount");

  useEffect(() => {
    const uid = auth?.currentUser?.uid;
    if (!uid) { setLoading(false); return; }
    const unsub = subscribeToUserPostsAnalytics(uid, (data) => {
      setPosts(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const sorted = [...posts].sort((a, b) => b[sortKey] - a[sortKey]);

  const SORT_OPTIONS = [
    { key: "viewCount" as const, label: "Views", icon: "eye-outline" },
    { key: "likes" as const, label: "Likes", icon: "heart-outline" },
    { key: "comments" as const, label: "Comments", icon: "chatbubble-outline" },
    { key: "reposts" as const, label: "Reposts", icon: "repeat-outline" },
    { key: "saves" as const, label: "Saves", icon: "bookmark-outline" },
  ];

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#0F172A", "#0B1220"]} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView edges={["top"]} style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Post Insights</Text>
        <View style={{ width: 38 }} />
      </SafeAreaView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.brand} size="large" />
          <Text style={styles.loadingText}>Loading analytics…</Text>
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="bar-chart-outline" size={48} color={colors.brand} />
          <Text style={styles.emptyTitle}>No posts yet</Text>
          <Text style={styles.emptySub}>Create your first post to start tracking insights.</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.postId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <SummaryCard posts={posts} />
              <Text style={styles.sectionLabel}>Sort by</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
                {SORT_OPTIONS.map((opt) => {
                  const active = sortKey === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.sortChip, active && styles.sortChipActive]}
                      onPress={() => setSortKey(opt.key)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={opt.icon as any} size={13} color={active ? colors.brand : colors.onSurfaceDim} />
                      <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={styles.sectionLabel}>Your Posts</Text>
            </>
          }
          renderItem={({ item }) => <PostRow item={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.07)",
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center",
  },
  topBarTitle: { ...font.h3, fontSize: 17 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { ...font.body, color: colors.onSurfaceDim },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
  emptyTitle: { ...font.h3, fontSize: 18 },
  emptySub: { ...font.body, color: colors.onSurfaceDim, textAlign: "center" },
  listContent: { padding: spacing.lg, paddingBottom: 120 },
  summaryCard: {
    borderRadius: radii.lg, borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(6,182,212,0.25)", overflow: "hidden", padding: spacing.md, marginBottom: spacing.lg,
  },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  summaryTitle: { ...font.title, fontSize: 14, flex: 1 },
  summaryCount: { ...font.small, color: colors.onSurfaceDim },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: radii.md, borderWidth: 1, padding: spacing.sm,
    alignItems: "center", minWidth: 80, flex: 1, gap: 4, backgroundColor: "rgba(255,255,255,0.03)",
  },
  chipIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  chipValue: { fontSize: 16, fontWeight: "800", color: colors.onSurface, letterSpacing: -0.3 },
  chipLabel: {
    fontSize: 10, fontWeight: "600", color: colors.onSurfaceDim,
    textTransform: "uppercase", letterSpacing: 0.4, textAlign: "center",
  },
  sectionLabel: {
    ...font.small, color: colors.onSurfaceDim,
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: spacing.sm, marginTop: spacing.sm,
  },
  sortRow: { gap: 8, paddingBottom: spacing.sm },
  sortChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sortChipActive: { backgroundColor: "rgba(6,182,212,0.15)", borderColor: "rgba(6,182,212,0.40)" },
  sortChipText: { ...font.small, color: colors.onSurfaceDim, fontSize: 12 },
  sortChipTextActive: { color: colors.brand, fontWeight: "700" },
  postCard: {
    borderRadius: radii.md, backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.08)", padding: spacing.md,
  },
  postCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: spacing.sm },
  postPreview: { ...font.body, fontSize: 13, color: colors.onSurfaceMuted, flex: 1, lineHeight: 18 },
  postDate: { ...font.small, color: colors.onSurfaceDim, flexShrink: 0 },
  metricRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  metricCell: { flexDirection: "row", alignItems: "center", gap: 4 },
  metricValue: { fontSize: 13, fontWeight: "700" },
  erPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.04)" },
  erText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
});
