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

export type MissionType = "core" | "interest" | "personal" | "recovery";
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
}: MissionCardProps) {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const pressed = useSharedValue(0);
  const SWIPE_THRESHOLD = 0.6;
  const cardWidth = useSharedValue(300);

  const leftEdgeColor =
    status === "complete"
      ? COLORS.violet
      : status === "expired"
        ? COLORS.danger
        : LEFT_EDGE_COLOR[missionType];

  const panGesture = Gesture.Pan()
    .enabled(status === "pending")
    .onUpdate((e) => {
      if (e.translationX < 0) return;
      translateX.value = Math.min(e.translationX, 120);
    })
    .onEnd((e) => {
      const threshold = cardWidth.value * SWIPE_THRESHOLD;
      if (translateX.value >= threshold) {
        runOnJS(onComplete)();
        translateX.value = withSpring(0, { damping: 15, stiffness: 200 });
      } else {
        translateX.value = withSpring(0, { damping: 15, stiffness: 200 });
      }
    });

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: pressed.value === 1 ? "#1A2030" : COLORS.surface,
    borderColor: pressed.value === 1 ? "rgba(139,92,246,0.3)" : COLORS.border,
    transform: [
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
          <View style={styles.row}>
            <View style={styles.left}>
              <Text
                style={[
                  styles.title,
                  isComplete && styles.titleMuted,
                  isExpired && styles.titleStrikethrough,
                ]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {title}
              </Text>
              <Text style={styles.category}>{category}</Text>
            </View>
            <View style={styles.right}>
              <TypeChip missionType={missionType} interestName={interestName} />
              {isComplete ? (
                <View style={styles.checkWrap}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.violet} />
                </View>
              ) : (
                <DifficultyChip level={difficulty} />
              )}
              <View style={styles.badgesRow}>
                <View style={styles.badge}>
                  <Ionicons name="star" size={12} color={COLORS.violetGlow} />
                  <Text style={styles.xpText}>{xpValue}</Text>
                </View>
                <View style={styles.badgeGap} />
                <View style={styles.badge}>
                  <Ionicons name="leaf" size={12} color="#F59E0B" />
                  <Text style={styles.petFoodText}>{petFoodValue}</Text>
                </View>
              </View>
            </View>
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
    minHeight: 72,
    position: "relative",
  },
  card: {
    minHeight: 72,
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    padding: SPACING.cardPadding,
    ...SHADOWS.card,
  },
  cardComplete: {
    opacity: 0.7,
  },
  cardExpired: {
    opacity: 0.5,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  left: {
    flex: 1,
    marginRight: SPACING.sm,
    justifyContent: "center",
    minWidth: 0,
  },
  right: {
    alignItems: "flex-end",
    gap: 6,
  },
  title: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.text,
    marginBottom: 2,
  },
  titleMuted: {
    color: COLORS.muted,
  },
  titleStrikethrough: {
    textDecorationLine: "line-through",
  },
  category: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.muted,
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
  checkWrap: {
    padding: 2,
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  badgeGap: {
    width: SPACING.sm,
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
    color: "#F59E0B",
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
  doneText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.violet,
  },
});
