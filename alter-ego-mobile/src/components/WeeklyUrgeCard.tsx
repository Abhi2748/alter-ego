/**
 * WeeklyUrgeCard — Weekly urge check-in for quit paths with weekly_urge_pending.
 */
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type UrgeLevel = "barely_noticed" | "manageable" | "hard" | "nearly_gave_in" | "slipped";

const URGE_OPTIONS: Array<{ value: UrgeLevel; emoji: string; label: string }> = [
  { value: "barely_noticed", emoji: "😌", label: "Barely\nthere" },
  { value: "manageable", emoji: "😤", label: "Manage-\nable" },
  { value: "hard", emoji: "😰", label: "Hard" },
  { value: "nearly_gave_in", emoji: "😵", label: "Nearly\ngave in" },
  { value: "slipped", emoji: "💥", label: "I\nslipped" },
];

interface Props {
  habitName: string;
  pathId: string;
  onSave: (pathId: string, level: UrgeLevel) => void;
  onDismiss: (pathId: string) => void;
}

export function WeeklyUrgeCard({ habitName, pathId, onSave, onDismiss }: Props) {
  const [selected, setSelected] = useState<UrgeLevel | null>(null);

  const handleSelect = (level: UrgeLevel) => {
    setSelected(level);
    setTimeout(() => onSave(pathId, level), 400);
  };

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={["transparent", "rgba(249,115,22,0.4)", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topLine}
      />
      <View style={styles.inner}>
        <View style={styles.topRow}>
          <Text style={styles.eyebrow}>🔥 Quit Check-in</Text>
          <Pressable onPress={() => onDismiss(pathId)} hitSlop={8}>
            <Text style={styles.dismiss}>Dismiss</Text>
          </Pressable>
        </View>
        <Text style={styles.question}>
          This week with <Text style={styles.habitHighlight}>{habitName}</Text>
          {" "}—{"\n"}how strong were the urges?
        </Text>
        <View style={styles.scale}>
          {URGE_OPTIONS.map((opt) => {
            const isOn = selected === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => handleSelect(opt.value)}
                style={[styles.opt, isOn && styles.optOn]}
              >
                <Text style={styles.emoji}>{opt.emoji}</Text>
                <Text style={[styles.label, isOn && styles.labelOn]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0E0804",
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.15)",
    overflow: "hidden",
  },
  topLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  inner: { padding: 18 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(249,115,22,0.45)",
    fontFamily: "Inter_700Bold",
  },
  dismiss: {
    fontSize: 10,
    color: "#374151",
    fontFamily: "Inter_400Regular",
  },
  question: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 18,
    fontWeight: "800",
    color: "#E5E7EB",
    lineHeight: 26,
    letterSpacing: -0.2,
    marginBottom: 14,
  },
  habitHighlight: { color: "rgba(251,146,60,0.9)" },
  scale: { flexDirection: "row", gap: 5 },
  opt: {
    flex: 1,
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 3,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.3)",
    alignItems: "center",
    gap: 4,
  },
  optOn: {
    backgroundColor: "rgba(249,115,22,0.12)",
    borderColor: "rgba(249,115,22,0.38)",
  },
  emoji: { fontSize: 18, lineHeight: 22 },
  label: {
    fontSize: 7.5,
    fontWeight: "600",
    textAlign: "center",
    color: "#374151",
    lineHeight: 11,
    fontFamily: "Inter_600SemiBold",
  },
  labelOn: { color: "rgba(251,146,60,0.8)" },
});
