import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import type { OnboardingStackParamList } from "../navigation/types";
import { COLORS, SPACING, RADIUS, ANIMATIONS, SHADOWS, GRADIENTS } from "../constants/theme";

// Match particle system used on SignUpScreen for consistency
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const PARTICLE_COLORS = ["#8B5CF6", "#6D28D9", "#A78BFA"] as const;
const PARTICLE_SEED = 42;
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
    phase.value = withTiming(1, { duration: config.duration, easing: Easing.inOut(Easing.ease) });
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

type Nav = StackNavigationProp<OnboardingStackParamList, "OnboardingFraming">;

export function OnboardingFramingScreen() {
  const navigation = useNavigation<Nav>();

  const particleConfigs = useMemo(() => getParticleConfigs(), []);

  const primaryOpacity = useSharedValue(0);
  const secondaryOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);

  useEffect(() => {
    const easeOut = Easing.out(Easing.ease);

    primaryOpacity.value = withDelay(
      200,
      withTiming(1, { duration: 400, easing: easeOut })
    );

    secondaryOpacity.value = withDelay(
      800,
      withTiming(1, { duration: 400, easing: easeOut })
    );

    subtitleOpacity.value = withDelay(
      1200,
      withTiming(1, { duration: 400, easing: easeOut })
    );
  }, []);

  const primaryStyle = useAnimatedStyle(() => ({
    opacity: primaryOpacity.value,
  }));

  const secondaryStyle = useAnimatedStyle(() => ({
    opacity: secondaryOpacity.value,
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const buttonScale = useSharedValue(1);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={GRADIENTS.backgroundPremium.colors}
        style={StyleSheet.absoluteFill}
        start={GRADIENTS.backgroundPremium.start}
        end={GRADIENTS.backgroundPremium.end}
      />

      {/* Particle layer: subtle animated dots behind content */}
      <View style={[StyleSheet.absoluteFill, styles.particleContainer]} pointerEvents="none">
        {particleConfigs.map((config, index) => (
          <ParticleDot key={index} config={config} />
        ))}
      </View>

      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        {/* Framing text in upper third (no progress bar, no back button) */}
        <View style={styles.centerContent}>
          <Animated.Text style={[styles.primaryText, primaryStyle]}>
            We don&apos;t build habits.
          </Animated.Text>
          <Animated.Text style={[styles.secondaryText, secondaryStyle]}>
            We build identities.
          </Animated.Text>
          <Animated.Text style={[styles.subtitleText, subtitleStyle]}>
            We don&apos;t count perfect days. We count the ones you showed up.
          </Animated.Text>
        </View>

        {/* Bottom fixed Continue button (Primary Button spec) */}
        <View style={styles.bottomSection}>
          <View style={styles.bottomInner}>
            <Pressable
              onPress={() =>
                navigation.navigate("OnboardingQuestion", { questionNumber: 1 })
              }
              onPressIn={() => {
                buttonScale.value = withTiming(ANIMATIONS.pressScale, {
                  duration: ANIMATIONS.pressIn,
                });
              }}
              onPressOut={() => {
                buttonScale.value = withTiming(1, {
                  duration: ANIMATIONS.pressOut,
                });
              }}
              style={styles.buttonWrapper}
            >
              <Animated.View style={[styles.buttonInner, buttonAnimatedStyle]}>
                <LinearGradient
                  colors={["#6D28D9", "#8B5CF6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonLabel}>Continue</Text>
                </LinearGradient>
              </Animated.View>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: SPACING.screenPadding,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: SCREEN_HEIGHT * 0.32,
  },
  primaryText: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  secondaryText: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    fontWeight: "700",
    color: COLORS.violet,
    letterSpacing: -0.5,
    textAlign: "center",
    marginTop: SPACING.sm,
  },
  subtitleText: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: COLORS.text2,
    textAlign: "center",
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  bottomSection: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: 48,
    alignItems: "center",
  },
  bottomInner: {
    maxWidth: 358,
    width: "100%",
  },
  buttonWrapper: {
    width: "100%",
  },
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
    paddingHorizontal: 24,
  },
  buttonLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    fontWeight: "600",
    color: "#F3F4F6",
    letterSpacing: 0,
  },
  particleContainer: {
    overflow: "hidden",
  },
  particleDot: {
    position: "absolute",
  },
});
