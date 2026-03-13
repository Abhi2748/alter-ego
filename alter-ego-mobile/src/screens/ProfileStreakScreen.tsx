/**
 * Profile → Streak. Top stats, 16-week heatmap (readable month/day), legend,
 * This month. Filled but minimal noise.
 */

import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, GRADIENTS, HEATMAP_LEVELS, RADIUS } from "../constants/theme";
import {
  StreakHeatmap,
  generatePlaceholderHeatmapData,
} from "../components/StreakHeatmap";

const CURRENT_STREAK = 12;
const LONGEST_STREAK = 28;
/** Weeks of history (scroll left to see all). Placeholder: 52; later = since join. */
const WEEKS_HISTORY = 52;
const CELL_SIZE = 18;

/** Placeholder: active days in current month; will come from streak_log. */
const THIS_MONTH_ACTIVE = 12;
const THIS_MONTH_DAYS = 31;

export function ProfileStreakScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const heatmapData = React.useMemo(
    () => generatePlaceholderHeatmapData(WEEKS_HISTORY),
    []
  );

  return (
    <LinearGradient
      colors={GRADIENTS.background.colors}
      start={GRADIENTS.background.start}
      end={GRADIENTS.background.end}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Streak</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + SPACING.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top stat row: current streak | longest streak */}
        <View style={styles.statRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>Current</Text>
            <Text style={[styles.statValue, { color: COLORS.ember }]}>
              {CURRENT_STREAK}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>Longest</Text>
            <Text style={[styles.statValue, { color: COLORS.text }]}>
              {LONGEST_STREAK}
            </Text>
          </View>
        </View>

        {/* Full history heatmap — scroll left to see all since join */}
        <View style={styles.heatmapSection}>
          <Text style={styles.sectionLabel}>Activity · scroll left for history</Text>
          <StreakHeatmap
            data={heatmapData}
            cellSize={CELL_SIZE}
            weeks={WEEKS_HISTORY}
          />
          <Text style={styles.tapHint}>Tap a day for details</Text>

          {/* Legend: Less → More */}
          <View style={styles.legend}>
            <Text style={styles.legendText}>Less</Text>
            {HEATMAP_LEVELS.map((color, i) => (
              <View
                key={i}
                style={[styles.legendSwatch, { backgroundColor: color }]}
              />
            ))}
            <Text style={styles.legendText}>More</Text>
          </View>
        </View>

        {/* This month — active days */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>This month</Text>
          <View style={styles.cardRow}>
            <Text style={styles.cardValue}>
              {THIS_MONTH_ACTIVE} active days
            </Text>
            <Text style={styles.cardSub}>
              {THIS_MONTH_ACTIVE}/{THIS_MONTH_DAYS}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${(THIS_MONTH_ACTIVE / THIS_MONTH_DAYS) * 100}%`,
                },
              ]}
            />
          </View>
        </View>

        {/* Streak freezes */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Streak freezes</Text>
          <Text style={styles.freezeText}>2 freezes available</Text>
          <View style={styles.freezeToggleRow}>
            <Text style={styles.freezeModeLabel}>Use automatically</Text>
            <View style={styles.freezeModePill}>
              <Text style={styles.freezeModePillText}>Automatic</Text>
            </View>
          </View>
          <Text style={styles.freezeHint}>
            We’ll automatically protect your streak on days you miss, or let you switch to manual in a future update.
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { marginRight: SPACING.sm },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: COLORS.text,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: SPACING.lg,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statBlock: { flex: 1, alignItems: "center" },
  statLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.muted,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.lg,
  },
  heatmapSection: {
    marginBottom: SPACING.lg,
  },
  sectionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.muted,
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  tapHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 8,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 6,
  },
  legendText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: COLORS.muted,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: SPACING.cardPadding,
    marginBottom: SPACING.cardGap,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.muted,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
  cardSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.muted,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.surface2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: COLORS.violet,
  },
  freezeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 8,
  },
  freezeToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  freezeModeLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.text2,
  },
  freezeModePill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(139,92,246,0.18)",
  },
  freezeModePillText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.violet,
  },
  freezeHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 4,
  },
});
