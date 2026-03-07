/**
 * Leaderboard Row Card §2.2 — Rank, character thumbnail, pet icon, name, streak, power score.
 * Card appear animation §3.2: opacity 0→1, translateY +12→0, stagger by index × 40ms.
 */

import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { COLORS, SPACING, ANIMATIONS } from "../constants/theme";

const STAGGER_MS = 40;
const CARD_APPEAR_MS = 200;

const ROW_HEIGHT = 72;
const CARD_RADIUS = 12;
const RANK_WIDTH = 40;
const THUMB_SIZE = 48;
const PET_SIZE = 24;
const PET_OVERLAP = 6;
const OWN_ROW_LEFT_EDGE = 3;

const RANK_TINT: Record<number, string> = {
  1: "#FFD700",
  2: "#C0C0C0",
  3: "#CD7F32",
};

const RANK_LEFT_TINT: Record<number, string> = {
  1: "rgba(255, 215, 0, 0.06)",
  2: "rgba(192, 192, 192, 0.06)",
  3: "rgba(205, 127, 50, 0.06)",
};

export interface LeaderboardRowCardProps {
  rank: number;
  username: string;
  stageTitle: string;
  characterStage: number;
  petStage: number;
  streak: number;
  powerScore: number;
  isOwnRow?: boolean;
  /** Optional index for stagger animation; omit to skip animation. */
  animationIndex?: number;
}

function formatPowerScore(n: number): string {
  return n.toLocaleString();
}

export function LeaderboardRowCard({
  rank,
  username,
  stageTitle,
  characterStage,
  petStage,
  streak,
  powerScore,
  isOwnRow = false,
  animationIndex,
}: LeaderboardRowCardProps) {
  const opacity = useSharedValue(animationIndex === undefined ? 1 : 0);
  const translateY = useSharedValue(animationIndex === undefined ? 0 : 12);

  useEffect(() => {
    if (animationIndex === undefined) return;
    const delay = Math.min(animationIndex * STAGGER_MS, ANIMATIONS.staggerMax);
    const easing = Easing.out(Easing.quad);
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: CARD_APPEAR_MS, easing })
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: CARD_APPEAR_MS, easing })
    );
  }, [animationIndex]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const rankTint = RANK_TINT[rank];
  const isTop3 = rank >= 1 && rank <= 3;

  const top3Gradient =
    isTop3 && rankTint
      ? {
          colors: [RANK_LEFT_TINT[rank], COLORS.surface] as const,
          start: { x: 0, y: 0.5 },
          end: { x: 1, y: 0.5 },
        }
      : null;

  const cardContent = (
    <View
      style={[
        styles.card,
        isOwnRow && styles.ownRow,
        isOwnRow && styles.ownRowEdge,
      ]}
    >
      {top3Gradient ? (
        <LinearGradient
          colors={top3Gradient.colors}
          start={top3Gradient.start}
          end={top3Gradient.end}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={styles.row}>
        <View style={[styles.rankWrap, { width: RANK_WIDTH }]}>
          <Text
            style={[
              styles.rank,
              rankTint ? { color: rankTint } : undefined,
            ]}
            numberOfLines={1}
          >
            {rank}
          </Text>
        </View>
        <View style={styles.thumbWrap}>
          <View style={styles.characterThumb}>
            <LinearGradient
              colors={[COLORS.violetDeep, COLORS.violet]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.characterGradient}
            />
            <Text style={styles.characterStageLabel}>
              {Math.min(6, Math.max(1, characterStage))}
            </Text>
          </View>
          <View style={styles.petIcon}>
            <LinearGradient
              colors={[COLORS.surface2, COLORS.surface]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.petGradient}
            />
            <Text style={styles.petStageLabel}>
              {Math.min(8, Math.max(1, petStage))}
            </Text>
          </View>
        </View>
        <View style={styles.nameBlock}>
          <Text style={styles.username} numberOfLines={1} ellipsizeMode="tail">
            {username}
          </Text>
          <Text style={styles.stageTitle} numberOfLines={1} ellipsizeMode="tail">
            {stageTitle}
          </Text>
        </View>
        <View style={styles.streakBlock}>
          <Text style={styles.streakNum}>🔥{streak}</Text>
        </View>
        <Text style={styles.powerScore}>{formatPowerScore(powerScore)}</Text>
      </View>
    </View>
  );

  if (animationIndex !== undefined) {
    return <Animated.View style={animatedStyle}>{cardContent}</Animated.View>;
  }
  return cardContent;
}

const styles = StyleSheet.create({
  card: {
    height: ROW_HEIGHT,
    borderRadius: CARD_RADIUS,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surface2,
    paddingHorizontal: 12,
    overflow: "hidden",
  },
  ownRow: {
    backgroundColor: "#16192A",
    borderColor: COLORS.violet,
  },
  ownRowEdge: {
    borderLeftWidth: OWN_ROW_LEFT_EDGE,
    borderLeftColor: COLORS.violet,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  rankWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.sm,
  },
  rank: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: COLORS.text,
  },
  thumbWrap: {
    width: THUMB_SIZE + PET_OVERLAP,
    height: THUMB_SIZE + PET_OVERLAP,
    marginRight: SPACING.sm,
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
  characterThumb: {
    position: "absolute",
    left: 0,
    top: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 1,
    borderColor: COLORS.surface2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  characterGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  characterStageLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: COLORS.text,
  },
  petIcon: {
    width: PET_SIZE,
    height: PET_SIZE,
    borderRadius: PET_SIZE / 2,
    borderWidth: 1,
    borderColor: COLORS.surface2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  petGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  petStageLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: COLORS.text2,
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
    marginRight: SPACING.sm,
    justifyContent: "center",
  },
  username: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: COLORS.text,
  },
  stageTitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  streakBlock: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: SPACING.md,
    gap: 4,
  },
  streakNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: COLORS.ember,
  },
  powerScore: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: COLORS.violet,
  },
});
