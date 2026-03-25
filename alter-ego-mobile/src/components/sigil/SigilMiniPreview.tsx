import React from "react";
import { View } from "react-native";
import { SIGIL_LEVELS } from "@/constants/sigils";

/**
 * STATIC preview — no Reanimated, no animated sigil SVG.
 * Profile header / nav only; full animated sigil is SigilScreen only.
 */
export function SigilMiniPreview({ level, size = 24 }: { level: number; size?: number }) {
  const L = Math.min(10, Math.max(1, level));
  const meta = SIGIL_LEVELS[L - 1];
  const dotSize = Math.round(size * 0.35);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${meta.accentColor}22`,
        borderWidth: 1.5,
        borderColor: meta.accentColor,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: meta.accentColor,
        }}
      />
    </View>
  );
}
