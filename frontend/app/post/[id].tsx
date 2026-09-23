import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
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
import { AVATAR_GRADIENTS, Comment, Post } from "@/src/mockData";
import { colors, font, radii, spacing } from "@/src/theme";
import { getPostById, subscribeToComments, addCommentToFirestore, incrementViewCount } from "@/src/services/postService";
import { getUserProfile, ensureAnonymousAuth } from "@/src/services/authService";
import { auth } from "@/src/firebase";

const SORT_TABS = ["Top", "New", "Following"];

function CommentBlock({ c, depth = 0 }: { c: Comment; depth?: number }) {
  const router = useRouter();
  const [liked, setLiked] = useState(!!c.liked);
  const [likes, setLikes] = useState(c.likes);
  const [expanded, setExpanded] = useState(true);

  const onLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLiked((v) => !v);
    setLikes((n) => (liked ? n - 1 : n + 1));
  };

  return (
    <View style={[styles.commentBlock, depth > 0 && { marginLeft: 32 }]}>
      {depth > 0 && <View style={styles.threadLine} />}
      <View style={styles.commentRow}>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/user/[handle]", params: { handle: c.username } } as any)}
        >
          <Avatar size={32} gradient={c.avatarColor} icon={c.avatarIcon} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentUser}>{c.username}</Text>
            {c.op && (
              <View style={styles.opBadge}>
                <Text style={styles.opText}>OP</Text>
              </View>
            )}
            <Text style={styles.commentMetaDot}>·</Text>
            <Text style={styles.commentTime}>{c.time}</Text>
          </View>
          <Text style={styles.commentText}>{c.text}</Text>
          <View style={styles.commentActions}>
            <TouchableOpacity style={styles.cAction} onPress={onLike} testID={`comment-like-${c.id}`}>
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={14}
                color={liked ? "#EC4899" : colors.onSurfaceMuted}
              />
              <Text style={[styles.cActionText, liked && { color: "#EC4899" }]}>{likes}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cAction} testID={`comment-reply-${c.id}`}>
              <Ionicons name="return-down-forward" size={14} color={colors.onSurfaceMuted} />
              <Text style={styles.cActionText}>Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cAction}>
              <Ionicons name="ellipsis-horizontal" size={14} color={colors.onSurfaceMuted} />
            </TouchableOpacity>
          </View>

          {c.replies && c.replies.length > 0 && (
            <View>
              <TouchableOpacity onPress={() => setExpanded((v) => !v)} style={styles.expandRow}>
                <View style={styles.expandLine} />
                <Text style={styles.expandText}>
                  {expanded ? "Hide" : "View"} {c.replies.length} {c.replies.length === 1 ? "reply" : "replies"}
                </Text>
              </TouchableOpacity>
              {expanded &&
                c.replies.map((r) => <CommentBlock key={r.id} c={r} depth={depth + 1} />)}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export default function PostDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [reply, setReply] = useState("");
  const [sort, setSort] = useState(0);
  const [commentsList, setCommentsList] = useState<Comment[]>([]);

  useEffect(() => {
    if (!id) return;
    getPostById(id as string).then((data) => {
      if (data) setPost(data);
    });
    // Fire-and-forget: increment view count each time this post is opened
    incrementViewCount(id as string);
    const unsubscribe = subscribeToComments(id as string, (liveComments) => {
      setCommentsList(liveComments as any);
    });
    return () => unsubscribe();
  }, [id]);


  const [userHandle, setUserHandle] = useState<string>("Voice");

  useEffect(() => {
    const currentUser = auth?.currentUser;
    if (currentUser) {
      getUserProfile(currentUser.uid).then((prof) => {
        if (prof?.username) setUserHandle(prof.username);
        else if (currentUser.displayName) setUserHandle(currentUser.displayName);
      });
    }
  }, []);

  const onSendReply = async () => {
    if (!reply.trim()) return;
    const commentText = reply.trim();
    setReply("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const currentUser = auth?.currentUser || (await ensureAnonymousAuth().catch(() => null));
    const handle = userHandle !== "Voice" ? userHandle : (currentUser?.displayName || currentUser?.email?.split("@")[0] || "Voice");

    if (id) {
      await addCommentToFirestore(id as string, {
        username: handle,
        avatarColor: AVATAR_GRADIENTS[0] as any,
        avatarIcon: "flash",
        text: commentText,
        isOp: false,
      });
    } else {
      setCommentsList((prev) => [
        ...prev,
        {
          id: `c${Date.now()}`,
          username: handle,
          avatarColor: AVATAR_GRADIENTS[0],
          avatarIcon: "flash",
          time: "now",
          text: commentText,
          likes: 0,
        },
      ]);
    }
  };
  const [liked, setLiked] = useState(!!post?.liked);
  const [saved, setSaved] = useState(!!post?.saved);
  const [likes, setLikes] = useState(post?.likes ?? 0);
  const [pollVote, setPollVote] = useState<number | null>(null);

  const pollTotal = post?.poll ? post.poll.total + (pollVote !== null ? 1 : 0) : 0;

  const onLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLiked((v) => !v);
    setLikes((n) => (liked ? n - 1 : n + 1));
  };


  return (
    <View style={styles.container} testID="post-detail-screen">
      <LinearGradient colors={["#0F172A", "#0B1220"]} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="post-back">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thread</Text>
          <TouchableOpacity style={styles.iconBtn} testID="post-share-header">
            <Ionicons name="share-outline" size={18} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 90 }}
          showsVerticalScrollIndicator={false}
        >
          {!post ? (
            <View style={{ padding: spacing.xl, alignItems: "center" }}>
              <Text style={{ color: colors.onSurfaceMuted, fontSize: 16 }}>Post not found.</Text>
            </View>
          ) : (
            <View style={styles.postWrap}>
              <View style={styles.postHeader}>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: "/user/[handle]", params: { handle: post.username } } as any)}
                >
                  <Avatar size={44} gradient={post.avatarColor} icon={post.avatarIcon} />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.postUser}>{post.username}</Text>
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: "/community/[id]", params: { id: "c3" } } as any)}
                    style={styles.communityChip}
                  >
                    <Text style={styles.communityEmoji}>{post.communityEmoji}</Text>
                    <Text style={styles.communityText}>{post.community}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.followBtn} testID="post-follow-author">
                  <Text style={styles.followText}>Follow</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.postText}>{post.text}</Text>

              {post.image && (
                <View style={styles.imageWrap}>
                  <Image source={{ uri: post.image }} style={styles.image} contentFit="cover" transition={300} />
                </View>
              )}

              {post.poll && (
                <View style={styles.pollWrap}>
                  {post.poll.options.map((opt, idx) => {
                    const votes = opt.votes + (pollVote === idx ? 1 : 0);
                    const pct = pollTotal > 0 ? Math.round((votes / pollTotal) * 100) : 0;
                    const picked = pollVote === idx;
                    return (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.85}
                        onPress={() => pollVote === null && setPollVote(idx)}
                        style={styles.pollRow}
                      >
                        <LinearGradient
                          colors={picked ? ["rgba(6,182,212,0.35)", "rgba(6,182,212,0.10)"] : ["rgba(148,163,184,0.15)", "rgba(148,163,184,0.05)"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[StyleSheet.absoluteFillObject, { width: `${pollVote !== null ? pct : 0}%`, borderRadius: radii.md }]}
                        />
                        <View style={styles.pollRowInner}>
                          <Text style={[styles.pollLabel, picked && { color: colors.brand, fontWeight: "700" }]}>
                            {opt.label}
                          </Text>
                          {pollVote !== null && <Text style={styles.pollPct}>{pct}%</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  <Text style={styles.pollMeta}>{pollTotal.toLocaleString()} votes · {pollVote !== null ? "Voted" : "Tap to vote"}</Text>
                </View>
              )}

              {/* Time */}
              <Text style={styles.postTime}>{post.time} ago · Public</Text>

              {/* Metrics */}
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricNum}>{likes.toLocaleString()}</Text>
                  <Text style={styles.metricLabel}>Likes</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricNum}>{post.comments}</Text>
                  <Text style={styles.metricLabel}>Comments</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricNum}>{post.reposts}</Text>
                  <Text style={styles.metricLabel}>Reposts</Text>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actBtn} onPress={onLike} testID="post-detail-like">
                  <Ionicons name={liked ? "heart" : "heart-outline"} size={20} color={liked ? "#EC4899" : colors.onSurface} />
                  <Text style={[styles.actText, liked && { color: "#EC4899" }]}>Like</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actBtn} testID="post-detail-comment">
                  <Ionicons name="chatbubble-outline" size={20} color={colors.onSurface} />
                  <Text style={styles.actText}>Reply</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actBtn} testID="post-detail-repost">
                  <Ionicons name="repeat-outline" size={20} color={colors.onSurface} />
                  <Text style={styles.actText}>Repost</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actBtn} onPress={() => setSaved((v) => !v)} testID="post-detail-save">
                  <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={19} color={saved ? colors.brand : colors.onSurface} />
                  <Text style={[styles.actText, saved && { color: colors.brand }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Sort tabs */}
          {post && (
            <View style={styles.sortRow}>
              <Text style={styles.commentsTitle}>{post.comments} Comments</Text>
              <View style={styles.sortChips}>
                {SORT_TABS.map((t, i) => {
                  const active = i === sort;
                  return (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setSort(i)}
                      style={[styles.sortChip, active && styles.sortChipActive]}
                      testID={`post-sort-${i}`}
                    >
                      <Text style={[styles.sortText, active && styles.sortTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Comments */}
          <View style={styles.commentsList}>
            {commentsList.map((c) => (
              <CommentBlock key={c.id} c={c} />
            ))}
          </View>
        </ScrollView>

        {/* Reply composer */}
        <View style={[styles.composer, { paddingBottom: 10 + insets.bottom }]}>
          <View style={styles.composerInner}>
            <Avatar size={30} gradient={AVATAR_GRADIENTS[0]} icon="flash" />
            <TextInput
              value={reply}
              onChangeText={setReply}
              placeholder="Add an anonymous reply…"
              placeholderTextColor={colors.onSurfaceDim}
              style={styles.replyInput}
              multiline
              testID="post-reply-input"
            />
            <TouchableOpacity
              onPress={onSendReply}
              activeOpacity={0.85}
              style={[styles.sendBtn, !reply.trim() && { opacity: 0.4 }]}
              testID="post-reply-send"
            >
              <LinearGradient
                colors={["#8B5CF6", "#06B6D4"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Ionicons name="send" size={15} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
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
  headerTitle: { ...font.title, fontSize: 15 },

  postWrap: { padding: spacing.lg },
  postHeader: { flexDirection: "row", alignItems: "center" },
  postUser: { ...font.h3, fontSize: 15 },
  communityChip: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.brandSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandBorder,
  },
  communityEmoji: { fontSize: 11, marginRight: 4 },
  communityText: { color: colors.brand, fontSize: 11, fontWeight: "700" },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
  },
  followText: { color: "#0F172A", fontWeight: "800", fontSize: 12 },

  postText: { ...font.body, fontSize: 17, lineHeight: 25, marginTop: spacing.lg },
  imageWrap: {
    marginTop: spacing.md,
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  image: { width: "100%", height: 240 },

  pollWrap: { marginTop: spacing.md },
  pollRow: {
    height: 46,
    borderRadius: radii.md,
    marginBottom: 8,
    overflow: "hidden",
    backgroundColor: "rgba(148,163,184,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  pollRowInner: {
    flex: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pollLabel: { ...font.body, fontSize: 14 },
  pollPct: { ...font.caption, color: colors.onSurface, fontWeight: "700" },
  pollMeta: { ...font.small, marginTop: 4 },

  postTime: { ...font.small, marginTop: spacing.md, letterSpacing: 0.3 },

  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  metricItem: { flex: 1, alignItems: "center" },
  metricDivider: { width: 1, height: 24, backgroundColor: colors.divider },
  metricNum: { ...font.h3, fontSize: 17 },
  metricLabel: {
    ...font.small,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: 10,
    fontWeight: "700",
  },

  actionsRow: {
    flexDirection: "row",
    marginTop: spacing.md,
    gap: 6,
  },
  actBtn: {
    flex: 1,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    gap: 6,
  },
  actText: { color: colors.onSurface, fontSize: 12, fontWeight: "700" },

  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  commentsTitle: { ...font.title, fontSize: 15 },
  sortChips: { flexDirection: "row", gap: 6 },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  sortChipActive: { backgroundColor: colors.brandSoft, borderColor: colors.brandBorder },
  sortText: { ...font.small, fontWeight: "700", fontSize: 11 },
  sortTextActive: { color: colors.brand },

  commentsList: { paddingHorizontal: spacing.lg },
  commentBlock: { marginBottom: spacing.md, position: "relative" },
  threadLine: {
    position: "absolute",
    left: -18,
    top: 18,
    bottom: 10,
    width: 2,
    backgroundColor: colors.divider,
    borderRadius: 1,
  },
  commentRow: { flexDirection: "row" },
  commentHeader: { flexDirection: "row", alignItems: "center" },
  commentUser: { ...font.title, fontSize: 13 },
  opBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
  opText: { color: "#0F172A", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  commentMetaDot: { color: colors.onSurfaceDim, marginHorizontal: 5 },
  commentTime: { ...font.small },
  commentText: { ...font.body, fontSize: 14, lineHeight: 20, marginTop: 3 },
  commentActions: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 14 },
  cAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  cActionText: { color: colors.onSurfaceMuted, fontSize: 11, fontWeight: "700" },
  expandRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
  expandLine: { width: 22, height: 1, backgroundColor: colors.divider },
  expandText: { color: colors.brand, fontSize: 11, fontWeight: "700" },

  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
    paddingTop: 10,
    paddingHorizontal: spacing.lg,
  },
  composerInner: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  replyInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.onSurface,
    fontSize: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
