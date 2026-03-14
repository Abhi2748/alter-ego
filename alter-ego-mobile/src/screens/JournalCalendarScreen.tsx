/**
 * Journal Calendar — Monthly calendar showing days with entries. Spec §4.
 * From List → ••• → Calendar. Tap day with entry → Editor (read_only); tap today (no entry) → Editor (new).
 */

import React, { useState, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Platform } from "react-native";
import { getJournalEntries } from "../utils/journalStore";

const BG_GRADIENT = ["#09091A", "#07080F"] as const;
const TEXT_PRIMARY = "#E5E7EB";
const MUTED = "#6B7280";
const DIM = "#374151";
const VIOLET = "#8B5CF6";
const VIOLET_GLOW = "#A78BFA";
const CARD_BG = "rgba(14,13,28,0.85)";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  const [entriesByDate, setEntriesByDate] = useState<Map<string, { id: string }>>(new Map());

  useFocusEffect(
    useCallback(() => {
      const entries = getJournalEntries();
      const map = new Map<string, { id: string }>();
      entries.forEach((e) => map.set(e.date, { id: e.id }));
      setEntriesByDate(map);
    }, [])
  );

  const monthLabel = useMemo(() => {
    const d = new Date(year, month, 1);
    return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }, [year, month]);

  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const todayKey = dateToKey(new Date());
  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth();

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
      (navigation as any).navigate("JournalEditor", { entry_id: null, read_only: false });
    }
    // past day, no entry: no action
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
            <Pressable onPress={prevMonth} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={13} color={MUTED} />
            </Pressable>
            <Pressable onPress={nextMonth} style={styles.navBtn} disabled={isCurrentMonth}>
              <Ionicons name="chevron-forward" size={13} color={MUTED} />
            </Pressable>
          </View>
        </View>
        <View style={styles.weekdayRow}>
          {DAY_NAMES.map((d) => (
            <Text key={d} style={styles.weekdayLabel}>
              {d.toUpperCase()}
            </Text>
          ))}
        </View>
        <View style={styles.grid}>
          {days.map((dateStr, i) => (
            <View key={i} style={styles.cell}>
              {dateStr ? (
                <Pressable
                  style={[
                    styles.dayCell,
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
                    {new Date(dateStr + "T12:00:00").getDate()}
                  </Text>
                  {entriesByDate.has(dateStr) && (
                    <View style={[styles.dot, dateStr === todayKey && styles.dotToday]} />
                  )}
                </Pressable>
              ) : null}
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
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  weekdayLabel: {
    flex: 1,
    fontSize: 9,
    fontWeight: "600",
    color: DIM,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 3 },
  cell: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dayCell: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 9999,
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
