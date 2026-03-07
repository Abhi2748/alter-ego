/**
 * XP Progress Bar §2.5 — Animated fill, labels above. animateXpGain() via ref.
 */

import React, { useEffect, useRef, useImperativeHandle } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { COLORS, GRADIENTS, ANIMATIONS } from "../constants/theme";

const BAR_WIDTH = 280;
const BAR_HEIGHT = 8;
const BAR_RADIUS = 8;
const HOLD_BEFORE_STAGE_COMPLETE_MS = 300;

export interface XPProgressBarProps {
  currentXP: number;
  nextStageXP: number;
  nextStageName: string;
  /** Called when bar reaches 100% and after 300ms hold. Parent shows evolution then updates stage. */
  onStageComplete?: () => void;
  /** Ref for imperative animateXpGain(). React 19: ref is a regular prop. */
  ref?: React.Ref<XPProgressBarRef>;
}

export interface XPProgressBarRef {
  animateXpGain: () => void;
}

export function XPProgressBar({
  currentXP,
  nextStageXP,
  nextStageName,
  onStageComplete,
  ref,
}: XPProgressBarProps) {
  const ratio =
    nextStageXP > 0 ? Math.min(1, currentXP / nextStageXP) : 0;
  const progress = useSharedValue(ratio);
  const prevNextStageXP = useRef(nextStageXP);

  useEffect(() => {
    if (prevNextStageXP.current !== nextStageXP) {
      prevNextStageXP.current = nextStageXP;
      progress.value = 0;
    }
  }, [nextStageXP]);

  const holdThenComplete = () => {
    setTimeout(() => {
      onStageComplete?.();
      progress.value = 0;
    }, HOLD_BEFORE_STAGE_COMPLETE_MS);
  };

  useImperativeHandle(
    ref,
    () => ({
      animateXpGain: () => {
        const target = ratio;
        if (target >= 1) {
          progress.value = withTiming(
            1,
            {
              duration: ANIMATIONS.xpFill,
              easing: Easing.out(Easing.ease),
            },
            (finished) => {
              if (finished) {
                runOnJS(holdThenComplete)();
              }
            }
          );
        } else {
          progress.value = withTiming(target, {
            duration: ANIMATIONS.xpFill,
            easing: Easing.out(Easing.ease),
          });
        }
      },
    }),
    [currentXP, nextStageXP, ratio, onStageComplete]
  );

  const fillAnimatedStyle = useAnimatedStyle(() => ({
    width: progress.value * BAR_WIDTH,
  }), []);

  return (
    <View style={styles.wrapper}>
      <View style={styles.labels}>
        <Text style={styles.xpLabel} numberOfLines={1}>
          XP {currentXP.toLocaleString()}
        </Text>
        <Text style={styles.stageLabel} numberOfLines={1}>
          {nextStageName}
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fillWrap, fillAnimatedStyle]}>
          <LinearGradient
            colors={GRADIENTS.xpBar.colors}
            start={GRADIENTS.xpBar.start}
            end={GRADIENTS.xpBar.end}
            style={styles.fill}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: BAR_WIDTH,
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  xpLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.violetGlow,
  },
  stageLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.muted,
    maxWidth: "60%",
  },
  track: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    backgroundColor: COLORS.surface2,
    overflow: "hidden",
  },
  fillWrap: {
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#8B5CF6",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 6,
        }
      : { elevation: 6 }),
  },
  fill: {
    width: "100%",
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
  },
});
