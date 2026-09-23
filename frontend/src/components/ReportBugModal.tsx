import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";

import { colors, font, radii, spacing } from "@/src/theme";
import { submitBugReport } from "@/src/services/safetyService";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const CATEGORIES = [
  "UI / Visual",
  "Authentication",
  "Voice / Audio",
  "Messages / Chat",
  "Performance",
  "Other",
];

export default function ReportBugModal({ visible, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = title.trim().length > 2 && description.trim().length > 5;

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await submitBugReport({
        title: title.trim(),
        description: description.trim(),
        category,
        platform: Platform.OS,
      });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setTitle("");
        setDescription("");
        onClose();
      }, 1800);
    } catch (err) {
      console.error("Bug report submission error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.sheet}
        >
          <LinearGradient colors={["#1E293B", "#0F172A"]} style={StyleSheet.absoluteFillObject} />

          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={styles.iconWrap}>
                <Ionicons name="bug" size={18} color="#F43F5E" />
              </View>
              <Text style={styles.modalTitle}>Report a Bug</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.onSurfaceMuted} />
            </TouchableOpacity>
          </View>

          {submitted ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={48} color={colors.brand} />
              <Text style={styles.successTitle}>Bug Report Submitted!</Text>
              <Text style={styles.successSub}>Thank you for helping us improve Private Voices.</Text>
            </View>
          ) : (
            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoriesRow}>
                {CATEGORIES.map((cat) => {
                  const selected = category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setCategory(cat)}
                      style={[styles.catPill, selected && styles.catPillActive]}
                    >
                      <Text style={[styles.catText, selected && styles.catTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Bug Summary</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Brief summary (e.g. Screen went white after login)"
                placeholderTextColor={colors.onSurfaceDim}
                style={styles.input}
              />

              <Text style={styles.label}>Detailed Description & Steps</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="What happened? What were you doing when the bug occurred?"
                placeholderTextColor={colors.onSurfaceDim}
                multiline
                numberOfLines={4}
                style={[styles.input, styles.multilineInput]}
              />

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!canSubmit || loading}
                style={[styles.submitBtn, (!canSubmit || loading) && { opacity: 0.5 }]}
              >
                <LinearGradient
                  colors={["#F43F5E", "#E11D48"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.submitText}>Submit Bug Report</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "85%",
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    padding: spacing.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(244,63,94,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    ...font.heading,
    fontSize: 18,
    color: colors.onSurface,
  },
  closeBtn: {
    padding: 6,
  },
  formScroll: {
    marginTop: 4,
  },
  label: {
    ...font.caption,
    color: colors.onSurfaceMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: spacing.md,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  categoriesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  catPillActive: {
    backgroundColor: "rgba(244,63,94,0.2)",
    borderColor: "#F43F5E",
  },
  catText: {
    ...font.small,
    fontSize: 12,
    color: colors.onSurfaceMuted,
  },
  catTextActive: {
    color: "#F43F5E",
    fontWeight: "700",
  },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.onSurface,
    fontSize: 14,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: "top",
  },
  submitBtn: {
    height: 48,
    borderRadius: radii.pill,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  submitText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  successBox: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  successTitle: {
    ...font.title,
    color: colors.onSurface,
    fontSize: 18,
  },
  successSub: {
    ...font.body,
    color: colors.onSurfaceMuted,
    textAlign: "center",
    fontSize: 14,
  },
});
