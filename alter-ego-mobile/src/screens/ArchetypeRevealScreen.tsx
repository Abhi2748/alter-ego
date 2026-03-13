/**
 * Archetype Reveal. After questions: show "Building your Discipline DNA", POST /onboarding, then reveal.
 * Phase A: Processing (while POST runs). Phase B: Reveal + 14-day framing. Enter → Twin Introduction.
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import { Pressable } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PARTICLE_COLORS = ["#8B5CF6", "#6D28D9", "#A78BFA"] as const;
const PARTICLE_SEED = 44;
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
      opacity: 0.25 + random() * 0.35,
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
import type { OnboardingStackParamList } from "../navigation/types";
import { useOnboardingAnswers } from "../context/OnboardingAnswersContext";
import type { OnboardingAnswers, OnboardingInterestItem } from "../context/OnboardingAnswersContext";
import { COLORS, SPACING, RADIUS, GRADIENTS, SHADOWS } from "../constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../utils/supabase";
import { postOnboarding } from "../utils/api";

const ONBOARDING_DRAFT_KEY = "@alter_ego_onboarding_draft";

const DOT_COUNT = 8;
const DOT_SIZE = 6;
const DOT_RING_RADIUS = 36;
const ROTATION_DURATION_MS = 1200;
const PULSE_STAGGER_MS = 150;

type Nav = StackNavigationProp<OnboardingStackParamList, "ArchetypeReveal">;
type Route = RouteProp<OnboardingStackParamList, "ArchetypeReveal">;

function buildOnboardingPayload(answers: OnboardingAnswers) {
  const interestItems = (answers.interestItems ?? []) as OnboardingInterestItem[];
  const interests = interestItems.length > 0
    ? interestItems.map((i) => i.name)
    : (answers.interests ?? []);
  const interest_levels =
    interestItems.length > 0
      ? interestItems.map((i) => ({
          interest: i.name,
          level: i.level,
          learning_goal: i.learning_goal || undefined,
          schedule: i.schedule && i.schedule.length > 0 ? i.schedule : undefined,
        }))
      : undefined;
  let quit_targets = (answers.quitTargets ?? []) as string[];
  if (quit_targets.includes("Something else") && answers.quitOther?.trim()) {
    quit_targets = quit_targets.map((x) =>
      x === "Something else" ? (answers.quitOther as string).trim() : x
    );
  }
  return {
    answers: {
      username: answers.username,
      gender: answers.gender,
      ageRange: answers.ageRange,
      situation: answers.situation,
      reason: answers.reason,
      taskApproach: answers.taskApproach,
      offTrack: answers.offTrack,
      motivation: answers.motivation,
      autonomy: answers.autonomy,
      comparison: answers.comparison,
      interests: answers.interests,
      quitTargets: answers.quitTargets,
      dailyHours: answers.dailyHours,
      commitmentTimeline: answers.commitmentTimeline,
    },
    interests,
    quit_targets,
    available_hours_per_day: typeof answers.dailyHours === "number" ? answers.dailyHours : 1,
    gender: answers.gender ?? null,
    username: (answers.username as string)?.trim() || null,
    interest_levels,
  };
}

export function ArchetypeRevealScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const answers = route.params?.answers;
  const { archetypeContent, setArchetypeContent } = useOnboardingAnswers();
  const particleConfigs = useMemo(() => getParticleConfigs(), []);

  const [phase, setPhase] = useState<"processing" | "reveal">("processing");
  const [postError, setPostError] = useState<string | null>(null);
  const postedRef = useRef(false);

  // When we land with new answers (e.g. user went back and pressed Continue again), reset so we POST again
  const prevAnswersRef = useRef<typeof answers>(undefined);
  useEffect(() => {
    if (!answers) return;
    if (prevAnswersRef.current === answers) return;
    prevAnswersRef.current = answers;
    postedRef.current = false;
    setArchetypeContent(null);
    setPhase("processing");
    setPostError(null);
  }, [answers]);

  const archetype = archetypeContent?.archetype ?? "";
  const description = archetypeContent?.description ?? "";

  const rotation = useSharedValue(0);
  const readingOpacity = useSharedValue(0);
  const buildingOpacity = useSharedValue(0);

  const processingOpacity = useSharedValue(1);
  const youAreOpacity = useSharedValue(0);
  const youAreY = useSharedValue(-20);
  const nameOpacity = useSharedValue(0);
  const nameY = useSharedValue(-30);
  const descOpacity = useSharedValue(0);
  const twinSilhouetteOpacity = useSharedValue(0);
  const fourteenDayOpacity = useSharedValue(0);
  const enterButtonOpacity = useSharedValue(0);

  const youAreAnimatedStyle = useAnimatedStyle(() => ({
    opacity: youAreOpacity.value,
    transform: [{ translateY: youAreY.value }],
  }));
  const nameAnimatedStyle = useAnimatedStyle(() => ({
    opacity: nameOpacity.value,
    transform: [{ translateY: nameY.value }],
  }));
  const descAnimatedStyle = useAnimatedStyle(() => ({ opacity: descOpacity.value }));
  const twinSilhouetteAnimatedStyle = useAnimatedStyle(() => ({
    opacity: twinSilhouetteOpacity.value,
  }));
  const fourteenDayAnimatedStyle = useAnimatedStyle(() => ({ opacity: fourteenDayOpacity.value }));
  const enterButtonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: enterButtonOpacity.value,
  }));

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(1, { duration: ROTATION_DURATION_MS, easing: Easing.linear }),
      -1,
      false
    );
    readingOpacity.value = withDelay(
      400,
      withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) })
    );
    buildingOpacity.value = withDelay(
      800,
      withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) })
    );
  }, []);

  const MIN_PROCESSING_MS = 2400;

  useEffect(() => {
    if (!answers || postedRef.current || archetypeContent) return;
    (async () => {
      postedRef.current = true;
      const startedAt = Date.now();
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) {
        setPostError("Session expired. Please sign in again.");
        return;
      }
      try {
        const payload = buildOnboardingPayload(answers);
        const response = await postOnboarding(payload, token);
        const elapsed = Date.now() - startedAt;
        const waitMs = Math.max(0, MIN_PROCESSING_MS - elapsed);
        if (waitMs > 0) {
          await new Promise((r) => setTimeout(r, waitMs));
        }
        setArchetypeContent(response.archetype_content);
        setPhase("reveal");
        try {
          await AsyncStorage.removeItem(ONBOARDING_DRAFT_KEY);
        } catch (_) {}
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        setPostError(msg);
        if (msg.includes("Username already taken")) {
          Alert.alert("Username taken", "That username is already in use. Go back and choose another.");
        }
      }
    })();
  }, [answers, archetypeContent, setArchetypeContent]);

  useEffect(() => {
    if (phase !== "reveal") return;
    const easeOut = Easing.out(Easing.ease);
    processingOpacity.value = withDelay(0, withTiming(0, { duration: 200, easing: easeOut }));
    youAreY.value = -20;
    youAreOpacity.value = 0;
    youAreOpacity.value = withDelay(300, withTiming(1, { duration: 400, easing: easeOut }));
    youAreY.value = withDelay(300, withTiming(0, { duration: 400, easing: easeOut }));
    nameY.value = -30;
    nameOpacity.value = 0;
    nameOpacity.value = withDelay(500, withTiming(1, { duration: 400, easing: easeOut }));
    nameY.value = withDelay(500, withTiming(0, { duration: 400, easing: easeOut }));
    descOpacity.value = withDelay(900, withTiming(1, { duration: 400, easing: easeOut }));
    twinSilhouetteOpacity.value = withDelay(1300, withTiming(0.04, { duration: 500, easing: easeOut }));
    fourteenDayOpacity.value = withDelay(1500, withTiming(1, { duration: 400, easing: easeOut }));
    enterButtonOpacity.value = withDelay(2000, withTiming(1, { duration: 300, easing: easeOut }));
  }, [phase]);

  const handleEnter = useCallback(() => {
    navigation.navigate("Onboarding14Day", {
      twinFirstMessage: archetypeContent?.twin_first_message ?? "",
      archetype: archetypeContent?.archetype ?? "",
    });
  }, [navigation, archetypeContent?.twin_first_message, archetypeContent?.archetype]);

  const dotRingStyle = useAnimatedStyle(() => {
    "worklet";
    const angle = rotation.value * 2 * Math.PI;
    return {
      transform: [{ rotate: `${angle}rad` }],
    };
  });

  if (postError && !archetypeContent) {
    return (
      <LinearGradient
        colors={[COLORS.bg1, COLORS.bg0]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientRoot}
      >
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
          <View style={styles.loadingWrap}>
            <Text style={styles.errorText}>{postError}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!archetypeContent) {
    return (
      <LinearGradient
        colors={[COLORS.bg1, COLORS.bg0]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientRoot}
      >
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
          <View style={styles.processingWrap}>
            <Text style={styles.readingLabel}>Reading your answers</Text>
            <Animated.View style={[styles.dotRing, dotRingStyle]}>
              {Array.from({ length: DOT_COUNT }).map((_, i) => (
                <ProcessingDot key={i} index={i} />
              ))}
            </Animated.View>
            <Text style={styles.buildingLabel}>Building your Discipline DNA...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[COLORS.bg1, COLORS.bg0]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradientRoot}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {particleConfigs.map((config, i) => (
          <ParticleDot key={i} config={config} />
        ))}
      </View>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        {/* Phase A: Processing */}
        <Animated.View
        style={[
          styles.processingWrap,
          { opacity: processingOpacity },
        ]}
        pointerEvents={phase === "processing" ? "auto" : "none"}
      >
        <Text style={styles.readingLabel}>Reading your answers</Text>
        <Animated.View style={[styles.dotRing, dotRingStyle]}>
          {Array.from({ length: DOT_COUNT }).map((_, i) => (
            <ProcessingDot key={i} index={i} />
          ))}
        </Animated.View>
        <Text style={styles.buildingLabel}>Building your Discipline DNA...</Text>
      </Animated.View>

      {/* Phase B: Reveal — focused: YOU ARE + archetype name + short description + CTA */}
      <ScrollView
        style={styles.revealScroll}
        contentContainerStyle={styles.revealScrollContent}
        showsVerticalScrollIndicator={false}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.twinSilhouette, twinSilhouetteAnimatedStyle]} />
        <Animated.Text style={[styles.youAre, youAreAnimatedStyle]}>YOU ARE</Animated.Text>
        <Animated.Text style={[styles.archetypeName, nameAnimatedStyle]}>{archetype}</Animated.Text>
        <Animated.Text style={[styles.description, descAnimatedStyle]}>{description}</Animated.Text>
        <Animated.View style={[styles.enterButtonWrap, enterButtonAnimatedStyle]}>
          <Pressable onPress={handleEnter} style={styles.enterButton}>
            <LinearGradient
              colors={GRADIENTS.button.colors}
              start={GRADIENTS.button.start}
              end={GRADIENTS.button.end}
              style={styles.enterButtonGradient}
            >
              <Text style={styles.enterButtonLabel}>Enter →</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function ProcessingDot({ index }: { index: number }) {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    const delay = index * PULSE_STAGGER_MS;
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
  }, [index]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const angle = (index / DOT_COUNT) * 2 * Math.PI;
  const x = Math.cos(angle) * DOT_RING_RADIUS - DOT_SIZE / 2;
  const y = Math.sin(angle) * DOT_RING_RADIUS - DOT_SIZE / 2;
  return (
    <Animated.View
      style={[
        styles.dot,
        { left: DOT_RING_RADIUS + x, top: DOT_RING_RADIUS + y },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  gradientRoot: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  processingWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  readingLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    fontWeight: "400",
    color: COLORS.muted,
    marginBottom: SPACING.md + 4,
    textAlign: "center",
  },
  dotRing: {
    width: DOT_RING_RADIUS * 2,
    height: DOT_RING_RADIUS * 2,
    position: "relative",
  },
  dot: {
    position: "absolute",
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: COLORS.violet,
  },
  buildingLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    fontWeight: "400",
    color: COLORS.muted,
    letterSpacing: 0.5,
    marginTop: 20,
    textAlign: "center",
  },
  revealScroll: { flex: 1 },
  revealScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xxl,
    minHeight: "100%",
  },
  youAre: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    fontWeight: "500",
    color: COLORS.muted,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: SPACING.sm,
  },
  archetypeName: {
    fontFamily: "Inter_700Bold",
    fontSize: 36,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.sm,
  },
  description: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    fontWeight: "400",
    color: COLORS.text2,
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 24,
    marginBottom: SPACING.xxxl,
  },
  particleDot: { position: "absolute" },
  twinSilhouette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.violet,
    opacity: 0,
  },
  enterButtonWrap: {
    width: "100%",
    maxWidth: 358,
    alignSelf: "center",
  },
  enterButton: {
    ...SHADOWS.button,
    borderRadius: RADIUS.card,
    overflow: "hidden",
    height: 56,
  },
  enterButtonGradient: {
    flex: 1,
    height: 56,
    borderRadius: RADIUS.card,
    alignItems: "center",
    justifyContent: "center",
  },
  enterButtonLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.screenPadding,
  },
  loadingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.text2,
    marginTop: SPACING.md,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.danger,
    textAlign: "center",
  },
});
