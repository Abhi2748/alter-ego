/**
 * Profile → Streak. Premium streak display: big flame number, pet companion,
 * monthly calendar, stat cards, month progress, streak freezes.
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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
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
import { PetAnimation } from "../components/PetAnimation";
import { useProfileStreak } from "@/hooks/useProfile";
import { useUserStore } from "@/store/userStore";

// -----------------------------------------------------------------------------
// DATA SHAPE
// -----------------------------------------------------------------------------

type StreakApiResponse = {
  current_streak: number;
  longest_streak: number;
  streak_requirement_tier: string;
  heatmap: Array<{
    date: string;
    maintained: boolean;
    streak_count: number;
    missions_done: number;
    missions_total: number;
    xp_earned: number;
  }>;
  hint_text?: string;
};

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
  const navigation = useNavigation();
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

  const goPrevMonth = () => {
    setViewMonth((prev) => {
      if (prev.month === 0) return { month: 11, year: prev.year - 1 };
      return { month: prev.month - 1, year: prev.year };
    });
  };

  const goNextMonth = () => {
    const now = new Date();
    setViewMonth((prev) => {
      if (prev.year > now.getFullYear()) return prev;
      if (prev.year === now.getFullYear() && prev.month >= now.getMonth()) return prev;
      if (prev.month === 11) return { month: 0, year: prev.year + 1 };
      return { month: prev.month + 1, year: prev.year };
    });
  };

  const now = useMemo(() => new Date(), []);
  const canGoNext =
    viewMonth.year < now.getFullYear() ||
    (viewMonth.year === now.getFullYear() && viewMonth.month < now.getMonth());

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
    if (!data?.heatmap) return [];
    const m = viewMonth.month;
    const y = viewMonth.year;
    return data.heatmap.filter((r) => {
      const d = new Date(r.date);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }, [data?.heatmap, viewMonth.month, viewMonth.year]);

  const completedSet = useMemo(() => {
    const set = new Set<number>();
    for (const r of monthEntries) {
      const d = new Date(r.date);
      if (r.maintained) set.add(d.getDate());
    }
    return set;
  }, [monthEntries]);

  const activeDaysThisMonth = useMemo(
    () => monthEntries.filter((r) => (r.missions_done ?? 0) > 0).length,
    [monthEntries]
  );

  const activeDaysThisYear = useMemo(() => {
    if (!data?.heatmap) return 0;
    const y = viewMonth.year;
    return data.heatmap.filter((r) => {
      const d = new Date(r.date);
      return d.getFullYear() === y && (r.missions_done ?? 0) > 0;
    }).length;
  }, [data?.heatmap, viewMonth.year]);

  const isViewingCurrentMonth =
    viewMonth.year === now.getFullYear() && viewMonth.month === now.getMonth();
  const todayDay = isViewingCurrentMonth ? now.getDate() : null;
  const todayCompleted = useMemo(() => {
    if (!isViewingCurrentMonth) return false;
    const todayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      .toISOString()
      .slice(0, 10);
    const row = data?.heatmap?.find((r) => String(r.date).slice(0, 10) === todayIso);
    if (!row) return false;
    return row.maintained;
  }, [data?.heatmap, isViewingCurrentMonth, now]);

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
          <View style={styles.heroLeftWrap}>
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
          </View>
          <Animated.View style={[styles.petCircleWrap, petAnimatedStyle]}>
            <View style={styles.petCircleOuter}>
              <View style={styles.petCircleInner}>
                <PetAnimation
                stage={Math.min(8, Math.max(1, profile?.pet_stage ?? 1))}
                isHappy
                size={86}
              />
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Stat cards */}
        <View style={styles.statCardsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>CURRENT</Text>
            <Text style={[styles.statCardValue, { color: "#F97316" }]}>
              🔥{isLoading ? "—" : String(data?.current_streak ?? 0)}
            </Text>
            <Text style={styles.statCardSub}>days</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>LONGEST</Text>
            <Text style={[styles.statCardValue, { color: "#E5E7EB" }]}>
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
        </View>

        {/* Monthly calendar */}
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarMonthText}>{displayMonthName} {displayYear}</Text>
            <View style={styles.calendarNav}>
              <Pressable onPress={goPrevMonth} style={styles.calendarNavBtn}>
                <Ionicons name="chevron-back" size={12} color="#6B7280" />
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
                  const isToday = day === todayDay;
                  const completed = day !== null && completedSet.has(day);
                  const isTodayNotCompleted = isToday && !todayCompleted;
                  const key = rowIndex * 7 + colIndex;

                  const dateString =
                    day && !isEmpty
                      ? `${displayYear}-${String(viewMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                      : "";

                  return (
                    <Pressable
                      key={key}
                      disabled={isEmpty}
                      onPress={() => {
                        if (!isEmpty && dateString) {
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
                        completed && !isToday && styles.calendarCellCompleted,
                        isToday && todayCompleted && styles.calendarCellTodayDone,
                        isTodayNotCompleted && styles.calendarCellTodayPending,
                        pressed && !isEmpty && styles.calendarCellPressed,
                      ]}
                    >
                      {!isEmpty && (
                        <>
                          <Text
                            style={[
                              styles.calendarCellText,
                              (completed || (isToday && todayCompleted)) && styles.calendarCellTextDone,
                              isTodayNotCompleted && styles.calendarCellTextPending,
                              !completed && !isToday && styles.calendarCellTextEmpty,
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

        {/* Month progress bar */}
        <View style={styles.progressCard}>
          <View style={styles.progressTopRow}>
            <Text style={styles.progressActiveText}>{isLoading ? "—" : `${activeDaysThisMonth} active days`}</Text>
            <Text style={styles.progressFractionText}>
              {isLoading ? "—" : `${activeDaysThisMonth} / ${daysInViewMonth}`}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={["#F97316", "#FBBF24"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.progressFill,
                { width: `${daysInViewMonth > 0 ? (activeDaysThisMonth / daysInViewMonth) * 100 : 0}%` },
              ]}
            />
          </View>
          <Text style={styles.progressSubText}>
            {Math.max(0, daysInViewMonth - activeDaysThisMonth)} days remaining in {displayMonthName}
          </Text>
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
  petCircleWrap: {
    marginRight: 4,
  },
  petCircleOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: "rgba(139,92,246,0.40)",
    padding: 4,
    backgroundColor: "rgba(109,40,217,0.06)",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "rgba(109,40,217,0.28)",
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 0 },
        }
      : { elevation: 12 }),
  },
  petCircleInner: {
    width: 86,
    height: 86,
    borderRadius: 43,
    overflow: "hidden",
    backgroundColor: "rgba(20,15,50,0.95)",
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

  progressCard: {
    backgroundColor: "#111623",
    borderWidth: 1,
    borderColor: "#1A1F30",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  progressTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressActiveText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#E5E7EB",
  },
  progressFractionText: {
    fontSize: 11,
    color: "#4B5563",
  },
  progressTrack: {
    height: 5,
    borderRadius: 5,
    backgroundColor: "rgba(30,35,51,0.9)",
    marginTop: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 5,
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(249,115,22,0.40)", shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }
      : {}),
  },
  progressSubText: {
    fontSize: 10,
    color: "#374151",
    marginTop: 4,
  },

  freezesCard: {
    backgroundColor: "#111623",
    borderWidth: 1,
    borderColor: "#1A1F30",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  freezesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  freezesTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
  },
  freezesCount: {
    marginLeft: "auto",
    fontSize: 11,
    color: "#4B5563",
  },
  freezesDesc: {
    fontSize: 11,
    color: "#4B5563",
    lineHeight: 16.5,
  },
  freezesBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "rgba(139,92,246,0.10)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.22)",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  freezesBadgeDanger: {
    backgroundColor: "rgba(127,29,29,0.15)",
    borderColor: "rgba(239,68,68,0.2)",
  },
  freezesBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#8B5CF6",
  },
  freezesBadgeTextDanger: {
    color: "#F87171",
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
