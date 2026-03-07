/**
 * Leaderboard Row Card §2.2 — Rank, character thumbnail, pet icon, name, streak, power score.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING } from "../constants/theme";

const ROW_HEIGHT = 72;
const CARD_RADIUS = 12;
const RANK_WIDTH = 40;
const THUMB_SIZE = 48;
const PET_SIZE = 24;
const PET_OVERLAP = 6;
const FLAME_SIZE = 20;
const OWN_ROW_LEFT_EDGE = 3;

const RANK_TINT: Record<number, string> = {
  1: "#F59E0B",
  2: "#9CA3AF",
  3: "#CD7F32",
};

const RANK_TINT_5: Record<number, string> = {
  1: "rgba(245, 158, 11, 0.05)",
  2: "rgba(156, 163, 175, 0.05)",
  3: "rgba(205, 127, 50, 0.05)",
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
}: LeaderboardRowCardProps) {
  const rankTint = RANK_TINT[rank];
  const isTop3 = rank >= 1 && rank <= 3;

  const top3Gradient =
    isTop3 && rankTint
      ? {
          colors: [COLORS.surface, RANK_TINT_5[rank], COLORS.surface] as const,
          start: { x: 0, y: 0.5 },
          end: { x: 1, y: 0.5 },
        }
      : null;

  return (
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
          <Ionicons name="flame" size={FLAME_SIZE} color={COLORS.ember} />
          <Text style={styles.streakNum}>{streak}</Text>
        </View>
        <Text style={styles.powerScore}>{powerScore}</Text>
      </View>
    </View>
  );
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
    color: COLORS.text,
  },
  powerScore: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: COLORS.violet,
  },
});
