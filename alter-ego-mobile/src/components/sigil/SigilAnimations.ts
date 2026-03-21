import { useEffect } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";

const CX = 170;
const CY = 170;

/** Linear spin; optional delay matches CSS `animation-delay` start. */
export function useRotation(durationMs: number, reverse = false, delayMs = 0) {
  const r = useSharedValue(0);
  useEffect(() => {
    const run = () => {
      r.value = withRepeat(
        withTiming(reverse ? -360 : 360, { duration: durationMs, easing: Easing.linear }),
        -1,
        false
      );
    };
    if (delayMs > 0) {
      const t = setTimeout(run, delayMs);
      return () => clearTimeout(t);
    }
    run();
  }, [durationMs, reverse, delayMs]);
  return r;
}

/** CSS `pulse` on root SVG: opacity 0.55↔1, scale 1↔1.05, ease-in-out. */
export function useHtmlSvgPulse(durationMs: number) {
  const op = useSharedValue(0.55);
  const sc = useSharedValue(1);
  useEffect(() => {
    const half = durationMs / 2;
    op.value = withRepeat(
      withSequence(
        withTiming(1, { duration: half, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.55, { duration: half, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    sc.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: half, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: half, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [durationMs]);
  return useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [
      { translateX: CX },
      { translateY: CY },
      { scale: sc.value },
      { translateX: -CX },
      { translateY: -CY },
    ],
  }));
}

/** CSS `pulse-s`: opacity 0.7↔1, scale 1↔1.04. */
export function useHtmlSvgPulseS(durationMs: number) {
  const op = useSharedValue(0.7);
  const sc = useSharedValue(1);
  useEffect(() => {
    const half = durationMs / 2;
    op.value = withRepeat(
      withSequence(
        withTiming(1, { duration: half, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.7, { duration: half, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    sc.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: half, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: half, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [durationMs]);
  return useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [
      { translateX: CX },
      { translateY: CY },
      { scale: sc.value },
      { translateX: -CX },
      { translateY: -CY },
    ],
  }));
}

/**
 * CSS `@keyframes flicker` with `--fo`: 0%/100% fo, 35% 1, 72% fo*0.45
 */
export function useHtmlFlickerFo(durationMs: number, fo: number, delayMs = 0) {
  const op = useSharedValue(fo);
  useEffect(() => {
    const run = () => {
      op.value = withRepeat(
        withSequence(
          withTiming(1, { duration: durationMs * 0.35, easing: Easing.inOut(Easing.ease) }),
          withTiming(fo * 0.45, { duration: durationMs * 0.37, easing: Easing.inOut(Easing.ease) }),
          withTiming(fo, { duration: durationMs * 0.28, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    };
    if (delayMs > 0) {
      const t = setTimeout(run, delayMs);
      return () => clearTimeout(t);
    }
    run();
  }, [durationMs, fo, delayMs]);
  return op;
}

/** CSS `breathe-s`: scale 1 → 1.06 → 1 on radius. */
export function useHtmlBreatheR(baseR: number, durationMs: number, factor = 1.06) {
  const rv = useSharedValue(baseR);
  useEffect(() => {
    const half = durationMs / 2;
    rv.value = withRepeat(
      withSequence(
        withTiming(baseR * factor, { duration: half, easing: Easing.inOut(Easing.ease) }),
        withTiming(baseR, { duration: half, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [baseR, durationMs, factor]);
  return rv;
}

export function usePulse(durationMs: number, min = 0.97, max = 1.06) {
  const s = useSharedValue(min);
  useEffect(() => {
    s.value = withRepeat(
      withSequence(
        withTiming(max, { duration: durationMs / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(min, { duration: durationMs / 2, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);
  return s;
}

export function useFlicker(durationMs: number, minOp: number, maxOp: number, delayMs = 0) {
  const op = useSharedValue(minOp);
  useEffect(() => {
    const t = setTimeout(() => {
      op.value = withRepeat(
        withSequence(
          withTiming(maxOp, { duration: durationMs * 0.35 }),
          withTiming(minOp * 0.45, { duration: durationMs * 0.37 }),
          withTiming(minOp, { duration: durationMs * 0.28 })
        ),
        -1,
        false
      );
    }, delayMs);
    return () => clearTimeout(t);
  }, []);
  return op;
}

export function useBreathe(durationMs: number) {
  return usePulse(durationMs, 1.0, 1.1);
}

export function useGlowPulse(
  durationMs: number,
  minOp = 0.6,
  maxOp = 1.0,
  delayMs = 0
) {
  const opacity = useSharedValue(minOp);
  const scale = useSharedValue(1.0);
  useEffect(() => {
    const start = () => {
      opacity.value = withRepeat(
        withSequence(
          withTiming(maxOp, { duration: durationMs / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(minOp, { duration: durationMs / 2, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      scale.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: durationMs / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: durationMs / 2, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    };
    if (delayMs > 0) {
      const t = setTimeout(start, delayMs);
      return () => clearTimeout(t);
    }
    start();
  }, []);
  return { opacity, scale };
}
