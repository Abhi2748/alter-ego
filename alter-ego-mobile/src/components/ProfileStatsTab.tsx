/**
 * Profile Stats tab — Screen 21 Tab 1.
 * XP over time (line + area), Mission completion rate (bar), Twin gap (line),
 * Per-interest progress (horizontal bars). Axis labels for each chart.
 * Renders content only (no ScrollView); parent ProfileScreen provides scroll.
 */

import React from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import { CartesianChart, Line, Area, Bar } from "victory-native";
import { COLORS, SPACING } from "../constants/theme";
import { useProfileStats } from "@/hooks/useProfile";

const XP_CHART_HEIGHT = 160;
const COMPLETION_CHART_HEIGHT = 140;
const GAP_CHART_HEIGHT = 120;
const SECTION_GAP = 24;

type StatsResponse = {
  period_days: number;
  xp_chart: Array<{ date: string; xp: number }>;
  completion_rate: number;
  total_missions_completed: number;
  total_missions_possible: number;
  streak_chart: Array<{ date: string; streak: number; maintained: boolean }>;
};

export function ProfileStatsTab() {
  const { width } = useWindowDimensions();
  const chartWidth = width - 2 * SPACING.screenPadding;
  const { data, isLoading, error, refetch } = useProfileStats(30) as {
    data: StatsResponse | undefined;
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
  };

  const xpData =
    data?.xp_chart?.map((p, idx) => ({ day: idx + 1, xp: p.xp })) ?? [];
  const completionRate = data?.completion_rate ?? 0;
  const completionData = [{ week: 1, rate: completionRate }];
  const streakData =
    data?.streak_chart?.map((p, idx) => ({ day: idx + 1, streak: p.streak })) ?? [];

  return (
    <View style={styles.content}>
      {error ? (
        <View style={{ paddingVertical: 16 }}>
          <Text style={[styles.axisLabelText, { color: COLORS.text2 }]}>
            {error instanceof Error ? error.message : "Could not load stats"}
          </Text>
          <Text
            onPress={() => refetch()}
            style={[styles.axisLabelText, { color: COLORS.violet, marginTop: 8 }]}
          >
            Retry
          </Text>
        </View>
      ) : null}

      {/* XP Progress — line + area */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>XP Progress</Text>
        <View style={[styles.chartWrap, { width: chartWidth, height: XP_CHART_HEIGHT }]}>
          {isLoading || xpData.length === 0 ? (
            <View />
          ) : (
            <CartesianChart
              data={xpData}
              xKey="day"
              yKeys={["xp"]}
              axisOptions={{
                tickCount: { x: 5, y: 4 },
                lineColor: COLORS.surface2,
                lineWidth: { grid: 1, frame: 0 },
              }}
            >
              {({ points, chartBounds }) => (
                <>
                  <Area
                    points={points.xp}
                    y0={chartBounds.bottom}
                    color="rgba(139, 92, 246, 0.1)"
                  />
                  <Line points={points.xp} color={COLORS.violet} strokeWidth={2} />
                </>
              )}
            </CartesianChart>
          )}
        </View>
        <View style={styles.axisLabelRow}>
          <Text style={styles.axisLabelText}>X: Day (last 30)</Text>
          <Text style={styles.axisLabelText}>Y: XP</Text>
        </View>
      </View>

      {/* Mission Completion Rate — bars */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Mission Completion Rate</Text>
        <View style={[styles.chartWrap, { width: chartWidth, height: COMPLETION_CHART_HEIGHT }]}>
          {isLoading ? (
            <View />
          ) : (
            <CartesianChart
              data={completionData}
              xKey="week"
              yKeys={["rate"]}
              domain={{ y: [0, 100] }}
              axisOptions={{
                tickCount: { x: 1, y: 5 },
                lineColor: COLORS.surface2,
                lineWidth: { grid: 1, frame: 0 },
              }}
            >
              {({ points, chartBounds }) => (
                <Bar
                  points={points.rate}
                  chartBounds={chartBounds}
                  color={COLORS.violetDeep}
                  roundedCorners={{ topLeft: 4, topRight: 4 }}
                />
              )}
            </CartesianChart>
          )}
          <View
            style={[
              styles.targetLine,
              {
                width: chartWidth,
                top: COMPLETION_CHART_HEIGHT * 0.2,
              },
            ]}
          />
        </View>
        <View style={styles.axisLabelRow}>
          <Text style={styles.axisLabelText}>X: Week (last 7)</Text>
          <Text style={styles.axisLabelText}>Y: Completion %</Text>
        </View>
        {!isLoading ? (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.axisLabelText}>
              {`${completionRate.toFixed(1)}% · ${data?.total_missions_completed ?? 0}/${data?.total_missions_possible ?? 0} missions`}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Streak — line */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, styles.gapLabel]}>Streak (days)</Text>
        <View style={[styles.chartWrap, { width: chartWidth, height: GAP_CHART_HEIGHT }]}>
          {isLoading || streakData.length === 0 ? (
            <View />
          ) : (
            <CartesianChart
              data={streakData}
              xKey="day"
              yKeys={["streak"]}
              axisOptions={{
                tickCount: { x: 5, y: 4 },
                lineColor: COLORS.surface2,
                lineWidth: { grid: 1, frame: 0 },
              }}
            >
              {({ points }) => (
                <Line points={points.streak} color={COLORS.violetLine} strokeWidth={2} />
              )}
            </CartesianChart>
          )}
        </View>
        <View style={styles.axisLabelRow}>
          <Text style={styles.axisLabelText}>X: Day (last 30)</Text>
          <Text style={styles.axisLabelText}>Y: Streak</Text>
        </View>
      </View>

      {/* Per-interest progress — horizontal bars */}
      <View style={styles.section}>
        <Text style={styles.interestSectionLabel}>INTEREST PROGRESS THIS WEEK</Text>
        <Text style={styles.axisLabelText}>Come back after your first week.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: 96,
  },
  section: {
    marginBottom: SECTION_GAP,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 12,
  },
  axisLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingHorizontal: 4,
  },
  axisLabelText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: COLORS.muted,
  },
  gapLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: COLORS.violetLine,
  },
  chartWrap: {
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: COLORS.surface,
  },
  targetLine: {
    position: "absolute",
    left: 0,
    height: 1,
    backgroundColor: COLORS.violetGlow,
    opacity: 0.8,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: COLORS.violetGlow,
  },
  interestSectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: COLORS.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  interestBlock: {
    marginBottom: 16,
  },
  interestRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  interestName: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.text,
  },
  interestPercent: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.violet,
  },
  interestBarBg: {
    height: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surface2,
    overflow: "hidden",
  },
  interestBarFill: {
    height: "100%",
    backgroundColor: COLORS.violet,
    borderRadius: 8,
  },
});
