/**
 * Onboarding Question Screen — single screen for Q1–Q13. No replace() between questions.
 * §2.11 progress bar, §2.2 option cards, §2.4 slider for Q12. Particle background.
 * Slide transitions via Reanimated (two-layer: outgoing + incoming).
 */

import React, { useEffect, useLayoutEffect, useMemo, useCallback, useRef, useState } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../utils/supabase";
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
import {
  ONBOARDING_QUESTIONS,
  TOTAL_ONBOARDING_QUESTIONS,
  genderOptionToValue,
} from "../constants/onboardingQuestions";
import { useOnboardingAnswers } from "../context/OnboardingAnswersContext";
import type { OnboardingAnswers, OnboardingInterestItem } from "../context/OnboardingAnswersContext";
import { OnboardingProgressBar } from "../components/OnboardingProgressBar";
import { OnboardingOptionCard } from "../components/OnboardingOptionCard";
import { OnboardingSlider } from "../components/OnboardingSlider";
import { AddInterestOnboardingModal } from "../components/AddInterestOnboardingModal";
import { checkUsername } from "../utils/api";
import { COLORS, SPACING, RADIUS, ANIMATIONS, SHADOWS } from "../constants/theme";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const TRANSITION_DURATION = 260;
const ONBOARDING_DRAFT_KEY = "@alter_ego_onboarding_draft";
const DRAFT_SAVE_DEBOUNCE_MS = 600;
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
  const { answers, getAnswer, updateAnswer, hydrateAnswers } = useOnboardingAnswers();
  const scrollRef = useRef<ScrollView>(null);
  const draftRestoredRef = useRef(false);

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
  const [addInterestModalVisible, setAddInterestModalVisible] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);

  const randomUsernameRef = useRef<string | null>(null);
  if (randomUsernameRef.current === null) {
    const words = ["shadow", "steady", "quiet", "bold", "swift", "ember", "pulse", "strider", "runner"];
    const w = words[Math.floor(Math.random() * words.length)];
    const n = Math.floor(10 + Math.random() * 90);
    randomUsernameRef.current = `${w}_${n}`;
  }
  const defaultUsername = randomUsernameRef.current;

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

  // Restore onboarding draft only when we first land on Q1 (from Framing), not when user pressed Back to Q1
  const initialQuestionParam = route.params?.questionNumber ?? 1;
  useEffect(() => {
    if (currentQuestionIndex !== 1 || draftRestoredRef.current || initialQuestionParam !== 1) return;
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) return;
      try {
        const raw = await AsyncStorage.getItem(ONBOARDING_DRAFT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw) as { userId: string; answers: OnboardingAnswers; currentQuestionIndex: number };
        if (draft.userId !== userId || !draft.answers || draft.currentQuestionIndex < 1) return;
        draftRestoredRef.current = true;
        hydrateAnswers(draft.answers);
        if (draft.currentQuestionIndex > 1) {
          navigation.replace("OnboardingQuestion", { questionNumber: draft.currentQuestionIndex });
        }
      } catch (_) {}
    })();
  }, [currentQuestionIndex, initialQuestionParam, hydrateAnswers, navigation]);

  // Persist draft so progress is not lost when app is closed (sign-in-later users)
  const saveDraftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data: s } = await supabase.auth.getSession();
      const userId = s?.session?.user?.id;
      if (!userId || cancelled) return;
      try {
        await AsyncStorage.setItem(
          ONBOARDING_DRAFT_KEY,
          JSON.stringify({
            userId,
            answers,
            currentQuestionIndex,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch (_) {}
    }, DRAFT_SAVE_DEBOUNCE_MS);
    saveDraftTimeoutRef.current = t;
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [answers, currentQuestionIndex]);

  // Set default username when landing on Q1 (before paint so input isn't empty)
  useLayoutEffect(() => {
    if (currentQuestionIndex !== 1) return;
    const existing = getAnswer("username");
    if (existing === undefined || existing === "") {
      updateAnswer("username", defaultUsername);
    }
  }, [currentQuestionIndex, defaultUsername, getAnswer, updateAnswer]);

  // Set default slider value when landing on Q13 so Next is enabled
  useEffect(() => {
    if (currentQuestionIndex !== 13 || !config?.sliderRange) return;
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
  const isUsername = config?.inputType === "username";
  const isInterestsAdd = config?.inputType === "interests_add";
  const isQuitWithOther = config?.inputType === "quit_with_other";

  const hasAnswer = useCallback(() => {
    if (!config) return false;
    if (isUsername) {
      const u = (getAnswer("username") as string) ?? "";
      return u.trim().length > 0;
    }
    if (isInterestsAdd) {
      const items = (getAnswer("interestItems") as OnboardingInterestItem[] | undefined) ?? [];
      return items.length >= 1;
    }
    if (isQuitWithOther) {
      const current = (getAnswer("quitTargets") as string[] | undefined) ?? [];
      if (current.length === 0) return false;
      if (current.includes("Something else")) {
        const other = (getAnswer("quitOther") as string) ?? "";
        return other.trim().length > 0;
      }
      return true;
    }
    if (isSlider) return typeof currentAnswer === "number";
    if (isMulti) {
      if (!Array.isArray(currentAnswer) || currentAnswer.length === 0) return false;
      return true;
    }
    return currentAnswer !== undefined && currentAnswer !== null && currentAnswer !== "";
  }, [config, isSlider, isMulti, isUsername, isInterestsAdd, isQuitWithOther, currentAnswer, getAnswer]);

  const checkUsernameAndProceed = useCallback(async () => {
    if (currentQuestionIndex !== 1 || !hasAnswer() || !config || transitionToIndex !== null) return;
    const un = ((getAnswer("username") as string) ?? "").trim();
    if (!un) return;
    setUsernameError(null);
    setUsernameChecking(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (token) await checkUsername(un, token);
    } catch (e) {
      setUsernameChecking(false);
      setUsernameError(e instanceof Error ? e.message : "Username already taken");
      return;
    }
    setUsernameChecking(false);
    if (currentQuestionIndex < TOTAL_ONBOARDING_QUESTIONS) {
      setQuestionState((prev) => ({ ...prev, transitionToIndex: prev.currentQuestionIndex + 1 }));
      return;
    }
    const snapshot: OnboardingAnswers = {
      ...answers,
      interestItems: answers.interestItems ? [...answers.interestItems] : undefined,
      interests: answers.interests ? [...answers.interests] : undefined,
      quitTargets: answers.quitTargets ? [...answers.quitTargets] : undefined,
    };
    navigation.replace("ArchetypeReveal", { answers: snapshot });
  }, [currentQuestionIndex, config, hasAnswer, transitionToIndex, navigation, answers, getAnswer]);

  const handleNext = useCallback(() => {
    if (!hasAnswer() || !config || transitionToIndex !== null) return;
    if (currentQuestionIndex === 1) {
      checkUsernameAndProceed();
      return;
    }
    if (currentQuestionIndex < TOTAL_ONBOARDING_QUESTIONS) {
      setQuestionState((prev) => ({ ...prev, transitionToIndex: prev.currentQuestionIndex + 1 }));
      return;
    }
    const snapshot: OnboardingAnswers = {
      ...answers,
      interestItems: answers.interestItems ? [...answers.interestItems] : undefined,
      interests: answers.interests ? [...answers.interests] : undefined,
      quitTargets: answers.quitTargets ? [...answers.quitTargets] : undefined,
    };
    navigation.replace("ArchetypeReveal", { answers: snapshot });
  }, [currentQuestionIndex, config, hasAnswer, transitionToIndex, navigation, answers, checkUsernameAndProceed]);

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
          if (option === "Something else") updateAnswer("quitOther", "");
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

  const handleAddInterest = useCallback(
    (item: OnboardingInterestItem) => {
      const prev = (getAnswer("interestItems") as OnboardingInterestItem[] | undefined) ?? [];
      updateAnswer("interestItems", [...prev, item]);
      const names = (getAnswer("interests") as string[] | undefined) ?? [];
      updateAnswer("interests", [...names, item.name]);
    },
    [getAnswer, updateAnswer]
  );

  const handleRemoveInterest = useCallback(
    (index: number) => {
      const prev = (getAnswer("interestItems") as OnboardingInterestItem[] | undefined) ?? [];
      const next = prev.filter((_, i) => i !== index);
      updateAnswer("interestItems", next.length ? next : undefined);
      const names = next.map((x) => x.name);
      updateAnswer("interests", names.length ? names : undefined);
    },
    [getAnswer, updateAnswer]
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

          {c.inputType === "username" && (
            <View style={styles.usernameSection}>
              <Text style={styles.usernameHint}>Unique name others might see. Tap to edit.</Text>
              <TextInput
                style={[styles.usernameInput, usernameError && styles.usernameInputError]}
                placeholder={defaultUsername}
                placeholderTextColor={COLORS.muted}
                value={(answer as string) ?? ""}
                onChangeText={interactive ? (t) => { setUsernameError(null); updateAnswer("username", t); } : noop}
                onBlur={interactive ? async () => {
                  const un = ((getAnswer("username") as string) ?? "").trim();
                  if (!un) return;
                  try {
                    const { data: session } = await supabase.auth.getSession();
                    const token = session?.session?.access_token;
                    if (token) await checkUsername(un, token);
                    setUsernameError(null);
                  } catch (_) {
                    setUsernameError("Username already taken");
                  }
                } : noop}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={32}
                editable={interactive}
              />
              {usernameError ? <Text style={styles.usernameErrorText}>{usernameError}</Text> : null}
            </View>
          )}

          {c.inputType === "interests_add" && (
            <View style={styles.interestsAddSection}>
              <Text style={styles.multiHint}>Add at least one. Type freely — e.g. guitar, running, coding.</Text>
              <View style={styles.interestChips}>
                {((getAnswer("interestItems") as OnboardingInterestItem[] | undefined) ?? []).map((item, i) => (
                  <View key={`${item.name}-${i}`} style={styles.interestChipRow}>
                    <View style={styles.interestChip}>
                      <Text style={styles.interestChipText}>{item.name}</Text>
                      {interactive && (
                        <Pressable
                          onPress={() => handleRemoveInterest(i)}
                          hitSlop={8}
                          style={styles.interestChipRemove}
                        >
                          <Ionicons name="close-circle" size={20} color={COLORS.muted} />
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
              </View>
              {interactive && (
                <Pressable
                  onPress={() => setAddInterestModalVisible(true)}
                  style={styles.addInterestBtn}
                >
                  <Ionicons name="add-circle-outline" size={22} color={COLORS.violet} />
                  <Text style={styles.addInterestBtnLabel}>Add interest</Text>
                </Pressable>
              )}
              <AddInterestOnboardingModal
                visible={addInterestModalVisible}
                onClose={() => setAddInterestModalVisible(false)}
                onAdd={handleAddInterest}
              />
            </View>
          )}

          {c.inputType === "quit_with_other" && (
            <View style={styles.multiSection}>
              <Text style={styles.multiHint}>Select all that apply</Text>
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
              {(answer as string[] | undefined)?.includes("Something else") && (
                <View style={styles.otherInterestWrap}>
                  <Text style={styles.otherInterestLabel}>What habit are you trying to quit?</Text>
                  <TextInput
                    style={styles.otherInterestInput}
                    placeholder="e.g. Late-night scrolling, stress eating…"
                    placeholderTextColor={COLORS.muted}
                    value={(getAnswer("quitOther") as string) ?? ""}
                    onChangeText={interactive ? (t) => updateAnswer("quitOther", t) : noop}
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
      handleAddInterest,
      handleRemoveInterest,
      defaultUsername,
      addInterestModalVisible,
      usernameError,
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
              disabled={!hasAnswer() || isTransitioning || usernameChecking}
              onPressIn={() => {
                buttonScale.value = withTiming(ANIMATIONS.pressScale, { duration: ANIMATIONS.pressIn });
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
                  style={[styles.buttonGradient, (!hasAnswer() || usernameChecking) && styles.buttonDisabled]}
                >
                  {usernameChecking ? (
                    <ActivityIndicator size="small" color={COLORS.text} />
                  ) : (
                    <Text style={[styles.buttonLabel, !hasAnswer() && styles.buttonLabelDisabled]}>
                      {currentQuestionIndex < TOTAL_ONBOARDING_QUESTIONS ? "Next" : "Continue"}
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
  usernameSection: {
    marginTop: SPACING.xs,
  },
  usernameHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: SPACING.sm,
    textAlign: "center",
  },
  usernameInput: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
  },
  usernameInputError: {
    borderColor: COLORS.danger,
  },
  usernameErrorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.danger,
    marginTop: SPACING.xs,
  },
  interestsAddSection: {
    marginTop: SPACING.xs,
  },
  interestChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  interestChipRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  interestChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.chip,
    paddingVertical: SPACING.sm,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.sm,
  },
  interestChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: COLORS.text,
    marginRight: SPACING.xs,
  },
  interestChipRemove: {
    padding: 2,
  },
  addInterestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.violet,
    borderRadius: RADIUS.card,
  },
  addInterestBtnLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: COLORS.violet,
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
