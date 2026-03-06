/**
 * Difficulty chip for MissionCard §2.2 — Easy / Medium / Hard.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, RADIUS } from "../constants/theme";

const DIFFICULTY_STYLES: Record<
  "Easy" | "Medium" | "Hard",
  { bg: string; border: string; text: string }
> = {
  Easy: {
    bg: "rgba(107,114,128,0.1)",
    border: "#374151",
    text: COLORS.muted,
  },
  Medium: {
    bg: "rgba(139,92,246,0.1)",
    border: COLORS.violet,
    text: COLORS.violet,
  },
  Hard: {
    bg: "rgba(127,29,29,0.15)",
    border: COLORS.danger,
    text: "#FCA5A5",
  },
};

type Props = {
  level: "Easy" | "Medium" | "Hard";
};

export function DifficultyChip({ level }: Props) {
  const s = DIFFICULTY_STYLES[level];
  return (
    <View style={[styles.chip, { backgroundColor: s.bg, borderColor: s.border }]}>
      <Text style={[styles.label, { color: s.text }]}>{level}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    fontWeight: "500",
  },
});
