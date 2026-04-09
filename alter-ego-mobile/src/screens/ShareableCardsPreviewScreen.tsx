/**
 * Shareable Cards Preview — Settings-only page to preview all card variants:
 * 6 title cards (Rank 1–4+ and Twin x2), 8 interest milestone cards, 8 quit milestone cards.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { TwinComparisonShareCard } from "../components/TwinComparisonShareCard";
import { MilestoneDetailModal } from "../components/MilestoneDetailModal";
import { QuitMilestoneModal } from "../components/QuitMilestoneModal";
import type { TwinComparisonOut, MilestoneOut, QuitMilestoneOut } from "../utils/api";

const CARD_MARGIN = 16;
const SECTION_GAP = 28;

// Interest milestone theme titles (1–8) — sessions-based ordering
const INTEREST_MILESTONE_TITLES: Record<number, string> = {
  1: "First Step",
  2: "7 Days In",
  3: "10 Sessions",
  4: "One Month (30 Sessions)",
  5: "50 Sessions",
  6: "100 Sessions",
  7: "200 Sessions",
  8: "365 Sessions",
};

// Quit milestone types we expose (10): first day → one year + comeback + conquered
const QUIT_MILESTONE_PREVIEW_TYPES: { type: string; label: string }[] = [
  { type: "day_1", label: "Day 1" },
  { type: "day_3", label: "Day 3" },
  { type: "day_7", label: "Day 7" },
  { type: "day_14", label: "Day 14" },
  { type: "day_30", label: "Day 30" },
  { type: "day_60", label: "2 Months" },
  { type: "day_90", label: "3 Months" },
  { type: "day_365", label: "One Year" },
  { type: "comeback", label: "Comeback" },
  { type: "conquered", label: "Conquered" },
];

// Mock comparison for Twin ahead (violet card)
const MOCK_COMPARISON_TWIN_AHEAD: TwinComparisonOut = {
  user_xp: 1200,
  user_pet_stage: 1,
  user_pet_stage_name: "Cat",
  user_streak: 4,
  user_power_score: 720,
  twin_xp: 2400,
  twin_pet_stage: 2,
  twin_pet_stage_name: "Fox",
  twin_streak: 12,
  twin_power_score: 890,
  current_gap_state: "CLOSING",
  gap_line: "5 days ahead",
  strip_message: "Your rival is you — one week ahead.",
  gap_days: 5,
};

// Mock comparison for User ahead (gold card)
const MOCK_COMPARISON_USER_AHEAD: TwinComparisonOut = {
  user_xp: 3200,
  user_pet_stage: 3,
  user_pet_stage_name: "Wolf",
  user_streak: 14,
  user_power_score: 910,
  twin_xp: 1800,
  twin_pet_stage: 2,
  twin_pet_stage_name: "Fox",
  twin_streak: 8,
  twin_power_score: 780,
  current_gap_state: "PASSED",
  gap_line: "You're ahead",
  strip_message: "You closed the gap. Now don't let it open again.",
  gap_days: -2,
};

function getInterestMilestoneMock(milestoneNumber: number): MilestoneOut {
  return {
    id: `preview-ms-${milestoneNumber}`,
    milestone_number: milestoneNumber,
    name: INTEREST_MILESTONE_TITLES[milestoneNumber] ?? `Milestone ${milestoneNumber}`,
    trigger_label: "Preview",
    earned_at: new Date().toISOString(),
    is_unlocked: true,
    sessions_at_earn: milestoneNumber * 10,
    xp_at_earn: 100 * milestoneNumber,
    xp_total_at_earn: 500 * milestoneNumber,
    streak_at_earn: milestoneNumber,
    tier_at_earn: "medium",
    quote: "You showed up. That's what the Twin sees.",
  };
}

function getQuitMilestoneMock(milestoneType: string): QuitMilestoneOut {
  const cleanDays: Record<string, number> = {
    day_1: 1,
    day_3: 3,
    day_7: 7,
    day_14: 14,
    day_30: 30,
    day_60: 60,
    day_90: 90,
    day_365: 365,
    comeback: 14,
    conquered: 365,
  };
  return {
    id: `preview-qms-${milestoneType}`,
    milestone_type: milestoneType,
    earned_at: new Date().toISOString(),
    is_unlocked: true,
    clean_days_at_earn: cleanDays[milestoneType] ?? 7,
    cravings_at_earn: milestoneType === "conquered" ? 0 : 12,
    phase_at_earn: "early",
    days_away: null,
    quote: milestoneType === "comeback"
      ? "You came back. That's what matters."
      : milestoneType === "conquered"
        ? "You're done. For good."
        : "One step at a time.",
    slip_duration_hours: milestoneType === "comeback" ? 48 : null,
    return_speed: milestoneType === "comeback" ? "strong" : null,
  };
}

export function ShareableCardsPreviewScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [twinVariant, setTwinVariant] = useState<"twin" | "user" | null>(null);
  const [interestPreviewNumber, setInterestPreviewNumber] = useState<number | null>(null);
  const [quitPreviewType, setQuitPreviewType] = useState<string | null>(null);

  const nav = navigation as any;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#09091A", "#07080F"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 10, paddingBottom: 14, paddingHorizontal: 16 },
        ]}
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#6B7280" />
        </Pressable>
        <Text style={styles.headerTitle}>Shareable cards</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: 20,
            paddingBottom: insets.bottom + 40,
            paddingHorizontal: CARD_MARGIN,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title cards (6): Rank 1–4+ and Twin x2 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Title cards (6)</Text>
          <Text style={styles.sectionSub}>
            Rank card by position (1st–4+) and Twin comparison (Twin ahead / You ahead).
          </Text>
          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => nav.navigate?.("RankCard", { rankPosition: 1 })}
              style={[styles.cardButton, styles.cardButtonGold]}
            >
              <Text style={styles.cardButtonLabel}>1 Gold</Text>
            </Pressable>
            <Pressable
              onPress={() => nav.navigate?.("RankCard", { rankPosition: 2 })}
              style={[styles.cardButton, styles.cardButtonSilver]}
            >
              <Text style={styles.cardButtonLabel}>2 Silver</Text>
            </Pressable>
            <Pressable
              onPress={() => nav.navigate?.("RankCard", { rankPosition: 3 })}
              style={[styles.cardButton, styles.cardButtonBronze]}
            >
              <Text style={styles.cardButtonLabel}>3 Bronze</Text>
            </Pressable>
          </View>
          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => nav.navigate?.("RankCard", {})}
              style={[styles.cardButton, styles.cardButtonDefault]}
            >
              <Text style={styles.cardButtonLabel}>4 Default</Text>
            </Pressable>
            <Pressable
              onPress={() => setTwinVariant("twin")}
              style={[styles.cardButton, styles.cardButtonViolet]}
            >
              <Text style={styles.cardButtonLabel}>5 Twin</Text>
            </Pressable>
            <Pressable
              onPress={() => setTwinVariant("user")}
              style={[styles.cardButton, styles.cardButtonGold]}
            >
              <Text style={styles.cardButtonLabel}>6 You</Text>
            </Pressable>
          </View>
        </View>

        {/* Interest milestone cards (8) */}
        <View style={[styles.section, { marginTop: SECTION_GAP }]}>
          <Text style={styles.sectionTitle}>Interest milestone cards (8)</Text>
          <Text style={styles.sectionSub}>
            Profile → Interests: tap an unlocked milestone to see its card theme.
          </Text>
          <View style={styles.buttonRow}>
            {[1, 2, 3, 4].map((n) => (
              <Pressable
                key={n}
                onPress={() => setInterestPreviewNumber(n)}
                style={[styles.cardButton, styles.cardButtonDefault]}
              >
                <Text style={styles.cardButtonLabel}>{n}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.buttonRow}>
            {[5, 6, 7, 8].map((n) => (
              <Pressable
                key={n}
                onPress={() => setInterestPreviewNumber(n)}
                style={[styles.cardButton, styles.cardButtonDefault]}
              >
                <Text style={styles.cardButtonLabel}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Quit target milestone cards (10) */}
        <View style={[styles.section, { marginTop: SECTION_GAP }]}>
          <Text style={styles.sectionTitle}>Quit target milestone cards (10)</Text>
          <Text style={styles.sectionSub}>
            Profile → Quits: tap a milestone to see its card theme.
          </Text>
          <View style={styles.buttonRow}>
            {QUIT_MILESTONE_PREVIEW_TYPES.slice(0, 5).map(({ type, label }) => (
              <Pressable
                key={type}
                onPress={() => setQuitPreviewType(type)}
                style={[styles.cardButton, styles.cardButtonDefault]}
              >
                <Text style={styles.cardButtonLabel} numberOfLines={1}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.buttonRow}>
            {QUIT_MILESTONE_PREVIEW_TYPES.slice(5, 10).map(({ type, label }) => (
              <Pressable
                key={type}
                onPress={() => setQuitPreviewType(type)}
                style={[styles.cardButton, styles.cardButtonDefault]}
              >
                <Text style={styles.cardButtonLabel} numberOfLines={1}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Twin Comparison modals */}
      <TwinComparisonShareCard
        visible={twinVariant === "twin"}
        onClose={() => setTwinVariant(null)}
        comparison={MOCK_COMPARISON_TWIN_AHEAD}
        userCharacterStage={2}
        twinCharacterStage={4}
      />
      <TwinComparisonShareCard
        visible={twinVariant === "user"}
        onClose={() => setTwinVariant(null)}
        comparison={MOCK_COMPARISON_USER_AHEAD}
        userCharacterStage={3}
        twinCharacterStage={2}
      />

      {/* Interest milestone card preview (one modal, theme by number) */}
      {interestPreviewNumber !== null && (
        <MilestoneDetailModal
          visible
          onClose={() => setInterestPreviewNumber(null)}
          milestone={getInterestMilestoneMock(interestPreviewNumber)}
          interestName="Fitness"
        />
      )}

      {/* Quit milestone card preview (one modal, theme by type) */}
      {quitPreviewType !== null && (
        <QuitMilestoneModal
          visible
          onClose={() => setQuitPreviewType(null)}
          milestone={getQuitMilestoneMock(quitPreviewType)}
          quitName="Smoking"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(7,8,15,0.8)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.4)",
  },
  backBtn: { padding: 4, width: 40, height: 40, justifyContent: "center" },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#E5E7EB",
  },
  scroll: { flex: 1 },
  scrollContent: {},
  section: {},
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#E5E7EB",
    marginBottom: 6,
  },
  sectionSub: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  cardButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardButtonLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E5E7EB",
  },
  cardButtonGold: {
    backgroundColor: "rgba(255,215,0,0.12)",
    borderColor: "rgba(255,215,0,0.35)",
  },
  cardButtonSilver: {
    backgroundColor: "rgba(192,192,192,0.12)",
    borderColor: "rgba(192,192,192,0.3)",
  },
  cardButtonBronze: {
    backgroundColor: "rgba(205,127,50,0.12)",
    borderColor: "rgba(205,127,50,0.35)",
  },
  cardButtonDefault: {
    backgroundColor: "rgba(139,92,246,0.1)",
    borderColor: "rgba(139,92,246,0.28)",
  },
  cardButtonViolet: {
    backgroundColor: "rgba(139,92,246,0.12)",
    borderColor: "rgba(139,92,246,0.3)",
  },
});
