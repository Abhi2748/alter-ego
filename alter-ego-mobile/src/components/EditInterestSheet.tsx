/**
 * Edit Interest — menu sheet + Goal (2 steps), Difficulty (1), Schedule (1). Spec §5.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import type { InterestOut } from "../utils/api";

const SHEET_BG = "#111623";
const BORDER = "rgba(42,48,80,0.40)";
const VIOLET = "#8B5CF6";
const VIOLET_DEEP = "#5B21B6";
const EMBER = "#F97316";
const BLUE = "#60A5FA";
const TEXT = "#E5E7EB";
const MUTED = "#6B7280";
const DIM = "#374151";
const VERY_DIM = "#2D3146";
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function IconGoal() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Circle cx={10} cy={10} r={7} stroke={VIOLET} strokeWidth={1.5} fill="none" />
      <Path d="M10 6v4l2 2" stroke={VIOLET} strokeWidth={1.5} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
function IconDifficulty() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M10 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6l2-6z" stroke={EMBER} strokeWidth={1.5} strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
function IconSchedule() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Rect x={3} y={2} width={14} height={16} rx={2} stroke={BLUE} strokeWidth={1.5} fill="none" />
      <Path d="M3 7h14" stroke={BLUE} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}

type EditMode = "menu" | "goal" | "difficulty" | "schedule";

interface EditInterestSheetProps {
  visible: boolean;
  interest: InterestOut;
  mode: EditMode;
  onClose: () => void;
  onSwitchMode: (mode: EditMode) => void;
  onSaveGoal: (
    interestId: string,
    payload: { new_goal: string; progress_level: string; progress_detail?: string }
  ) => Promise<void>;
  onSaveDifficulty: (interestId: string, tier: "easy" | "medium" | "hard") => Promise<void>;
  onSaveSchedule: (interestId: string, days: string[]) => Promise<void>;
  onDelete?: (interestId: string) => Promise<void>;
}

export function EditInterestSheet({
  visible,
  interest,
  mode,
  onClose,
  onSwitchMode,
  onSaveGoal,
  onSaveDifficulty,
  onSaveSchedule,
  onDelete,
}: EditInterestSheetProps) {
  const insets = useSafeAreaInsets();
  const [goalStep, setGoalStep] = useState(1);
  const [newGoal, setNewGoal] = useState(interest.goal_description ?? "");
  const [progressLevel, setProgressLevel] = useState<"just_started" | "part_way" | "almost_there">("just_started");
  const [progressDetail, setProgressDetail] = useState("");
  const [tier, setTier] = useState<"easy" | "medium" | "hard">(interest.tier ?? "medium");
  const [scheduleIndices, setScheduleIndices] = useState<number[]>(() =>
    (interest.schedule_days ?? []).map((d) => DAY_KEYS.indexOf(d.toLowerCase())).filter((i) => i >= 0)
  );
  const [saving, setSaving] = useState(false);

  const canNextGoal = newGoal.trim().length >= 10;
  const toggleScheduleDay = (idx: number) => {
    setScheduleIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx].sort((a, b) => a - b)
    );
  };

  const handleSaveGoal = useCallback(async () => {
    setSaving(true);
    try {
      await onSaveGoal(interest.id, {
        new_goal: newGoal.trim(),
        progress_level: progressLevel,
        progress_detail: progressDetail.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  }, [interest.id, newGoal, progressLevel, progressDetail, onSaveGoal]);

  const handleSaveDifficulty = useCallback(async () => {
    setSaving(true);
    try {
      await onSaveDifficulty(interest.id, tier);
    } finally {
      setSaving(false);
    }
  }, [interest.id, tier, onSaveDifficulty]);

  const handleSaveSchedule = useCallback(async () => {
    if (scheduleIndices.length === 0) return;
    setSaving(true);
    try {
      await onSaveSchedule(
        interest.id,
        scheduleIndices.map((i) => DAY_KEYS[i])
      );
    } finally {
      setSaving(false);
    }
  }, [interest.id, scheduleIndices, onSaveSchedule]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 32 }]} onStartShouldSetResponder={() => true}>
          <View style={styles.sheetInner}>
            {mode === "menu" && (
              <View style={styles.menuTopRow}>
                <View style={styles.closeBtnPlaceholder} />
                <View style={styles.closeBtnPlaceholder} />
                <Pressable onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={12} color={MUTED} />
                </Pressable>
              </View>
            )}
            {(mode === "goal" || mode === "difficulty" || mode === "schedule") && (
              <View style={styles.topRow}>
                <Pressable
                  onPress={() => (mode === "goal" && goalStep > 1 ? setGoalStep(1) : onSwitchMode("menu"))}
                  style={styles.backBtn}
                >
                  <Text style={styles.backText}>← Back</Text>
                </Pressable>
                <Text style={styles.stepLabel}>
                  {mode === "goal" ? (goalStep === 1 ? "New goal" : "Progress") : mode === "difficulty" ? "Difficulty" : "Schedule"}
                </Text>
                <Pressable onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={12} color={MUTED} />
                </Pressable>
              </View>
            )}

            {mode === "menu" && (
              <>
                <Text style={styles.menuTitle}>{interest.interest_name}</Text>
                <Text style={styles.menuSub}>What would you like to update?</Text>
                <Pressable style={styles.menuCard} onPress={() => onSwitchMode("goal")}>
                  <View style={styles.menuIconBoxViolet}>
                    <IconGoal />
                  </View>
                  <View style={styles.menuCardText}>
                    <Text style={styles.menuCardTitle}>Update Goal</Text>
                    <Text style={styles.menuCardSub}>Change what you're working towards</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={VERY_DIM} />
                </Pressable>
                <Pressable style={styles.menuCard} onPress={() => onSwitchMode("difficulty")}>
                  <View style={styles.menuIconBoxEmber}>
                    <IconDifficulty />
                  </View>
                  <View style={styles.menuCardText}>
                    <Text style={styles.menuCardTitle}>Mission Difficulty</Text>
                    <Text style={styles.menuCardSub}>Adjust how hard your missions are</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={VERY_DIM} />
                </Pressable>
                <Pressable style={styles.menuCard} onPress={() => onSwitchMode("schedule")}>
                  <View style={styles.menuIconBoxBlue}>
                    <IconSchedule />
                  </View>
                  <View style={styles.menuCardText}>
                    <Text style={styles.menuCardTitle}>Schedule</Text>
                    <Text style={styles.menuCardSub}>Change which days you train</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={VERY_DIM} />
                </Pressable>
                {onDelete && (
                  <Pressable
                    style={[styles.menuCard, styles.menuCardDanger]}
                    onPress={() => {
                      Alert.alert(
                        "Delete interest?",
                        `"${interest.interest_name}" will be removed. This cannot be undone.`,
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: async () => {
                              setSaving(true);
                              try {
                                await onDelete(interest.id);
                                onClose();
                              } finally {
                                setSaving(false);
                              }
                            },
                          },
                        ]
                      );
                    }}
                    disabled={saving}
                  >
                    <View style={styles.menuIconBoxDanger}>
                      <Ionicons name="trash-outline" size={20} color="#F87171" />
                    </View>
                    <View style={styles.menuCardText}>
                      <Text style={styles.menuCardTitleDanger}>Delete interest</Text>
                      <Text style={styles.menuCardSub}>Remove from your list</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={VERY_DIM} />
                  </Pressable>
                )}
              </>
            )}

            {mode === "goal" && goalStep === 1 && (
              <>
                <Text style={styles.question}>What's your updated goal?</Text>
                <Text style={styles.contextLabel}>Your current goal:</Text>
                <Text style={styles.contextValue}>{interest.goal_description || "None"}</Text>
                <TextInput
                  style={styles.input}
                  value={newGoal}
                  onChangeText={setNewGoal}
                  placeholder="Describe your new goal in as much detail as you like..."
                  placeholderTextColor={VERY_DIM}
                  multiline
                  minHeight={80}
                />
                <Pressable
                  onPress={() => setGoalStep(2)}
                  disabled={!canNextGoal}
                  style={[styles.primaryBtn, !canNextGoal && styles.primaryBtnDisabled]}
                >
                  {canNextGoal ? (
                    <LinearGradient colors={[VIOLET_DEEP, VIOLET]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnGradient}>
                      <Text style={styles.primaryBtnText}>Next</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.primaryBtnDisabledInner}>
                      <Text style={styles.primaryBtnTextDisabled}>Next</Text>
                    </View>
                  )}
                </Pressable>
              </>
            )}

            {mode === "goal" && goalStep === 2 && (
              <>
                <Text style={styles.question}>Where are you right now?</Text>
                <Text style={styles.hint}>
                  Be honest — it helps the system to assign missions as accurately as possible.
                </Text>
                <View style={styles.progressCard}>
                  <Text style={styles.progressLabel}>HOW FAR ALONG IS YOUR NEW GOAL?</Text>
                  <View style={styles.pillsRow}>
                    {(["just_started", "part_way", "almost_there"] as const).map((val) => (
                      <Pressable
                        key={val}
                        onPress={() => setProgressLevel(val)}
                        style={[styles.pill, progressLevel === val && styles.pillSelected]}
                      >
                        <Text style={[styles.pillText, progressLevel === val && styles.pillTextSelected]}>
                          {val === "just_started" ? "Just started" : val === "part_way" ? "Part way" : "Almost there"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    style={[styles.input, styles.inputShort]}
                    value={progressDetail}
                    onChangeText={setProgressDetail}
                    placeholder="Add more detail if you want..."
                    placeholderTextColor={VERY_DIM}
                    multiline
                    minHeight={70}
                  />
                </View>
                <Pressable
                  onPress={handleSaveGoal}
                  disabled={saving}
                  style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
                >
                  <LinearGradient colors={[VIOLET_DEEP, VIOLET]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnGradient}>
                    <Text style={styles.primaryBtnText}>{saving ? "Saving…" : "Save Goal"}</Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}

            {mode === "difficulty" && (
              <>
                <Text style={styles.question}>How hard should your missions be?</Text>
                <Text style={styles.currentTier}>Your current tier: <Text style={styles.currentTierVal}>{interest.tier ?? "medium"}</Text></Text>
                {(["easy", "medium", "hard"] as const).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setTier(t)}
                    style={[styles.radioCard, tier === t && styles.radioCardSelected]}
                  >
                    <View style={styles.radioTextCol}>
                      <Text style={[styles.radioTitle, tier === t && styles.radioTitleSelected]}>
                        {t === "easy" ? "Easy" : t === "medium" ? "Medium" : "Hard"}
                      </Text>
                      <Text style={styles.radioSub}>
                        {t === "easy"
                          ? "Short, low-effort tasks. Good for rebuilding."
                          : t === "medium"
                            ? "Balanced missions. The default setting."
                            : "Demanding tasks. For when you're ready."}
                      </Text>
                    </View>
                    <View style={[styles.radioDot, tier === t && styles.radioDotSelected]}>
                      {tier === t && <View style={styles.radioDotInner} />}
                    </View>
                  </Pressable>
                ))}
                <Pressable onPress={handleSaveDifficulty} disabled={saving} style={styles.primaryBtn}>
                  <LinearGradient colors={[VIOLET_DEEP, VIOLET]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnGradient}>
                    <Text style={styles.primaryBtnText}>{saving ? "Saving…" : "Save"}</Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}

            {mode === "schedule" && (
              <>
                <Text style={styles.question}>Which days will you train?</Text>
                <Text style={styles.hint}>Missions are only assigned on selected days.</Text>
                <View style={styles.dayGrid}>
                  {DAY_LABELS.map((label, idx) => (
                    <Pressable
                      key={idx}
                      onPress={() => toggleScheduleDay(idx)}
                      style={[styles.dayCell, scheduleIndices.includes(idx) && styles.dayCellSelected]}
                    >
                      <Text style={[styles.dayCellText, scheduleIndices.includes(idx) && styles.dayCellTextSelected]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.scheduleSummary}>
                  {scheduleIndices.length} days selected · {scheduleIndices.map((i) => DAY_LABELS[i]).join(", ")}
                </Text>
                <Pressable
                  onPress={handleSaveSchedule}
                  disabled={scheduleIndices.length === 0 || saving}
                  style={[styles.primaryBtn, (scheduleIndices.length === 0 || saving) && styles.primaryBtnDisabled]}
                >
                  {(scheduleIndices.length > 0 && !saving) ? (
                    <LinearGradient colors={[VIOLET_DEEP, VIOLET]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnGradient}>
                      <Text style={styles.primaryBtnText}>Save Schedule</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.primaryBtnDisabledInner}>
                      <Text style={styles.primaryBtnTextDisabled}>Save Schedule</Text>
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
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sheetInner: {},
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  backBtn: {},
  backText: { fontSize: 13, color: "#4B5563" },
  stepLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", color: DIM },
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
  menuTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 8,
  },
  closeBtnPlaceholder: { width: 28, height: 28 },
  menuTitle: { fontSize: 17, fontWeight: "800", color: TEXT, textAlign: "center", marginBottom: 4 },
  menuSub: { fontSize: 12, color: "#4B5563", textAlign: "center", marginBottom: 20 },
  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  menuIconBoxViolet: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "rgba(139,92,246,0.12)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconBoxEmber: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "rgba(249,115,22,0.10)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconBoxBlue: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "rgba(59,130,246,0.10)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconBoxDanger: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "rgba(248,113,113,0.10)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuCardDanger: { borderColor: "rgba(127,29,29,0.40)" },
  menuCardTitleDanger: { fontSize: 15, fontWeight: "700", color: "#FCA5A5" },
  menuCardText: { flex: 1 },
  menuCardTitle: { fontSize: 15, fontWeight: "700", color: TEXT },
  menuCardSub: { fontSize: 12, color: "#4B5563", marginTop: 2 },
  question: { fontSize: 18, fontWeight: "800", color: TEXT, marginBottom: 8 },
  hint: { fontSize: 13, color: "#4B5563", lineHeight: 20, marginBottom: 14 },
  contextLabel: { fontSize: 12, color: "#4B5563", marginBottom: 4 },
  contextValue: { fontSize: 13, color: "#A78BFA", fontStyle: "italic", marginBottom: 10 },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    color: TEXT,
    minHeight: 80,
    marginBottom: 16,
  },
  inputShort: { minHeight: 70, marginBottom: 12 },
  progressCard: {
    backgroundColor: "rgba(139,92,246,0.06)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.15)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: DIM,
    marginBottom: 10,
  },
  pillsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  pill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  pillSelected: {
    backgroundColor: "rgba(109,40,217,0.15)",
    borderColor: VIOLET,
  },
  pillText: { fontSize: 12, fontWeight: "600", color: "#4B5563" },
  pillTextSelected: { color: "#A78BFA" },
  currentTier: { fontSize: 13, color: MUTED, marginBottom: 12 },
  currentTierVal: { color: "#A78BFA" },
  radioCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
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
  radioDotSelected: { backgroundColor: "rgba(139,92,246,0.15)", borderColor: VIOLET },
  radioDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: VIOLET },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 12 },
  dayCell: {
    width: "12%",
    aspectRatio: 1,
    minWidth: 36,
    maxWidth: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellSelected: {
    backgroundColor: "rgba(109,40,217,0.20)",
    borderColor: VIOLET,
  },
  dayCellText: { fontSize: 11, fontWeight: "600", color: "#4B5563" },
  dayCellTextSelected: { color: "#A78BFA" },
  scheduleSummary: { fontSize: 11, color: DIM, textAlign: "center", marginBottom: 12 },
  primaryBtn: { height: 52, borderRadius: 16, overflow: "hidden" },
  primaryBtnDisabled: {},
  primaryBtnGradient: { height: "100%", alignItems: "center", justifyContent: "center" },
  primaryBtnDisabledInner: {
    height: "100%",
    backgroundColor: "rgba(42,48,80,0.35)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  primaryBtnText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  primaryBtnTextDisabled: { fontSize: 16, fontWeight: "600", color: DIM },
});
