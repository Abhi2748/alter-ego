/**
 * Streak Heatmap §2.10 — 52 columns × 7 rows. Profile → Streak tab only.
 * Tap cell → DayDetailModal. Scroll starts at right (today).
 * Cell size configurable (12px default; Profile uses 14px).
 */

import React, { useRef, useEffect, useState, useMemo } from "react";
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

const GAP = 3;
const CELL_RADIUS = 3;
const DAY_LABEL_WIDTH = 32;
const MONTH_ROW_HEIGHT = 22;
const ROWS = 7;

/** Sun–Sat: week starts Sunday. */
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function useHeatmapLayout(cellSize: number, cols: number) {
  return useMemo(() => {
    const rowHeight = cellSize + GAP;
    const gridHeight = ROWS * rowHeight - GAP;
    const colWidth = cellSize + GAP;
    const gridWidth = cols * colWidth - GAP;
    return { cellSize, gridHeight, colWidth, gridWidth, rowHeight };
  }, [cellSize, cols]);
}

export interface HeatmapDay {
  date: string;
  level: number;
}

export interface StreakHeatmapProps {
  /** Array of { date, level }. Length = weeks * 7. Oldest first. Last item = today or yesterday. */
  data: HeatmapDay[];
  /** Optional. If not set, last data index is treated as today. */
  todayDate?: string | null;
  /** Cell size in px. Default 16. Use 18 for a "bigger" readable grid. */
  cellSize?: number;
  /** Number of weeks (columns). Default 16 for readable month/day; use 52 for full year. */
  weeks?: number;
}

/** Placeholder: exactly (weeks × 7) days starting from a Sunday. Recent activity weighted higher. */
export function generatePlaceholderHeatmapData(weeks: number = 16): HeatmapDay[] {
  const total = weeks * ROWS;
  const out: HeatmapDay[] = [];
  const now = new Date();
  const firstDay = new Date(now);
  firstDay.setDate(now.getDate() - total + 1);
  while (firstDay.getDay() !== 0) {
    firstDay.setDate(firstDay.getDate() - 1);
  }
  for (let i = 0; i < total; i++) {
    const d = new Date(firstDay);
    d.setDate(firstDay.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const progress = i / total;
    const rand = Math.random();
    let level: number;
    if (progress > 0.8) level = rand < 0.6 ? 4 : rand < 0.85 ? 3 : 2;
    else if (progress > 0.5) level = rand < 0.3 ? 4 : rand < 0.6 ? 3 : rand < 0.85 ? 2 : 1;
    else level = rand < 0.2 ? 3 : rand < 0.5 ? 2 : rand < 0.8 ? 1 : 0;
    out.push({ date: dateStr, level });
  }
  return out;
}

export function StreakHeatmap({
  data,
  todayDate,
  cellSize = 16,
  weeks = 16,
}: StreakHeatmapProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [selectedDay, setSelectedDay] = useState<HeatmapDay | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const cols = weeks;
  const totalCells = cols * ROWS;
  const layout = useHeatmapLayout(cellSize, cols);

  const cells = data.slice(0, totalCells);
  const lastDate = cells[cells.length - 1]?.date ?? null;
  const today = todayDate ?? lastDate;

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        x: Math.max(0, layout.gridWidth - Dimensions.get("window").width + DAY_LABEL_WIDTH),
        animated: false,
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [layout.gridWidth]);

  const openDay = (day: HeatmapDay) => {
    setSelectedDay(day);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedDay(null);
  };

  const monthLabels: { col: number; label: string }[] = [];
  const seenMonths = new Set<string>();
  for (let i = 0; i < cells.length; i++) {
    const day = cells[i];
    if (!day) continue;
    const d = new Date(day.date + "T12:00:00");
    if (d.getDate() !== 1) continue;
    const monthKey = day.date.slice(0, 7);
    if (seenMonths.has(monthKey)) continue;
    seenMonths.add(monthKey);
    monthLabels.push({
      col: Math.floor(i / ROWS),
      label: d.toLocaleDateString(undefined, { month: "short" }),
    });
  }

  const dynamicStyles = {
    wrapper: { height: MONTH_ROW_HEIGHT + layout.gridHeight },
    gridWrap: { height: MONTH_ROW_HEIGHT + layout.gridHeight },
    monthRow: { width: layout.gridWidth },
    monthCell: { width: layout.colWidth },
    grid: { height: layout.gridHeight },
    column: { marginRight: GAP },
    cell: {
      width: layout.cellSize,
      height: layout.cellSize,
      borderRadius: CELL_RADIUS,
      marginBottom: GAP,
    },
  };

  return (
    <View style={[styles.wrapper, dynamicStyles.wrapper]}>
      <View style={styles.dayLabelsColumn}>
        {/* Spacer only — no position:absolute so it takes space and day labels start below month row */}
        <View style={styles.dayLabelRow} />
        <View style={[styles.dayLabelsGrid, { height: layout.gridHeight }]}>
          {Array.from({ length: ROWS }, (_, r) => (
            <View
              key={r}
              style={[
                styles.dayLabelCellFlex,
                r < ROWS - 1
                  ? { height: layout.rowHeight }
                  : { height: layout.cellSize },
              ]}
            >
              <Text style={styles.dayLabel} numberOfLines={1}>
                {DAY_LABELS[r]}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scroll}
      >
        <View style={[styles.gridWrap, dynamicStyles.gridWrap]}>
          <View style={[styles.monthRow, dynamicStyles.monthRow]}>
            {monthLabels.map(({ col, label }) => (
              <View
                key={col}
                style={[styles.monthCell, dynamicStyles.monthCell, { left: col * layout.colWidth }]}
                pointerEvents="none"
              >
                <Text style={styles.monthLabel} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
          <View style={[styles.grid, dynamicStyles.grid]}>
            {Array.from({ length: cols }, (_, c) => (
              <View key={c} style={[styles.column, dynamicStyles.column]}>
                {Array.from({ length: ROWS }, (_, r) => {
                  const idx = c * ROWS + r;
                  const day = cells[idx];
                  if (!day) return <View key={r} style={[styles.cell, dynamicStyles.cell]} />;
                  const isToday = day.date === today;
                  const levelClamped = Math.min(4, Math.max(0, day.level));
                  const color = HEATMAP_LEVELS[levelClamped] ?? HEATMAP_LEVELS[0];
                  return (
                    <Pressable
                      key={r}
                      style={[
                        styles.cell,
                        dynamicStyles.cell,
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
  },
  dayLabelsColumn: {
    width: DAY_LABEL_WIDTH,
    backgroundColor: "transparent",
  },
  dayLabelRow: {
    height: MONTH_ROW_HEIGHT,
  },
  dayLabelsGrid: {
    flexDirection: "column",
  },
  dayLabelCellFlex: {
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
  gridWrap: {},
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
  },
  column: {
    flexDirection: "column",
  },
  cell: {
    marginBottom: GAP,
  },
  todayCell: {
    borderWidth: 1,
    borderColor: COLORS.violet,
  },
});
