/**
 * Journal Calendar — Monthly calendar showing days with entries. Spec §4.
 * From List → ••• → Calendar. Tap day with entry → Editor (read_only); tap today (no entry) → Editor (new).
 * Grid layout matches ProfileStreakScreen: fixed cell width + explicit rows (flexWrap + gap breaks 7 columns).
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useJournalList } from "@/hooks/useJournal";
import { useUserStore } from "@/store/userStore";

const BG_GRADIENT = ["#09091A", "#07080F"] as const;
const TEXT_PRIMARY = "#E5E7EB";
const MUTED = "#6B7280";
const DIM = "#374151";
const VIOLET = "#8B5CF6";
const VIOLET_GLOW = "#A78BFA";
const CARD_BG = "rgba(14,13,28,0.85)";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateToKey(y: number, monthZero: number, day: number): string {
  const m = String(monthZero + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseRegistrationMonth(reg: string | undefined | null): { y: number; m: number } | null {
  if (!reg || typeof reg !== "string") return null;
  const dt = new Date(reg.slice(0, 10) + "T12:00:00");
  if (Number.isNaN(dt.getTime())) return null;
  return { y: dt.getFullYear(), m: dt.getMonth() };
}

/** Same pattern as ProfileStreakScreen: (width − 6×gap) / 7 so seven columns + gaps fit exactly. */
function useCalendarCellSize() {
  return useMemo(() => {
    const screenWidth = Dimensions.get("window").width;
    const cardInnerWidth = screenWidth - 16 * 2 - 16 * 2;
    const calendarGap = 3;
    const cellSize = (cardInnerWidth - 6 * calendarGap) / 7;
    return { cellSize, calendarGap };
  }, []);
}

export function JournalCalendarScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const profile = useUserStore((s) => s.profile);
  const joinMonth = useMemo(
    () => parseRegistrationMonth(profile?.registration_date),
    [profile?.registration_date]
  );
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const { data, refetch } = useJournalList();
  const { cellSize, calendarGap } = useCalendarCellSize();

  const entriesByDate = useMemo(() => {
    const map = new Map<string, { id: string }>();
    (data?.entries ?? []).forEach((e) => map.set(e.date, { id: e.id }));
    return map;
  }, [data?.entries]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  useEffect(() => {
    if (!joinMonth) return;
    if (year < joinMonth.y || (year === joinMonth.y && month < joinMonth.m)) {
      setYear(joinMonth.y);
      setMonth(joinMonth.m);
    }
  }, [joinMonth, year, month]);

  const monthLabel = useMemo(() => {
    const d = new Date(year, month, 1);
    return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }, [year, month]);

  const daysInViewMonth = new Date(year, month + 1, 0).getDate();
  const firstDayViewMonth = new Date(year, month, 1).getDay();

  const viewMonthRows = useMemo(() => {
    const empties: (number | null)[] = Array(firstDayViewMonth).fill(null);
    const days = Array.from({ length: daysInViewMonth }, (_, i) => i + 1);
    const cells: (number | null)[] = [...empties, ...days];
    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    const lastRow = rows[rows.length - 1];
    if (lastRow && lastRow.length < 7) {
      rows[rows.length - 1] = [...lastRow, ...Array(7 - lastRow.length).fill(null)];
    }
    return rows;
  }, [year, month, firstDayViewMonth, daysInViewMonth]);

  const tNow = new Date();
  const todayKey = dateToKey(tNow.getFullYear(), tNow.getMonth(), tNow.getDate());

  const isCurrentMonth =
    year === new Date().getFullYear() && month === new Date().getMonth();

  const atEarliestMonth =
    joinMonth != null && year === joinMonth.y && month === joinMonth.m;

  const prevMonth = () => {
    if (atEarliestMonth) return;
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const entriesThisMonth = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    let n = 0;
    entriesByDate.forEach((_, date) => {
      if (date.startsWith(prefix)) n++;
    });
    return n;
  }, [year, month, entriesByDate]);

  const handleDayPress = (dateStr: string) => {
    const entry = entriesByDate.get(dateStr);
    if (entry) {
      (navigation as any).navigate("JournalEditor", { entry_id: entry.id, read_only: true });
    } else if (dateStr === todayKey) {
      (navigation as any).navigate("JournalEditor", {
        entry_id: null,
        read_only: false,
        mission_date: dateStr,
      });
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        {Platform.OS === "ios" ? <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} /> : null}
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={MUTED} />
          </Pressable>
          <Text style={styles.headerTitle}>Calendar</Text>
          <View style={styles.headerBtn} />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.monthRow}>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <View style={styles.navRow}>
            <Pressable
              onPress={prevMonth}
              style={[styles.navBtn, atEarliestMonth && styles.navBtnDisabled]}
              disabled={atEarliestMonth}
            >
              <Ionicons name="chevron-back" size={13} color={atEarliestMonth ? DIM : MUTED} />
            </Pressable>
            <Pressable onPress={nextMonth} style={styles.navBtn} disabled={isCurrentMonth}>
              <Ionicons name="chevron-forward" size={13} color={MUTED} />
            </Pressable>
          </View>
        </View>
        <View style={styles.weekdayRow}>
          {DAY_NAMES.map((d, i) => (
            <Text
              key={d}
              style={[
                styles.weekdayLabel,
                { width: cellSize, marginRight: i < 6 ? calendarGap : 0 },
              ]}
            >
              {d.toUpperCase()}
            </Text>
          ))}
        </View>
        <View style={styles.calendarGrid}>
          {viewMonthRows.map((row, rowIndex) => (
            <View key={rowIndex} style={[styles.calendarRow, { marginBottom: calendarGap }]}>
              {row.map((day, colIndex) => {
                const isEmpty = day === null;
                const dateStr =
                  !isEmpty && day !== null
                    ? dateToKey(year, month, day)
                    : "";
                const key = rowIndex * 7 + colIndex;

                return (
                  <View
                    key={key}
                    style={{
                      width: cellSize,
                      marginRight: colIndex < 6 ? calendarGap : 0,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {!isEmpty && dateStr ? (
                      <Pressable
                        style={[
                          styles.dayCell,
                          { width: cellSize, height: cellSize, borderRadius: cellSize / 2 },
                          dateStr === todayKey && styles.dayCellToday,
                        ]}
                        onPress={() => handleDayPress(dateStr)}
                      >
                        <Text
                          style={[
                            styles.dayNum,
                            dateStr === todayKey && styles.dayNumToday,
                            entriesByDate.has(dateStr) && dateStr !== todayKey && styles.dayNumHasEntry,
                          ]}
                        >
                          {day}
                        </Text>
                        {entriesByDate.has(dateStr) && (
                          <View style={[styles.dot, dateStr === todayKey && styles.dotToday]} />
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>
      <Text style={styles.footerNote}>
        {entriesThisMonth === 0
          ? `No entries in ${monthLabel} yet`
          : `${entriesThisMonth} entries in ${monthLabel} · Tap a day to read`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.35)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    position: "relative",
    overflow: "hidden",
  },
  headerRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  headerBtn: { minWidth: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: TEXT_PRIMARY },
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.40)",
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  monthLabel: { fontSize: 17, fontWeight: "700", color: TEXT_PRIMARY },
  navRow: { flexDirection: "row", gap: 4 },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.40)",
    justifyContent: "center",
    alignItems: "center",
  },
  navBtnDisabled: { opacity: 0.35 },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  weekdayLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: DIM,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  calendarGrid: {},
  calendarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dayCell: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  dayCellToday: {
    backgroundColor: "rgba(139,92,246,0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(139,92,246,0.45)",
    shadowColor: "rgba(139,92,246,0.18)",
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  dayNum: {
    fontSize: 12,
    color: DIM,
    textAlign: "center",
  },
  dayNumToday: { color: VIOLET_GLOW, fontWeight: "700" },
  dayNumHasEntry: { color: "#C4B5FD", fontWeight: "600" },
  dot: {
    position: "absolute",
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: VIOLET,
  },
  dotToday: { backgroundColor: "#C084FC" },
  footerNote: {
    textAlign: "center",
    marginTop: 14,
    fontSize: 11,
    color: DIM,
  },
});
