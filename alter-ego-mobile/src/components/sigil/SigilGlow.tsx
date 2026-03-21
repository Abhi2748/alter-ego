import React from "react";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useGlowPulse } from "./SigilAnimations";

interface SigilGlowProps {
  size: number;
  color: string;
  durationMs: number;
  delayMs?: number;
}

export function SigilGlow({ size, color, durationMs, delayMs = 0 }: SigilGlowProps) {
  const { opacity, scale } = useGlowPulse(durationMs, 0.6, 1.0, delayMs);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          top: "50%",
          left: "50%",
          marginTop: -(size / 2),
          marginLeft: -(size / 2),
          overflow: "hidden",
        },
        animStyle,
      ]}
    >
      <LinearGradient
        colors={[color, "transparent"]}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}
