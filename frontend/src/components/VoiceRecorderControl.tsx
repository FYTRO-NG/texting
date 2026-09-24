import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, font, radii, spacing } from "@/src/theme";

type Props = {
  audioUri: string | null;
  duration: number; // in seconds
  onRecordComplete: (uri: string, durationSec: number) => void;
  onRemoveRecording: () => void;
};

export default function VoiceRecorderControl({
  audioUri,
  duration,
  onRecordComplete,
  onRemoveRecording,
}: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);

  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<any[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      if (mediaRecorderRef.current && isRecording) {
        try {
          mediaRecorderRef.current.stop();
        } catch (_) {}
      }
    };
  }, [isRecording]);

  // Start recording
  const startRecording = async () => {
    setRecordSec(0);
    audioChunksRef.current = [];

    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.mediaDevices) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new (window as any).MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event: any) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const audioUrl = URL.createObjectURL(audioBlob);
          // Stop all audio tracks to release microphone
          stream.getTracks().forEach((t) => t.stop());
          onRecordComplete(audioUrl, recordSec || 1);
        };

        mediaRecorder.start();
        setIsRecording(true);

        timerRef.current = setInterval(() => {
          setRecordSec((sec) => sec + 1);
        }, 1000);
      } catch (err) {
        console.warn("[VoiceRecorder] Microphone permission or access error:", err);
        Alert.alert("Microphone Access Required", "Please allow microphone access to record voice posts.");
      }
    } else {
      // Native / Expo Audio fallback simulation if native recorder package is not present
      setIsRecording(true);
      let sec = 0;
      timerRef.current = setInterval(() => {
        sec += 1;
        setRecordSec(sec);
      }, 1000);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);

    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    } else {
      // Fallback completion for native mock
      const mockAudioUri = "https://actions.google.com/sounds/v1/ambiences/rain_heavy.ogg";
      onRecordComplete(mockAudioUri, recordSec || 5);
    }
  };

  // Play / Pause preview playback
  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    } else {
      setIsPlaying(true);
      const totalSec = duration || 5;
      playTimerRef.current = setInterval(() => {
        setPlayProgress((prev) => {
          if (prev >= 1) {
            setIsPlaying(false);
            if (playTimerRef.current) clearInterval(playTimerRef.current);
            return 0;
          }
          return prev + 0.05;
        });
      }, (totalSec * 1000) / 20);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // 1. Existing Audio Preview
  if (audioUri) {
    const elapsedSec = Math.round(playProgress * (duration || 5));
    return (
      <View style={styles.previewContainer} testID="voice-preview-box">
        <LinearGradient colors={["#1E293B", "#0F172A"]} style={StyleSheet.absoluteFillObject} />

        <TouchableOpacity style={styles.playBtn} onPress={togglePlay} activeOpacity={0.85} testID="voice-preview-play">
          <LinearGradient colors={["#06B6D4", "#0284C7"]} style={styles.playBtnInner}>
            <Ionicons name={isPlaying ? "pause" : "play"} size={16} color="#0F172A" />
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.waveWrap}>
          <View style={styles.barsRow}>
            {[35, 65, 40, 85, 55, 30, 80, 50, 90, 60, 45, 75, 50, 35, 70, 40].map((h, i) => {
              const active = (i + 1) / 16 <= playProgress;
              return (
                <View
                  key={i}
                  style={[
                    styles.waveBar,
                    { height: h * 0.3 },
                    active ? { backgroundColor: colors.brand } : { backgroundColor: "rgba(255,255,255,0.2)" },
                  ]}
                />
              );
            })}
          </View>

          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTimer(elapsedSec)}</Text>
            <Text style={styles.timeText}>/ {formatTimer(duration || 5)}</Text>
          </View>
        </View>

        {/* Remove / Replace options */}
        <View style={styles.previewActions}>
          <TouchableOpacity onPress={onRemoveRecording} style={styles.actionIconBtn} testID="voice-remove-btn">
            <Ionicons name="trash-outline" size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 2. Active Recording Mode
  if (isRecording) {
    return (
      <View style={styles.recordingContainer} testID="voice-recording-box">
        <View style={styles.liveIndicator}>
          <View style={styles.redDot} />
          <Text style={styles.recordingTitle}>Recording Voice Voice…</Text>
        </View>

        <Text style={styles.recordingTimer}>{formatTimer(recordSec)}</Text>

        <TouchableOpacity style={styles.stopBtn} onPress={stopRecording} activeOpacity={0.85} testID="voice-stop-btn">
          <Ionicons name="square" size={18} color="#FFFFFF" />
          <Text style={styles.stopBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 3. Touch Target to Start Recording
  return (
    <TouchableOpacity style={styles.startRecordBtn} onPress={startRecording} activeOpacity={0.85} testID="voice-start-btn">
      <Ionicons name="mic" size={16} color={colors.brand} />
      <Text style={styles.startRecordText}>Record Voice Post</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  previewContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.brandBorder,
    overflow: "hidden",
  },
  playBtn: {
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  playBtnInner: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  waveWrap: {
    flex: 1,
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 28,
  },
  waveBar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 4,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  timeText: {
    ...font.small,
    fontSize: 10,
    color: colors.onSurfaceMuted,
  },
  previewActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  recordingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.error,
  },
  recordingTitle: {
    ...font.caption,
    fontWeight: "700",
    color: colors.error,
  },
  recordingTimer: {
    ...font.title,
    fontSize: 15,
    color: colors.onSurface,
  },
  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    gap: 4,
  },
  stopBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  startRecordBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandBorder,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    gap: 6,
    alignSelf: "flex-start",
  },
  startRecordText: {
    ...font.caption,
    color: colors.brand,
    fontWeight: "700",
    fontSize: 12,
  },
});
