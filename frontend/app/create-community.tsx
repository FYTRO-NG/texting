import { Ionicons } from "@expo/vector-icons";
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
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, font, radii, spacing } from "@/src/theme";
import { createCommunityInFirestore } from "@/src/services/communityService";
import { trackEvent } from "@/src/services/analyticsService";

const CATEGORIES = [
  "Technology",
  "Education",
  "Relationships",
  "Entertainment",
  "Sports",
  "Gaming",
  "Business",
  "Career",
  "Lifestyle",
  "News & Discussion",
  "Local Communities",
  "Anonymous Support",
];

export default function CreateCommunityScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [requireApproval, setRequireApproval] = useState(false);
  const [allowAnon, setAllowAnon] = useState(true);
  const [rulesInput, setRulesInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSlugChange = (text: string) => {
    // Auto-slugify input
    const cleaned = text.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    setSlug(cleaned);
  };

  const handleNameChange = (text: string) => {
    setName(text);
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9_-]/g, "")) {
      setSlug(text.toLowerCase().replace(/[^a-z0-9_-]/g, ""));
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || name.trim().length < 3) {
      Alert.alert("Invalid Name", "Community name must be at least 3 characters.");
      return;
    }

    if (!slug.trim() || slug.trim().length < 3) {
      Alert.alert("Invalid Username/Slug", "Community slug must be at least 3 characters.");
      return;
    }

    const parsedRules = rulesInput
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    setLoading(true);
    try {
      const res = await createCommunityInFirestore({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        category,
        visibility,
        requireApproval,
        rules: parsedRules.length > 0 ? parsedRules : [
          "1. Be respectful to all community members.",
          "2. Keep conversations constructive and empathetic.",
          "3. Respect anonymity and privacy at all times."
        ],
        allowAnonymousPosts: allowAnon,
      });

      if (res.success) {
        trackEvent("community_created", { category, visibility });
        Alert.alert("Success!", `Community "${name.trim()}" created successfully.`, [
          {
            text: "View Community",
            onPress: () => router.replace({ pathname: "/community/[id]", params: { id: res.communityId } } as any),
          },
        ]);
      }
    } catch (err: any) {
      Alert.alert("Error Creating Community", err?.message || "Failed to create community. Slug might already be taken.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container} testID="create-community-screen">
      <LinearGradient colors={["#0F172A", "#0B1220"]} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="create-community-back">
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Community</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

            {/* Name & Slug */}
            <View style={styles.card}>
              <Text style={styles.label}>COMMUNITY NAME *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={handleNameChange}
                placeholder="e.g. Anonymous Creators"
                placeholderTextColor={colors.onSurfaceSubtle}
              />

              <Text style={[styles.label, { marginTop: spacing.md }]}>COMMUNITY USERNAME / SLUG *</Text>
              <View style={styles.slugWrap}>
                <Text style={styles.cPrefix}>c/</Text>
                <TextInput
                  style={styles.slugInput}
                  value={slug}
                  onChangeText={handleSlugChange}
                  placeholder="anonymouscreators"
                  placeholderTextColor={colors.onSurfaceSubtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <Text style={styles.hint}>Shareable link: privatevoices.com/c/{slug || "slug"}</Text>
            </View>

            {/* Description & Category */}
            <View style={styles.card}>
              <Text style={styles.label}>DESCRIPTION</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: "top", paddingTop: 10 }]}
                value={description}
                onChangeText={setDescription}
                placeholder="What is this community about?"
                placeholderTextColor={colors.onSurfaceSubtle}
                multiline
              />

              <Text style={[styles.label, { marginTop: spacing.md }]}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {CATEGORIES.map((cat) => {
                    const active = cat === category;
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setCategory(cat)}
                        style={[styles.catChip, active && styles.catChipActive]}
                      >
                        <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{cat}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Visibility & Settings */}
            <View style={styles.card}>
              <Text style={styles.label}>VISIBILITY & ACCESS</Text>
              <View style={styles.radioRow}>
                <TouchableOpacity
                  onPress={() => setVisibility("public")}
                  style={[styles.radioCard, visibility === "public" && styles.radioCardActive]}
                >
                  <Ionicons name="globe-outline" size={20} color={visibility === "public" ? colors.brand : colors.onSurfaceMuted} />
                  <Text style={[styles.radioTitle, visibility === "public" && styles.radioTitleActive]}>Public</Text>
                  <Text style={styles.radioDesc}>Anyone can discover, view, and join.</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setVisibility("private")}
                  style={[styles.radioCard, visibility === "private" && styles.radioCardActive]}
                >
                  <Ionicons name="lock-closed-outline" size={20} color={visibility === "private" ? colors.brand : colors.onSurfaceMuted} />
                  <Text style={[styles.radioTitle, visibility === "private" && styles.radioTitleActive]}>Private</Text>
                  <Text style={styles.radioDesc}>Members must request access.</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Require approval to join</Text>
                  <Text style={styles.toggleDesc}>Moderators must approve membership requests.</Text>
                </View>
                <Switch
                  value={requireApproval}
                  onValueChange={setRequireApproval}
                  trackColor={{ false: "rgba(255,255,255,0.1)", true: colors.brand }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={[styles.toggleRow, { borderTopWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.08)", paddingTop: spacing.md }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Allow Anonymous Posting</Text>
                  <Text style={styles.toggleDesc}>Members can post without exposing their handle.</Text>
                </View>
                <Switch
                  value={allowAnon}
                  onValueChange={setAllowAnon}
                  trackColor={{ false: "rgba(255,255,255,0.1)", true: colors.brand }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Rules */}
            <View style={styles.card}>
              <Text style={styles.label}>COMMUNITY RULES (ONE PER LINE)</Text>
              <TextInput
                style={[styles.input, { height: 90, textAlignVertical: "top", paddingTop: 10 }]}
                value={rulesInput}
                onChangeText={setRulesInput}
                placeholder={"1. Be kind and respectful\n2. Respect member anonymity\n3. No spam or self-promotion"}
                placeholderTextColor={colors.onSurfaceSubtle}
                multiline
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={loading}
              testID="submit-create-community-btn"
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Create Community</Text>
              )}
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: font.sizes.lg,
    fontWeight: font.weights.bold,
    color: colors.onSurface,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: spacing.md,
  },
  label: {
    fontSize: font.sizes.xs,
    fontWeight: font.weights.bold,
    color: colors.onSurfaceSubtle,
    marginBottom: spacing.xs,
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    height: 44,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    fontSize: font.sizes.md,
  },
  slugWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  cPrefix: {
    fontSize: font.sizes.md,
    fontWeight: font.weights.bold,
    color: colors.brand,
    marginRight: 2,
  },
  slugInput: {
    flex: 1,
    color: colors.onSurface,
    fontSize: font.sizes.md,
  },
  hint: {
    fontSize: font.sizes.xs,
    color: colors.onSurfaceSubtle,
    marginTop: spacing.xs,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  catChipActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brandBorder,
  },
  catChipText: {
    fontSize: font.sizes.xs,
    color: colors.onSurfaceMuted,
    fontWeight: "600",
  },
  catChipTextActive: {
    color: colors.brand,
    fontWeight: "700",
  },
  radioRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: spacing.xs,
  },
  radioCard: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: radii.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  radioCardActive: {
    borderColor: colors.brand,
    backgroundColor: "rgba(139,92,246,0.12)",
  },
  radioTitle: {
    color: colors.onSurface,
    fontWeight: font.weights.bold,
    fontSize: font.sizes.sm,
    marginTop: 6,
  },
  radioTitleActive: {
    color: colors.brand,
  },
  radioDesc: {
    color: colors.onSurfaceSubtle,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
  },
  toggleTitle: {
    color: colors.onSurface,
    fontWeight: font.weights.bold,
    fontSize: font.sizes.sm,
  },
  toggleDesc: {
    color: colors.onSurfaceSubtle,
    fontSize: font.sizes.xs,
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: colors.brand,
    height: 50,
    borderRadius: radii.md,
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.md,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: font.sizes.md,
    fontWeight: font.weights.bold,
  },
});
