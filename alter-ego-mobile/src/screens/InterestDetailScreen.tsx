/**
 * Interest detail — full-screen stack route (Profile → Interests → card).
 * Manage sheets open on the interests list via navigation params.
 */
import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation, StackActions, CommonActions } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { InterestPathDisplay } from "@/types/interestPath";
import type { ProfileStackParamList } from "@/navigation/types";
import { useInterests, usePauseInterest, useResumeInterest } from "@/hooks/useInterests";
import { getInterestColorByHex } from "@/constants/missionColors";
import { hexWithAlpha } from "@/utils/interestColor";

const PHASE_DESCRIPTIONS: Record<string, { title: string; desc: string }> = {
  foundation: {
    title: "Foundation",
    desc: "Show up consistently. Build the habit of doing this.",
  },
  building: {
    title: "Building",
    desc: "Produce specific outputs. Quality starts to matter.",
  },
  applying: {
    title: "Applying",
    desc: "Push past your comfort zone. Productive challenge.",
  },
  mastery: { title: "Mastery", desc: "Perform at an identity level. This is who you are now." },
  no_deadline: {
    title: "Open Practice",
    desc: "No goal set — showing up is the practice.",
  },
};

const ALL_PHASES = ["foundation", "building", "applying", "mastery"] as const;

const MILESTONE_LIST: Array<{ sessions: number; label: string; emoji: string }> = [
  { sessions: 1, label: "First session", emoji: "🌱" },
  { sessions: 7, label: "7 sessions — one week", emoji: "🔥" },
  { sessions: 25, label: "25 total sessions", emoji: "⚡" },
  { sessions: 50, label: "50 total sessions", emoji: "🎯" },
  { sessions: 100, label: "100 total sessions", emoji: "🏆" },
];

const DAY_LABELS_FULL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type InterestDetailScreenProps = {
  path: InterestPathDisplay;
  onClose: () => void;
  onPause: () => void;
  onResume: () => void;
  onChangeSchedule: () => void;
  onChangeTimeline: () => void;
  onChangeGoal: () => void;
};

export function InterestDetailScreen() {
  const route = useRoute<RouteProp<ProfileStackParamList, "ProfileInterestDetail">>();
  const navigation = useNavigation<StackNavigationProp<ProfileStackParamList>>();
  const { pathId } = route.params;
  const { data, isLoading } = useInterests();
  const path = data?.paths.find((p) => p.path_id === pathId);
  const pauseInterest = usePauseInterest();
  const resumeInterest = useResumeInterest();

  const openPending = (sheet: "schedule" | "goal" | "timeline") => {
    // Pop this detail screen first — navigate() alone can push a second ProfileInterests on top.
    navigation.dispatch(StackActions.pop(1));
    queueMicrotask(() => {
      navigation.dispatch(
        CommonActions.navigate({
          name: "ProfileInterests",
          params: { pendingSheet: sheet, pathId },
        })
      );
    });
  };

  if (isLoading && !data) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#07080F",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  if (!path) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#07080F",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Text style={{ color: "#9CA3AF", textAlign: "center", fontSize: 14 }}>
          Couldn&apos;t find this interest.
        </Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 20, alignSelf: "center", padding: 12 }}>
          <Text style={{ color: "#A78BFA", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <InterestDetailLayout
      path={path}
      onClose={() => navigation.goBack()}
      onPause={() => pauseInterest.mutate({ interestId: path.path_id })}
      onResume={() => resumeInterest.mutate(path.path_id)}
      onChangeSchedule={() => openPending("schedule")}
      onChangeTimeline={() => openPending("timeline")}
      onChangeGoal={() => openPending("goal")}
    />
  );
}

function InterestDetailLayout({
  path,
  onClose,
  onPause,
  onResume,
  onChangeSchedule,
  onChangeTimeline,
  onChangeGoal,
}: InterestDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const colorHex = path.color_hex?.startsWith("#") ? path.color_hex : `#${path.color_hex ?? "8B5CF6"}`;
  const scheme = getInterestColorByHex(colorHex);
  const C = scheme.primary;

  const sessions = path.sessions_completed ?? 0;
  const streak = path.interest_streak ?? 0;
  const activity = path.last_7_days_activity ?? Array(7).fill(false);
  const phase = path.current_arc_phase ?? "no_deadline";
  const phaseInfo = PHASE_DESCRIPTIONS[phase] ?? PHASE_DESCRIPTIONS.no_deadline;
  const daysIn = path.days_since_created ?? 1;
  const phaseIdx = ALL_PHASES.indexOf(phase as (typeof ALL_PHASES)[number]);

  const targetDateStr = path.target_date
    ? (() => {
        try {
          return new Date(path.target_date).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          });
        } catch {
          return null;
        }
      })()
    : null;

  const nextMs = MILESTONE_LIST.find((m) => sessions < m.sessions) ?? null;
  const doneMilestones = MILESTONE_LIST.filter((m) => sessions >= m.sessions);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={["#09091A", "#07080F"]} style={StyleSheet.absoluteFill} />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.headerBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#6B7280" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerName}>{path.interest_name}</Text>
          <Text style={[styles.headerSub, { color: hexWithAlpha(C, "AA") }]}>
            Day {daysIn} of your journey
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── SESSION HERO CARD ── */}
        <View
          style={[
            styles.heroCard,
            { backgroundColor: hexWithAlpha(C, "0A"), borderColor: hexWithAlpha(C, "22") },
          ]}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroSessionsRow}>
              <Text style={[styles.heroNum, { color: C }]}>{sessions}</Text>
              <Text style={styles.heroSessionsLabel}>sessions{"\n"}completed</Text>
            </View>
            <View
              style={[
                styles.heroPhasePill,
                { backgroundColor: hexWithAlpha(C, "14"), borderColor: hexWithAlpha(C, "30") },
              ]}
            >
              <View style={[styles.heroPhaseDot, { backgroundColor: C }]} />
              <Text style={[styles.heroPhaseText, { color: C }]}>{phaseInfo.title}</Text>
            </View>
          </View>
          <Text style={styles.heroPhaseDesc}>{phaseInfo.desc}</Text>

          <View style={styles.phaseBarRow}>
            {ALL_PHASES.map((p, i) => {
              const isDone = phaseIdx > i;
              const isActive = phaseIdx === i;
              return (
                <View key={p} style={styles.phaseBarItem}>
                  <View
                    style={[
                      styles.phaseBarSeg,
                      isDone && { backgroundColor: hexWithAlpha(C, "40") },
                      isActive && {
                        backgroundColor: hexWithAlpha(C, "25"),
                        borderColor: C,
                        borderWidth: 1,
                      },
                      !isDone && !isActive && styles.phaseBarSegLocked,
                    ]}
                  />
                  <Text
                    style={[
                      styles.phaseBarLabel,
                      isActive && { color: C, fontWeight: "700" },
                      isDone && { color: hexWithAlpha(C, "80") },
                    ]}
                  >
                    {PHASE_DESCRIPTIONS[p].title.slice(0, 5)}.
                  </Text>
                </View>
              );
            })}
          </View>
          {!targetDateStr && (
            <Text style={styles.noGoalNote}>No goal date set — open practice</Text>
          )}
        </View>

        {/* ── STATS ROW ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, styles.statBoxBorder]}>
            <Text style={[styles.statVal, { color: C }]}>{streak}</Text>
            <Text style={styles.statLbl}>Day streak</Text>
            <Text style={styles.statSub}>days in a row</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxBorder]}>
            <Text style={styles.statVal}>{sessions}</Text>
            <Text style={styles.statLbl}>Total sessions</Text>
            <Text style={styles.statSub}>since you started</Text>
          </View>
          <View style={styles.statBox}>
            {targetDateStr ? (
              <>
                <Text style={[styles.statVal, { fontSize: 14 }]}>
                  {new Date(path.target_date!).toLocaleDateString("en-US", {
                    month: "short",
                    year: "2-digit",
                  })}
                </Text>
                <Text style={styles.statLbl}>Goal date</Text>
                <Text style={styles.statSub}>target</Text>
              </>
            ) : (
              <>
                <Text style={[styles.statVal, { color: "#4B5563", fontSize: 13 }]}>—</Text>
                <Text style={styles.statLbl}>Goal date</Text>
                <Text style={styles.statSub}>not set</Text>
              </>
            )}
          </View>
        </View>

        {/* ── 7-DAY HEATMAP ── */}
        <View style={styles.heatmapCard}>
          <View style={styles.heatmapHdr}>
            <Text style={styles.sectionTitle}>Last 7 days</Text>
            {streak > 0 ? (
              <Text style={[styles.streakBadge, { color: C }]}>🔥 {streak}-day streak</Text>
            ) : null}
          </View>
          <View style={styles.heatmapDays}>
            {DAY_LABELS_FULL.map((label, i) => {
              const done = activity[i] === true;
              const isToday = i === 6;
              return (
                <View key={i} style={styles.heatmapDay}>
                  <Text style={styles.heatmapDayLabel}>{label}</Text>
                  <View
                    style={[
                      styles.heatmapPip,
                      done
                        ? {
                            backgroundColor: hexWithAlpha(C, "28"),
                            borderColor: hexWithAlpha(C, "50"),
                            borderWidth: 1,
                          }
                        : {
                            backgroundColor: "rgba(255,255,255,0.02)",
                            borderColor: "#1E2333",
                            borderWidth: 1,
                          },
                      isToday && done && { borderColor: C, borderWidth: 1.5 },
                      isToday && !done && { borderColor: hexWithAlpha(C, "40"), borderWidth: 1.5 },
                    ]}
                  >
                    {done ? <Ionicons name="checkmark" size={12} color={C} /> : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── NEXT MILESTONE ── */}
        <View style={styles.milestoneCard}>
          <Text style={styles.sectionTitle}>Your next milestone</Text>
          {nextMs ? (
            <View
              style={[
                styles.nextMsRow,
                { backgroundColor: hexWithAlpha(C, "08"), borderColor: hexWithAlpha(C, "20") },
              ]}
            >
              <View style={[styles.nextMsIcon, { backgroundColor: hexWithAlpha(C, "18") }]}>
                <Text style={{ fontSize: 18 }}>{nextMs.emoji}</Text>
              </View>
              <View style={styles.nextMsInfo}>
                <Text style={styles.nextMsName}>{nextMs.label}</Text>
                <Text style={styles.nextMsSub}>
                  {nextMs.sessions - sessions} more session{nextMs.sessions - sessions !== 1 ? "s" : ""}{" "}
                  to go
                </Text>
              </View>
              <Text style={[styles.nextMsPct, { color: C }]}>
                {sessions}/{nextMs.sessions}
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.nextMsRow,
                {
                  backgroundColor: "rgba(16,185,129,0.08)",
                  borderColor: "rgba(16,185,129,0.2)",
                },
              ]}
            >
              <View style={[styles.nextMsIcon, { backgroundColor: "rgba(16,185,129,0.15)" }]}>
                <Text style={{ fontSize: 18 }}>🏆</Text>
              </View>
              <Text style={[styles.nextMsName, { color: "#6EE7B7" }]}>All milestones reached</Text>
            </View>
          )}

          {doneMilestones.length > 0 ? (
            <>
              <Text style={styles.doneMsLabel}>Completed</Text>
              <View style={styles.doneMsRow}>
                {doneMilestones.map((m) => (
                  <View key={m.sessions} style={styles.doneMsPill}>
                    <Ionicons name="checkmark" size={9} color="#10B981" />
                    <Text style={styles.doneMsText}>{m.label}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </View>

        {/* ── PHASE GUIDE ── */}
        <View style={styles.phaseGuideCard}>
          <Text style={styles.sectionTitle}>Your learning arc</Text>
          {ALL_PHASES.map((p, i) => {
            const isDone = phaseIdx > i;
            const isActive = phase === p;
            const info = PHASE_DESCRIPTIONS[p];
            return (
              <View
                key={p}
                style={[
                  styles.phaseGuideRow,
                  isActive && {
                    backgroundColor: hexWithAlpha(C, "0A"),
                    borderColor: hexWithAlpha(C, "22"),
                    borderWidth: 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.phaseGuideDot,
                    isDone && { backgroundColor: hexWithAlpha(C, "60") },
                    isActive && { backgroundColor: C },
                    !isDone && !isActive && { backgroundColor: "#2A3050" },
                  ]}
                />
                <View style={styles.phaseGuideInfo}>
                  <Text
                    style={[
                      styles.phaseGuideName,
                      isActive && { color: C, fontWeight: "700" },
                      isDone && { color: "#6B7280" },
                      !isDone && !isActive && { color: "#374151" },
                    ]}
                  >
                    {info.title}
                    {isActive ? (
                      <Text style={{ fontSize: 9, fontWeight: "500", color: hexWithAlpha(C, "80") }}>
                        {" "}
                        ← you are here
                      </Text>
                    ) : (
                      ""
                    )}
                  </Text>
                  {isActive || isDone ? (
                    <Text style={[styles.phaseGuideDesc, isDone && { color: "#374151" }]}>
                      {info.desc}
                    </Text>
                  ) : (
                    <Text style={[styles.phaseGuideDesc, { color: "#2A3050" }]}>{info.desc}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* ── MANAGE ACTIONS ── */}
        <View style={styles.manageSection}>
          <Text style={styles.sectionTitle}>Manage</Text>
          <View style={styles.manageGrid}>
            <Pressable style={styles.manageBtn} onPress={onChangeSchedule}>
              <Text style={styles.manageBtnText}>Adjust schedule</Text>
            </Pressable>
            <Pressable style={styles.manageBtn} onPress={onChangeTimeline}>
              <Text style={styles.manageBtnText}>Change timeline</Text>
            </Pressable>
            <Pressable style={styles.manageBtn} onPress={onChangeGoal}>
              <Text style={styles.manageBtnText}>Change goal</Text>
            </Pressable>
            <Pressable
              style={[
                styles.manageBtn,
                path.arc_paused && {
                  borderColor: hexWithAlpha(C, "25"),
                  backgroundColor: hexWithAlpha(C, "06"),
                },
              ]}
              onPress={path.arc_paused ? onResume : onPause}
            >
              <Text style={[styles.manageBtnText, path.arc_paused && { color: C }]}>
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
  headerName: { fontSize: 16, fontWeight: "700", color: "#E5E7EB" },
  headerSub: { fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginTop: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },

  heroCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 },
  heroSessionsRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  heroNum: { fontSize: 52, fontWeight: "900", letterSpacing: -2, lineHeight: 56 },
  heroSessionsLabel: { fontSize: 13, color: "#9CA3AF", lineHeight: 18 },
  heroPhasePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  heroPhaseDot: { width: 6, height: 6, borderRadius: 3 },
  heroPhaseText: { fontSize: 11, fontWeight: "700" },
  heroPhaseDesc: { fontSize: 12, color: "#6B7280", lineHeight: 18, marginBottom: 14 },
  phaseBarRow: { flexDirection: "row", gap: 4, marginBottom: 6 },
  phaseBarItem: { flex: 1, alignItems: "center", gap: 3 },
  phaseBarSeg: { width: "100%", height: 5, borderRadius: 3 },
  phaseBarSegLocked: { backgroundColor: "rgba(42,48,80,0.25)" },
  phaseBarLabel: { fontSize: 7, fontWeight: "600", color: "#374151", letterSpacing: 0.3 },
  noGoalNote: { fontSize: 9, color: "#374151", textAlign: "right", marginTop: 4 },

  statsRow: {
    flexDirection: "row",
    backgroundColor: "#111623",
    borderWidth: 1,
    borderColor: "#1E2333",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
  },
  statBox: { flex: 1, paddingVertical: 12, alignItems: "center" },
  statBoxBorder: { borderRightWidth: 1, borderRightColor: "#1E2333" },
  statVal: { fontSize: 20, fontWeight: "900", color: "#E5E7EB", lineHeight: 24 },
  statLbl: {
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#6B7280",
    marginTop: 2,
  },
  statSub: { fontSize: 9, color: "#374151", marginTop: 1 },

  heatmapCard: {
    backgroundColor: "#111623",
    borderWidth: 1,
    borderColor: "#1E2333",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  heatmapHdr: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  streakBadge: { fontSize: 11, fontWeight: "700" },
  heatmapDays: { flexDirection: "row", gap: 5 },
  heatmapDay: { flex: 1, alignItems: "center", gap: 4 },
  heatmapDayLabel: { fontSize: 8, fontWeight: "600", color: "#374151" },
  heatmapPip: { width: "100%", aspectRatio: 1, borderRadius: 6, alignItems: "center", justifyContent: "center" },

  milestoneCard: {
    backgroundColor: "#111623",
    borderWidth: 1,
    borderColor: "#1E2333",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  nextMsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  nextMsIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  nextMsInfo: { flex: 1 },
  nextMsName: { fontSize: 13, fontWeight: "700", color: "#E5E7EB", marginBottom: 2 },
  nextMsSub: { fontSize: 11, color: "#6B7280" },
  nextMsPct: { fontSize: 12, fontWeight: "800", flexShrink: 0 },
  doneMsLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#374151",
    marginBottom: 8,
  },
  doneMsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  doneMsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 20,
    backgroundColor: "rgba(16,185,129,0.08)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.18)",
  },
  doneMsText: { fontSize: 10, fontWeight: "600", color: "#6EE7B7" },

  phaseGuideCard: {
    backgroundColor: "#111623",
    borderWidth: 1,
    borderColor: "#1E2333",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  phaseGuideRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 8,
    borderRadius: 10,
    marginBottom: 4,
  },
  phaseGuideDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  phaseGuideInfo: { flex: 1 },
  phaseGuideName: { fontSize: 12, fontWeight: "600", color: "#E5E7EB", marginBottom: 1 },
  phaseGuideDesc: { fontSize: 11, color: "#6B7280", lineHeight: 16 },

  manageSection: { marginBottom: 8 },
  manageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  manageBtn: {
    width: "47%",
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  manageBtnText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },

  sectionTitle: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#6B7280",
    marginBottom: 10,
  },
});
