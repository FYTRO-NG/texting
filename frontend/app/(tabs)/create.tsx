import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, Animated } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Avatar from "@/src/components/Avatar";
import { AVATAR_GRADIENTS, Community } from "@/src/mockData";
import { colors, font, radii, spacing } from "@/src/theme";
import { createPostInFirestore, ReplyPermission } from "@/src/services/postService";
import { uploadPostImages } from "@/src/services/mediaService";
import { evaluateAIModeration } from "@/src/services/aiModerationService";
import { checkRateLimit } from "@/src/services/safetyService";
import { subscribeToCommunities } from "@/src/services/communityService";
import { getUserProfile, UserProfile, ensureAnonymousAuth } from "@/src/services/authService";
import { auth } from "@/src/firebase";
import { pickImagesFromGallery, takePictureWithCamera } from "@/src/utils/imagePicker";

const MAX_CHARS = 500;
const MAX_IMAGES = 4;
const REPLY_OPTIONS = [
  { key: "everyone", label: "Everyone", icon: "globe-outline", desc: "Anyone can reply" },
  { key: "followers", label: "Followers", icon: "people-outline", desc: "Only followers" },
  { key: "none", label: "No one", icon: "ban-outline", desc: "Replies disabled" },
];
const QUICK_EMOJIS = ["😊","😂","❤️","🔥","👀","🙌","💬","✨","😭","🤣","💯","🎉","🤔","😍","🚀"];

export default function Create() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [userProfile, setUserProfile] = useState(null);
  const [text, setText] = useState("");
  const [images, setImages] = useState([]);
  const [replyPermission, setReplyPermission] = useState("everyone");
  const [pollMode, setPollMode] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [showEmojiTray, setShowEmojiTray] = useState(false);
  const [liveCommunities, setLiveCommunities] = useState([]);
  const [community, setCommunity] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const textInputRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const uid = auth && auth.currentUser && auth.currentUser.uid;
    if (uid) {
      getUserProfile(uid).then((prof) => { if (prof) setUserProfile(prof); });
    }
  }, []);

  useEffect(() => {
    const unsub = subscribeToCommunities((comms) => {
      setLiveCommunities(comms);
      if (comms.length > 0) setCommunity((prev) => prev || comms[0]);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    Animated.timing(progressAnim, { toValue: uploadProgress, duration: 200, useNativeDriver: false }).start();
  }, [uploadProgress]);

  const hasContent = text.trim().length > 0 || images.length > 0;
  const isOverLimit = text.length > MAX_CHARS;
  const charLeft = MAX_CHARS - text.length;
  const charColor = text.length > 480 ? colors.error : text.length > 400 ? colors.warning : colors.onSurfaceDim;

  const displayName = (userProfile && userProfile.username) || (auth && auth.currentUser && auth.currentUser.displayName) || "Anonymous";
  const avatarGradient = (userProfile && userProfile.avatarGradient) || AVATAR_GRADIENTS[0];
  const avatarIcon = (userProfile && userProfile.avatarIcon) || "flash";
  const avatarUrl = userProfile && userProfile.avatarUrl;

  const handleClose = useCallback(() => {
    if (!hasContent) { router.back(); return; }
    if (Platform.OS === "web") {
      if (window.confirm("Discard post? Your changes will be lost.")) router.back();
    } else {
      Alert.alert("Discard post?", "Your changes will be lost.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => router.back() },
      ]);
    }
  }, [hasContent, router]);

  const handlePickGallery = async () => {
    if (images.length >= MAX_IMAGES) { setError("Maximum 4 images per post."); return; }
    setError("");
    const selected = await pickImagesFromGallery({ multiple: true, maxImages: MAX_IMAGES - images.length });
    if (selected.length > 0) { setImages((prev) => [...prev, ...selected].slice(0, MAX_IMAGES)); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }
  };

  const handleCamera = async () => {
    if (images.length >= MAX_IMAGES) { setError("Maximum 4 images per post."); return; }
    setError("");
    const photoUri = await takePictureWithCamera();
    if (photoUri) { setImages((prev) => [...prev, photoUri].slice(0, MAX_IMAGES)); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }
  };

  const handleRemoveImage = (index) => { setImages((prev) => prev.filter((_, i) => i !== index)); };
  const handleMoveImage = (fromIndex, direction) => {
    const toIndex = direction === "left" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= images.length) return;
    const next = [...images]; [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]]; setImages(next);
  };
  const addPollOption = () => { if (pollOptions.length < 4) setPollOptions([...pollOptions, ""]); };
  const updatePollOption = (i, v) => { const next = [...pollOptions]; next[i] = v; setPollOptions(next); };
  const insertEmoji = (emoji) => { setText((prev) => prev + emoji); setShowEmojiTray(false); textInputRef.current && textInputRef.current.focus(); };

  const onPost = async () => {
    if (!hasContent && !pollMode) { setError("Write something or add an image to post."); return; }
    if (isOverLimit) { setError("Text is too long (" + text.length + "/" + MAX_CHARS + " characters)."); return; }
    if (Platform.OS === "web" && typeof navigator !== "undefined" && !navigator.onLine) { setError("You're offline. Check your connection and try again."); return; }
    setError("");
    if (!checkRateLimit("post")) { setError("Rate limit reached. Please wait a minute before posting again."); return; }
    if (text.trim()) {
      const modResult = evaluateAIModeration(text.trim(), "post");
      if (modResult.decision === "BLOCK") { setError("This post can't be published because it doesn't meet Private Voices' Community Guidelines."); return; }
    }
    setSubmitting(true); setUploadProgress(0);
    const currentUser = auth?.currentUser || (await ensureAnonymousAuth().catch(() => null));
    const userId = currentUser?.uid || "anon-user";
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      let uploadedImages = [];
      if (images.length > 0) {
        try { uploadedImages = await uploadPostImages(images, userId, setUploadProgress); }
        catch (uploadErr) { setError("Couldn't upload your image. Try again."); setSubmitting(false); return; }
      }
      let status = "published";
      if (text.trim()) { const mod = evaluateAIModeration(text.trim(), "post"); if (mod.decision === "REVIEW") status = "pending_review"; }
      const pollData = (pollMode && pollOptions.filter((o) => o.trim()).length >= 2) ? { poll: { question: text.trim() || "Community Poll", options: pollOptions.filter((o) => o.trim()).map((label) => ({ label, votes: 0 })), total: 0 } } : {};
      await createPostInFirestore({
        username: displayName, avatarColor: avatarGradient, avatarIcon, avatarUrl: avatarUrl || undefined,
        community: (community && community.name) || "Public Feed", communityEmoji: (community && community.emoji) || "🌐",
        text: text.trim(), images: uploadedImages.length > 0 ? uploadedImages : undefined,
        userId, replyPermission, visibility: "public", status, ...pollData,
      });
      router.back();
    } catch (e) {
      console.error("Failed to publish post:", e);
      if (e && (e.code === "unavailable" || (e.message && e.message.includes("offline")))) { setError("You're offline. Check your connection and try again."); }
      else { setError((e && e.message) || "Failed to publish. Please try again."); }
    } finally { setSubmitting(false); }
  };

  return (
    <View style={styles.container} testID="create-post-screen">
      <LinearGradient colors={["#0F172A", "#0B1220"]} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView edges={["top"]} style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.headerBtn} testID="create-cancel" accessibilityLabel="Close composer">
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Post</Text>
        <TouchableOpacity onPress={onPost} disabled={submitting || !hasContent || isOverLimit} activeOpacity={0.85} testID="create-post-submit" accessibilityLabel="Post">
          <LinearGradient colors={(hasContent && !isOverLimit && !submitting) ? ["#06B6D4","#0284C7"] : ["#334155","#334155"]} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.postBtn}>
            {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={[styles.postBtnText,{color:hasContent&&!isOverLimit?"#0F172A":colors.onSurfaceDim}]}>{submitting?"Posting…":"Post"}</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
      {submitting && uploadProgress > 0 && (
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar,{width:progressAnim.interpolate({inputRange:[0,100],outputRange:["0%","100%"]})}]} />
        </View>
      )}
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined} keyboardVerticalOffset={0}>
        <ScrollView contentContainerStyle={{paddingBottom:spacing.md}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {error ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => setError("")}><Ionicons name="close" size={14} color={colors.error} /></TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.authorRow}>
            {avatarUrl
              ? <ExpoImage source={{uri:avatarUrl}} style={styles.authorAvatar} contentFit="cover" />
              : <Avatar size={44} gradient={avatarGradient} icon={avatarIcon} />}
            <View style={{marginLeft:spacing.md,flex:1}}>
              <Text style={styles.authorName} numberOfLines={1}>@{displayName}</Text>
              <View style={styles.anonBadge}>
                <Ionicons name="shield-checkmark" size={11} color={colors.success} />
                <Text style={styles.anonBadgeText}>Public Voice · Protected</Text>
              </View>
            </View>
          </View>
          <TextInput ref={textInputRef} value={text} onChangeText={(v)=>{setText(v);if(error)setError("");}} placeholder="What's echoing on your mind?" placeholderTextColor={colors.onSurfaceDim} multiline style={styles.textInput} testID="create-post-text" onFocus={()=>setShowEmojiTray(false)} />
          <View style={styles.charCountRow}>
            <View style={[styles.charArc,{borderColor:charColor}]}>
              <Text style={[styles.charArcText,{color:charColor}]}>{charLeft}</Text>
            </View>
          </View>
          {images.length > 0 && (
            <View style={styles.imagePreviews}>
              <View style={styles.imagePreviewRow}>
                {images.map((imgUri, idx) => (
                  <View key={"img"+idx} style={styles.imageThumbWrap}>
                    <ExpoImage source={{uri:imgUri}} style={styles.imageThumb} contentFit="cover" />
                    <TouchableOpacity style={styles.removeImgBtn} onPress={()=>handleRemoveImage(idx)} testID={"remove-image-"+idx} accessibilityLabel={"Remove image "+(idx+1)}>
                      <Ionicons name="close" size={12} color="#FFF" />
                    </TouchableOpacity>
                    <View style={styles.reorderRow}>
                      {idx > 0 && <TouchableOpacity style={styles.reorderBtn} onPress={()=>handleMoveImage(idx,"left")} testID={"move-left-"+idx}><Ionicons name="chevron-back" size={11} color="#FFF" /></TouchableOpacity>}
                      {idx < images.length-1 && <TouchableOpacity style={styles.reorderBtn} onPress={()=>handleMoveImage(idx,"right")} testID={"move-right-"+idx}><Ionicons name="chevron-forward" size={11} color="#FFF" /></TouchableOpacity>}
                    </View>
                    <View style={styles.indexBadge}><Text style={styles.indexBadgeText}>{idx+1}</Text></View>
                  </View>
                ))}
                {images.length < MAX_IMAGES && (
                  <TouchableOpacity style={styles.addImgSlot} onPress={handlePickGallery} testID="add-image-slot" accessibilityLabel="Add image">
                    <Ionicons name="add" size={28} color={colors.brand} /><Text style={styles.addImgSlotText}>Add image</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.imageCountNote}>{images.length} / {MAX_IMAGES} images</Text>
            </View>
          )}
          {pollMode && (
            <View style={styles.pollBuilder}>
              <View style={styles.pollHeader}>
                <Ionicons name="stats-chart" size={15} color={colors.brand} />
                <Text style={styles.pollHeaderText}>Poll</Text>
                <View style={{flex:1}} />
                <TouchableOpacity onPress={()=>setPollMode(false)}><Ionicons name="close-circle" size={18} color={colors.onSurfaceDim} /></TouchableOpacity>
              </View>
              {pollOptions.map((opt,i) => (
                <View key={i} style={styles.pollField}>
                  <View style={styles.pollDot} />
                  <TextInput value={opt} onChangeText={(v)=>updatePollOption(i,v)} placeholder={"Option "+(i+1)} placeholderTextColor={colors.onSurfaceDim} style={styles.pollInput} testID={"poll-option-"+i} />
                </View>
              ))}
              {pollOptions.length < 4 && <TouchableOpacity onPress={addPollOption} style={styles.pollAdd} testID="poll-add-option"><Ionicons name="add-circle" size={16} color={colors.brand} /><Text style={styles.pollAddText}>Add option</Text></TouchableOpacity>}
            </View>
          )}
          <Text style={styles.sectionLabel}>Who can interact?</Text>
          <View style={styles.replyRow}>
            {REPLY_OPTIONS.map((opt) => {
              const active = replyPermission === opt.key;
              return (
                <TouchableOpacity key={opt.key} onPress={()=>setReplyPermission(opt.key)} style={[styles.replyChip,active&&styles.replyChipActive]} testID={"reply-"+opt.key} accessibilityLabel={opt.desc}>
                  <Ionicons name={opt.icon} size={14} color={active?colors.brand:colors.onSurfaceMuted} />
                  <Text style={[styles.replyChipText,active&&{color:colors.brand}]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {liveCommunities.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Post to community</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.commRow}>
                {liveCommunities.slice(0,10).map((c) => {
                  const active = community && community.id === c.id;
                  return (
                    <TouchableOpacity key={c.id} onPress={()=>setCommunity(c)} style={[styles.commChip,active&&styles.commChipActive]} testID={"community-chip-"+c.id}>
                      <Text style={styles.commChipEmoji}>{c.emoji}</Text>
                      <Text style={[styles.commChipText,active&&{color:colors.brand}]} numberOfLines={1}>{c.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}
          {showEmojiTray && (
            <View style={styles.emojiTray}>
              {QUICK_EMOJIS.map((emoji) => (
                <TouchableOpacity key={emoji} onPress={()=>insertEmoji(emoji)} style={styles.emojiBtn} accessibilityLabel={"Insert "+emoji}>
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
        <View style={[styles.toolbar,{paddingBottom:Math.max(insets.bottom,8)}]}>
          <View style={styles.toolbarRow}>
            <TouchableOpacity style={styles.toolBtn} onPress={handlePickGallery} testID="attach-image-btn" accessibilityLabel="Attach image from gallery">
              <Ionicons name="image-outline" size={22} color={images.length>0?colors.brand:colors.onSurfaceMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolBtn} onPress={handleCamera} testID="attach-camera-btn" accessibilityLabel="Take a photo">
              <Ionicons name="camera-outline" size={22} color={colors.onSurfaceMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toolBtn,showEmojiTray&&styles.toolBtnActive]} onPress={()=>setShowEmojiTray((v)=>!v)} testID="attach-emoji-btn" accessibilityLabel="Insert emoji">
              <Ionicons name="happy-outline" size={22} color={showEmojiTray?colors.brand:colors.onSurfaceMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolBtn} testID="attach-gif-btn" accessibilityLabel="Insert GIF (coming soon)">
              <Text style={styles.gifLabel}>GIF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toolBtn,pollMode&&styles.toolBtnActive]} onPress={()=>setPollMode((v)=>!v)} testID="attach-poll-btn" accessibilityLabel="Add poll">
              <Ionicons name="stats-chart-outline" size={22} color={pollMode?colors.brand:colors.onSurfaceMuted} />
            </TouchableOpacity>
            <View style={{flex:1}} />
            <View style={styles.anonPill}>
              <Ionicons name="shield-checkmark" size={12} color={colors.brand} />
              <Text style={styles.anonPillText}>Public Voice</Text>
              <View style={styles.switchOn}><View style={styles.switchThumb} /></View>
            </View>
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
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { ...font.h3, fontSize: 17, color: colors.onSurface },
  postBtn: {
    height: 38,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 72,
  },
  postBtnText: { fontWeight: "800", fontSize: 14 },
  progressTrack: { height: 2, backgroundColor: colors.surfaceSecondary, width: "100%" },
  progressBar: { height: 2, backgroundColor: colors.brand },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  authorAvatar: { width: 44, height: 44, borderRadius: 22 },
  authorName: { ...font.title, fontSize: 15 },
  anonBadge: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  anonBadgeText: { ...font.small, color: colors.success, marginLeft: 4, fontWeight: "600" },
  textInput: {
    minHeight: 140,
    fontSize: 18,
    color: colors.onSurface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    textAlignVertical: "top",
    lineHeight: 26,
  },
  charCountRow: { alignItems: "flex-end", paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  charArc: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  charArcText: { fontSize: 10, fontWeight: "700" },
  imagePreviews: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  imagePreviewRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 },
  imageThumbWrap: {
    position: "relative",
    width: 90,
    height: 90,
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  imageThumb: { width: "100%", height: "100%" },
  removeImgBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  reorderRow: { position: "absolute", bottom: 4, left: 4, flexDirection: "row", gap: 4 },
  reorderBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  indexBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  indexBadgeText: { fontSize: 9, fontWeight: "800", color: "#0F172A" },
  addImgSlot: {
    width: 90,
    height: 90,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.brandBorder,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  addImgSlotText: { fontSize: 10, fontWeight: "700", color: colors.brand, marginTop: 2 },
  imageCountNote: { fontSize: 11, color: colors.onSurfaceDim, fontWeight: "600" },
  pollBuilder: {
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandBorder,
    marginBottom: spacing.md,
  },
  pollHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  pollHeaderText: { ...font.title, fontSize: 14, marginLeft: 6 },
  pollField: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  pollDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: colors.brand, marginRight: 10 },
  pollInput: { flex: 1, color: colors.onSurface, fontSize: 14 },
  pollAdd: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  pollAddText: { color: colors.brand, marginLeft: 6, fontWeight: "600", fontSize: 13 },
  sectionLabel: {
    ...font.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 11,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  replyRow: { flexDirection: "row", gap: 8, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  replyChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: "transparent",
  },
  replyChipActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  replyChipText: { ...font.caption, fontSize: 12, fontWeight: "600" },
  commRow: { paddingHorizontal: spacing.lg, gap: 8, paddingBottom: spacing.sm },
  commChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  commChipActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  commChipEmoji: { fontSize: 14 },
  commChipText: { ...font.caption, fontWeight: "600", maxWidth: 90 },
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
  emojiBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radii.sm },
  emojiText: { fontSize: 22 },
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
  errorText: { color: colors.error, fontSize: 13, fontWeight: "600", flex: 1 },
  toolbar: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  toolbarRow: { flexDirection: "row", alignItems: "center" },
  toolBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  toolBtnActive: { backgroundColor: colors.brandSoft, borderColor: colors.brandBorder },
  gifLabel: { color: colors.onSurfaceMuted, fontWeight: "800", fontSize: 11 },
  anonPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    paddingLeft: 10,
    paddingRight: 4,
    height: 34,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandBorder,
    gap: 4,
  },
  anonPillText: { color: colors.brand, fontWeight: "700", fontSize: 11 },
  switchOn: {
    width: 32,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand,
    justifyContent: "center",
    alignItems: "flex-end",
    padding: 2,
  },
  switchThumb: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#FFFFFF" },
});
