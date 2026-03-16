/**
 * Onboarding add-interest flow: 3 steps per interest.
 * Step 1: Free text — "What's your interest? Type anything."
 * Step 2: Self-reported level — Still figuring it out / Getting the hang of it / Pretty solid
 * Step 3: Free text — "What do you want to learn or get better at in this interest?"
 */

import React, { useState, useCallback } from "react";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../constants/theme";
import { INTEREST_LEVEL_OPTIONS, type InterestLevelOption } from "../constants/onboardingQuestions";
import { OnboardingOptionCard } from "./OnboardingOptionCard";

export type OnboardingInterestItem = {
  name: string;
  level: "Still figuring it out" | "Getting the hang of it" | "Pretty solid";
  learning_goal: string;
  /** Day indices 0–6 (Mon–Sun). Which days to work on this interest. */
  schedule?: number[];
};

const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
type Step = 1 | 2 | 3 | 4;

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdd: (item: OnboardingInterestItem) => void;
};

export function AddInterestOnboardingModal({ visible, onClose, onAdd }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<InterestLevelOption | null>(null);
  const [learningGoal, setLearningGoal] = useState("");
  const [schedule, setSchedule] = useState<number[]>([0, 2, 4]); // Mon, Wed, Fri default

  const reset = useCallback(() => {
    setStep(1);
    setName("");
    setLevel(null);
    setLearningGoal("");
    setSchedule([0, 2, 4]);
  }, []);

  const toggleDay = useCallback((dayIndex: number) => {
    setSchedule((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex].sort((a, b) => a - b)
    );
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleStep1Next = useCallback(() => {
    const t = name.trim();
    if (!t) return;
    setStep(2);
  }, [name]);

  const handleStep2Next = useCallback(() => {
    if (level === null) return;
    setStep(3);
  }, [level]);

  const handleStep3Next = useCallback(() => {
    setStep(4);
  }, []);

  const handleDone = useCallback(() => {
    const t = name.trim();
    if (!t || level === null) return;
    onAdd({
      name: t,
      level,
      learning_goal: learningGoal.trim() || "",
      schedule: schedule.length > 0 ? schedule : [0, 2, 4],
    });
    reset();
    onClose();
  }, [name, level, learningGoal, schedule, onAdd, reset, onClose]);

  const handleBack = useCallback(() => {
    if (step > 1) setStep((s) => (s - 1) as Step);
  }, [step]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <LinearGradient
        colors={[COLORS.bg1, COLORS.bg0]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
        <View style={[styles.header, { paddingTop: insets.top + 28 }]}>
          {step > 1 ? (
            <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={COLORS.text} />
              <Text style={styles.backBtnLabel}>Back</Text>
            </Pressable>
          ) : (
            <View style={styles.backBtnPlaceholder} />
          )}
          <Text style={styles.stepLabelCentered} pointerEvents="none">Step {step} of 4</Text>
          <Pressable onPress={handleClose} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.keyboard}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 1 && (
              <>
                <Text style={styles.question}>What's your interest?</Text>
                <Text style={styles.hint}>Type anything — e.g. guitar, running, coding, reading.</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Guitar"
                  placeholderTextColor={COLORS.muted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={80}
                />
                <Pressable
                  onPress={handleStep1Next}
                  disabled={!name.trim()}
                  style={[styles.primaryBtn, !name.trim() && styles.primaryBtnDisabled]}
                >
                  <LinearGradient
                    colors={name.trim() ? ["#6D28D9", "#8B5CF6"] : [COLORS.surface2, COLORS.surface2]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtnGradient}
                  >
                    <Text style={styles.primaryBtnLabel}>Next</Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}

            {step === 2 && (
              <>
                <Text style={styles.question}>How would you describe your level in "{name.trim()}"?</Text>
                <View style={styles.options}>
                  {INTEREST_LEVEL_OPTIONS.map((opt) => (
                    <View key={opt} style={styles.optionItem}>
                      <OnboardingOptionCard
                        label={opt}
                        selected={level === opt}
                        onSelect={() => setLevel(opt)}
                      />
                    </View>
                  ))}
                </View>
                <Pressable
                  onPress={handleStep2Next}
                  disabled={level === null}
                  style={[styles.primaryBtn, level === null && styles.primaryBtnDisabled]}
                >
                  <LinearGradient
                    colors={level !== null ? ["#6D28D9", "#8B5CF6"] : [COLORS.surface2, COLORS.surface2]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtnGradient}
                  >
                    <Text style={styles.primaryBtnLabel}>Next</Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}

            {step === 3 && (
              <>
                <Text style={styles.question}>What is it that you are trying to achieve in this interest?</Text>
                <Text style={styles.hint}>This helps us match missions to you. e.g. Run a 5K, finish a novel, play 3 songs on guitar, ship a side project.</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="e.g. Run a 5K, finish a novel, play 3 songs…"
                  placeholderTextColor={COLORS.muted}
                  value={learningGoal}
                  onChangeText={setLearningGoal}
                  multiline
                  numberOfLines={3}
                  maxLength={200}
                />
                <Pressable onPress={handleStep3Next} style={styles.primaryBtn}>
                  <LinearGradient
                    colors={["#6D28D9", "#8B5CF6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtnGradient}
                  >
                    <Text style={styles.primaryBtnLabel}>Next</Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}

            {step === 4 && (
              <>
                <Text style={styles.question}>On which days do you want to work on this interest?</Text>
                <Text style={styles.hint}>Pick the days you're willing to show up. We'll suggest missions on these days.</Text>
                <View style={styles.dayRow}>
                  {DAY_LABELS.map((label, i) => (
                    <Pressable
                      key={i}
                      onPress={() => toggleDay(i)}
                      style={[styles.dayChip, schedule.includes(i) && styles.dayChipSelected]}
                    >
                      <Text style={[styles.dayChipText, schedule.includes(i) && styles.dayChipTextSelected]}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable onPress={handleDone} style={styles.primaryBtn}>
                  <LinearGradient
                    colors={["#6D28D9", "#8B5CF6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtnGradient}
                  >
                    <Text style={styles.primaryBtnLabel}>Add interest</Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.screenPadding,
    paddingVertical: SPACING.sm,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.xs,
    minWidth: 80,
  },
  backBtnLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: COLORS.text,
    marginLeft: 2,
  },
  backBtnPlaceholder: { minWidth: 80 },
  closeBtn: { padding: SPACING.xs },
  stepLabel: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.muted,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  stepLabelCentered: {
    position: "absolute",
    left: 0,
    right: 0,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.muted,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  keyboard: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: 40,
  },
  question: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: "center",
  },
  hint: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.text2,
    marginBottom: SPACING.lg,
    textAlign: "center",
  },
  input: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  options: { marginBottom: SPACING.lg },
  optionItem: { marginBottom: SPACING.cardGap },
  primaryBtn: {
    ...SHADOWS.button,
    borderRadius: RADIUS.card,
    overflow: "hidden",
    alignSelf: "stretch",
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnGradient: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
  dayRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  dayChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayChipSelected: {
    backgroundColor: "rgba(139,92,246,0.2)",
    borderColor: COLORS.violet,
  },
  dayChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: COLORS.text2,
  },
  dayChipTextSelected: {
    color: COLORS.violet,
  },
});
