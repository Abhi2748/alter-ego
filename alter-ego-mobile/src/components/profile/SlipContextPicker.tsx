/**
 * SlipContextPicker — Post-slip trigger context collector.
 * Shown after user increments frequency count. Optional and dismissable.
 */
import React, { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

const CONTEXT_OPTIONS = [
  "Stressed",
  "Bored",
  "Anxious",
  "Late at night",
  "With friends",
  "After a meal",
  "Emotional",
  "On autopilot",
];

interface Props {
  visible: boolean;
  habitName: string;
  onSave: (tags: string[], freeText?: string) => void;
  onSkip: () => void;
}

export function SlipContextPicker({ visible, habitName, onSave, onSkip }: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const inputRef = useRef<TextInput>(null);

  const toggle = useCallback((chip: string) => {
    setSelected((prev) => (prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]));
  }, []);

  const handleSave = useCallback(() => {
    onSave(selected, freeText.trim() || undefined);
    setSelected([]);
    setFreeText("");
  }, [selected, freeText, onSave]);

  const handleSkip = useCallback(() => {
    setSelected([]);
    setFreeText("");
    onSkip();
  }, [onSkip]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleSkip}>
      <Pressable style={styles.backdrop} onPress={handleSkip} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 28 }]} onStartShouldSetResponder={() => true}>
        <View style={styles.topGlow} />
        <View style={styles.handle} />

        <Text style={styles.eyebrow}>🔥 {habitName}</Text>
        <Text style={styles.question}>
          What was happening{"\n"}right before?
        </Text>
        <Text style={styles.sub}>Optional · 10 seconds · makes missions smarter</Text>

        <View style={styles.chipGrid}>
          {CONTEXT_OPTIONS.map((opt) => {
            const on = selected.includes(opt);
            return (
              <Pressable
                key={opt}
                onPress={() => toggle(opt)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt}</Text>
              </Pressable>
            );
          })}
          <Pressable style={[styles.chip, styles.chipOther]} onPress={() => inputRef.current?.focus()}>
            <Text style={styles.chipOtherText}>+ Other</Text>
          </Pressable>
        </View>

        <TextInput
          ref={inputRef}
          style={styles.freeInput}
          placeholder="What happened right before the urge? Mention place, people, emotion, or time."
          placeholderTextColor="rgba(249,115,22,0.2)"
          value={freeText}
          onChangeText={setFreeText}
          maxLength={400}
          multiline
          numberOfLines={3}
          returnKeyType="done"
        />

        <View style={styles.btnRow}>
          <Pressable style={styles.skipBtn} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
          <Pressable style={styles.saveBtn} onPress={handleSave}>
            <LinearGradient
              colors={["#7C2D12", "#EA580C", "#F97316"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtnGrad}
            >
              <Text style={styles.saveText}>Save context →</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.78)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#150C04",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "rgba(249,115,22,0.22)",
    paddingHorizontal: 22,
    paddingTop: 16,
    overflow: "hidden",
  },
  topGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: "rgba(249,115,22,0.04)",
  },
  handle: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(249,115,22,0.2)",
    alignSelf: "center",
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(249,115,22,0.4)",
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  question: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 24,
    fontWeight: "900",
    color: "#E5E7EB",
    lineHeight: 30,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  sub: {
    fontSize: 12,
    color: "rgba(249,115,22,0.35)",
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    marginBottom: 20,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: "rgba(249,115,22,0.06)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.13)",
  },
  chipOn: {
    backgroundColor: "rgba(249,115,22,0.16)",
    borderColor: "rgba(249,115,22,0.45)",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(253,186,116,0.45)",
    fontFamily: "Inter_600SemiBold",
  },
  chipTextOn: { color: "#FB923C" },
  chipOther: {
    backgroundColor: "transparent",
    borderColor: "rgba(249,115,22,0.1)",
  },
  chipOtherText: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(249,115,22,0.25)",
    fontFamily: "Inter_500Medium",
  },
  freeInput: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.4)",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: "#E5E7EB",
    fontFamily: "Inter_400Regular",
    marginBottom: 18,
  },
  btnRow: { flexDirection: "row", gap: 10 },
  skipBtn: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4B5563",
    fontFamily: "Inter_500Medium",
  },
  saveBtn: {
    flex: 2.5,
    height: 48,
    borderRadius: 15,
    overflow: "hidden",
  },
  saveBtnGrad: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
});
