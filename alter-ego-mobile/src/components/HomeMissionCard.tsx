/**
 * Home Mission Card — Premium design for Home screen. Backend-connected (same onComplete/onPress).
 * Left edge gradient by section + difficulty, section chip, ★ xp / 🌿 pf, streak or difficulty pill or checkmark.
 */

import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

export type HomeMissionType = "core" | "interest" | "personal" | "recovery";
export type HomeMissionDifficulty = "Easy" | "Medium" | "Hard";
export type HomeMissionStatus = "pending" | "complete" | "expired";

const SURFACE_CARD = "#111623";
const SURFACE_BORDER = "#1A1F30";
const TEXT_PRIMARY = "#E5E7EB";
const TEXT_DIM = "#4B5563";
const VIOLET = "#8B5CF6";
const VIOLET_GLOW = "#A78BFA";
const EMBER = "#F97316";
const STAGGER_DELAY = 40;
const CARD_APPEAR_MS = 250;
const PRESS_SCALE = 0.98;

const LEFT_EDGE_GRADIENTS: Record<
  HomeMissionType,
  Record<HomeMissionDifficulty, readonly [string, string]>
> = {
  core: {
    Easy: ["#F87171", "#DC2626"],
    Medium: ["#EF4444", "#B91C1C"],
    Hard: ["#DC2626", "#7F1D1D"],
  },
  interest: {
    Easy: ["#A78BFA", "#7C3AED"],
    Medium: ["#8B5CF6", "#5B21B6"],
    Hard: ["#6D28D9", "#3B0764"],
  },
  personal: {
    Easy: ["#6B7280", "#374151"],
    Medium: ["#4B5563", "#1F2937"],
    Hard: ["#374151", "#111827"],
  },
  recovery: {
    Easy: ["#F87171", "#DC2626"],
    Medium: ["#EF4444", "#B91C1C"],
    Hard: ["#DC2626", "#7F1D1D"],
  },
};

const CHIP_STYLES: Record<
  HomeMissionType,
  { bg: string; color: string; border: string }
> = {
  core: { bg: "rgba(239,68,68,0.10)", color: "#F87171", border: "rgba(239,68,68,0.18)" },
  interest: { bg: "rgba(139,92,246,0.10)", color: "#A78BFA", border: "rgba(139,92,246,0.2)" },
  personal: { bg: "rgba(75,85,99,0.10)", color: "#9CA3AF", border: "rgba(75,85,99,0.2)" },
  recovery: { bg: "rgba(239,68,68,0.10)", color: "#F87171", border: "rgba(239,68,68,0.18)" },
};

export interface HomeMissionCardProps {
  title: string;
  category: string;
  difficulty: HomeMissionDifficulty;
  xpValue: number;
  petFoodValue: number;
  status: HomeMissionStatus;
  onComplete: () => void;
  missionType: HomeMissionType;
  interestName?: string;
  onPress?: () => void;
  appearIndex?: number;
  missionStreak?: number;
}

export function HomeMissionCard({
  title,
  category,
  difficulty,
  xpValue,
  petFoodValue,
  status,
  onComplete,
  missionType,
  interestName,
  onPress,
  appearIndex,
  missionStreak = 0,
}: HomeMissionCardProps) {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const appearOpacity = useSharedValue(typeof appearIndex === "number" ? 0 : 1);
  const appearTranslateY = useSharedValue(typeof appearIndex === "number" ? 8 : 0);
  const completedOpacity = useSharedValue(status === "complete" ? 0.4 : 1);
  const cardWidth = useSharedValue(300);
  const SWIPE_THRESHOLD = 0.4;
  const MAX_SWIPE = 200;

  useEffect(() => {
    completedOpacity.value = status === "complete" ? 0.4 : 1;
  }, [status]);

  useEffect(() => {
    if (typeof appearIndex !== "number") return;
    const delay = 300 + appearIndex * STAGGER_DELAY;
    const t = setTimeout(() => {
      appearOpacity.value = withTiming(1, { duration: CARD_APPEAR_MS, easing: Easing.out(Easing.quad) });
      appearTranslateY.value = withTiming(0, { duration: CARD_APPEAR_MS, easing: Easing.out(Easing.quad) });
    }, delay);
    return () => clearTimeout(t);
  }, [appearIndex]);

  const panGesture = Gesture.Pan()
    .enabled(status === "pending")
    .activeOffsetX(10)
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      if (e.translationX < 0) return;
      translateX.value = Math.min(e.translationX, MAX_SWIPE);
    })
    .onEnd(() => {
      const threshold = cardWidth.value * SWIPE_THRESHOLD;
      if (translateX.value >= threshold) {
        runOnJS(onComplete)();
        translateX.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) });
      } else {
        translateX.value = withSpring(0, { damping: 15, stiffness: 200 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    opacity: appearOpacity.value * completedOpacity.value,
    transform: [
      { translateY: appearTranslateY.value },
      { scale: scale.value },
      { translateX: translateX.value },
    ],
  }));

  const doneOverlayStyle = useAnimatedStyle(() => ({
    opacity: Math.min(translateX.value / 60, 1),
  }));

  const onPressIn = () => {
    if (status !== "pending") return;
    scale.value = withTiming(PRESS_SCALE, { duration: 80, easing: Easing.out(Easing.quad) });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const isComplete = status === "complete";
  const edgeColors = LEFT_EDGE_GRADIENTS[missionType][difficulty];
  const chipStyle = CHIP_STYLES[missionType];
  const sectionLabel = missionType === "interest" && interestName ? interestName : missionType === "core" ? "Core" : missionType === "personal" ? "Personal" : "Recovery";

  return (
    <GestureDetector gesture={panGesture}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        style={styles.outer}
        onLayout={(e) => {
          cardWidth.value = e.nativeEvent.layout.width;
        }}
      >
        <Animated.View style={[styles.doneOverlayBg, doneOverlayStyle]} pointerEvents="none">
          <Text style={styles.doneText}>Done</Text>
        </Animated.View>
        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.edgeWrap}>
            <LinearGradient
              colors={edgeColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.leftEdge}
            />
          </View>
          <View style={styles.body}>
            <Text
              style={[
                styles.title,
                isComplete && styles.titleComplete,
              ]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
            <View style={styles.metaRow}>
              <View style={[styles.sectionChip, { backgroundColor: chipStyle.bg, borderColor: chipStyle.border }]}>
                <Text style={[styles.sectionChipText, { color: chipStyle.color }]}>{sectionLabel}</Text>
              </View>
              <Text style={styles.xpMeta}>★ {xpValue}</Text>
              <Text style={styles.pfMeta}>🌿 {petFoodValue}</Text>
            </View>
          </View>
          <View style={styles.rightBlock}>
            {isComplete ? (
              <Ionicons name="checkmark-circle" size={16} color="#6D28D9" />
            ) : (
              <>
                {missionStreak >= 2 && (missionType === "core" || missionType === "interest") && (
                  <View style={styles.streakPill}>
                    <Text style={styles.streakEmoji}>🔥</Text>
                    <Text style={styles.streakNum}>{missionStreak}</Text>
                  </View>
                )}
                <View style={styles.difficultyPill}>
                  <Text style={styles.difficultyText}>{difficulty}</Text>
                </View>
              </>
            )}
          </View>
        </Animated.View>
      </Pressable>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  outer: { position: "relative", marginBottom: 7 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE_CARD,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 13,
    position: "relative",
    overflow: "hidden",
  },
  edgeWrap: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    overflow: "hidden",
  },
  leftEdge: { flex: 1, width: 3 },
  body: { flex: 1, minWidth: 0, paddingLeft: 13 },
  title: {
    fontSize: 13,
    fontWeight: "500",
    color: TEXT_PRIMARY,
    marginBottom: 5,
    letterSpacing: -0.1,
  },
  titleComplete: {
    textDecorationLine: "line-through",
    color: TEXT_DIM,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  sectionChip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sectionChipText: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  xpMeta: { fontSize: 9, color: TEXT_DIM },
  pfMeta: { fontSize: 9, color: TEXT_DIM },
  rightBlock: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
    flexShrink: 0,
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(249,115,22,0.09)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.18)",
    borderRadius: 7,
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  streakEmoji: { fontSize: 10 },
  streakNum: { fontSize: 10, fontWeight: "700", color: EMBER },
  difficultyPill: {
    backgroundColor: "rgba(139,92,246,0.09)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.18)",
    borderRadius: 7,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  difficultyText: { fontSize: 9, fontWeight: "600", color: VIOLET },
  doneOverlayBg: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    paddingLeft: 16,
    backgroundColor: "rgba(139,92,246,0.08)",
    borderRadius: 14,
  },
  doneText: { fontSize: 14, fontWeight: "600", color: VIOLET },
});
