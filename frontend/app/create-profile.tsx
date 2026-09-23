import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Avatar from "@/src/components/Avatar";
import GlassCard from "@/src/components/GlassCard";
import { AVATAR_GRADIENTS, AVATAR_ICONS, THEME_COLORS } from "@/src/mockData";
import { colors, font, radii, spacing } from "@/src/theme";
import { createUserProfile, ensureAnonymousAuth } from "@/src/services/authService";
import { uploadProfilePhoto } from "@/src/services/userService";
import { claimUsername } from "@/src/services/usernameService";
import { auth } from "@/src/firebase";


import { Image as ExpoImage } from "expo-image";
import { pickImagesFromGallery } from "@/src/utils/imagePicker";
import { getUserProfile } from "@/src/services/authService";

export default function CreateProfile() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [gradientIdx, setGradientIdx] = useState(0);
  const [iconIdx, setIconIdx] = useState(0);
  const [themeIdx, setThemeIdx] = useState(0);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Pre-fill existing user profile if logged in
  React.useEffect(() => {
    const currentUser = auth?.currentUser;
    if (currentUser?.uid) {
      getUserProfile(currentUser.uid).then((prof) => {
        if (prof) {
          if (prof.username) setUsername(prof.username);
          if (prof.bio) setBio(prof.bio);
          if (prof.avatarUrl) setCustomAvatar(prof.avatarUrl);
        } else if (currentUser.displayName) {
          setUsername(currentUser.displayName);
        }
      });
    }
  }, []);

  const handlePickCustomAvatar = async () => {
    const selected = await pickImagesFromGallery({ multiple: false, maxImages: 1 });
    if (selected.length > 0) {
      setCustomAvatar(selected[0]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleContinue = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(true);
    try {
      const currentUser = auth?.currentUser || (await ensureAnonymousAuth());
      if (currentUser?.uid) {
        let avatarUrl: string | undefined = customAvatar?.startsWith("http") ? customAvatar : undefined;

        // Upload custom photo to Firebase Storage if selected locally
        if (customAvatar && !customAvatar.startsWith("http")) {
          try {
            avatarUrl = await uploadProfilePhoto(
              currentUser.uid,
              customAvatar,
              (pct) => setUploadProgress(pct)
            );
          } catch (e) {
            console.warn("Profile photo upload failed, using local URI:", e);
            avatarUrl = undefined;
          }
        }

        const finalUsername = username.trim() || currentUser.displayName || "ShadowFox_42";

        // Claim unique username via server callable
        try {
          await claimUsername(finalUsername);
        } catch (e: any) {
          console.warn("Claim username callable warning:", e);
        }

        await createUserProfile(currentUser.uid, {
          username: finalUsername,
          usernameLower: finalUsername.toLowerCase(),
          avatarIcon: customAvatar ? "custom" : AVATAR_ICONS[iconIdx],
          avatarGradient: customAvatar ? [customAvatar, customAvatar] : (AVATAR_GRADIENTS[gradientIdx] as any),
          themeColor: THEME_COLORS[themeIdx],
          bio: bio.trim(),
          ...(avatarUrl ? { avatarUrl } : {}),
        });

      }
    } catch (e) {
      console.error("Failed to save profile:", e);
    } finally {
      setLoading(false);
      setUploadProgress(0);
      router.back();
    }
  };


  return (
    <View style={styles.container} testID="create-profile-screen">
      <LinearGradient
        colors={["#0F172A", "#0B1220"]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.blob, { top: -60, left: -40, backgroundColor: THEME_COLORS[themeIdx] + "22" }]} />
      <View style={[styles.blob, { bottom: 100, right: -80, backgroundColor: "rgba(139,92,246,0.12)" }]} />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="create-profile-back">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Avatar preview */}
            <View style={styles.previewWrap}>
              <View style={styles.previewGlow}>
                {customAvatar ? (
                  <ExpoImage source={{ uri: customAvatar }} style={{ width: 120, height: 120, borderRadius: 60 }} contentFit="cover" />
                ) : (
                  <Avatar size={120} gradient={AVATAR_GRADIENTS[gradientIdx]} icon={AVATAR_ICONS[iconIdx]} ring />
                )}
              </View>
              <Text style={styles.previewName}>{username || "@yourAnonName"}</Text>
              <View style={styles.previewChip}>
                <Ionicons name="shield-checkmark" size={12} color={colors.brand} />
                <Text style={styles.previewChipText}>Identity Hidden</Text>
              </View>
            </View>

            {/* Section: Username */}
            <Text style={styles.sectionLabel}>Anonymous Username</Text>
            <GlassCard radius={radii.lg} style={styles.inputCard} bordered>
              <View style={styles.inputRow}>
                <Text style={styles.at}>@</Text>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="ShadowFox_42"
                  placeholderTextColor={colors.onSurfaceDim}
                  style={styles.input}
                  autoCapitalize="none"
                  maxLength={20}
                  testID="username-input"
                />
                <Ionicons name="shuffle" size={18} color={colors.brand} />
              </View>
            </GlassCard>

            {/* Section: Avatar */}
            <View style={styles.avatarHeaderRow}>
              <Text style={styles.sectionLabel}>Pick your Mask</Text>
              <TouchableOpacity style={styles.uploadPhotoBtn} onPress={handlePickCustomAvatar} testID="upload-custom-avatar">
                <Ionicons name="camera-outline" size={14} color={colors.brand} />
                <Text style={styles.uploadPhotoText}>{customAvatar ? "Change Photo" : "Upload Photo"}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.grid}>
              {AVATAR_ICONS.map((icon, i) => {
                const g = AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length];
                const selected = !customAvatar && i === iconIdx;
                return (
                  <TouchableOpacity
                    key={icon + i}
                    onPress={() => {
                      setCustomAvatar(null);
                      setIconIdx(i);
                      setGradientIdx(i % AVATAR_GRADIENTS.length);
                      Haptics.selectionAsync();
                    }}
                    style={[styles.gridItem, selected && styles.gridItemSelected]}
                    testID={`avatar-option-${i}`}
                  >
                    <Avatar size={48} gradient={g} icon={icon} />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Section: Theme color */}
            <Text style={styles.sectionLabel}>Theme Color</Text>
            <View style={styles.themeRow}>
              {THEME_COLORS.map((c, i) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => {
                    setThemeIdx(i);
                    Haptics.selectionAsync();
                  }}
                  style={[
                    styles.themeSwatch,
                    { backgroundColor: c },
                    themeIdx === i && styles.themeSwatchActive,
                  ]}
                  testID={`theme-color-${i}`}
                >
                  {themeIdx === i && <Ionicons name="checkmark" size={16} color="#0F172A" />}
                </TouchableOpacity>
              ))}
            </View>

            {/* Section: Bio */}
            <Text style={styles.sectionLabel}>Bio <Text style={styles.optional}>(optional)</Text></Text>
            <GlassCard radius={radii.lg} style={[styles.inputCard, { minHeight: 90 }]} bordered>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Tell others what echoes matter to you…"
                placeholderTextColor={colors.onSurfaceDim}
                multiline
                style={[styles.input, { minHeight: 70, textAlignVertical: "top", padding: 14 }]}
                maxLength={140}
                testID="bio-input"
              />
            </GlassCard>

            {/* Privacy note */}
            <View style={styles.privacyRow}>
              <Ionicons name="shield-checkmark" size={16} color={colors.success} />
              <Text style={styles.privacyText}>
                Your real identity will never be shown publicly.
              </Text>
            </View>
          </ScrollView>

          {/* Footer CTA */}
          <View style={styles.footer}>
            <LinearGradient
              colors={["rgba(15,23,42,0)", "rgba(15,23,42,0.95)", "rgba(15,23,42,1)"]}
              style={StyleSheet.absoluteFillObject}
            />
            <SafeAreaView edges={["bottom"]}>
              <TouchableOpacity
                onPress={handleContinue}
                disabled={loading}
                activeOpacity={0.85}
                style={styles.cta}
                testID="create-profile-continue"
              >
                <LinearGradient
                  colors={["#06B6D4", "#0284C7"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaBg}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#0F172A" />
                  ) : (
                    <>
                      <Text style={styles.ctaText}>Save</Text>
                      <Ionicons name="checkmark" size={18} color="#0F172A" style={{ marginLeft: 8 }} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </SafeAreaView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  blob: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 300,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { ...font.title, fontSize: 16 },
  previewWrap: { alignItems: "center", marginTop: spacing.md, marginBottom: spacing.xxl },
  previewGlow: {
    padding: 6,
    borderRadius: 999,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 10,
  },
  previewName: { ...font.h2, fontSize: 22, marginTop: spacing.md },
  previewChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandBorder,
  },
  avatarHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  uploadPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandBorder,
  },
  uploadPhotoText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand,
  },
  sectionLabel: { ...font.caption, fontWeight: "700", color: colors.onSurface, letterSpacing: 0.5, textTransform: "uppercase", fontSize: 11 },
  optional: { color: colors.onSurfaceDim, fontWeight: "500", textTransform: "none" },
  inputCard: { padding: 0 },
  inputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, height: 54 },
  at: { color: colors.brand, fontSize: 18, fontWeight: "800", marginRight: 4 },
  input: { flex: 1, color: colors.onSurface, fontSize: 15, fontWeight: "500" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  gridItem: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  gridItemSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  themeRow: { flexDirection: "row", gap: 12 },
  themeSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  themeSwatchActive: {
    borderColor: "#FFFFFF",
    transform: [{ scale: 1.1 }],
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xl,
    backgroundColor: "rgba(16,185,129,0.10)",
    borderRadius: radii.md,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(16,185,129,0.3)",
  },
  privacyText: { ...font.caption, color: colors.onSurface, marginLeft: 8, flex: 1 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  cta: { borderRadius: radii.pill, overflow: "hidden", marginBottom: spacing.sm },
  ctaBg: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: "#0F172A", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },
});
