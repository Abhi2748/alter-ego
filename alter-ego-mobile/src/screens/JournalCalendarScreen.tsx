/**
 * Journal Calendar — Month view with dots under dates that have entries.
 * Tap date to open editor for that day. iPhone Journal style.
 */

import React, { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, RADIUS } from "../constants/theme";
import { supabase } from "../utils/supabase";
import { getJournalEntries } from "../utils/api";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOT_SIZE = 4;

function dateToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getDaysInMonth(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const days: (string | null)[] = Array(startPad).fill(null);
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(dateToKey(new Date(year, month, d)));
  }
  return days;
}

export function JournalCalendarScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [datesWithEntries, setDatesWithEntries] = useState<Set<string>>(new Set());

  const monthLabel = useMemo(() => {
    const d = new Date(year, month, 1);
    return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }, [year, month]);

  const loadMonthEntries = useCallback(async () => {
    const start = dateToKey(new Date(year, month, 1));
    const end = dateToKey(new Date(year, month + 1, 0));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await getJournalEntries(session.access_token, start, end, 31);
      const set = new Set<string>((res.entries || []).map((e) => e.date));
      setDatesWithEntries(set);
    } catch (_) {
      setDatesWithEntries(new Set());
    }
  }, [year, month]);

  React.useEffect(() => {
    loadMonthEntries();
  }, [loadMonthEntries]);

  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const todayKey = dateToKey(new Date());

  const prevMonth = () => {
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

  const openEditor = (dateStr: string) => {
    (navigation as any).navigate("JournalEditor", { date: dateStr });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.bg1, COLORS.bg0]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Calendar</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.monthRow}>
        <Pressable onPress={prevMonth} style={styles.monthArrow}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable onPress={nextMonth} style={styles.monthArrow}>
          <Ionicons name="chevron-forward" size={22} color={COLORS.text} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {DAY_NAMES.map((d) => (
          <Text key={d} style={styles.weekdayLabel}>{d}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((dateStr, i) => (
          <View key={i} style={styles.cell}>
            {dateStr ? (
              <Pressable
                style={[
                  styles.dayTouch,
                  dateStr === todayKey && styles.dayTouchToday,
                ]}
                onPress={() => openEditor(dateStr)}
              >
                <Text
                  style={[
                    styles.dayNum,
                    dateStr === todayKey && styles.dayNumToday,
                  ]}
                >
                  {new Date(dateStr + "T12:00:00").getDate()}
                </Text>
                {datesWithEntries.has(dateStr) && (
                  <View style={styles.dot} />
                )}
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBtn: { minWidth: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: COLORS.text },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.screenPadding,
    paddingVertical: SPACING.lg,
  },
  monthArrow: { padding: SPACING.sm },
  monthLabel: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: COLORS.text },
  weekdayRow: {
    flexDirection: "row",
    paddingHorizontal: SPACING.screenPadding,
    marginBottom: SPACING.sm,
  },
  weekdayLabel: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.muted,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: SPACING.screenPadding,
  },
  cell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayTouch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dayTouchToday: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.violet,
  },
  dayNum: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: COLORS.text,
  },
  dayNumToday: { color: COLORS.violet },
  dot: {
    position: "absolute",
    bottom: 2,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: COLORS.violet,
  },
});
