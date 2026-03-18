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
  Alert,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/utils/supabase";
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
import Svg, { Polygon } from "react-native-svg";
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
import { onboardingService } from "@/services/onboarding";
import { useOnboarding } from "@/hooks/useOnboarding";
import { COLORS, SPACING, RADIUS, ANIMATIONS, SHADOWS, GRADIENTS } from "../constants/theme";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const TRANSITION_DURATION = 260;
const ONBOARDING_DRAFT_KEY = "@alter_ego_onboarding_draft";
const DRAFT_SAVE_DEBOUNCE_MS = 600;
const PARTICLE_COLORS = ["#8B5CF6", "#6D28D9", "#A78BFA"] as const;
const PARTICLE_SEED = 43;
const PARTICLE_COUNT = 24;

const ONBOARDING_COMPLETION_MESSAGES = [
  "Reading your answers...",
  "Building your discipline DNA...",
  "Preparing your first missions...",
];

/** Backend question_key per step (Q15 timezone saved silently after Q14). */
const QUESTION_KEYS: Record<number, string> = {
  1: "q1_username",
  2: "q2_gender",
  3: "q3_age",
  4: "q4_situation",
  5: "q5_reason",
  6: "q6_approach",
  7: "q7_recovery",
  8: "q8_motivation",
  9: "q9_autonomy",
  10: "q10_comparison",
  11: "q11_interests",
  12: "q12_quits",
  13: "q13_hours",
};

/**
 * Map onboarding UI labels (Q4–Q10) to backend scoring keys.
 * If a label is missing from the map, we fall back to raw label.
 */
const ARCHETYPE_ANSWER_MAP: Record<string, Record<string, string>> = {
  q4_situation: {
    "Grinding hard but staying inconsistent": "overwhelmed",
    "Starting completely fresh": "rebuilding",
    "Trying to quit something that's holding me back": "stuck",
    "Looking to become a better version of myself": "ambitious",
  },
  q5_reason: {
    "I keep failing at habits and I'm tired of it": "escape_habit",
    "I want to become someone genuinely different": "prove_to_self",
    "I need to quit something for good": "escape_habit",
    "Someone showed me this": "level_up",
  },
  q6_approach: {
    "Plan it out properly before starting": "systems_first",
    "Dive straight in and figure it out": "jump_in",
    "Put it off until I can't anymore": "depends_on_mood",
    "Break it into the smallest possible steps": "research_first",
  },
  q7_recovery: {
    "Feel guilty and spiral further": "guilt_spiral",
    "Shake it off and start again": "restart_immediately",
    "Use it as fuel to come back harder": "restart_immediately",
    "Pretend it didn't happen and move on": "need_time",
  },
  q8_motivation: {
    "I could see the progress happening": "internal_standards",
    "I didn't want to let myself down": "fear_of_regret",
    "It was genuinely enjoyable": "curiosity",
    "Someone was counting on me": "external_validation",
  },
  q9_autonomy: {
    "Appreciate the structure — it helps": "guidance_welcome",
    "Feel a little annoyed by it": "full_control",
    "Depends entirely on who's telling me": "flexible",
    "Tune it out almost automatically": "full_control",
  },
  q10_comparison: {
    "I love it — competition drives me": "drives_me",
    "Indifferent — I don't think about it": "dont_care",
    "Mildly motivating when I'm ahead": "motivates_briefly",
    "I'd rather just run my own race": "dont_care",
  },
};

const LEVEL_TO_API: Record<string, string> = {
  beginner: "still_figuring_it_out",
  intermediate: "getting_the_hang_of_it",
  advanced: "pretty_solid",
};

function ageRangeToInt(ageRange: string | undefined): number {
  const m: Record<string, number> = {
    "Under 18": 17,
    "18–24": 21,
    "25–34": 30,
    "35–44": 40,
    "45+": 50,
  };
  return m[ageRange ?? ""] ?? 24;
}

function commitmentLabelToApi(
  label: string | undefined
): "2_weeks" | "1_month" | "3_months" | "however_long" {
  if (label === "2 weeks") return "2_weeks";
  if (label === "1 month") return "1_month";
  if (label === "3 months") return "3_months";
  return "however_long";
}

function mapInterestToStepApi(i: OnboardingInterest) {
  const days = i.schedule?.length ? i.schedule.map((d) => d + 1) : [1, 2, 3, 4, 5, 6, 7];
  return {
    raw_text: i.name,
    level_text: LEVEL_TO_API[i.level] || "still_figuring_it_out",
    goal: i.goal || null,
    active_days: days,
  };
}

function buildStepPayload(
  questionNum: number,
  a: OnboardingAnswers
): Record<string, unknown> | null {
  if (questionNum === 1) {
    return { value: ((a.username as string) || "").trim().toLowerCase() };
  }
  if (questionNum === 2) return { value: a.gender };
  if (questionNum === 3) return { value: ageRangeToInt(a.ageRange) };
  if (questionNum >= 4 && questionNum <= 10) {
    const key = QUESTION_KEYS[questionNum];
    const rawValue =
      questionNum === 4
        ? a.situation
        : questionNum === 5
          ? a.reason
          : questionNum === 6
            ? a.taskApproach
            : questionNum === 7
              ? a.offTrack
              : questionNum === 8
                ? a.motivation
                : questionNum === 9
                  ? a.autonomy
                  : a.comparison;
    const mappedValue =
      key && typeof rawValue === "string"
        ? ARCHETYPE_ANSWER_MAP[key]?.[rawValue] ?? rawValue
        : rawValue;
    return { value: mappedValue };
  }
  if (questionNum === 11) {
    const list = (a.interests ?? []).map(mapInterestToStepApi);
    return { interests: list };
  }
  if (questionNum === 12) {
    const quits = (a.quitTargets ?? []).map((q) => ({
      raw_text: q.name,
      description: q.description || null,
      trigger: q.trigger || null,
    }));
    return { quit_targets: quits };
  }
  if (questionNum === 13) return { value: a.dailyHours ?? 1 };
  return null;
}

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
  const [completingOnboarding, setCompletingOnboarding] = useState(false);
  const [completionMsgIdx, setCompletionMsgIdx] = useState(0);
  const completionPulse = useSharedValue(0);
  const completionTextOpacity = useSharedValue(1);
  const completionHexRotation = useSharedValue(0);

  const {
    initializeProfile,
    saveAnswer,
    checkUsername: debouncedCheckUsername,
    usernameAvailable,
    usernameSuggestion,
    isCheckingUsername,
    completeOnboarding,
    isCompleting,
    error: completeOnboardingError,
  } = useOnboarding();

  useEffect(() => {
    void initializeProfile();
  }, [initializeProfile]);

  useEffect(() => {
    if (!completingOnboarding && !isCompleting) return;
    setCompletionMsgIdx(0);
    const id = setInterval(() => {
      setCompletionMsgIdx((i) => (i + 1) % ONBOARDING_COMPLETION_MESSAGES.length);
    }, 2000);
    completionHexRotation.value = 0;
    completionHexRotation.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.linear }),
      -1,
      false
    );
    return () => {
      clearInterval(id);
      completionHexRotation.value = 0;
    };
  }, [completingOnboarding, isCompleting, completionHexRotation]);

  useEffect(() => {
    if (!completingOnboarding && !isCompleting) return;
    completionTextOpacity.value = 0;
    completionTextOpacity.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.ease) });
  }, [completionMsgIdx, completingOnboarding, isCompleting, completionTextOpacity]);

  const completionHexStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${completionHexRotation.value * 2 * Math.PI}rad` }],
  }));

  const completionTextStyle = useAnimatedStyle(() => ({
    opacity: completionTextOpacity.value,
  }));

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
    const un = ((getAnswer("username") as string) ?? "").trim().toLowerCase();
    if (!un) return;
    setUsernameError(null);
    setUsernameChecking(true);
    try {
      const res = await onboardingService.checkUsername(un);
      if (!res.available) {
        setUsernameChecking(false);
        setUsernameError(
          res.suggestion ? `That name is taken. Try ${res.suggestion}` : "Username already taken"
        );
        return;
      }
      await onboardingService.saveStep({
        question_key: "q1_username",
        answer_json: { value: un },
      });
    } catch (e) {
      setUsernameChecking(false);
      setUsernameError(e instanceof Error ? e.message : "Could not verify username");
      return;
    }
    setUsernameChecking(false);
    setQuestionState((prev) => ({ ...prev, transitionToIndex: prev.currentQuestionIndex + 1 }));
  }, [currentQuestionIndex, config, hasAnswer, transitionToIndex, getAnswer]);

  const handleFinalNext = useCallback(async () => {
    if (currentQuestionIndex !== 14 || completingOnboarding || isCompleting) return;
    const label = getAnswer("commitmentTimeline") as string | undefined;
    const apiVal = commitmentLabelToApi(label);
    setCompletingOnboarding(true);
    setCompletionMsgIdx(0);
    try {
      await onboardingService.saveStep({
        question_key: "q14_commitment",
        answer_json: { value: apiVal },
      });
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
      await onboardingService.saveStep({
        question_key: "q15_timezone",
        answer_json: { value: tz },
      });
      const result = await completeOnboarding();
      if (result) {
        navigation.replace("ArchetypeReveal", { archetypeResult: result });
      } else {
        Alert.alert(
          "Something went wrong",
          completeOnboardingError ?? "Please check your connection and try again.",
          [{ text: "OK" }]
        );
        setCompletingOnboarding(false);
      }
    } catch (e) {
      Alert.alert(
        "Something went wrong",
        e instanceof Error ? e.message : "Please try again.",
        [{ text: "OK" }]
      );
      setCompletingOnboarding(false);
    }
  }, [
    currentQuestionIndex,
    completingOnboarding,
    isCompleting,
    getAnswer,
    completeOnboarding,
    completeOnboardingError,
    navigation,
  ]);

  const handleNext = useCallback(() => {
    if (!hasAnswer() || !config || transitionToIndex !== null) return;
    if (completingOnboarding || isCompleting) return;
    if (currentQuestionIndex === 1) {
      void checkUsernameAndProceed();
      return;
    }
    if (currentQuestionIndex === 14) {
      void handleFinalNext();
      return;
    }
    const key = QUESTION_KEYS[currentQuestionIndex];
    const payload = buildStepPayload(currentQuestionIndex, answers);
    if (key && payload) {
      void saveAnswer({ question_key: key, answer_json: payload });
    }
    if (currentQuestionIndex < TOTAL_ONBOARDING_QUESTIONS) {
      setQuestionState((prev) => ({ ...prev, transitionToIndex: prev.currentQuestionIndex + 1 }));
    }
  }, [
    currentQuestionIndex,
    config,
    hasAnswer,
    transitionToIndex,
    completingOnboarding,
    isCompleting,
    checkUsernameAndProceed,
    handleFinalNext,
    answers,
    saveAnswer,
  ]);

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
                onChangeText={
                  interactive
                    ? (t) => {
                        setUsernameError(null);
                        updateAnswer("username", t);
                        debouncedCheckUsername(t.trim().toLowerCase());
                      }
                    : noop
                }
                onFocus={interactive ? () => setUsernameFocused(true) : noop}
                onBlur={interactive ? async () => {
                  setUsernameFocused(false);
                  const un = ((getAnswer("username") as string) ?? "").trim().toLowerCase();
                  if (un.length < 3) return;
                  try {
                    const res = await onboardingService.checkUsername(un);
                    if (!res.available) {
                      setUsernameError(
                        res.suggestion ? `That name is taken. Try ${res.suggestion}` : "Username already taken"
                      );
                    } else {
                      setUsernameError(null);
                    }
                  } catch (_) {
                    setUsernameError(null);
                  }
                } : noop}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                editable={interactive}
              />
              <Text style={styles.usernameHintBelow}>Tap to edit · Max 20 characters</Text>
              {interactive && (answer as string)?.trim().length >= 3 && !usernameError ? (
                <Text
                  style={
                    usernameAvailable === true
                      ? styles.usernameAvailOk
                      : usernameAvailable === false
                        ? styles.usernameAvailBad
                        : styles.usernameAvailPending
                  }
                >
                  {isCheckingUsername
                    ? "Checking…"
                    : usernameAvailable === true
                      ? "Available"
                      : usernameAvailable === false
                        ? usernameSuggestion
                          ? `Taken · try ${usernameSuggestion}`
                          : "Taken"
                        : ""}
                </Text>
              ) : null}
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
      debouncedCheckUsername,
      usernameAvailable,
      usernameSuggestion,
      isCheckingUsername,
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
              disabled={
                !hasAnswer() ||
                isTransitioning ||
                usernameChecking ||
                completingOnboarding ||
                isCompleting
              }
              onPressIn={() => {
                buttonScale.value = withTiming(ANIMATIONS.pressScale, { duration: ANIMATIONS.pressIn });
              }}
              onPressOut={() => {
                buttonScale.value = withTiming(1, { duration: ANIMATIONS.pressOut });
              }}
              style={styles.buttonWrapper}
            >
              <Animated.View
                style={[
                  styles.buttonInner,
                  buttonAnimatedStyle,
                  (!hasAnswer() || usernameChecking || completingOnboarding || isCompleting) &&
                    styles.buttonInnerDisabled,
                ]}
              >
                <LinearGradient
                  colors={
                    !hasAnswer() || usernameChecking || completingOnboarding || isCompleting
                      ? ["rgba(42,48,80,0.40)", "rgba(42,48,80,0.40)"]
                      : ["#5B21B6", "#8B5CF6"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.buttonGradient,
                    (!hasAnswer() || usernameChecking || completingOnboarding || isCompleting) &&
                      styles.buttonDisabled,
                  ]}
                >
                  {usernameChecking || completingOnboarding || isCompleting ? (
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

      <Modal visible={completingOnboarding || isCompleting} animationType="fade" transparent>
        <View style={styles.completionOverlay}>
          <View style={styles.completionContent}>
            <Animated.View style={[styles.completionHexWrap, completionHexStyle]}>
              <Svg width={168} height={168} viewBox="0 0 100 100">
                <Polygon
                  points="50,6 86,28 86,72 50,94 14,72 14,28"
                  fill="transparent"
                  stroke="#8B5CF6"
                  strokeWidth={2.6}
                  strokeLinejoin="round"
                  opacity={0.9}
                />
              </Svg>
            </Animated.View>
            <Text style={styles.completionLogo}>ALTER EGO</Text>
            <Animated.Text style={[styles.completionOverlayText, completionTextStyle]}>
              {ONBOARDING_COMPLETION_MESSAGES[completionMsgIdx]}
            </Animated.Text>
          </View>
        </View>
      </Modal>
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
  completionOverlay: {
    flex: 1,
    backgroundColor: "#09091A",
    justifyContent: "center",
    alignItems: "center",
  },
  completionContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
  },
  completionHexWrap: {
    width: 168,
    height: 168,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8B5CF6",
    shadowRadius: 40,
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 0 },
    ...(Platform.OS === "android" ? { elevation: 16 } : null),
  },
  completionLogo: {
    marginTop: SPACING.lg,
    fontSize: 13,
    letterSpacing: 6,
    fontWeight: "700",
    color: "#8B5CF6",
    textTransform: "uppercase",
  },
  completionOverlayText: {
    marginTop: SPACING.md,
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    letterSpacing: 3,
    textAlign: "center",
    textTransform: "uppercase",
  },
  usernameAvailOk: {
    marginTop: SPACING.xs,
    fontSize: 13,
    color: COLORS.violetGlow,
  },
  usernameAvailBad: {
    marginTop: SPACING.xs,
    fontSize: 13,
    color: COLORS.text2,
  },
  usernameAvailPending: {
    marginTop: SPACING.xs,
    fontSize: 13,
    color: COLORS.muted,
    minHeight: 18,
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
