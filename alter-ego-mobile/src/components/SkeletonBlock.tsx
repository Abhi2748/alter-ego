/**
 * Simple shimmer block for use in non-card contexts.
 * Used for text lines, numbers, stats — anywhere that needs
 * a shimmer placeholder that isn't card-shaped.
 */
import React, { useEffect } from "react";
import type { ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
} from "react-native-reanimated";

interface SkeletonBlockProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  delay?: number;
  style?: ViewStyle;
}

export function SkeletonBlock({
  width,
  height,
  borderRadius = 6,
  delay = 0,
  style,
}: SkeletonBlockProps) {
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

  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.4, 0.7]),
    backgroundColor: "#1E2333",
    width,
    height,
    borderRadius,
    ...(style ?? {}),
  }));

  return <Animated.View style={animStyle} />;
}

