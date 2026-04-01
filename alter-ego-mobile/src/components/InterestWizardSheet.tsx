/**
 * Onboarding Q11 — 4-step bottom sheet: Level → Goal → Timeline → Schedule.
 * Triggered by + button or quick-pick chip. Adds OnboardingInterest on complete.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { OnboardingInterest } from "../context/OnboardingAnswersContext";

const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const TIMELINE_OPTIONS: { value: string; label: string; sub: string }[] = [
  { value: "no_deadline", label: "No fixed deadline", sub: "Open practice — no arc pressure" },
  { value: "1_month", label: "About 1 month", sub: "Short sprint" },
  { value: "3_months", label: "About 3 months", sub: "Typical skill-building window" },
  { value: "6_months", label: "About 6 months", sub: "Steady long arc" },
  { value: "1_year", label: "About a year", sub: "Big goal on the horizon" },
];

const LEVEL_OPTIONS: { label: string; sub: string; value: "beginner" | "intermediate" | "advanced" }[] = [
  { label: "Still figuring it out", sub: "Just starting, mostly beginner", value: "beginner" },
  { label: "Getting the hang of it", sub: "Some experience, building consistency", value: "intermediate" },
  { label: "Pretty solid", sub: "Consistent practice, ready for harder stuff", value: "advanced" },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdd: (interest: OnboardingInterest) => void;
  interestName: string;
};

type Step = 1 | 2 | 3 | 4;

export function InterestWizardSheet({ visible, onClose, onAdd, interestName }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(1);
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced" | null>(null);
  const [goal, setGoal] = useState("");
  const [schedule, setSchedule] = useState<number[]>([]);
  const [timeline, setTimeline] = useState<string>("no_deadline");

  useEffect(() => {
    if (visible) {
      setStep(1);
      setLevel(null);
      setGoal("");
      setSchedule([]);
      setTimeline("no_deadline");
    }
  }, [visible, interestName]);

  const toggleDay = useCallback((i: number) => {
    setSchedule((prev) =>
      prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort((a, b) => a - b)
    );
  }, []);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleStep1Next = useCallback(() => {
    if (level !== null) setStep(2);
  }, [level]);

  const handleStep2Next = useCallback(() => {
    if (goal.trim().length >= 10) setStep(3);
  }, [goal]);

  const handleAdd = useCallback(() => {
    if (level === null || schedule.length === 0) return;
    onAdd({
      name: interestName.trim(),
      level,
      goal: goal.trim(),
      schedule: schedule.length > 0 ? schedule : [0, 2, 4],
      target_timeline: timeline,
    });
    onClose();
  }, [interestName, level, goal, schedule, timeline, onAdd, onClose]);

  if (!visible) return null;

  const scheduleSummary =
    schedule.length > 0
      ? `${schedule.length} days · ${schedule.map((i) => DAY_LABELS[i]).join(", ")}`
      : "";

  return (
    <Modal visible transparent animationType="slide">
      <Pressable style={styles.overlay} onPress={handleClose} />
      <KeyboardAvoidingView
        style={styles.sheetWrap}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} onStartShouldSetResponder={() => true}>
          <View style={styles.dragHandle} />
          <View style={styles.dots}>
            {[1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[styles.dot, i === step && styles.dotActive]}
              />
            ))}
          </View>
          <View style={styles.headerRow}>
            <Text style={styles.headerLabel}>
              STEP {step} OF 4 · <Text style={styles.headerName}>{interestName.trim() || "Interest"}</Text>
            </Text>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={12} color="#6B7280" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 1 && (
              <>
                <Text style={styles.question}>How would you describe your level?</Text>
                <Text style={styles.hint}>This sets your starting mission difficulty.</Text>
                <View style={styles.radioGroup}>
                  {LEVEL_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      onPress={() => setLevel(opt.value)}
                      style={[styles.radioCard, level === opt.value && styles.radioCardSelected]}
                    >
                      {level === opt.value && (
                        <View style={styles.accentBar}>
                          <LinearGradient
                            colors={["#8B5CF6", "#5B21B6"]}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                          />
                        </View>
                      )}
                      <Text style={[styles.radioLabel, level === opt.value && styles.radioLabelSelected]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.radioSub}>{opt.sub}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  onPress={handleStep1Next}
                  disabled={level === null}
                  style={[styles.primaryBtn, level === null && styles.primaryBtnDisabled]}
                >
                  <LinearGradient
                    colors={level !== null ? ["#5B21B6", "#8B5CF6"] : ["#2A3050", "#2A3050"]}
                    style={styles.primaryBtnGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.primaryBtnLabel}>Next</Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}

            {step === 2 && (
              <>
                <Pressable onPress={() => setStep(1)} style={styles.backLink}>
                  <Text style={styles.backLinkText}>← Back</Text>
                </Pressable>
                <Text style={styles.question}>What are you trying to achieve?</Text>
                <Text style={styles.hint}>Be specific — the more detail, the better we match missions.</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="e.g. I want to run a 5K by June. I'm at 2K right now."
                  placeholderTextColor="#4B5563"
                  value={goal}
                  onChangeText={setGoal}
                  multiline
                  maxLength={300}
                />
                <Pressable
                  onPress={handleStep2Next}
                  disabled={goal.trim().length < 10}
                  style={[styles.primaryBtn, goal.trim().length < 10 && styles.primaryBtnDisabled]}
                >
                  <LinearGradient
                    colors={goal.trim().length >= 10 ? ["#5B21B6", "#8B5CF6"] : ["#2A3050", "#2A3050"]}
                    style={styles.primaryBtnGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.primaryBtnLabel}>Next</Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}

            {step === 3 && (
              <>
                <Pressable onPress={() => setStep(2)} style={styles.backLink}>
                  <Text style={styles.backLinkText}>← Back</Text>
                </Pressable>
                <Text style={styles.question}>When do you want to reach your goal?</Text>
                <Text style={styles.hint}>Sets how your learning arc is structured. You can change this later.</Text>

                <View style={styles.radioGroup}>
                  {TIMELINE_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      onPress={() => setTimeline(opt.value)}
                      style={[styles.radioCard, timeline === opt.value && styles.radioCardSelected]}
                    >
                      {timeline === opt.value && (
                        <View style={styles.accentBar}>
                          <LinearGradient
                            colors={["#8B5CF6", "#5B21B6"]}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                          />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.radioLabel, timeline === opt.value && styles.radioLabelSelected]}>
                          {opt.label}
                        </Text>
                        <Text style={styles.radioSub}>{opt.sub}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>

                <Pressable onPress={() => setStep(4)} style={styles.primaryBtn}>
                  <LinearGradient
                    colors={["#5B21B6", "#8B5CF6"]}
                    style={styles.primaryBtnGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.primaryBtnLabel}>Next</Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}

            {step === 4 && (
              <>
                <Pressable onPress={() => setStep(3)} style={styles.backLink}>
                  <Text style={styles.backLinkText}>← Back</Text>
                </Pressable>
                <Text style={styles.question}>Which days will you show up?</Text>
                <Text style={styles.hint}>Missions only assigned on selected days.</Text>
                <View style={styles.dayGrid}>
                  {DAY_LABELS.map((label, i) => (
                    <Pressable
                      key={i}
                      onPress={() => toggleDay(i)}
                      style={[styles.dayCell, schedule.includes(i) && styles.dayCellSelected]}
                    >
                      <Text style={[styles.dayCellText, schedule.includes(i) && styles.dayCellTextSelected]}>
                        {label.slice(0, 1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.dayCount}>{scheduleSummary || "0 days"}</Text>
                <Pressable
                  onPress={handleAdd}
                  disabled={schedule.length === 0}
                  style={[styles.primaryBtn, schedule.length === 0 && styles.primaryBtnDisabled]}
                >
                  <LinearGradient
                    colors={schedule.length > 0 ? ["#5B21B6", "#8B5CF6"] : ["#2A3050", "#2A3050"]}
                    style={styles.primaryBtnGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.primaryBtnLabel}>Add Interest →</Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.70)",
  },
  sheetWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: "#111623",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(42,48,80,0.50)",
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  dragHandle: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 14,
    alignSelf: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 12,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(42,48,80,0.60)",
  },
  dotActive: {
    width: 16,
    backgroundColor: "#8B5CF6",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#374151",
  },
  headerName: { color: "#8B5CF6" },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.40)",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { maxHeight: 400 },
  scrollContent: { paddingBottom: 24 },

  question: {
    fontSize: 15,
    fontWeight: "700",
    color: "#E5E7EB",
    marginBottom: 5,
  },
  hint: {
    fontSize: 12,
    color: "#4B5563",
    marginBottom: 12,
  },
  backLink: { marginBottom: 10 },
  backLinkText: { fontSize: 12, color: "#4B5563" },

  radioGroup: { marginBottom: 16 },
  radioCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.40)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    position: "relative",
    overflow: "hidden",
  },
  radioCardSelected: {
    backgroundColor: "rgba(109,40,217,0.10)",
    borderColor: "rgba(139,92,246,0.45)",
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    overflow: "hidden",
  },
  radioLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E5E7EB",
  },
  radioLabelSelected: { color: "#C4B5FD" },
  radioSub: {
    fontSize: 12,
    color: "#4B5563",
    marginTop: 2,
  },

  textArea: {
    minHeight: 70,
    maxHeight: 140,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5,
    borderColor: "rgba(42,48,80,0.50)",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 13,
    fontSize: 13,
    color: "#E5E7EB",
    lineHeight: 20.8,
    marginBottom: 16,
    textAlignVertical: "top",
  },

  dayGrid: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 12,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.40)",
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellSelected: {
    backgroundColor: "rgba(109,40,217,0.18)",
    borderColor: "#8B5CF6",
  },
  dayCellText: { fontSize: 12, color: "#4B5563" },
  dayCellTextSelected: { color: "#A78BFA" },
  dayCount: {
    fontSize: 11,
    color: "#374151",
    textAlign: "center",
    marginBottom: 10,
  },

  primaryBtn: {
    height: 44,
    borderRadius: 13,
    overflow: "hidden",
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnGrad: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
