import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
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
import GifPickerModal from "@/src/components/GifPickerModal";
import VoiceRecorderControl from "@/src/components/VoiceRecorderControl";
import { auth } from "@/src/firebase";
import { AVATAR_GRADIENTS } from "@/src/mockData";
import { evaluateAIModeration } from "@/src/services/aiModerationService";
import { getUserProfile, ensureAnonymousAuth, UserProfile } from "@/src/services/authService";
import { getUserData } from "@/src/services/apiClient";
import { subscribeToCommunities } from "@/src/services/communityService";
import { uploadPostImages } from "@/src/services/mediaService";
import { createPostInFirestore, ReplyPermission } from "@/src/services/postService";
import { checkRateLimit } from "@/src/services/safetyService";
import { colors, font, radii, spacing } from "@/src/theme";
import { pickImagesFromGallery, takePictureWithCamera } from "@/src/utils/imagePicker";

const MAX_CHARS = 500;
const MAX_IMAGES = 4;
const QUICK_EMOJIS = ["😊", "😂", "❤️", "🔥", "👀", "🙌", "💬", "✨", "😭", "🤣", "💯", "🎉", "🤔", "😍", "🚀"];

export default function CreatePostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [selectedGif, setSelectedGif] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  const [replyPermission, setReplyPermission] = useState<ReplyPermission>("everyone");
  const [pollMode, setPollMode] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const [showEmojiTray, setShowEmojiTray] = useState(false);
  const [showGifModal, setShowGifModal] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  const [liveCommunities, setLiveCommunities] = useState<any[]>([]);
  const [community, setCommunity] = useState<any>(null);

  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");

  const textInputRef = useRef<TextInput>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getUserData().then((u) => {
      if (u) {
        setUserProfile(u);
      } else {
        const uid = auth?.currentUser?.uid;
        if (uid) {
          getUserProfile(uid).then((prof) => {
            if (prof) setUserProfile(prof);
          });
        }
      }
    });
  }, []);

  useEffect(() => {
    const unsub = subscribeToCommunities((comms) => {
      setLiveCommunities(comms);
      if (comms.length > 0) setCommunity((prev: any) => prev || comms[0]);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: uploadProgress,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [uploadProgress, progressAnim]);

  const hasContent =
    text.trim().length > 0 ||
    images.length > 0 ||
    Boolean(selectedGif) ||
    Boolean(audioUri) ||
    (pollMode && pollOptions.some((o) => o.trim().length > 0));

  const isOverLimit = text.length > MAX_CHARS;
  const charLeft = MAX_CHARS - text.length;
  const charColor =
    text.length > 480 ? colors.error : text.length > 400 ? colors.warning : colors.onSurfaceDim;

  const displayName =
    userProfile?.username || auth?.currentUser?.displayName || "VoiceUser";
  const avatarGradient = userProfile?.avatarGradient || AVATAR_GRADIENTS[0];
  const avatarIcon = userProfile?.avatarIcon || "flash";
  const avatarUrl = userProfile?.avatarUrl;

  // Cancel / Discard handling
  const handleCancel = useCallback(() => {
    if (!hasContent) {
      router.back();
      return;
    }
    Keyboard.dismiss();
    setShowDiscardModal(true);
  }, [hasContent, router]);

  const confirmDiscard = () => {
    setShowDiscardModal(false);
    router.back();
  };

  // Gallery picker
  const handlePickGallery = async () => {
    if (images.length >= MAX_IMAGES) {
      setError("Maximum 4 images per post.");
      return;
    }
    setError("");
    const selected = await pickImagesFromGallery({
      multiple: true,
      maxImages: MAX_IMAGES - images.length,
    });
    if (selected.length > 0) {
      setImages((prev) => [...prev, ...selected].slice(0, MAX_IMAGES));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // Camera picker
  const handleCamera = async () => {
    if (images.length >= MAX_IMAGES) {
      setError("Maximum 4 images per post.");
      return;
    }
    setError("");
    const photoUri = await takePictureWithCamera();
    if (photoUri) {
      setImages((prev) => [...prev, photoUri].slice(0, MAX_IMAGES));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveImage = (fromIndex: number, direction: "left" | "right") => {
    const toIndex = direction === "left" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= images.length) return;
    const next = [...images];
    [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
    setImages(next);
  };

  const addPollOption = () => {
    if (pollOptions.length < 4) setPollOptions([...pollOptions, ""]);
  };

  const updatePollOption = (i: number, v: string) => {
    const next = [...pollOptions];
    next[i] = v;
    setPollOptions(next);
  };

  const insertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    setShowEmojiTray(false);
    textInputRef.current?.focus();
  };

  // Submit Post
  const onPost = async () => {
    if (!hasContent) {
      setError("Write something or attach media to post.");
      return;
    }
    if (isOverLimit) {
      setError(`Text is too long (${text.length}/${MAX_CHARS} characters).`);
      return;
    }
    setError("");

    if (!checkRateLimit("post")) {
      setError("Rate limit reached. Please wait a minute before posting again.");
      return;
    }

    if (text.trim()) {
      const modResult = evaluateAIModeration(text.trim(), "post");
      if (modResult.decision === "BLOCK") {
        setError(
          "This post can't be published because it doesn't meet Private Voices' Community Guidelines."
        );
        return;
      }
    }

    setSubmitting(true);
    setUploadProgress(0);

    const localUser = await getUserData();
    const currentUser =
      localUser || auth?.currentUser || (await ensureAnonymousAuth().catch(() => null));
    const userId = currentUser?.uid || currentUser?.id || currentUser?._id || "anon-user";

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      let uploadedImages: any[] = [];
      if (images.length > 0) {
        try {
          uploadedImages = await uploadPostImages(images, userId, setUploadProgress);
        } catch (uploadErr) {
          setError("Couldn't upload your image. Please try again.");
          setSubmitting(false);
          return;
        }
      }

      // Append GIF to images array if selected
      if (selectedGif) {
        uploadedImages.push({ url: selectedGif, storagePath: "" });
      }

      let status: "published" | "pending_review" = "published";
      if (text.trim()) {
        const mod = evaluateAIModeration(text.trim(), "post");
        if (mod.decision === "REVIEW") status = "pending_review";
      }

      const pollData =
        pollMode && pollOptions.filter((o) => o.trim()).length >= 2
          ? {
              poll: {
                question: text.trim() || "Community Poll",
                options: pollOptions
                  .filter((o) => o.trim())
                  .map((label) => ({ label, votes: 0 })),
                total: 0,
              },
            }
          : {};

      await createPostInFirestore({
        username: displayName,
        avatarColor: avatarGradient as [string, string],
        avatarIcon,
        avatarUrl: avatarUrl || undefined,
        community: community?.name || "Public Feed",
        communityEmoji: community?.emoji || "🌐",
        text: text.trim(),
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
        userId,
        replyPermission,
        visibility: "public",
        status,
        ...pollData,
      });

      router.back();
    } catch (e: any) {
      console.error("Failed to publish post:", e);
      setError(e?.message || "Failed to publish post. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container} testID="create-post-screen">
      <LinearGradient
        colors={["#0F172A", "#0B1220"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <SafeAreaView edges={["top"]} style={styles.header}>
        <TouchableOpacity
          onPress={handleCancel}
          style={styles.cancelBtn}
          testID="create-post-cancel"
          accessibilityLabel="Cancel"
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Create Voice</Text>

        <TouchableOpacity
          onPress={onPost}
          disabled={submitting || !hasContent || isOverLimit}
          activeOpacity={0.85}
          testID="create-post-submit"
          accessibilityLabel="Post Voice"
        >
          <LinearGradient
            colors={
              hasContent && !isOverLimit && !submitting
                ? ["#06B6D4", "#0284C7"]
                : ["#334155", "#334155"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.postBtn}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text
                style={[
                  styles.postBtnText,
                  { color: hasContent && !isOverLimit ? "#0F172A" : colors.onSurfaceDim },
                ]}
              >
                Post
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Progress Track */}
      {submitting && uploadProgress > 0 && (
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
      )}

      {/* Content Body & Keyboard Handling */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => setError("")}>
                <Ionicons name="close" size={14} color={colors.error} />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* User Identity Header */}
          <View style={styles.authorRow}>
            {avatarUrl ? (
              <ExpoImage source={{ uri: avatarUrl }} style={styles.authorAvatar} contentFit="cover" />
            ) : (
              <Avatar size={46} gradient={avatarGradient as [string, string]} icon={avatarIcon} />
            )}
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text style={styles.authorName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.authorHandle} numberOfLines={1}>
                @{displayName.toLowerCase().replace(/\s+/g, "")}
              </Text>
            </View>
          </View>

          {/* Text Input */}
          <TextInput
            ref={textInputRef}
            value={text}
            onChangeText={(v) => {
              setText(v);
              if (error) setError("");
            }}
            placeholder="What's on your mind?"
            placeholderTextColor={colors.onSurfaceDim}
            multiline
            style={styles.textInput}
            testID="create-post-text"
            onFocus={() => setShowEmojiTray(false)}
            autoFocus
          />

          {/* Character counter */}
          {text.length > 350 && (
            <View style={styles.charCountRow}>
              <View style={[styles.charArc, { borderColor: charColor }]}>
                <Text style={[styles.charArcText, { color: charColor }]}>{charLeft}</Text>
              </View>
            </View>
          )}

          {/* Selected Images Grid Preview */}
          {images.length > 0 && (
            <View style={styles.imagePreviews}>
              <View
                style={[
                  styles.imageGrid,
                  images.length === 1 && styles.imageGrid1,
                  images.length === 2 && styles.imageGrid2,
                ]}
              >
                {images.map((imgUri, idx) => (
                  <View key={"img" + idx} style={styles.imageThumbWrap}>
                    <ExpoImage source={{ uri: imgUri }} style={styles.imageThumb} contentFit="cover" />
                    <TouchableOpacity
                      style={styles.removeImgBtn}
                      onPress={() => handleRemoveImage(idx)}
                      testID={"remove-image-" + idx}
                    >
                      <Ionicons name="close" size={12} color="#FFF" />
                    </TouchableOpacity>
                    <View style={styles.reorderRow}>
                      {idx > 0 && (
                        <TouchableOpacity
                          style={styles.reorderBtn}
                          onPress={() => handleMoveImage(idx, "left")}
                        >
                          <Ionicons name="chevron-back" size={11} color="#FFF" />
                        </TouchableOpacity>
                      )}
                      {idx < images.length - 1 && (
                        <TouchableOpacity
                          style={styles.reorderBtn}
                          onPress={() => handleMoveImage(idx, "right")}
                        >
                          <Ionicons name="chevron-forward" size={11} color="#FFF" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={styles.indexBadge}>
                      <Text style={styles.indexBadgeText}>{idx + 1}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <Text style={styles.imageCountNote}>{images.length} / {MAX_IMAGES} images</Text>
            </View>
          )}

          {/* Selected GIF Preview */}
          {selectedGif && (
            <View style={styles.gifPreviewWrap}>
              <ExpoImage source={{ uri: selectedGif }} style={styles.gifPreviewImage} contentFit="cover" />
              <TouchableOpacity
                style={styles.removeGifBtn}
                onPress={() => setSelectedGif(null)}
                testID="remove-gif-btn"
              >
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Voice Post Recording / Preview */}
          {(showVoiceRecorder || audioUri) && (
            <VoiceRecorderControl
              audioUri={audioUri}
              duration={audioDuration}
              onRecordComplete={(uri, dur) => {
                setAudioUri(uri);
                setAudioDuration(dur);
              }}
              onRemoveRecording={() => {
                setAudioUri(null);
                setAudioDuration(0);
                setShowVoiceRecorder(false);
              }}
            />
          )}

          {/* Poll Builder Preview */}
          {pollMode && (
            <View style={styles.pollBuilder}>
              <View style={styles.pollHeader}>
                <Ionicons name="stats-chart" size={16} color={colors.brand} />
                <Text style={styles.pollHeaderText}>Poll</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={() => setPollMode(false)}>
                  <Ionicons name="close-circle" size={18} color={colors.onSurfaceDim} />
                </TouchableOpacity>
              </View>
              {pollOptions.map((opt, i) => (
                <View key={i} style={styles.pollField}>
                  <View style={styles.pollDot} />
                  <TextInput
                    value={opt}
                    onChangeText={(v) => updatePollOption(i, v)}
                    placeholder={"Option " + (i + 1)}
                    placeholderTextColor={colors.onSurfaceDim}
                    style={styles.pollInput}
                    testID={"poll-option-" + i}
                  />
                </View>
              ))}
              {pollOptions.length < 4 && (
                <TouchableOpacity onPress={addPollOption} style={styles.pollAdd} testID="poll-add-option">
                  <Ionicons name="add-circle" size={16} color={colors.brand} />
                  <Text style={styles.pollAddText}>Add option</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Quick Emoji Tray */}
          {showEmojiTray && (
            <View style={styles.emojiTray}>
              {QUICK_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => insertEmoji(emoji)}
                  style={styles.emojiBtn}
                  accessibilityLabel={"Insert " + emoji}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {/* ── Attachment Toolbar (Positioned at bottom, stays above keyboard) ── */}
        <View style={[styles.toolbar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarScroll}>
            {/* Gallery */}
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={handlePickGallery}
              testID="attach-image-btn"
              accessibilityLabel="Attach image from gallery"
            >
              <Ionicons
                name="image-outline"
                size={22}
                color={images.length > 0 ? colors.brand : colors.onSurfaceMuted}
              />
            </TouchableOpacity>

            {/* Camera */}
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={handleCamera}
              testID="attach-camera-btn"
              accessibilityLabel="Take a photo"
            >
              <Ionicons name="camera-outline" size={22} color={colors.onSurfaceMuted} />
            </TouchableOpacity>

            {/* GIF */}
            <TouchableOpacity
              style={[styles.toolBtn, Boolean(selectedGif) && styles.toolBtnActive]}
              onPress={() => setShowGifModal(true)}
              testID="attach-gif-btn"
              accessibilityLabel="Insert GIF"
            >
              <Text style={[styles.gifLabel, Boolean(selectedGif) && { color: colors.brand }]}>GIF</Text>
            </TouchableOpacity>

            {/* Emoji */}
            <TouchableOpacity
              style={[styles.toolBtn, showEmojiTray && styles.toolBtnActive]}
              onPress={() => setShowEmojiTray((v) => !v)}
              testID="attach-emoji-btn"
              accessibilityLabel="Insert emoji"
            >
              <Ionicons
                name="happy-outline"
                size={22}
                color={showEmojiTray ? colors.brand : colors.onSurfaceMuted}
              />
            </TouchableOpacity>

            {/* Poll */}
            <TouchableOpacity
              style={[styles.toolBtn, pollMode && styles.toolBtnActive]}
              onPress={() => setPollMode((v) => !v)}
              testID="attach-poll-btn"
              accessibilityLabel="Add poll"
            >
              <Ionicons
                name="stats-chart-outline"
                size={22}
                color={pollMode ? colors.brand : colors.onSurfaceMuted}
              />
            </TouchableOpacity>

            {/* Voice Recording */}
            <TouchableOpacity
              style={[styles.toolBtn, (showVoiceRecorder || audioUri) && styles.toolBtnActive]}
              onPress={() => setShowVoiceRecorder((v) => !v)}
              testID="attach-voice-btn"
              accessibilityLabel="Record voice post"
            >
              <Ionicons
                name="mic-outline"
                size={22}
                color={(showVoiceRecorder || audioUri) ? colors.brand : colors.onSurfaceMuted}
              />
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* GIF Search Modal */}
      <GifPickerModal
        visible={showGifModal}
        onClose={() => setShowGifModal(false)}
        onSelectGif={(url) => setSelectedGif(url)}
      />

      {/* Discard Draft Confirmation Modal */}
      <Modal visible={showDiscardModal} transparent animationType="fade" onRequestClose={() => setShowDiscardModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.discardBox}>
            <Text style={styles.discardTitle}>Discard this Voice?</Text>
            <Text style={styles.discardSub}>Your draft text and attachments will be lost.</Text>

            <View style={styles.discardActionRow}>
              <TouchableOpacity
                style={styles.keepBtn}
                onPress={() => setShowDiscardModal(false)}
                testID="discard-keep-btn"
              >
                <Text style={styles.keepBtnText}>Keep Editing</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.discardBtn}
                onPress={confirmDiscard}
                testID="discard-confirm-btn"
              >
                <Text style={styles.discardBtnText}>Discard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.glassBorder,
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  cancelBtnText: {
    ...font.body,
    fontSize: 15,
    color: colors.onSurfaceMuted,
    fontWeight: "500",
  },
  headerTitle: {
    ...font.title,
    fontSize: 16,
    fontWeight: "700",
    color: colors.onSurface,
  },
  postBtn: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 68,
  },
  postBtnText: {
    fontWeight: "800",
    fontSize: 14,
  },
  progressTrack: {
    height: 2,
    backgroundColor: colors.surfaceSecondary,
    width: "100%",
  },
  progressBar: {
    height: 2,
    backgroundColor: colors.brand,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  authorAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  authorName: {
    ...font.title,
    fontSize: 16,
    color: colors.onSurface,
    fontWeight: "700",
  },
  authorHandle: {
    ...font.small,
    fontSize: 13,
    color: colors.onSurfaceDim,
    marginTop: 1,
  },
  textInput: {
    minHeight: 160,
    fontSize: 18,
    color: colors.onSurface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    textAlignVertical: "top",
    lineHeight: 26,
  },
  charCountRow: {
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  charArc: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  charArcText: {
    fontSize: 10,
    fontWeight: "700",
  },
  imagePreviews: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 6,
  },
  imageGrid1: {
    flexDirection: "column",
  },
  imageGrid2: {
    flexDirection: "row",
  },
  imageThumbWrap: {
    position: "relative",
    width: 140,
    height: 140,
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  imageThumb: {
    width: "100%",
    height: "100%",
  },
  removeImgBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  reorderRow: {
    position: "absolute",
    bottom: 6,
    left: 6,
    flexDirection: "row",
    gap: 4,
  },
  reorderBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  indexBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  indexBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0F172A",
  },
  imageCountNote: {
    fontSize: 11,
    color: colors.onSurfaceDim,
    fontWeight: "600",
  },
  gifPreviewWrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    height: 200,
    borderRadius: radii.lg,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  gifPreviewImage: {
    width: "100%",
    height: "100%",
  },
  removeGifBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  pollBuilder: {
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandBorder,
    marginBottom: spacing.md,
  },
  pollHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  pollHeaderText: {
    ...font.title,
    fontSize: 14,
    marginLeft: 6,
  },
  pollField: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  pollDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.brand,
    marginRight: 10,
  },
  pollInput: {
    flex: 1,
    color: colors.onSurface,
    fontSize: 14,
  },
  pollAdd: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  pollAddText: {
    color: colors.brand,
    marginLeft: 6,
    fontWeight: "600",
    fontSize: 13,
  },
  emojiTray: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.lg,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  emojiBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
  },
  emojiText: {
    fontSize: 22,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: "rgba(239, 68, 68, 0.10)",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  toolbar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassBorder,
    backgroundColor: colors.surface,
    paddingTop: spacing.xs,
  },
  toolbarScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    alignItems: "center",
  },
  toolBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  toolBtnActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brandBorder,
  },
  gifLabel: {
    color: colors.onSurfaceMuted,
    fontWeight: "800",
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  discardBox: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: "center",
  },
  discardTitle: {
    ...font.h3,
    fontSize: 18,
    color: colors.onSurface,
    marginBottom: 6,
  },
  discardSub: {
    ...font.body,
    fontSize: 14,
    color: colors.onSurfaceMuted,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  discardActionRow: {
    flexDirection: "row",
    gap: spacing.md,
    width: "100%",
  },
  keepBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  keepBtnText: {
    ...font.caption,
    fontWeight: "600",
    color: colors.onSurface,
  },
  discardBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  discardBtnText: {
    ...font.caption,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
