/**
 * Weekly Report Screen — Part 3B Screen 20. Tab 4.
 * Past reports saved; new report on top when Sunday. Next report countdown on non-Sunday.
 * Tap a past report to view full report (compare weeks).
 */

import React, { useState, useMemo } from "react";
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
import { PetAnimation } from "../components/PetAnimation";
import { SecondaryButton } from "../components/SecondaryButton";
import {
  COLORS,
  SPACING,
  GRADIENTS,
  HEATMAP_LEVELS,
} from "../constants/theme";

const HEADER_HEIGHT = 56;
const CARD_RADIUS = 24;
const CARD_PADDING = 24;
const BLOCK_GAP = 20;
const MINI_CELL_SIZE = 16;
const MINI_CELL_GAP = 3;
const CONTENT_PADDING_BOTTOM = 96;

export type ReportData = {
  powerDelta: number;
  powerScore: number;
  streak: number;
  longestThisMonth: number;
  miniLevels: number[];
  petStage: number;
  petHappy: boolean;
  petStageName: string;
  petSubtext: string;
  gapDays: number;
  gapClosed: boolean;
  narrative: string;
  winText: string;
  focusText: string;
  twinMessage: string;
};

export type SavedReport = {
  id: string;
  weekLabel: string;
  weekKey: string;
  data: ReportData;
};

function getDaysUntilSunday(): number {
  const now = new Date();
  const day = now.getDay();
  return day === 0 ? 0 : 7 - day;
}

function getNextSundayLabel(): { days: number; label: string } {
  const now = new Date();
  const day = now.getDay();
  const days = day === 0 ? 7 : 7 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + days);
  const label = next.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  return { days, label };
}

/** Mini 7-day heatmap row */
function MiniHeatmap({ levels }: { levels: number[] }) {
  const list = levels.length >= 7 ? levels.slice(-7) : [...Array(7).fill(0), ...levels].slice(-7);
  return (
    <View style={miniHeatmapStyles.row}>
      {list.map((level, i) => (
        <View
          key={i}
          style={[
            miniHeatmapStyles.cell,
            {
              width: MINI_CELL_SIZE,
              height: MINI_CELL_SIZE,
              borderRadius: 3,
              backgroundColor: HEATMAP_LEVELS[Math.min(4, Math.max(0, level))],
            },
          ]}
        />
      ))}
    </View>
  );
}

const miniHeatmapStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: MINI_CELL_GAP, marginTop: 8 },
  cell: {},
});

/** Single report card (8 blocks). Reused for list detail and for "This week". */
function ReportCard({
  data,
  showReturnButton,
  onReturn,
}: {
  data: ReportData;
  showReturnButton?: boolean;
  onReturn?: () => void;
}) {
  const {
    powerDelta,
    powerScore,
    streak,
    longestThisMonth,
    miniLevels,
    petStage,
    petHappy,
    petStageName,
    petSubtext,
    gapDays,
    gapClosed,
    narrative,
    winText,
    focusText,
    twinMessage,
  } = data;

  return (
    <View style={reportCardStyles.card}>
      <View style={reportCardStyles.block}>
        <View style={reportCardStyles.powerScoreRow}>
          <Text style={reportCardStyles.blockLabel}>POWER SCORE</Text>
          <View style={reportCardStyles.deltaRow}>
            <Ionicons name="trending-up" size={14} color={COLORS.violet} />
            <Text style={[reportCardStyles.deltaPositive, { marginLeft: 4 }]}>
              +{powerDelta}
            </Text>
          </View>
        </View>
        <Text style={reportCardStyles.powerScoreValue}>{powerScore.toLocaleString()}</Text>
        <View style={reportCardStyles.divider} />
      </View>

      <View style={reportCardStyles.block}>
        <View style={reportCardStyles.streakRow}>
          <Text style={reportCardStyles.streakTitle}>🔥{streak} day streak</Text>
        </View>
        <Text style={reportCardStyles.streakSub}>Longest this month: {longestThisMonth} days</Text>
        <MiniHeatmap levels={miniLevels} />
      </View>

      <View style={reportCardStyles.block}>
        <View style={reportCardStyles.petRow}>
          <PetAnimation stage={petStage} isHappy={petHappy} size={48} />
          <View style={reportCardStyles.petTextCol}>
            <Text style={reportCardStyles.petStageName}>{petStageName}</Text>
            <Text style={reportCardStyles.petSubtext}>{petSubtext}</Text>
          </View>
        </View>
      </View>

      <View style={reportCardStyles.block}>
        <Text style={reportCardStyles.blockLabel}>GAP MOVEMENT</Text>
        <Text style={reportCardStyles.gapValue}>Gap: {gapDays} days</Text>
        <Text
          style={[
            reportCardStyles.gapChange,
            gapClosed ? reportCardStyles.gapClosed : reportCardStyles.gapGrew,
          ]}
        >
          {gapClosed ? "↓ closed by 1 day" : "↑ grew by 2 days"}
        </Text>
      </View>

      <View style={reportCardStyles.block}>
        <Text style={reportCardStyles.blockLabel}>THIS WEEK</Text>
        <Text style={reportCardStyles.narrative}>{narrative}</Text>
      </View>

      <View style={[reportCardStyles.highlightBlock, reportCardStyles.winBlock]}>
        <Text style={reportCardStyles.winLabel}>ONE WIN THIS WEEK</Text>
        <Text style={reportCardStyles.winText}>{winText}</Text>
      </View>

      <View style={[reportCardStyles.highlightBlock, reportCardStyles.focusBlock]}>
        <Text style={reportCardStyles.focusLabel}>ONE FOCUS FOR NEXT WEEK</Text>
        <Text style={reportCardStyles.focusText}>{focusText}</Text>
      </View>

      <View style={reportCardStyles.block}>
        <View style={reportCardStyles.twinMessageRow}>
          <View style={reportCardStyles.twinThumb} />
          <Text style={reportCardStyles.twinMessage}>{twinMessage}</Text>
        </View>
      </View>

      {showReturnButton && onReturn && (
        <SecondaryButton label="Return" onPress={onReturn} width={200} style={reportCardStyles.returnBtn} />
      )}
    </View>
  );
}

const reportCardStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
    marginBottom: SPACING.lg,
  },
  block: { marginBottom: BLOCK_GAP },
  blockLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: COLORS.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  powerScoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  deltaRow: { flexDirection: "row", alignItems: "center" },
  deltaPositive: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: COLORS.violet },
  powerScoreValue: { fontFamily: "Inter_700Bold", fontSize: 32, color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.surface2, marginTop: 8 },
  streakRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  streakTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: COLORS.text },
  streakSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: COLORS.muted, marginTop: 4 },
  petRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  petTextCol: { flex: 1 },
  petStageName: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: COLORS.text },
  petSubtext: { fontFamily: "Inter_400Regular", fontSize: 13, color: COLORS.muted, marginTop: 2 },
  gapValue: { fontFamily: "Inter_700Bold", fontSize: 18, color: COLORS.violetLine, marginTop: 4 },
  gapChange: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
  gapClosed: { color: COLORS.violet },
  gapGrew: { color: COLORS.danger },
  narrative: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 26,
    marginTop: 8,
  },
  highlightBlock: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: BLOCK_GAP,
    borderLeftWidth: 3,
  },
  winBlock: { backgroundColor: "rgba(139, 92, 246, 0.06)", borderLeftColor: COLORS.violet },
  focusBlock: { backgroundColor: "rgba(109, 40, 217, 0.06)", borderLeftColor: COLORS.violetDeep },
  winLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: COLORS.violet,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  winText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: COLORS.text },
  focusLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: COLORS.violetDeep,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  focusText: { fontFamily: "Inter_400Regular", fontSize: 15, color: COLORS.text2 },
  twinMessageRow: { flexDirection: "row", alignItems: "flex-start" },
  twinThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surface2,
    marginRight: 12,
  },
  twinMessage: { fontFamily: "Inter_400Regular", fontSize: 15, color: COLORS.text, fontStyle: "italic" },
  returnBtn: { marginTop: 8 },
});

function createReportData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    powerDelta: 340,
    powerScore: 1580,
    streak: 12,
    longestThisMonth: 14,
    miniLevels: [2, 3, 4, 3, 4, 4, 3],
    petStage: 3,
    petHappy: true,
    petStageName: "Fox",
    petSubtext: "12 days to Wolf",
    gapDays: 7,
    gapClosed: true,
    narrative:
      "You completed 18 of 21 missions this week. Your streak held. The gap with your Twin closed by a single day — the first time it has moved in your favour. Small, but real.",
    winText: "You completed your hardest mission 5 days in a row.",
    focusText:
      "Complete every system mission before 12pm. You've been letting them slide to evening.",
    twinMessage: "One day closer. Not enough. But it's something.",
    ...overrides,
  };
}

/** Placeholder saved reports (in real app from backend). Most recent first. */
function getSeedReports(isSunday: boolean): SavedReport[] {
  const base: SavedReport[] = [
    {
      id: "r1",
      weekKey: "2026-03-02",
      weekLabel: "Feb 24 – Mar 2, 2026",
      data: createReportData({ powerScore: 1580, streak: 12 }),
    },
    {
      id: "r2",
      weekKey: "2026-02-23",
      weekLabel: "Feb 17 – Feb 23, 2026",
      data: createReportData({ powerScore: 1240, streak: 9, gapClosed: false }),
    },
    {
      id: "r3",
      weekKey: "2026-02-16",
      weekLabel: "Feb 10 – Feb 16, 2026",
      data: createReportData({ powerScore: 1120, streak: 5 }),
    },
  ];
  if (isSunday) {
    const now = new Date();
    const sun = new Date(now);
    const mon = new Date(sun);
    mon.setDate(sun.getDate() - 6);
    const weekLabel = `${mon.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${sun.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${sun.getFullYear()}`;
    return [
      {
        id: "this-week",
        weekKey: sun.toISOString().slice(0, 10).replace(/-/g, "-"),
        weekLabel,
        data: createReportData(),
      },
      ...base,
    ];
  }
  return base;
}

export function WeeklyReportScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const now = new Date();
  const isSunday = now.getDay() === 0;
  const { days: daysUntilSunday, label: nextSundayLabel } = getNextSundayLabel();

  const [reports] = useState<SavedReport[]>(() => getSeedReports(isSunday));
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);

  const handleReturnToList = () => {
    (navigation as any).navigate("Home");
  };

  const handleBackFromDetail = () => {
    setSelectedReport(null);
  };

  if (selectedReport) {
    return (
      <LinearGradient
        colors={GRADIENTS.background.colors}
        start={GRADIENTS.background.start}
        end={GRADIENTS.background.end}
        style={styles.container}
      >
        <View
          style={[
            styles.header,
            styles.headerWithBack,
            { paddingTop: insets.top, height: insets.top + HEADER_HEIGHT },
          ]}
        >
          <View style={styles.headerGlass} />
          <Pressable
            onPress={handleBackFromDetail}
            style={styles.backButton}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Weekly Report</Text>
            <Text style={styles.headerSubtitle}>{selectedReport.weekLabel}</Text>
          </View>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: CONTENT_PADDING_BOTTOM + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <ReportCard
            data={selectedReport.data}
            showReturnButton
            onReturn={handleBackFromDetail}
          />
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={GRADIENTS.background.colors}
      start={GRADIENTS.background.start}
      end={GRADIENTS.background.end}
      style={styles.container}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, height: insets.top + HEADER_HEIGHT },
        ]}
      >
        <View style={styles.headerGlass} />
        <Text style={styles.headerTitle}>Weekly Report</Text>
        <Text style={styles.headerSubtitle}>
          {isSunday ? "Your latest report is below" : "View past reports"}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: CONTENT_PADDING_BOTTOM + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!isSunday && (
          <View style={styles.nextReportBanner}>
            <Ionicons name="calendar-outline" size={20} color={COLORS.violet} />
            <View style={styles.nextReportTextWrap}>
              <Text style={styles.nextReportTitle}>Next report</Text>
              <Text style={styles.nextReportSub}>
                {daysUntilSunday === 0
                  ? "Today"
                  : daysUntilSunday === 1
                    ? "Tomorrow"
                    : `In ${daysUntilSunday} days`}
                {daysUntilSunday <= 1 ? "" : ` — ${nextSundayLabel}`}
              </Text>
            </View>
          </View>
        )}

        {isSunday && reports.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>THIS WEEK</Text>
            <ReportCard data={reports[0].data} />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PAST REPORTS</Text>
          {(isSunday ? reports.slice(1) : reports).map((report) => (
            <Pressable
              key={report.id}
              style={({ pressed }) => [styles.pastReportRow, pressed && styles.pastReportRowPressed]}
              onPress={() => setSelectedReport(report)}
            >
              <Text style={styles.pastReportWeek}>{report.weekLabel}</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: "relative",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 8,
    paddingHorizontal: SPACING.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerWithBack: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  headerGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.glass,
  },
  backButton: {
    marginRight: 8,
    paddingBottom: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 4,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: COLORS.text,
  },
  headerSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: SPACING.screenPadding,
  },
  nextReportBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: SPACING.lg,
    gap: 12,
  },
  nextReportTextWrap: { flex: 1 },
  nextReportTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: COLORS.text,
  },
  nextReportSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },
  section: { marginBottom: SPACING.lg },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: COLORS.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  pastReportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surface2,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  pastReportRowPressed: {
    backgroundColor: COLORS.surface2,
  },
  pastReportWeek: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: COLORS.text,
  },
});
