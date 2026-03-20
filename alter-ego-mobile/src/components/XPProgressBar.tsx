/**
 * XP Progress Bar §2.5 — Fill = progress within current stage (stage_progress_pct).
 * animateXpGain() runs after profile updates; uses ratio ref so target is never stale.
 */

import React, { useEffect, useImperativeHandle, useRef } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { COLORS, ANIMATIONS } from "../constants/theme";

const DEFAULT_BAR_WIDTH = 280;
const BAR_HEIGHT = 5;
const BAR_RADIUS = 5;
const HOLD_BEFORE_STAGE_COMPLETE_MS = 300;

export interface XPProgressBarProps {
  /** 0–100: XP progress within the current character stage (matches profile/overview). */
  stageProgressPct: number;
  /** Used to snap the bar when the stage changes (evolution). */
  characterStage: number;
  nextStageName: string;
  /** Bar width in px. Default 280; e.g. 240 for Titles. */
  width?: number;
  /** When true, do not render labels (parent supplies e.g. "✦ XP" / "→ nextStageName"). */
  hideLabels?: boolean;
  /** Called when bar reaches 100% and after 300ms hold. Parent shows evolution then updates stage. */
  onStageComplete?: () => void;
  ref?: React.Ref<XPProgressBarRef>;
}

export interface XPProgressBarRef {
  animateXpGain: () => void;
}

export function XPProgressBar({
  stageProgressPct,
  characterStage,
  nextStageName,
  width = DEFAULT_BAR_WIDTH,
  hideLabels = false,
  onStageComplete,
  ref,
}: XPProgressBarProps) {
  const barWidth = width;
  const ratio = Math.min(1, Math.max(0, stageProgressPct / 100));
  const ratioRef = useRef(ratio);
  ratioRef.current = ratio;

  const progress = useSharedValue(ratio);
  const prevStageRef = useRef(characterStage);
  const bootstrappedRef = useRef(false);

  /** Snap when stage changes (evolution / remount). */
  useEffect(() => {
    if (prevStageRef.current !== characterStage) {
      prevStageRef.current = characterStage;
      progress.value = Math.min(1, Math.max(0, stageProgressPct / 100));
    }
  }, [characterStage, stageProgressPct]);

  /** One-time sync when profile first loads with real progress (same stage). */
  useEffect(() => {
    if (bootstrappedRef.current) return;
    if (stageProgressPct > 0 || ratio > 0) {
      bootstrappedRef.current = true;
      progress.value = ratio;
    }
  }, [stageProgressPct, ratio]);

  const holdThenComplete = () => {
    setTimeout(() => {
      onStageComplete?.();
    }, HOLD_BEFORE_STAGE_COMPLETE_MS);
  };

  useImperativeHandle(
    ref,
    () => ({
      animateXpGain: () => {
        const target = Math.min(1, Math.max(0, ratioRef.current));
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
    [onStageComplete, progress]
  );

  const fillAnimatedStyle = useAnimatedStyle(
    () => ({
      width: progress.value * barWidth,
    }),
    [barWidth]
  );

  const showGlowDot = ratio > 0.02;

  return (
    <View style={[styles.wrapper, { width: barWidth }]}>
      {!hideLabels && (
        <View style={styles.labels}>
          <Text style={styles.xpLabel} numberOfLines={1}>
            ✦ XP
          </Text>
          <Text style={styles.stageLabel} numberOfLines={1}>
            → {nextStageName}
          </Text>
        </View>
      )}
      <View style={styles.track}>
        <Animated.View style={[styles.fillWrap, fillAnimatedStyle]}>
          <LinearGradient
            colors={["#5B21B6", "#8B5CF6", "#C084FC"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.fill}
          />
          {showGlowDot && <View style={styles.glowDot} />}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  xpLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: COLORS.violetGlow,
  },
  stageLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: "#4B5563",
    maxWidth: "60%",
  },
  track: {
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    backgroundColor: "rgba(20,24,36,1)",
    overflow: "visible",
  },
  fillWrap: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: BAR_RADIUS,
    overflow: "visible",
  },
  fill: {
    flex: 1,
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    minWidth: 0,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "rgba(139,92,246,0.5)",
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 },
        }
      : { elevation: 6 }),
  },
  glowDot: {
    position: "absolute",
    right: -4.5,
    top: -2,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#C084FC",
    borderWidth: 1.5,
    borderColor: "#09091A",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "rgba(192,132,252,0.52)",
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
        }
      : { elevation: 6 }),
  },
});
