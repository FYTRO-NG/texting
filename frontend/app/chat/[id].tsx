import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Avatar from "@/src/components/Avatar";
import { AVATAR_GRADIENTS } from "@/src/mockData";
import { colors, font, radii, spacing } from "@/src/theme";
import { subscribeToMessages, sendMessageInFirestore, MessageItem } from "@/src/services/chatService";
import { auth } from "@/src/firebase";

export default function Conversation() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const nickname = (name as string) || "ShadowFox_42";
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const currentUserId = auth.currentUser?.uid || "current-user";

  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribeToMessages(id as string, currentUserId, (liveMsgs) => {
      if (liveMsgs.length > 0) {
        setMessages(liveMsgs);
      }
    });
    return () => unsubscribe();
  }, [id, currentUserId]);

  const send = async () => {
    if (!text.trim()) return;
    const msgText = text.trim();
    setText("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    if (id) {
      await sendMessageInFirestore(id as string, currentUserId, msgText);
    } else {
      setMessages((prev) => [
        ...prev,
        { id: `m${Date.now()}`, fromMe: true, text: msgText, time: "now" },
      ]);
    }
  };

  return (
    <View style={styles.container} testID="conversation-screen">
      <LinearGradient colors={["#0F172A", "#0B1220"]} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="chat-back">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Avatar size={36} gradient={AVATAR_GRADIENTS[0]} icon="flash" />
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.headerName}>{nickname}</Text>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>online · anonymous</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.iconBtn} testID="chat-menu">
            <Ionicons name="ellipsis-vertical" size={18} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.md }}
          renderItem={({ item }) => (
            <View style={[styles.msgRow, item.fromMe ? styles.msgMine : styles.msgTheirs]}>
              {item.fromMe ? (
                <LinearGradient
                  colors={["#06B6D4", "#0284C7"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.bubbleMineBg}
                />
              ) : (
                <View style={styles.bubbleTheirsBg} />
              )}
              <View style={styles.bubbleInner}>
                <Text style={[styles.bubbleText, item.fromMe && { color: "#0F172A" }]}>{item.text}</Text>
                <Text style={[styles.bubbleTime, item.fromMe && { color: "rgba(15,23,42,0.6)" }]}>{item.time}</Text>
              </View>
            </View>
          )}
          ListFooterComponent={
            <View style={styles.typingWrap}>
              <View style={styles.typingBubble}>
                <View style={styles.typingDot} />
                <View style={[styles.typingDot, { opacity: 0.6 }]} />
                <View style={[styles.typingDot, { opacity: 0.3 }]} />
              </View>
              <Text style={styles.typingText}>{nickname} is typing…</Text>
            </View>
          }
        />

        <View style={[styles.inputRow, { paddingBottom: 10 + insets.bottom }]}>
          <TouchableOpacity style={styles.attachBtn} testID="chat-attach">
            <Ionicons name="add-circle" size={30} color={colors.brand} />
          </TouchableOpacity>
          <View style={styles.inputWrap}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Send anonymously…"
              placeholderTextColor={colors.onSurfaceDim}
              style={styles.input}
              multiline
              testID="chat-input"
            />
            <TouchableOpacity style={styles.iconInside} testID="chat-emoji">
              <Ionicons name="happy-outline" size={20} color={colors.onSurfaceMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconInside} testID="chat-mic">
              <Ionicons name="mic-outline" size={20} color={colors.onSurfaceMuted} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={send} activeOpacity={0.85} style={styles.sendBtn} testID="chat-send">
            <LinearGradient
              colors={["#06B6D4", "#0284C7"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name="send" size={18} color="#0F172A" />
          </TouchableOpacity>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 12 },
  headerName: { ...font.title, fontSize: 15 },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 5,
  },
  statusText: { ...font.small, color: colors.success, fontWeight: "600" },
  msgRow: {
    marginBottom: spacing.md,
    maxWidth: "78%",
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  msgMine: { alignSelf: "flex-end", borderBottomRightRadius: 6 },
  msgTheirs: { alignSelf: "flex-start", borderBottomLeftRadius: 6 },
  bubbleMineBg: { ...StyleSheet.absoluteFillObject },
  bubbleTheirsBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  bubbleInner: { padding: 12, paddingHorizontal: 14 },
  bubbleText: { color: colors.onSurface, fontSize: 15, lineHeight: 21 },
  bubbleTime: { ...font.small, marginTop: 4, alignSelf: "flex-end", color: colors.onSurfaceDim },
  typingWrap: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    padding: 10,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
  },
  typingText: { ...font.small, marginLeft: 10 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  attachBtn: { paddingBottom: 6, marginRight: 6 },
  inputWrap: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    color: colors.onSurface,
    fontSize: 15,
    paddingTop: 6,
    paddingBottom: 6,
    lineHeight: 20,
    maxHeight: 100,
  },
  iconInside: { padding: 6 },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
