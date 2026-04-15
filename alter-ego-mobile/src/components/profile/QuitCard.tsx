/**
 * QuitCard v3 — Ember aesthetic. Day count is the hero.
 * Prompt F1 redesign — auto-advance only, richer readiness context.
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { QuitPhase, QuitTarget } from "@/types/quits";
import { PHASE_CONFIG, phaseOrder } from "@/types/quits";
import { QUIT_ORANGE } from "@/constants/missionColors";

const PHASE_KEYS = ["mapping", "disruption", "consolidation"] as const;

const POSITIVE = "#A78BFA";
type StrategyChoice = "none" | "helped" | "not_helped";

function urgeBarOpacity(level: number, maxLevel: number): number {
  if (maxLevel === 0) return 0.3;
  return 0.25 + (level / 5) * 0.65;
}

function displayTag(raw: string): string {
  const s = raw.replace(/_/g, " ").trim();
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : raw;
}

type Props = {
  target: QuitTarget;
  onFrequencyLog: (pathId: string, count: number) => void | Promise<void>;
  onCheckinLog?: (pathId: string, body: { checkin_type: "response_used"; free_text?: string }) => void | Promise<void>;
  onMenuPress: () => void;
  onInsightPress?: (title: string, body: string) => void;
  onCardPress?: () => void;
};

export function QuitCard({
  target,
  onFrequencyLog,
  onCheckinLog,
  onMenuPress,
  onInsightPress,
  onCardPress,
}: Props) {
  const phase = target.current_phase;
  const cfg = PHASE_CONFIG[phase];
  const phaseIdx = phaseOrder(phase);

  const [localCount, setLocalCount] = useState(target.frequency_today);
  const [saving, setSaving] = useState(false);
  const [strategyUsed, setStrategyUsed] = useState<StrategyChoice>("none");

  useEffect(() => {
    setLocalCount(target.frequency_today);
  }, [target.frequency_today, target.path_id]);

  const hist = target.frequency_history.slice(-7);
  const microCounts = [...hist.map((h) => h.count), target.frequency_today];
  const maxC = Math.max(...microCounts, 1);

  const handleLog = async () => {
    setSaving(true);
    try {
      await Promise.resolve(onFrequencyLog(target.path_id, localCount));
      if (strategyUsed !== "none" && onCheckinLog) {
        await Promise.resolve(
          onCheckinLog(target.path_id, {
            checkin_type: "response_used",
            free_text: strategyUsed === "helped" ? "helped" : "not_helped",
          })
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const topTriggers = target.top_triggers?.length
    ? target.top_triggers.slice(0, 3)
    : (target.trigger_profile.contexts || []).slice(0, 3).map((c) => ({ tag: c, count: 0 }));

  const urgeTrend = target.urge_trend || [];
  const maxUrge = Math.max(...urgeTrend.map((u) => u.level), 1);

  const trendText = (() => {
    if (target.frequency_reduction_pct > 0) {
      return { text: `↓ ${target.frequency_reduction_pct}% fewer`, color: POSITIVE };
    }
    if (phase === "mapping") {
      return { text: "Tracking", color: "#6B7280" };
    }
    return { text: "Monitoring", color: "#6B7280" };
  })();

  const urgeTrendVerdict = (() => {
    if (urgeTrend.length >= 2) {
      const first = urgeTrend[0].level;
      const last = urgeTrend[urgeTrend.length - 1].level;
      if (last < first - 0.5) {
        return { text: "Easier vs start", color: POSITIVE };
      }
      if (last > first + 0.5) {
        return { text: "↑ Increasing", color: "#F87171" };
      }
      return { text: "→ Stable", color: "#9CA3AF" };
    }
    return null;
  })();

  const openFirstInsight = useCallback(() => {
    const ins = target.insights[0];
    if (ins && onInsightPress) {
      onInsightPress(ins.title, ins.body);
    }
  }, [target.insights, onInsightPress]);

  return (
    <Pressable
      style={styles.card}
      onPress={onCardPress ?? undefined}
      disabled={!onCardPress}
    >
      <View style={styles.cardContent}>
      <LinearGradient
        colors={["transparent", "rgba(249,115,22,0.28)", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topEdge}
      />
      <View style={styles.bottomEmber} />

      <Text style={styles.ghostNum} pointerEvents="none">
        {target.days_active}
      </Text>

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {target.habit_name}
          </Text>
          <Pressable
            onPress={(e) => {
              e?.stopPropagation?.();
              onMenuPress();
            }}
            style={styles.menuBtn}
            hitSlop={8}
          >
            <Text style={styles.menuDots}>⋯</Text>
          </Pressable>
        </View>

        <View style={styles.pillRow}>
          <View style={styles.phasePill}>
            <Text style={styles.phasePillText}>{cfg.name}</Text>
          </View>
          <View
            style={[
              styles.trendPill,
              {
                backgroundColor:
                  trendText.color === POSITIVE ? "rgba(139,92,246,0.08)" : "rgba(107,114,128,0.08)",
                borderColor:
                  trendText.color === POSITIVE ? "rgba(139,92,246,0.22)" : "rgba(107,114,128,0.2)",
              },
            ]}
          >
            <Text style={[styles.trendText, { color: trendText.color }]}>{trendText.text}</Text>
          </View>
        </View>

        <View style={styles.dayCountRow}>
          <Text style={styles.dayNum}>{target.days_active}</Text>
          <Text style={styles.dayUnit}>days</Text>
        </View>

        {topTriggers.length > 0 ? (
          <View style={styles.triggerRow}>
            {topTriggers.map((t, i) => (
              <View key={`${t.tag}-${i}`} style={[styles.tChip, i === 0 && styles.tChipHot]}>
                <Text style={[styles.tChipText, i === 0 && styles.tChipTextHot]}>
                  {displayTag(t.tag)}
                  {t.count > 0 ? (
                    <Text style={styles.tChipCount}> ×{t.count}</Text>
                  ) : null}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {target.status === "referral_only" && (target.referral_message || "").trim().length > 0 ? (
        <View style={styles.referralBanner}>
          <Text style={styles.referralTitle}>Professional support recommended</Text>
          <Text style={styles.referralBody}>{target.referral_message}</Text>
          <Text style={styles.referralSub}>
            You can still log frequency below as a journal. Resistance missions stay paused here.
          </Text>
        </View>
      ) : null}

      {urgeTrend.length > 0 ? (
        <View style={styles.urgeStrip}>
          <View style={styles.urgeBars}>
            {urgeTrend.map((u, i) => (
              <View
                key={i}
                style={[
                  styles.uBar,
                  {
                    height: Math.max(4, (u.level / 5) * 28),
                    opacity: urgeBarOpacity(u.level, maxUrge),
                  },
                ]}
              />
            ))}
          </View>
          {urgeTrendVerdict ? (
            <Text style={[styles.urgeTrendText, { color: urgeTrendVerdict.color }]} numberOfLines={1}>
              {urgeTrendVerdict.text}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.phaseContextCard}>
        <Text style={styles.phaseContextTitle}>PHASE CONTEXT</Text>
        <Text style={styles.phaseContextBody}>
          {target.need_description?.trim() || cfg.description}
        </Text>
        {target.competing_response ? (
          <Text style={styles.phaseContextFoot}>Competing response: {target.competing_response}</Text>
        ) : null}
        {!!target.phase_readiness?.criteria?.length ? (
          <View style={styles.readinessList}>
            {target.phase_readiness.criteria.slice(0, 3).map((c, idx) => (
              <Text key={`${c.label}-${idx}`} style={[styles.readinessItem, c.met && styles.readinessMet]}>
                {c.met ? "✓" : "○"} {c.label}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.freqStrip}>
        <View style={styles.freqTopRow}>
          <Text style={styles.freqLabel}>TODAY - URGES FELT</Text>
          <View style={styles.microBars}>
            {microCounts.map((c, i) => {
              const isToday = i === microCounts.length - 1;
              const h = Math.max(3, (c / maxC) * 16);
              return (
                <View
                  key={i}
                  style={[
                    styles.mBar,
                    {
                      height: h,
                      backgroundColor: isToday ? QUIT_ORANGE.primary : "rgba(249,115,22,0.22)",
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.freqBottomRow}>
          <View style={styles.freqCtrl}>
            <Pressable
              onPress={(e) => {
                e?.stopPropagation?.();
                setLocalCount((c) => Math.max(0, c - 1));
              }}
              style={styles.fBtn}
              hitSlop={4}
            >
              <Text style={styles.fBtnText}>−</Text>
            </Pressable>
            <Text style={styles.fVal}>{localCount}</Text>
            <Pressable
              onPress={(e) => {
                e?.stopPropagation?.();
                setLocalCount((c) => c + 1);
              }}
              style={styles.fBtn}
              hitSlop={4}
            >
              <Text style={styles.fBtnText}>+</Text>
            </Pressable>
          </View>

          <View style={styles.freqLogWrap}>
            <Text style={styles.freqHint}>Select strategy result, then log</Text>
            <Pressable
              onPress={(e) => {
                e?.stopPropagation?.();
                void handleLog();
              }}
              disabled={saving}
              style={styles.logBtn}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.logBtnText}>Log</Text>
              )}
            </Pressable>
          </View>
        </View>
        <View style={styles.strategyRow}>
          <Text style={styles.strategyLabel}>Strategy used?</Text>
          <View style={styles.strategyToggles}>
            {[
              { key: "none", label: "Skip" },
              { key: "helped", label: "Helped" },
              { key: "not_helped", label: "Not helped" },
            ].map((item) => {
              const active = strategyUsed === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setStrategyUsed(item.key as StrategyChoice)}
                  style={[styles.strategyChip, active && styles.strategyChipActive]}
                >
                  <Text style={[styles.strategyChipText, active && styles.strategyChipTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.phaseDots}>
        {PHASE_KEYS.map((key, idx) => {
          const order = idx + 1;
          const isDone = order < phaseIdx;
          const isActive = order === phaseIdx;
          const isLocked = order > phaseIdx;
          const isLast = idx === PHASE_KEYS.length - 1;
          const pk = key as QuitPhase;
          return (
            <View key={key} style={styles.pdStep}>
              {!isLast ? <View style={[styles.pdLine, isDone && styles.pdLineDone]} /> : null}
              <View
                style={[
                  styles.pdDot,
                  isDone && styles.pdDotDone,
                  isActive && styles.pdDotActive,
                  isLocked && styles.pdDotLocked,
                ]}
              >
                {isDone ? (
                  <Text style={styles.pdCheck}>✓</Text>
                ) : isActive ? (
                  <View style={styles.pdInner} />
                ) : null}
              </View>
              <Text
                style={[
                  styles.pdLabel,
                  isDone && styles.pdLabelDone,
                  isActive && styles.pdLabelActive,
                  isLocked && styles.pdLabelLocked,
                ]}
              >
                {PHASE_CONFIG[pk].name.split(" ")[0]}
              </Text>
            </View>
          );
        })}
      </View>

      {onInsightPress && target.insights.length > 0 ? (
        <View style={styles.preserveRow}>
          <Pressable onPress={(e) => { e?.stopPropagation?.(); openFirstInsight(); }} style={styles.preserveLink}>
            <Text style={styles.preserveLinkTxt}>Insights ({target.insights.length})</Text>
          </Pressable>
          <Text style={styles.autoAdvanceTxt}>Phase moves automatically when readiness is met</Text>
        </View>
      ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    marginBottom: 14,
    backgroundColor: "#0E0804",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.12)",
    overflow: "hidden",
    position: "relative",
  },
  cardContent: {},
  topEdge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    zIndex: 2,
  },
  bottomEmber: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 0,
    backgroundColor: "rgba(249,115,22,0.03)",
  },
  ghostNum: {
    position: "absolute",
    right: -10,
    top: -6,
    fontFamily: "Inter_900Black",
    fontSize: 150,
    fontWeight: "900",
    lineHeight: 150,
    color: "rgba(249,115,22,0.05)",
    letterSpacing: -8,
    zIndex: 0,
  },
  body: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 0, zIndex: 1 },
  nameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  name: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 22,
    fontWeight: "800",
    color: "#E5E7EB",
    letterSpacing: 0.3,
    lineHeight: 26,
    flex: 1,
  },
  menuBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuDots: { fontSize: 15, color: "#6B7280", marginTop: -2 },
  pillRow: { flexDirection: "row", gap: 7, marginBottom: 12 },
  phasePill: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 20,
    backgroundColor: "rgba(249,115,22,0.1)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.25)",
  },
  phasePillText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "rgba(253,186,116,0.8)",
    fontFamily: "Inter_700Bold",
  },
  trendPill: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  trendText: { fontSize: 9, fontWeight: "700", fontFamily: "Inter_700Bold" },
  dayCountRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 4 },
  dayNum: {
    fontFamily: "Inter_900Black",
    fontSize: 72,
    fontWeight: "900",
    lineHeight: 72,
    letterSpacing: -3,
    color: "#F97316",
  },
  dayUnit: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(249,115,22,0.4)",
    marginBottom: 6,
  },
  triggerRow: { flexDirection: "row", gap: 5, flexWrap: "wrap", marginBottom: 0, paddingBottom: 14 },
  tChip: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 6,
    backgroundColor: "rgba(249,115,22,0.07)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.14)",
  },
  tChipHot: {
    backgroundColor: "rgba(249,115,22,0.13)",
    borderColor: "rgba(249,115,22,0.28)",
  },
  tChipText: {
    fontSize: 10,
    fontWeight: "500",
    color: "rgba(253,186,116,0.55)",
    fontFamily: "Inter_500Medium",
  },
  tChipTextHot: { color: "rgba(251,146,60,0.85)" },
  tChipCount: { fontSize: 9, color: "rgba(249,115,22,0.4)" },
  referralBanner: {
    marginHorizontal: 14,
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(127,29,29,0.12)",
    borderWidth: 1,
    borderColor: QUIT_ORANGE.border,
    zIndex: 1,
  },
  referralTitle: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#FCA5A5",
    marginBottom: 6,
  },
  referralBody: { fontSize: 11, color: "#9CA3AF", lineHeight: 17 },
  referralSub: { fontSize: 10, color: "#6B7280", marginTop: 8, lineHeight: 15 },
  urgeStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.04)",
    zIndex: 1,
  },
  urgeBars: { flexDirection: "row", gap: 3, alignItems: "flex-end", height: 28, flex: 1 },
  uBar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 3,
    backgroundColor: QUIT_ORANGE.primary,
  },
  urgeTrendText: {
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    maxWidth: 100,
  },
  freqStrip: {
    flexDirection: "column",
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 10,
    zIndex: 1,
  },
  phaseContextCard: {
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
    backgroundColor: "rgba(139,92,246,0.08)",
    padding: 10,
  },
  phaseContextTitle: {
    fontSize: 10,
    color: "#C4B5FD",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  phaseContextBody: {
    fontSize: 11,
    color: "#D1D5DB",
    lineHeight: 16,
    fontFamily: "Inter_400Regular",
  },
  phaseContextFoot: {
    marginTop: 6,
    fontSize: 10,
    color: "#A78BFA",
    fontFamily: "Inter_500Medium",
  },
  readinessList: { marginTop: 8, gap: 4 },
  readinessItem: {
    fontSize: 10,
    color: "#9CA3AF",
    fontFamily: "Inter_500Medium",
  },
  readinessMet: { color: "#A78BFA" },
  freqTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  freqBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  strategyRow: {
    marginTop: 4,
    gap: 6,
  },
  strategyLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    fontFamily: "Inter_600SemiBold",
  },
  strategyToggles: {
    flexDirection: "row",
    gap: 6,
  },
  strategyChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(107,114,128,0.3)",
    backgroundColor: "rgba(17,24,39,0.4)",
  },
  strategyChipActive: {
    borderColor: "rgba(139,92,246,0.6)",
    backgroundColor: "rgba(139,92,246,0.18)",
  },
  strategyChipText: {
    fontSize: 10,
    color: "#9CA3AF",
    fontFamily: "Inter_600SemiBold",
  },
  strategyChipTextActive: { color: "#E9D5FF" },
  freqLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#374151",
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  microBars: { flexDirection: "row", gap: 2, alignItems: "flex-end", height: 16 },
  mBar: { width: 6, borderRadius: 1 },
  freqCtrl: { flexDirection: "row", alignItems: "center", gap: 8 },
  freqLogWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  freqHint: {
    fontSize: 9,
    color: "rgba(249,115,22,0.3)",
    fontWeight: "500",
    fontStyle: "italic",
  },
  fBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "rgba(249,115,22,0.08)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  fBtnText: { fontSize: 16, color: "rgba(249,115,22,0.7)", fontWeight: "300" },
  fVal: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 26,
    fontWeight: "900",
    color: "#E5E7EB",
    minWidth: 22,
    textAlign: "center",
    lineHeight: 28,
  },
  logBtn: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 9,
    backgroundColor: "#EA580C",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(249,115,22,0.4)",
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  logBtnText: { fontSize: 11, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold" },
  phaseDots: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.04)",
    paddingTop: 12,
    zIndex: 1,
  },
  pdStep: { flex: 1, alignItems: "center", gap: 5, position: "relative" },
  pdLine: {
    position: "absolute",
    top: 6,
    left: "50%",
    width: "100%",
    height: 1,
    backgroundColor: "rgba(42,48,80,0.4)",
  },
  pdLineDone: { backgroundColor: "rgba(249,115,22,0.35)" },
  pdDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pdDotDone: {
    backgroundColor: "rgba(249,115,22,0.4)",
    borderWidth: 1.5,
    borderColor: "rgba(249,115,22,0.7)",
  },
  pdDotActive: {
    backgroundColor: "rgba(249,115,22,0.15)",
    borderWidth: 2,
    borderColor: "rgba(249,115,22,0.9)",
    shadowColor: "rgba(249,115,22,0.5)",
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  pdDotLocked: {
    backgroundColor: "rgba(30,36,55,0.8)",
    borderWidth: 1.5,
    borderColor: "rgba(42,48,80,0.5)",
  },
  pdCheck: { fontSize: 7, fontWeight: "800", color: "rgba(249,115,22,0.8)" },
  pdInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: QUIT_ORANGE.primary },
  pdLabel: {
    fontSize: 8,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.3,
    fontFamily: "Inter_600SemiBold",
  },
  pdLabelDone: { color: "#374151" },
  pdLabelActive: { color: "rgba(249,115,22,0.7)" },
  pdLabelLocked: { color: "#1E2337" },
  preserveRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 14,
    zIndex: 1,
  },
  preserveLink: { paddingVertical: 6 },
  preserveLinkTxt: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#9CA3AF",
  },
  autoAdvanceTxt: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#6B7280",
  },
});
