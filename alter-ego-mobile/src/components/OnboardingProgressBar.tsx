/**
 * Onboarding progress bar §2.11 — 3px, fill = questionNumber/13 × 100%, 200ms easeOut.
 * Track: rgba(42,48,80,0.50). Fill: LinearGradient #5B21B6 → #8B5CF6 with glow.
 */

import React, { useEffect } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { TOTAL_ONBOARDING_QUESTIONS } from "../constants/onboardingQuestions";

const BAR_HEIGHT = 3;

type Props = {
  questionNumber: number;
};

export function OnboardingProgressBar({ questionNumber }: Props) {
  const fillWidth = useSharedValue(0);

  useEffect(() => {
    const pct = Math.min(questionNumber, TOTAL_ONBOARDING_QUESTIONS) / TOTAL_ONBOARDING_QUESTIONS;
    fillWidth.value = withTiming(pct * 100, {
      duration: 200,
      easing: Easing.out(Easing.ease),
    });
  }, [questionNumber]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fillWidth.value}%`,
  }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fillWrap, fillStyle]}>
        <LinearGradient
          colors={["#5B21B6", "#8B5CF6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    height: BAR_HEIGHT,
    backgroundColor: "rgba(42,48,80,0.50)",
  },
  fillWrap: {
    height: BAR_HEIGHT,
    overflow: "hidden",
    ...(Platform.OS !== "web" && {
      shadowColor: "rgba(139,92,246,0.60)",
      shadowOffset: { width: 0, height: 0 },
      shadowRadius: 8,
      shadowOpacity: 1,
      elevation: 6,
    }),
  },
});
