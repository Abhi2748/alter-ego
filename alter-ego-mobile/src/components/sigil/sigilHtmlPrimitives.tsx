/**
 * Motion primitives matching keyframes in ALTER_EGO_Sigil_FullPage.html (dust, float-particle).
 */
import React, { useEffect } from "react";
import {
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { AnimatedCircle } from "./sigilSvg";
import { useHtmlFlickerFo } from "./SigilAnimations";

/** CSS `@keyframes dust` — scale 1↔1.15, opacity fo↔0.85 */
export function HtmlDustDot({
  cx,
  cy,
  baseR,
  fill,
  fo,
  durMs,
  delayMs,
}: {
  cx: number;
  cy: number;
  baseR: number;
  fill: string;
  fo: number;
  durMs: number;
  delayMs: number;
}) {
  const scale = useSharedValue(1);
  const op = useSharedValue(fo);
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
    };
    const t = setTimeout(run, delayMs);
    return () => clearTimeout(t);
  }, [durMs, delayMs, fo]);
  const ap = useAnimatedProps(() => ({ r: baseR * scale.value, opacity: op.value }));
  return <AnimatedCircle cx={cx} cy={cy} fill={fill} animatedProps={ap} />;
}

/** CSS `@keyframes float-particle` */
export function HtmlFloatDot({
  cx,
  cy,
  baseR,
  fill,
  fo,
  durMs,
  delayMs,
}: {
  cx: number;
  cy: number;
  baseR: number;
  fill: string;
  fo: number;
  durMs: number;
  delayMs: number;
}) {
  const scale = useSharedValue(1);
  const op = useSharedValue(fo);
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
    };
    const t = setTimeout(run, delayMs);
    return () => clearTimeout(t);
  }, [durMs, delayMs, fo]);
  const ap = useAnimatedProps(() => ({ r: baseR * scale.value, opacity: op.value }));
  return <AnimatedCircle cx={cx} cy={cy} fill={fill} animatedProps={ap} />;
}

/** Stroke ring / circle with HTML flicker + optional fill. */
export function HtmlFlickerStrokeCircle({
  cx,
  cy,
  r,
  stroke,
  strokeWidth,
  fill = "none",
  fo,
  flickerMs,
  delayMs,
}: {
  cx: number;
  cy: number;
  r: number;
  stroke: string;
  strokeWidth: number;
  fill?: string;
  fo: number;
  flickerMs: number;
  delayMs: number;
}) {
  const op = useHtmlFlickerFo(flickerMs, fo, delayMs);
  const ap = useAnimatedProps(() => ({ opacity: op.value }));
  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      animatedProps={ap}
    />
  );
}
