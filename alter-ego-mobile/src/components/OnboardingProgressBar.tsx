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

const BAR_HEIGHT = 6;
const TOTAL_QUESTIONS = 13;

type Props = {
  questionNumber: number;
};

export function OnboardingProgressBar({ questionNumber }: Props) {
  const fillWidth = useSharedValue(0);

  useEffect(() => {
    const pct = Math.min(questionNumber, TOTAL_QUESTIONS) / TOTAL_QUESTIONS;
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
