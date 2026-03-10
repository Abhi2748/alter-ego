/**
 * Paywall / Trial Expiry Screen §24. Full-screen, no dismiss.
 * Shown when trial ends (Day 14+). User cannot navigate past without subscribing.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { PetAnimation } from "../components/PetAnimation";
import {
  COLORS,
  SPACING,
  GRADIENTS,
  RADIUS,
  SHADOWS,
  ANIMATIONS,
} from "../constants/theme";

const CHAR_W = 120;
const CHAR_H = 160;
const PET_SIZE = 56;
const GLOW_SIZE = 400;
const PRICE_CARD_RADIUS = 20;
const CTA_HEIGHT = 56;
const RESTORE_BUTTON_HEIGHT = 40;

const BULLETS = [
  "Shadow Twin chat, always",
  "All 5 AI agents active",
  "Full leaderboard access",
  "Weekly Oracle report",
  "Cancel anytime",
];

const PLACEHOLDER_STREAK = 12;
const PLACEHOLDER_XP = "3,200";
const PLACEHOLDER_PET_STAGE = 2;

export function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const ctaScale = useSharedValue(1);
  const ctaAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  const handleSubscribe = () => {
    console.log("[Paywall] Continue for $9/month — RevenueCat purchase flow (Phase 4)");
  };

  const handleRestore = () => {
    console.log("[Paywall] Restore Purchase — RevenueCat restore (Phase 4)");
  };

  return (
    <LinearGradient
      colors={GRADIENTS.background.colors}
      start={GRADIENTS.background.start}
      end={GRADIENTS.background.end}
      style={styles.container}
    >
      {/* Dev-only: back button to leave paywall when testing */}
      {__DEV__ && (
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.devBack, { top: insets.top + SPACING.sm }]}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          <Text style={styles.devBackLabel}>Back</Text>
        </Pressable>
      )}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + SPACING.lg,
            paddingBottom: insets.bottom + SPACING.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Upper ~35% — User progress: character + pet + stat row + violet glow */}
        <View style={styles.heroZone}>
          <View style={styles.heroContent}>
            <View style={[styles.glowCircle, { width: GLOW_SIZE, height: GLOW_SIZE }]} />
            <View style={styles.heroRow}>
              <View
                style={[
                  styles.charPlaceholder,
                  { width: CHAR_W, height: CHAR_H },
                ]}
              />
              <PetAnimation
                stage={PLACEHOLDER_PET_STAGE}
                isHappy
                size={PET_SIZE}
              />
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statItem}>🔥 {PLACEHOLDER_STREAK}</Text>
              <Text style={styles.statDivider}>·</Text>
              <Text style={styles.statItem}>{PLACEHOLDER_XP} XP</Text>
              <Text style={styles.statDivider}>·</Text>
              <Text style={styles.statItem}>Pet L{PLACEHOLDER_PET_STAGE}</Text>
            </View>
          </View>
        </View>

        {/* Trial end message — factor + 14-day learning */}
        <Text style={styles.headline}>You showed up 14 days.</Text>
        <Text style={styles.subhead}>
          We've learned how you work. Continue with a plan that fits you.
        </Text>

        {/* Price card — 24px below message */}
        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceAmount}>$9</Text>
            <Text style={styles.pricePeriod}>/month</Text>
          </View>
          <Text style={styles.priceTagline}>Everything. No tiers. No limits.</Text>
          <View style={styles.bulletList}>
            {BULLETS.map((line, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{line}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTA — 24px below price card — press scale */}
        <Pressable
          onPress={handleSubscribe}
          onPressIn={() => {
            ctaScale.value = withTiming(ANIMATIONS.pressScale, { duration: ANIMATIONS.pressIn });
          }}
          onPressOut={() => {
            ctaScale.value = withTiming(1, { duration: ANIMATIONS.pressOut });
          }}
          style={styles.ctaWrap}
        >
          <Animated.View style={[styles.ctaBtnWrap, ctaAnimatedStyle]}>
            <LinearGradient
              colors={GRADIENTS.button.colors}
              start={GRADIENTS.button.start}
              end={GRADIENTS.button.end}
              style={[styles.ctaBtn, SHADOWS.button]}
            >
              <Text style={styles.ctaLabel}>Continue for $9/month</Text>
            </LinearGradient>
          </Animated.View>
        </Pressable>

        <Pressable
          onPress={handleRestore}
          style={({ pressed }) => [styles.restoreWrap, pressed && styles.restorePressed]}
        >
          <Text style={styles.restoreLabel}>Restore Purchase</Text>
        </Pressable>

        <Text style={styles.legal}>
          Subscription auto-renews monthly. Cancel anytime in App Store settings.
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.screenPadding,
    alignItems: "center",
  },
  heroZone: {
    width: "100%",
    marginBottom: SPACING.lg,
  },
  heroContent: {
    alignItems: "center",
    position: "relative",
  },
  glowCircle: {
    position: "absolute",
    borderRadius: GLOW_SIZE / 2,
    backgroundColor: "rgba(139,92,246,0.15)",
    top: CHAR_H / 2 + PET_SIZE / 2 - GLOW_SIZE / 2,
    left: "50%",
    marginLeft: -GLOW_SIZE / 2,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: SPACING.md,
  },
  charPlaceholder: {
    backgroundColor: COLORS.surface2,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.sm,
    gap: 6,
  },
  statItem: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: COLORS.text,
  },
  statDivider: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.muted,
  },
  headline: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: COLORS.text,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  subhead: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: COLORS.text2,
    textAlign: "center",
    marginBottom: SPACING.lg,
    maxWidth: 280,
    alignSelf: "center",
  },
  priceCard: {
    width: "100%",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: PRICE_CARD_RADIUS,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    marginBottom: SPACING.xs,
  },
  priceAmount: {
    fontFamily: "Inter_700Bold",
    fontSize: 48,
    color: COLORS.text,
  },
  pricePeriod: {
    fontFamily: "Inter_400Regular",
    fontSize: 20,
    color: COLORS.muted,
    marginLeft: 2,
  },
  priceTagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.text2,
    textAlign: "center",
    marginBottom: SPACING.md,
  },
  bulletList: {
    alignSelf: "stretch",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  bulletDot: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.text2,
    marginRight: 8,
  },
  bulletText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.text2,
    flex: 1,
  },
  ctaWrap: {
    width: "100%",
    marginBottom: SPACING.sm,
  },
  ctaBtnWrap: {
    width: "100%",
    height: CTA_HEIGHT,
  },
  ctaBtn: {
    height: CTA_HEIGHT,
    borderRadius: RADIUS.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#8B5CF6",
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        }
      : { elevation: 8 }),
  },
  ctaLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
  restoreWrap: {
    height: RESTORE_BUTTON_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  restorePressed: { opacity: 0.7 },
  restoreLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: COLORS.violet,
  },
  legal: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: COLORS.muted,
    textAlign: "center",
    maxWidth: 280,
  },
  devBack: {
    position: "absolute",
    left: SPACING.screenPadding,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  devBackLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: COLORS.text,
  },
});
