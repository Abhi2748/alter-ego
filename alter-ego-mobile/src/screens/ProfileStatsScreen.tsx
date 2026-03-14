/**
 * Profile → Stats. Three charts (XP progress, mission rate, Twin gap) plus
 * per-interest completion bars. Premium dark card layout, victory-native.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { CartesianChart, Line, Area } from "victory-native";

// -----------------------------------------------------------------------------
// TYPES & PLACEHOLDER DATA
// -----------------------------------------------------------------------------

export interface StatsScreenData {
  xp_progress: { day: number; xp: number }[];
  mission_rate: { week: string; pct: number }[];
  twin_gap: { day: number; gap: number }[];
  interest_completion: { interest_name: string; completion_pct: number }[];
}

const PLACEHOLDER_STATS: StatsScreenData = {
  xp_progress: [
    { day: 1, xp: 880 },
    { day: 5, xp: 1050 },
    { day: 10, xp: 1200 },
    { day: 15, xp: 1380 },
    { day: 20, xp: 1520 },
    { day: 25, xp: 1720 },
    { day: 30, xp: 2050 },
  ],
  mission_rate: [
    { week: "W1", pct: 72 },
    { week: "W2", pct: 88 },
    { week: "W3", pct: 62 },
    { week: "W4", pct: 95 },
    { week: "W5", pct: 75 },
    { week: "W6", pct: 90 },
    { week: "W7", pct: 98 },
  ],
  twin_gap: [
    { day: 1, gap: 8 },
    { day: 5, gap: 10 },
    { day: 8, gap: 6 },
    { day: 12, gap: 10 },
    { day: 16, gap: 7 },
    { day: 18, gap: 10 },
    { day: 22, gap: 9 },
    { day: 25, gap: 7 },
    { day: 27, gap: 6 },
    { day: 30, gap: 5 },
  ],
  interest_completion: [
    { interest_name: "Fitness", completion_pct: 85 },
    { interest_name: "Reading", completion_pct: 60 },
  ],
};

// -----------------------------------------------------------------------------
// SECTION HEADER + CHART CARD
// -----------------------------------------------------------------------------

function SectionHeader({
  title,
  subLabel,
  accentColors,
}: {
  title: string;
  subLabel?: string;
  accentColors: [string, string];
}) {
  return (
    <View style={styles.sectionHeader}>
      <LinearGradient
        colors={accentColors}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.sectionAccentBar}
      />
      <Text style={styles.sectionTitle}>{title}</Text>
      {subLabel != null && (
        <Text style={styles.sectionSub} numberOfLines={1}>
          {subLabel}
        </Text>
      )}
    </View>
  );
}

function ChartCard({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.chartCard}>
      <LinearGradient
        colors={["transparent", "rgba(139,92,246,0.20)", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.chartCardAccent}
      />
      {children}
    </View>
  );
}

// -----------------------------------------------------------------------------
// SCREEN
// -----------------------------------------------------------------------------

const XP_ACCENT: [string, string] = ["#8B5CF6", "#5B21B6"];
const MISSION_ACCENT: [string, string] = ["#A78BFA", "#7C3AED"];
const GAP_ACCENT: [string, string] = ["#C084FC", "#7C3AED"];
const INTEREST_ACCENT: [string, string] = ["#A78BFA", "#6D28D9"];

const CHART_HEIGHT_XP = 140;
const CHART_HEIGHT_MISSION = 140;
const CHART_HEIGHT_GAP = 120;
const Y_LABEL_WIDTH = 40;
const X_LABEL_HEIGHT = 22;
const PADDING_LEFT = 40;
const PADDING_RIGHT = 10;
const PADDING_TOP = 10;
const PADDING_BOTTOM = 30;

function getYTicks(min: number, max: number, count: number): number[] {
  if (max <= min) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(min + step * i));
}

function formatXpY(val: number): string {
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return String(val);
}

export function ProfileStatsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const cardWidth = width - 32;
  const chartAreaWidth = cardWidth - 14 * 2 - Y_LABEL_WIDTH - 8;
  const [data] = useState<StatsScreenData>(PLACEHOLDER_STATS);
  const [xpLastPoint, setXpLastPoint] = useState<{ x: number; y: number } | null>(null);

  const xpYMin = Math.min(...data.xp_progress.map((d) => d.xp));
  const xpYMax = Math.max(...data.xp_progress.map((d) => d.xp));
  const xpYTicks = getYTicks(xpYMin, xpYMax, 4);
  const xpXTicks = [1, 8, 16, 23, 30];
  const lastXp = data.xp_progress[data.xp_progress.length - 1];

  const gapYMin = Math.min(...data.twin_gap.map((d) => d.gap));
  const gapYMax = Math.max(...data.twin_gap.map((d) => d.gap));
  const gapYTicks = getYTicks(gapYMin, gapYMax, 4);
  const gapXTicks = [1, 8, 16, 23, 30];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#09091A", "#07080F"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + 10, paddingBottom: 14 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#6B7280" />
        </Pressable>
        <Text style={styles.headerTitle}>Stats</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 80 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* XP Progress */}
        <SectionHeader title="XP Progress" subLabel="Last 30 days" accentColors={XP_ACCENT} />
        <ChartCard>
          <View style={styles.chartWithAxes}>
            <View style={styles.yStrip}>
              {[...xpYTicks].reverse().map((v, i) => (
                <Text key={i} style={styles.tickLabel}>{formatXpY(v)}</Text>
              ))}
            </View>
            <View style={styles.chartCol}>
              <View style={[styles.chartInner, { height: CHART_HEIGHT_XP, width: chartAreaWidth }]}>
                {/* Fade overlay: purple area bright near line, fades toward x-axis (behind chart) */}
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <LinearGradient
                    colors={["transparent", "rgba(14,13,28,0.92)"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
                <CartesianChart
                  data={data.xp_progress}
                  xKey="day"
                  yKeys={["xp"]}
                  axisOptions={{
                    tickCount: { x: 5, y: 4 },
                    lineColor: "rgba(42,48,80,0.30)",
                    lineWidth: { grid: 1, frame: 0 },
                  }}
                >
                  {({ points, chartBounds }) => {
                    if (points.xp?.length) {
                      const last = points.xp[points.xp.length - 1];
                      queueMicrotask(() =>
                        setXpLastPoint((prev) =>
                          prev?.x === last.x && prev?.y === last.y ? prev : { x: last.x, y: last.y }
                        )
                      );
                    }
                    return (
                      <>
                        <Area
                          points={points.xp}
                          y0={chartBounds.bottom}
                          color="rgba(139,92,246,0.25)"
                        />
                        <Line
                          points={points.xp}
                          color="#8B5CF6"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </>
                    );
                  }}
                </CartesianChart>
                {/* Bright dot at the end of the line (most recent day) — same coords as chart points */}
                {xpLastPoint != null && (
                  <View
                    style={[
                      styles.xpEndDotOuter,
                      { left: xpLastPoint.x - 9, top: xpLastPoint.y - 9 },
                    ]}
                    pointerEvents="none"
                  >
                    <View style={styles.xpEndDotInner} />
                  </View>
                )}
              </View>
              <View style={styles.xStrip}>
                {xpXTicks.map((v, i) => (
                  <Text key={i} style={styles.tickLabel}>{v}</Text>
                ))}
              </View>
            </View>
          </View>
        </ChartCard>

        {/* Mission Rate — custom bar chart (Weekly Report style) with axes */}
        <SectionHeader title="Mission Rate" subLabel="Last 7 weeks" accentColors={MISSION_ACCENT} />
        <ChartCard>
          <View style={styles.chartWithAxes}>
            <View style={styles.yStrip}>
              {["100%", "75%", "50%", "25%", "0%"].map((v, i) => (
                <Text key={i} style={styles.tickLabel}>{v}</Text>
              ))}
            </View>
            <View style={styles.chartCol}>
              <View style={[styles.barChartRow, { height: 72 + 20 }]}>
                {data.mission_rate.map((w) => {
                  const pct = w.pct;
                  const heightPx = Math.max(4, (72 * pct) / 100);
                  const isHigh = pct >= 80;
                  return (
                    <View key={w.week} style={styles.barCol}>
                      <View style={styles.barColFillWrap}>
                        <LinearGradient
                          colors={isHigh ? ["#C084FC", "#8B5CF6"] : ["#8B5CF6", "#5B21B6"]}
                          start={{ x: 0.5, y: 1 }}
                          end={{ x: 0.5, y: 0 }}
                          style={[
                            styles.missionBar,
                            {
                              height: heightPx,
                              ...(Platform.OS === "ios"
                                ? {
                                    shadowColor: isHigh ? "rgba(192,132,252,0.4)" : "rgba(139,92,246,0.3)",
                                    shadowRadius: isHigh ? 10 : 6,
                                    shadowOffset: { width: 0, height: 2 },
                                  }
                                : { elevation: isHigh ? 6 : 4 }),
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
              <View style={styles.xStrip}>
                {data.mission_rate.map((w) => (
                  <Text key={w.week} style={styles.tickLabel}>{w.week}</Text>
                ))}
              </View>
            </View>
          </View>
          <View style={styles.targetRow}>
            <View style={styles.targetLineSample} />
            <Text style={styles.targetText}>80% target</Text>
          </View>
        </ChartCard>

        {/* Twin Gap */}
        <SectionHeader title="Twin Gap" subLabel="Lower is better" accentColors={GAP_ACCENT} />
        <ChartCard>
          <View style={styles.chartWithAxes}>
            <View style={styles.yStrip}>
              {[...gapYTicks].reverse().map((v, i) => (
                <Text key={i} style={styles.tickLabel}>{v}d</Text>
              ))}
            </View>
            <View style={[styles.chartCol, { marginBottom: 0 }]}>
              <View style={[styles.chartInner, { height: CHART_HEIGHT_GAP, width: chartAreaWidth }]}>
                <CartesianChart
                  data={data.twin_gap}
                  xKey="day"
                  yKeys={["gap"]}
                  axisOptions={{
                    tickCount: { x: 5, y: 4 },
                    lineColor: "rgba(42,48,80,0.25)",
                    lineWidth: { grid: 1, frame: 0 },
                  }}
                >
                  {({ points }) => (
                    <Line
                      points={points.gap}
                      color="#C084FC"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                  )}
                </CartesianChart>
              </View>
              <View style={styles.xStrip}>
                {gapXTicks.map((v, i) => (
                  <Text key={i} style={styles.tickLabel}>{v}</Text>
                ))}
              </View>
            </View>
          </View>
        </ChartCard>

        {/* This Week by Interest */}
        <SectionHeader title="This Week by Interest" accentColors={INTEREST_ACCENT} />
        <ChartCard>
          {data.interest_completion.map((item, i) => (
            <View
              key={item.interest_name}
              style={[
                styles.interestRowWrap,
                i === data.interest_completion.length - 1 && styles.interestRowWrapLast,
              ]}
            >
              <View style={styles.interestHeaderRow}>
                <Text style={styles.interestName}>{item.interest_name}</Text>
                <Text
                  style={[
                    styles.interestPct,
                    item.completion_pct < 60 && styles.interestPctMuted,
                  ]}
                >
                  {item.completion_pct}%
                </Text>
              </View>
              <View style={styles.interestTrack}>
                <View
                  style={[
                    styles.interestFillWrap,
                    { width: `${Math.min(100, item.completion_pct)}%` },
                  ]}
                >
                  <LinearGradient
                    colors={["#5B21B6", "#8B5CF6", "#C084FC"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.interestFill}
                  />
                </View>
              </View>
            </View>
          ))}
        </ChartCard>
      </ScrollView>
    </View>
  );
}

// -----------------------------------------------------------------------------
// STYLES
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "rgba(9,9,26,0.85)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.35)",
    gap: 12,
  },
  backBtn: {},
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionAccentBar: {
    width: 3,
    height: 14,
    borderRadius: 2,
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
  },
  sectionSub: {
    fontSize: 11,
    color: "#4B5563",
    marginLeft: "auto",
  },
  chartCard: {
    backgroundColor: "rgba(14,13,28,0.85)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.5)",
    borderRadius: 16,
    padding: 14,
    position: "relative",
    overflow: "hidden",
    marginBottom: 20,
  },
  chartCardAccent: {
    position: "absolute",
    top: 0,
    left: "15%",
    right: "15%",
    height: 1,
  },
  chartWithAxes: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  yStrip: {
    width: Y_LABEL_WIDTH,
    justifyContent: "space-between",
    paddingRight: 8,
    paddingTop: 2,
    paddingBottom: X_LABEL_HEIGHT + 2,
  },
  chartCol: {
    flex: 1,
    minWidth: 0,
    marginBottom: 4,
  },
  xStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginTop: 4,
    height: X_LABEL_HEIGHT,
  },
  tickLabel: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    color: "#374151",
  },
  chartInner: {
    overflow: "visible",
    borderRadius: 8,
    position: "relative",
  },
  xpEndDotOuter: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 6,
    borderColor: "rgba(139,92,246,0.30)",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  xpEndDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#8B5CF6",
  },
  barChartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 5,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
  },
  barColFillWrap: {
    width: "100%",
    height: 72,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  missionBar: {
    width: "100%",
    minHeight: 4,
    borderRadius: 5,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    overflow: "hidden",
  },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  targetLineSample: {
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#8B5CF6",
  },
  targetText: {
    fontSize: 10,
    color: "#6B7280",
  },
  interestRowWrap: {
    marginBottom: 14,
  },
  interestRowWrapLast: {
    marginBottom: 0,
  },
  interestHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  interestName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#E5E7EB",
  },
  interestPct: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#8B5CF6",
  },
  interestPctMuted: {
    color: "#A78BFA",
  },
  interestTrack: {
    height: 6,
    borderRadius: 6,
    backgroundColor: "rgba(30,35,51,0.9)",
    overflow: "hidden",
  },
  interestFillWrap: {
    height: "100%",
    borderRadius: 6,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(139,92,246,0.40)", shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }
      : { elevation: 6 }),
  },
  interestFill: {
    flex: 1,
    height: "100%",
    borderRadius: 6,
  },
});
