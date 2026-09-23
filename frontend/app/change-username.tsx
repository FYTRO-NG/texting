import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { getUserProfile, UserProfile } from "@/src/services/authService";
import { trackUsernameChanged } from "@/src/services/analyticsService";
import {
  changeUsername,
  checkUsernameAvailability,
  getDaysUntilUsernameChange,
} from "@/src/services/usernameService";
import { colors, font, radii, spacing } from "@/src/theme";

export default function ChangeUsernameScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<{ available: boolean; reason?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    const uid = auth?.currentUser?.uid;
    if (!uid) {
      setLoadingProfile(false);
      return;
    }
    getUserProfile(uid).then((p) => {
      if (p) {
        setProfile(p);
        setNewUsername(p.username);
      }
      setLoadingProfile(false);
    });
  }, []);

  const daysRemaining = profile ? getDaysUntilUsernameChange(profile.nextUsernameChangeAt) : 0;
  const isCooldownActive = daysRemaining > 0;

  useEffect(() => {
    if (!newUsername.trim() || newUsername.trim() === profile?.username) {
      setAvailability(null);
      setChecking(false);
      return;
    }

    setChecking(true);
    const timer = setTimeout(async () => {
      const res = await checkUsernameAvailability(newUsername.trim());
      setAvailability(res);
      setChecking(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [newUsername, profile?.username]);

  const handleSave = async () => {
    if (isCooldownActive) {
      Alert.alert(
        "Username Change Unavailable",
        `You can change your username again in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}.`
      );
      return;
    }

    if (!availability?.available && newUsername.trim() !== profile?.username) {
      Alert.alert("Invalid Username", availability?.reason || "Please select an available username.");
      return;
    }

    setSaving(true);
    try {
      const res = await changeUsername(newUsername.trim());
      if (res.success) {
        trackUsernameChanged();
        Alert.alert("Success", "Your username has been updated.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to update username.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container} testID="change-username-screen">
      <LinearGradient colors={["#0F172A", "#0B1220"]} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.title}>Change Username</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.content}>
            {loadingProfile ? (
              <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 40 }} />
            ) : (
              <>
                {isCooldownActive && (
                  <View style={styles.cooldownBanner}>
                    <Ionicons name="time-outline" size={20} color="#F59E0B" />
                    <View style={{ flex: 1, marginLeft: spacing.sm }}>
                      <Text style={styles.cooldownTitle}>Username Change Unavailable</Text>
                      <Text style={styles.cooldownText}>
                        You can change your username again in {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}.
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.card}>
                  <Text style={styles.label}>NEW USERNAME</Text>
                  <View style={styles.inputRow}>
                    <Text style={styles.atPrefix}>@</Text>
                    <TextInput
                      style={styles.input}
                      value={newUsername}
                      onChangeText={setNewUsername}
                      placeholder="username"
                      placeholderTextColor={colors.onSurfaceSubtle}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isCooldownActive && !saving}
                    />
                    {checking && <ActivityIndicator size="small" color={colors.brand} />}
                    {!checking && availability?.available && newUsername.trim() !== profile?.username && (
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    )}
                    {!checking && availability && !availability.available && (
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    )}
                  </View>

                  {availability?.reason && newUsername.trim() !== profile?.username && (
                    <Text
                      style={[
                        styles.hint,
                        { color: availability.available ? "#10B981" : "#EF4444" },
                      ]}
                    >
                      {availability.reason}
                    </Text>
                  )}

                  <Text style={styles.infoNote}>
                    Usernames can only be changed once every 60 days. Choose wisely!
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    (isCooldownActive ||
                      checking ||
                      saving ||
                      !newUsername.trim() ||
                      newUsername.trim() === profile?.username ||
                      !availability?.available) &&
                      styles.disabledBtn,
                  ]}
                  onPress={handleSave}
                  disabled={
                    isCooldownActive ||
                    checking ||
                    saving ||
                    !newUsername.trim() ||
                    newUsername.trim() === profile?.username ||
                    !availability?.available
                  }
                  testID="save-username-btn"
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitBtnText}>Save Username</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  title: {
    fontSize: font.sizes.lg,
    fontWeight: font.weights.bold,
    color: colors.onSurface,
  },
  content: {
    padding: spacing.md,
  },
  cooldownBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.3)",
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cooldownTitle: {
    color: "#F59E0B",
    fontWeight: font.weights.bold,
    fontSize: font.sizes.sm,
  },
  cooldownText: {
    color: colors.onSurfaceSubtle,
    fontSize: font.sizes.xs,
    marginTop: 2,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: font.sizes.xs,
    fontWeight: font.weights.bold,
    color: colors.onSurfaceSubtle,
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    height: 44,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  atPrefix: {
    fontSize: font.sizes.md,
    color: colors.brand,
    fontWeight: font.weights.bold,
    marginRight: 4,
  },
  input: {
    flex: 1,
    color: colors.onSurface,
    fontSize: font.sizes.md,
  },
  hint: {
    fontSize: font.sizes.xs,
    marginTop: spacing.xs,
  },
  infoNote: {
    fontSize: font.sizes.xs,
    color: colors.onSurfaceSubtle,
    marginTop: spacing.sm,
    lineHeight: 16,
  },
  submitBtn: {
    backgroundColor: colors.brand,
    height: 48,
    borderRadius: radii.md,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledBtn: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: font.sizes.md,
    fontWeight: font.weights.bold,
  },
});
