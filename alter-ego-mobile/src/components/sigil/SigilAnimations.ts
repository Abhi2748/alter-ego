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
          withTiming(1.035, { duration: durationMs / 2, easing: Easing.inOut(Easing.ease) }),
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

/** HTML-like ambient-breathe / canvas-glow timing; subtle scale so glow stays locked to canvas */
const PRESET_DEFAULTS: Record<
  string,
  { duration: number; minOp: number; maxOp: number; minSc: number; maxSc: number }
> = {
  ambient: { duration: 5000, minOp: 0.52, maxOp: 0.88, minSc: 0.992, maxSc: 1.028 },
  glow1: { duration: 4000, minOp: 0.58, maxOp: 1.0, minSc: 0.985, maxSc: 1.038 },
  glow2: { duration: 6000, minOp: 0.5, maxOp: 0.92, minSc: 0.98, maxSc: 1.032 },
  halo: { duration: 3200, minOp: 0.55, maxOp: 0.95, minSc: 0.988, maxSc: 1.042 },
};

export function useRadialGlowPulse(
  preset: "ambient" | "glow1" | "glow2" | "halo",
  durationMs?: number,
  delayMs = 0
) {
  const def0 = PRESET_DEFAULTS[preset] ?? PRESET_DEFAULTS.glow1;
  const opacity = useSharedValue(def0.minOp);
  const scale = useSharedValue(1.0);
  useEffect(() => {
    const p = PRESET_DEFAULTS[preset] ?? PRESET_DEFAULTS.glow1;
    const dur = durationMs ?? p.duration;
    const start = () => {
      opacity.value = withRepeat(
        withSequence(
          withTiming(p.maxOp, { duration: dur / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(p.minOp, { duration: dur / 2, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      scale.value = withRepeat(
        withSequence(
          withTiming(p.maxSc, { duration: dur / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(p.minSc, { duration: dur / 2, easing: Easing.inOut(Easing.ease) })
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
  }, [preset, durationMs, delayMs]);
  return { opacity, scale };
}
