import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useRadialGlowPulse } from "./SigilAnimations";

export type SigilRadialGlowPreset = "ambient" | "glow1" | "glow2" | "halo";

export interface SigilRadialGlowProps {
  size: number;
  /** Primary tint (hex); opacity comes from gradient stops */
  tintColor: string;
  preset: SigilRadialGlowPreset;
  durationMs?: number;
  delayMs?: number;
  /** Vertical nudge from geometric center (e.g. optical balance) */
  centerOffsetY?: number;
  zIndex?: number;
}

/**
 * Circular radial glow — HTML `.canvas-glow` / `.canvas-glow2` / page ambient.
 * No directional bias; center-strong, edge-transparent.
 */
export function SigilRadialGlow({
  size,
  tintColor,
  preset,
  durationMs,
  delayMs = 0,
  centerOffsetY = 0,
  zIndex = 0,
}: SigilRadialGlowProps) {
  const gid = useMemo(() => `srg-${preset}-${Math.random().toString(36).slice(2)}`, [preset]);
  const { opacity, scale } = useRadialGlowPulse(preset, durationMs, delayMs);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const stops = RADIAL_STOPS[preset];

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.layer,
        {
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2 + centerOffsetY,
          zIndex,
        },
        animStyle,
      ]}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={gid} cx="50%" cy="50%" r="70%" fx="50%" fy="50%">
            {stops.map((s) => (
              <Stop
                key={s.offset}
                offset={s.offset}
                stopColor={tintColor}
                stopOpacity={s.opacity}
              />
            ))}
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#${gid})`} />
      </Svg>
    </Animated.View>
  );
}

const RADIAL_STOPS: Record<SigilRadialGlowPreset, { offset: string; opacity: number }[]> = {
  /** Page / field — soft, wide fade (HTML ambient-breathe feel) */
  ambient: [
    { offset: "0%", opacity: 0.2 },
    { offset: "38%", opacity: 0.08 },
    { offset: "62%", opacity: 0.02 },
    { offset: "100%", opacity: 0 },
  ],
  /** canvas-glow — inset -40 */
  glow1: [
    { offset: "0%", opacity: 0.32 },
    { offset: "45%", opacity: 0.12 },
    { offset: "72%", opacity: 0.03 },
    { offset: "100%", opacity: 0 },
  ],
  /** canvas-glow2 — inset -80, softer outer */
  glow2: [
    { offset: "0%", opacity: 0.18 },
    { offset: "40%", opacity: 0.06 },
    { offset: "68%", opacity: 0.015 },
    { offset: "100%", opacity: 0 },
  ],
  /** L9/L10 extra halo */
  halo: [
    { offset: "0%", opacity: 0.28 },
    { offset: "42%", opacity: 0.1 },
    { offset: "70%", opacity: 0.04 },
    { offset: "100%", opacity: 0 },
  ],
};

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    left: "50%",
    top: "50%",
  },
});
