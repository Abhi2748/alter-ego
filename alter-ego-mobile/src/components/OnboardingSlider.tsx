/**
 * Onboarding hours slider §2.4 — 0.5h–6h (or configurable), step 0.5.
 * Track #1E2333, fill gradient, thumb 24×24 #8B5CF6. Min/max labels aligned with track ends.
 */

import React, { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, Dimensions, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SHADOWS } from "../constants/theme";

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 24;
const TRACK_INSET = 16;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CONTAINER_PADDING = 16;
const TRACK_WIDTH = SCREEN_WIDTH - CONTAINER_PADDING * 2 - TRACK_INSET * 2 - 32;

type Props = {
  min: number;
  max: number;
  step: number;
  value: number;
  onValueChange: (value: number) => void;
};

function clampToStep(val: number, min: number, max: number, step: number): number {
  const stepped = Math.round((val - min) / step) * step + min;
  return Math.min(max, Math.max(min, stepped));
}

export function OnboardingSlider({ min, max, step, value, onValueChange }: Props) {
  const [displayValue, setDisplayValue] = useState(value);
  const containerWidthRef = useRef(0);

  React.useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const valueToPercent = useCallback(
    (v: number) => (v - min) / (max - min),
    [min, max]
  );

  const percentToValue = useCallback(
    (p: number) => clampToStep(min + p * (max - min), min, max, step),
    [min, max, step]
  );

  const trackLeftFromContainer = useCallback(() => {
    const w = containerWidthRef.current;
    const wrapWidth = TRACK_WIDTH + TRACK_INSET * 2;
    const innerWidth = w - CONTAINER_PADDING * 2;
    if (innerWidth <= 0) return CONTAINER_PADDING + TRACK_INSET;
    const wrapLeft = CONTAINER_PADDING + (innerWidth - wrapWidth) / 2;
    return wrapLeft + TRACK_INSET;
  }, []);

  const handleTouch = useCallback(
    (locationX: number) => {
      const trackLeft = trackLeftFromContainer();
      const fraction = Math.max(0, Math.min(1, (locationX - trackLeft) / TRACK_WIDTH));
      const next = percentToValue(fraction);
      setDisplayValue(next);
      onValueChange(next);
    },
    [percentToValue, onValueChange, trackLeftFromContainer]
  );

  const handleTrackPress = useCallback(
    (e: { nativeEvent: { locationX: number } }) => {
      const locX = e.nativeEvent?.locationX ?? 0;
      const fraction = Math.max(0, Math.min(1, locX / TRACK_WIDTH));
      const next = percentToValue(fraction);
      setDisplayValue(next);
      onValueChange(next);
    },
    [percentToValue, onValueChange]
  );

  const onResponderGrant = useCallback(
    (e: { nativeEvent: { locationX: number } }) => {
      const x = e.nativeEvent?.locationX;
      if (typeof x === "number") handleTouch(x);
    },
    [handleTouch]
  );

  const onResponderMove = useCallback(
    (e: { nativeEvent: { locationX: number } }) => {
      const x = e.nativeEvent?.locationX;
      if (typeof x === "number") handleTouch(x);
    },
    [handleTouch]
  );

  const onResponderRelease = useCallback(
    (e: { nativeEvent: { locationX: number } }) => {
      const x = e.nativeEvent?.locationX;
      if (typeof x === "number") handleTouch(x);
    },
    [handleTouch]
  );

  const percent = valueToPercent(displayValue);
  const thumbX = percent * (TRACK_WIDTH - THUMB_SIZE);
  const fillWidthPct = percent * 100;

  return (
    <View
      style={styles.container}
      collapsable={false}
      onLayout={(e) => {
        containerWidthRef.current = e.nativeEvent.layout.width;
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={onResponderGrant}
      onResponderMove={onResponderMove}
      onResponderRelease={onResponderRelease}
    >
      <Text style={styles.valueLabel}>{displayValue}h</Text>

      <View style={styles.trackWrap}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${fillWidthPct}%` }]}>
            <LinearGradient
              colors={[COLORS.violetDeep, COLORS.violet]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        </View>
        <Pressable
          style={styles.trackPressable}
          onPressIn={handleTrackPress}
        />
        <View style={[styles.thumb, { left: TRACK_INSET + thumbX }]} pointerEvents="none">
          <View style={styles.thumbInner} />
        </View>
      </View>

      <View style={styles.labelsWrap}>
        <Text style={styles.minMaxLabel}>{min}h</Text>
        <Text style={styles.minMaxLabel}>{max}h</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: CONTAINER_PADDING,
    minHeight: 44,
  },
  valueLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
    textAlign: "center",
  },
  trackWrap: {
    width: TRACK_WIDTH + TRACK_INSET * 2,
    height: 44,
    justifyContent: "center",
    alignSelf: "center",
  },
  track: {
    position: "absolute",
    left: TRACK_INSET,
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    backgroundColor: COLORS.surface2,
    borderRadius: 2,
    overflow: "hidden",
  },
  trackPressable: {
    position: "absolute",
    left: TRACK_INSET,
    width: TRACK_WIDTH,
    height: 44,
    top: 0,
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
    overflow: "hidden",
  },
  thumb: {
    position: "absolute",
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: COLORS.violet,
    borderWidth: 2,
    borderColor: COLORS.violetGlow,
    ...SHADOWS.violetGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbInner: {
    width: THUMB_SIZE - 4,
    height: THUMB_SIZE - 4,
    borderRadius: (THUMB_SIZE - 4) / 2,
  },
  labelsWrap: {
    width: TRACK_WIDTH + TRACK_INSET * 2,
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: TRACK_INSET,
    marginTop: 8,
  },
  minMaxLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.muted,
  },
});
