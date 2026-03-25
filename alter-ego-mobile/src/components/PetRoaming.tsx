/**
 * Pet Roaming — Home screen only. Absolutely positioned pet that moves between points.
 * State machine: IDLE (8–15s) → MOVING (60–120 px/s) → IDLE (3–8s pause). Touch: react then return to hero.
 * §2.3–2.4. Placeholder: walk cycle to 2–3 random positions.
 */

import React, { useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { PetAnimation } from "./PetAnimation";

const PET_SIZE = 80;
const EDGE_MARGIN = 40;
const BOTTOM_NAV_EXCLUSION = 80;
const IDLE_MIN_S = 8;
const IDLE_MAX_S = 15;
const PAUSE_MIN_S = 3;
const PAUSE_MAX_S = 8;
const SPEED_MIN = 60;
const SPEED_MAX = 120;
const REACT_RETURN_DURATION_MS = 600;
const REACT_SPRING_CONFIG = { damping: 15, stiffness: 200 };
const HIT_SLOP = { top: 20, bottom: 20, left: 20, right: 20 };

function randomBetween(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export type PetRoamingProps = {
  /** Container width from onLayout. */
  containerWidth: number;
  /** Container height from onLayout. */
  containerHeight: number;
  /** Hero zone X (top-left of pet when at character). */
  heroX: number;
  /** Hero zone Y. */
  heroY: number;
  stage?: number;
  isHappy?: boolean;
  /** Opacity override for absence state (e.g. 0.6 when user absent 2+ days). */
  absenceOpacity?: number;
};

export function PetRoaming({
  containerWidth,
  containerHeight,
  heroX,
  heroY,
  stage = 1,
  isHappy = true,
}: PetRoamingProps) {
  const posX = useSharedValue(heroX);
  const posY = useSharedValue(heroY);
  const scale = useSharedValue(1);
  const isReturning = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const safeWidth = Math.max(0, containerWidth - EDGE_MARGIN * 2 - PET_SIZE);
  const safeHeight = Math.max(
    0,
    containerHeight - EDGE_MARGIN - BOTTOM_NAV_EXCLUSION - PET_SIZE
  );

  const pickDestination = useCallback(() => {
    const x = EDGE_MARGIN + Math.random() * safeWidth;
    const y = EDGE_MARGIN + Math.random() * safeHeight;
    return { x, y };
  }, [safeWidth, safeHeight]);

  const startMoving = useCallback(() => {
    if (safeWidth <= 0 || safeHeight <= 0) return;
    const { x, y } = pickDestination();
    const dx = x - posX.value;
    const dy = y - posY.value;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const speed = randomBetween(SPEED_MIN, SPEED_MAX);
    const durationMs = (distance / speed) * 1000;

    posX.value = withTiming(
      x,
      {
        duration: Math.max(300, durationMs),
        easing: Easing.inOut(Easing.quad),
      },
      (finished) => {
        if (finished) runOnJS(onArrival)();
      }
    );
    posY.value = withTiming(y, {
      duration: Math.max(300, durationMs),
      easing: Easing.inOut(Easing.quad),
    });
  }, [safeWidth, safeHeight, pickDestination]);

  const onArrival = useCallback(() => {
    if (isReturning.value === 1) {
      isReturning.value = 0;
    }
    const pauseMs = randomBetween(PAUSE_MIN_S, PAUSE_MAX_S) * 1000;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      startMoving();
    }, pauseMs);
  }, [startMoving]);

  useEffect(() => {
    if (safeWidth <= 0 || safeHeight <= 0) return;
    const idleMs = randomBetween(IDLE_MIN_S, IDLE_MAX_S) * 1000;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      startMoving();
    }, idleMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [safeWidth, safeHeight, startMoving]);

  const resumeAfterReturn = useCallback(() => {
    isReturning.value = 0;
    const idleMs = randomBetween(IDLE_MIN_S, IDLE_MAX_S) * 1000;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      startMoving();
    }, idleMs);
  }, [startMoving]);

  const returnToHero = useCallback(
    (opts?: { durationMs: number; easing: (t: number) => number }) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      isReturning.value = 1;
      const duration =
        opts?.durationMs != null
          ? opts.durationMs
          : (() => {
              const dx = heroX - posX.value;
              const dy = heroY - posY.value;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const speed = randomBetween(SPEED_MIN, SPEED_MAX);
              return Math.max(300, (distance / speed) * 1000);
            })();
      const easing = opts?.easing ?? Easing.inOut(Easing.quad);

      posX.value = withTiming(heroX, { duration, easing });
      posY.value = withTiming(
        heroY,
        {
          duration,
          easing,
        },
        (finished) => {
          if (finished) runOnJS(resumeAfterReturn)();
        }
      );
    },
    [heroX, heroY, resumeAfterReturn]
  );

  const returnToHeroFromTouch = useCallback(() => {
    returnToHero({
      durationMs: REACT_RETURN_DURATION_MS,
      easing: Easing.out(Easing.ease),
    });
  }, [returnToHero]);

  const handlePress = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    scale.value = withSequence(
      withSpring(1.2, REACT_SPRING_CONFIG),
      withSpring(1, REACT_SPRING_CONFIG, (finished) => {
        if (finished) runOnJS(returnToHeroFromTouch)();
      })
    );
  }, [returnToHeroFromTouch]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: posX.value },
      { translateY: posY.value },
      { scale: scale.value },
    ],
    opacity: wrapOpacity.value,
  }));

  return (
    <Animated.View
      style={[styles.absoluteWrap, animatedStyle]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={handlePress}
        hitSlop={HIT_SLOP}
        style={styles.pressable}
      >
        <PetAnimation stage={stage} isHappy={isHappy} size={PET_SIZE} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  absoluteWrap: {
    position: "absolute",
    left: 0,
    top: 0,
    width: PET_SIZE,
    height: PET_SIZE,
    zIndex: 10,
  },
  pressable: {
    width: PET_SIZE,
    height: PET_SIZE,
  },
});
