/**
 * Archetype Reveal. After questions: show "Building your Discipline DNA", POST /onboarding, then reveal.
 * Phase A: Processing (while POST runs). Phase B: Reveal + 14-day framing. Enter → Twin Introduction.
 */

import React, { useEffect, useLayoutEffect, useState, useRef, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions } from "react-native";
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
import { COLORS, SPACING, RADIUS, GRADIENTS, SHADOWS } from "../constants/theme";

const DOT_COUNT = 8;
const DOT_SIZE = 6;
const DOT_RING_RADIUS = 36;
const ROTATION_DURATION_MS = 1200;
const PULSE_STAGGER_MS = 150;

type Nav = StackNavigationProp<OnboardingStackParamList, "ArchetypeReveal">;
type Route = RouteProp<OnboardingStackParamList, "ArchetypeReveal">;

export function ArchetypeRevealScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const archetypeResult = route.params?.archetypeResult;
  const { archetypeContent, setArchetypeContent } = useOnboardingAnswers();
  const particleConfigs = useMemo(() => getParticleConfigs(), []);

  const [phase, setPhase] = useState<"processing" | "reveal">(() =>
    route.params?.archetypeResult ? "reveal" : "processing"
  );
  const [postError, setPostError] = useState<string | null>(null);

  const prevArchetypeResultRef = useRef<typeof archetypeResult>(undefined);
  useLayoutEffect(() => {
    if (!archetypeResult) return;
    if (prevArchetypeResultRef.current === archetypeResult) return;
    prevArchetypeResultRef.current = archetypeResult;
    setArchetypeContent({
      archetype: archetypeResult.archetype_name,
      description: archetypeResult.archetype_reveal_message || archetypeResult.archetype_tagline,
      twin_first_message: archetypeResult.twin_first_message ?? "",
    });
    setPostError(null);
    setPhase("reveal");
  }, [archetypeResult, setArchetypeContent]);

  useEffect(() => {
    if (archetypeResult) return;
    setPostError("Onboarding result missing. Please retry.");
    setPhase("processing");
  }, [archetypeResult]);

  const archetype =
    archetypeContent?.archetype ?? archetypeResult?.archetype_name ?? "";
  const description =
    archetypeContent?.description ??
    (archetypeResult
      ? archetypeResult.archetype_reveal_message || archetypeResult.archetype_tagline
      : "") ??
    "";

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
    twinSilhouetteOpacity.value = withDelay(1300, withTiming(0, { duration: 500, easing: easeOut }));
    fourteenDayOpacity.value = withDelay(1500, withTiming(1, { duration: 400, easing: easeOut }));
    enterButtonOpacity.value = withDelay(2000, withTiming(1, { duration: 300, easing: easeOut }));
  }, [phase]);

  const handleEnter = useCallback(() => {
    navigation.navigate("Onboarding14Day", {
      twinFirstMessage:
        archetypeResult?.twin_first_message ?? "",
      archetype: archetypeResult?.archetype_name ?? "",
    });
  }, [
    navigation,
    archetypeResult?.twin_first_message,
    archetypeResult?.archetype_name,
  ]);

  const dotRingStyle = useAnimatedStyle(() => {
    "worklet";
    const angle = rotation.value * 2 * Math.PI;
    return {
      transform: [{ rotate: `${angle}rad` }],
    };
  });

  if (postError || !archetypeResult) {
    return (
      <LinearGradient
        colors={GRADIENTS.backgroundPremium.colors}
        start={GRADIENTS.backgroundPremium.start}
        end={GRADIENTS.backgroundPremium.end}
        style={styles.gradientRoot}
      >
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
          <View style={styles.loadingWrap}>
            <Text style={styles.errorText}>{postError ?? "Onboarding result missing."}</Text>
            <Pressable
              onPress={() => navigation.replace("OnboardingQuestion", { questionNumber: 14 })}
              style={styles.retryButton}
            >
              <LinearGradient
                colors={GRADIENTS.button.colors}
                start={GRADIENTS.button.start}
                end={GRADIENTS.button.end}
                style={styles.retryButtonGradient}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={GRADIENTS.backgroundPremium.colors}
      start={GRADIENTS.backgroundPremium.start}
      end={GRADIENTS.backgroundPremium.end}
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
  retryButton: {
    marginTop: SPACING.lg,
    borderRadius: RADIUS.card,
    overflow: "hidden",
  },
  retryButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: RADIUS.card,
  },
  retryButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
  },
});
