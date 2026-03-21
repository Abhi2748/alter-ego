import React from "react";
import { View } from "react-native";
import { SIGIL_LEVELS } from "@/constants/sigils";
import { SigilRenderer } from "./SigilRenderer";

export function SigilMiniPreview({ level, size = 24 }: { level: number; size?: number }) {
  const L = Math.min(10, Math.max(1, level));
  const meta = SIGIL_LEVELS[L - 1];
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <SigilRenderer
        level={L}
        size={size}
        accentColor={meta.accentColor}
        accentColor2={meta.accentColor2}
      />
    </View>
  );
}
