import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import type { InterestPathDisplay, InterestInsight } from "@/types/interestPath";
import { getInterestColorByHex } from "@/constants/missionColors";
import { hexWithAlpha } from "@/utils/interestColor";

const ARC_PHASE_DESCRIPTIONS: Record<string, string> = {
  foundation: "Foundation",
  building: "Building",
  applying: "Applying",
  mastery: "Mastery",
  no_deadline: "Open Practice",
};

const NEXT_MILESTONE_TARGETS: Array<{ sessions: number; label: string }> = [
  { sessions: 1, label: "First session" },
  { sessions: 7, label: "7 sessions — one week" },
  { sessions: 25, label: "25 total sessions" },
  { sessions: 50, label: "50 total sessions" },
  { sessions: 100, label: "100 total sessions" },
];

function getNextMilestone(sessions: number): { label: string; target: number } | null {
  const next = NEXT_MILESTONE_TARGETS.find((m) => sessions < m.sessions);
  return next ? { label: next.label, target: next.sessions } : null;
}

function lastSessionLabel(activity: boolean[]): string {
  // activity[6] = today, activity[5] = yesterday, etc.
  if (activity[6]) return "Today";
  if (activity[5]) return "Yesterday";
  for (let i = 4; i >= 0; i--) {
    if (activity[i]) return `${6 - i} days ago`;
  }
  return "Not yet this week";
}

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export type InterestCardProps = {
  path: InterestPathDisplay;
  onManage: (p: InterestPathDisplay) => void;
  onInsightTap: (ins: InterestInsight, colorHex: string) => void;
};

export function InterestCard({ path, onManage }: InterestCardProps) {
  const colorHex = path.color_hex?.startsWith("#")
    ? path.color_hex
    : `#${path.color_hex ?? "8B5CF6"}`;
  const scheme = getInterestColorByHex(colorHex);
  const C = scheme.primary;

  const sessions = path.sessions_completed ?? 0;
  const streak = path.interest_streak ?? 0;
  const activity = path.last_7_days_activity ?? Array(7).fill(false);
  const phase = path.current_arc_phase ?? "no_deadline";
  const phaseLabel = ARC_PHASE_DESCRIPTIONS[phase] ?? "Open Practice";
  const lastLabel = lastSessionLabel(activity);
  const nextMs = getNextMilestone(sessions);
  const msProgress = nextMs ? sessions / nextMs.target : 1;

  const initials = (path.interest_name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? "")
    .join("");

  const goalDisplay = path.goal_text?.trim() && path.goal_text !== "—" ? path.goal_text : null;

  return (
    <View style={[styles.card, path.arc_paused && styles.cardPaused]}>
      {/* ── TOP ROW: icon + name/goal + menu ── */}
      <View style={styles.cardMain}>
        <View style={styles.topRow}>
          <View
            style={[
              styles.iconBox,
              { backgroundColor: hexWithAlpha(C, "18"), borderColor: hexWithAlpha(C, "30") },
            ]}
          >
            <Text style={[styles.iconText, { color: C }]}>{initials}</Text>
          </View>
          <View style={styles.nameWrap}>
            <Text style={styles.nameText} numberOfLines={1}>
              {path.interest_name}
            </Text>
            {goalDisplay ? (
              <Text style={styles.goalText} numberOfLines={2}>
                {goalDisplay}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={() => onManage(path)} style={styles.menuBtn} hitSlop={8}>
            <Text style={styles.menuDots}>···</Text>
          </Pressable>
        </View>

        {/* ── PHASE BADGE + LAST SESSION ── */}
        <View style={styles.metaRow}>
          <View
            style={[
              styles.phaseBadge,
              { backgroundColor: hexWithAlpha(C, "12"), borderColor: hexWithAlpha(C, "28") },
            ]}
          >
            <View style={[styles.phaseDot, { backgroundColor: C }]} />
            <Text style={[styles.phaseLabel, { color: C }]}>{phaseLabel}</Text>
          </View>
          {path.arc_paused ? (
            <View style={styles.pausedBadge}>
              <Text style={styles.pausedBadgeText}>Paused</Text>
            </View>
          ) : (
            <View style={styles.lastSessionBadge}>
              <Text style={styles.lastSessionText}>{lastLabel}</Text>
            </View>
          )}
        </View>

        {/* ── 7-DAY ACTIVITY DOTS ── */}
        <View style={styles.activityRow}>
          <Text style={styles.activityLabel}>Last 7 days</Text>
          <View style={styles.dotsRow}>
            {DAY_LABELS.map((label, i) => {
              const done = activity[i] === true;
              const isToday = i === 6;
              return (
                <View
                  key={i}
                  style={[
                    styles.dayDot,
                    done
                      ? {
                          backgroundColor: hexWithAlpha(C, "1F"),
                          borderColor: hexWithAlpha(C, "40"),
                        }
                      : styles.dayDotEmpty,
                    isToday && done && { borderWidth: 1.5, borderColor: C },
                    isToday && !done && { borderWidth: 1.5, borderColor: hexWithAlpha(C, "50") },
                  ]}
                >
                  <Text
                    style={[styles.dayDotLabel, done ? { color: C } : styles.dayDotLabelEmpty]}
                  >
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* ── STATS STRIP ── */}
      <View style={styles.statsStrip}>
        <View style={[styles.statCell, styles.statCellBorder]}>
          <Text style={[styles.statVal, { color: C }]}>{sessions}</Text>
          <Text style={styles.statLbl}>Sessions</Text>
        </View>
        <View style={[styles.statCell, styles.statCellBorder]}>
          <Text style={styles.statVal}>{streak}</Text>
          <Text style={styles.statLbl}>Day streak</Text>
        </View>
        <View style={styles.statCell}>
          {path.target_date ? (
            <>
              <Text style={[styles.statVal, { fontSize: 13 }]}>
                {new Date(path.target_date).toLocaleDateString("en-US", {
                  month: "short",
                  year: "2-digit",
                })}
              </Text>
              <Text style={styles.statLbl}>Goal date</Text>
            </>
          ) : (
            <>
              <Text style={[styles.statVal, { color: "#4B5563", fontSize: 12 }]}>Open</Text>
              <Text style={styles.statLbl}>Timeline</Text>
            </>
          )}
        </View>
      </View>

      {/* ── NEXT MILESTONE ── */}
      {nextMs ? (
        <View style={styles.milestoneStrip}>
          <Text style={[styles.milestoneNext, { color: C }]}>Next</Text>
          <Text style={styles.milestoneLabel} numberOfLines={1}>
            {nextMs.label}
          </Text>
          <View style={styles.msBarWrap}>
            <View
              style={[
                styles.msBarFill,
                {
                  width: `${Math.min(100, msProgress * 100)}%`,
                  backgroundColor: C,
                },
              ]}
            />
          </View>
          <Text style={[styles.msCount, { color: C }]}>
            {sessions}/{nextMs.target}
          </Text>
        </View>
      ) : (
        <View style={styles.milestoneStrip}>
          <Text style={[styles.milestoneNext, { color: C }]}>✓</Text>
          <Text style={styles.milestoneLabel}>All milestones reached</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#111623",
    borderWidth: 1,
    borderColor: "#1E2333",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 12,
  },
  cardPaused: { opacity: 0.65 },
  cardMain: { padding: 14 },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconText: { fontSize: 13, fontWeight: "800" },
  nameWrap: { flex: 1 },
  nameText: { fontSize: 16, fontWeight: "800", color: "#E5E7EB", marginBottom: 2 },
  goalText: { fontSize: 11, color: "#6B7280", lineHeight: 16 },
  menuBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#1E2333",
    alignItems: "center",
    justifyContent: "center",
  },
  menuDots: { fontSize: 16, color: "#6B7280", lineHeight: 20, letterSpacing: 1 },

  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  phaseBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  phaseDot: { width: 5, height: 5, borderRadius: 3 },
  phaseLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  pausedBadge: {
    backgroundColor: "rgba(245,158,11,0.08)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.2)",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  pausedBadgeText: { fontSize: 10, fontWeight: "700", color: "#F59E0B" },
  lastSessionBadge: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "#1E2333",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  lastSessionText: { fontSize: 10, fontWeight: "600", color: "#6B7280" },

  activityRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  activityLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#374151",
    flexShrink: 0,
  },
  dotsRow: { flex: 1, flexDirection: "row", gap: 4 },
  dayDot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayDotEmpty: { backgroundColor: "rgba(255,255,255,0.02)", borderColor: "#1E2333" },
  dayDotLabel: { fontSize: 8, fontWeight: "700" },
  dayDotLabelEmpty: { color: "#374151" },

  statsStrip: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#1E2333",
    backgroundColor: "rgba(255,255,255,0.01)",
  },
  statCell: { flex: 1, paddingVertical: 10, alignItems: "center" },
  statCellBorder: { borderRightWidth: 1, borderRightColor: "#1E2333" },
  statVal: { fontSize: 17, fontWeight: "900", color: "#E5E7EB", lineHeight: 22 },
  statLbl: {
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#6B7280",
    marginTop: 2,
  },

  milestoneStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: "#1E2333",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  milestoneNext: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    flexShrink: 0,
  },
  milestoneLabel: { flex: 1, fontSize: 11, color: "#9CA3AF" },
  msBarWrap: {
    width: 48,
    height: 4,
    backgroundColor: "#1E2333",
    borderRadius: 2,
    overflow: "hidden",
    flexShrink: 0,
  },
  msBarFill: { height: "100%", borderRadius: 2 },
  msCount: { fontSize: 10, fontWeight: "800", flexShrink: 0 },
});
