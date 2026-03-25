import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { AwarenessLevel, QuitGoal, QuitTargetInput } from "@/types/quits";

const PRESET_CHIPS = [
  "While studying / working",
  "Watching content / TV",
  "Waiting / bored",
  "Stressed / anxious",
  "Social situations",
  "After eating or drinking",
  "Morning routine",
  "Before sleep",
  "Any time / random",
] as const;

const AWARENESS_OPTIONS: {
  value: AwarenessLevel;
  title: string;
  sub: string;
}[] = [
  {
    value: "subconscious",
    title: "Usually don't notice until it's done",
    sub: "It happens automatically without a decision",
  },
  {
    value: "semi_conscious",
    title: "I notice it while doing it but keep going",
    sub: "Conscious but feels hard to stop in the moment",
  },
  {
    value: "conscious",
    title: "I decide to do it and do it",
    sub: "Fully conscious choice each time",
  },
];

const GOAL_OPTIONS: { value: QuitGoal; title: string }[] = [
  { value: "stop_completely", title: "Stop completely" },
  { value: "reduce_significantly", title: "Reduce significantly (80%+)" },
  { value: "make_conscious", title: "Only do it consciously" },
];

export interface QuitTargetProfileSheetProps {
  habitName: string;
  visible: boolean;
  initialProfile?: Partial<Pick<QuitTargetInput, "contexts" | "awareness" | "quit_goal">>;
  onComplete: (profile: QuitTargetInput) => void;
  onDismiss: () => void;
}

export function QuitTargetProfileSheet({
  habitName,
  visible,
  initialProfile,
  onComplete,
  onDismiss,
}: QuitTargetProfileSheetProps) {
  const [step, setStep] = useState(1);
  const [selectedContexts, setSelectedContexts] = useState<string[]>([]);
  const [customContexts, setCustomContexts] = useState<string[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customDraft, setCustomDraft] = useState("");
  const [awareness, setAwareness] = useState<AwarenessLevel | null>(null);
  const [quitGoal, setQuitGoal] = useState<QuitGoal | null>(null);
  const inputRef = useRef<TextInput>(null);

  const reset = useCallback(() => {
    setStep(1);
    const ctx = initialProfile?.contexts ?? [];
    const presetSet = new Set(PRESET_CHIPS as unknown as string[]);
    setSelectedContexts(ctx.filter((c) => presetSet.has(c)));
    setCustomContexts(ctx.filter((c) => !presetSet.has(c)));
    setShowCustomInput(false);
    setCustomDraft("");
    setAwareness(initialProfile?.awareness ?? null);
    setQuitGoal(initialProfile?.quit_goal ?? null);
  }, [initialProfile]);

  useEffect(() => {
    if (visible) reset();
  }, [visible, reset]);

  const togglePreset = (label: string) => {
    setSelectedContexts((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    );
  };

  const confirmCustom = () => {
    const t = customDraft.trim().slice(0, 40);
    if (!t || customContexts.length >= 3) return;
    setCustomContexts((c) => [...c, t]);
    setCustomDraft("");
    setShowCustomInput(false);
  };

  const removeCustom = (label: string) => {
    setCustomContexts((c) => c.filter((x) => x !== label));
    setSelectedContexts((s) => s.filter((x) => x !== label));
  };

  const allContexts = [...new Set([...selectedContexts, ...customContexts])];

  const canNext1 = allContexts.length >= 1;
  const canNext2 = awareness !== null;
  const canFinish = quitGoal !== null;

  const handleNext = () => {
    if (step === 1 && canNext1) setStep(2);
    else if (step === 2 && canNext2) setStep(3);
    else if (step === 3 && canFinish && habitName.trim()) {
      onComplete({
        name: habitName.trim(),
        contexts: allContexts,
        awareness: awareness!,
        quit_goal: quitGoal!,
      });
    }
  };

  const handleBack = () => {
    if (step <= 1) onDismiss();
    else setStep((s) => s - 1);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onDismiss} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.pillWrap}>
            <Text style={styles.pill} numberOfLines={1}>
              {habitName.trim() || "Quit target"}
            </Text>
          </View>
          <View style={styles.dotsRow}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={[styles.dot, i <= step && styles.dotFilled]} />
            ))}
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 1 && (
              <>
                <Text style={styles.stepTitle}>When does it usually happen?</Text>
                <Text style={styles.stepHint}>(pick all that apply)</Text>
                <View style={styles.chipGrid}>
                  {PRESET_CHIPS.map((c) => {
                    const on = selectedContexts.includes(c);
                    return (
                      <Pressable
                        key={c}
                        onPress={() => togglePreset(c)}
                        style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
                      >
                        <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{c}</Text>
                      </Pressable>
                    );
                  })}
                  {customContexts.map((c) => (
                    <View key={c} style={[styles.chip, styles.chipOn]}>
                      <Text style={[styles.chipTxt, styles.chipTxtOn]}>{c}</Text>
                      <Pressable onPress={() => removeCustom(c)} hitSlop={8}>
                        <Text style={styles.chipRemove}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                  {!showCustomInput ? (
                    <Pressable
                      style={styles.chipAdd}
                      onPress={() => {
                        setShowCustomInput(true);
                        setTimeout(() => inputRef.current?.focus(), 100);
                      }}
                    >
                      <Ionicons name="add" size={16} color="rgba(239,68,68,0.55)" />
                      <Text style={styles.chipAddTxt}>Add your own</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.customRow}>
                      <TextInput
                        ref={inputRef}
                        style={styles.customInput}
                        placeholder="e.g. after meals, when driving..."
                        placeholderTextColor="#4B5563"
                        value={customDraft}
                        onChangeText={(t) => setCustomDraft(t.slice(0, 40))}
                        maxLength={40}
                        returnKeyType="done"
                        onSubmitEditing={confirmCustom}
                      />
                      <Pressable style={styles.customConfirm} onPress={confirmCustom}>
                        <Ionicons name="arrow-forward" size={16} color="#EF4444" />
                      </Pressable>
                    </View>
                  )}
                </View>
              </>
            )}

            {step === 2 && (
              <>
                <Text style={styles.stepTitle}>How aware are you when it&apos;s happening?</Text>
                {AWARENESS_OPTIONS.map((o) => {
                  const sel = awareness === o.value;
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => setAwareness(o.value)}
                      style={[styles.radioCard, sel ? styles.radioCardOn : styles.radioCardOff]}
                    >
                      <View style={[styles.radioDot, sel && styles.radioDotOn]} />
                      <View style={styles.radioCol}>
                        <Text style={styles.radioTitle}>{o.title}</Text>
                        <Text style={styles.radioSub}>{o.sub}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </>
            )}

            {step === 3 && (
              <>
                <Text style={styles.stepTitle}>What does success look like to you?</Text>
                {GOAL_OPTIONS.map((o) => {
                  const sel = quitGoal === o.value;
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => setQuitGoal(o.value)}
                      style={[styles.radioCard, sel ? styles.radioCardOn : styles.radioCardOff]}
                    >
                      <View style={[styles.radioDot, sel && styles.radioDotOn]} />
                      <Text style={styles.radioTitle}>{o.title}</Text>
                    </Pressable>
                  );
                })}
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.backBtn} onPress={handleBack}>
              <Text style={styles.backBtnTxt}>{step === 1 ? "Cancel" : "← Back"}</Text>
            </Pressable>
            <Pressable
              style={[
                styles.nextBtn,
                (step === 1 && !canNext1) ||
                (step === 2 && !canNext2) ||
                (step === 3 && !canFinish)
                  ? styles.nextBtnDisabled
                  : null,
              ]}
              disabled={
                (step === 1 && !canNext1) ||
                (step === 2 && !canNext2) ||
                (step === 3 && !canFinish)
              }
              onPress={handleNext}
            >
              <Text style={styles.nextBtnTxt}>{step === 3 ? "Done" : "Next →"}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  sheet: {
    backgroundColor: "#0F1220",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "92%",
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2A3050",
    marginTop: 10,
    marginBottom: 12,
  },
  pillWrap: { paddingHorizontal: 20, marginBottom: 12 },
  pill: {
    alignSelf: "center",
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
    color: "#EF4444",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    maxWidth: "100%",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2E2020",
  },
  dotFilled: { backgroundColor: "#EF4444" },
  scroll: { maxHeight: 420 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 16 },
  stepTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
    marginBottom: 6,
  },
  stepHint: { fontSize: 12, color: "#6B7280", marginBottom: 14 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: "100%",
  },
  chipOff: {
    backgroundColor: "#12100F",
    borderColor: "#1E1818",
  },
  chipOn: {
    backgroundColor: "rgba(239,68,68,0.10)",
    borderColor: "rgba(239,68,68,0.30)",
  },
  chipTxt: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#6B7280", flexShrink: 1 },
  chipTxtOn: { color: "#EF4444" },
  chipRemove: { fontSize: 14, color: "#EF4444", fontFamily: "Inter_700Bold" },
  chipAdd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(239,68,68,0.22)",
    backgroundColor: "#12100F",
  },
  chipAddTxt: { fontSize: 12, color: "rgba(239,68,68,0.5)", fontFamily: "Inter_600SemiBold" },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  customInput: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#12100F",
    borderWidth: 1.5,
    borderColor: "rgba(239,68,68,0.35)",
    paddingHorizontal: 14,
    fontSize: 12,
    color: "#E5E7EB",
  },
  customConfirm: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(239,68,68,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  radioCardOff: { backgroundColor: "#12100F", borderColor: "#1E1818" },
  radioCardOn: { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.30)" },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    backgroundColor: "#2E2020",
  },
  radioDotOn: { backgroundColor: "#EF4444" },
  radioCol: { flex: 1 },
  radioTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#E5E7EB" },
  radioSub: { fontSize: 11, color: "#6B7280", marginTop: 4, lineHeight: 16 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    gap: 12,
  },
  backBtn: { paddingVertical: 12, paddingHorizontal: 8 },
  backBtnTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#6B7280" },
  nextBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#EF4444",
    alignItems: "center",
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnTxt: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
});
