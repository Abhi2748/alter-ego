/**
 * Mission Card §2.2 — 3-type variant system. All states: default, pressed, complete, expired, swipe-to-complete.
 */

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { COLORS, SPACING, RADIUS, SHADOWS, ANIMATIONS } from "../constants/theme";
import { DifficultyChip } from "./DifficultyChip";

export type MissionType = "core" | "interest" | "personal" | "recovery" | "resistance";
export type MissionDifficulty = "Easy" | "Medium" | "Hard";
export type MissionStatus = "pending" | "complete" | "expired";

const LEFT_EDGE_COLOR: Record<MissionType, string | null> = {
  core: COLORS.danger,
  interest: COLORS.violet,
  personal: null,
  recovery: COLORS.danger,
};

const TYPE_CHIP_STYLES: Record<
  MissionType,
  { text: string; bg: string; border: string; label: string }
> = {
  core: {
    text: "#FCA5A5",
    bg: "rgba(127,29,29,0.15)",
    border: COLORS.danger,
    label: "Core",
  },
  interest: {
    text: "#A78BFA",
    bg: "rgba(139,92,246,0.1)",
    border: COLORS.violet,
    label: "Fitness",
  },
  personal: {
    text: COLORS.muted,
    bg: "rgba(107,114,128,0.1)",
    border: "#374151",
    label: "Personal",
  },
  recovery: {
    text: "#FCA5A5",
    bg: "rgba(127,29,29,0.2)",
    border: COLORS.danger,
    label: "Recovery",
  },
};

export type MissionCardProps = {
  title: string;
  category: string;
  difficulty: MissionDifficulty;
  xpValue: number;
  petFoodValue: number;
  status: MissionStatus;
  onComplete: () => void;
  missionType: MissionType;
  /** For interest type, the display name e.g. "Fitness". */
  interestName?: string;
  /** When provided, tap opens this (e.g. Journal Editor); swipe to complete is disabled. */
  onPress?: () => void;
  /** Optional index for stagger appear animation (opacity + translateY). */
  appearIndex?: number;
  /** Per-mission streak count. 0 = no badge. Badge shown only for Core/Interest when >= 2. */
  missionStreak?: number;
};

function TypeChip({
  missionType,
  interestName,
}: {
  missionType: MissionType;
  interestName?: string;
}) {
  const s = TYPE_CHIP_STYLES[missionType];
  const label = missionType === "interest" && interestName ? interestName : s.label;
  return (
    <View style={[styles.typeChip, { backgroundColor: s.bg, borderColor: s.border }]}>
      <Text style={[styles.typeChipLabel, { color: s.text }]}>{label}</Text>
    </View>
  );
}

export default function MissionCard({
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
}: MissionCardProps) {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const pressed = useSharedValue(0);
  const appearOpacity = useSharedValue(typeof appearIndex === "number" ? 0 : 1);
  const appearTranslateY = useSharedValue(typeof appearIndex === "number" ? 12 : 0);
  const completedOpacity = useSharedValue(status === "complete" ? 0.6 : 1);
  const SWIPE_THRESHOLD = 0.4;
  const cardWidth = useSharedValue(300);
  const MAX_SWIPE = 200;

  React.useEffect(() => {
    completedOpacity.value = status === "complete" ? 0.6 : 1;
  }, [status]);

  React.useEffect(() => {
    if (typeof appearIndex !== "number") return;
    const delay = Math.min(appearIndex * ANIMATIONS.staggerDelay, ANIMATIONS.staggerMax);
    const t = setTimeout(() => {
      appearOpacity.value = withTiming(1, {
        duration: ANIMATIONS.cardAppear,
        easing: Easing.out(Easing.ease),
      });
      appearTranslateY.value = withTiming(0, {
        duration: ANIMATIONS.cardAppear,
        easing: Easing.out(Easing.ease),
      });
    }, delay);
    return () => clearTimeout(t);
  }, [appearIndex]);

  const leftEdgeColor =
    status === "complete"
      ? COLORS.violet
      : status === "expired"
        ? COLORS.danger
        : LEFT_EDGE_COLOR[missionType];

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
        translateX.value = withTiming(0, {
          duration: ANIMATIONS.missionSwipe,
          easing: Easing.out(Easing.ease),
        });
      } else {
        translateX.value = withSpring(0, { damping: 15, stiffness: 200 });
      }
    });

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: pressed.value === 1 ? "#1A2030" : COLORS.surface,
    borderColor: pressed.value === 1 ? "rgba(139,92,246,0.3)" : COLORS.border,
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
    pressed.value = withTiming(1, { duration: 80, easing: Easing.out(Easing.quad) });
    scale.value = withTiming(ANIMATIONS.pressScale, {
      duration: 80,
      easing: Easing.out(Easing.quad),
    });
  };
  const onPressOut = () => {
    pressed.value = withTiming(0, { duration: 120 });
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const isComplete = status === "complete";
  const isExpired = status === "expired";

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
        <Animated.View
          style={[
            styles.card,
            leftEdgeColor && { borderLeftWidth: 3, borderLeftColor: leftEdgeColor },
            isComplete && styles.cardComplete,
            isExpired && styles.cardExpired,
            cardAnimatedStyle,
          ]}
        >
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                isComplete && styles.titleMuted,
                (isComplete || isExpired) && styles.titleStrikethrough,
              ]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
            {missionStreak >= 2 &&
              (missionType === "core" || missionType === "interest") && (
                <Text style={styles.streakBadgeText}>🔥{missionStreak}</Text>
              )}
          </View>
          <View style={styles.metaRow}>
            <TypeChip missionType={missionType} interestName={interestName} />
            <View style={styles.rewards}>
              <View style={styles.badge}>
                <Ionicons name="star" size={12} color={COLORS.violetGlow} />
                <Text style={styles.xpText}>{xpValue}</Text>
              </View>
              <View style={styles.badge}>
                <Ionicons name="leaf" size={12} color={COLORS.text2} />
                <Text style={styles.petFoodText}>{petFoodValue}</Text>
              </View>
            </View>
            <View style={styles.metaSpacer} />
            {isComplete ? (
              <Ionicons name="checkmark-circle" size={22} color={COLORS.violet} />
            ) : (
              <DifficultyChip level={difficulty} />
            )}
          </View>
        </Animated.View>
        <Animated.View style={[styles.doneOverlay, doneOverlayStyle]} pointerEvents="none">
          <Text style={styles.doneText}>Done</Text>
        </Animated.View>
      </Pressable>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  outer: {
    minHeight: 80,
    position: "relative",
  },
  card: {
    minHeight: 80,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.cardPadding,
    ...SHADOWS.card,
  },
  cardComplete: {
    opacity: 0.7,
  },
  cardExpired: {
    opacity: 0.5,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    lineHeight: 22,
  },
  titleMuted: {
    color: COLORS.muted,
  },
  titleStrikethrough: {
    textDecorationLine: "line-through",
  },
  streakBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.ember,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  metaSpacer: {
    flex: 1,
    minWidth: 8,
  },
  typeChip: {
    borderWidth: 1,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeChipLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    fontWeight: "500",
  },
  rewards: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  xpText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.violetGlow,
  },
  petFoodText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text2,
  },
  doneOverlayBg: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingLeft: SPACING.md,
    backgroundColor: "rgba(139,92,246,0.08)",
    borderRadius: RADIUS.card,
  },
  doneOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingLeft: SPACING.md,
    borderRadius: RADIUS.card,
    pointerEvents: "none",
  },
  doneText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.violet,
  },
});
