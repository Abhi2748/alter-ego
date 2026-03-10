/**
 * Section progress ring — 32px ring beside Home section headers.
 * Track: #1E2333. Fill stroke by section: Core #7F1D1D, Interest #8B5CF6, Personal #6B7280.
 * Display only; fill = completed / total (0→100%).
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { COLORS } from "../constants/theme";

const SIZE = 32;
const STROKE_WIDTH = 3;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const TRACK_COLOR = COLORS.surface2; // #1E2333

export type SectionProgressRingVariant = "core" | "interest" | "personal";

const STROKE_COLORS: Record<SectionProgressRingVariant, string> = {
  core: COLORS.core,       // #7F1D1D
  interest: COLORS.violet, // #8B5CF6
  personal: COLORS.muted,  // #6B7280
};

export interface SectionProgressRingProps {
  completed: number;
  total: number;
  variant: SectionProgressRingVariant;
}

export function SectionProgressRing({
  completed,
  total,
  variant,
}: SectionProgressRingProps) {
  const progress = total > 0 ? Math.min(1, completed / total) : 0;
  const strokeColor = STROKE_COLORS[variant];
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Track — full ring */}
        <Circle
          cx={CX}
          cy={CY}
          r={RADIUS}
          stroke={TRACK_COLOR}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {/* Fill — arc from top, clockwise */}
        <Circle
          cx={CX}
          cy={CY}
          r={RADIUS}
          stroke={strokeColor}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90, ${CX}, ${CY})`}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
  },
});
