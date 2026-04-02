import React, { useEffect, useMemo } from "react";
import {
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { svgAdapters, AnimatedCircle } from "./sigilSvg";

/** Deterministic 0–1 from position + delay — stable across re-renders, no Math.random. */
function u01(cx: number, cy: number, delayMs: number, salt: number): number {
  const n = cx * 7919 + cy * 6991 + delayMs * 13 + salt * 5041;
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export function HtmlDustDot({
  cx,
  cy,
  r: baseR,
  fill,
  fo,
  durMs,
  delayMs,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  fo: number;
  durMs: number;
  delayMs: number;
}) {
  const scale = useSharedValue(1);
  const op = useSharedValue(fo);
  const phase = useSharedValue(0);

  const { dAmp, dPh0, dPh1 } = useMemo(() => {
    const amp = 0.9 + u01(cx, cy, delayMs, 11) * 0.9;
    const ph0 = u01(cx, cy, delayMs, 12) * Math.PI * 2;
    const ph1 = u01(cx, cy, delayMs, 13) * Math.PI * 2;
    return { dAmp: amp, dPh0: ph0, dPh1: ph1 };
  }, [cx, cy, delayMs]);

  useEffect(() => {
    const run = () => {
      const half = durMs / 2;
      scale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: half, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: half, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      op.value = withRepeat(
        withSequence(
          withTiming(0.85, { duration: half, easing: Easing.inOut(Easing.ease) }),
          withTiming(fo, { duration: half, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      phase.value = withRepeat(
        withTiming(2 * Math.PI, { duration: durMs * 2.2, easing: Easing.linear }),
        -1,
        false
      );
    };
    const t = setTimeout(run, delayMs);
    return () => clearTimeout(t);
  }, [durMs, delayMs, fo]);

  const ap = useAnimatedProps(
    () => {
      const p = phase.value;
      const dx = dAmp * Math.sin(p + dPh0);
      const dy = dAmp * 0.85 * Math.cos(p * 0.92 + dPh1);
      return {
        cx: cx + dx,
        cy: cy + dy,
        r: baseR * scale.value,
        opacity: op.value,
      };
    },
    [],
    svgAdapters
  );
  return <AnimatedCircle fill={fill} animatedProps={ap} />;
}

export function HtmlFloatDot({
  cx,
  cy,
  r: baseR,
  fill,
  fo,
  durMs,
  delayMs,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  fo: number;
  durMs: number;
  delayMs: number;
}) {
  const scale = useSharedValue(1);
  const op = useSharedValue(fo);
  const phase = useSharedValue(0);

  const { amp1x, amp1y, amp2x, amp2y, ph0, ph1, ph2, ph3 } = useMemo(() => {
    const a1x = 2.5 + u01(cx, cy, delayMs, 1) * 4;
    const a1y = 2.5 + u01(cx, cy, delayMs, 2) * 4;
    const a2x = 1 + u01(cx, cy, delayMs, 3) * 2.5;
    const a2y = 1 + u01(cx, cy, delayMs, 4) * 2.5;
    const p0 = u01(cx, cy, delayMs, 5) * Math.PI * 2;
    const p1 = u01(cx, cy, delayMs, 6) * Math.PI * 2;
    const p2 = u01(cx, cy, delayMs, 7) * Math.PI * 2;
    const p3 = u01(cx, cy, delayMs, 8) * Math.PI * 2;
    return { amp1x: a1x, amp1y: a1y, amp2x: a2x, amp2y: a2y, ph0: p0, ph1: p1, ph2: p2, ph3: p3 };
  }, [cx, cy, delayMs]);

  useEffect(() => {
    const run = () => {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: durMs * 0.4, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.85, { duration: durMs * 0.3, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: durMs * 0.3, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      op.value = withRepeat(
        withSequence(
          withTiming(0.9, { duration: durMs * 0.4, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: durMs * 0.3, easing: Easing.inOut(Easing.ease) }),
          withTiming(fo, { duration: durMs * 0.3, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      phase.value = withRepeat(
        withTiming(2 * Math.PI, { duration: durMs, easing: Easing.linear }),
        -1,
        false
      );
    };
    const t = setTimeout(run, delayMs);
    return () => clearTimeout(t);
  }, [durMs, delayMs, fo]);

  const ap = useAnimatedProps(
    () => {
      const p = phase.value;
      const dx = amp1x * Math.sin(p + ph0) + amp2x * Math.sin(p * 0.71 + ph1);
      const dy = amp1y * Math.cos(p * 0.83 + ph2) + amp2y * Math.cos(p * 1.09 + ph3);
      return {
        cx: cx + dx,
        cy: cy + dy,
        r: baseR * scale.value,
        opacity: op.value,
      };
    },
    [],
    svgAdapters
  );
  return <AnimatedCircle fill={fill} animatedProps={ap} />;
}
