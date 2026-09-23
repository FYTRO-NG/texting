import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, usePathname } from "expo-router";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { colors, font, radii, spacing } from "@/src/theme";

const NAV_ITEMS = [
  { label: "Home", route: "/(tabs)", icon: "home-outline", activeIcon: "home" },
  { label: "Explore", route: "/(tabs)/explore", icon: "compass-outline", activeIcon: "compass" },
  { label: "Communities", route: "/communities", icon: "people-outline", activeIcon: "people" },
  { label: "Chats", route: "/(tabs)/chats", icon: "chatbubbles-outline", activeIcon: "chatbubbles" },
  { label: "Notifications", route: "/notifications", icon: "notifications-outline", activeIcon: "notifications" },
  { label: "Profile", route: "/(tabs)/profile", icon: "person-outline", activeIcon: "person" },
  { label: "Settings", route: "/settings", icon: "settings-outline", activeIcon: "settings" },
];

const TRENDING_HASHTAGS = [
  { tag: "#AIPhilosophy", count: "14.2k echoes" },
  { tag: "#LateNightThoughts", count: "9.8k echoes" },
  { tag: "#TechVent", count: "7.4k echoes" },
  { tag: "#Mindfulness", count: "5.1k echoes" },
  { tag: "#AnonymousConfessions", count: "12.0k echoes" },
];

export function DesktopShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const pathname = usePathname();
  const isDesktop = width >= 1024;

  if (!isDesktop) {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

  return (
    <View style={styles.outerContainer}>
      {/* Left Desktop Navigation Sidebar */}
      <View style={styles.leftSidebar}>
        <View style={styles.logoRow}>
          <LinearGradient
            colors={["#06B6D4", "#0284C7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoBadge}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color="#0F172A" />
          </LinearGradient>
          <Text style={styles.logoTitle}>Private Voices</Text>
        </View>

        <View style={styles.navGroup}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.route || (item.route === "/(tabs)" && pathname === "/");
            return (
              <TouchableOpacity
                key={item.label}
                style={[styles.navItem, isActive && styles.navItemActive]}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={(isActive ? item.activeIcon : item.icon) as any}
                  size={22}
                  color={isActive ? colors.brand : colors.onSurfaceSecondary}
                />
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push("/(tabs)/create")}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={["#06B6D4", "#0284C7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.createBtnInner}
          >
            <Ionicons name="add" size={22} color="#0F172A" />
            <Text style={styles.createBtnText}>New Echo</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Main Center Content Feed */}
      <View style={styles.centerContent}>
        {children}
      </View>

      {/* Right Desktop Widget Panel */}
      <View style={styles.rightSidebar}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: spacing.xl }}>
          <View style={styles.widgetCard}>
            <View style={styles.widgetHeader}>
              <Ionicons name="trending-up" size={18} color={colors.brand} />
              <Text style={styles.widgetTitle}>Trending Hashtags</Text>
            </View>
            {TRENDING_HASHTAGS.map((item) => (
              <TouchableOpacity key={item.tag} style={styles.hashtagRow} activeOpacity={0.7}>
                <Text style={styles.hashtagText}>{item.tag}</Text>
                <Text style={styles.hashtagCount}>{item.count}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.widgetCard}>
            <View style={styles.widgetHeader}>
              <Ionicons name="shield-checkmark" size={18} color={colors.success} />
              <Text style={styles.widgetTitle}>Privacy Standard</Text>
            </View>
            <Text style={styles.privacyDesc}>
              Private Voices is designed for privacy-first expression. Whispers are anonymous and public posts use pseudonymous handles while maintaining platform safety standards.
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#0F172A",
    justifyContent: "center",
  },
  leftSidebar: {
    width: 260,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    justifyContent: "space-between",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xl * 1.5,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  logoTitle: {
    fontFamily: font.family,
    fontSize: 20,
    fontWeight: "700",
    color: colors.onSurface,
  },
  navGroup: {
    gap: spacing.xs,
    flex: 1,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    gap: spacing.md,
  },
  navItemActive: {
    backgroundColor: "rgba(6,182,212,0.12)",
  },
  navLabel: {
    fontFamily: font.family,
    fontSize: 16,
    fontWeight: "500",
    color: colors.onSurfaceSecondary,
  },
  navLabelActive: {
    color: colors.brand,
    fontWeight: "700",
  },
  createBtn: {
    marginTop: spacing.xl,
  },
  createBtnInner: {
    height: 48,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  createBtnText: {
    fontFamily: font.family,
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  centerContent: {
    width: 660,
    maxWidth: 660,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.06)",
  },
  rightSidebar: {
    width: 320,
    paddingHorizontal: spacing.lg,
  },
  widgetCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: spacing.lg,
  },
  widgetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  widgetTitle: {
    fontFamily: font.family,
    fontSize: 15,
    fontWeight: "700",
    color: colors.onSurface,
  },
  hashtagRow: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  hashtagText: {
    fontFamily: font.family,
    fontSize: 14,
    fontWeight: "600",
    color: colors.brand,
  },
  hashtagCount: {
    fontFamily: font.family,
    fontSize: 12,
    color: colors.onSurfaceDim,
    marginTop: 2,
  },
  privacyDesc: {
    fontFamily: font.family,
    fontSize: 13,
    lineHeight: 18,
    color: colors.onSurfaceSecondary,
  },
});
