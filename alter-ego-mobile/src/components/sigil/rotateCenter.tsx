import React from "react";
import { useAnimatedProps } from "react-native-reanimated";
import { useRotation } from "./SigilAnimations";
import { AnimatedG } from "./sigilSvg";

const CX = 170;
const CY = 170;

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
  const ap = useAnimatedProps(() => ({
    transform: `translate(${CX}, ${CY}) rotate(${r.value}) translate(${-CX}, ${-CY})`,
  }));
  return <AnimatedG animatedProps={ap}>{children}</AnimatedG>;
}
