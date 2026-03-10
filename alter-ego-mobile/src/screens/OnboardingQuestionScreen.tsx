/**
 * Onboarding Question Screen — single screen for Q1–Q13. No replace() between questions.
 * §2.11 progress bar, §2.2 option cards, §2.4 slider for Q12. Particle background.
 * Slide transitions via Reanimated (two-layer: outgoing + incoming).
 */

import React, { useEffect, useMemo, useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import type { OnboardingStackParamList } from "../navigation/types";
import { ONBOARDING_QUESTIONS, genderOptionToValue } from "../constants/onboardingQuestions";
import { useOnboardingAnswers } from "../context/OnboardingAnswersContext";
import type { OnboardingAnswers } from "../context/OnboardingAnswersContext";
import { OnboardingProgressBar } from "../components/OnboardingProgressBar";
import { supabase } from "../utils/supabase";
import { postOnboarding } from "../utils/api";
import { OnboardingOptionCard } from "../components/OnboardingOptionCard";
import { OnboardingSlider } from "../components/OnboardingSlider";
import { COLORS, SPACING, RADIUS, ANIMATIONS, SHADOWS } from "../constants/theme";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const TRANSITION_DURATION = 260;
const PARTICLE_COLORS = ["#8B5CF6", "#6D28D9", "#A78BFA"] as const;
const PARTICLE_SEED = 43;
const PARTICLE_COUNT = 24;

type ParticleConfig = {
  x: number;
  y: number;
  color: string;
  opacity: number;
  size: number;
  delayPhase: number;
  angle: number;
  amplitude: number;
  duration: number;
};

function createSeededRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

function getParticleConfigs(): ParticleConfig[] {
  const random = createSeededRandom(PARTICLE_SEED);
  const configs: ParticleConfig[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    configs.push({
      x: random() * (SCREEN_WIDTH - 16),
      y: random() * (SCREEN_HEIGHT - 16),
      color: PARTICLE_COLORS[Math.floor(random() * PARTICLE_COLORS.length)],
      opacity: 0.3 + random() * 0.3,
      size: 3 + random(),
      delayPhase: random() * 0.25,
      angle: random() * 2 * Math.PI,
      amplitude: 8 + random() * 8,
      duration: 4000 + random() * 4000,
    });
  }
  return configs;
}

function ParticleDot({ config }: { config: ParticleConfig }) {
  const phase = useSharedValue(0);
  useEffect(() => {
    phase.value = withRepeat(
      withTiming(1, { duration: config.duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [config.duration]);
  const animatedStyle = useAnimatedStyle(() => {
    "worklet";
    const p = (phase.value + config.delayPhase) * 2 * Math.PI;
    const t = Math.sin(p);
    const tx = config.amplitude * t * Math.cos(config.angle);
    const ty = config.amplitude * t * Math.sin(config.angle);
    return {
      transform: [{ translateX: tx }, { translateY: ty }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.particleDot,
        {
          left: config.x,
          top: config.y,
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          backgroundColor: config.color,
          opacity: config.opacity,
        },
        animatedStyle,
      ]}
      pointerEvents="none"
    />
  );
}

type Nav = StackNavigationProp<OnboardingStackParamList, "OnboardingQuestion">;
type Route = RouteProp<OnboardingStackParamList, "OnboardingQuestion">;

export function OnboardingQuestionScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { answers, getAnswer, updateAnswer } = useOnboardingAnswers();
  const scrollRef = useRef<ScrollView>(null);

  const [questionState, setQuestionState] = useState(() => ({
    currentQuestionIndex: route.params?.questionNumber ?? 1,
    transitionToIndex: null as number | null,
  }));
  const currentQuestionIndex = questionState.currentQuestionIndex;
  const transitionToIndex = questionState.transitionToIndex;

  const config = ONBOARDING_QUESTIONS[currentQuestionIndex - 1];
  const particleConfigs = useMemo(() => getParticleConfigs(), []);

  const slideOutX = useSharedValue(0);
  const slideInX = useSharedValue(SCREEN_WIDTH);

  const lastContentHeightRef = useRef(0);
  const animationStartedRef = useRef(false);
  const [incomingContentHeight, setIncomingContentHeight] = useState(0);

  const commitTransition = useCallback((newIndex: number) => {
    setQuestionState({ currentQuestionIndex: newIndex, transitionToIndex: null });
  }, []);

  // Reset slide shared values and incoming height only when we're in single-view.
  useEffect(() => {
    if (transitionToIndex === null) {
      slideOutX.value = 0;
      slideInX.value = SCREEN_WIDTH;
      setIncomingContentHeight(0);
      animationStartedRef.current = false;
    }
  }, [transitionToIndex]);

  // When transitioning: set initial positions; only start slide animation after incoming has laid out (so clip height is ready).
  useEffect(() => {
    if (transitionToIndex === null) return;
    const fromIndex = currentQuestionIndex;
    const toIndex = transitionToIndex;
    const isNext = toIndex > fromIndex;
    slideOutX.value = 0;
    slideInX.value = isNext ? SCREEN_WIDTH : -SCREEN_WIDTH;
  }, [transitionToIndex, currentQuestionIndex]);

  useEffect(() => {
    if (transitionToIndex === null || incomingContentHeight <= 0 || animationStartedRef.current) return;
    animationStartedRef.current = true;
    const toIndex = transitionToIndex;
    const fromIndex = currentQuestionIndex;
    const isNext = toIndex > fromIndex;
    const duration = TRANSITION_DURATION;
    const easing = Easing.out(Easing.ease);
    slideOutX.value = withTiming(isNext ? -SCREEN_WIDTH : SCREEN_WIDTH, { duration, easing });
    slideInX.value = withTiming(0, { duration, easing }, () => {
      "worklet";
      runOnJS(commitTransition)(toIndex);
    });
  }, [transitionToIndex, currentQuestionIndex, incomingContentHeight, commitTransition]);

  // Set default slider value when landing on Q12 so Next is enabled
  useEffect(() => {
    if (currentQuestionIndex !== 12 || !config?.sliderRange) return;
    const existing = getAnswer("dailyHours");
    if (existing === undefined) {
      updateAnswer("dailyHours", config.sliderRange[0]);
    }
  }, [currentQuestionIndex]);

  const outgoingStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideOutX.value }],
  }));
  const incomingStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideInX.value }],
  }));

  const currentAnswer = config ? getAnswer(config.answerKey as keyof OnboardingAnswers) : undefined;
  const isSlider = config?.inputType === "slider";
  const isMulti = config?.inputType === "multi";

  const hasAnswer = useCallback(() => {
    if (!config) return false;
    if (isSlider) return typeof currentAnswer === "number";
    if (isMulti) {
      if (!Array.isArray(currentAnswer) || currentAnswer.length === 0) return false;
      // Q10 interests: if "Something else" is selected, free-text is required
      if (config.answerKey === "interests" && currentAnswer.includes("Something else")) {
        const other = (getAnswer("interestOther") as string) ?? "";
        return other.trim().length > 0;
      }
      return true;
    }
    return currentAnswer !== undefined && currentAnswer !== null && currentAnswer !== "";
  }, [config, isSlider, isMulti, currentAnswer, getAnswer]);

  const [submitting, setSubmitting] = useState(false);
  const { setArchetypeContent } = useOnboardingAnswers();

  const handleNext = useCallback(async () => {
    if (!hasAnswer() || !config || transitionToIndex !== null) return;
    if (currentQuestionIndex < 13) {
      setQuestionState((prev) => ({ ...prev, transitionToIndex: prev.currentQuestionIndex + 1 }));
      return;
    }
    const snapshot: OnboardingAnswers = {
      ...answers,
      interests: answers.interests ? [...answers.interests] : undefined,
      quitTargets: answers.quitTargets ? [...answers.quitTargets] : undefined,
    };
    setSubmitting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Not signed in");
      const interestsList = Array.isArray(snapshot.interests) ? snapshot.interests : [];
      if (interestsList.includes("Something else") && snapshot.interestOther) {
        interestsList[interestsList.indexOf("Something else")] = snapshot.interestOther;
      }
      const payload = {
        answers: {
          gender: snapshot.gender,
          ageRange: snapshot.ageRange,
          situation: snapshot.situation,
          reason: snapshot.reason,
          taskApproach: snapshot.taskApproach,
          offTrack: snapshot.offTrack,
          motivation: snapshot.motivation,
          autonomy: snapshot.autonomy,
          comparison: snapshot.comparison,
          interests: snapshot.interests,
          quitTargets: snapshot.quitTargets,
          dailyHours: snapshot.dailyHours,
          commitmentTimeline: snapshot.commitmentTimeline,
        },
        interests: interestsList.filter(Boolean),
        quit_targets: Array.isArray(snapshot.quitTargets) ? snapshot.quitTargets : [],
        available_hours_per_day: typeof snapshot.dailyHours === "number" ? snapshot.dailyHours : 1,
        gender: snapshot.gender ?? null,
      };
      const response = await postOnboarding(payload, token);
      setArchetypeContent(response.archetype_content);
      navigation.replace("ArchetypeReveal", { answers: snapshot });
    } catch (e) {
      console.error("Onboarding submit failed", e);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
  }, [currentQuestionIndex, config, hasAnswer, transitionToIndex, navigation, answers, setArchetypeContent]);

  const handleBack = useCallback(() => {
    if (currentQuestionIndex <= 1 || transitionToIndex !== null) return;
    setQuestionState((prev) => ({ ...prev, transitionToIndex: prev.currentQuestionIndex - 1 }));
  }, [currentQuestionIndex, transitionToIndex]);

  const handleSingleSelect = useCallback(
    (option: string) => {
      if (!config) return;
      const key = config.answerKey as keyof OnboardingAnswers;
      if (config.answerKey === "gender") {
        updateAnswer(key, genderOptionToValue(option));
      } else {
        updateAnswer(key, option);
      }
    },
    [config, updateAnswer]
  );

  const handleMultiToggle = useCallback(
    (option: string) => {
      if (!config) return;
      const key = config.answerKey as keyof OnboardingAnswers;
      const current = (getAnswer(key) as string[]) ?? [];

      if (config.answerKey === "quitTargets") {
        const nothingOption = "Nothing right now";
        const hasNothing = current.includes(nothingOption);
        const isSelectingNothing = option === nothingOption;

        if (current.includes(option)) {
          updateAnswer(key, current.filter((x) => x !== option));
          return;
        }
        if (isSelectingNothing && current.length > 0) return;
        if (hasNothing && !isSelectingNothing) return;
        updateAnswer(key, [...current, option]);
        return;
      }

      const next = current.includes(option)
        ? current.filter((x) => x !== option)
        : [...current, option];
      updateAnswer(key, next);
      // If "Something else" was unchecked, clear the free-text so the object stays consistent
      if (config.answerKey === "interests" && option === "Something else" && next.indexOf("Something else") === -1) {
        updateAnswer("interestOther", "");
      }
    },
    [config, getAnswer, updateAnswer]
  );

  const handleSliderChange = useCallback(
    (value: number) => {
      if (!config) return;
      updateAnswer(config.answerKey as keyof OnboardingAnswers, value);
    },
    [config, updateAnswer]
  );

  const buttonScale = useSharedValue(1);
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const renderQuestionContent = useCallback(
    (index: number, interactive: boolean) => {
      const c = ONBOARDING_QUESTIONS[index - 1];
      if (!c) return null;
      const answer = getAnswer(c.answerKey as keyof OnboardingAnswers);
      const isSliderQ = c.inputType === "slider";
      const isMultiQ = c.inputType === "multi";
      const sliderRange = c.sliderRange ?? [0.5, 4, 0.5];
      const sliderVal = typeof answer === "number" ? answer : sliderRange[0];
      const noop = () => {};

      return (
        <>
          <Text style={styles.questionText}>{c.questionText}</Text>
          {c.inputType === "slider" && (
            <OnboardingSlider
              min={sliderRange[0]}
              max={sliderRange[1]}
              step={sliderRange[2]}
              value={sliderVal}
              onValueChange={interactive ? handleSliderChange : noop}
            />
          )}
          {c.inputType === "single" && (
            <View style={styles.optionsList}>
              {c.options.map((opt) => (
                <View key={opt} style={styles.optionItem}>
                  <OnboardingOptionCard
                    label={opt}
                    selected={
                      c.answerKey === "gender"
                        ? (answer as string) === genderOptionToValue(opt)
                        : (answer as string) === opt
                    }
                    onSelect={interactive ? () => handleSingleSelect(opt) : noop}
                  />
                </View>
              ))}
            </View>
          )}
          {c.inputType === "multi" && (
            <View style={styles.multiSection}>
              <Text style={styles.multiHint}>Select all that apply</Text>
              {c.answerKey === "interests" && (
                <Text style={styles.interestsNote}>
                  Interests selected in onboarding are editable later from Profile → Interests tab.
                </Text>
              )}
              <View style={styles.multiList}>
                {c.options.map((opt) => (
                  <View key={opt} style={styles.optionItem}>
                    <OnboardingOptionCard
                      label={opt}
                      selected={(answer as string[] | undefined)?.includes(opt) ?? false}
                      onSelect={interactive ? () => handleMultiToggle(opt) : noop}
                      multiSelect
                    />
                  </View>
                ))}
              </View>
              {c.answerKey === "interests" &&
                (answer as string[] | undefined)?.includes("Something else") && (
                  <View style={styles.otherInterestWrap}>
                    <Text style={styles.otherInterestLabel}>What is it?</Text>
                    <TextInput
                      style={styles.otherInterestInput}
                      placeholder="e.g. Gardening, Podcasts…"
                      placeholderTextColor={COLORS.muted}
                      value={(getAnswer("interestOther") as string) ?? ""}
                      onChangeText={interactive ? (t) => updateAnswer("interestOther", t) : noop}
                      onFocus={() => {
                        if (interactive)
                          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
                      }}
                      maxLength={80}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={interactive}
                    />
                  </View>
                )}
            </View>
          )}
        </>
      );
    },
    [
      getAnswer,
      updateAnswer,
      handleSingleSelect,
      handleMultiToggle,
      handleSliderChange,
    ]
  );

  if (!config) {
    return (
      <View style={styles.root}>
        <Text style={styles.error}>Invalid question</Text>
      </View>
    );
  }

  const isTransitioning = transitionToIndex !== null;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[COLORS.bg1, COLORS.bg0]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <View style={[StyleSheet.absoluteFill, styles.particleContainer]} pointerEvents="none">
        {particleConfigs.map((c, i) => (
          <ParticleDot key={i} config={c} />
        ))}
      </View>

      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <View style={styles.topRow}>
            <OnboardingProgressBar questionNumber={currentQuestionIndex} />
            <Pressable
              onPress={handleBack}
              style={[styles.backButton, currentQuestionIndex <= 1 && styles.backButtonReserved]}
              hitSlop={12}
              disabled={isTransitioning || currentQuestionIndex <= 1}
              pointerEvents={currentQuestionIndex <= 1 ? "none" : "auto"}
            >
              <Ionicons name="chevron-back" size={24} color={COLORS.text} />
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View
              style={[
                styles.contentClip,
                isTransitioning && {
                  minHeight: Math.max(lastContentHeightRef.current || 0, incomingContentHeight || 0),
                },
              ]}
            >
              {!isTransitioning ? (
                <View
                  style={styles.contentLayer}
                  onLayout={(e) => {
                    lastContentHeightRef.current = e.nativeEvent.layout.height;
                  }}
                >
                  {renderQuestionContent(currentQuestionIndex, true)}
                </View>
              ) : (
                <>
                  <Animated.View style={[styles.contentLayer, outgoingStyle]} pointerEvents="none">
                    {renderQuestionContent(currentQuestionIndex, false)}
                  </Animated.View>
                  <Animated.View style={[styles.contentLayer, styles.contentLayerIncoming, incomingStyle]} pointerEvents="none">
                    <View
                      style={styles.contentLayerMeasure}
                      onLayout={(e) => setIncomingContentHeight(e.nativeEvent.layout.height)}
                    >
                      {renderQuestionContent(transitionToIndex!, false)}
                    </View>
                  </Animated.View>
                </>
              )}
            </View>
          </ScrollView>

          <View style={styles.bottomSection}>
            <Pressable
              onPress={handleNext}
              disabled={!hasAnswer() || isTransitioning || submitting}
              onPressIn={() => {
                if (!submitting) buttonScale.value = withTiming(ANIMATIONS.pressScale, { duration: ANIMATIONS.pressIn });
              }}
              onPressOut={() => {
                buttonScale.value = withTiming(1, { duration: ANIMATIONS.pressOut });
              }}
              style={styles.buttonWrapper}
            >
              <Animated.View style={[styles.buttonInner, buttonAnimatedStyle]}>
                <LinearGradient
                  colors={["#6D28D9", "#8B5CF6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.buttonGradient, (!hasAnswer() || submitting) && styles.buttonDisabled]}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={COLORS.text} />
                  ) : (
                    <Text style={[styles.buttonLabel, !hasAnswer() && styles.buttonLabelDisabled]}>
                      {currentQuestionIndex < 13 ? "Next" : "Continue"}
                    </Text>
                  )}
                </LinearGradient>
              </Animated.View>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  error: { color: COLORS.text, padding: SPACING.md },
  particleDot: { position: "absolute" },
  particleContainer: { overflow: "hidden" },
  safeArea: {
    flex: 1,
    paddingHorizontal: SPACING.screenPadding,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: SPACING.md,
    paddingBottom: 24,
  },
  contentClip: {
    width: "100%",
    overflow: "hidden",
  },
  contentLayer: {
    width: "100%",
  },
  contentLayerMeasure: {
    width: "100%",
  },
  contentLayerIncoming: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    width: "100%",
  },
  topRow: {
    flexDirection: "column",
  },
  backButton: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    alignSelf: "flex-start",
  },
  backButtonReserved: {
    opacity: 0,
  },
  optionsList: {},
  optionItem: {
    marginBottom: SPACING.cardGap,
  },
  multiSection: {
    marginTop: SPACING.xs,
  },
  multiHint: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.muted,
    marginBottom: SPACING.sm,
    letterSpacing: 0.3,
  },
  interestsNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    fontWeight: "400",
    color: COLORS.muted,
    marginBottom: SPACING.sm,
    fontStyle: "italic",
  },
  multiList: {
    marginBottom: SPACING.cardGap,
  },
  otherInterestWrap: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  otherInterestLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.text2,
    marginBottom: SPACING.xs,
  },
  otherInterestInput: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surface2,
    borderRadius: RADIUS.card,
    minHeight: 64,
    paddingVertical: SPACING.cardPadding,
    paddingHorizontal: SPACING.cardPadding,
  },
  questionText: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.lg,
    textAlign: "center",
  },
  bottomSection: {
    paddingVertical: SPACING.md,
    paddingBottom: 48,
    alignItems: "center",
  },
  buttonWrapper: { width: "100%", maxWidth: 358, alignSelf: "center" },
  buttonInner: {
    ...SHADOWS.button,
    borderRadius: RADIUS.card,
    overflow: "hidden",
  },
  buttonGradient: {
    height: 56,
    borderRadius: RADIUS.card,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: COLORS.surface2,
    opacity: 0.6,
  },
  buttonLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    fontWeight: "600",
    color: "#F3F4F6",
  },
  buttonLabelDisabled: {
    color: COLORS.muted,
  },
});
