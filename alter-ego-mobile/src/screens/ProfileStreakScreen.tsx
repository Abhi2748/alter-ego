/**
 * Profile → Streak. Premium streak display: big flame number, pet companion,
 * monthly calendar, stat cards, streak freezes.
 * No 52-week heatmap — monthly calendar is the primary view.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Dimensions,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { ProfileStackParamList } from "@/navigation/types";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withRepeat,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { getPetImageSource } from "@/constants/characterPetAssets";
import type { StackNavigationProp } from "@react-navigation/stack";
import { useProfileStreak } from "@/hooks/useProfile";
import { useUserStore } from "@/store/userStore";
import {
  clampViewMonthToEarliest,
  earliestNavigableMonth,
  formatLocalYmd,
  isCalendarDayTappable,
  isoDateStringGte,
  parseIsoDateParts,
  registrationFirstLocalCalendarDay,
} from "@/utils/calendarDate";

// -----------------------------------------------------------------------------
// DATA SHAPE
// -----------------------------------------------------------------------------

type StreakApiResponse = {
  current_streak: number;
  longest_streak: number;
  streak_requirement_tier: string;
  /** Days with ≥1 mission since registration (all-time; not limited to heatmap window). */
  overall_active_days?: number;
  /** First calendar day included in heatmap (YYYY-MM-DD); from API after registration filter */
  heatmap_eligible_since?: string | null;
  heatmap: Array<{
    date: string;
    maintained: boolean;
    streak_count: number;
    missions_done: number;
    missions_total: number;
    xp_earned: number;
  }>;
  hint_text?: string;
  streak_freeze_count?: number;
};

const VIOLET_GLOW = "#A78BFA";

const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// COMPONENT
// -----------------------------------------------------------------------------

export function ProfileStreakScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<StackNavigationProp<ProfileStackParamList>>();
  const [viewMonth, setViewMonth] = useState<{ month: number; year: number }>(() => {
    const d = new Date();
    return { month: d.getMonth(), year: d.getFullYear() };
  });
  const profile = useUserStore((s) => s.profile);
  const { data, isLoading, error, refetch } = useProfileStreak() as {
    data: StreakApiResponse | undefined;
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
  };

  const petFloat = useSharedValue(0);

  const screenWidth = Dimensions.get("window").width;
  const calendarContentWidth = screenWidth - 16 * 2 - 14 * 2;
  const calendarGap = 3;
  const cellSize = (calendarContentWidth - 6 * calendarGap) / 7;

  useEffect(() => {
    petFloat.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(-5, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
  }, []);

  const petAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: petFloat.value }],
  }));

  const eligibleSince =
    data?.heatmap_eligible_since ??
    registrationFirstLocalCalendarDay(profile?.registration_date);

  /** Join date for taps + month clamp; require known join before enabling days */
  const joinForCalendar =
    eligibleSince ?? registrationFirstLocalCalendarDay(profile?.registration_date);

  const effectiveHeatmap = useMemo(() => {
    const raw = data?.heatmap ?? [];
    if (!eligibleSince) return raw;
    return raw.filter((r) => isoDateStringGte(String(r.date), eligibleSince));
  }, [data?.heatmap, eligibleSince]);

  const earliestMonth = useMemo(
    () => earliestNavigableMonth(joinForCalendar ?? undefined),
    [joinForCalendar]
  );

  useEffect(() => {
    if (!earliestMonth) return;
    setViewMonth((prev) => clampViewMonthToEarliest(prev, earliestMonth));
  }, [earliestMonth]);

  const goPrevMonth = () => {
    setViewMonth((prev) => {
      let y = prev.year;
      let m = prev.month;
      if (m === 0) {
        m = 11;
        y -= 1;
      } else {
        m -= 1;
      }
      return clampViewMonthToEarliest({ year: y, month: m }, earliestMonth);
    });
  };

  const goNextMonth = () => {
    const clock = new Date();
    setViewMonth((prev) => {
      if (prev.year > clock.getFullYear()) return prev;
      if (prev.year === clock.getFullYear() && prev.month >= clock.getMonth()) return prev;
      if (prev.month === 11) return { month: 0, year: prev.year + 1 };
      return { month: prev.month + 1, year: prev.year };
    });
  };

  const clock = new Date();
  const todayYmd = formatLocalYmd(clock);
  const canGoNext =
    viewMonth.year < clock.getFullYear() ||
    (viewMonth.year === clock.getFullYear() && viewMonth.month < clock.getMonth());
  const atEarliestMonth =
    !!earliestMonth &&
    viewMonth.year === earliestMonth.year &&
    viewMonth.month === earliestMonth.month;
  const canGoPrevMonth = !atEarliestMonth;

  const displayMonthName = MONTH_NAMES[viewMonth.month];
  const displayYear = viewMonth.year;
  const daysInViewMonth = new Date(displayYear, viewMonth.month + 1, 0).getDate();
  const firstDayViewMonth = new Date(displayYear, viewMonth.month, 1).getDay();
  const firstDayMonBased = firstDayViewMonth === 0 ? 6 : firstDayViewMonth - 1;
  const viewMonthCells = useMemo(() => {
    const empties = Array(firstDayMonBased).fill(null);
    const days = Array.from({ length: daysInViewMonth }, (_, i) => i + 1);
    return [...empties, ...days];
  }, [viewMonth.month, viewMonth.year, firstDayMonBased, daysInViewMonth]);

  const viewMonthRows = useMemo(() => {
    const rows: (number | null)[][] = [];
    for (let i = 0; i < viewMonthCells.length; i += 7) {
      rows.push(viewMonthCells.slice(i, i + 7));
    }
    const lastRow = rows[rows.length - 1];
    if (lastRow && lastRow.length < 7) {
      rows[rows.length - 1] = [...lastRow, ...Array(7 - lastRow.length).fill(null)];
    }
    return rows;
  }, [viewMonthCells]);

  const monthEntries = useMemo(() => {
    if (!effectiveHeatmap.length) return [];
    const m = viewMonth.month;
    const y = viewMonth.year;
    return effectiveHeatmap.filter((r) => {
      const p = parseIsoDateParts(String(r.date));
      return p !== null && p.y === y && p.m === m;
    });
  }, [effectiveHeatmap, viewMonth.month, viewMonth.year]);

  const completedSet = useMemo(() => {
    const set = new Set<number>();
    for (const r of monthEntries) {
      const p = parseIsoDateParts(String(r.date));
      if (p && r.maintained) set.add(p.d);
    }
    return set;
  }, [monthEntries]);

  /** Active days in the current calendar year (not tied to which month is open in the calendar). */
  const activeDaysThisYear = useMemo(() => {
    if (!effectiveHeatmap.length) return 0;
    const y = new Date().getFullYear();
    return effectiveHeatmap.filter((r) => {
      const p = parseIsoDateParts(String(r.date));
      return p !== null && p.y === y && (r.missions_done ?? 0) > 0;
    }).length;
  }, [effectiveHeatmap]);

  /** Fallback if API omits `overall_active_days` (older backend): count from loaded heatmap slice. */
  const overallActiveDaysFallback = useMemo(() => {
    if (!effectiveHeatmap.length) return 0;
    return effectiveHeatmap.filter((r) => (r.missions_done ?? 0) > 0).length;
  }, [effectiveHeatmap]);

  const overallActiveDays =
    data?.overall_active_days != null ? data.overall_active_days : overallActiveDaysFallback;

  const isViewingCurrentMonth =
    viewMonth.year === clock.getFullYear() && viewMonth.month === clock.getMonth();
  const todayDay = isViewingCurrentMonth ? clock.getDate() : null;
  const todayCompleted = useMemo(() => {
    if (!isViewingCurrentMonth) return false;
    const todayLocal = formatLocalYmd(new Date());
    const row = effectiveHeatmap.find((r) => String(r.date).slice(0, 10) === todayLocal);
    if (!row) return false;
    return row.maintained;
  }, [effectiveHeatmap, isViewingCurrentMonth]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#09091A", "#07080F"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 10,
            paddingBottom: 12,
            paddingHorizontal: 16,
          },
        ]}
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#6B7280" />
        </Pressable>
        <Text style={styles.headerTitle}>Streak</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={{ marginTop: 8, marginBottom: 8 }}>
            <Text style={{ color: "#6B7280", fontSize: 12 }}>
              {error instanceof Error ? error.message : "Could not load streak"}
            </Text>
            <Text onPress={() => refetch()} style={{ color: "#8B5CF6", marginTop: 6, fontSize: 12 }}>
              Retry
            </Text>
          </View>
        ) : null}

        {/* Streak hero */}
        <View style={styles.hero}>
          <Pressable
            style={styles.heroLeftWrap}
            onPress={() => {
              let nav: { getParent?: () => unknown; getState?: () => { routeNames?: string[] }; navigate: (name: string) => void } =
                navigation as never;
              for (let i = 0; i < 6; i++) {
                if (!nav) return;
                const names = nav.getState?.()?.routeNames;
                if (names?.includes("StreakDetail")) {
                  nav.navigate("StreakDetail");
                  return;
                }
                nav = nav.getParent?.() as never;
              }
            }}
            hitSlop={8}
          >
            <View style={styles.heroLeftGlow} pointerEvents="none" />
            <View style={styles.heroLeft}>
              <View style={styles.streakNumberRow}>
                <Text style={styles.streakNumber} allowFontScaling={true}>
                  {isLoading ? "—" : String(data?.current_streak ?? 0)}
                </Text>
                <Text style={styles.streakFlame}>🔥</Text>
              </View>
              <Text style={styles.streakLabel}>day streak</Text>
            </View>
          </Pressable>
          <Animated.View style={[styles.petWrap, petAnimatedStyle]}>
            <Image
              source={getPetImageSource(Math.min(8, Math.max(1, profile?.pet_stage ?? 1)))}
              style={styles.petHeroImage}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
        </View>

        {/* Stat cards — current streak is in the hero; longest / this year / all-time */}
        <View style={styles.statCardsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>LONGEST</Text>
            <Text style={[styles.statCardValue, { color: VIOLET_GLOW }]}>
              {isLoading ? "—" : String(data?.longest_streak ?? 0)}
            </Text>
            <Text style={styles.statCardSub}>days</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>THIS YEAR</Text>
            <Text style={[styles.statCardValueYear, { color: "#A78BFA" }]}>
              {isLoading ? "—" : String(activeDaysThisYear)}
            </Text>
            <Text style={styles.statCardSub}>active days</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>OVERALL</Text>
            <Text style={[styles.statCardValueYear, { color: VIOLET_GLOW }]}>
              {isLoading ? "—" : String(overallActiveDays)}
            </Text>
            <Text style={styles.statCardSub}>active days</Text>
            <Text style={styles.statCardSubJoin}>since you joined</Text>
          </View>
        </View>

        {/* Monthly calendar */}
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarMonthText}>{displayMonthName} {displayYear}</Text>
            <View style={styles.calendarNav}>
              <Pressable
                onPress={goPrevMonth}
                style={styles.calendarNavBtn}
                disabled={!canGoPrevMonth}
              >
                <Ionicons
                  name="chevron-back"
                  size={12}
                  color={canGoPrevMonth ? "#6B7280" : "#4B5563"}
                />
              </Pressable>
              <Pressable onPress={goNextMonth} style={styles.calendarNavBtn} disabled={!canGoNext}>
                <Ionicons name="chevron-forward" size={12} color={canGoNext ? "#6B7280" : "#4B5563"} />
              </Pressable>
            </View>
          </View>
          <View style={styles.dayHeaderRow}>
            {DAY_LABELS.map((l, i) => (
              <Text
                key={i}
                style={[
                  styles.dayHeaderCell,
                  { width: cellSize, marginRight: i < 6 ? calendarGap : 0 },
                ]}
              >
                {l}
              </Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {viewMonthRows.map((row, rowIndex) => (
              <View
                key={rowIndex}
                style={[styles.calendarRow, { marginBottom: calendarGap }]}
              >
                {row.map((day, colIndex) => {
                  const isEmpty = day === null;
                  const dateString =
                    day && !isEmpty
                      ? `${displayYear}-${String(viewMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                      : "";
                  const tappable =
                    !!dateString &&
                    !!joinForCalendar &&
                    isCalendarDayTappable(dateString, joinForCalendar, todayYmd);
                  const blocked = !isEmpty && !!dateString && !tappable;
                  const isToday = !blocked && day === todayDay;
                  const completed = !blocked && day !== null && completedSet.has(day);
                  const isTodayNotCompleted = isToday && !todayCompleted;
                  const key = rowIndex * 7 + colIndex;

                  return (
                    <Pressable
                      key={key}
                      disabled={isEmpty || blocked}
                      onPress={() => {
                        if (!isEmpty && !blocked && dateString) {
                          // @ts-ignore navigation typed via useNavigation
                          (navigation as any).navigate?.("DayDetail", { date: dateString });
                        }
                      }}
                      style={({ pressed }) => [
                        styles.calendarCell,
                        {
                          width: cellSize,
                          height: cellSize,
                          borderRadius: cellSize / 2,
                          marginRight: colIndex < 6 ? calendarGap : 0,
                        },
                        isEmpty && styles.calendarCellEmpty,
                        blocked && styles.calendarCellBlocked,
                        completed && !isToday && !blocked && styles.calendarCellCompleted,
                        isToday && todayCompleted && styles.calendarCellTodayDone,
                        isTodayNotCompleted && styles.calendarCellTodayPending,
                        pressed && !isEmpty && !blocked && styles.calendarCellPressed,
                      ]}
                    >
                      {!isEmpty && (
                        <>
                          <Text
                            style={[
                              styles.calendarCellText,
                              blocked && styles.calendarCellTextBlocked,
                              (completed || (isToday && todayCompleted)) && styles.calendarCellTextDone,
                              isTodayNotCompleted && styles.calendarCellTextPending,
                              !completed && !isToday && !blocked && styles.calendarCellTextEmpty,
                            ]}
                          >
                            {day}
                          </Text>
                          {(completed || (isToday && todayCompleted)) && (
                            <View style={styles.calendarCellFlame}>
                              <Text style={styles.calendarCellFlameEmoji}>🔥</Text>
                            </View>
                          )}
                        </>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <View style={styles.tapHint}>
            <Ionicons name="finger-print-outline" size={12} color="#374151" />
            <Text style={styles.tapHintText}>Tap any day to see your mission history</Text>
          </View>
        </View>

        {/* ── Streak Freeze Card ──────────────────────────────────────────── */}
        <View style={freezeStyles.outerWrap}>
          <LinearGradient
            colors={["transparent", "rgba(125,211,252,0.55)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={freezeStyles.shimmerLine}
            pointerEvents="none"
          />

          <LinearGradient
            colors={["#050d1a", "#080f20", "#050c18"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <LinearGradient
            colors={["rgba(56,189,248,0.08)", "transparent", "rgba(14,165,233,0.04)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View style={freezeStyles.inner}>
            <View style={freezeStyles.eyebrowRow}>
              <View style={freezeStyles.eyebrowDot} />
              <Text style={freezeStyles.eyebrow}>STREAK SHIELD</Text>
            </View>

            <View style={freezeStyles.countHero}>
              <View style={freezeStyles.snowflakeWrap}>
                <Text style={freezeStyles.snowflakeGlyph}>❄</Text>
              </View>
              <View style={freezeStyles.countTextWrap}>
                <Text style={freezeStyles.countNumber}>
                  {isLoading
                    ? "—"
                    : String(data?.streak_freeze_count ?? profile?.streak_freeze_count ?? 0)}
                </Text>
                <Text style={freezeStyles.countLabel}>
                  {(data?.streak_freeze_count ?? profile?.streak_freeze_count ?? 0) === 1
                    ? "freeze available"
                    : "freezes available"}
                </Text>
              </View>
            </View>

            <Text style={freezeStyles.description}>
              Earn freezes by completing Twin challenges and hitting milestones.{"\n"}
              When you miss a day, one freeze is used automatically to protect your streak.
            </Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(9,9,26,0.85)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.35)",
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  hero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 20,
    paddingHorizontal: 4,
    position: "relative",
  },
  heroLeftWrap: {
    position: "relative",
    alignSelf: "flex-start",
  },
  heroLeftGlow: {
    position: "absolute",
    top: -10,
    left: -12,
    right: -12,
    bottom: -10,
    backgroundColor: "rgba(249,115,22,0.14)",
    borderRadius: 24,
    zIndex: 0,
  },
  heroLeft: {
    flexDirection: "column",
    gap: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
    zIndex: 1,
  },
  streakNumberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  streakNumber: {
    fontSize: 56,
    fontFamily: "Inter_700Bold",
    color: "#F97316",
    letterSpacing: -2,
    lineHeight: 56,
    minWidth: 32,
  },
  streakFlame: {
    fontSize: 36,
  },
  streakLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(249,115,22,0.6)",
    letterSpacing: 0.3,
    marginTop: 2,
  },
  petWrap: {
    marginRight: 0,
    flexShrink: 0,
  },
  petHeroImage: {
    width: 120,
    height: 120,
  },

  statCardsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#111623",
    borderWidth: 1,
    borderColor: "#1A1F30",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  statCardLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    color: "#4B5563",
    textTransform: "uppercase",
  },
  statCardValue: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginTop: 2,
  },
  statCardValueYear: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginTop: 2,
  },
  statCardSub: {
    fontSize: 9,
    color: "#374151",
    marginTop: 1,
  },
  statCardSubJoin: {
    fontSize: 8,
    color: "#4B5563",
    marginTop: 3,
    letterSpacing: 0.2,
  },

  calendarCard: {
    backgroundColor: "#111623",
    borderWidth: 1,
    borderColor: "#1A1F30",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  calendarMonthText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
  },
  calendarNav: {
    flexDirection: "row",
    gap: 4,
  },
  calendarNavBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  dayHeaderRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  dayHeaderCell: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "#374151",
    textAlign: "center",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  calendarGrid: {
    flexDirection: "column",
  },
  calendarRow: {
    flexDirection: "row",
  },
  calendarCell: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  calendarCellEmpty: {
    opacity: 0,
  },
  calendarCellBlocked: {
    opacity: 0.38,
    backgroundColor: "rgba(30,35,51,0.5)",
  },
  calendarCellTextBlocked: {
    color: "#374151",
    fontFamily: "Inter_400Regular",
  },
  calendarCellCompleted: {
    backgroundColor: "rgba(249,115,22,0.12)",
  },
  calendarCellTodayDone: {
    backgroundColor: "rgba(249,115,22,0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(249,115,22,0.5)",
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(249,115,22,0.20)", shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }
      : {}),
  },
  calendarCellTodayPending: {
    backgroundColor: "rgba(139,92,246,0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(139,92,246,0.3)",
  },
  calendarCellPressed: {
    opacity: 0.88,
  },
  calendarCellText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#F97316",
  },
  calendarCellTextDone: {
    color: "#F97316",
  },
  calendarCellTextPending: {
    fontFamily: "Inter_600SemiBold",
    color: "#8B5CF6",
  },
  calendarCellTextEmpty: {
    fontFamily: "Inter_400Regular",
    color: "#4B5563",
  },
  calendarCellFlame: {
    position: "absolute",
    bottom: -1,
    right: -1,
  },
  calendarCellFlameEmoji: {
    fontSize: 8,
  },

  tapHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    marginBottom: 4,
    opacity: 0.7,
  },
  tapHintText: {
    fontSize: 11,
    color: "#374151",
    fontStyle: "italic",
  },
});

const freezeStyles = StyleSheet.create({
  outerWrap: {
    borderRadius: 20,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.18)",
    position: "relative",
    ...Platform.select({
      ios: {
        shadowColor: "rgba(56,189,248,0.25)",
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 1,
      },
      android: { elevation: 8 },
    }),
  },
  shimmerLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    zIndex: 2,
  },
  inner: {
    padding: 18,
    paddingTop: 20,
    zIndex: 1,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 18,
  },
  eyebrowDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#38BDF8",
    ...Platform.select({
      ios: {
        shadowColor: "#38BDF8",
        shadowOpacity: 1,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 0 },
      },
    }),
  },
  eyebrow: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2.5,
    color: "rgba(56,189,248,0.55)",
    textTransform: "uppercase",
  },

  countHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 14,
    position: "relative",
  },
  snowflakeWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(56,189,248,0.08)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.22)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  snowflakeGlyph: {
    fontSize: 26,
    color: "#7DD3FC",
  },
  countTextWrap: {
    flex: 1,
  },
  countNumber: {
    fontSize: 44,
    fontFamily: "Inter_700Bold",
    color: "#BAE6FD",
    letterSpacing: -2,
    lineHeight: 46,
  },
  countLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(56,189,248,0.45)",
    letterSpacing: 0.3,
    marginTop: 1,
  },

  description: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 0,
  },
});
