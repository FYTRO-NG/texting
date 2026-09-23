import { Ionicons } from "@expo/vector-icons";
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
  KeyboardAvoidingView,
} from "react-native";

import { colors, font, radii, spacing } from "@/src/theme";
import { submitContentReport } from "@/src/services/safetyService";

type Props = {
  visible: boolean;
  onClose: () => void;
  targetType: "post" | "message" | "user" | "comment";
  targetId: string;
  targetContent?: string;
};

const REASONS: { key: "harassment" | "hate_speech" | "spam" | "threat_self_harm" | "impersonation" | "other"; label: string; icon: string }[] = [
  { key: "harassment", label: "Harassment or Bullying", icon: "hand-stop-outline" },
  { key: "hate_speech", label: "Hate Speech or Slurs", icon: "warning-outline" },
  { key: "threat_self_harm", label: "Threat or Self-Harm", icon: "alert-circle-outline" },
  { key: "spam", label: "Spam or Scam", icon: "flag-outline" },
  { key: "impersonation", label: "Impersonation", icon: "person-remove-outline" },
  { key: "other", label: "Other Violation", icon: "ellipsis-horizontal-circle-outline" },
];

export default function ReportModal({
  visible,
  onClose,
  targetType,
  targetId,
  targetContent,
}: Props) {
  const [selectedReason, setSelectedReason] = useState<any>(REASONS[0].key);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitContentReport({
        targetType,
        targetId,
        targetContent,
        reason: selectedReason,
        details: details.trim(),
      });
      setSubmitted(true);
    } catch (e) {
      console.error("Failed to submit report:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSubmitted(false);
    setDetails("");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.scrim}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.card}
        >
          <LinearGradient colors={["#1E293B", "#0F172A"]} style={StyleSheet.absoluteFillObject} />

          {submitted ? (
            <View style={styles.submittedWrap}>
              <Ionicons name="shield-checkmark" size={48} color={colors.success} />
              <Text style={styles.submittedTitle}>Report Submitted</Text>
              <Text style={styles.submittedSub}>
                Thank you for helping keep Private Voices safe. Our safety team will review this item.
              </Text>
              <TouchableOpacity style={styles.doneBtn} onPress={handleClose}>
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <Ionicons name="shield-outline" size={20} color={colors.brand} />
                <Text style={styles.title}>Report {targetType}</Text>
                <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color={colors.onSurfaceMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.subtitle}>Select the primary reason for reporting:</Text>

              <View style={styles.reasonsGroup}>
                {REASONS.map((r) => {
                  const active = selectedReason === r.key;
                  return (
                    <TouchableOpacity
                      key={r.key}
                      style={[styles.reasonRow, active && styles.reasonActive]}
                      onPress={() => setSelectedReason(r.key)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={r.icon as any}
                        size={16}
                        color={active ? colors.brand : colors.onSurfaceMuted}
                      />
                      <Text style={[styles.reasonLabel, active && styles.reasonLabelActive]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder="Additional details (optional)..."
                placeholderTextColor={colors.onSurfaceDim}
                style={styles.detailsInput}
                multiline
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <LinearGradient
                  colors={["#EF4444", "#DC2626"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitBtnInner}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitText}>Submit Report</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: font.family,
    fontSize: 18,
    fontWeight: "700",
    color: colors.onSurface,
    textTransform: "capitalize",
  },
  closeBtn: {
    marginLeft: "auto",
  },
  subtitle: {
    fontFamily: font.family,
    fontSize: 13,
    color: colors.onSurfaceSecondary,
    marginBottom: spacing.md,
  },
  reasonsGroup: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  reasonActive: {
    backgroundColor: "rgba(6,182,212,0.12)",
    borderWidth: 1,
    borderColor: "rgba(6,182,212,0.3)",
  },
  reasonLabel: {
    fontFamily: font.family,
    fontSize: 14,
    color: colors.onSurfaceSecondary,
  },
  reasonLabelActive: {
    color: colors.brand,
    fontWeight: "600",
  },
  detailsInput: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.onSurface,
    fontFamily: font.family,
    fontSize: 13,
    minHeight: 60,
    marginBottom: spacing.lg,
  },
  submitBtn: {
    borderRadius: radii.md,
    overflow: "hidden",
  },
  submitBtnInner: {
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    fontFamily: font.family,
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  submittedWrap: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  submittedTitle: {
    fontFamily: font.family,
    fontSize: 20,
    fontWeight: "700",
    color: colors.onSurface,
    marginTop: spacing.md,
  },
  submittedSub: {
    fontFamily: font.family,
    fontSize: 14,
    color: colors.onSurfaceSecondary,
    textAlign: "center",
    marginVertical: spacing.md,
    lineHeight: 20,
  },
  doneBtn: {
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  doneText: {
    fontFamily: font.family,
    fontSize: 14,
    fontWeight: "600",
    color: colors.onSurface,
  },
});
