import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface RecoveryBannerProps {
  daysRemaining: number;
  reason: string;
}

const RECOVERY_LABELS: Record<string, string> = {
  life: "Easing back in — reduced load for",
  motivation: "Building momentum — quick wins for",
  forgot: "Familiar ground — core habits for",
  break: "Stepping back in — lighter missions for",
  unsure: "Starting simple —",
};

export function RecoveryBanner({ daysRemaining, reason }: RecoveryBannerProps) {
  if (daysRemaining <= 0) return null;

  const label = RECOVERY_LABELS[reason] ?? "Recovery mode —";
  const dayWord = daysRemaining === 1 ? "day" : "days";

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={["rgba(139,92,246,0.06)", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.dot} />
      <Text style={styles.text}>
        {label}{" "}
        <Text style={styles.highlight}>
          {daysRemaining} more {dayWord}
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 4,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.1)",
    marginHorizontal: 0,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(167,139,250,0.5)",
    flexShrink: 0,
  },
  text: {
    fontSize: 11,
    color: "rgba(167,139,250,0.5)",
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  highlight: {
    color: "rgba(167,139,250,0.8)",
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
