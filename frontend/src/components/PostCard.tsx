import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { colors, font, radii, shadow, spacing } from "../theme";
import Avatar from "./Avatar";
import VoiceNotePlayer from "./VoiceNotePlayer";
import { Post } from "../mockData";
import {
  toggleLikePost,
  toggleSavePost,
  repostPostInFirestore,
  voteOnPollInFirestore,
} from "../services/postService";
import { blockUserInFirestore } from "../services/safetyService";
import ReportModal from "./ReportModal";
import { auth } from "../firebase";

type Props = { post: Post };

export default function PostCard({ post }: Props) {
  const router = useRouter();
  const [liked, setLiked] = useState(!!post.liked);
  const [saved, setSaved] = useState(!!post.saved);
  const [likes, setLikes] = useState(post.likes);
  const [reposts, setReposts] = useState(post.reposts || 0);
  const [reposted, setReposted] = useState(false);
  const [pollVote, setPollVote] = useState<number | null>(null);

  const userId = auth?.currentUser?.uid || "anon-user";

  const onLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newLikedState = !liked;
    setLiked(newLikedState);
    setLikes((c) => (liked ? c - 1 : c + 1));
    toggleLikePost(post.id, userId, liked).catch(console.error);
  };
  const onSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newSavedState = !saved;
    setSaved(newSavedState);
    toggleSavePost(post.id, userId, saved).catch(console.error);
  };

  const onRepost = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!reposted) {
      setReposted(true);
      setReposts((r) => r + 1);
      repostPostInFirestore(post.id).catch(console.error);
    }
  };

  const onComment = () => {
    router.push({ pathname: "/post/[id]", params: { id: post.id } } as any);
  };

  const onShare = async () => {
    const baseUrl = process.env.EXPO_PUBLIC_APP_URL || "https://private-voices-api.onrender.com";
    const postUrl = `${baseUrl}/post/${post.id}`;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "Private Voices Echo",
          text: post.text,
          url: postUrl,
        });
        return;
      } else if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(postUrl);
        Alert.alert("Link Copied", "Echo link copied to clipboard!");
        return;
      }
    } catch (_) {}
  };

  const [reportModalVisible, setReportModalVisible] = useState(false);

  const onOptions = () => {
    const isMyPost = post.authorId === userId || post.userId === userId;

    if (isMyPost) {
      Alert.alert("Post Options", "Your anonymous echo on Private Voices.", [{ text: "OK" }]);
      return;
    }

    Alert.alert(
      "Post Options",
      `Manage post or author @${post.username}`,
      [
        {
          text: "Report Post",
          style: "destructive",
          onPress: () => setReportModalVisible(true),
        },
        {
          text: `Block @${post.username}`,
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Block User",
              `Are you sure you want to block @${post.username}? You won't see their posts or messages.`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Block",
                  style: "destructive",
                  onPress: async () => {
                    const targetId = post.authorId || post.userId;
                    if (targetId) {
                      await blockUserInFirestore(targetId);
                      Alert.alert("User Blocked", `@${post.username} has been blocked.`);
                    } else {
                      Alert.alert("Notice", "User identifier not available.");
                    }
                  },
                },
              ]
            );
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handlePollVote = (idx: number) => {
    if (pollVote === null && post.poll) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPollVote(idx);
      voteOnPollInFirestore(post.id, idx, post.poll).catch(console.error);
    }
  };

  const pollTotal = post.poll
    ? post.poll.total + (pollVote !== null ? 1 : 0)
    : 0;

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => router.push({ pathname: "/post/[id]", params: { id: post.id } } as any)}
        style={styles.card}
        testID={`post-card-${post.id}`}
      >
      {/* Header */}
      <View style={styles.header}>
        <Avatar size={40} gradient={post.avatarColor} icon={post.avatarIcon} />
        <View style={{ marginLeft: spacing.md, flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.username}>{post.username}</Text>
            <View style={styles.dot} />
            <Text style={styles.time}>{post.time}</Text>
          </View>
          <View style={styles.communityChip}>
            <Text style={styles.communityEmoji}>{post.communityEmoji}</Text>
            <Text style={styles.communityText}>{post.community}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.moreBtn} onPress={onOptions} testID={`post-more-${post.id}`}>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.onSurfaceMuted} />
        </TouchableOpacity>
      </View>

      {/* Text */}
      <Text style={styles.text}>{post.text}</Text>

      {/* Voice Note */}
      {post.voiceNote ? (
        <VoiceNotePlayer duration={post.voiceNote.duration} audioUrl={post.voiceNote.audioUrl} />
      ) : null}

      {/* Image(s) */}
      {(() => {
        const imgList = post.images && post.images.length > 0 ? post.images : (post.image ? [post.image] : []);
        if (imgList.length === 0) return null;

        if (imgList.length === 1) {
          return (
            <View style={styles.imageWrap}>
              <Image source={{ uri: imgList[0] }} style={styles.image} contentFit="cover" transition={300} />
            </View>
          );
        }

        return (
          <View style={styles.multiImageWrap}>
            {imgList.slice(0, 4).map((uri, idx) => (
              <View key={idx} style={[styles.multiImageCell, { flex: 1, height: imgList.length > 2 ? 140 : 200 }]}>
                <Image source={{ uri }} style={styles.image} contentFit="cover" transition={300} />
              </View>
            ))}
          </View>
        );
      })()}

      {/* Poll */}
      {post.poll ? (
        <View style={styles.pollWrap}>
          {post.poll.options.map((opt, idx) => {
            const votes = opt.votes + (pollVote === idx ? 1 : 0);
            const pct = pollTotal > 0 ? Math.round((votes / pollTotal) * 100) : 0;
            const isPicked = pollVote === idx;
            return (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.85}
                onPress={() => handlePollVote(idx)}
                style={styles.pollRow}
                testID={`post-poll-${post.id}-${idx}`}
              >
                <LinearGradient
                  colors={isPicked ? ["rgba(6,182,212,0.35)", "rgba(6,182,212,0.10)"] : ["rgba(148,163,184,0.15)", "rgba(148,163,184,0.05)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    StyleSheet.absoluteFillObject,
                    { borderRadius: radii.md, width: `${pollVote !== null ? pct : 0}%` },
                  ]}
                />
                <View style={styles.pollRowInner}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {isPicked && <Ionicons name="checkmark-circle" size={16} color={colors.brand} style={{ marginRight: 6 }} />}
                    <Text style={[styles.pollLabel, isPicked && { color: colors.brand, fontWeight: "700" }]}>
                      {opt.label}
                    </Text>
                  </View>
                  {pollVote !== null && <Text style={styles.pollPct}>{pct}%</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
          <Text style={styles.pollMeta}>{pollTotal.toLocaleString()} votes · {pollVote !== null ? "Voted" : "Tap to vote"}</Text>
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onLike} testID={`post-like-${post.id}`}>
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={22}
            color={liked ? "#EC4899" : colors.onSurfaceMuted}
          />
          <Text style={[styles.actionText, liked && { color: "#EC4899" }]}>{likes.toLocaleString()}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionBtn} onPress={onComment} testID={`post-comment-${post.id}`}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.onSurfaceMuted} />
          <Text style={styles.actionText}>{post.comments}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onRepost} testID={`post-repost-${post.id}`}>
          <Ionicons name="repeat-outline" size={22} color={reposted ? colors.success : colors.onSurfaceMuted} />
          <Text style={[styles.actionText, reposted && { color: colors.success }]}>{reposts.toLocaleString()}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onShare} testID={`post-share-${post.id}`}>
          <Ionicons name="paper-plane-outline" size={19} color={colors.onSurfaceMuted} />
        </TouchableOpacity>
        
        <View style={{ flex: 1 }} />
        
        <TouchableOpacity onPress={onSave} testID={`post-save-${post.id}`}>
          <Ionicons
            name={saved ? "bookmark" : "bookmark-outline"}
            size={20}
            color={saved ? colors.brand : colors.onSurfaceMuted}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>

    <ReportModal
      visible={reportModalVisible}
      onClose={() => setReportModalVisible(false)}
      targetType="post"
      targetId={post.id}
      targetContent={post.text}
    />
  </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    ...shadow.card,
  },
  header: { flexDirection: "row", alignItems: "center" },
  nameRow: { flexDirection: "row", alignItems: "center" },
  username: { ...font.title, fontSize: 15 },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.onSurfaceDim,
    marginHorizontal: 8,
  },
  time: { ...font.small },
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
  communityText: { ...font.small, color: colors.brand, fontWeight: "600" },
  moreBtn: { padding: 6 },
  text: { ...font.body, marginTop: spacing.md },
  imageWrap: {
    marginTop: spacing.md,
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  multiImageWrap: {
    flexDirection: "row",
    gap: 6,
    marginTop: spacing.md,
    height: 180,
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  multiImageCell: {
    height: "100%",
    borderRadius: radii.md,
    overflow: "hidden",
  },
  image: { width: "100%", height: 220, backgroundColor: colors.surfaceTertiary },
  pollWrap: { marginTop: spacing.md },
  pollRow: {
    height: 44,
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
  actions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: spacing.xl,
  },
  actionText: { ...font.caption, marginLeft: 6, fontWeight: "600" },
});
