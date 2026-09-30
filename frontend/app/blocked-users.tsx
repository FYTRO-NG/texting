import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Avatar from "@/src/components/Avatar";
import { AVATAR_GRADIENTS } from "@/src/mockData";
import { colors, font, radii, spacing } from "@/src/theme";
import { auth } from "@/src/firebase";
import { subscribeToUserProfile, getUserProfile, UserProfile } from "@/src/services/authService";
import { unblockUserInFirestore } from "@/src/services/safetyService";

interface BlockedItem {
  uid: string;
  username: string;
  avatarColor: readonly [string, string];
  avatarIcon: string;
}

export default function BlockedUsersScreen() {
  const router = useRouter();
  const [blockedUsers, setBlockedUsers] = useState<BlockedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToUserProfile(currentUid, async (profile) => {
      const uids = profile?.blockedUsers || [];
      if (uids.length === 0) {
        setBlockedUsers([]);
        setLoading(false);
        return;
      }

      // Fetch user details for each blocked UID
      try {
        const items: BlockedItem[] = await Promise.all(
          uids.map(async (uid, index) => {
            try {
              const p = await getUserProfile(uid);
              return {
                uid,
                username: p?.username || p?.displayName || `User_${uid.slice(0, 6)}`,
                avatarColor: (p?.avatarGradient as any) || AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length],
                avatarIcon: p?.avatarIcon || "person",
              };
            } catch {
              return {
                uid,
                username: `User_${uid.slice(0, 6)}`,
                avatarColor: AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length],
                avatarIcon: "person",
              };
            }
          })
        );
        setBlockedUsers(items);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleUnblock = (user: BlockedItem) => {
    Alert.alert(
      "Unblock User",
      `Are you sure you want to unblock @${user.username}? They will be able to see your posts and send you whispers again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          style: "default",
          onPress: async () => {
            try {
              await unblockUserInFirestore(user.uid);
              Alert.alert("Success", `@${user.username} has been unblocked.`);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to unblock user.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container} testID="blocked-users-screen">
      <LinearGradient colors={["#0F172A", "#0B1220"]} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="blocked-back-btn">
            <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Blocked Accounts</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator color={colors.brand} size="large" />
          </View>
        ) : blockedUsers.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="person-remove-outline" size={44} color={colors.onSurfaceMuted} />
            </View>
            <Text style={styles.emptyTitle}>No Blocked Accounts</Text>
            <Text style={styles.emptySub}>
              Users you block won't be able to interact with you, message you, or see your echoes.
            </Text>
          </View>
        ) : (
          <FlatList
            data={blockedUsers}
            keyExtractor={(item) => item.uid}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.userRow}>
                <TouchableOpacity
                  style={styles.userInfo}
                  onPress={() => router.push({ pathname: "/user/[handle]", params: { handle: item.username } } as any)}
                >
                  <Avatar size={44} gradient={item.avatarColor} icon={item.avatarIcon} />
                  <View style={{ marginLeft: spacing.md, flex: 1 }}>
                    <Text style={styles.username}>@{item.username}</Text>
                    <Text style={styles.userSub}>Blocked</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.unblockBtn}
                  onPress={() => handleUnblock(item)}
                  testID={`unblock-${item.uid}`}
                >
                  <Text style={styles.unblockText}>Unblock</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: colors.onSurface,
    fontSize: 18,
    fontWeight: "700",
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    color: colors.onSurface,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  emptySub: {
    color: colors.onSurfaceMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  listContent: {
    padding: spacing.lg,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  username: {
    color: colors.onSurface,
    fontSize: 16,
    fontWeight: "600",
  },
  userSub: {
    color: colors.onSurfaceMuted,
    fontSize: 13,
    marginTop: 2,
  },
  unblockBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  unblockText: {
    color: colors.onSurface,
    fontSize: 13,
    fontWeight: "600",
  },
});
