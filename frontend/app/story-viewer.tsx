import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Avatar from "@/src/components/Avatar";
import { auth } from "@/src/firebase";
import {
  Story,
  subscribeToAuthorStories,
  storyRelativeTime,
  callRecordStoryView,
  callDeleteStory,
  markStoryViewedLocally,
} from "@/src/services/storyService";
import { colors, font, radii, spacing } from "@/src/theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const STORY_DURATION = 5000; // 5 seconds per story

export default function StoryViewer() {
  const router = useRouter();

  // Expo Router v6 doesn't expose useLocalSearchParams typed without expo-router
  // Use a fallback via URL params parsed from the route
  const [authorId, setAuthorId] = useState<string>("");
  const [stories, setStories] = useState<Story[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0); // 0→1 for current story
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(0);
  const pausedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  // ── Parse authorId from URL params ─────────────────────────────────────────
  useEffect(() => {
    // expo-router v6 passes params in the URL. Read from global location.
    try {
      const { useLocalSearchParams } = require("expo-router");
      // eslint-disable-next-line react-hooks/rules-of-hooks
      // We call this in an effect to avoid the conditional hook lint warning
      // but this component always mounts from router so params are stable
    } catch {
      // ignore
    }
  }, []);

  // Simpler approach: read params from expo-router at component top
  // (must use hook at top — see below)
  // ────────────────────────────────────────────────────────────────────────────

  // ── Subscribe to author stories ────────────────────────────────────────────
  useEffect(() => {
    if (!authorId) return;
    const unsub = subscribeToAuthorStories(authorId, (fetched) => {
      setStories(fetched);
      setLoading(false);
    });
    return unsub;
  }, [authorId]);

  // ── Progress timer ──────────────────────────────────────────────────────────
  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startTimer = () => {
    clearTimer();
    const tick = 50; // ms per tick
    const steps = STORY_DURATION / tick;
    progressRef.current = 0;

    intervalRef.current = setInterval(() => {
      if (pausedRef.current) return;
      progressRef.current += 1 / steps;
      if (progressRef.current >= 1) {
        progressRef.current = 1;
        setProgress(1);
        clearTimer();
        goNext();
      } else {
        setProgress(progressRef.current);
      }
    }, tick);
  };

  useEffect(() => {
    if (loading || stories.length === 0) return;
    progressRef.current = 0;
    setProgress(0);
    startTimer();

    // Record view for this story
    const story = stories[currentIndex];
    if (story && auth.currentUser) {
      const uid = auth.currentUser.uid;
      // Non-blocking — fire and forget
      callRecordStoryView(story.id).catch(console.warn);
      markStoryViewedLocally(uid, story.id).catch(console.warn);
    }

    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, loading, stories.length]);

  // ── Pause on app background ────────────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (
        appStateRef.current === "active" &&
        (nextState === "background" || nextState === "inactive")
      ) {
        pausedRef.current = true;
        setPaused(true);
      } else if (nextState === "active") {
        pausedRef.current = false;
        setPaused(false);
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return clearTimer;
  }, []);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      router.back();
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    } else {
      router.back();
    }
  };

  const handlePressIn = () => {
    pausedRef.current = true;
    setPaused(true);
  };

  const handlePressOut = () => {
    pausedRef.current = false;
    setPaused(false);
  };

  const handleDeleteStory = () => {
    const story = stories[currentIndex];
    if (!story) return;
    Alert.alert(
      "Delete Story",
      "Are you sure you want to delete this story?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await callDeleteStory(story.id);
              if (stories.length <= 1) {
                router.back();
              } else {
                goNext();
              }
            } catch {
              Alert.alert("Error", "Could not delete story. Please try again.");
            }
          },
        },
      ]
    );
  };

  // ── Empty / loading states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.root}>
        <Text style={styles.loadingText}>Loading story…</Text>
      </View>
    );
  }

  if (stories.length === 0) {
    return (
      <View style={styles.root}>
        <Text style={styles.loadingText}>Story expired or not found.</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.onSurface} />
        </TouchableOpacity>
      </View>
    );
  }

  const story = stories[currentIndex];
  const isOwner = auth.currentUser?.uid === story.authorId;

  return (
    <View style={styles.root}>
      {/* ── Story content ──────────────────────────────────────────────────── */}
      {story.type === "image" && story.mediaUrl ? (
        <Image
          source={{ uri: story.mediaUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
        />
      ) : (
        <LinearGradient
          colors={
            (story.backgroundColor
              ? [story.backgroundColor, "#0F172A"]
              : ["#1E293B", "#0F172A"]) as [string, string]
          }
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {/* Dark scrim on image stories */}
      {story.type === "image" && (
        <LinearGradient
          colors={["rgba(15,23,42,0.45)", "rgba(15,23,42,0.3)", "rgba(15,23,42,0.65)"]}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {/* Text overlay */}
      {story.content ? (
        <View style={styles.textOverlay} pointerEvents="none">
          <Text style={styles.storyText}>{story.content}</Text>
        </View>
      ) : null}

      {/* ── Tap zones ──────────────────────────────────────────────────────── */}
      {/* Press+hold to pause */}
      <View
        style={StyleSheet.absoluteFillObject}
        // @ts-ignore - onStartShouldSetResponder etc.
        onStartShouldSetResponder={() => true}
        onResponderGrant={handlePressIn}
        onResponderRelease={handlePressOut}
      />

      {/* Left tap */}
      <TouchableOpacity
        style={styles.tapLeft}
        onPress={goPrev}
        onLongPress={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      />
      {/* Right tap */}
      <TouchableOpacity
        style={styles.tapRight}
        onPress={goNext}
        onLongPress={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <SafeAreaView edges={["top"]} style={styles.header} pointerEvents="box-none">
        {/* Progress bars */}
        <View style={styles.progressRow} pointerEvents="none">
          {stories.map((_, i) => (
            <View key={i} style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width:
                      i < currentIndex
                        ? "100%"
                        : i === currentIndex
                        ? `${Math.round(progress * 100)}%`
                        : "0%",
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Author row */}
        <View style={styles.authorRow} pointerEvents="box-none">
          <Avatar
            size={36}
            gradient={
              (story.authorAvatarGradient as [string, string]) ?? [
                "#8B5CF6",
                "#06B6D4",
              ]
            }
            icon={story.authorAvatarIcon ?? "person"}
          />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={styles.authorName}>
              {story.authorDisplayName ?? story.authorUsername}
            </Text>
            <Text style={styles.authorTime}>
              {story.createdAt ? storyRelativeTime(story.createdAt) : ""}
            </Text>
          </View>

          {/* View count (owner only) */}
          {isOwner && (
            <View style={styles.viewCountWrap} pointerEvents="none">
              <Ionicons name="eye-outline" size={14} color={colors.onSurfaceMuted} />
              <Text style={styles.viewCount}>{story.viewCount}</Text>
            </View>
          )}

          {/* Delete (owner only) */}
          {isOwner && (
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={handleDeleteStory}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </TouchableOpacity>
          )}

          {/* Close */}
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ── Wrapper that reads params via expo-router hook ────────────────────────────

import { useLocalSearchParams } from "expo-router";

function StoryViewerWithParams() {
  const { authorId } = useLocalSearchParams<{ authorId: string }>();
  return <StoryViewerInner authorId={authorId ?? ""} />;
}

// Rename inner component so the outer wrapper is the default export
function StoryViewerInner({ authorId }: { authorId: string }) {
  const router = useRouter();

  const [stories, setStories] = useState<Story[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(0);
  const pausedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    if (!authorId) return;
    const unsub = subscribeToAuthorStories(authorId, (fetched) => {
      setStories(fetched);
      setLoading(false);
    });
    return unsub;
  }, [authorId]);

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const goNext = React.useCallback(() => {
    setCurrentIndex((i) => {
      if (i < stories.length - 1) return i + 1;
      router.back();
      return i;
    });
  }, [stories.length, router]);

  const startTimer = React.useCallback(() => {
    clearTimer();
    const tick = 50;
    const steps = STORY_DURATION / tick;
    progressRef.current = 0;
    setProgress(0);

    intervalRef.current = setInterval(() => {
      if (pausedRef.current) return;
      progressRef.current += 1 / steps;
      if (progressRef.current >= 1) {
        clearTimer();
        goNext();
      } else {
        setProgress(progressRef.current);
      }
    }, tick);
  }, [goNext]);

  useEffect(() => {
    if (loading || stories.length === 0) return;
    startTimer();

    const story = stories[currentIndex];
    if (story && auth.currentUser) {
      callRecordStoryView(story.id).catch(console.warn);
      markStoryViewedLocally(auth.currentUser.uid, story.id).catch(console.warn);
    }

    return clearTimer;
  }, [currentIndex, loading, stories.length]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        pausedRef.current = false;
      } else {
        pausedRef.current = true;
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => () => clearTimer(), []);

  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
    else router.back();
  };

  const handleDeleteStory = () => {
    const story = stories[currentIndex];
    if (!story) return;
    Alert.alert("Delete Story", "Are you sure you want to delete this story?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await callDeleteStory(story.id);
            if (stories.length <= 1) router.back();
            else goNext();
          } catch {
            Alert.alert("Error", "Could not delete story. Please try again.");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <Text style={styles.loadingText}>Loading story…</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.onSurface} />
        </TouchableOpacity>
      </View>
    );
  }

  if (stories.length === 0) {
    return (
      <View style={styles.root}>
        <Text style={styles.loadingText}>Story expired or not found.</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.onSurface} />
        </TouchableOpacity>
      </View>
    );
  }

  const story = stories[currentIndex];
  const isOwner = auth.currentUser?.uid === story.authorId;

  return (
    <View style={styles.root}>
      {story.type === "image" && story.mediaUrl ? (
        <Image
          source={{ uri: story.mediaUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
        />
      ) : (
        <LinearGradient
          colors={
            (story.backgroundColor
              ? [story.backgroundColor, "#0F172A"]
              : ["#1E293B", "#0F172A"]) as [string, string]
          }
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {story.type === "image" && (
        <LinearGradient
          colors={["rgba(15,23,42,0.5)", "rgba(15,23,42,0.2)", "rgba(15,23,42,0.7)"]}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {story.content ? (
        <View style={styles.textOverlay} pointerEvents="none">
          <Text style={styles.storyText}>{story.content}</Text>
        </View>
      ) : null}

      {/* Tap left */}
      <TouchableOpacity
        style={styles.tapLeft}
        onPress={goPrev}
        onLongPress={() => { pausedRef.current = true; }}
        onPressOut={() => { pausedRef.current = false; }}
        activeOpacity={1}
      />
      {/* Tap right */}
      <TouchableOpacity
        style={styles.tapRight}
        onPress={goNext}
        onLongPress={() => { pausedRef.current = true; }}
        onPressOut={() => { pausedRef.current = false; }}
        activeOpacity={1}
      />

      <SafeAreaView edges={["top"]} style={styles.header} pointerEvents="box-none">
        <View style={styles.progressRow} pointerEvents="none">
          {stories.map((_, i) => (
            <View key={i} style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width:
                      i < currentIndex
                        ? "100%"
                        : i === currentIndex
                        ? `${Math.min(100, Math.round(progress * 100))}%`
                        : "0%",
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.authorRow} pointerEvents="box-none">
          <Avatar
            size={36}
            gradient={(story.authorAvatarGradient as [string, string]) ?? ["#8B5CF6", "#06B6D4"]}
            icon={story.authorAvatarIcon ?? "person"}
          />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={styles.authorName}>
              {story.authorDisplayName ?? story.authorUsername}
            </Text>
            <Text style={styles.authorTime}>
              {story.createdAt ? storyRelativeTime(story.createdAt) : ""}
            </Text>
          </View>

          {isOwner && (
            <View style={styles.viewCountWrap} pointerEvents="none">
              <Ionicons name="eye-outline" size={14} color={colors.onSurfaceMuted} />
              <Text style={styles.viewCount}>{story.viewCount}</Text>
            </View>
          )}

          {isOwner && (
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={handleDeleteStory}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

export { StoryViewerWithParams as default };

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    ...font.body,
    color: colors.onSurfaceMuted,
  },
  closeBtn: {
    position: "absolute",
    top: 60,
    right: 20,
    padding: 8,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  progressRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: spacing.xs,
  },
  progressTrack: {
    flex: 1,
    height: 2.5,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  authorName: {
    ...font.title,
    fontSize: 14,
    color: "#FFFFFF",
  },
  authorTime: {
    ...font.small,
    color: "rgba(255,255,255,0.65)",
  },
  viewCountWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginRight: spacing.sm,
  },
  viewCount: {
    ...font.small,
    color: colors.onSurfaceMuted,
  },
  headerBtn: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  textOverlay: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    top: "40%",
    alignItems: "center",
  },
  storyText: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 34,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tapLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "40%",
  },
  tapRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "60%",
  },
});
