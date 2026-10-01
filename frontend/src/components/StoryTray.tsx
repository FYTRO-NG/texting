import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import Avatar from "@/src/components/Avatar";
import {
  StoryAuthorGroup,
  subscribeToActiveStories,
  subscribeToMyStories,
  Story,
  getViewedStoryIds,
} from "@/src/services/storyService";
import { colors, font, radii, spacing } from "@/src/theme";

type Props = {
  onOpenComposer: () => void;
};

export default function StoryTray({ onOpenComposer }: Props) {
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  const [myStories, setMyStories] = useState<Story[]>([]);
  const [groups, setGroups] = useState<StoryAuthorGroup[]>([]);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const viewedIdsRef = useRef(viewedIds);

  // Load viewed IDs cache on mount
  useEffect(() => {
    if (!uid) return;
    getViewedStoryIds(uid).then((ids) => {
      setViewedIds(ids);
      viewedIdsRef.current = ids;
    });
  }, [uid]);

  // Subscribe to current user's active stories
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToMyStories(uid, setMyStories);
    return unsub;
  }, [uid]);

  // Subscribe to all active stories (1 listener)
  useEffect(() => {
    const unsub = subscribeToActiveStories((allGroups) => {
      // Exclude current user — they appear as "Your Story" first
      const others = allGroups.filter((g) => g.authorId !== uid);
      setGroups(others);
    }, viewedIdsRef.current);
    return unsub;
  }, [uid]);

  const hasMyActiveStory = myStories.length > 0;
  const myHasUnviewed = false; // "Your Story" is always your own — no unviewed ring needed

  const openStory = (authorId: string) => {
    router.push({
      pathname: "/story-viewer",
      params: { authorId },
    } as any);
  };

  // Build tray items: [Your Story] + [other authors...]
  const trayItems: Array<{ type: "mine" } | StoryAuthorGroup> = [
    { type: "mine" },
    ...groups,
  ];

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        data={trayItems}
        keyExtractor={(item, i) =>
          "type" in item && item.type === "mine" ? "my-story" : (item as StoryAuthorGroup).authorId
        }
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          // ── Your Story bubble ──────────────────────────────────────
          if ("type" in item && item.type === "mine") {
            const user = auth.currentUser;
            return (
              <TouchableOpacity
                style={styles.bubbleWrap}
                onPress={() =>
                  hasMyActiveStory ? openStory(uid!) : onOpenComposer()
                }
                activeOpacity={0.8}
                testID="story-my-bubble"
              >
                <View style={styles.avatarOuter}>
                  {hasMyActiveStory ? (
                    /* Active gradient ring */
                    <LinearGradient
                      colors={["#06B6D4", "#8B5CF6"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.ringGradient}
                    >
                      <View style={styles.ringInner}>
                        <Avatar
                          size={52}
                          gradient={["#8B5CF6", "#06B6D4"]}
                          icon="person"
                        />
                      </View>
                    </LinearGradient>
                  ) : (
                    /* No active story — plain avatar + add icon */
                    <View style={styles.noRing}>
                      <Avatar
                        size={52}
                        gradient={["#8B5CF6", "#06B6D4"]}
                        icon="person"
                      />
                      <View style={styles.addBadge}>
                        <Ionicons name="add" size={12} color="#0F172A" />
                      </View>
                    </View>
                  )}
                </View>
                <Text style={styles.label} numberOfLines={1}>
                  Your Story
                </Text>
              </TouchableOpacity>
            );
          }

          // ── Other user's Story bubble ──────────────────────────────
          const group = item as StoryAuthorGroup;
          return (
            <TouchableOpacity
              style={styles.bubbleWrap}
              onPress={() => openStory(group.authorId)}
              activeOpacity={0.8}
              testID={`story-bubble-${group.authorId}`}
            >
              <View style={styles.avatarOuter}>
                {group.hasUnviewed ? (
                  /* Unviewed — brand gradient ring */
                  <LinearGradient
                    colors={["#06B6D4", "#8B5CF6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.ringGradient}
                  >
                    <View style={styles.ringInner}>
                      <Avatar
                        size={52}
                        gradient={
                          (group.authorAvatarGradient as [string, string]) ?? [
                            "#8B5CF6",
                            "#06B6D4",
                          ]
                        }
                        icon={group.authorAvatarIcon ?? "person"}
                      />
                    </View>
                  </LinearGradient>
                ) : (
                  /* Viewed — muted gray ring */
                  <View style={styles.ringMuted}>
                    <View style={styles.ringInner}>
                      <Avatar
                        size={52}
                        gradient={
                          (group.authorAvatarGradient as [string, string]) ?? [
                            "#8B5CF6",
                            "#06B6D4",
                          ]
                        }
                        icon={group.authorAvatarIcon ?? "person"}
                      />
                    </View>
                  </View>
                )}
              </View>
              <Text style={styles.label} numberOfLines={1}>
                {group.authorDisplayName ?? group.authorUsername}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const RING_SIZE = 60;
const AVATAR_SIZE = 52;
const GAP = (RING_SIZE - AVATAR_SIZE) / 2;

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.glassBorder,
    paddingVertical: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  bubbleWrap: {
    alignItems: "center",
    width: 68,
    gap: 4,
  },
  avatarOuter: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ringGradient: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  ringMuted: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  ringInner: {
    width: AVATAR_SIZE + 4,
    height: AVATAR_SIZE + 4,
    borderRadius: (AVATAR_SIZE + 4) / 2,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  noRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  addBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  label: {
    ...font.small,
    fontSize: 11,
    color: colors.onSurfaceMuted,
    textAlign: "center",
    maxWidth: 64,
  },
});
