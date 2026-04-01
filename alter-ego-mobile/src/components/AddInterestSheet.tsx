/**
 * Add Interest — 4-step bottom sheet wizard. Spec §4.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { PostInterestPayload } from "@/utils/api";

const SHEET_BG = "#111623";
const BORDER = "rgba(42,48,80,0.50)";
const VIOLET = "#8B5CF6";
const VIOLET_DEEP = "#5B21B6";
const TEXT = "#E5E7EB";
const MUTED = "#6B7280";
const DIM = "#374151";
const VERY_DIM = "#2D3146";
const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const LEVEL_OPTIONS = [
  { value: "Still figuring it out", title: "Still figuring it out", sub: "Just starting, mostly beginner" },
  { value: "Getting the hang of it", title: "Getting the hang of it", sub: "Some experience, building consistency" },
  { value: "Pretty solid", title: "Pretty solid", sub: "Consistent practice, ready for harder stuff" },
];

const TIMELINE_OPTIONS: {
  value: NonNullable<PostInterestPayload["target_timeline"]>;
  title: string;
  sub: string;
}[] = [
  { value: "no_deadline", title: "No fixed deadline", sub: "Open practice — arc adapts to your pace" },
  { value: "1_month", title: "About 1 month", sub: "Short sprint" },
  { value: "3_months", title: "About 3 months", sub: "Typical skill-building window" },
  { value: "6_months", title: "About 6 months", sub: "Steady long arc" },
  { value: "1_year", title: "About a year", sub: "Big goal on the horizon" },
];

interface AddInterestSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (payload: PostInterestPayload) => Promise<void>;
  onSuccess: () => void;
  /** Called when onSave rejects so the parent can show a toast */
  onSaveError?: (e: unknown) => void;
}

export function AddInterestSheet({
  visible,
  onClose,
  onSave,
  onSuccess,
  onSaveError,
}: AddInterestSheetProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [interestDescription, setInterestDescription] = useState("");
  const [level, setLevel] = useState<string | null>(null);
  const [goalDescription, setGoalDescription] = useState("");
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [targetTimeline, setTargetTimeline] = useState<NonNullable<PostInterestPayload["target_timeline"]>>(
    "no_deadline"
  );
  const [saving, setSaving] = useState(false);

  const canNext1 = interestDescription.trim().length > 0;
  const canNext2 = level != null;
  const canNext3 = goalDescription.trim().length >= 10;
  const canSave = scheduleDays.length >= 1;

  useEffect(() => {
    if (visible) {
      setStep(1);
      setInterestDescription("");
      setLevel(null);
      setGoalDescription("");
      setScheduleDays([]);
    }
  }, [visible]);

  const toggleDay = useCallback((idx: number) => {
    setScheduleDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort((a, b) => a - b)
    );
  }, []);

  const handleNext = useCallback(() => {
    if (step < 4) setStep((s) => s + 1);
  }, [step]);

  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({
        interest_description: interestDescription.trim(),
        interest_level: level ?? "Still figuring it out",
        goal_description: goalDescription.trim(),
        schedule_days: scheduleDays,
        target_timeline: targetTimeline,
      });
      onSuccess(); // close sheet + refetch
    } catch (e) {
      onSaveError?.(e);
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    saving,
    interestDescription,
    level,
    goalDescription,
    scheduleDays,
    onSave,
    onSuccess,
    onSaveError,
  ]);

  const scheduleSummary =
    scheduleDays.length > 0
      ? `${scheduleDays.length} days selected · ${scheduleDays.map((i) => DAY_LABELS[i]).join(", ")}`
      : "";

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]} onStartShouldSetResponder={() => true}>
          <View style={styles.sheetInner}>
            <View style={styles.dots}>
              {[1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  style={[styles.dot, i === step && styles.dotActive]}
                />
              ))}
            </View>
            <View style={styles.topRow}>
              {step > 1 ? (
                <Pressable onPress={() => setStep((s) => s - 1)} style={styles.backBtn}>
                  <Text style={styles.backText}>← Back</Text>
                </Pressable>
              ) : (
                <View style={styles.backBtn} />
              )}
              <Text style={styles.stepLabel}>Step {step} of 4</Text>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={12} color={MUTED} />
              </Pressable>
            </View>

            {step === 1 && (
              <>
                <Text style={styles.question}>What's your interest?</Text>
                <Text style={styles.hint}>
                  Be as specific as you like — "I love running but mostly trail running, not roads" works perfectly.
                </Text>
                <TextInput
                  style={styles.input}
                  value={interestDescription}
                  onChangeText={setInterestDescription}
                  placeholder="e.g. I love running outdoors, mainly trail running..."
                  placeholderTextColor={VERY_DIM}
                  multiline
                  minHeight={80}
                  maxHeight={160}
                  textAlignVertical="top"
                />
                <Pressable
                  onPress={handleNext}
                  disabled={!canNext1}
                  style={[styles.nextBtn, !canNext1 && styles.nextBtnDisabled]}
                >
                  {canNext1 ? (
                    <LinearGradient
                      colors={[VIOLET_DEEP, VIOLET]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.nextBtnGradient}
                    >
                      <Text style={styles.nextBtnText}>Next</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.nextBtnDisabledInner}>
                      <Text style={styles.nextBtnTextDisabled}>Next</Text>
                    </View>
                  )}
                </Pressable>
              </>
            )}

            {step === 2 && (
              <>
                <Text style={styles.question}>How would you describe your current level?</Text>
                <Text style={styles.hint}>This sets your starting mission difficulty.</Text>
                {LEVEL_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => setLevel(opt.value)}
                    style={[styles.radioCard, level === opt.value && styles.radioCardSelected]}
                  >
                    <View style={styles.radioTextCol}>
                      <Text style={[styles.radioTitle, level === opt.value && styles.radioTitleSelected]}>
                        {opt.title}
                      </Text>
                      <Text style={styles.radioSub}>{opt.sub}</Text>
                    </View>
                    <View style={[styles.radioDot, level === opt.value && styles.radioDotSelected]}>
                      {level === opt.value && <View style={styles.radioDotInner} />}
                    </View>
                  </Pressable>
                ))}
                <Pressable
                  onPress={handleNext}
                  disabled={!canNext2}
                  style={[styles.nextBtn, !canNext2 && styles.nextBtnDisabled]}
                >
                  {canNext2 ? (
                    <LinearGradient
                      colors={[VIOLET_DEEP, VIOLET]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.nextBtnGradient}
                    >
                      <Text style={styles.nextBtnText}>Next</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.nextBtnDisabledInner}>
                      <Text style={styles.nextBtnTextDisabled}>Next</Text>
                    </View>
                  )}
                </Pressable>
              </>
            )}

            {step === 3 && (
              <>
                <Text style={styles.question}>What are you trying to achieve?</Text>
                <Text style={styles.hint}>
                  Tell us as much as you want — the more specific, the better we can match missions.
                </Text>
                <TextInput
                  style={[styles.input, styles.inputTall]}
                  value={goalDescription}
                  onChangeText={setGoalDescription}
                  placeholder="e.g. I want to run a 5K by June. I'm at 2K right now and get tired quickly."
                  placeholderTextColor={VERY_DIM}
                  multiline
                  minHeight={100}
                  maxHeight={180}
                  textAlignVertical="top"
                />
                <Pressable
                  onPress={handleNext}
                  disabled={!canNext3}
                  style={[styles.nextBtn, !canNext3 && styles.nextBtnDisabled]}
                >
                  {canNext3 ? (
                    <LinearGradient
                      colors={[VIOLET_DEEP, VIOLET]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.nextBtnGradient}
                    >
                      <Text style={styles.nextBtnText}>Next</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.nextBtnDisabledInner}>
                      <Text style={styles.nextBtnTextDisabled}>Next</Text>
                    </View>
                  )}
                </Pressable>
              </>
            )}

            {step === 4 && (
              <>
                <Text style={styles.question}>What&apos;s your target timeline?</Text>
                <Text style={styles.hint}>We use this to plan your learning arc — you can change it later.</Text>
                {TIMELINE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => setTargetTimeline(opt.value)}
                    style={[
                      styles.radioCard,
                      targetTimeline === opt.value && styles.radioCardSelected,
                    ]}
                  >
                    <View style={styles.radioTextCol}>
                      <Text
                        style={[
                          styles.radioTitle,
                          targetTimeline === opt.value && styles.radioTitleSelected,
                        ]}
                      >
                        {opt.title}
                      </Text>
                      <Text style={styles.radioSub}>{opt.sub}</Text>
                    </View>
                    <View style={[styles.radioDot, targetTimeline === opt.value && styles.radioDotSelected]}>
                      {targetTimeline === opt.value && <View style={styles.radioDotInner} />}
                    </View>
                  </Pressable>
                ))}
                <Text style={[styles.question, { marginTop: 8 }]}>Which days will you show up?</Text>
                <Text style={styles.hint}>Missions are only assigned on selected days.</Text>
                <View style={styles.dayGrid}>
                  {DAY_LABELS.map((label, idx) => (
                    <Pressable
                      key={idx}
                      onPress={() => toggleDay(idx)}
                      style={[styles.dayCell, scheduleDays.includes(idx) && styles.dayCellSelected]}
                    >
                      <Text style={[styles.dayCellText, scheduleDays.includes(idx) && styles.dayCellTextSelected]}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.scheduleSummary}>{scheduleSummary}</Text>
                <Pressable
                  onPress={handleSave}
                  disabled={!canSave || saving}
                  style={[styles.nextBtn, (!canSave || saving) && styles.nextBtnDisabled]}
                >
                  {canSave && !saving ? (
                    <LinearGradient
                      colors={[VIOLET_DEEP, VIOLET]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.nextBtnGradient}
                    >
                      <Text style={styles.nextBtnText}>{saving ? "Saving…" : "Save Interest"}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.nextBtnDisabledInner}>
                      <Text style={styles.nextBtnTextDisabled}>
                        {saving ? "Saving…" : "Save Interest"}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: BORDER,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sheetInner: {},
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(42,48,80,0.70)",
  },
  dotActive: {
    width: 20,
    backgroundColor: VIOLET,
    shadowColor: "rgba(139,92,246,0.50)",
    shadowRadius: 6,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  backBtn: { minWidth: 60 },
  backText: { fontSize: 13, color: "#4B5563" },
  stepLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: DIM,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  question: {
    fontSize: 20,
    fontWeight: "800",
    color: TEXT,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  hint: {
    fontSize: 13,
    color: "#4B5563",
    marginBottom: 18,
    lineHeight: 20,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: TEXT,
    lineHeight: 24,
    minHeight: 80,
    marginBottom: 16,
  },
  inputTall: { minHeight: 100, maxHeight: 180 },
  radioCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1.5,
    borderColor: "rgba(42,48,80,0.40)",
    borderRadius: 14,
    padding: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  radioCardSelected: {
    backgroundColor: "rgba(109,40,217,0.12)",
    borderColor: "rgba(139,92,246,0.50)",
  },
  radioTextCol: { flex: 1 },
  radioTitle: { fontSize: 14, fontWeight: "600", color: TEXT },
  radioTitleSelected: { color: "#C4B5FD" },
  radioSub: { fontSize: 11, color: "#4B5563", marginTop: 2 },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(42,48,80,0.60)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioDotSelected: {
    backgroundColor: "rgba(139,92,246,0.15)",
    borderColor: VIOLET,
  },
  radioDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: VIOLET,
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 12,
  },
  dayCell: {
    width: "12%",
    aspectRatio: 1,
    minWidth: 36,
    maxWidth: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.40)",
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellSelected: {
    backgroundColor: "rgba(109,40,217,0.20)",
    borderColor: VIOLET,
    shadowColor: "rgba(139,92,246,0.18)",
    shadowRadius: 10,
  },
  dayCellText: { fontSize: 11, fontWeight: "600", color: "#4B5563" },
  dayCellTextSelected: { color: "#A78BFA" },
  scheduleSummary: {
    fontSize: 11,
    color: DIM,
    textAlign: "center",
    marginBottom: 12,
  },
  nextBtn: {
    height: 52,
    borderRadius: 16,
    overflow: "hidden",
  },
  nextBtnDisabled: {},
  nextBtnGradient: {
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtnDisabledInner: {
    height: "100%",
    backgroundColor: "rgba(42,48,80,0.35)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  nextBtnText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  nextBtnTextDisabled: { fontSize: 16, fontWeight: "600", color: DIM },
});
