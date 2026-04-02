/**
 * Leaderboard skeleton §2.12 — 8 rows, shimmer left→right 1.2s loop.
 * Background #141824. Grey placeholders for rank circle, name bar, score bar.
 */

import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING } from "../constants/theme";

const ROW_HEIGHT = 72;
const CARD_RADIUS = 12;
const ROW_GAP = 8;
const SHIMMER_DURATION = 1200;

const shimmerColors = [
  "transparent",
  "rgba(255,255,255,0.03)",
  "rgba(255,255,255,0.08)",
  "rgba(255,255,255,0.03)",
  "transparent",
];

function ShimmerOverlay() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: SHIMMER_DURATION, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [-200, 400]),
      },
    ],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
      <Animated.View style={[styles.shimmerStrip, shimmerStyle]}>
        <LinearGradient
          colors={shimmerColors}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </Animated.View>
  );
}

function SkeletonRow() {
  return (
    <View style={styles.row}>
      <ShimmerOverlay />
      <View style={styles.rankCircle} />
      <View style={styles.thumbArea}>
        <View style={styles.characterCircle} />
      </View>
      <View style={styles.nameBar} />
      <View style={styles.scoreBar} />
    </View>
  );
}

export function LeaderboardSkeleton() {
  return (
    <View style={styles.container}>
      {Array.from({ length: 8 }).map((_, i) => (
        <View key={i} style={i > 0 ? styles.rowWrap : undefined}>
          <SkeletonRow />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.screenPadding,
  },
  rowWrap: {
    marginTop: ROW_GAP,
  },
  row: {
    height: ROW_HEIGHT,
    borderRadius: CARD_RADIUS,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surface2,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  shimmerStrip: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 200,
  },
  shimmerGradient: {
    flex: 1,
    width: "100%",
  },
  rankCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface2,
    marginRight: SPACING.sm,
  },
  thumbArea: {
    width: 48,
    height: 48,
    marginRight: SPACING.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  characterCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface2,
  },
  nameBar: {
    flex: 1,
    height: 14,
    borderRadius: 4,
    backgroundColor: COLORS.surface2,
    marginRight: SPACING.sm,
    maxWidth: "60%",
  },
  scoreBar: {
    width: 56,
    height: 18,
    borderRadius: 4,
    backgroundColor: COLORS.surface2,
  },
});
