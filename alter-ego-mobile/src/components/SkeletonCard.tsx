/**
 * Reusable shimmer skeleton card.
 * Used as placeholder while mission data loads.
 * Matches approximate shape of MissionCard.
 */
import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
} from "react-native-reanimated";

interface SkeletonCardProps {
  leftEdgeColor?: string; // pass '#7F1D1D' for core, '#8B5CF6' for interest, undefined for personal
  delay?: number; // stagger delay in ms
}

export function SkeletonCard({ leftEdgeColor, delay = 0 }: SkeletonCardProps) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      shimmer.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900 }),
          withTiming(0, { duration: 900 })
        ),
        -1,
        false
      );
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, shimmer]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.4, 0.7]),
  }));

  return (
    <View style={styles.card}>
      {/* Left edge colour hint — visible even in skeleton */}
      {leftEdgeColor && (
        <View
          style={[
            styles.leftEdge,
            { backgroundColor: leftEdgeColor, opacity: 0.3 },
          ]}
        />
      )}
      <View style={styles.content}>
        {/* Title line */}
        <Animated.View style={[styles.titleLine, shimmerStyle]} />
        {/* Subtitle line */}
        <Animated.View style={[styles.subtitleLine, shimmerStyle]} />
      </View>
      {/* Right side chip + badge */}
      <View style={styles.right}>
        <Animated.View style={[styles.chip, shimmerStyle]} />
        <Animated.View style={[styles.badge, shimmerStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#141824",
    borderWidth: 1,
    borderColor: "#1E2333",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
  },
  leftEdge: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  content: {
    flex: 1,
    gap: 8,
    paddingLeft: 8,
  },
  titleLine: {
    height: 14,
    width: "72%",
    backgroundColor: "#1E2333",
    borderRadius: 4,
  },
  subtitleLine: {
    height: 10,
    width: "40%",
    backgroundColor: "#1E2333",
    borderRadius: 4,
  },
  right: {
    alignItems: "flex-end",
    gap: 6,
  },
  chip: {
    width: 52,
    height: 22,
    backgroundColor: "#1E2333",
    borderRadius: 10,
  },
  badge: {
    width: 44,
    height: 12,
    backgroundColor: "#1E2333",
    borderRadius: 4,
  },
});

