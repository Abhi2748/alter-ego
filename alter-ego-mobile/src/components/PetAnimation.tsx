/**
 * Static companion image by pet stage (1–8). No video, roaming, or touch react.
 */

import React from "react";
import { View, Image, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { getPetImageSource } from "@/constants/characterPetAssets";

export interface PetAnimationProps {
  stage: number;
  /** Kept for API compatibility; sad = slightly lower opacity. */
  isHappy: boolean;
  size?: number;
  variant?: "violet" | "white";
  style?: StyleProp<ViewStyle>;
}

export function PetAnimation({
  stage,
  isHappy,
  size = 120,
  variant = "violet",
  style,
}: PetAnimationProps) {
  const s = Math.min(8, Math.max(1, stage));
  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, opacity: isHappy ? 1 : 0.65 },
        variant === "white" && styles.whiteVariant,
        style,
      ]}
    >
      <Image
        source={getPetImageSource(s)}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  whiteVariant: {
    opacity: 0.95,
  },
});
