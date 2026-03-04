/**
 * SignUpScreen — Screen 02
 * First interactive screen. Three auth buttons (Apple, Google, Email), logo, particle
 * background. Buttons are placeholders (onPress logs to console). On successful auth
 * → navigates to OnboardingFramingScreen. See CLAUDE.md §7 + Screen 02 spec.
 */

import { useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../navigation/types";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import { COLORS, RADIUS, SPACING, ANIMATIONS } from "../constants/theme";

// -----------------------------------------------------------------------------
// Constants & particle helpers (seeded random for stable positions)
// -----------------------------------------------------------------------------

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PARTICLE_COLORS = ["#8B5CF6", "#6D28D9", "#A78BFA"] as const;
const PARTICLE_SEED = 42;
const PARTICLE_COUNT = 28;

/** Seeded RNG so particle positions are stable across mounts. */
function createSeededRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
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

/** Generate 24–32 dot configs: position, color (30–60% opacity), size 3–4px, animation params. */
function getParticleConfigs(): ParticleConfig[] {
  const random = createSeededRandom(PARTICLE_SEED);
  const configs: ParticleConfig[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    configs.push({
      x: random() * (SCREEN_WIDTH - 16),
      y: random() * (SCREEN_HEIGHT - 16),
      color: PARTICLE_COLORS[Math.floor(random() * 3)],
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

// -----------------------------------------------------------------------------
// Particle dot — single animated dot (Reanimated, 8–16px drift, easeInOut loop)
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Auth button — Apple (white) or Google/Email (dark), press scale 0.97 (CLAUDE §6)
// -----------------------------------------------------------------------------

function AuthButton({
  onPress,
  icon,
  label,
  variant,
}: {
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  variant: "apple" | "google" | "email";
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isApple = variant === "apple";
  const buttonStyle = isApple ? styles.buttonApple : styles.buttonDark;
  const labelStyle = isApple ? styles.labelApple : styles.labelDark;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(ANIMATIONS.pressScale, { duration: ANIMATIONS.pressIn });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: ANIMATIONS.pressOut });
      }}
      style={styles.buttonWrapper}
    >
      <Animated.View style={[styles.buttonInner, buttonStyle, animatedStyle]}>
        <View style={styles.buttonIcon}>{icon}</View>
        <Text style={[styles.buttonLabel, labelStyle]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// SignUpScreen
// -----------------------------------------------------------------------------

type Nav = StackNavigationProp<RootStackParamList, "SignUp">;

export function SignUpScreen() {
  const navigation = useNavigation<Nav>();
  const particleConfigs = useMemo(() => getParticleConfigs(), []);

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.root}>
        {/* Background: gradient #0D0F1A → #07080F (CLAUDE §5.6) */}
        <LinearGradient
          colors={[COLORS.bg1, COLORS.bg0]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        {/* Particle layer: absolute, behind content */}
        <View style={[StyleSheet.absoluteFill, styles.particleContainer]} pointerEvents="none">
          {particleConfigs.map((config, i) => (
            <ParticleDot key={i} config={config} />
          ))}
        </View>

        <SafeAreaView style={styles.safeContent} edges={["top", "left", "right", "bottom"]}>
          {/* Logo block: ~180px from top, not vertically centered */}
          <View style={styles.logoSection}>
            <Text style={styles.logo}>ALTER EGO</Text>
            <Text style={styles.subtitle}>The Adaptive Discipline Engine</Text>
          </View>

          {/* Buttons: absolutely positioned at bottom */}
          <View style={styles.buttonsSection}>
            <View style={styles.buttonsInner}>
            <AuthButton
              onPress={() => console.log("Continue with Apple")}
              icon={<Ionicons name="logo-apple" size={20} color="#000000" />}
              label="Continue with Apple"
              variant="apple"
            />
            <AuthButton
              onPress={() => console.log("Continue with Google")}
              icon={<Ionicons name="logo-google" size={20} color={COLORS.text} />}
              label="Continue with Google"
              variant="google"
            />
            <AuthButton
              onPress={() => console.log("Continue with Email")}
              icon={<Ionicons name="mail-outline" size={20} color={COLORS.text2} />}
              label="Continue with Email"
              variant="email"
            />

            <Text style={styles.legal}>
              By continuing you agree to our{" "}
              <Text
                style={styles.legalLink}
                onPress={() => console.log("Terms")}
                suppressHighlighting
              >
                Terms
              </Text>{" "}
              and{" "}
              <Text
                style={styles.legalLink}
                onPress={() => console.log("Privacy Policy")}
                suppressHighlighting
              >
                Privacy Policy
              </Text>
            </Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  particleContainer: {
    overflow: "hidden",
  },
  particleDot: {
    position: "absolute",
  },
  safeContent: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "flex-start",
    paddingHorizontal: SPACING.screenPadding,
  },
  // Logo: ~180px from top of screen (not vertically centered)
  logoSection: {
    flex: 0,
    alignItems: "center",
    marginTop: 180,
  },
  logo: {
    fontFamily: "Inter_700Bold",
    fontSize: 40,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    fontWeight: "400",
    color: COLORS.muted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: SPACING.sm,
  },
  // Auth buttons: absolutely positioned at bottom, paddingBottom 48
  buttonsSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: 48,
    alignItems: "center",
  },
  buttonsInner: {
    maxWidth: 358,
    width: "100%",
  },
  buttonWrapper: {
    marginBottom: SPACING.cardGap,
  },
  buttonInner: {
    // Height 56px, radius 16; icon left 20px, label centered
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: RADIUS.card,
    position: "relative",
  },
  buttonApple: {
    backgroundColor: "#FFFFFF",
  },
  buttonDark: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surface2,
  },
  buttonIcon: {
    position: "absolute",
    left: 20,
  },
  buttonLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    fontWeight: "600",
  },
  labelApple: {
    color: "#000000",
  },
  labelDark: {
    color: COLORS.text,
  },
  legal: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    fontWeight: "400",
    color: COLORS.muted,
    textAlign: "center",
    marginTop: SPACING.md,
  },
  legalLink: {
    color: COLORS.violet,
  },
  // Legal: Terms & Privacy Policy tappable (placeholder onPress)
});
