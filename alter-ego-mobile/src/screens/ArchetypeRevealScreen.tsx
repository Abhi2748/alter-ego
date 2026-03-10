/**
 * Screen 14 — Archetype Reveal. Content from POST /onboarding (archetype_content).
 * Phase A: Processing (3000ms). Phase B: Reveal sequence. Twin first message at 2200ms.
 */

import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
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
import type { OnboardingStackParamList } from "../navigation/types";
import { useOnboardingAnswers } from "../context/OnboardingAnswersContext";
import { COLORS, SPACING, RADIUS, GRADIENTS, SHADOWS } from "../constants/theme";

const PROCESSING_DURATION_MS = 3000;
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
  const answers = route.params?.answers;
  const { archetypeContent } = useOnboardingAnswers();

  const [phase, setPhase] = useState<"processing" | "reveal">("processing");
  const revealStartRef = useRef<number>(0);

  const archetype = archetypeContent?.archetype ?? "";
  const description = archetypeContent?.description ?? "";
  const twinFirstMessage = archetypeContent?.twin_first_message ?? "";

  // Phase A: processing indicator
  const rotation = useSharedValue(0);
  const readingOpacity = useSharedValue(0);
  const buildingOpacity = useSharedValue(0);

  // Phase B: reveal sequence
  const processingOpacity = useSharedValue(1);
  const youAreOpacity = useSharedValue(0);
  const youAreY = useSharedValue(-20);
  const nameOpacity = useSharedValue(0);
  const nameY = useSharedValue(-30);
  const descOpacity = useSharedValue(0);
  const twinSilhouetteOpacity = useSharedValue(0);
  const twinMessageOpacity = useSharedValue(0);
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
  const twinMessageAnimatedStyle = useAnimatedStyle(() => ({
    opacity: twinMessageOpacity.value,
  }));
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
    const t = setTimeout(() => {
      setPhase("reveal");
      revealStartRef.current = Date.now();
    }, PROCESSING_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  if (!archetypeContent) {
    return (
      <LinearGradient
        colors={[COLORS.bg1, COLORS.bg0]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientRoot}
      >
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.violet} />
            <Text style={styles.loadingText}>Loading your results...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  useEffect(() => {
    if (phase !== "reveal") return;
    const easeOut = Easing.out(Easing.ease);

    // 0–300ms: processing fades out (200ms)
    processingOpacity.value = withDelay(
      0,
      withTiming(0, { duration: 200, easing: easeOut })
    );
    // 300–700ms: YOU ARE
    youAreY.value = -20;
    youAreOpacity.value = 0;
    youAreOpacity.value = withDelay(
      300,
      withTiming(1, { duration: 400, easing: easeOut })
    );
    youAreY.value = withDelay(300, withTiming(0, { duration: 400, easing: easeOut }));
    // 500–900ms: archetype name
    nameY.value = -30;
    nameOpacity.value = 0;
    nameOpacity.value = withDelay(
      500,
      withTiming(1, { duration: 400, easing: easeOut })
    );
    nameY.value = withDelay(500, withTiming(0, { duration: 400, easing: easeOut }));
    // 900–1300ms: description
    descOpacity.value = withDelay(
      900,
      withTiming(1, { duration: 400, easing: easeOut })
    );
    // 1300–1800ms: Twin silhouette — very subtle (no purple wash)
    twinSilhouetteOpacity.value = withDelay(
      1300,
      withTiming(0.04, { duration: 500, easing: easeOut })
    );
    // 1800–2200ms: Twin message
    twinMessageOpacity.value = withDelay(
      1800,
      withTiming(1, { duration: 400, easing: easeOut })
    );
    // 2200ms+: Enter button
    enterButtonOpacity.value = withDelay(
      2200,
      withTiming(1, { duration: 300, easing: easeOut })
    );
  }, [phase]);

  const dotRingStyle = useAnimatedStyle(() => {
    "worklet";
    const angle = rotation.value * 2 * Math.PI;
    return {
      transform: [{ rotate: `${angle}rad` }],
    };
  });

  return (
    <LinearGradient
      colors={[COLORS.bg1, COLORS.bg0]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradientRoot}
    >
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

      {/* Phase B: Reveal — Twin silhouette behind text, then labels */}
      <View style={styles.revealWrap} pointerEvents="box-none">
        <Animated.View style={[styles.twinSilhouette, twinSilhouetteAnimatedStyle]} />
        <Animated.Text style={[styles.youAre, youAreAnimatedStyle]}>YOU ARE</Animated.Text>
        <Animated.Text style={[styles.archetypeName, nameAnimatedStyle]}>{archetype}</Animated.Text>
        <Animated.Text style={[styles.description, descAnimatedStyle]}>{description}</Animated.Text>
        <Animated.View style={[styles.twinMessageCard, twinMessageAnimatedStyle]}>
          <Text style={styles.twinMessageLabel}>Your Twin</Text>
          <Text style={styles.twinMessage}>{twinFirstMessage}</Text>
        </Animated.View>
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
      </View>
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
  revealWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.screenPadding,
  },
  youAre: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.muted,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: SPACING.xs,
  },
  archetypeName: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  description: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    fontWeight: "400",
    color: COLORS.text2,
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  twinSilhouette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.violet,
    opacity: 0,
  },
  twinMessageCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.violet,
    borderRadius: RADIUS.card,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
    width: "100%",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  twinMessageLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    fontWeight: "500",
    color: COLORS.muted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: SPACING.sm,
  },
  twinMessage: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    fontWeight: "400",
    color: COLORS.text,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 22,
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
});
