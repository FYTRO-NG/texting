import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Avatar from "@/src/components/Avatar";
import { ChatThread } from "@/src/mockData";
import { colors, font, radii, spacing } from "@/src/theme";
import { subscribeToChatThreads } from "@/src/services/chatService";
import { auth } from "@/src/firebase";

const TABS = ["All", "Unread", "Requests"];

export default function Chats() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState("");
  const [chatList, setChatList] = useState<ChatThread[]>([]);

  useEffect(() => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) return;

    const unsubscribe = subscribeToChatThreads(currentUserId, (liveThreads) => {
      setChatList(liveThreads);
    });
    return () => unsubscribe();
  }, []);


  return (
    <View style={styles.container} testID="chats-screen">
      <LinearGradient colors={["#0F172A", "#0B1220"]} style={StyleSheet.absoluteFillObject} />
      <View style={[styles.blob, { top: -80, right: -60 }]} />

      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Anonymous chats</Text>
            <View style={styles.subRow}>
              <Ionicons name="lock-closed" size={11} color={colors.success} />
              <Text style={styles.subText}>End-to-end · nicknames only</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.newBtn} testID="chats-new-btn">
            <LinearGradient
              colors={["#06B6D4", "#0284C7"]}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name="create-outline" size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.onSurfaceMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search anonymous chats"
            placeholderTextColor={colors.onSurfaceDim}
            style={styles.searchInput}
            testID="chats-search-input"
          />
        </View>

        <FlatList
          horizontal
          data={TABS}
          keyExtractor={(t) => t}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
          renderItem={({ item, index }) => {
            const active = index === tab;
            return (
              <TouchableOpacity
                onPress={() => setTab(index)}
                style={[styles.tabChip, active && styles.tabChipActive]}
                testID={`chats-tab-${index}`}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{item}</Text>
                {index === 1 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>4</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>

      <FlatList
        data={chatList}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 140 + insets.bottom }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.chatRow}
            onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id, name: item.nickname, targetUserId: item.otherUserId } } as any)}
            activeOpacity={0.85}
            testID={`chat-row-${item.id}`}
          >
            <View style={styles.avatarWrap}>
              <Avatar size={54} gradient={item.avatarColor} icon={item.avatarIcon} />
              {item.online && <View style={styles.onlineDot} />}
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <View style={styles.chatTop}>
                <Text style={styles.name} numberOfLines={1}>{item.nickname}</Text>
                <Text style={styles.time}>{item.time}</Text>
              </View>
              <View style={styles.chatBot}>
                <Text
                  style={[styles.snippet, item.unread > 0 && { color: colors.onSurface, fontWeight: "600" }]}
                  numberOfLines={1}
                >
                  {item.lastMessage}
                </Text>
                {item.unread > 0 && (
                  <View style={styles.unread}>
                    <Text style={styles.unreadText}>{item.unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  blob: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: "rgba(6,182,212,0.10)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: { ...font.h1, fontSize: 26 },
  subRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  subText: { ...font.small, marginLeft: 4, color: colors.success, fontWeight: "600" },
  newBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  searchWrap: {
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    height: 46,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: { flex: 1, marginLeft: 10, color: colors.onSurface, fontSize: 14 },
  tabsRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 8,
  },
  tabChip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.05)",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    flexShrink: 0,
  },
  tabChipActive: { backgroundColor: colors.brandSoft, borderColor: colors.brandBorder },
  tabText: { ...font.caption, fontWeight: "600" },
  tabTextActive: { color: colors.brand },
  badge: {
    marginLeft: 6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#0F172A", fontSize: 10, fontWeight: "800" },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  avatarWrap: { position: "relative" },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2.5,
    borderColor: colors.surface,
  },
  chatTop: { flexDirection: "row", justifyContent: "space-between" },
  name: { ...font.title, fontSize: 15, flex: 1 },
  time: { ...font.small, marginLeft: 8 },
  chatBot: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  snippet: { flex: 1, ...font.caption, color: colors.onSurfaceMuted },
  unread: {
    marginLeft: 8,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: { color: "#0F172A", fontSize: 11, fontWeight: "800" },
});
