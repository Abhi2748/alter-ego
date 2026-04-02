import React from "react";
import { useAnimatedProps } from "react-native-reanimated";
import { useRotation } from "./SigilAnimations";
import { svgAdapters, AnimatedG } from "./sigilSvg";

export const SIGIL_CENTER_X = 170;
export const SIGIL_CENTER_Y = 170;

/** Column-major SVG matrix [a,b,c,d,e,f] for rotation around sigil center — reliable on RN + Reanimated vs string transform. */
export function rotationAroundCenterMatrix(deg: number): [
  number,
  number,
  number,
  number,
  number,
  number,
] {
  "worklet";
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const a = cos;
  const b = sin;
  const c = -sin;
  const d = cos;
  const e = SIGIL_CENTER_X - cos * SIGIL_CENTER_X + sin * SIGIL_CENTER_Y;
  const f = SIGIL_CENTER_Y - sin * SIGIL_CENTER_X - cos * SIGIL_CENTER_Y;
  return [a, b, c, d, e, f];
}

/** Scale about sigil center — replaces translate/scale/translate string transforms on AnimatedG. */
export function centerScaleMatrix(s: number): [number, number, number, number, number, number] {
  "worklet";
  const e = SIGIL_CENTER_X * (1 - s);
  const f = SIGIL_CENTER_Y * (1 - s);
  return [s, 0, 0, s, e, f];
}

export function RotatingG({
  durationMs,
  reverse,
  delayMs = 0,
  children,
}: {
  durationMs: number;
  reverse?: boolean;
  delayMs?: number;
  children: React.ReactNode;
}) {
  const r = useRotation(durationMs, reverse ?? false, delayMs);
  const ap = useAnimatedProps(
    () => ({
      transform: rotationAroundCenterMatrix(r.value),
    }),
    [],
    svgAdapters
  );
  return <AnimatedG animatedProps={ap}>{children}</AnimatedG>;
}
