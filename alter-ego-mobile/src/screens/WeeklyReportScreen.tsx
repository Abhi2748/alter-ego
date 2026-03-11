/**
 * Weekly Report Screen — Part 3B Screen 20. Tab 4.
 * Fetches GET /api/v1/agents/weekly-report on tab focus. Maps sections to UI.
 * Empty state when no report; loading + error/retry.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { PetAnimation } from "../components/PetAnimation";
import { SecondaryButton } from "../components/SecondaryButton";
import {
  COLORS,
  SPACING,
  GRADIENTS,
} from "../constants/theme";
import { supabase } from "../utils/supabase";
import { getWeeklyReport, type WeeklyReportRow } from "../utils/api";

const HEADER_HEIGHT = 56;
const CARD_RADIUS = 24;
const CARD_PADDING = 24;
const BLOCK_GAP = 20;
const CONTENT_PADDING_BOTTOM = 96;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CHART_HEIGHT = 120;

export type ReportData = {
  powerDelta: number;
  powerScore: number;
  streak: number;
  longestThisMonth: number;
  /** Completion % per day Mon–Sun (0–100). Used for day-of-week bar chart. */
  dayOfWeekCompletion: number[];
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
  /** Section 5: Next week (one sentence). */
  nextWeek?: string;
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

/** Day-of-week completion bar chart. 7 bars Mon–Sun, best day highlighted. */
function DayOfWeekChart({ data }: { data: number[] }) {
  const values = data.length >= 7 ? data.slice(0, 7) : [...data, ...Array(7 - data.length).fill(0)];
  const maxVal = Math.max(...values, 1);
  const bestDayIndex = values.indexOf(maxVal);

  return (
    <View style={dayChartStyles.wrap}>
      <Text style={dayChartStyles.sectionLabel}>YOUR BEST DAYS</Text>
      <View style={dayChartStyles.chartRow}>
        {values.map((pct, i) => {
          const heightPct = Math.min(100, Math.max(0, pct)) / 100;
          const isBest = i === bestDayIndex;
          return (
            <View key={i} style={dayChartStyles.barCol}>
              <View style={dayChartStyles.track}>
                <View
                  style={[
                    dayChartStyles.barFillWrap,
                    { height: `${heightPct * 100}%` },
                  ]}
                >
                  {isBest ? (
                    <View
                      style={[
                        dayChartStyles.barFill,
                        { backgroundColor: COLORS.violet },
                      ]}
                    />
                  ) : (
                    <LinearGradient
                      colors={[COLORS.violetDeep, COLORS.violet]}
                      start={{ x: 0.5, y: 1 }}
                      end={{ x: 0.5, y: 0 }}
                      style={dayChartStyles.barFill}
                    />
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>
      <View style={dayChartStyles.labelsRow}>
        {DAY_LABELS.map((label, i) => (
          <View key={i} style={dayChartStyles.labelCol}>
            <Text style={dayChartStyles.dayLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const dayChartStyles = StyleSheet.create({
  wrap: { marginTop: 12 },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.muted,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: CHART_HEIGHT,
    gap: 4,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    minWidth: 0,
  },
  track: {
    width: "100%",
    height: CHART_HEIGHT,
    backgroundColor: COLORS.surface2,
    borderRadius: 4,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFillWrap: {
    width: "100%",
    minHeight: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    flex: 1,
    borderRadius: 4,
  },
  labelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
    marginTop: 6,
  },
  labelCol: {
    flex: 1,
    alignItems: "center",
    minWidth: 0,
  },
  dayLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: COLORS.muted,
  },
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
    dayOfWeekCompletion,
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
    nextWeek,
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
        <DayOfWeekChart data={dayOfWeekCompletion} />
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

      {nextWeek ? (
        <View style={reportCardStyles.block}>
          <Text style={reportCardStyles.blockLabel}>NEXT WEEK</Text>
          <Text style={reportCardStyles.narrative}>{nextWeek}</Text>
        </View>
      ) : null}

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

/** Map API weekly report row to ReportData for ReportCard. */
function mapReportToData(row: WeeklyReportRow): ReportData {
  const d = row.this_week_data ?? {};
  const missionsCompleted = d.missions_completed ?? 0;
  const missionsTotal = d.missions_total ?? 0;
  const coreComplete = d.core_days_complete ?? 0;
  const coreTotal = d.core_days_total ?? 0;
  const xp = d.xp_earned ?? 0;
  const pf = d.pet_food_earned ?? 0;
  const streak = d.current_streak ?? 0;
  const streakStatus = d.streak_status ?? "";
  const stageName = d.character_stage_name ?? "—";
  const stageChange = d.stage_change_this_week ?? "";
  const petName = d.pet_name ?? "—";
  const petStage = d.pet_stage ?? 0;
  const petChange = d.pet_change_this_week ?? "";
  const narrativeParts: string[] = [];
  if (missionsTotal > 0) {
    narrativeParts.push(`You completed ${missionsCompleted} of ${missionsTotal} missions this week.`);
  }
  narrativeParts.push(`Core: ${coreComplete} of ${coreTotal} days complete.`);
  narrativeParts.push(`${xp} XP earned this week. ${pf} Pet Food earned.`);
  if (streakStatus === "BROKEN_AND_RESET") {
    narrativeParts.push(`Streak reset this week. Current: ${streak} days.`);
  } else {
    narrativeParts.push(`Current streak: ${streak} days.`);
  }
  narrativeParts.push(stageChange && stageChange !== "NO" ? `Stage upgraded this week: ${stageName}.` : `Stage: ${stageName} (Stage ${d.character_stage ?? 1}).`);
  narrativeParts.push(petChange && petChange !== "NO" ? `Pet evolved this week: ${petName}.` : `Pet: ${petName} (Stage ${petStage}).`);
  const wins = row.wins ?? [];
  const slipped = row.slipped ?? [];
  const focusContent = row.keep_watching ?? slipped[0] ?? "";
  const twinParagraph = row.twin_paragraph ?? "";
  const twinClosing = row.twin_closing ?? "";
  return {
    powerDelta: 0,
    powerScore: 0,
    streak,
    longestThisMonth: streak,
    dayOfWeekCompletion: d.day_of_week_completion ?? [0, 0, 0, 0, 0, 0, 0],
    petStage,
    petHappy: true,
    petStageName: petName,
    petSubtext: petChange && petChange !== "NO" ? petChange : "",
    gapDays: 0,
    gapClosed: false,
    narrative: narrativeParts.join(" "),
    winText: wins.length > 0 ? wins.join(" ") : "—",
    focusText: focusContent,
    twinMessage: [twinParagraph, twinClosing].filter(Boolean).join("\n") || "—",
    nextWeek: row.next_week ?? undefined,
  };
}

function formatWeekLabel(weekStart: string): string {
  try {
    const start = new Date(weekStart + "T00:00:00");
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${start.getFullYear()}`;
  } catch {
    return weekStart;
  }
}

export function WeeklyReportScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const now = new Date();
  const isSunday = now.getDay() === 0;
  const { days: daysUntilSunday, label: nextSundayLabel } = getNextSundayLabel();

  const [report, setReport] = useState<WeeklyReportRow | null>(null);
  const [lastWeek, setLastWeek] = useState<WeeklyReportRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);

  const fetchReport = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setReport(null);
        setLastWeek(null);
        return;
      }
      const res = await getWeeklyReport(session.access_token);
      setReport(res.report ?? null);
      setLastWeek(res.last_week ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load report");
      setReport(null);
      setLastWeek(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchReport();
    }, [fetchReport])
  );

  const handleReturnToList = () => {
    (navigation as any).navigate("Home");
  };

  const handleBackFromDetail = () => {
    setSelectedReport(null);
  };

  const reports: SavedReport[] = [];
  if (report) {
    reports.push({
      id: report.id,
      weekKey: report.week_start,
      weekLabel: formatWeekLabel(report.week_start),
      data: mapReportToData(report),
    });
  }
  if (lastWeek) {
    reports.push({
      id: lastWeek.id,
      weekKey: lastWeek.week_start,
      weekLabel: formatWeekLabel(lastWeek.week_start),
      data: mapReportToData(lastWeek),
    });
  }
  const hasReport = report != null;
  const pastReports = reports.slice(1);

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
        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.violet} />
            <Text style={styles.loadingText}>Loading report…</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{error}</Text>
            <SecondaryButton label="Retry" onPress={fetchReport} width={160} />
          </View>
        )}

        {!loading && !error && !hasReport && (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={40} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>Weekly Report</Text>
            <Text style={styles.emptySub}>
              After your first week, we’ll generate a report every Monday (Mon–Sun). Here you'll see wins, slip-ups, and your Twin's take. Your first report appears after your first full week.
            </Text>
          </View>
        )}

        {!loading && !error && hasReport && (
          <>
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

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>THIS WEEK</Text>
              <ReportCard data={reports[0].data} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PAST REPORTS</Text>
              {pastReports.length === 0 ? (
                <Text style={styles.noPastText}>No past reports yet.</Text>
              ) : (
                pastReports.map((r) => (
                  <Pressable
                    key={r.id}
                    style={({ pressed }) => [styles.pastReportRow, pressed && styles.pastReportRowPressed]}
                    onPress={() => setSelectedReport(r)}
                  >
                    <Text style={styles.pastReportWeek}>{r.weekLabel}</Text>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
                  </Pressable>
                ))
              )}
            </View>
          </>
        )}
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
  loadingWrap: {
    paddingVertical: SPACING.xxl,
    alignItems: "center",
    gap: SPACING.md,
  },
  loadingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.muted,
  },
  errorWrap: {
    paddingVertical: SPACING.xl,
    alignItems: "center",
    gap: SPACING.md,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.text2,
    textAlign: "center",
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
    alignItems: "center",
    gap: SPACING.md,
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: COLORS.text,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.muted,
    textAlign: "center",
  },
  noPastText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 8,
  },
});
