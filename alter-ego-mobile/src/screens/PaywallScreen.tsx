/**
 * Paywall Screen — Full-screen modal. Non-dismissable when trial expired;
 * dismissable (× top-right) when opened from Settings → Subscription.
 * Hero, trial timeline, plan selector, features, CTA. Phase 1: no RevenueCat.
 */

import React, { useState, useEffect } from "react";
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
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Path,
  Rect,
  Defs,
  RadialGradient,
  Stop,
} from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

const PLACEHOLDER_USER = {
  streak: 5,
  xp: 1240,
  pet_name: "Cub",
  pet_stage: 1,
  stage: 1,
  stage_title: "The Awakened",
};

const TIMELINE_ITEMS = [
  {
    title: "Today — Trial Starts",
    sub: "Full access from day one. No limits, no credit card required.",
    Icon: IconTimelineClock,
  },
  {
    title: "Day 5 — Reminder",
    sub: "We'll remind you 2 days before billing so there are no surprises.",
    Icon: IconTimelineInfo,
  },
  {
    title: "Day 7 — Billing Starts",
    sub: "Cancel anytime before. No questions asked.",
    Icon: IconTimelineCalendar,
  },
];

const FEATURES = [
  "Shadow Twin chat, always",
  "All 5 AI agents active",
  "Full leaderboard access",
  "Weekly Oracle report",
  "Cancel anytime",
];

// -----------------------------------------------------------------------------
// SVG ICONS
// -----------------------------------------------------------------------------

function IconTimelineClock() {
  return (
    <Svg width={15} height={15} viewBox="0 0 15 15" fill="none">
      <Circle cx={7.5} cy={7.5} r={6} stroke="#8B5CF6" strokeWidth={1.3} />
      <Path d="M7.5 4v3.5l2.5 2" stroke="#8B5CF6" strokeWidth={1.3} strokeLinecap="round" />
    </Svg>
  );
}

function IconTimelineInfo() {
  return (
    <Svg width={15} height={15} viewBox="0 0 15 15" fill="none">
      <Circle cx={7.5} cy={7.5} r={6} stroke="#8B5CF6" strokeWidth={1.3} />
      <Path d="M7.5 6v4" stroke="#8B5CF6" strokeWidth={1.3} strokeLinecap="round" />
      <Circle cx={7.5} cy={4.5} r={1} fill="#8B5CF6" />
    </Svg>
  );
}

function IconTimelineCalendar() {
  return (
    <Svg width={15} height={15} viewBox="0 0 15 15" fill="none">
      <Rect x={2} y={2} width={11} height={11} rx={2} stroke="#8B5CF6" strokeWidth={1.3} />
      <Path d="M2 5h11" stroke="#8B5CF6" strokeWidth={1.3} />
      <Path d="M5 2v3" stroke="#8B5CF6" strokeWidth={1.3} />
      <Path d="M10 2v3" stroke="#8B5CF6" strokeWidth={1.3} />
    </Svg>
  );
}

function IconCheckmarkCircle() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Circle cx={7} cy={7} r={6} stroke="#8B5CF6" strokeWidth={1.2} strokeOpacity={0.5} />
      <Path
        d="M4 7l2 2 4-4"
        stroke="#8B5CF6"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.7}
      />
    </Svg>
  );
}

function IconStar() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 1l1.8 3.6L14 5.2l-2.9 2.8.7 4.1L8 10.2 4.2 12.1l.7-4.1L2 5.2l4.2-.6L8 1z"
        fill="rgba(255,255,255,0.9)"
      />
    </Svg>
  );
}

// -----------------------------------------------------------------------------
// PET FLOAT ANIMATION
// -----------------------------------------------------------------------------

function PetPlaceholder() {
  const ty = useSharedValue(0);
  useEffect(() => {
    ty.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [ty]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value * -4 }],
  }));
  return (
    <Animated.View style={[styles.petPlaceholderWrap, animatedStyle]}>
      <View style={styles.petPlaceholderRing}>
        <LinearGradient
          colors={["rgba(100,40,200,0.60)", "rgba(20,15,50,0.95)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.petPlaceholder}
        />
      </View>
    </Animated.View>
  );
}

// -----------------------------------------------------------------------------
// SCREEN
// -----------------------------------------------------------------------------

type PaywallParams = { dismissable?: boolean };

export function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ Paywall: PaywallParams }, "Paywall">>();
  const dismissable = route.params?.dismissable === true;

  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual">("annual");
  const user = PLACEHOLDER_USER; // TODO: from context/API

  const handleSubscribe = () => {
    console.log("Purchase:", selectedPlan);
  };

  const handleRestore = () => {
    console.log("Restore purchase");
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#09091A", "#07080F"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Atmosphere layer */}
      <View style={[styles.atmosphereWrap, { height: 350 }]} pointerEvents="none">
        <Svg width="100%" height={350} style={styles.atmosphereSvg} viewBox="0 0 400 350" preserveAspectRatio="xMidYMin slice">
          <Defs>
            <RadialGradient id="atmosphere" cx="50%" cy="0%" rx="100%" ry="60%" gradientUnits="objectBoundingBox">
              <Stop offset="0" stopColor="rgba(80,20,160,0.22)" />
              <Stop offset="0.45" stopColor="rgba(50,10,120,0.08)" />
              <Stop offset="0.7" stopColor="transparent" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="400" height="350" fill="url(#atmosphere)" />
        </Svg>
        <LinearGradient
          colors={["transparent", "rgba(139,92,246,0.4)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.atmosphereAccent}
        />
      </View>

      {dismissable && (
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.closeBtn, { top: insets.top + 12 }]}
        >
          <Ionicons name="close" size={16} color="#6B7280" />
        </Pressable>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 32 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero zone */}
        <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
          <View style={styles.heroCharPetRow}>
            <View style={styles.characterPlaceholder}>
              <LinearGradient
                colors={["rgba(60,25,130,0.32)", "rgba(10,10,22,0.75)"]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={styles.characterGradient}
              />
              <LinearGradient
                colors={["transparent", "rgba(167,139,250,0.4)", "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.characterRim}
              />
            </View>
            <PetPlaceholder />
          </View>

          <View style={styles.statPillsRow}>
            <View style={styles.statPill}>
              <Text style={[styles.statValue, { color: "#F97316" }]}>{user.streak}🔥</Text>
              <Text style={styles.statLabel}>STREAK</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={[styles.statValue, { color: "#8B5CF6" }]}>{user.xp.toLocaleString()}</Text>
              <Text style={styles.statLabel}>XP</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={[styles.statValue, styles.statValuePet]}>{user.pet_name}</Text>
              <Text style={styles.statLabel}>PET</Text>
            </View>
          </View>

          <Text style={styles.headline}>
            Your discipline{"\n"}
            <Text style={styles.headlineAccent}>doesn't stop here.</Text>
          </Text>
          <Text style={styles.subHeadline}>
            Keep your streak, your companion, and your progress. Everything continues.
          </Text>
        </View>

        {/* Trial timeline */}
        <View style={styles.timelineSection}>
          {TIMELINE_ITEMS.map((item, i) => (
            <View key={i} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View style={styles.timelineDot}>
                  <item.Icon />
                </View>
                {i < TIMELINE_ITEMS.length - 1 && (
                  <LinearGradient
                    colors={["rgba(139,92,246,0.4)", "rgba(139,92,246,0.15)"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.timelineConnector}
                  />
                )}
              </View>
              <View style={styles.timelineTextCol}>
                <Text style={styles.timelineTitle}>{item.title}</Text>
                <Text style={styles.timelineSub}>{item.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Plan selector */}
        <View style={styles.planRow}>
          <Pressable
            onPress={() => setSelectedPlan("monthly")}
            style={[styles.planTile, selectedPlan === "monthly" && styles.planTileSelected]}
          >
            <Text style={styles.planTileLabel}>MONTHLY</Text>
            <Text style={styles.planTilePrice}>$9.99</Text>
            <Text style={styles.planTilePer}>/month</Text>
            <View style={[styles.planRadio, selectedPlan !== "monthly" && styles.planRadioEmpty]}>
              {selectedPlan === "monthly" && <View style={styles.planRadioInner} />}
            </View>
          </Pressable>

          <Pressable
            onPress={() => setSelectedPlan("annual")}
            style={[styles.planTile, styles.planTileAnnual, selectedPlan === "annual" && styles.planTileAnnualSelected]}
          >
            {selectedPlan === "annual" && (
              <LinearGradient
                colors={["rgba(30,18,60,0.9)", "rgba(15,10,30,0.95)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0.85 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            <LinearGradient
              colors={["transparent", "rgba(139,92,246,0.6)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.planTileAccent}
            />
            <View style={styles.planBadge}>
              <LinearGradient
                colors={["#5B21B6", "#8B5CF6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.planBadgeGrad}
              >
                <Text style={styles.planBadgeText}>6 MONTHS FREE</Text>
              </LinearGradient>
            </View>
            <Text style={[styles.planTileLabel, styles.planTileLabelAnnual]}>ANNUAL</Text>
            <Text style={styles.planTilePrice}>$59.99</Text>
            <Text style={styles.planTilePer}>/year</Text>
            <Text style={styles.planTileOld}>$119.88/year</Text>
            <Text style={styles.planTileEffective}>→ $5/month</Text>
            <View style={[styles.planRadio, styles.planRadioAnnual, selectedPlan === "annual" && styles.planRadioAnnualSelected]}>
              {selectedPlan === "annual" && <View style={styles.planRadioInner} />}
            </View>
          </Pressable>
        </View>

        {/* No payment due */}
        <View style={styles.noPaymentRow}>
          <IconCheckmarkCircle />
          <Text style={styles.noPaymentText}>No payment due now</Text>
        </View>

        {/* Features list */}
        <View style={styles.featuresCard}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* CTA zone */}
        <View style={styles.ctaZone}>
          <Pressable
            onPress={handleSubscribe}
            style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}
          >
            <LinearGradient
              colors={["#5B21B6", "#8B5CF6", "#A78BFA"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaBtnGrad}
            >
              <IconStar />
              <Text style={styles.ctaBtnLabel}>Start 7-Day Free Trial</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={handleRestore} style={styles.restoreBtn}>
            <Text style={styles.restoreLabel}>Restore Purchase</Text>
          </Pressable>
        </View>

        {/* Legal footer */}
        <View style={styles.legalFooter}>
          <Text style={styles.legalLine1}>
            Subscription auto-renews. Cancel anytime in App Store settings.
          </Text>
          <View style={styles.legalLinksRow}>
            <Pressable onPress={() => Linking.openURL("https://example.com/terms")}>
              <Text style={styles.legalLink}>Terms of Use</Text>
            </Pressable>
            <Text style={styles.legalDot}> · </Text>
            <Pressable onPress={() => Linking.openURL("https://example.com/privacy")}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// -----------------------------------------------------------------------------
// STYLES
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  atmosphereWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  atmosphereSvg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 350,
  },
  atmosphereAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.4)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 0,
    zIndex: 1,
  },
  hero: {
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  heroCharPetRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 10,
    marginBottom: 18,
  },
  characterPlaceholder: {
    width: 80,
    height: 120,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.18)",
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(80,20,160,0.20)", shadowRadius: 40, shadowOffset: { width: 0, height: 0 } }
      : { elevation: 12 }),
  },
  characterGradient: {
    width: "100%",
    height: "100%",
  },
  characterRim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  petPlaceholderWrap: {
    marginBottom: 10,
  },
  petPlaceholderRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: "rgba(109,40,217,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  petPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "rgba(139,92,246,0.38)",
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(109,40,217,0.25)", shadowRadius: 16, shadowOffset: { width: 0, height: 0 } }
      : { elevation: 8 }),
  },
  statPillsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  statPill: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.4)",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 1,
  },
  statValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  statValuePet: {
    color: "#E5E7EB",
    fontSize: 13,
  },
  statLabel: {
    fontSize: 8,
    color: "#374151",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  headline: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
    textAlign: "center",
    lineHeight: 30,
    letterSpacing: -0.5,
    marginBottom: 8,
    maxWidth: 280,
  },
  headlineAccent: {
    color: "#A78BFA",
  },
  subHeadline: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 19.5,
    maxWidth: 260,
    marginBottom: 24,
  },
  timelineSection: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 0,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    position: "relative",
  },
  timelineLeft: {
    alignItems: "center",
    width: 34,
    flexShrink: 0,
    paddingTop: 2,
  },
  timelineDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(109,40,217,0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(139,92,246,0.3)",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(139,92,246,0.12)", shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }
      : { elevation: 4 }),
  },
  timelineConnector: {
    position: "absolute",
    left: 17,
    top: 34,
    width: 1,
    height: "100%",
    minHeight: 40,
  },
  timelineTextCol: {
    flex: 1,
    paddingTop: 6,
    paddingBottom: 20,
  },
  timelineTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
    marginBottom: 3,
  },
  timelineSub: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
  },
  planRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  planTile: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    paddingHorizontal: 14,
    backgroundColor: "#111623",
    borderWidth: 1.5,
    borderColor: "rgba(42,48,80,0.6)",
    position: "relative",
    minHeight: 120,
  },
  planTileSelected: {},
  planTileAnnual: {
    overflow: "hidden",
  },
  planTileAnnualSelected: {
    borderColor: "rgba(139,92,246,0.45)",
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(109,40,217,0.12)", shadowRadius: 20, shadowOffset: { width: 0, height: 0 } }
      : { elevation: 8 }),
  },
  planTileAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  planBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    borderRadius: 8,
    overflow: "hidden",
  },
  planBadgeGrad: {
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  planBadgeText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    color: "#fff",
    textTransform: "uppercase",
  },
  planTileLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    color: "#4B5563",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  planTileLabelAnnual: {
    color: "rgba(167,139,250,0.6)",
  },
  planTilePrice: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
  },
  planTilePer: {
    fontSize: 12,
    color: "#6B7280",
  },
  planTileOld: {
    fontSize: 11,
    color: "#4B5563",
    textDecorationLine: "line-through",
    marginTop: 3,
  },
  planTileEffective: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#A78BFA",
    marginTop: 2,
  },
  planRadio: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "rgba(42,48,80,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  planRadioEmpty: {},
  planRadioAnnual: {
    borderColor: "#8B5CF6",
    backgroundColor: "rgba(139,92,246,0.15)",
  },
  planRadioAnnualSelected: {},
  planRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#8B5CF6",
  },
  noPaymentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  noPaymentText: {
    fontSize: 12,
    color: "#4B5563",
  },
  featuresCard: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.3)",
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#8B5CF6",
    flexShrink: 0,
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(139,92,246,0.5)", shadowRadius: 5, shadowOffset: { width: 0, height: 0 } }
      : { elevation: 4 }),
  },
  featureText: {
    fontSize: 13,
    color: "#9CA3AF",
    flex: 1,
  },
  ctaZone: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  ctaBtn: {
    height: 56,
    borderRadius: 18,
    marginBottom: 10,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(139,92,246,0.45)", shadowRadius: 24, shadowOffset: { width: 0, height: 0 } }
      : { elevation: 12 }),
  },
  ctaBtnPressed: { opacity: 0.98 },
  ctaBtnGrad: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.2)",
    borderRadius: 18,
  },
  ctaBtnLabel: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.2,
  },
  restoreBtn: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  restoreLabel: {
    fontSize: 13,
    color: "#4B5563",
  },
  legalFooter: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    alignItems: "center",
  },
  legalLine1: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 16,
    textAlign: "center",
  },
  legalLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 6,
  },
  legalLink: {
    fontSize: 10,
    color: "#4B5563",
  },
  legalDot: {
    fontSize: 10,
    color: "#2D3146",
  },
});
