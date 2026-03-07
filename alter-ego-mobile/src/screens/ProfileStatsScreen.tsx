/**
 * Profile → Stats. Dedicated screen with charts and visible axis numbers.
 * Clean, minimal design; numbers shown in strips beside/below charts.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { CartesianChart, Line, Area, Bar } from "victory-native";
import { COLORS, SPACING, GRADIENTS } from "../constants/theme";

const CHART_HEIGHT = 148;
const Y_LABEL_WIDTH = 40;
const X_LABEL_HEIGHT = 20;
const SECTION_GAP = 28;

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

const COMPLETION_DATA = [
  { week: 1, rate: 72 },
  { week: 2, rate: 85 },
  { week: 3, rate: 68 },
  { week: 4, rate: 90 },
  { week: 5, rate: 78 },
  { week: 6, rate: 88 },
  { week: 7, rate: 94 },
];

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

const INTEREST_DATA = [
  { name: "Fitness", percent: 85 },
  { name: "Reading", percent: 60 },
];

const xpData = getXpData();
const gapData = getGapData();

function getYTicks(min: number, max: number, count: number): number[] {
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(min + step * i));
}

function getXTicks(min: number, max: number, count: number): number[] {
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(min + step * i));
}

export function ProfileStatsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const chartWidth = width - SPACING.screenPadding * 2 - Y_LABEL_WIDTH - 8;

  const xpY = getYTicks(
    Math.min(...xpData.map((d) => d.xp)),
    Math.max(...xpData.map((d) => d.xp)),
    4
  );
  const xpX = getXTicks(1, 30, 5);

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
        <Text style={styles.title}>Stats</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* XP Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>XP progress</Text>
          <Text style={styles.sectionSub}>Last 30 days</Text>
          <View style={styles.chartWithAxes}>
            <View style={styles.yStrip}>
              {[...xpY].reverse().map((v, i) => (
                <Text key={i} style={styles.tickText}>
                  {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
                </Text>
              ))}
            </View>
            <View style={[styles.chartCol, { width: chartWidth }]}>
              <View style={[styles.chartWrap, { width: chartWidth, height: CHART_HEIGHT }]}>
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
                        color="rgba(139, 92, 246, 0.12)"
                      />
                      <Line points={points.xp} color={COLORS.violet} strokeWidth={2} />
                    </>
                  )}
                </CartesianChart>
              </View>
              <View style={styles.xStrip}>
                {xpX.map((v, i) => (
                  <Text key={i} style={styles.tickText}>{v}</Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Mission completion rate */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mission completion rate</Text>
          <Text style={styles.sectionSub}>Last 7 weeks · 80% target</Text>
          <View style={styles.chartWithAxes}>
            <View style={styles.yStrip}>
              {["100%", "75%", "50%", "25%", "0%"].map((v, i) => (
                <Text key={i} style={styles.tickText}>{v}</Text>
              ))}
            </View>
            <View style={[styles.chartCol, { width: chartWidth }]}>
              <View style={[styles.chartWrap, { width: chartWidth, height: 128 }]}>
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
                    <Bar
                      points={points.rate}
                      chartBounds={chartBounds}
                      color={COLORS.violetDeep}
                      roundedCorners={{ topLeft: 4, topRight: 4 }}
                    />
                  )}
                </CartesianChart>
              </View>
              <View style={styles.xStrip}>
                {[1, 2, 3, 4, 5, 6, 7].map((v) => (
                  <Text key={v} style={styles.tickText}>W{v}</Text>
                ))}
              </View>
            </View>
          </View>
          <View style={styles.targetLegend}>
            <View style={[styles.targetDot, { backgroundColor: COLORS.violetGlow }]} />
            <Text style={styles.targetLegendText}>80% target</Text>
          </View>
        </View>

        {/* Twin gap */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Twin gap</Text>
          <Text style={styles.sectionSub}>Days ahead · lower is better</Text>
          <View style={styles.chartWithAxes}>
            <View style={styles.yStrip}>
              {[10, 8, 6].map((v, i) => (
                <Text key={i} style={styles.tickText}>{v}d</Text>
              ))}
            </View>
            <View style={[styles.chartCol, { width: chartWidth }]}>
              <View style={[styles.chartWrap, { width: chartWidth, height: 108 }]}>
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
                    <Line points={points.gap} color={COLORS.violet} strokeWidth={2} />
                  )}
                </CartesianChart>
              </View>
              <View style={styles.xStrip}>
                {getXTicks(1, 30, 5).map((v, i) => (
                  <Text key={i} style={styles.tickText}>{v}</Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Interest progress */}
        <View style={styles.section}>
          <Text style={styles.interestHeader}>This week completion rate (interest)</Text>
          {INTEREST_DATA.map((item) => (
            <View key={item.name} style={styles.interestBlock}>
              <View style={styles.interestRow}>
                <Text style={styles.interestName}>{item.name}</Text>
                <Text style={styles.interestPct}>{item.percent}%</Text>
              </View>
              <View style={styles.barWrap}>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${item.percent}%` }]} />
                </View>
              </View>
            </View>
          ))}
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
  section: { marginBottom: SECTION_GAP },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: COLORS.text,
  },
  sectionSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
    marginBottom: 10,
  },
  chartWithAxes: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  yStrip: {
    width: Y_LABEL_WIDTH,
    justifyContent: "space-between",
    paddingRight: 6,
    paddingTop: 2,
    paddingBottom: X_LABEL_HEIGHT + 2,
  },
  chartCol: {
    flex: 1,
    minWidth: 0,
  },
  chartWrap: {
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surface2,
  },
  xStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: 4,
    height: X_LABEL_HEIGHT,
  },
  tickText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: COLORS.muted,
  },
  targetLegend: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  targetDot: {
    width: 8,
    height: 2,
    borderRadius: 1,
  },
  targetLegendText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.muted,
  },
  interestHeader: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: COLORS.muted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  interestBlock: { marginBottom: 14 },
  interestRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  interestName: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: COLORS.text,
  },
  interestPct: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: COLORS.violet,
  },
  barWrap: { marginBottom: 10 },
  barBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.surface2,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: COLORS.violet,
  },
});
