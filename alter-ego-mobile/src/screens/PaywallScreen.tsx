/**
 * Paywall / Subscription Screen §24. Premium layout: timeline, MONTHLY vs YEARLY cards, CTA.
 * Full-screen, no dismiss when trial ended. Uses app theme (dark violet, premium gradient).
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Linking,
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
import {
  COLORS,
  SPACING,
  GRADIENTS,
  RADIUS,
  SHADOWS,
  ANIMATIONS,
} from "../constants/theme";

const CTA_HEIGHT = 52;
const TIMELINE_ICON_SIZE = 40;
const PLAN_CARD_PADDING = 16;

const TIMELINE_ITEMS = [
  {
    title: "Today",
    sub: "Unlock all the app's features — Hard Mode, Season, Journey and more.",
    icon: "lock-open-outline" as const,
  },
  {
    title: "In 5 Days – Reminder",
    sub: "We'll send you a reminder that your trial is ending soon.",
    icon: "notifications-outline" as const,
  },
  {
    title: "In 7 Days – Billing Starts",
    sub: "You'll be charged on Mar 7, 2026. Cancel anytime before.",
    icon: "diamond-outline" as const,
  },
];

export function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [yearlySelected, setYearlySelected] = useState(true);
  const ctaScale = useSharedValue(1);
  const ctaAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  const handleSubscribe = () => {
    console.log("[Paywall] Subscribe — RevenueCat (Phase 4)", yearlySelected ? "yearly" : "monthly");
  };

  const handleRestore = () => {
    console.log("[Paywall] Restore Purchase — RevenueCat (Phase 4)");
  };

  return (
    <LinearGradient
      colors={GRADIENTS.backgroundPremium.colors}
      start={GRADIENTS.backgroundPremium.start}
      end={GRADIENTS.backgroundPremium.end}
      style={styles.container}
    >
      {__DEV__ && (
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.devBack, { top: insets.top + SPACING.sm }]}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + SPACING.md,
            paddingBottom: insets.bottom + SPACING.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Pressable onPress={handleRestore} style={styles.restoreBtn}>
            <Text style={styles.restoreLabel}>Restore</Text>
          </Pressable>
          <View style={styles.logoWrap}>
            <View style={styles.logoIcon}>
              <Ionicons name="flash" size={28} color={COLORS.text} />
            </View>
          </View>
          <View style={styles.placeholderRight} />
        </View>

        <Text style={styles.headline}>
          Invest in yourself and achieve your true potential in 66 days.
        </Text>

        {/* Timeline */}
        <View style={styles.timelineWrap}>
          {TIMELINE_ITEMS.map((item, i) => (
            <View key={i} style={styles.timelineRow}>
              <View style={styles.timelineIconWrap}>
                <View style={styles.timelineIconCircle}>
                  <Ionicons name={item.icon} size={20} color={COLORS.text} />
                </View>
                {i < TIMELINE_ITEMS.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <View style={styles.timelineTextWrap}>
                <Text style={styles.timelineTitle}>{item.title}</Text>
                <Text style={styles.timelineSub}>{item.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Plan cards */}
        <View style={styles.planCardsRow}>
          <Pressable
            onPress={() => setYearlySelected(false)}
            style={[
              styles.planCard,
              !yearlySelected && styles.planCardSelected,
            ]}
          >
            <Text style={styles.planCardLabel}>MONTHLY</Text>
            <View style={styles.planCardBottom}>
              <Text style={styles.planCardPrice}>$12.99/mo</Text>
              {!yearlySelected ? (
                <View style={styles.planCardRadioSelected}>
                  <Ionicons name="checkmark" size={14} color={COLORS.violet} />
                </View>
              ) : (
                <View style={styles.planCardRadio} />
              )}
            </View>
          </Pressable>

          <Pressable
            onPress={() => setYearlySelected(true)}
            style={[
              styles.planCard,
              styles.planCardYearly,
              yearlySelected && styles.planCardYearlySelected,
            ]}
          >
            <View style={styles.freeBadge}>
              <Text style={styles.freeBadgeText}>7 DAYS FREE</Text>
            </View>
            <Text style={styles.planCardLabel}>YEARLY</Text>
            <View style={styles.planCardBottom}>
              <View style={styles.planCardPrices}>
                <Text style={styles.planCardPriceStrike}>$12.99/mo</Text>
                <Text style={styles.planCardPrice}>$4.16/mo</Text>
              </View>
              {yearlySelected ? (
                <View style={styles.planCardRadioSelected}>
                  <Ionicons name="checkmark" size={14} color={COLORS.violet} />
                </View>
              ) : (
                <View style={styles.planCardRadio} />
              )}
            </View>
          </Pressable>
        </View>

        <View style={styles.noPaymentRow}>
          <Ionicons name="checkmark-circle" size={18} color={COLORS.muted} />
          <Text style={styles.noPaymentText}>No Payment Due Now</Text>
        </View>

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
              <Text style={styles.ctaLabel}>Start My 7-Day Free Trial</Text>
            </LinearGradient>
          </Animated.View>
        </Pressable>

        <Text style={styles.footerDisclaimer}>
          7 days free, then $49.99 per year ($0.13 per day)
        </Text>

        <View style={styles.legalRow}>
          <Pressable onPress={() => Linking.openURL("https://example.com/terms")}>
            <Text style={styles.legalLink}>Terms of Use</Text>
          </Pressable>
          <Text style={styles.legalDivider}> </Text>
          <Pressable onPress={() => Linking.openURL("https://example.com/privacy")}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </Pressable>
        </View>
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
  devBack: {
    position: "absolute",
    left: SPACING.screenPadding,
    zIndex: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: SPACING.lg,
  },
  restoreBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  restoreLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: COLORS.text2,
  },
  logoWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "none",
  },
  logoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(139,92,246,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderRight: { width: 60 },
  headline: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: COLORS.text,
    textAlign: "center",
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.sm,
  },
  timelineWrap: {
    width: "100%",
    marginBottom: SPACING.xl,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  timelineIconWrap: {
    alignItems: "center",
    marginRight: SPACING.md,
  },
  timelineIconCircle: {
    width: TIMELINE_ICON_SIZE,
    height: TIMELINE_ICON_SIZE,
    borderRadius: TIMELINE_ICON_SIZE / 2,
    backgroundColor: "rgba(139,92,246,0.25)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: COLORS.violet,
    marginVertical: 4,
    borderRadius: 1,
  },
  timelineTextWrap: { flex: 1 },
  timelineTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 2,
  },
  timelineSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.text2,
    lineHeight: 19,
  },
  planCardsRow: {
    flexDirection: "row",
    gap: SPACING.md,
    width: "100%",
    marginBottom: SPACING.md,
  },
  planCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: PLAN_CARD_PADDING,
    minHeight: 100,
  },
  planCardSelected: {
    borderColor: "rgba(139,92,246,0.4)",
  },
  planCardYearly: {
    backgroundColor: COLORS.surface2,
  },
  planCardYearlySelected: {
    backgroundColor: "rgba(30,35,51,0.9)",
    borderColor: "rgba(139,92,246,0.5)",
  },
  freeBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: COLORS.violetDeep,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  freeBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  planCardLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: COLORS.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  planCardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planCardPrices: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  planCardPrice: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: COLORS.text,
  },
  planCardPriceStrike: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.muted,
    textDecorationLine: "line-through",
  },
  planCardRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginLeft: "auto",
  },
  planCardRadioSelected: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.violet,
    backgroundColor: COLORS.violet,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
  },
  noPaymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: SPACING.lg,
  },
  noPaymentText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.muted,
  },
  ctaWrap: {
    width: "100%",
    marginBottom: SPACING.md,
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
  footerDisclaimer: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.text2,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  legalLink: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: COLORS.muted,
  },
  legalDivider: {
    color: COLORS.muted,
    fontSize: 13,
  },
});
