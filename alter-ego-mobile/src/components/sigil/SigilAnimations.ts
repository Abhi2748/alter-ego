import { useEffect } from "react";
import {
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";

export const HTML_SVG_PULSE_CX = 170;
export const HTML_SVG_PULSE_CY = 170;

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
    return undefined;
  }, [durationMs, reverse, delayMs]);
  return r;
}

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
  return { op, sc };
}

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
  return { op, sc };
}

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
    return undefined;
  }, [durationMs, fo, delayMs]);
  return op;
}

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
  }, [baseR, durationMs, factor, rv]);
  return rv;
}

export function useGlowPulse(durationMs: number, minOp = 0.6, maxOp = 1.0, delayMs = 0) {
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
    return undefined;
  }, [durationMs, minOp, maxOp, delayMs]);
  return { opacity, scale };
}
