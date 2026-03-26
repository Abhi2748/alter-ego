import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import type { QuitMission, QuitPhase, QuitTarget } from "@/types/quits";
import { PHASE_CONFIG, phaseOrder, awarenessDisplay } from "@/types/quits";
import { QUIT_ORANGE } from "@/constants/missionColors";

const PHASE_KEYS: QuitPhase[] = ["mapping", "disruption", "consolidation"];
const INSIGHT_SLOTS = 5;

function missionEmoji(m: QuitMission): string {
  const t = m.mission_category ?? m.mission_type ?? "observation";
  if (t === "observation") return "📓";
  if (t === "competing_response") return "✊";
  return "🔒→✓";
}

function nodeState(phase: QuitPhase, current: QuitPhase): "done" | "active" | "locked" {
  const o = phaseOrder(phase);
  const c = phaseOrder(current);
  if (o < c) return "done";
  if (o === c) return "active";
  return "locked";
}

function barColorForPhase(phase: QuitPhase): string {
  if (phase === "mapping") return "rgba(139,92,246,0.4)";
  if (phase === "disruption") return QUIT_ORANGE.border2;
  return "rgba(45,212,191,0.4)";
}

function phaseDeep(phase: QuitPhase): string {
  if (phase === "mapping") return "#6D28D9";
  if (phase === "disruption") return QUIT_ORANGE.deep;
  return "#14B8A6";
}

type Props = {
  target: QuitTarget;
  onFrequencyLog: (pathId: string, count: number) => void | Promise<void>;
  onMenuPress: () => void;
  onInsightPress?: (title: string, body: string) => void;
  onAdvancePhase?: () => void;
  advancing?: boolean;
};

export function QuitCard({
  target,
  onFrequencyLog,
  onMenuPress,
  onInsightPress,
  onAdvancePhase,
  advancing,
}: Props) {
  const phase = target.current_phase;
  const cfg = PHASE_CONFIG[phase];
  const barFill = barColorForPhase(phase);

  const [localCount, setLocalCount] = useState(target.frequency_today);
  const [saving, setSaving] = useState(false);
  const [missionDone, setMissionDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(target.missions.map((m) => [m.id, m.completed]))
  );

  useEffect(() => {
    setLocalCount(target.frequency_today);
  }, [target.frequency_today, target.path_id]);

  useEffect(() => {
    setMissionDone(Object.fromEntries(target.missions.map((m) => [m.id, m.completed])));
  }, [target.path_id, target.missions]);

  const hist = target.frequency_history.slice(-7);
  const barCounts = useMemo(
    () => [...hist.map((h) => h.count), target.frequency_today],
    [hist, target.frequency_today]
  );
  const maxC = Math.max(...barCounts, 1);

  const pulse = useSharedValue(0.5);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const triggerLabel = target.trigger_profile.contexts[0] ?? "—";
  const phaseIdx = phaseOrder(phase);

  const trendText =
    target.frequency_reduction_pct > 0 ? (
      <Text style={styles.trendDown}>↓{target.frequency_reduction_pct}%</Text>
    ) : phase === "mapping" ? (
      <Text style={styles.trendGrey}>Mapping</Text>
    ) : (
      <Text style={styles.trendGrey}>Tracking</Text>
    );

  const logSave = async () => {
    setSaving(true);
    try {
      await Promise.resolve(onFrequencyLog(target.path_id, localCount));
    } finally {
      setSaving(false);
    }
  };

  const toggleMission = (id: string) => {
    setMissionDone((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={["transparent", QUIT_ORANGE.border2, "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.cardTopGlow}
        pointerEvents="none"
      />

      <View style={styles.headerRow}>
        <View style={styles.initialsBlock}>
          <Text style={styles.initialsText}>{target.initials}</Text>
        </View>
        <View style={styles.metaCol}>
          <Text style={styles.habitName}>{target.habit_name}</Text>
          <Text style={styles.habitSub} numberOfLines={2}>
            {target.trigger_profile.contexts.length
              ? target.trigger_profile.contexts.join(" · ")
              : "Complete trigger mapping"}
          </Text>
          <View style={styles.tagsRow}>
            <View style={[styles.tagPhase, { backgroundColor: cfg.colorBg, borderColor: cfg.colorBorder }]}>
              <Text style={[styles.tagPhaseTxt, { color: cfg.color }]}>
                Phase {phaseIdx} · {cfg.name}
              </Text>
            </View>
            <View style={styles.tagTrigger}>
              <Text style={styles.tagTriggerTxt} numberOfLines={1}>
                Trigger: {triggerLabel}
              </Text>
            </View>
            <View style={styles.tagAware}>
              <Text style={styles.tagAwareTxt} numberOfLines={1}>
                {awarenessDisplay(target.trigger_profile.awareness)}
              </Text>
            </View>
          </View>
        </View>
        <Pressable onPress={onMenuPress} style={styles.menuBtn} hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={18} color="#9CA3AF" />
        </Pressable>
      </View>

      <View style={styles.freqRow}>
        <Text style={styles.thisWeekLbl}>This Week</Text>
        <View style={styles.barChart}>
          {barCounts.map((c, i) => {
            const isToday = i === barCounts.length - 1;
            const h = Math.max(3, (c / maxC) * 28);
            const emptyToday = isToday && c === 0;
            return (
              <View key={`b-${i}`} style={styles.barCell}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: h,
                      backgroundColor: emptyToday ? "transparent" : barFill,
                      borderWidth: emptyToday ? 1 : 0,
                      borderStyle: emptyToday ? "dashed" : "solid",
                      borderColor: emptyToday ? QUIT_ORANGE.border : "transparent",
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
        <View style={styles.todayCol}>
          <Text style={[styles.todayNum, { color: cfg.color }]}>{target.frequency_today}</Text>
          <Text style={styles.todayLbl}>TODAY</Text>
        </View>
        <View style={styles.trendCol}>{trendText}</View>
      </View>

      {target.trigger_profile.contexts.length > 0 ? (
        <View style={styles.triggerCard}>
          <LinearGradient
            colors={["transparent", "rgba(245,158,11,0.3)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.triggerCardGlow}
          />
          <Text style={styles.triggerCardHdr}>🎯 YOUR TRIGGER PROFILE</Text>
          <View style={styles.triggerRow}>
            <View style={styles.amberDot} />
            <Text style={styles.triggerItemTxt}>
              When: {target.trigger_profile.contexts.join(" · ")}
            </Text>
          </View>
          <View style={styles.triggerRow}>
            <View style={styles.amberDot} />
            <Text style={styles.triggerItemTxt}>
              Awareness: {awarenessDisplay(target.trigger_profile.awareness)}
            </Text>
          </View>
        </View>
      ) : null}

      {target.status === "referral_only" && (target.referral_message || "").trim().length > 0 ? (
        <View style={styles.referralBanner}>
          <Text style={styles.referralTitle}>Professional support recommended</Text>
          <Text style={styles.referralBody}>{target.referral_message}</Text>
          <Text style={styles.referralSub}>
            You can still log frequency below as a journal. Resistance missions stay paused here.
          </Text>
        </View>
      ) : null}

      <View style={[styles.phaseCard, { borderColor: cfg.colorBorder }]}>
        <LinearGradient
          colors={[cfg.color, phaseDeep(phase)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.phaseAccentBar}
        />
        <View style={styles.phaseHeader}>
          <View style={styles.phaseHeaderLeft}>
            <Animated.View style={[styles.pulseDot, { backgroundColor: cfg.color }, pulseStyle]} />
            <View>
              <Text style={[styles.activePhaseLbl, { color: cfg.color }]}>ACTIVE PHASE</Text>
              <Text style={styles.phaseName}>{cfg.name}</Text>
            </View>
          </View>
          <View style={styles.phaseBadge}>
            <Text style={styles.phaseBadgeTxt}>
              Phase {phaseIdx} / 3
            </Text>
          </View>
        </View>
        <Text style={styles.phaseDesc}>{cfg.description}</Text>

        <Text style={styles.missionsSectionLbl}>TODAY&apos;S MISSIONS</Text>
        {target.missions.map((m) => {
          const done = missionDone[m.id] ?? m.completed;
          return (
            <Pressable
              key={m.id}
              style={styles.missionRow}
              onPress={() => toggleMission(m.id)}
            >
              <View style={styles.missionIcon}>
                <Text style={styles.missionEmoji}>{missionEmoji(m)}</Text>
              </View>
              <View style={styles.missionTextCol}>
                <Text style={styles.missionTitle}>{m.title}</Text>
                <Text style={styles.missionDesc}>{m.description}</Text>
              </View>
              <View
                style={[
                  styles.checkbox,
                  done && styles.checkboxOn,
                ]}
              >
                {done ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
            </Pressable>
          );
        })}

        <View style={styles.loggerBlock}>
          <View style={styles.loggerLeft}>
            <Text style={styles.loggerLbl}>
              {target.frequency_unit === "minutes" ? "Minutes today:" : "Times today:"}
            </Text>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepBtn}
                onPress={() => setLocalCount((n) => Math.max(0, n - 1))}
              >
                <Text style={styles.stepBtnTxt}>−</Text>
              </Pressable>
              <Text style={styles.stepCount}>{localCount}</Text>
              <Pressable style={styles.stepBtn} onPress={() => setLocalCount((n) => n + 1)}>
                <Text style={styles.stepBtnTxt}>+</Text>
              </Pressable>
            </View>
          </View>
          <Pressable style={styles.logSaveBtn} onPress={logSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={QUIT_ORANGE.primary} size="small" />
            ) : (
              <Text style={styles.logSaveTxt}>Log & Save</Text>
            )}
          </Pressable>
        </View>

        {target.status === "active" && phase !== "consolidation" && onAdvancePhase ? (
          <Pressable
            style={[styles.phaseAdvanceBtn, advancing && { opacity: 0.6 }]}
            onPress={onAdvancePhase}
            disabled={advancing}
          >
            {advancing ? (
              <ActivityIndicator color="#A78BFA" size="small" />
            ) : (
              <Text style={styles.phaseAdvanceTxt}>I&apos;ve moved past this phase →</Text>
            )}
          </Pressable>
        ) : null}
      </View>

      <View style={styles.pathStrip}>
        <View style={styles.pathStripHeader}>
          <Text style={styles.pathStripTitle}>YOUR PATH</Text>
          <Text style={styles.pathStripFrac}>
            {phaseIdx} / 3 Phases
          </Text>
        </View>
        <View style={styles.pathNodesRow}>
          {PHASE_KEYS.map((p, i) => {
            const st = nodeState(p, phase);
            const pc = PHASE_CONFIG[p];
            const isLast = i === PHASE_KEYS.length - 1;
            const lineDone = phaseOrder(phase) > phaseOrder(p);
            return (
              <React.Fragment key={p}>
                <View style={styles.pathNodeCol}>
                  <View
                    style={[
                      styles.pathDot,
                      st === "done" && styles.pathDotDone,
                      st === "active" && {
                        backgroundColor: pc.colorBg,
                        borderWidth: 2,
                        borderColor: pc.color,
                        shadowColor: pc.color,
                        shadowOpacity: 0.45,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 0 },
                        elevation: 6,
                      },
                      st === "locked" && styles.pathDotLocked,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pathDotTxt,
                        st === "done" && { color: QUIT_ORANGE.primary },
                        st === "active" && { color: pc.color, fontFamily: "Inter_700Bold" },
                        st === "locked" && { color: "#2E2020" },
                      ]}
                    >
                      {st === "done" ? "✓" : String(i + 1)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.pathLbl,
                      st === "active" && { color: pc.color, fontFamily: "Inter_700Bold" },
                      st === "done" && { color: "#6B7280" },
                      st === "locked" && { color: "#2E2020" },
                    ]}
                    numberOfLines={2}
                  >
                    {p === "mapping" ? "Mapping" : p === "disruption" ? "Disruption" : "Consolidation"}
                  </Text>
                </View>
                {!isLast ? (
                  <View
                    style={[
                      styles.pathLineFlex,
                      lineDone ? styles.pathLineDone : styles.pathLinePending,
                    ]}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statNum}>{target.days_active}</Text>
          <Text style={styles.statLbl}>Days Active</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          {target.frequency_reduction_pct > 0 ? (
            <Text style={styles.statNumGreen}>↓{target.frequency_reduction_pct}%</Text>
          ) : (
            <Text style={styles.statNumMuted}>Tracking</Text>
          )}
          <Text style={styles.statLbl}>Freq. Drop</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={styles.statNum}>{target.insights.length}</Text>
          <Text style={styles.statLbl}>Insights</Text>
        </View>
      </View>

      <View style={styles.insightsStrip}>
        <View style={styles.insightsHeader}>
          <Text style={styles.insightsHdrLbl}>INSIGHTS EARNED</Text>
          <Text style={styles.insightsHdrCount}>
            {target.insights.length} / {INSIGHT_SLOTS}
          </Text>
        </View>
        <View style={styles.insightsDots}>
          {Array.from({ length: INSIGHT_SLOTS }).map((_, i) => {
            const ins = target.insights[i];
            const unlocked = !!ins;
            return (
              <Pressable
                key={i}
                style={[
                  styles.insightDot,
                  unlocked ? styles.insightDotOn : styles.insightDotOff,
                ]}
                disabled={!unlocked}
                onPress={() => ins && onInsightPress?.(ins.title, ins.body)}
              >
                <Text style={[styles.insightDotTxt, !unlocked && { color: "#2E2020", fontSize: 9 }]}>
                  {unlocked ? "💡" : "?"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0C0A0A",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    marginBottom: 14,
    overflow: "hidden",
    position: "relative",
  },
  cardTopGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    zIndex: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingTop: 14,
    paddingHorizontal: 14,
  },
  initialsBlock: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: QUIT_ORANGE.surface,
    borderWidth: 1,
    borderColor: QUIT_ORANGE.border,
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: {
    fontSize: 13,
    fontFamily: "Inter_800ExtraBold",
    color: QUIT_ORANGE.primary,
  },
  metaCol: { flex: 1, minWidth: 0 },
  habitName: { fontSize: 16, fontFamily: "Inter_800ExtraBold", color: "#E5E7EB" },
  habitSub: { fontSize: 11, color: "#6B7280", marginTop: 4, lineHeight: 15 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tagPhase: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  tagPhaseTxt: { fontSize: 9, fontFamily: "Inter_700Bold" },
  tagTrigger: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(245,158,11,0.08)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.20)",
    maxWidth: "48%",
  },
  tagTriggerTxt: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#F59E0B" },
  tagAware: { paddingVertical: 4, maxWidth: "100%" },
  tagAwareTxt: { fontSize: 9, color: "#6B7280", fontFamily: "Inter_500Medium" },
  menuBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  freqRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.04)",
    marginTop: 10,
  },
  thisWeekLbl: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#9CA3AF",
    flexShrink: 0,
    marginRight: 4,
    marginBottom: 4,
    width: 56,
  },
  barChart: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 28,
  },
  barCell: { flex: 1, height: 28, justifyContent: "flex-end" },
  bar: {
    width: "100%",
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    minHeight: 3,
  },
  todayCol: { flexShrink: 0, alignItems: "center", gap: 2 },
  todayNum: { fontSize: 18, fontFamily: "Inter_800ExtraBold" },
  todayLbl: { fontSize: 8, color: "#6B7280", textTransform: "uppercase" },
  trendCol: { flexShrink: 0, minWidth: 52, alignItems: "flex-end", marginBottom: 2 },
  trendDown: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#22C55E" },
  trendGrey: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#6B7280" },
  referralBanner: {
    marginHorizontal: 12,
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(127,29,29,0.12)",
    borderWidth: 1,
    borderColor: QUIT_ORANGE.border,
  },
  referralTitle: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#FCA5A5",
    marginBottom: 6,
  },
  referralBody: {
    fontSize: 11,
    color: "#9CA3AF",
    lineHeight: 17,
  },
  referralSub: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 8,
    lineHeight: 15,
  },
  referralMissionNote: {
    fontSize: 11,
    color: "#6B7280",
    paddingLeft: 8,
    marginBottom: 8,
    lineHeight: 16,
  },
  phaseAdvanceBtn: {
    marginTop: 12,
    marginLeft: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  phaseAdvanceTxt: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#A78BFA",
  },
  triggerCard: {
    marginHorizontal: 12,
    marginBottom: 0,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#090708",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.12)",
    borderRadius: 13,
    overflow: "hidden",
    position: "relative",
  },
  triggerCardGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  triggerCardHdr: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#F59E0B",
    letterSpacing: 2,
    marginBottom: 8,
  },
  triggerRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  amberDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F59E0B",
    marginTop: 4,
  },
  triggerItemTxt: { flex: 1, fontSize: 11, color: "#9CA3AF", lineHeight: 16 },
  phaseCard: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 10,
    padding: 13,
    paddingLeft: 16,
    backgroundColor: "#0F0A0A",
    borderRadius: 13,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  phaseAccentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  phaseHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingLeft: 8,
  },
  phaseHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  pulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 4,
  },
  activePhaseLbl: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  phaseName: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#E5E7EB", marginTop: 2 },
  phaseBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  phaseBadgeTxt: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#6B7280" },
  phaseDesc: {
    fontSize: 11,
    color: "#6B7280",
    lineHeight: 17,
    marginBottom: 10,
    paddingLeft: 8,
  },
  missionsSectionLbl: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#4B5563",
    letterSpacing: 1.5,
    marginBottom: 6,
    paddingLeft: 8,
  },
  missionRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: "#15100F",
    borderWidth: 1,
    borderColor: QUIT_ORANGE.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 11,
    marginBottom: 8,
    marginLeft: 8,
  },
  missionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: QUIT_ORANGE.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  missionEmoji: { fontSize: 12 },
  missionTextCol: { flex: 1, minWidth: 0 },
  missionTitle: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#E5E7EB", marginBottom: 2 },
  missionDesc: { fontSize: 10, color: "#6B7280", lineHeight: 14 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: QUIT_ORANGE.border2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  checkboxOn: {
    backgroundColor: QUIT_ORANGE.surface,
    borderColor: QUIT_ORANGE.primary,
  },
  checkMark: { color: QUIT_ORANGE.primary, fontSize: 11, fontFamily: "Inter_800ExtraBold" },
  loggerBlock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    paddingLeft: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.04)",
  },
  loggerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  loggerLbl: { fontSize: 10, color: "#6B7280" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnTxt: { color: QUIT_ORANGE.primary, fontSize: 16, fontWeight: "700" },
  stepCount: {
    minWidth: 20,
    textAlign: "center",
    fontSize: 14,
    fontFamily: "Inter_800ExtraBold",
    color: QUIT_ORANGE.primary,
  },
  logSaveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: QUIT_ORANGE.surface,
    borderWidth: 1,
    borderColor: QUIT_ORANGE.border2,
  },
  logSaveTxt: { fontSize: 11, fontFamily: "Inter_700Bold", color: QUIT_ORANGE.primary },
  pathStrip: {
    marginHorizontal: 12,
    marginBottom: 11,
    paddingVertical: 11,
    paddingHorizontal: 13,
    backgroundColor: "#090708",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    borderRadius: 13,
  },
  pathStripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  pathStripTitle: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#3D3030",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  pathStripFrac: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#6B7280" },
  pathNodesRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  pathNodeCol: { alignItems: "center", flex: 1 },
  pathDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  pathDotDone: {
    backgroundColor: QUIT_ORANGE.border2,
    borderWidth: 1.5,
    borderColor: QUIT_ORANGE.primary,
  },
  pathDotLocked: {
    backgroundColor: "#100C0C",
    borderWidth: 1.5,
    borderColor: "#1E1515",
  },
  pathDotTxt: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  pathLbl: {
    fontSize: 7,
    textAlign: "center",
    maxWidth: 56,
    marginTop: 6,
    color: "#6B7280",
  },
  pathLineFlex: {
    flex: 1,
    height: 2,
    marginTop: 10,
    minWidth: 8,
    maxHeight: 2,
  },
  pathLineDone: { backgroundColor: QUIT_ORANGE.border2 },
  pathLinePending: { backgroundColor: "#1E1515" },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.04)",
  },
  statCell: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.06)" },
  statNum: {
    fontSize: 20,
    fontFamily: "Inter_800ExtraBold",
    color: QUIT_ORANGE.primary,
  },
  statNumGreen: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#22C55E",
  },
  statNumMuted: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#6B7280" },
  statLbl: { fontSize: 9, color: "#6B7280", marginTop: 2 },
  insightsStrip: {
    marginHorizontal: 12,
    marginBottom: 13,
    paddingVertical: 11,
    paddingHorizontal: 13,
    backgroundColor: "#090708",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    borderRadius: 13,
  },
  insightsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  insightsHdrLbl: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#3D3030",
    textTransform: "uppercase",
  },
  insightsHdrCount: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#6B7280" },
  insightsDots: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  insightDot: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  insightDotOn: {
    backgroundColor: QUIT_ORANGE.surface,
    borderWidth: 1,
    borderColor: QUIT_ORANGE.border2,
    shadowColor: QUIT_ORANGE.border2,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  insightDotOff: {
    backgroundColor: "#100C0C",
    borderWidth: 1,
    borderColor: "#1A1212",
  },
  insightDotTxt: { fontSize: 12 },
});
