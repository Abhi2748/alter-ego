/**
 * Edit Interest details — steps 2–4 from onboarding add-interest:
 * - Level (self-reported)
 * - Goal (learning_goal)
 * - Schedule (days)
 */
import React, { useCallback, useEffect, useState } from "react";
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

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Step = 1 | 2 | 3; // maps to onboarding steps 2–4

export type InterestDetails = {
  self_level: InterestLevelOption;
  learning_goal: string;
  schedule: number[];
};

type Props = {
  visible: boolean;
  interestName: string;
  initial: InterestDetails;
  onClose: () => void;
  onSave: (next: InterestDetails) => void;
};

export function EditInterestDetailsModal({ visible, interestName, initial, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(1);
  const [level, setLevel] = useState<InterestLevelOption>(initial.self_level);
  const [learningGoal, setLearningGoal] = useState<string>(initial.learning_goal);
  const [schedule, setSchedule] = useState<number[]>(initial.schedule);

  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setLevel(initial.self_level);
    setLearningGoal(initial.learning_goal);
    setSchedule(initial.schedule);
  }, [visible, initial.self_level, initial.learning_goal, initial.schedule]);

  const toggleDay = useCallback((dayIndex: number) => {
    setSchedule((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex].sort((a, b) => a - b)
    );
  }, []);

  const handleBack = useCallback(() => {
    if (step > 1) setStep((s) => (s - 1) as Step);
  }, [step]);

  const handleNext = useCallback(() => {
    if (step < 3) setStep((s) => (s + 1) as Step);
  }, [step]);

  const handleSave = useCallback(() => {
    const next: InterestDetails = {
      self_level: level,
      learning_goal: learningGoal.trim(),
      schedule: schedule.length > 0 ? schedule : [0, 2, 4],
    };
    onSave(next);
    onClose();
  }, [level, learningGoal, schedule, onSave, onClose]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
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
          <Text style={styles.stepLabelCentered} pointerEvents="none">
            {interestName} • Step {step} of 3
          </Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
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
                <Text style={styles.question}>How would you describe your level?</Text>
                <View style={styles.options}>
                  {INTEREST_LEVEL_OPTIONS.map((opt) => (
                    <View key={opt} style={styles.optionItem}>
                      <OnboardingOptionCard label={opt} selected={level === opt} onSelect={() => setLevel(opt)} />
                    </View>
                  ))}
                </View>
                <Pressable onPress={handleNext} style={styles.primaryBtn}>
                  <LinearGradient colors={["#6D28D9", "#8B5CF6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnGradient}>
                    <Text style={styles.primaryBtnLabel}>Next</Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}

            {step === 2 && (
              <>
                <Text style={styles.question}>What are you trying to achieve?</Text>
                <Text style={styles.hint}>
                  Keep it specific. e.g. Run a 5K, finish a novel, play 3 songs on guitar.
                </Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="e.g. Run a 5K, finish a novel…"
                  placeholderTextColor={COLORS.muted}
                  value={learningGoal}
                  onChangeText={setLearningGoal}
                  multiline
                  numberOfLines={3}
                  maxLength={200}
                />
                <Pressable onPress={handleNext} style={styles.primaryBtn}>
                  <LinearGradient colors={["#6D28D9", "#8B5CF6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnGradient}>
                    <Text style={styles.primaryBtnLabel}>Next</Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}

            {step === 3 && (
              <>
                <Text style={styles.question}>Which days will you work on it?</Text>
                <Text style={styles.hint}>Pick the days you're willing to show up.</Text>
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
                <Pressable onPress={handleSave} style={styles.primaryBtn}>
                  <LinearGradient colors={["#6D28D9", "#8B5CF6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnGradient}>
                    <Text style={styles.primaryBtnLabel}>Save</Text>
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
  stepLabelCentered: {
    position: "absolute",
    left: 0,
    right: 0,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.muted,
    letterSpacing: 0.4,
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

