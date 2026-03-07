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

const XP_CHART_HEIGHT = 160;
const COMPLETION_CHART_HEIGHT = 140;
const GAP_CHART_HEIGHT = 120;
const SECTION_GAP = 24;

// Placeholder: 30 days, slowly increasing XP with a couple dips
function getXpData() {
  const data: { day: number; xp: number }[] = [];
  let xp = 800;
  for (let i = 0; i < 30; i++) {
    if (i === 7 || i === 14) xp -= 120;
    else if (i % 4 === 0) xp += 80;
    else xp += 40;
    data.push({ day: i + 1, xp: Math.max(400, xp) });
  }
  return data;
}

// Placeholder: 7 weeks completion %
const COMPLETION_DATA = [
  { week: 1, rate: 72 },
  { week: 2, rate: 85 },
  { week: 3, rate: 68 },
  { week: 4, rate: 90 },
  { week: 5, rate: 78 },
  { week: 6, rate: 88 },
  { week: 7, rate: 94 },
];

// Placeholder: 30 days Twin gap (6–10), ideally trending down
function getGapData() {
  const data: { day: number; gap: number }[] = [];
  let gap = 7;
  for (let i = 0; i < 30; i++) {
    if (i > 15) gap = Math.max(6, gap - (i % 3 === 0 ? 1 : 0));
    else gap = 6 + (i % 4);
    data.push({ day: i + 1, gap });
  }
  return data;
}

// Per-interest placeholder
const INTEREST_DATA = [
  { name: "Fitness", percent: 85 },
  { name: "Reading", percent: 60 },
];

const xpData = getXpData();
const gapData = getGapData();

export function ProfileStatsTab() {
  const { width } = useWindowDimensions();
  const chartWidth = width - 2 * SPACING.screenPadding;

  return (
    <View style={styles.content}>
      {/* XP Progress — line + area */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>XP Progress</Text>
        <View style={[styles.chartWrap, { width: chartWidth, height: XP_CHART_HEIGHT }]}>
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
          <CartesianChart
            data={COMPLETION_DATA}
            xKey="week"
            yKeys={["rate"]}
            domain={{ y: [0, 100] }}
            axisOptions={{
              tickCount: { x: 7, y: 5 },
              lineColor: COLORS.surface2,
              lineWidth: { grid: 1, frame: 0 },
            }}
          >
            {({ points, chartBounds }) => (
              <>
                <Bar
                  points={points.rate}
                  chartBounds={chartBounds}
                  color={COLORS.violetDeep}
                  roundedCorners={{ topLeft: 4, topRight: 4 }}
                />
              </>
            )}
          </CartesianChart>
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
      </View>

      {/* Twin Gap — line */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, styles.gapLabel]}>Twin Gap (days)</Text>
        <View style={[styles.chartWrap, { width: chartWidth, height: GAP_CHART_HEIGHT }]}>
          <CartesianChart
            data={gapData}
            xKey="day"
            yKeys={["gap"]}
            axisOptions={{
              tickCount: { x: 5, y: 4 },
              lineColor: COLORS.surface2,
              lineWidth: { grid: 1, frame: 0 },
            }}
          >
            {({ points }) => (
              <Line points={points.gap} color={COLORS.violetLine} strokeWidth={2} />
            )}
          </CartesianChart>
        </View>
        <View style={styles.axisLabelRow}>
          <Text style={styles.axisLabelText}>X: Day (last 30)</Text>
          <Text style={styles.axisLabelText}>Y: Gap (days)</Text>
        </View>
      </View>

      {/* Per-interest progress — horizontal bars */}
      <View style={styles.section}>
        <Text style={styles.interestSectionLabel}>INTEREST PROGRESS THIS WEEK</Text>
        {INTEREST_DATA.map((item) => (
          <View key={item.name} style={styles.interestBlock}>
            <View style={styles.interestRow}>
              <Text style={styles.interestName}>{item.name}</Text>
              <Text style={styles.interestPercent}>{item.percent}%</Text>
            </View>
            <View style={styles.interestBarBg}>
              <View
                style={[styles.interestBarFill, { width: `${item.percent}%` }]}
              />
            </View>
          </View>
        ))}
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
