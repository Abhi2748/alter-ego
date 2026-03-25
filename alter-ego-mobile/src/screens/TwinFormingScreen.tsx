/**
 * Twin Forming Screen — E1.
 * Sits between Onboarding7DayScreen and TwinIntroductionScreen.
 * Variant C: text-forward, "What your Twin knows" card.
 * Particle system matches Onboarding7DayScreen (different seed).
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
const PARTICLE_SEED = 73;
const PARTICLE_COUNT = 20;

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
      opacity: 0.2 + random() * 0.3,
      size: 2.5 + random(),
      delayPhase: random() * 0.25,
      angle: random() * 2 * Math.PI,
      amplitude: 6 + random() * 8,
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
    return { transform: [{ translateX: tx }, { translateY: ty }] };
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

function PulsingDot({ delay }: { delay: number }) {
  const op = useSharedValue(0.2);
  const sc = useSharedValue(1);

  useEffect(() => {
    op.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
    sc.value = withDelay(
      delay,
      withRepeat(
        withTiming(1.3, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
  }, [delay, op, sc]);

  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ scale: sc.value }],
  }));

  return <Animated.View style={[styles.pulsingDot, style]} />;
}

type Nav = StackNavigationProp<OnboardingStackParamList, "TwinForming">;
type TwinFormingRoute = RouteProp<OnboardingStackParamList, "TwinForming">;

export function TwinFormingScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<TwinFormingRoute>();
  const archetype = route.params?.archetype;
  const particleConfigs = useMemo(() => getParticleConfigs(), []);

  const eyebrowOp = useSharedValue(0);
  const dotsOp = useSharedValue(0);
  const headlineOp = useSharedValue(0);
  const headlineTy = useSharedValue(8);
  const subOp = useSharedValue(0);
  const cardOp = useSharedValue(0);
  const cardTy = useSharedValue(8);
  const ctaOp = useSharedValue(0);

  useEffect(() => {
    const ease = Easing.out(Easing.ease);
    eyebrowOp.value = withDelay(200, withTiming(1, { duration: 350, easing: ease }));
    dotsOp.value = withDelay(450, withTiming(1, { duration: 350, easing: ease }));
    headlineOp.value = withDelay(700, withTiming(1, { duration: 400, easing: ease }));
    headlineTy.value = withDelay(700, withTiming(0, { duration: 400, easing: ease }));
    subOp.value = withDelay(950, withTiming(1, { duration: 400, easing: ease }));
    cardOp.value = withDelay(1150, withTiming(1, { duration: 400, easing: ease }));
    cardTy.value = withDelay(1150, withTiming(0, { duration: 400, easing: ease }));
    ctaOp.value = withDelay(1450, withTiming(1, { duration: 350, easing: ease }));
  }, []);

  const eyebrowStyle = useAnimatedStyle(() => ({ opacity: eyebrowOp.value }));
  const dotsStyle = useAnimatedStyle(() => ({ opacity: dotsOp.value }));
  const headlineStyle = useAnimatedStyle(() => ({
    opacity: headlineOp.value,
    transform: [{ translateY: headlineTy.value }],
  }));
  const subStyle = useAnimatedStyle(() => ({ opacity: subOp.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOp.value,
    transform: [{ translateY: cardTy.value }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaOp.value }));

  const handleContinue = () => {
    navigation.navigate("TwinIntroduction", { archetype });
  };

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
          <Animated.Text style={[styles.eyebrow, eyebrowStyle]}>Preparing your shadow</Animated.Text>

          <Animated.View style={[styles.dotsRow, dotsStyle]}>
            <PulsingDot delay={0} />
            <PulsingDot delay={200} />
            <PulsingDot delay={400} />
          </Animated.View>

          <Animated.Text style={[styles.headline, headlineStyle]}>
            Your shadow is{"\n"}
            <Text style={styles.headlineAccent}>being built.</Text>
          </Animated.Text>

          <Animated.Text style={[styles.subtext, subStyle]}>
            Every answer you gave is now{"\n"}
            part of something watching you.
          </Animated.Text>

          <Animated.View style={[styles.knowsCard, cardStyle]}>
            <Text style={styles.knowsEyebrow}>What your Twin knows</Text>
            <View style={styles.knowsList}>
              <View style={styles.knowsRow}>
                <View style={styles.knowsDot} />
                <Text style={styles.knowsText}>Your archetype and what drives you</Text>
              </View>
              <View style={styles.knowsRow}>
                <View style={styles.knowsDot} />
                <Text style={styles.knowsText}>What you said your obstacles are</Text>
              </View>
              <View style={styles.knowsRow}>
                <View style={styles.knowsDot} />
                <Text style={styles.knowsText}>{"Why you're really here"}</Text>
              </View>
            </View>
          </Animated.View>
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
  safeArea: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: SPACING.xxl,
  },
  particleDot: { position: "absolute" },

  eyebrow: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 4,
    color: "rgba(139,92,246,0.5)",
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 20,
  },

  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 32,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#8B5CF6",
  },

  headline: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 28,
    color: COLORS.text,
    textAlign: "center",
    letterSpacing: -0.8,
    lineHeight: 36,
    marginBottom: 12,
  },
  headlineAccent: {
    color: "#A78BFA",
  },

  subtext: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(229,231,235,0.45)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },

  knowsCard: {
    width: "100%",
    backgroundColor: "rgba(20,12,50,0.55)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.14)",
    borderRadius: RADIUS.card,
    padding: 16,
  },
  knowsEyebrow: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 2,
    color: "rgba(139,92,246,0.5)",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  knowsList: {
    gap: 8,
  },
  knowsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  knowsDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#8B5CF6",
    flexShrink: 0,
  },
  knowsText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(229,231,235,0.6)",
    lineHeight: 20,
    flex: 1,
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
});
