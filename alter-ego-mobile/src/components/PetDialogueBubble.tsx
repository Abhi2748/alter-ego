import React, { useEffect, useMemo } from "react";
import { Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/** Ideal width from screen size; clamped by maxWidth so left edge stays on-screen. */
function idealBubbleWidth(screenW: number) {
  return Math.min(318, Math.max(260, screenW * 0.82));
}

const MIN_BUBBLE_W = 168;

type PetDialogueBubbleProps = {
  visible: boolean;
  text: string;
  /** Distance from overlay right to pet column center (for tail aim). */
  tailCenterFromRight?: number;
  /** Distance from hero row bottom to bubble wrap bottom (larger = bubble sits higher). */
  wrapBottom?: number;
  /** Max width so bubble does not extend past safe left inset (from measureInWindow). */
  maxWidth?: number;
};

const TAIL_HALF_W = 9;

export default function PetDialogueBubble({
  visible,
  text,
  tailCenterFromRight = 42,
  wrapBottom = 112,
  maxWidth,
}: PetDialogueBubbleProps) {
  const { width: winW } = useWindowDimensions();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);

  const bubbleW = useMemo(() => {
    const ideal = idealBubbleWidth(winW);
    const capped = maxWidth != null ? Math.min(ideal, maxWidth) : ideal;
    return Math.max(MIN_BUBBLE_W, capped);
  }, [winW, maxWidth]);

  const wrapStyle = useMemo(
    () => [styles.wrap, { width: bubbleW, bottom: wrapBottom }],
    [bubbleW, wrapBottom]
  );

  const tailWrapRight = Math.max(TAIL_HALF_W, tailCenterFromRight - TAIL_HALF_W);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
      translateY.value = withTiming(0, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    opacity.value = withTiming(0, {
      duration: 180,
      easing: Easing.in(Easing.cubic),
    });
    translateY.value = withTiming(6, {
      duration: 180,
      easing: Easing.in(Easing.cubic),
    });
  }, [opacity, translateY, visible, text]);

  const bubbleAnimStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[wrapStyle, bubbleAnimStyle]}>
      <View style={styles.bubble}>
        <Text
          style={styles.label}
          numberOfLines={1}
          ellipsizeMode="tail"
          maxFontSizeMultiplier={1.25}
        >
          Companion
        </Text>
        <Text
          style={styles.text}
          maxFontSizeMultiplier={1.35}
          {...(Platform.OS === "android" ? { textBreakStrategy: "simple" as const } : {})}
        >
          {text}
        </Text>
      </View>
      <View style={[styles.tailWrap, { right: tailWrapRight }]}>
        <View style={styles.tailOuter} />
        <View style={styles.tailInner} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /** Anchored to hero row right; explicit width avoids narrow parent text layout */
  wrap: {
    position: "absolute",
    right: 0,
    zIndex: 20,
  },
  tailWrap: {
    position: "absolute",
    bottom: -10,
    width: TAIL_HALF_W * 2,
    minHeight: 11,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bubble: {
    width: "100%",
    backgroundColor: "rgba(12,10,20,0.88)",
    borderColor: "rgba(139,92,246,0.62)",
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: "#8B5CF6",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  label: {
    color: "rgba(167,139,250,0.84)",
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 0.6,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  text: {
    color: "#E5E7EB",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  tailOuter: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 11,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "rgba(139,92,246,0.62)",
  },
  tailInner: {
    position: "absolute",
    bottom: 2,
    marginLeft: 1,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "rgba(12,10,20,0.88)",
  },
});
