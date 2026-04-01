/**
 * InterestDetailScreen — Arc timeline, milestones, and manage actions.
 * Shown as a modal from InterestsTab when tapping an interest card.
 */
import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { InterestPathDisplay } from "@/types/interestPath";
import { getInterestColorByHex } from "@/constants/missionColors";
import { hexWithAlpha } from "@/utils/interestColor";

const ARC_PHASES = ["Foundation", "Building", "Applying", "Mastery"];
const ARC_PHASE_KEYS = ["foundation", "building", "applying", "mastery"];

const MILESTONE_DEFS = [
  { key: "first_session", label: "First session" },
  { key: "sessions_7", label: "7 sessions — one week" },
  { key: "arc_25pct", label: "25% of goal sessions" },
  { key: "foundation_complete", label: "Foundation phase complete" },
  { key: "arc_50pct", label: "50% of goal sessions — halfway" },
  { key: "building_complete", label: "Building phase complete" },
  { key: "sessions_25", label: "25 total sessions" },
  { key: "arc_75pct", label: "75% of goal sessions" },
  { key: "applying_complete", label: "Applying phase complete" },
  { key: "sessions_50", label: "50 total sessions" },
  { key: "arc_goal_reached", label: "Goal reached" },
];

function getMilestoneStatus(
  key: string,
  sessionsCompleted: number,
  totalPlanned: number | null | undefined,
  currentPhase: string
): "done" | "next" | "locked" {
  const pct = totalPlanned ? sessionsCompleted / totalPlanned : 0;
  const phaseIdx = ARC_PHASE_KEYS.indexOf(currentPhase);

  if (key === "first_session") return sessionsCompleted >= 1 ? "done" : "next";
  if (key === "sessions_7")
    return sessionsCompleted >= 7 ? "done" : sessionsCompleted >= 1 ? "next" : "locked";
  if (key === "arc_25pct") return pct >= 0.25 ? "done" : pct >= 0.1 ? "next" : "locked";
  if (key === "foundation_complete")
    return phaseIdx >= 1 ? "done" : currentPhase === "foundation" ? "next" : "locked";
  if (key === "arc_50pct") return pct >= 0.5 ? "done" : pct >= 0.35 ? "next" : "locked";
  if (key === "building_complete")
    return phaseIdx >= 2 ? "done" : currentPhase === "building" ? "next" : "locked";
  if (key === "sessions_25")
    return sessionsCompleted >= 25 ? "done" : sessionsCompleted >= 20 ? "next" : "locked";
  if (key === "arc_75pct") return pct >= 0.75 ? "done" : pct >= 0.6 ? "next" : "locked";
  if (key === "applying_complete")
    return phaseIdx >= 3 ? "done" : currentPhase === "applying" ? "next" : "locked";
  if (key === "sessions_50")
    return sessionsCompleted >= 50 ? "done" : sessionsCompleted >= 40 ? "next" : "locked";
  if (key === "arc_goal_reached")
    return totalPlanned && sessionsCompleted >= totalPlanned ? "done" : "locked";
  return "locked";
}

export type InterestDetailScreenProps = {
  path: InterestPathDisplay;
  onClose: () => void;
  onPause: () => void;
  onResume: () => void;
  onChangeSchedule: () => void;
  onChangeTimeline: () => void;
  onChangeGoal: () => void;
};

export function InterestDetailScreen({
  path,
  onClose,
  onPause,
  onResume,
  onChangeSchedule,
  onChangeTimeline,
  onChangeGoal,
}: InterestDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const scheme = getInterestColorByHex(
    path.color_hex?.startsWith("#") ? path.color_hex : `#${path.color_hex ?? "8B5CF6"}`
  );
  const C = scheme.primary;

  const sessions = path.sessions_completed ?? 0;
  const total = path.total_planned_sessions ?? null;
  const phase = path.current_arc_phase ?? "no_deadline";
  const phaseIdx = ARC_PHASE_KEYS.indexOf(phase);
  const pct = total ? Math.min(100, Math.round((sessions / total) * 100)) : null;

  const targetDateStr = (() => {
    if (!path.target_date) return null;
    try {
      const d = new Date(path.target_date);
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return path.target_date;
    }
  })();

  const sessionsRemaining = total ? Math.max(0, total - sessions) : null;

  const thisPhaseSessions =
    total && phaseIdx >= 0
      ? Math.max(0, sessions - Math.floor(total * (phaseIdx / 4)))
      : sessions;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={["#09091A", "#07080F"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.headerBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#6B7280" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerName}>{path.interest_name}</Text>
          <Text style={[styles.headerPhase, { color: hexWithAlpha(C, "AA") }]}>
            {path.arc_phase_label ?? "Open Practice"} · Session {sessions}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.arcCard}>
          <Text style={styles.arcCardTitle}>Learning Arc</Text>

          <View style={styles.ringRow}>
            <View style={styles.ringWrap}>
              <View style={styles.ringOuter}>
                <View style={[styles.ringInner, { borderColor: hexWithAlpha(C, "30") }]}>
                  <Text style={styles.ringPct}>{pct != null ? `${pct}%` : "—"}</Text>
                  <Text style={styles.ringPctLabel}>TO GOAL</Text>
                </View>
              </View>
              <View
                style={[
                  styles.ringProgress,
                  {
                    borderTopColor: C,
                    borderRightColor: (pct ?? 0) > 25 ? C : "transparent",
                    borderBottomColor: (pct ?? 0) > 50 ? C : "transparent",
                    borderLeftColor: (pct ?? 0) > 75 ? C : "transparent",
                  },
                ]}
              />
            </View>
            <View style={styles.ringMeta}>
              <Text style={styles.ringPhaseLabel}>{path.arc_phase_label ?? "Open Practice"}</Text>
              <Text style={styles.ringSessionsText}>
                {sessions}
                {total ? ` of ${total} sessions complete` : " sessions complete"}
              </Text>
              {targetDateStr ? (
                <Text style={styles.ringTargetDate}>Target: {targetDateStr}</Text>
              ) : null}
              {sessionsRemaining != null ? (
                <Text style={[styles.ringRemaining, { color: hexWithAlpha(C, "80") }]}>
                  ~{sessionsRemaining} sessions remaining
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.phaseBlocks}>
            {ARC_PHASES.map((label, i) => {
              const isDone = phaseIdx > i;
              const isActive = phaseIdx === i;
              return (
                <View
                  key={label}
                  style={[
                    styles.phaseBlock,
                    isDone && {
                      backgroundColor: hexWithAlpha(C, "30"),
                      borderColor: hexWithAlpha(C, "50"),
                    },
                    isActive && { backgroundColor: hexWithAlpha(C, "1A"), borderColor: C },
                    !isDone && !isActive && styles.phaseBlockLocked,
                  ]}
                >
                  <Text
                    style={[
                      styles.phaseBlockText,
                      isDone && { color: hexWithAlpha(C, "CC") },
                      isActive && { color: C },
                      !isDone && !isActive && { color: "#2A3050" },
                    ]}
                  >
                    {label.slice(0, 5)}.
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{sessions}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
            <View style={[styles.statItem, styles.statItemBorder]}>
              <Text style={[styles.statVal, { color: C }]}>{thisPhaseSessions}</Text>
              <Text style={styles.statLabel}>This phase</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { fontSize: 14, color: "#6B7280" }]}>
                {path.target_date
                  ? new Date(path.target_date).toLocaleDateString("en-US", {
                      month: "short",
                      year: "2-digit",
                    })
                  : "—"}
              </Text>
              <Text style={styles.statLabel}>Goal date</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Milestones</Text>
          {MILESTONE_DEFS.map((def, i) => {
            const status = getMilestoneStatus(def.key, sessions, total, phase);
            return (
              <View
                key={def.key}
                style={[styles.msRow, i === MILESTONE_DEFS.length - 1 && styles.msRowLast]}
              >
                <View
                  style={[
                    styles.msDot,
                    status === "done" && {
                      backgroundColor: C,
                      shadowColor: C,
                      shadowOpacity: 0.5,
                      shadowRadius: 4,
                    },
                    status === "next" && {
                      backgroundColor: "transparent",
                      borderWidth: 1.5,
                      borderColor: C,
                    },
                    status === "locked" && {
                      backgroundColor: "rgba(42,48,80,0.4)",
                      borderColor: "rgba(42,48,80,0.3)",
                      borderWidth: 1,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.msText,
                    status === "done" && { color: "#9CA3AF" },
                    status === "next" && { color: "#E5E7EB" },
                    status === "locked" && { color: "#374151" },
                  ]}
                >
                  {def.label}
                </Text>
                {status === "done" ? (
                  <Text style={[styles.msBadge, { color: hexWithAlpha(C, "80") }]}>Done</Text>
                ) : null}
                {status === "next" ? (
                  <Text style={[styles.msBadge, { color: C }]}>Next</Text>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manage</Text>
          <View style={styles.actionsRow}>
            <Pressable style={styles.actionBtn} onPress={onChangeSchedule}>
              <Text style={styles.actionBtnText}>Adjust schedule</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={onChangeTimeline}>
              <Text style={styles.actionBtnText}>Change timeline</Text>
            </Pressable>
          </View>
          <View style={[styles.actionsRow, { marginTop: 8 }]}>
            <Pressable style={styles.actionBtn} onPress={onChangeGoal}>
              <Text style={styles.actionBtnText}>Change goal</Text>
            </Pressable>
            <Pressable
              style={[
                styles.actionBtn,
                path.arc_paused ? styles.actionBtnResume : styles.actionBtnPause,
              ]}
              onPress={path.arc_paused ? onResume : onPause}
            >
              <Text
                style={[
                  styles.actionBtnText,
                  path.arc_paused ? { color: hexWithAlpha(C, "AA") } : { color: "#6B7280" },
                ]}
              >
                {path.arc_paused ? "Resume" : "Pause"}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.35)",
    backgroundColor: "rgba(9,9,26,0.7)",
  },
  headerBack: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1 },
  headerName: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#E5E7EB" },
  headerPhase: { fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginTop: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },
  arcCard: {
    backgroundColor: "rgba(20,24,36,0.6)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.4)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  arcCardTitle: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#6B7280",
    marginBottom: 14,
  },
  ringRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 14 },
  ringWrap: { width: 80, height: 80, position: "relative" },
  ringOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  ringInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  ringProgress: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: "transparent",
  },
  ringPct: { fontSize: 13, fontFamily: "Inter_800ExtraBold", color: "#E5E7EB" },
  ringPctLabel: { fontSize: 7, letterSpacing: 0.5, color: "#6B7280", marginTop: 1 },
  ringMeta: { flex: 1 },
  ringPhaseLabel: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#E5E7EB", marginBottom: 3 },
  ringSessionsText: { fontSize: 12, color: "#9CA3AF" },
  ringTargetDate: { fontSize: 11, color: "#4B5563", marginTop: 3 },
  ringRemaining: { fontSize: 10, fontFamily: "Inter_600SemiBold", marginTop: 5 },
  phaseBlocks: { flexDirection: "row", gap: 4, marginBottom: 14 },
  phaseBlock: {
    flex: 1,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  phaseBlockLocked: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderColor: "rgba(42,48,80,0.3)",
  },
  phaseBlockText: { fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  statsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(42,48,80,0.3)",
    paddingTop: 12,
  },
  statItem: { flex: 1, alignItems: "center" },
  statItemBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(42,48,80,0.3)",
  },
  statVal: {
    fontSize: 18,
    fontFamily: "Inter_800ExtraBold",
    color: "#E5E7EB",
    lineHeight: 22,
  },
  statLabel: {
    fontSize: 9,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 2,
  },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#6B7280",
    marginBottom: 10,
  },
  msRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.2)",
  },
  msRowLast: { borderBottomWidth: 0 },
  msDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  msText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  msBadge: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  actionsRow: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.5)",
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnPause: { borderColor: "rgba(42,48,80,0.5)" },
  actionBtnResume: {
    borderColor: "rgba(139,92,246,0.25)",
    backgroundColor: "rgba(139,92,246,0.05)",
  },
  actionBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#6B7280" },
});
