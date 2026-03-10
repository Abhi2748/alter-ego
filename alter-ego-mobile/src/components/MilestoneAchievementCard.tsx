/**
 * Milestone Achievement Card — Part 3B Screen 27. Full-screen modal overlay.
 * Evolution gradient bg, interest + badge, violet circle with milestone number, name, Twin line, Continue button.
 * Particle burst on appear (16 particles, violet/gold, Reanimated).
 */

import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { COLORS, SPACING, GRADIENTS, RADIUS, SHADOWS, ANIMATIONS } from "../constants/theme";

const CIRCLE_SIZE = 80;
const CIRCLE_BG = "#6366F1";
const PARTICLE_COUNT = 16;
const BURST_RADIUS = 100;
const BURST_DURATION_MS = 700;
const PARTICLE_SIZE = 6;

const PARTICLE_COLORS = [
  COLORS.violet,
  COLORS.violet,
  COLORS.violetGlow,
  COLORS.violetGlow,
  "#F59E0B",
  "#F59E0B",
  COLORS.violet,
  COLORS.violet,
  COLORS.violetGlow,
  "#F59E0B",
  COLORS.violet,
  COLORS.violetGlow,
  COLORS.violet,
  "#F59E0B",
  COLORS.violetGlow,
  COLORS.violet,
];

export interface MilestoneAchievementCardProps {
  visible: boolean;
  onClose: () => void;
  /** Interest name, e.g. "Fitness" — shown uppercase at top */
  interestName: string;
  /** Milestone number in circle, e.g. 7 */
  milestoneNumber: number;
  /** Milestone name below circle, e.g. "7 Days of Fitness" */
  milestoneName: string;
  /** Twin congratulation line beneath milestone name */
  twinCongratulation: string;
}

function BurstParticle({
  index,
  color,
}: {
  index: number;
  color: string;
}) {
  const angle = (index / PARTICLE_COUNT) * 2 * Math.PI + 0.2;
  const progress = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    progress.value = withDelay(
      index * 25,
      withTiming(1, {
        duration: BURST_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      })
    );
    opacity.value = withDelay(
      index * 25 + BURST_DURATION_MS * 0.4,
      withTiming(0, { duration: BURST_DURATION_MS * 0.6, easing: Easing.in(Easing.ease) })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const r = progress.value * BURST_RADIUS;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    return {
      opacity: opacity.value,
      transform: [{ translateX: x }, { translateY: y }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        { backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
}

export function MilestoneAchievementCard({
  visible,
  onClose,
  interestName,
  milestoneNumber,
  milestoneName,
  twinCongratulation,
}: MilestoneAchievementCardProps) {
  const insets = useSafeAreaInsets();
  const contentOpacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const btnPressed = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      contentOpacity.value = 0;
      scale.value = 0.9;
      return;
    }
    contentOpacity.value = withDelay(
      100,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) })
    );
    scale.value = withDelay(
      100,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.2)) })
    );
  }, [visible]);

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ scale: scale.value }],
  }));

  const btnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: 1 - (1 - ANIMATIONS.pressScale) * btnPressed.value,
      },
    ],
  }));

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LinearGradient
          colors={GRADIENTS.evolution.colors}
          start={GRADIENTS.evolution.start}
          end={GRADIENTS.evolution.end}
          style={StyleSheet.absoluteFill}
        />
        {/* Particle burst — centered behind content */}
        <View style={styles.particleContainer} pointerEvents="none">
          {PARTICLE_COLORS.map((color, i) => (
            <BurstParticle key={i} index={i} color={color} />
          ))}
        </View>

        <Animated.View style={[styles.content, contentAnimatedStyle]}>
          <View style={styles.topRow}>
            <Text style={styles.interestLabel}>{interestName.toUpperCase()}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>MILESTONE UNLOCKED</Text>
            </View>
          </View>

          <View style={styles.circleWrap}>
            <View style={styles.circle}>
              <Text style={styles.circleNumber}>{milestoneNumber}</Text>
            </View>
          </View>

          <Text style={styles.milestoneName}>{milestoneName}</Text>
          <Text style={styles.twinLine} numberOfLines={2}>
            {twinCongratulation}
          </Text>

          <View style={styles.buttonWrap}>
            <Pressable
              onPress={onClose}
              onPressIn={() => {
                btnPressed.value = withTiming(1, { duration: ANIMATIONS.pressIn });
              }}
              onPressOut={() => {
                btnPressed.value = withTiming(0, { duration: ANIMATIONS.pressOut });
              }}
              style={styles.continueBtn}
            >
              <Animated.View style={[styles.continueBtnInner, btnAnimatedStyle]}>
                <LinearGradient
                  colors={GRADIENTS.button.colors}
                  start={GRADIENTS.button.start}
                  end={GRADIENTS.button.end}
                  style={styles.continueGradient}
                >
                  <Text style={styles.continueLabel}>Continue</Text>
                </LinearGradient>
              </Animated.View>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  particleContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  particle: {
    position: "absolute",
    width: PARTICLE_SIZE,
    height: PARTICLE_SIZE,
    borderRadius: PARTICLE_SIZE / 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.screenPadding,
    justifyContent: "center",
    alignItems: "center",
  },
  topRow: {
    position: "absolute",
    top: SPACING.xl,
    left: SPACING.screenPadding,
    right: SPACING.screenPadding,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  interestLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text2,
    letterSpacing: 1,
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(139,92,246,0.2)",
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    borderColor: COLORS.violet,
  },
  badgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.violetGlow,
    letterSpacing: 1,
  },
  circleWrap: {
    marginBottom: SPACING.lg,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: CIRCLE_BG,
          shadowOpacity: 0.6,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 0 },
        }
      : { elevation: 12 }),
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: CIRCLE_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  circleNumber: {
    fontFamily: "Inter_700Bold",
    fontSize: 36,
    fontWeight: "700",
    color: COLORS.text,
  },
  milestoneName: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  twinLine: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    fontStyle: "italic",
    color: COLORS.text2,
    textAlign: "center",
    maxWidth: 280,
    marginBottom: SPACING.xxl,
  },
  buttonWrap: {
    position: "absolute",
    bottom: SPACING.xxl,
    left: SPACING.screenPadding,
    right: SPACING.screenPadding,
    alignItems: "center",
  },
  continueBtn: {
    width: "100%",
    maxWidth: 320,
    borderRadius: RADIUS.card,
    overflow: "hidden",
    height: 56,
    ...(Platform.OS === "ios" ? SHADOWS.button : { elevation: 8 }),
  },
  continueBtnInner: {
    flex: 1,
    height: 56,
    borderRadius: RADIUS.card,
    overflow: "hidden",
  },
  continueGradient: {
    flex: 1,
    height: 56,
    borderRadius: RADIUS.card,
    alignItems: "center",
    justifyContent: "center",
  },
  continueLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
});
