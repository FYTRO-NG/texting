import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { auth } from "@/src/firebase";
import {
  callCreateStory,
  CreateStoryInput,
} from "@/src/services/storyService";
import { evaluateAIModeration } from "@/src/services/aiModerationService";
import { uploadMediaToFirebase } from "@/src/services/mediaService";
import {
  takePictureWithCamera,
  pickImagesFromGallery,
} from "@/src/utils/imagePicker";
import { colors, font, radii, spacing } from "@/src/theme";

// ── Preset text story backgrounds ────────────────────────────────────────────
const BG_PRESETS = [
  { label: "Night", colors: ["#0F172A", "#1E293B"] as [string, string] },
  { label: "Ocean", colors: ["#0C4A6E", "#0369A1"] as [string, string] },
  { label: "Violet", colors: ["#4C1D95", "#6D28D9"] as [string, string] },
  { label: "Rose", colors: ["#881337", "#BE185D"] as [string, string] },
  { label: "Emerald", colors: ["#064E3B", "#059669"] as [string, string] },
  { label: "Amber", colors: ["#78350F", "#D97706"] as [string, string] },
];

const MAX_TEXT_LENGTH = 280;

type ComposerMode = "choose" | "text" | "image";

export default function StoryComposer() {
  const router = useRouter();

  const [mode, setMode] = useState<ComposerMode>("choose");
  const [textContent, setTextContent] = useState("");
  const [bgIndex, setBgIndex] = useState(0);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const selectedBg = BG_PRESETS[bgIndex];

  // ── Image picking ──────────────────────────────────────────────────────────
  const pickFromGallery = async () => {
    const uris = await pickImagesFromGallery({ multiple: false, maxImages: 1 });
    if (uris.length > 0) {
      setImageUri(uris[0]);
      setMode("image");
    }
  };

  const pickFromCamera = async () => {
    const uri = await takePictureWithCamera();
    if (uri) {
      setImageUri(uri);
      setMode("image");
    }
  };

  // ── Share story ────────────────────────────────────────────────────────────
  const handleShare = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert("Not signed in", "Please sign in to share a story.");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      if (mode === "text") {
        if (!textContent.trim()) {
          setError("Please write something for your story.");
          setUploading(false);
          return;
        }

        // Moderate text
        const modResult = evaluateAIModeration(textContent, "media_caption");
        if (modResult.decision === "BLOCK") {
          setError(
            "Your story contains content that violates our community guidelines."
          );
          setUploading(false);
          return;
        }

        const input: CreateStoryInput = {
          type: "text",
          content: textContent.trim(),
          backgroundColor: selectedBg.colors[0],
        };

        const result = await callCreateStory(input);
        if (!result.success) {
          setError(result.error ?? "Could not create story. Please try again.");
          setUploading(false);
          return;
        }
      } else if (mode === "image" && imageUri) {
        // Optionally moderate caption
        if (caption.trim()) {
          const modResult = evaluateAIModeration(caption, "media_caption");
          if (modResult.decision === "BLOCK") {
            setError("Caption contains content that violates our guidelines.");
            setUploading(false);
            return;
          }
        }

        // Upload image to Storage: stories/{uid}/{storyId-placeholder}.jpg
        const storyImageId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const storagePath = `stories/${uid}/${storyImageId}.jpg`;

        let mediaUrl: string;
        try {
          mediaUrl = await uploadMediaToFirebase(
            imageUri,
            storagePath,
            (pct) => setUploadProgress(pct)
          );
        } catch (uploadErr) {
          setError("Image upload failed. Please check your connection and try again.");
          setUploading(false);
          return;
        }

        const input: CreateStoryInput = {
          type: "image",
          mediaUrl,
          content: caption.trim() || undefined,
        };

        const result = await callCreateStory(input);
        if (!result.success) {
          setError(result.error ?? "Could not create story. Please try again.");
          setUploading(false);
          return;
        }
      } else {
        setError("Please choose a story type.");
        setUploading(false);
        return;
      }

      router.back();
    } catch (e: any) {
      console.error("[StoryComposer] share error:", e);
      setError("Something went wrong. Please try again.");
      setUploading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#0F172A", "#0B1220"]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => (mode === "choose" ? router.back() : setMode("choose"))}
            style={styles.headerBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={mode === "choose" ? "close" : "arrow-back"}
              size={22}
              color={colors.onSurface}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Story</Text>
          {(mode === "text" || (mode === "image" && imageUri)) ? (
            <TouchableOpacity
              style={[styles.shareBtn, uploading && { opacity: 0.6 }]}
              onPress={handleShare}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#0F172A" />
              ) : (
                <Text style={styles.shareBtnText}>Share</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ width: 64 }} />
          )}
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={16} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Choose mode ─────────────────────────────────────────────── */}
            {mode === "choose" && (
              <View style={styles.chooseGrid}>
                <TouchableOpacity
                  style={styles.chooseCard}
                  onPress={() => setMode("text")}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={["#4C1D95", "#06B6D4"]}
                    style={styles.chooseCardGradient}
                  >
                    <Ionicons name="text" size={32} color="#FFFFFF" />
                    <Text style={styles.chooseCardLabel}>Text Story</Text>
                    <Text style={styles.chooseCardSub}>
                      Share a thought, up to 280 chars
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.chooseCard}
                  onPress={pickFromGallery}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={["#064E3B", "#06B6D4"]}
                    style={styles.chooseCardGradient}
                  >
                    <Ionicons name="images" size={32} color="#FFFFFF" />
                    <Text style={styles.chooseCardLabel}>Gallery</Text>
                    <Text style={styles.chooseCardSub}>Pick from your photos</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.chooseCard}
                  onPress={pickFromCamera}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={["#78350F", "#D97706"]}
                    style={styles.chooseCardGradient}
                  >
                    <Ionicons name="camera" size={32} color="#FFFFFF" />
                    <Text style={styles.chooseCardLabel}>Camera</Text>
                    <Text style={styles.chooseCardSub}>Take a new photo</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Text Story composer ──────────────────────────────────────── */}
            {mode === "text" && (
              <View style={styles.textComposer}>
                {/* Preview */}
                <LinearGradient
                  colors={selectedBg.colors}
                  style={styles.textPreview}
                >
                  <Text
                    style={[
                      styles.textPreviewText,
                      !textContent && { color: "rgba(255,255,255,0.35)" },
                    ]}
                  >
                    {textContent || "Your story text will appear here…"}
                  </Text>
                </LinearGradient>

                {/* Text input */}
                <TextInput
                  value={textContent}
                  onChangeText={(t) => setTextContent(t.slice(0, MAX_TEXT_LENGTH))}
                  placeholder="Write your story…"
                  placeholderTextColor={colors.onSurfaceDim}
                  style={styles.textInput}
                  multiline
                  maxLength={MAX_TEXT_LENGTH}
                  autoFocus
                />
                <Text style={styles.charCount}>
                  {textContent.length}/{MAX_TEXT_LENGTH}
                </Text>

                {/* Background presets */}
                <Text style={styles.bgLabel}>Background</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.bgRow}
                >
                  {BG_PRESETS.map((bg, i) => (
                    <TouchableOpacity
                      key={bg.label}
                      onPress={() => setBgIndex(i)}
                      style={[
                        styles.bgSwatch,
                        bgIndex === i && styles.bgSwatchActive,
                      ]}
                    >
                      <LinearGradient
                        colors={bg.colors}
                        style={styles.bgSwatchGrad}
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ── Image Story composer ─────────────────────────────────────── */}
            {mode === "image" && imageUri && (
              <View style={styles.imageComposer}>
                <View style={styles.imagePreviewWrap}>
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.imagePreview}
                    contentFit="cover"
                  />
                  <TouchableOpacity
                    style={styles.changeImageBtn}
                    onPress={pickFromGallery}
                  >
                    <Ionicons name="refresh" size={14} color="#FFFFFF" />
                    <Text style={styles.changeImageText}>Change photo</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  value={caption}
                  onChangeText={(t) => setCaption(t.slice(0, 120))}
                  placeholder="Add a caption… (optional)"
                  placeholderTextColor={colors.onSurfaceDim}
                  style={styles.captionInput}
                  multiline
                  maxLength={120}
                />
                <Text style={styles.charCount}>{caption.length}/120</Text>

                {uploading && uploadProgress > 0 && uploadProgress < 100 && (
                  <View style={styles.progressBarWrap}>
                    <View
                      style={[styles.progressBarFill, { width: `${uploadProgress}%` }]}
                    />
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.glassBorder,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { ...font.title, fontSize: 16 },
  shareBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    minWidth: 64,
    alignItems: "center",
  },
  shareBtnText: { color: "#0F172A", fontWeight: "700", fontSize: 14 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(239,68,68,0.3)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    margin: spacing.lg,
    borderRadius: radii.sm,
  },
  errorText: { ...font.caption, color: colors.error, flex: 1 },
  body: { flexGrow: 1, padding: spacing.lg, gap: spacing.lg },
  // Choose mode
  chooseGrid: { gap: spacing.md },
  chooseCard: { borderRadius: radii.lg, overflow: "hidden" },
  chooseCardGradient: {
    padding: spacing.xl,
    gap: spacing.sm,
    alignItems: "center",
    minHeight: 120,
    justifyContent: "center",
  },
  chooseCardLabel: { ...font.title, color: "#FFFFFF", fontSize: 18 },
  chooseCardSub: { ...font.caption, color: "rgba(255,255,255,0.7)" },
  // Text composer
  textComposer: { gap: spacing.md },
  textPreview: {
    borderRadius: radii.lg,
    minHeight: 200,
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  textPreviewText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 30,
  },
  textInput: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.onSurface,
    fontSize: 15,
    minHeight: 80,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    textAlignVertical: "top",
  },
  charCount: { ...font.small, textAlign: "right" },
  bgLabel: { ...font.caption, fontWeight: "600", color: colors.onSurfaceMuted },
  bgRow: { gap: spacing.sm, paddingBottom: spacing.sm },
  bgSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
  },
  bgSwatchActive: { borderColor: colors.brand },
  bgSwatchGrad: { flex: 1 },
  // Image composer
  imageComposer: { gap: spacing.md },
  imagePreviewWrap: {
    borderRadius: radii.lg,
    overflow: "hidden",
    height: 320,
    position: "relative",
  },
  imagePreview: { flex: 1 },
  changeImageBtn: {
    position: "absolute",
    bottom: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(15,23,42,0.7)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
  },
  changeImageText: { ...font.small, color: "#FFFFFF" },
  captionInput: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.onSurface,
    fontSize: 15,
    minHeight: 70,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    textAlignVertical: "top",
  },
  progressBarWrap: {
    height: 4,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.brand,
    borderRadius: 2,
  },
});
