/**
 * Pet Animation — Placeholder for Phase 1. Replaced with Rive in Phase 3.
 * Props interface must stay identical for swap.
 * Part 2 §2.3: stage (1–8), isHappy, size. Happy: violet gradient + breathing. Sad: dark gradient, opacity 0.6.
 */

import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import { COLORS } from "../constants/theme";

const BREATH_CYCLE_MS = 2400;
const BREATH_SCALE = 1.04;

const WHITE_GRADIENT = {
  colors: ["#E8E8ED", "#FFFFFF"] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

export interface PetAnimationProps {
  /** Pet stage 1–8 (Cub → Dragon). */
  stage: number;
  /** Happy vs sad state. */
  isHappy: boolean;
  /** Size in px. Default 120. */
  size?: number;
  /** Cub/companion color: violet (default) or white. */
  variant?: "violet" | "white";
}

const HAPPY_GRADIENT = {
  colors: [COLORS.violetDeep, COLORS.violet] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

const SAD_GRADIENT = {
  colors: [COLORS.surface2, COLORS.surface] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

export function PetAnimation({
  stage,
  isHappy,
  size = 120,
  variant = "violet",
}: PetAnimationProps) {
  const scale = useSharedValue(1);
  const gradient =
    variant === "white"
      ? WHITE_GRADIENT
      : isHappy
        ? HAPPY_GRADIENT
        : SAD_GRADIENT;

  useEffect(() => {
    if (isHappy) {
      scale.value = withRepeat(
        withSequence(
          withTiming(BREATH_SCALE, {
            duration: BREATH_CYCLE_MS / 2,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, {
            duration: BREATH_CYCLE_MS / 2,
            easing: Easing.inOut(Easing.ease),
          })
        ),
        -1,
        false
      );
    } else {
      scale.value = withTiming(1, {
        duration: 200,
        easing: Easing.out(Easing.ease),
      });
    }
  }, [isHappy]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const half = size / 2;
  const radius = half;

  return (
    <Animated.View style={[styles.wrapper, { width: size, height: size }, animatedStyle]}>
      <View
        style={[
          styles.circleWrap,
          {
            width: size,
            height: size,
            borderRadius: radius,
            opacity: isHappy ? 1 : 0.6,
          },
        ]}
      >
        <LinearGradient
          colors={gradient.colors}
          start={gradient.start}
          end={gradient.end}
          style={[styles.gradient, { width: size, height: size, borderRadius: radius }]}
        />
      </View>
      <View style={[styles.labelWrap, { width: size, height: size }]} pointerEvents="none">
        <Text
          style={[
            styles.stageLabel,
            { fontSize: Math.max(14, size * 0.2) },
            variant === "white" && styles.stageLabelDark,
          ]}
        >
          {Math.min(8, Math.max(1, stage))}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  circleWrap: {
    position: "absolute",
    overflow: "hidden",
  },
  gradient: {
    width: "100%",
    height: "100%",
  },
  labelWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  stageLabel: {
    fontFamily: "Inter_600SemiBold",
    color: COLORS.text,
  },
  stageLabelDark: {
    color: "#374151",
  },
});
