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
import type { OnboardingAnswers, OnboardingInterest, OnboardingQuitTarget } from "../context/OnboardingAnswersContext";
import { OnboardingProgressBar } from "../components/OnboardingProgressBar";
import { OnboardingOptionCard } from "../components/OnboardingOptionCard";
import { OnboardingSlider } from "../components/OnboardingSlider";
import { InterestWizardSheet } from "../components/InterestWizardSheet";
import { QuitWizardSheet } from "../components/QuitWizardSheet";
import { checkUsername } from "../utils/api";
import { COLORS, SPACING, RADIUS, ANIMATIONS, SHADOWS, GRADIENTS } from "../constants/theme";

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
  const [wizardInterestName, setWizardInterestName] = useState("");
  const [interestInputText, setInterestInputText] = useState("");
  const [quitSheetVisible, setQuitSheetVisible] = useState(false);
  const [wizardQuitName, setWizardQuitName] = useState("");
  const [quitInputText, setQuitInputText] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);

  const q13TrackWidthRef = useRef(0);
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

  // Set default username only when first landing on Q1 (never overwrite if user cleared to type their own)
  useLayoutEffect(() => {
    if (currentQuestionIndex !== 1) return;
    const existing = getAnswer("username");
    if (existing === undefined) {
      updateAnswer("username", defaultUsername);
    }
  }, [currentQuestionIndex, defaultUsername, getAnswer, updateAnswer]);

  // Set default slider value when landing on Q13 so Next is enabled (default 1.0h)
  useEffect(() => {
    if (currentQuestionIndex !== 13 || !config?.sliderRange) return;
    const existing = getAnswer("dailyHours");
    if (existing === undefined) {
      updateAnswer("dailyHours", 1.0);
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
      const items = (getAnswer("interests") as OnboardingInterest[] | undefined) ?? [];
      return items.length >= 1;
    }
    if (isQuitWithOther) return true;
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
    (item: OnboardingInterest) => {
      const prev = (getAnswer("interests") as OnboardingInterest[] | undefined) ?? [];
      updateAnswer("interests", [...prev, item]);
      setInterestInputText("");
      setWizardInterestName("");
      setAddInterestModalVisible(false);
    },
    [getAnswer, updateAnswer]
  );

  const openInterestWizard = useCallback((name: string) => {
    setWizardInterestName(name);
    setAddInterestModalVisible(true);
  }, []);

  const handleRemoveInterest = useCallback(
    (index: number) => {
      const prev = (getAnswer("interests") as OnboardingInterest[] | undefined) ?? [];
      const next = prev.filter((_, i) => i !== index);
      updateAnswer("interests", next.length ? next : undefined);
    },
    [getAnswer, updateAnswer]
  );

  const handleAddQuit = useCallback(
    (quit: OnboardingQuitTarget) => {
      const prev = (getAnswer("quitTargets") as OnboardingQuitTarget[] | undefined) ?? [];
      updateAnswer("quitTargets", [...prev, quit]);
      setQuitInputText("");
      setWizardQuitName("");
      setQuitSheetVisible(false);
    },
    [getAnswer, updateAnswer]
  );

  const openQuitWizard = useCallback((name: string) => {
    setWizardQuitName(name);
    setQuitSheetVisible(true);
  }, []);

  const handleRemoveQuit = useCallback(
    (index: number) => {
      const prev = (getAnswer("quitTargets") as OnboardingQuitTarget[] | undefined) ?? [];
      const next = prev.filter((_, i) => i !== index);
      updateAnswer("quitTargets", next.length ? next : undefined);
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

      const q13Value = c.questionNumber === 13 ? (typeof answer === "number" ? answer : 1.0) : sliderVal;
      const q13Percent = c.questionNumber === 13 ? (q13Value - 0.5) / 2.5 : 0;

      return (
        <>
          <Text style={[styles.questionText, c.questionNumber === 12 && styles.questionTextQ12]}>{c.questionText}</Text>

          {c.questionNumber === 13 && (
            <Text style={styles.q13Hint}>
              Even on your busiest day. This sets your mission floor — not a ceiling.
            </Text>
          )}

          {c.inputType === "username" && (
            <View style={styles.usernameSection}>
              <TextInput
                style={[
                  styles.usernameInput,
                  usernameError && styles.usernameInputError,
                  usernameFocused && styles.usernameInputFocusState,
                ]}
                placeholder={defaultUsername}
                placeholderTextColor={COLORS.muted}
                value={(answer as string) ?? ""}
                onChangeText={interactive ? (t) => { setUsernameError(null); updateAnswer("username", t); } : noop}
                onFocus={interactive ? () => setUsernameFocused(true) : noop}
                onBlur={interactive ? async () => {
                  setUsernameFocused(false);
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
                maxLength={20}
                editable={interactive}
              />
              <Text style={styles.usernameHintBelow}>Tap to edit · Max 20 characters</Text>
              {usernameError ? <Text style={styles.usernameErrorText}>{usernameError}</Text> : null}
            </View>
          )}

          {c.inputType === "interests_add" && (
            <View style={styles.q11Section}>
              <Text style={styles.q11Hint}>
                Add at least one. Type freely — &apos;trail running&apos; or &apos;learning guitar&apos; works perfectly.
              </Text>
              {((): React.ReactNode => {
                const interests = (getAnswer("interests") as OnboardingInterest[] | undefined) ?? [];
                return (
                  <>
                    {interests.length === 0 ? (
                      <View style={styles.q11EmptyTags}>
                        <Text style={styles.q11EmptyMain}>No interests added yet</Text>
                        <Text style={styles.q11EmptySub}>Add at least one to continue</Text>
                      </View>
                    ) : (
                      <View style={styles.q11Tags}>
                        {interests.map((item, i) => (
                          <View key={`${item.name}-${i}`} style={styles.q11Tag}>
                            <Text style={styles.q11TagText}>{item.name}</Text>
                            {interactive && (
                              <Pressable onPress={() => handleRemoveInterest(i)} hitSlop={6} style={styles.q11TagRemove}>
                                <Text style={styles.q11TagRemoveText}>×</Text>
                              </Pressable>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                    {interactive && (
                      <>
                        <View style={styles.q11InputRow}>
                          <TextInput
                            style={styles.q11Input}
                            placeholder="e.g. fitness, guitar, coding..."
                            placeholderTextColor="#2D3146"
                            value={interestInputText}
                            onChangeText={setInterestInputText}
                            returnKeyType="done"
                            onSubmitEditing={() => {
                              if (interestInputText.trim().length >= 2) openInterestWizard(interestInputText.trim());
                            }}
                          />
                          <Pressable
                            onPress={() => {
                              if (interestInputText.trim().length >= 2) openInterestWizard(interestInputText.trim());
                            }}
                            disabled={interestInputText.trim().length < 2}
                            style={[styles.q11AddBtn, interestInputText.trim().length < 2 && styles.q11AddBtnDisabled]}
                          >
                            <LinearGradient
                              colors={interestInputText.trim().length >= 2 ? ["#5B21B6", "#8B5CF6"] : ["rgba(42,48,80,0.35)", "rgba(42,48,80,0.35)"]}
                              style={styles.q11AddBtnGrad}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                            >
                              <Text style={styles.q11AddBtnLabel}>+</Text>
                            </LinearGradient>
                          </Pressable>
                        </View>
                        <Text style={styles.q11QuickLabel}>QUICK PICKS · TAP TO ADD</Text>
                        <View style={styles.q11QuickRow}>
                          {["Fitness", "Reading", "Coding", "Writing", "Music", "Art", "Language", "Photography"]
                            .filter((label) => !interests.some((i) => i.name.toLowerCase() === label.toLowerCase()))
                            .map((label) => (
                              <Pressable
                                key={label}
                                onPress={() => openInterestWizard(label)}
                                style={styles.q11QuickChip}
                              >
                                <Text style={styles.q11QuickChipText}>{label}</Text>
                              </Pressable>
                            ))}
                        </View>
                        <View style={styles.q11NoteRow}>
                          <View style={styles.q11NoteDot} />
                          <Text style={[styles.q11NoteText, interests.length > 0 && styles.q11NoteTextWith]}>
                            {interests.length === 0
                              ? "Minimum 1 interest required · editable from profile later"
                              : `${interests.length} interests added · tap × to remove or edit`}
                          </Text>
                        </View>
                      </>
                    )}
                    <InterestWizardSheet
                      visible={addInterestModalVisible}
                      onClose={() => { setAddInterestModalVisible(false); setWizardInterestName(""); }}
                      onAdd={handleAddInterest}
                      interestName={wizardInterestName || interestInputText.trim() || "Interest"}
                    />
                  </>
                );
              })()}
            </View>
          )}

          {c.inputType === "quit_with_other" && (
            <View style={styles.q12Section}>
              <View style={styles.q12InfoNote}>
                <Ionicons name="information-circle-outline" size={18} color="#F97316" />
                <Text style={styles.q12InfoText}>
                  Our system handles <Text style={styles.q12InfoHighlight}>any quit</Text> — big or small. Nail biting,
                  late-night snacking, doomscrolling. If it holds you back, it counts.
                </Text>
              </View>
              {((): React.ReactNode => {
                const raw = getAnswer("quitTargets");
                const quits: OnboardingQuitTarget[] = Array.isArray(raw)
                  ? raw.map((q) =>
                      typeof q === "string"
                        ? { name: q, description: "", trigger: "" }
                        : (q as OnboardingQuitTarget)
                    )
                  : [];
                return (
                  <>
                    {quits.length === 0 ? (
                      <View style={styles.q12EmptyTags}>
                        <Text style={styles.q12EmptyMain}>Nothing added · completely optional</Text>
                      </View>
                    ) : (
                      <View style={styles.q12Tags}>
                        {quits.map((item, i) => (
                          <View key={`${item.name}-${i}`} style={styles.q12Tag}>
                            <Text style={styles.q12TagText}>{item.name}</Text>
                            {interactive && (
                              <Pressable onPress={() => handleRemoveQuit(i)} hitSlop={6} style={styles.q12TagRemove}>
                                <Text style={styles.q12TagRemoveText}>×</Text>
                              </Pressable>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                    {interactive && (
                      <>
                        <View style={styles.q12InputRow}>
                          <TextInput
                            style={styles.q12Input}
                            placeholder="e.g. social media, junk food, nail biting..."
                            placeholderTextColor="#2D3146"
                            value={quitInputText}
                            onChangeText={setQuitInputText}
                            returnKeyType="done"
                            onSubmitEditing={() => {
                              if (quitInputText.trim().length >= 2) openQuitWizard(quitInputText.trim());
                            }}
                          />
                          <Pressable
                            onPress={() => {
                              if (quitInputText.trim().length >= 2) openQuitWizard(quitInputText.trim());
                            }}
                            disabled={quitInputText.trim().length < 2}
                            style={[styles.q12AddBtn, quitInputText.trim().length < 2 && styles.q12AddBtnDisabled]}
                          >
                            <LinearGradient
                              colors={quitInputText.trim().length >= 2 ? ["#C2410C", "#F97316"] : ["rgba(42,48,80,0.35)", "rgba(42,48,80,0.35)"]}
                              style={styles.q12AddBtnGrad}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                            >
                              <Text style={styles.q12AddBtnLabel}>+</Text>
                            </LinearGradient>
                          </Pressable>
                        </View>
                        <Text style={styles.q11QuickLabel}>COMMON PICKS</Text>
                        <View style={styles.q12QuickRow}>
                          {["Social media", "Gaming", "Junk food", "Alcohol", "Smoking", "Procrastinating"]
                            .filter((label) => !quits.some((q) => q.name.toLowerCase() === label.toLowerCase()))
                            .map((label) => (
                              <Pressable key={label} onPress={() => openQuitWizard(label)} style={styles.q12QuickChip}>
                                <Text style={styles.q12QuickChipText}>{label}</Text>
                              </Pressable>
                            ))}
                        </View>
                        <Text style={styles.q12OptionalNote}>This question is optional — tap Next to skip</Text>
                      </>
                    )}
                    <QuitWizardSheet
                      visible={quitSheetVisible}
                      onClose={() => { setQuitSheetVisible(false); setWizardQuitName(""); }}
                      onAdd={handleAddQuit}
                      quitName={wizardQuitName || quitInputText.trim() || "Quit"}
                    />
                  </>
                );
              })()}
            </View>
          )}

          {c.inputType === "slider" && c.questionNumber === 13 && (
            <View style={styles.q13Wrap}>
              <View style={styles.q13HeroCard} collapsable={false}>
                <View style={styles.q13HeroAccent} pointerEvents="none">
                  <LinearGradient
                    colors={["transparent", "rgba(139,92,246,0.35)", "transparent"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
                <Text style={styles.q13HeroValue}>
                  {q13Value === 1 ? "1h" : `${q13Value}h`}
                </Text>
                <Text style={styles.q13HeroLabel}>
                  {q13Value === 0.5
                    ? "30 minutes / day"
                    : q13Value === 1
                      ? "1 hour / day"
                      : `${q13Value} hours / day`}
                </Text>
              </View>
              <View
                style={styles.q13TrackWrap}
                onLayout={(e) => {
                  q13TrackWidthRef.current = e.nativeEvent.layout.width;
                }}
                onStartShouldSetResponder={() => interactive}
                onMoveShouldSetResponder={() => interactive}
                onResponderGrant={(e) => {
                  if (!interactive) return;
                  const x = e.nativeEvent.locationX;
                  const w = q13TrackWidthRef.current;
                  if (w <= 0) return;
                  const p = Math.max(0, Math.min(1, x / w));
                  const v = Math.round((0.5 + p * 2.5) * 2) / 2;
                  handleSliderChange(Math.min(3, Math.max(0.5, v)));
                }}
                onResponderMove={(e) => {
                  if (!interactive) return;
                  const x = e.nativeEvent.locationX;
                  const w = q13TrackWidthRef.current;
                  if (w <= 0) return;
                  const p = Math.max(0, Math.min(1, x / w));
                  const v = Math.round((0.5 + p * 2.5) * 2) / 2;
                  handleSliderChange(Math.min(3, Math.max(0.5, v)));
                }}
              >
                <View style={styles.q13TrackBg} />
                <View style={[styles.q13TrackFill, { width: `${q13Percent * 100}%` }]}>
                  <LinearGradient
                    colors={["#5B21B6", "#8B5CF6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
                <View
                  style={[
                    styles.q13Thumb,
                    { left: `${q13Percent * 100}%`, marginLeft: -13 },
                  ]}
                  pointerEvents="none"
                >
                  <LinearGradient
                    colors={["#7C3AED", "#A78BFA"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
              </View>
              <View style={styles.q13Ticks}>
                {[0.5, 1, 1.5, 2, 2.5, 3].map((_) => (
                  <View key={_} style={styles.q13Tick} />
                ))}
              </View>
              <View style={styles.q13RangeLabels}>
                <Text style={styles.q13RangeLabel}>0.5h</Text>
                <Text style={styles.q13RangeLabel}>3h</Text>
              </View>
              <View style={styles.q13ContextNote}>
                <View style={styles.q13ContextIconBox}>
                  <Ionicons name="flash" size={16} color="#8B5CF6" />
                </View>
                <Text style={styles.q13ContextText}>
                  {q13Value === 0.5 && (
                    <>
                      {"You'll get around "}
                      <Text style={styles.q13ContextMissionCount}>2–3 short missions</Text>
                      {" daily. A light start — the habit comes first."}
                    </>
                  )}
                  {q13Value === 1 && (
                    <>
                      {"Around "}
                      <Text style={styles.q13ContextMissionCount}>3–4 missions</Text>
                      {" daily. Enough to build real momentum across your goals."}
                    </>
                  )}
                  {q13Value === 1.5 && (
                    <>
                      {"Around "}
                      <Text style={styles.q13ContextMissionCount}>4–5 missions</Text>
                      {" daily. A solid daily practice with room for hard missions."}
                    </>
                  )}
                  {q13Value === 2 && (
                    <>
                      {"Around "}
                      <Text style={styles.q13ContextMissionCount}>5–6 missions</Text>
                      {" daily. Full engagement across all your interests and targets."}
                    </>
                  )}
                  {q13Value === 2.5 && (
                    <>
                      {"Around "}
                      <Text style={styles.q13ContextMissionCount}>6–8 missions</Text>
                      {" daily. Serious output. Expect longer, harder missions over time."}
                    </>
                  )}
                  {q13Value === 3 && (
                    <>
                      {"Around "}
                      <Text style={styles.q13ContextMissionCount}>8–10 missions</Text>
                      {" daily. High output mode. You set the bar — we'll match it."}
                    </>
                  )}
                </Text>
              </View>
            </View>
          )}
          {c.inputType === "slider" && c.questionNumber !== 13 && (
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
      handleAddQuit,
      handleRemoveQuit,
      openInterestWizard,
      openQuitWizard,
      defaultUsername,
      addInterestModalVisible,
      quitSheetVisible,
      interestInputText,
      quitInputText,
      wizardInterestName,
      wizardQuitName,
      usernameError,
      usernameFocused,
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
        colors={["#07080F", "#09091A", "#07080F"]}
        locations={[0, 0.5, 1]}
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
              <Animated.View style={[styles.buttonInner, buttonAnimatedStyle, (!hasAnswer() || usernameChecking) && styles.buttonInnerDisabled]}>
                <LinearGradient
                  colors={(!hasAnswer() || usernameChecking) ? ["rgba(42,48,80,0.40)", "rgba(42,48,80,0.40)"] : ["#5B21B6", "#8B5CF6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
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
    marginBottom: 0,
  },
  usernameSection: {
    marginTop: SPACING.xs,
  },
  usernameHintBelow: {
    fontSize: 11,
    color: "#2D3146",
    marginTop: 8,
    paddingLeft: 4,
  },
  usernameInput: {
    fontSize: 17,
    color: "#E5E7EB",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5,
    borderColor: "rgba(42,48,80,0.60)",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    ...(Platform.OS !== "web" && {
      shadowColor: "rgba(0,0,0,0.30)",
      shadowOffset: { width: 0, height: 0 },
      shadowRadius: 16,
      shadowOpacity: 1,
      elevation: 8,
    }),
  },
  usernameInputFocusState: {
    borderColor: "rgba(139,92,246,0.50)",
    ...(Platform.OS !== "web" && {
      shadowColor: "rgba(139,92,246,0.12)",
      shadowRadius: 12,
      shadowOpacity: 1,
    }),
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
  q11Section: { marginTop: SPACING.xs },
  q11Hint: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 1.5,
    marginBottom: 20,
  },
  q11EmptyTags: {
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(42,48,80,0.40)",
    borderRadius: 14,
    marginBottom: 12,
  },
  q11EmptyMain: { fontSize: 13, color: "#2D3146" },
  q11EmptySub: { fontSize: 11, color: "#1F2937", marginTop: 2 },
  q11Tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  q11Tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(109,40,217,0.15)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.40)",
    borderRadius: 24,
    paddingVertical: 7,
    paddingLeft: 12,
    paddingRight: 7,
  },
  q11TagText: { fontSize: 13, fontWeight: "600", color: "#C4B5FD" },
  q11TagRemove: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: "rgba(139,92,246,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  q11TagRemoveText: { fontSize: 9, color: "#A78BFA", fontWeight: "700" },
  q11InputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  q11Input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5,
    borderColor: "rgba(42,48,80,0.50)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#E5E7EB",
  },
  q11AddBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    overflow: "hidden",
    flexShrink: 0,
  },
  q11AddBtnDisabled: { opacity: 0.5 },
  q11AddBtnGrad: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  q11AddBtnLabel: { fontSize: 20, color: "#FFFFFF", fontWeight: "600" },
  q11QuickLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#2D3146",
    marginBottom: 6,
  },
  q11QuickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  q11QuickChip: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.40)",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  q11QuickChipText: { fontSize: 12, color: "#4B5563" },
  q11NoteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  q11NoteDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#8B5CF6",
  },
  q11NoteText: { fontSize: 11, color: "#374151" },
  q11NoteTextWith: { color: "#4B5563" },
  q12Section: { marginTop: SPACING.xs },
  q12InfoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(249,115,22,0.06)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.14)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  q12InfoText: {
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 18,
    flex: 1,
  },
  q12InfoHighlight: { color: "#F97316", fontWeight: "600" },
  q12EmptyTags: {
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(249,115,22,0.20)",
    borderRadius: 14,
    marginBottom: 10,
  },
  q12EmptyMain: { fontSize: 13, color: "#2D3146" },
  q12Tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  q12Tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(194,65,12,0.12)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.35)",
    borderRadius: 24,
    paddingVertical: 7,
    paddingLeft: 12,
    paddingRight: 7,
  },
  q12TagText: { fontSize: 13, fontWeight: "600", color: "#FDBA74" },
  q12TagRemove: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: "rgba(249,115,22,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  q12TagRemoveText: { fontSize: 9, color: "#FB923C", fontWeight: "700" },
  q12InputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  q12Input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5,
    borderColor: "rgba(42,48,80,0.50)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#E5E7EB",
  },
  q12AddBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    overflow: "hidden",
    flexShrink: 0,
  },
  q12AddBtnDisabled: { opacity: 0.5 },
  q12AddBtnGrad: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  q12AddBtnLabel: { fontSize: 20, color: "#FFFFFF", fontWeight: "600" },
  q12QuickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  q12QuickChip: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.35)",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  q12QuickChipText: { fontSize: 12, color: "#374151" },
  q12OptionalNote: {
    fontSize: 11,
    color: "#2D3146",
    marginTop: 6,
    paddingHorizontal: 2,
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
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 19.5,
    marginBottom: 28,
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
    fontSize: 26,
    fontWeight: "700",
    color: "#E5E7EB",
    letterSpacing: -0.4,
    lineHeight: 32.5,
    marginBottom: 8,
    textAlign: "center",
  },
  questionTextQ12: { fontSize: 22 },
  q13Hint: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  q13Wrap: {
    width: "100%",
    paddingHorizontal: 24,
    alignItems: "center",
  },
  q13HeroCard: {
    backgroundColor: "rgba(109,40,217,0.08)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.20)",
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 28,
    position: "relative",
    overflow: "hidden",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  q13HeroAccent: {
    position: "absolute",
    top: 0,
    left: "20%",
    right: "20%",
    height: 1,
    overflow: "hidden",
  },
  q13HeroValue: {
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: -2,
    lineHeight: 52,
    color: "#A78BFA",
    marginBottom: 4,
    textAlign: "center",
  },
  q13HeroLabel: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },
  q13TrackWrap: {
    width: "100%",
    height: 24,
    position: "relative",
    marginBottom: 8,
  },
  q13TrackBg: {
    position: "absolute",
    left: 0,
    right: 0,
    top: (24 - 5) / 2,
    height: 5,
    borderRadius: 4,
    backgroundColor: "rgba(42,48,80,0.70)",
  },
  q13TrackFill: {
    position: "absolute",
    left: 0,
    top: (24 - 5) / 2,
    height: 5,
    borderRadius: 4,
    overflow: "hidden",
    ...(Platform.OS === "ios" && {
      shadowColor: "rgba(139,92,246,0.40)",
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
    }),
  },
  q13Thumb: {
    position: "absolute",
    top: (24 - 26) / 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(139,92,246,0.20)",
    ...(Platform.OS === "ios" && {
      shadowColor: "rgba(109,40,217,0.50)",
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
    }),
  },
  q13Ticks: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginBottom: 4,
    width: "100%",
  },
  q13Tick: {
    width: 1,
    height: 6,
    borderRadius: 1,
    backgroundColor: "rgba(139,92,246,0.30)",
  },
  q13RangeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  q13RangeLabel: {
    fontSize: 11,
    color: "#374151",
  },
  q13ContextNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 16,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.025)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.35)",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  q13ContextIconBox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "rgba(109,40,217,0.15)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  q13ContextText: {
    flex: 1,
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 12 * 1.55,
  },
  q13ContextMissionCount: {
    fontWeight: "600",
    color: "#8B5CF6",
  },
  bottomSection: {
    paddingVertical: SPACING.md,
    paddingBottom: 48,
    alignItems: "center",
  },
  buttonWrapper: { width: "100%", maxWidth: 358, alignSelf: "center" },
  buttonInner: {
    borderRadius: 18,
    overflow: "hidden",
    ...(Platform.OS !== "web" && {
      shadowColor: "rgba(139,92,246,0.35)",
      shadowOffset: { width: 0, height: 0 },
      shadowRadius: 24,
      shadowOpacity: 1,
      elevation: 12,
    }),
  },
  buttonInnerDisabled: {
    ...(Platform.OS !== "web" && { shadowOpacity: 0, elevation: 0 }),
  },
  buttonGradient: {
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: "rgba(42,48,80,0.40)",
    ...(Platform.OS !== "web" && { shadowOpacity: 0, elevation: 0 }),
  },
  buttonLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    fontWeight: "700",
    color: "#F3F4F6",
  },
  buttonLabelDisabled: {
    color: "#374151",
  },
});
