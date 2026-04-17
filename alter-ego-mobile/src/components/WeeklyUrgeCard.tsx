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
  competingResponse?: string | null;
  onSave: (
    pathId: string,
    level: UrgeLevel,
    strategyHelped: "yes" | "partially" | "no" | null
  ) => void;
  onDismiss: (pathId: string) => void;
}

export function WeeklyUrgeCard({
  habitName,
  pathId,
  competingResponse,
  onSave,
  onDismiss,
}: Props) {
  const [urgeSelected, setUrgeSelected] = useState<UrgeLevel | null>(null);
  const [strategyHelped, setStrategyHelped] = useState<"yes" | "partially" | "no" | null>(null);

  const handleUrgeSelect = (level: UrgeLevel) => {
    setUrgeSelected(level);
  };

  const handleSave = () => {
    if (!urgeSelected) return;
    onSave(pathId, urgeSelected, strategyHelped);
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
          <Text style={styles.eyebrow}>🔥 Weekly Check-in</Text>
          <Pressable onPress={() => onDismiss(pathId)} hitSlop={8}>
            <Text style={styles.dismiss}>Dismiss</Text>
          </Pressable>
        </View>

        <Text style={styles.question}>
          This week with <Text style={styles.habitHighlight}>{habitName}</Text>
          {" "}—{"\n"}how strong were the urges?
        </Text>

        <View style={[styles.scale, { marginBottom: 16 }]}>
          {URGE_OPTIONS.map((opt) => {
            const isOn = urgeSelected === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => handleUrgeSelect(opt.value)}
                style={[styles.opt, isOn && styles.optOn]}
              >
                <Text style={styles.emoji}>{opt.emoji}</Text>
                <Text style={[styles.label, isOn && styles.labelOn]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.stratSection}>
          <Text style={styles.stratQ}>Did your strategy help this week?</Text>
          {competingResponse ? (
            <Text style={styles.stratHint} numberOfLines={2}>
              Your strategy: {competingResponse}
            </Text>
          ) : null}
          <View style={styles.stratRow}>
            {(
              [
                { val: "yes" as const, label: "✓ Helped", activeStyle: styles.stratYes, activeText: styles.stratYesTxt },
                {
                  val: "partially" as const,
                  label: "~ Partially",
                  activeStyle: styles.stratPartial,
                  activeText: styles.stratPartialTxt,
                },
                { val: "no" as const, label: "✗ Didn't", activeStyle: styles.stratNo, activeText: styles.stratNoTxt },
              ] as const
            ).map(({ val, label, activeStyle, activeText }) => {
              const isOn = strategyHelped === val;
              return (
                <Pressable
                  key={val}
                  onPress={() => setStrategyHelped(isOn ? null : val)}
                  style={[styles.stratBtn, isOn && activeStyle]}
                >
                  <Text style={[styles.stratBtnTxt, isOn && activeText]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          style={[styles.saveBtn, !urgeSelected && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!urgeSelected}
        >
          <Text style={styles.saveBtnTxt}>Save check-in</Text>
        </Pressable>
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

  stratSection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(249,115,22,0.08)",
    paddingTop: 12,
    marginBottom: 14,
  },
  stratQ: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    marginBottom: 6,
    fontFamily: "Inter_700Bold",
  },
  stratHint: {
    fontSize: 9,
    color: "rgba(249,115,22,0.38)",
    fontStyle: "italic",
    marginBottom: 8,
    lineHeight: 13,
    fontFamily: "Inter_400Regular",
  },
  stratRow: { flexDirection: "row", gap: 6 },
  stratBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.45)",
    backgroundColor: "rgba(42,48,80,0.25)",
    alignItems: "center",
  },
  stratBtnTxt: {
    fontSize: 10,
    fontWeight: "700",
    color: "#374151",
    fontFamily: "Inter_700Bold",
  },
  stratYes: {
    backgroundColor: "rgba(74,222,128,0.12)",
    borderColor: "rgba(74,222,128,0.30)",
  },
  stratYesTxt: { color: "#4ADE80" },
  stratPartial: {
    backgroundColor: "rgba(245,158,11,0.10)",
    borderColor: "rgba(245,158,11,0.25)",
  },
  stratPartialTxt: { color: "#F59E0B" },
  stratNo: {
    backgroundColor: "rgba(42,48,80,0.50)",
    borderColor: "rgba(42,48,80,0.70)",
  },
  stratNoTxt: { color: "#6B7280" },

  saveBtn: {
    borderRadius: 11,
    paddingVertical: 11,
    backgroundColor: "rgba(109,40,217,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: { backgroundColor: "rgba(42,48,80,0.4)" },
  saveBtnTxt: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
});
