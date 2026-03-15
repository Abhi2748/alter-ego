/**
 * Onboarding 14-Day screen — between Archetype Reveal and Twin Introduction.
 * Floating dots, animated copy, then Continue → Twin Introduction.
 */

import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
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
import type { OnboardingStackParamList } from "../navigation/types";
import { COLORS, SPACING, RADIUS, GRADIENTS, SHADOWS } from "../constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PARTICLE_COLORS = ["#8B5CF6", "#6D28D9", "#A78BFA"] as const;
const PARTICLE_SEED = 45;
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

type Nav = StackNavigationProp<OnboardingStackParamList, "Onboarding14Day">;
type Route = RouteProp<OnboardingStackParamList, "Onboarding14Day">;

export function Onboarding14DayScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const twinFirstMessage = route.params?.twinFirstMessage ?? "";
  const archetype = route.params?.archetype;
  const particleConfigs = useMemo(() => getParticleConfigs(), []);

  const headingOpacity = useSharedValue(0);
  const subheadingOpacity = useSharedValue(0);
  const dividerOpacity = useSharedValue(0);
  const privacyOpacity = useSharedValue(0);
  const ctaOpacity = useSharedValue(0);

  useEffect(() => {
    const easeOut = Easing.out(Easing.ease);
    headingOpacity.value = withDelay(200, withTiming(1, { duration: 400, easing: easeOut }));
    subheadingOpacity.value = withDelay(500, withTiming(1, { duration: 400, easing: easeOut }));
    dividerOpacity.value = withDelay(800, withTiming(1, { duration: 300, easing: easeOut }));
    privacyOpacity.value = withDelay(1000, withTiming(1, { duration: 400, easing: easeOut }));
    ctaOpacity.value = withDelay(1300, withTiming(1, { duration: 350, easing: easeOut }));
  }, []);

  const handleContinue = () => {
    navigation.navigate("TwinIntroduction", {
      twinFirstMessage,
      archetype,
    });
  };

  const headingStyle = useAnimatedStyle(() => ({ opacity: headingOpacity.value }));
  const subheadingStyle = useAnimatedStyle(() => ({ opacity: subheadingOpacity.value }));
  const dividerStyle = useAnimatedStyle(() => ({ opacity: dividerOpacity.value }));
  const privacyStyle = useAnimatedStyle(() => ({ opacity: privacyOpacity.value }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaOpacity.value }));

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
        <View style={styles.content}>
          <Animated.Text style={[styles.heading, headingStyle]}>
            Your first 7 days we learn how you work best.
          </Animated.Text>
          <Animated.Text style={[styles.subheading, subheadingStyle]}>
            Work at your own pace and in your own style.
          </Animated.Text>
          <Animated.View style={[styles.divider, dividerStyle]} />
          <Animated.Text style={[styles.privacy, privacyStyle]}>
            We use this information to personalize your app experience. We don't sell your data.
          </Animated.Text>
        </View>
        <Animated.View style={[styles.ctaWrap, ctaStyle]}>
          <Pressable onPress={handleContinue} style={styles.cta}>
            <LinearGradient
              colors={GRADIENTS.button.colors}
              start={GRADIENTS.button.start}
              end={GRADIENTS.button.end}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaLabel}>Continue →</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientRoot: { flex: 1 },
  safeArea: { flex: 1, justifyContent: "space-between", paddingHorizontal: SPACING.lg },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: SPACING.xxl,
  },
  heading: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 22,
    color: COLORS.text,
    textAlign: "center",
    lineHeight: 32,
    marginBottom: SPACING.sm,
  },
  subheading: {
    fontFamily: "Inter_500Medium",
    fontSize: 18,
    color: COLORS.text2,
    textAlign: "center",
    marginBottom: SPACING.xl,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.lg,
    marginHorizontal: SPACING.xl,
  },
  privacy: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 22,
  },
  ctaWrap: {
    paddingBottom: SPACING.xxl,
    alignSelf: "stretch",
  },
  cta: {
    ...SHADOWS.button,
    borderRadius: RADIUS.card,
    overflow: "hidden",
    height: 56,
  },
  ctaGradient: {
    flex: 1,
    height: 56,
    borderRadius: RADIUS.card,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
  particleDot: { position: "absolute" },
});
