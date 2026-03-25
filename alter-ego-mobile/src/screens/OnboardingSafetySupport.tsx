/**
 * OnboardingSafetySupport — shown when self_harm_interest_detected is true.
 * Warm, non-alarming. Provides crisis resources. App still accessible.
 * Same visual language as other onboarding screens.
 */

import React, { useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Dimensions,
} from "react-native";
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
import type { OnboardingStackParamList } from "@/navigation/types";
import { COLORS, SPACING, RADIUS, GRADIENTS, SHADOWS } from "@/constants/theme";
import { useOnboardingAnswers } from "@/context/OnboardingAnswersContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PARTICLE_COLORS = ["#8B5CF6", "#6D28D9", "#A78BFA"] as const;
const PARTICLE_SEED = 91;
const PARTICLE_COUNT = 16;

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
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x: random() * (SCREEN_WIDTH - 16),
    y: random() * (SCREEN_HEIGHT - 16),
    color: PARTICLE_COLORS[Math.floor(random() * PARTICLE_COLORS.length)],
    opacity: 0.15 + random() * 0.25,
    size: 2 + random(),
    delayPhase: random() * 0.25,
    angle: random() * 2 * Math.PI,
    amplitude: 5 + random() * 7,
    duration: 4000 + random() * 4000,
  }));
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
    const p = (phase.value + config.delayPhase) * 2 * Math.PI;
    const t = Math.sin(p);
    return {
      transform: [
        { translateX: config.amplitude * t * Math.cos(config.angle) },
        { translateY: config.amplitude * t * Math.sin(config.angle) },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
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

type Nav = StackNavigationProp<OnboardingStackParamList, "OnboardingSafetySupport">;
type Route = RouteProp<OnboardingStackParamList, "OnboardingSafetySupport">;

export function OnboardingSafetySupport() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const archetypeResult = route.params?.archetypeResult;
  const { setArchetypeContent } = useOnboardingAnswers();
  const particleConfigs = useMemo(() => getParticleConfigs(), []);

  useEffect(() => {
    if (!archetypeResult) return;
    setArchetypeContent({
      archetype: archetypeResult.archetype_name,
      description:
        archetypeResult.archetype_reveal_message || archetypeResult.archetype_tagline,
      twin_first_message: archetypeResult.twin_first_message ?? "",
    });
  }, [archetypeResult, setArchetypeContent]);

  const contentOp = useSharedValue(0);
  const contentTy = useSharedValue(12);
  const ctaOp = useSharedValue(0);

  useEffect(() => {
    const ease = Easing.out(Easing.ease);
    contentOp.value = withDelay(300, withTiming(1, { duration: 500, easing: ease }));
    contentTy.value = withDelay(300, withTiming(0, { duration: 500, easing: ease }));
    ctaOp.value = withDelay(900, withTiming(1, { duration: 400, easing: ease }));
  }, [contentOp, contentTy, ctaOp]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOp.value,
    transform: [{ translateY: contentTy.value }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaOp.value }));

  const handleContinue = () => {
    navigation.replace("TwinIntroduction", {
      archetype:
        archetypeResult?.archetype_name ?? archetypeResult?.archetype ?? undefined,
    });
  };

  const handleCall988 = () => {
    Linking.openURL("tel:988").catch(() => Linking.openURL("https://988lifeline.org"));
  };

  const handleTextLine = () => {
    Linking.openURL("sms:741741?body=HOME").catch(() =>
      Linking.openURL("https://www.crisistextline.org")
    );
  };

  return (
    <LinearGradient
      colors={[...GRADIENTS.backgroundPremium.colors]}
      start={GRADIENTS.backgroundPremium.start}
      end={GRADIENTS.backgroundPremium.end}
      style={styles.root}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {particleConfigs.map((c, i) => (
          <ParticleDot key={i} config={c} />
        ))}
      </View>

      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        <Animated.View style={[styles.content, contentStyle]}>
          <Text style={styles.eyebrow}>A moment</Text>

          <Text style={styles.headline}>
            We noticed something in{"\n"}what you shared with us.
          </Text>

          <Text style={styles.body}>
            Some of what you described goes beyond habits — and the best support for that comes
            from real people, not an app.
          </Text>

          <Text style={[styles.body, { marginTop: 10 }]}>
            If you're going through something difficult, you don't have to figure it out alone.
          </Text>

          <Pressable style={styles.crisisCard} onPress={handleCall988}>
            <Text style={styles.crisisEyebrow}>FREE · CONFIDENTIAL · 24/7</Text>
            <Text style={styles.crisisNumber}>988</Text>
            <Text style={styles.crisisLabel}>Suicide & Crisis Lifeline</Text>
            <Text style={styles.crisisTap}>Tap to call or text</Text>
          </Pressable>

          <Pressable style={styles.altCard} onPress={handleTextLine}>
            <Text style={styles.altText}>
              Or text <Text style={styles.altHighlight}>HOME</Text> to{" "}
              <Text style={styles.altHighlight}>741741</Text> — Crisis Text Line
            </Text>
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.ctaWrap, ctaStyle]}>
          <Text style={styles.ctaNote}>Your profile is ready. The app is here when you are.</Text>
          <Pressable onPress={handleContinue} style={styles.cta}>
            <LinearGradient
              colors={[...GRADIENTS.button.colors]}
              start={GRADIENTS.button.start}
              end={GRADIENTS.button.end}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaLabel}>Continue to app →</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: SPACING.xxl,
  },
  eyebrow: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 4,
    color: "rgba(167,139,250,0.5)",
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 20,
  },
  headline: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    letterSpacing: -0.6,
    lineHeight: 32,
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 18,
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(229,231,235,0.55)",
    textAlign: "center",
    lineHeight: 24,
  },
  crisisCard: {
    marginTop: 28,
    backgroundColor: "rgba(139,92,246,0.08)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
    borderRadius: RADIUS.card,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: "center",
    marginBottom: 10,
  },
  crisisEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 2,
    color: "rgba(167,139,250,0.5)",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  crisisNumber: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 52,
    letterSpacing: -2,
    color: "#A78BFA",
    lineHeight: 60,
  },
  crisisLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "rgba(229,231,235,0.7)",
    marginBottom: 6,
  },
  crisisTap: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(167,139,250,0.4)",
  },
  altCard: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  altText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(229,231,235,0.35)",
    textAlign: "center",
    lineHeight: 20,
  },
  altHighlight: {
    fontFamily: "Inter_600SemiBold",
    color: "rgba(167,139,250,0.6)",
  },
  ctaWrap: {
    paddingBottom: SPACING.xxl,
    alignSelf: "stretch",
    gap: 8,
  },
  ctaNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(229,231,235,0.25)",
    textAlign: "center",
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
    alignItems: "center",
    justifyContent: "center",
  },
  ctaLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
});
