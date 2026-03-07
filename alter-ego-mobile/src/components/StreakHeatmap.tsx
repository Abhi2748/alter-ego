/**
 * Streak Heatmap §2.10 — 52 columns × 7 rows. Profile → Streak tab only.
 * Tap cell → DayDetailModal. Scroll starts at right (today).
 */

import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from "react-native";
import { COLORS, HEATMAP_LEVELS } from "../constants/theme";
import { DayDetailModal } from "./DayDetailModal";

const CELL_SIZE = 12;
const GAP = 3;
const CELL_RADIUS = 3;
const DAY_LABEL_WIDTH = 28;
const MONTH_ROW_HEIGHT = 20;
const COLS = 52;
const ROWS = 7;
const TOTAL_CELLS = COLS * ROWS; // 364 days

const ROW_HEIGHT = CELL_SIZE + GAP;
const GRID_HEIGHT = ROWS * (CELL_SIZE + GAP) - GAP; // 7*15 - 3 = 102
const COL_WIDTH = CELL_SIZE + GAP;
const GRID_WIDTH = COLS * COL_WIDTH - GAP;

const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

export interface HeatmapDay {
  date: string;
  level: number;
}

export interface StreakHeatmapProps {
  /** Array of 364 or 365 { date, level } objects. Oldest first. Last item = today or yesterday. */
  data: HeatmapDay[];
  /** Optional. If not set, last data index is treated as today. */
  todayDate?: string | null;
}

/** Placeholder: 364 days (52 weeks) with random levels weighted toward recent activity. Last day = today. */
export function generatePlaceholderHeatmapData(): HeatmapDay[] {
  const out: HeatmapDay[] = [];
  const now = new Date();
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - (TOTAL_CELLS - 1 - i));
    const dateStr = d.toISOString().slice(0, 10);
    const progress = i / TOTAL_CELLS;
    const rand = Math.random();
    let level: number;
    if (progress > 0.8) level = rand < 0.6 ? 4 : rand < 0.85 ? 3 : 2;
    else if (progress > 0.5) level = rand < 0.3 ? 4 : rand < 0.6 ? 3 : rand < 0.85 ? 2 : 1;
    else level = rand < 0.2 ? 3 : rand < 0.5 ? 2 : rand < 0.8 ? 1 : 0;
    out.push({ date: dateStr, level });
  }
  return out;
}

export function StreakHeatmap({ data, todayDate }: StreakHeatmapProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [selectedDay, setSelectedDay] = useState<HeatmapDay | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const cells = data.slice(0, TOTAL_CELLS);
  const lastDate = cells[cells.length - 1]?.date ?? null;
  const today = todayDate ?? lastDate;

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        x: Math.max(0, GRID_WIDTH - Dimensions.get("window").width + DAY_LABEL_WIDTH),
        animated: false,
      });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const openDay = (day: HeatmapDay) => {
    setSelectedDay(day);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedDay(null);
  };

  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = "";
  for (let c = 0; c < COLS; c++) {
    const idx = c * ROWS;
    const day = cells[idx];
    if (!day) continue;
    const month = day.date.slice(0, 7);
    if (month !== lastMonth) {
      const d = new Date(day.date + "T12:00:00");
      monthLabels.push({
        col: c,
        label: d.toLocaleDateString(undefined, { month: "short" }),
      });
      lastMonth = month;
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.dayLabelsColumn}>
        <View style={[styles.monthRow, styles.dayLabelRow]} />
        {Array.from({ length: ROWS }, (_, r) => (
          <View key={r} style={styles.dayLabelCell}>
            {DAY_LABELS[r] ? (
              <Text style={styles.dayLabel} numberOfLines={1}>
                {DAY_LABELS[r]}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scroll}
      >
        <View style={styles.gridWrap}>
          <View style={[styles.monthRow, { width: GRID_WIDTH }]}>
            {monthLabels.map(({ col, label }) => (
              <View
                key={col}
                style={[styles.monthCell, { left: col * COL_WIDTH }]}
                pointerEvents="none"
              >
                <Text style={styles.monthLabel} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.grid}>
            {Array.from({ length: COLS }, (_, c) => (
              <View key={c} style={styles.column}>
                {Array.from({ length: ROWS }, (_, r) => {
                  const idx = c * ROWS + r;
                  const day = cells[idx];
                  if (!day) return <View key={r} style={styles.cell} />;
                  const isToday = day.date === today;
                  const color = HEATMAP_LEVELS[Math.min(4, Math.max(0, day.level))] ?? HEATMAP_LEVELS[0];
                  return (
                    <Pressable
                      key={r}
                      style={[
                        styles.cell,
                        { backgroundColor: color },
                        isToday && styles.todayCell,
                      ]}
                      onPress={() => openDay(day)}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      {selectedDay && (
        <DayDetailModal
          visible={modalVisible}
          onClose={closeModal}
          date={selectedDay.date}
          level={selectedDay.level}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    height: MONTH_ROW_HEIGHT + GRID_HEIGHT,
  },
  dayLabelsColumn: {
    width: DAY_LABEL_WIDTH,
    backgroundColor: "transparent",
  },
  dayLabelRow: {
    height: MONTH_ROW_HEIGHT,
  },
  dayLabelCell: {
    height: ROW_HEIGHT,
    justifyContent: "center",
  },
  dayLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: COLORS.muted,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingRight: 16,
  },
  gridWrap: {
    height: MONTH_ROW_HEIGHT + GRID_HEIGHT,
  },
  monthRow: {
    position: "absolute",
    top: 0,
    left: 0,
    height: MONTH_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
  },
  monthCell: {
    position: "absolute",
    width: COL_WIDTH,
    justifyContent: "center",
  },
  monthLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: COLORS.muted,
  },
  grid: {
    flexDirection: "row",
    marginTop: MONTH_ROW_HEIGHT,
    height: GRID_HEIGHT,
  },
  column: {
    flexDirection: "column",
    marginRight: GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_RADIUS,
    marginBottom: GAP,
  },
  todayCell: {
    borderWidth: 1,
    borderColor: COLORS.violet,
  },
});
