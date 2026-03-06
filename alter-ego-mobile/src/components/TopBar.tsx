/**
 * Top Bar §2.7 — Fixed bar: username + stage title (left), Power Score (right).
 * Glass background with BlurView. No streak (streak lives in heatmap only).
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SPACING } from "../constants/theme";

const BAR_HEIGHT = 56;

export interface TopBarProps {
  username: string;
  stageTitle: string;
  powerScore: number;
}

export function TopBar({ username, stageTitle, powerScore }: TopBarProps) {
  const insets = useSafeAreaInsets();

  const barContent = (
    <View style={[styles.bar, { paddingHorizontal: SPACING.screenPadding }]}>
      <View style={styles.left}>
        <Text style={styles.username} numberOfLines={1}>
          {username}
        </Text>
        <Text style={styles.stageTitle} numberOfLines={1}>
          {stageTitle}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.powerLabel}>POWER</Text>
        <Text style={styles.powerScore}>{powerScore}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top, height: insets.top + BAR_HEIGHT }]}>
      <BlurView
        intensity={10}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: COLORS.glass,
            borderBottomWidth: 1,
            borderBottomColor: COLORS.glassBorder,
          },
        ]}
      />
      {barContent}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
  },
  bar: {
    height: BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  username: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
  stageTitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  right: {
    alignItems: "flex-end",
    justifyContent: "center",
    marginLeft: SPACING.md,
  },
  powerLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: COLORS.muted,
    letterSpacing: 0.3,
  },
  powerScore: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: COLORS.violet,
    marginTop: 2,
  },
});
