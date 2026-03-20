/**
 * Weekly Report Screen — Premium redesign. Tab 4.
 * Fixed header + ScrollView. 8 content blocks, bar chart, pet block, past reports.
 */

import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Rect, Path, Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { PetAnimation } from "../components/PetAnimation";
import { reportsService } from "@/services/reports";
import {
  mapRowToWeeklyReportData,
  currentWeeklyToRow,
} from "@/utils/weeklyReportMapper";
import type { PastReportSummary, WeeklyReportData } from "@/types/weeklyReportUi";
import { useUserStore } from "@/store/userStore";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BAR_CHART_HEIGHT = 80;
const BAR_MIN = 8;

// -----------------------------------------------------------------------------
// DATA SHAPE
// -----------------------------------------------------------------------------

export type { PastReportSummary, WeeklyReportData } from "@/types/weeklyReportUi";

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

function formatWeekRange(weekStart: string, weekEnd: string): string {
  try {
    const start = new Date(weekStart + "T00:00:00");
    const end = new Date(weekEnd + "T00:00:00");
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${start.getFullYear()}`;
  } catch {
    return `${weekStart} – ${weekEnd}`;
  }
}

function getDaysUntilSunday(): number {
  const now = new Date();
  const day = now.getDay();
  return day === 0 ? 0 : 7 - day;
}

function isSunday(): boolean {
  return new Date().getDay() === 0;
}

function weekEndFromStart(weekStart: string): string {
  try {
    const s = new Date(weekStart + "T00:00:00");
    s.setDate(s.getDate() + 6);
    return s.toISOString().slice(0, 10);
  } catch {
    return weekStart;
  }
}

// -----------------------------------------------------------------------------
// SVG CALENDAR ICON (Next report banner)
// -----------------------------------------------------------------------------

function IconCalendar() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Rect
        x={2}
        y={3}
        width={14}
        height={12}
        rx={2}
        stroke="#8B5CF6"
        strokeWidth={1.5}
        fill="none"
      />
      <Path d="M2 6h14" stroke="#8B5CF6" strokeWidth={1.5} />
      <Rect x={4} y={2} width={2} height={3} rx={0.5} fill="#8B5CF6" opacity={1} />
      <Rect x={12} y={2} width={2} height={3} rx={0.5} fill="#8B5CF6" opacity={0.6} />
      <Circle cx={6} cy={10} r={1} fill="#8B5CF6" opacity={1} />
      <Circle cx={9} cy={10} r={1} fill="#8B5CF6" opacity={0.6} />
      <Circle cx={12} cy={10} r={1} fill="#8B5CF6" opacity={0.3} />
    </Svg>
  );
}

// -----------------------------------------------------------------------------
// BAR CHART (Mon–Sun, daily_xp, best day highlighted)
// -----------------------------------------------------------------------------

function ReportBarChart({ daily_xp }: { daily_xp: number[] }) {
  const values = daily_xp.length >= 7 ? daily_xp.slice(0, 7) : [...daily_xp, ...Array(7 - daily_xp.length).fill(0)];
  const maxXp = Math.max(...values, 1);
  const bestIndex = values.findIndex((v) => v === maxXp);

  return (
    <View style={chartStyles.wrap}>
      <Text style={chartStyles.sectionLabel}>YOUR BEST DAYS</Text>
      <View style={chartStyles.chartRow}>
        {values.map((xp, i) => {
          const heightPx = Math.max(BAR_MIN, (xp / maxXp) * 72);
          const isBest = i === bestIndex;
          return (
            <View key={i} style={chartStyles.barCol}>
              <View style={chartStyles.barWrap}>
                <LinearGradient
                  colors={isBest ? ["#C084FC", "#8B5CF6"] : ["#8B5CF6", "#5B21B6"]}
                  start={{ x: 0.5, y: 1 }}
                  end={{ x: 0.5, y: 0 }}
                  style={[
                    chartStyles.bar,
                    {
                      height: heightPx,
                      ...(Platform.OS === "ios" && isBest
                        ? { shadowColor: "rgba(192,132,252,0.45)", shadowRadius: 12, shadowOffset: { width: 0, height: 2 } }
                        : {}),
                      ...(Platform.OS === "ios" && !isBest
                        ? { shadowColor: "rgba(139,92,246,0.30)", shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }
                        : {}),
                      ...(Platform.OS === "android" ? { elevation: isBest ? 6 : 4 } : {}),
                    },
                  ]}
                />
              </View>
              <Text style={chartStyles.dayLabel}>{DAY_LABELS[i]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  sectionLabel: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    color: "#374151",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 5,
    height: BAR_CHART_HEIGHT,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  barWrap: {
    width: "100%",
    height: 72,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bar: {
    width: "100%",
    minHeight: BAR_MIN,
    borderRadius: 5,
    overflow: "hidden",
  },
  dayLabel: {
    fontSize: 8,
    color: "#4B5563",
    letterSpacing: 0.3,
  },
});

// -----------------------------------------------------------------------------
// BLOCK DIVIDER
// -----------------------------------------------------------------------------

function BlockDivider() {
  return (
    <LinearGradient
      colors={["transparent", "rgba(42,48,80,0.7)", "transparent"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.blockDivider}
    />
  );
}

// -----------------------------------------------------------------------------
// MAIN REPORT CARD (all 8 blocks + next week + return)
// -----------------------------------------------------------------------------

export function ReportCard({
  data,
  onReturn,
}: {
  data: WeeklyReportData;
  onReturn: () => void;
}) {
  const powerChange = data.power_score_change;
  const powerChangeLabel =
    powerChange > 0 ? `↗ +${powerChange}` : powerChange < 0 ? `↘ ${powerChange}` : "↗ +0";
  const powerChangeColor = powerChange > 0 ? "#8B5CF6" : powerChange < 0 ? "#F87171" : "#4B5563";

  const gapGrew = data.gap_change > 0;
  const gapClosed = data.gap_change < 0;
  const gapLabel = gapGrew
    ? `↑ grew by ${data.gap_change} days`
    : gapClosed
      ? `↓ closed by ${Math.abs(data.gap_change)} days`
      : "— unchanged this week";
  const gapLabelColor = gapGrew ? "#F87171" : gapClosed ? "#8B5CF6" : "#6B7280";

  const petSubtext = data.pet_was_sad
    ? "Your companion struggled this week."
    : data.days_to_next_pet != null
      ? `${data.days_to_next_pet} days to ${data.pet_next_name}`
      : "Maximum stage reached";

  const petSubtextStyle = data.pet_was_sad ? { color: "#7F1D1D" } : { color: "#6B7280" };

  return (
    <View style={styles.mainCard}>
      <LinearGradient
        colors={["transparent", "rgba(139,92,246,0.3)", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.cardTopGlow}
      />
      <View style={styles.cardGlowWrap} pointerEvents="none">
        <Svg width={240} height={140} style={styles.cardGlowSvg}>
          <Defs>
            <RadialGradient id="cardGlow" cx="50%" cy="0%" r="100%">
              <Stop offset="0%" stopColor="rgba(80,20,160,0.18)" stopOpacity={1} />
              <Stop offset="45%" stopColor="rgba(80,20,160,0.06)" stopOpacity={1} />
              <Stop offset="100%" stopColor="rgba(80,20,160,0)" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={120} cy={-10} r={130} fill="url(#cardGlow)" />
        </Svg>
      </View>

      {/* Block 1: Power Score */}
      <View style={styles.block}>
        <View style={styles.powerScoreRow}>
          <Text style={styles.blockLabel}>POWER SCORE</Text>
          <Text style={[styles.powerChange, { color: powerChangeColor }]}>{powerChangeLabel}</Text>
        </View>
        <Text style={styles.powerScoreValue}>{data.power_score.toLocaleString()}</Text>
      </View>
      <BlockDivider />

      {/* Block 2: Streak + bar chart */}
      <View style={styles.block}>
        <View style={styles.streakRow}>
          <Text style={styles.streakTitle}>🔥 {data.streak_current} day streak</Text>
        </View>
        <Text style={styles.streakSub}>Longest this month: {data.streak_longest_month} days</Text>
        <ReportBarChart daily_xp={data.daily_xp} />
      </View>
      <BlockDivider />

      {/* Block 3: Pet companion */}
      <View style={styles.block}>
        <View style={styles.petRow}>
          <View style={styles.petCircle}>
            <PetAnimation
              stage={Math.min(8, Math.max(1, data.pet_stage))}
              isHappy={!data.pet_was_sad}
              size={48}
            />
          </View>
          <View style={styles.petTextCol}>
            <Text style={styles.petName}>{data.pet_name} · Stage {data.pet_stage}</Text>
            <Text style={[styles.petSubtext, petSubtextStyle]}>{petSubtext}</Text>
          </View>
        </View>
      </View>
      <BlockDivider />

      {/* Block 4: Gap movement */}
      <View style={styles.block}>
        <Text style={styles.blockLabel}>GAP MOVEMENT</Text>
        <Text style={styles.gapValue}>Gap: {data.gap_days} days</Text>
        <Text style={[styles.gapChange, { color: gapLabelColor }]}>{gapLabel}</Text>
      </View>
      <BlockDivider />

      {/* Block 5: Oracle narrative */}
      <View style={styles.block}>
        <Text style={styles.blockLabel}>THIS WEEK</Text>
        <Text style={styles.narrative}>{data.narrative}</Text>
      </View>
      <BlockDivider />

      {/* Block 6: One Win */}
      <View style={styles.winBlock}>
        <Text style={styles.winBlockLabel}>ONE WIN THIS WEEK</Text>
        <Text style={styles.winBlockText}>{data.one_win}</Text>
      </View>
      <BlockDivider />

      {/* Block 7: One Focus */}
      <View style={styles.focusBlock}>
        <Text style={styles.focusBlockLabel}>ONE FOCUS FOR NEXT WEEK</Text>
        <Text style={styles.focusBlockText}>{data.one_focus}</Text>
      </View>
      <BlockDivider />

      {/* Block 8: Twin message */}
      <View style={styles.twinBlock}>
        <View style={styles.twinAvatar}>
          <Text style={styles.twinAvatarText}>T</Text>
        </View>
        <Text style={styles.twinMessage}>{data.twin_message}</Text>
      </View>
      <BlockDivider />

      {/* Next week note */}
      <View style={styles.block}>
        <Text style={styles.blockLabel}>NEXT WEEK</Text>
        <Text style={styles.narrative}>{data.next_week_note}</Text>
      </View>

      {/* Return button */}
      <Pressable onPress={onReturn} style={({ pressed }) => [styles.returnBtn, pressed && styles.returnBtnPressed]}>
        <Text style={styles.returnBtnLabel}>Return</Text>
      </Pressable>
    </View>
  );
}

// -----------------------------------------------------------------------------
// EMPTY STATE CARD
// -----------------------------------------------------------------------------

function EmptyStateCard() {
  const days = getDaysUntilSunday();
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="calendar-outline" size={48} color="#1E2333" />
      <Text style={styles.emptyTitle}>Your report arrives Sunday.</Text>
      <Text style={styles.emptySub}>{days} days remaining</Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// SCREEN
// -----------------------------------------------------------------------------

export function WeeklyReportScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);
  const pastReportsRef = useRef<View>(null);

  const [data, setData] = useState<WeeklyReportData | null>(null);
  const [pastSummaries, setPastSummaries] = useState<PastReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pastSectionY, setPastSectionY] = useState(0);

  const isSun = isSunday();
  const daysUntilSun = getDaysUntilSunday();
  const weekRange = data ? formatWeekRange(data.week_start, data.week_end) : "—";

  const fetchReport = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      let pastList: PastReportSummary[] = [];
      try {
        const prev = await reportsService.getPreviousWeekly();
        if (prev.available && "id" in prev && (prev as { id?: string }).id) {
          const p = prev as {
            id: string;
            week_start: string;
            week_end?: string;
            this_week_data?: { current_streak?: number };
          };
          pastList = [
            {
              report_id: String(p.id),
              week_start: p.week_start,
              week_end: p.week_end ?? weekEndFromStart(p.week_start),
              power_score: 0,
              streak: p.this_week_data?.current_streak ?? 0,
            },
          ];
        }
      } catch {
        /* optional */
      }

      const current = await reportsService.getCurrentWeekly();
      const profilePs = useUserStore.getState().profile?.power_score;

      if (!current.available) {
        setData(null);
        setPastSummaries(pastList);
        return;
      }

      const c = current as Record<string, unknown>;
      const row = currentWeeklyToRow(c, String(c.week_start ?? "current"));
      const mapped = mapRowToWeeklyReportData(row, pastList);
      if (typeof profilePs === "number") {
        mapped.power_score = profilePs;
      }
      setData(mapped);
      setPastSummaries(pastList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load report");
      setData(null);
      setPastSummaries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchReport();
    }, [fetchReport])
  );

  const scrollToPastReports = () => {
    scrollRef.current?.scrollTo({ y: Math.max(0, pastSectionY - 60), animated: true });
  };

  const handleReturn = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handlePastReportPress = (summary: PastReportSummary) => {
    (navigation.getParent() as any)?.navigate("PastReportDetail", { report_id: summary.report_id });
  };

  const hasReport = data != null;
  const showBanner = !(isSun && hasReport); // hide only when Sunday and report is available

  if (loading && !data) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#09091A", "#07080F"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.header, { paddingTop: insets.top + 10, paddingBottom: 14 }]}>
          <Text style={styles.headerTitle}>Weekly Report</Text>
          <Text style={styles.headerSubtitle}>Loading…</Text>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#09091A", "#07080F"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + 10, paddingBottom: 14 }]}>
        <Text style={styles.headerTitle}>Weekly Report</Text>
        <View style={styles.headerSubtitleRow}>
          <Text style={styles.headerSubtitle}>{weekRange}</Text>
          <Text style={styles.headerSubtitle}> · </Text>
          <Pressable onPress={scrollToPastReports} hitSlop={8}>
            <Text style={styles.headerLink}>View past reports</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 80 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={fetchReport} style={styles.retryBtn}>
              <Text style={styles.retryLabel}>Retry</Text>
            </Pressable>
          </View>
        )}

        {showBanner && (
          <View style={styles.nextReportBanner}>
            <View style={styles.nextReportIconBox}>
              <IconCalendar />
            </View>
            <View style={styles.nextReportTextCol}>
              <Text style={styles.nextReportTitle}>Next report</Text>
              <Text style={styles.nextReportSub}>
                Arrives Sunday evening
                {daysUntilSun > 0 && ` · In ${daysUntilSun} days`}
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionLabel}>THIS WEEK</Text>

        {!hasReport && (
          <EmptyStateCard />
        )}

        {hasReport && data && (
          <ReportCard data={data} onReturn={handleReturn} />
        )}

        <View
          ref={pastReportsRef}
          style={styles.pastSection}
          onLayout={(e) => setPastSectionY(e.nativeEvent.layout.y)}
        >
          <Text style={styles.sectionLabel}>PAST REPORTS</Text>
          {pastSummaries.length === 0 ? (
            <Text style={styles.noPastText}>No past reports yet.</Text>
          ) : (
            pastSummaries.map((p) => (
              <Pressable
                key={p.report_id}
                style={({ pressed }) => [styles.pastRow, pressed && styles.pastRowPressed]}
                onPress={() => handlePastReportPress(p)}
              >
                <View>
                  <Text style={styles.pastRowTitle}>
                    {formatWeekRange(p.week_start, p.week_end)}
                  </Text>
                  <Text style={styles.pastRowSub}>
                    {p.power_score} PS · {p.streak} day streak
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color="#2D3146" />
              </Pressable>
            ))
          )}
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
  header: {
    alignItems: "center",
    backgroundColor: "rgba(9,9,26,0.85)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.35)",
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
    letterSpacing: -0.3,
  },
  headerSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
  },
  headerLink: {
    fontSize: 12,
    color: "#8B5CF6",
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  nextReportBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(139,92,246,0.07)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.15)",
    borderRadius: 14,
    padding: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  nextReportIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(139,92,246,0.12)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  nextReportTextCol: { flex: 1 },
  nextReportTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#E5E7EB",
  },
  nextReportSub: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 1,
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    color: "#374151",
    textTransform: "uppercase",
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  mainCard: {
    backgroundColor: "rgba(14,13,28,0.85)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.5)",
    borderRadius: 20,
    padding: 20,
    position: "relative",
    overflow: "hidden",
    marginBottom: 16,
  },
  cardTopGlow: {
    position: "absolute",
    top: 0,
    left: "15%",
    right: "15%",
    height: 1,
  },
  cardGlowWrap: {
    position: "absolute",
    top: -50,
    left: "50%",
    marginLeft: -120,
    width: 240,
    height: 140,
    overflow: "hidden",
  },
  cardGlowSvg: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  blockDivider: {
    height: 1,
    marginVertical: 16,
  },
  block: { marginBottom: 0 },
  blockLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    color: "#4B5563",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  powerScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  powerChange: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  powerScoreValue: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
    letterSpacing: -1,
    marginTop: 4,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  streakTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
  },
  streakSub: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
    marginBottom: 12,
  },
  petRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  petCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(139,92,246,0.38)",
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(109,40,217,0.22)", shadowRadius: 16, shadowOffset: { width: 0, height: 0 } }
      : { elevation: 8 }),
  },
  petTextCol: { flex: 1 },
  petName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#E5E7EB",
    marginBottom: 3,
  },
  petSubtext: { fontSize: 12 },
  gapValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#C084FC",
    marginBottom: 3,
  },
  gapChange: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  narrative: {
    fontSize: 13,
    color: "#9CA3AF",
    lineHeight: 20.8,
  },
  winBlock: {
    backgroundColor: "rgba(139,92,246,0.06)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.14)",
    borderLeftWidth: 3,
    borderLeftColor: "#8B5CF6",
    borderRadius: 12,
    padding: 12,
    paddingHorizontal: 14,
  },
  winBlockLabel: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    color: "#8B5CF6",
    textTransform: "uppercase",
    marginBottom: 5,
  },
  winBlockText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#E5E7EB",
    lineHeight: 19.5,
  },
  focusBlock: {
    backgroundColor: "rgba(109,40,217,0.05)",
    borderWidth: 1,
    borderColor: "rgba(109,40,217,0.12)",
    borderLeftWidth: 3,
    borderLeftColor: "#6D28D9",
    borderRadius: 12,
    padding: 12,
    paddingHorizontal: 14,
  },
  focusBlockLabel: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    color: "#6D28D9",
    textTransform: "uppercase",
    marginBottom: 5,
  },
  focusBlockText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    lineHeight: 19.5,
  },
  twinBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(192,132,252,0.05)",
    borderWidth: 1,
    borderColor: "rgba(192,132,252,0.12)",
    borderRadius: 12,
    padding: 12,
    paddingHorizontal: 14,
  },
  twinAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(20,15,50,0.9)",
    borderWidth: 1,
    borderColor: "rgba(192,132,252,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  twinAvatarText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "rgba(192,132,252,0.7)",
  },
  twinMessage: {
    flex: 1,
    fontSize: 13,
    color: "#C4B5FD",
    fontStyle: "italic",
    lineHeight: 19.5,
  },
  returnBtn: {
    height: 48,
    borderRadius: 14,
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  returnBtnPressed: { opacity: 0.9 },
  returnBtnLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#6B7280",
  },
  pastSection: { marginBottom: 24 },
  pastRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111623",
    borderWidth: 1,
    borderColor: "#1A1F30",
    borderRadius: 14,
    padding: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  pastRowPressed: { opacity: 0.9 },
  pastRowTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#E5E7EB",
  },
  pastRowSub: {
    fontSize: 11,
    color: "#4B5563",
    marginTop: 2,
  },
  noPastText: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 8,
  },
  emptyCard: {
    backgroundColor: "rgba(14,13,28,0.85)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.5)",
    borderRadius: 20,
    padding: 40,
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#E5E7EB",
    marginBottom: 8,
  },
  emptySub: { fontSize: 13, color: "#6B7280" },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorBanner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "rgba(127,29,29,0.15)",
    borderRadius: 12,
  },
  errorText: { fontSize: 13, color: "#F87171" },
  retryBtn: { marginTop: 8 },
  retryLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#8B5CF6" },
});
