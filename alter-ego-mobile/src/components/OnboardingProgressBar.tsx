/**
 * Onboarding progress bar §2.11 — 3px, fill = questionNumber/13 × 100%, 200ms easeOut.
 * No numbers; bar alone communicates progress.
 */

import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { COLORS } from "../constants/theme";
import { TOTAL_ONBOARDING_QUESTIONS } from "../constants/onboardingQuestions";

const BAR_HEIGHT = 6;

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
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    height: BAR_HEIGHT,
    backgroundColor: COLORS.surface2,
  },
  fill: {
    height: BAR_HEIGHT,
    backgroundColor: COLORS.violet,
  },
});
