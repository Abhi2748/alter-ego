/**
 * Profile → Abilities — wired to GET /api/v1/stats.
 */

import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import Svg, { Circle, G } from "react-native-svg";
import { STATS, type AbilityStatKey } from "@/constants/stats";
import { SkeletonBlock } from "@/components/SkeletonBlock";
import { useCharacterStats } from "@/hooks/useStats";
import { useProfileStreak } from "@/hooks/useProfile";
import type { StatProgress } from "@/services/stats";

const BG_CARD = "#0F111C";
const BORDER_SUB = "#1A1F30";
const TRACK = "#1E2333";
const MUTED = "#6B7280";
const TEXT = "#E5E7EB";
const TEXT2 = "#9CA3AF";

const R = 26;
const CIRC = 2 * Math.PI * R;

const CORE_KEYS: AbilityStatKey[] = ["vitality", "focus", "craft", "discipline"];
const MINI_ORDER: AbilityStatKey[] = [
  "vitality",
  "focus",
  "craft",
  "discipline",
  "willpower",
];

const WEEK_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function SectionRule({ title }: { title: string }) {
  return (
    <View style={styles.sectionRuleRow}>
      <Text style={styles.sectionRuleText}>{title}</Text>
      <View style={styles.sectionRuleLine} />
    </View>
  );
}

function StatMiniRow({ stat }: { stat: StatProgress }) {
  const s = STATS[stat.key as AbilityStatKey];
  const barPct = Math.min(1, stat.level / 10);
  return (
    <View style={styles.miniCell}>
      <Text style={styles.miniLabel}>{s.label}</Text>
      <View style={styles.miniTrack}>
        <View
          style={[
            styles.miniFill,
            {
              width: `${Math.round(barPct * 100)}%`,
              backgroundColor: s.color,
              shadowColor: s.color,
            },
          ]}
        />
      </View>
      <Text style={[styles.miniLv, { color: s.color }]}>Lv {stat.level}</Text>
    </View>
  );
}

function CoreStatCard({ stat }: { stat: StatProgress }) {
  const key = stat.key as AbilityStatKey;
  const s = STATS[key];
  const barPct = Math.min(1, stat.progress_percent / 100);
  const pctLabel = `${Math.round(stat.progress_percent)}%`;
  return (
    <View style={[styles.coreCard, { width: "48.5%" }]}>
      <View style={[styles.coreTopEdge, { backgroundColor: s.color }]} />
      <Text style={[styles.coreWatermark, { color: s.color }]}>{s.symbol}</Text>
      <View style={styles.coreHeader}>
        <View style={styles.coreHeaderLeft}>
          <View style={[styles.coreDot, { backgroundColor: s.color, shadowColor: s.color }]} />
          <Text style={styles.coreName}>{s.label}</Text>
        </View>
        <View style={styles.coreLvBadge}>
          <Text style={styles.coreLvBadgeText}>LV {stat.level}</Text>
        </View>
      </View>
      <Text style={styles.coreLevelName}>{stat.level_name}</Text>
      <View style={styles.coreSpRow}>
        <Text style={[styles.coreSpNow, { color: s.color }]}>{stat.sp_current} SP</Text>
        <Text style={styles.coreSpNext}>/ {stat.sp_for_next || "—"}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFillWrap, { width: `${Math.round(barPct * 100)}%` }]}>
          <View style={[styles.progressFill, { backgroundColor: s.color, shadowColor: s.color }]} />
          <View style={[styles.progressGlowDot, { backgroundColor: s.color, shadowColor: s.color }]} />
        </View>
      </View>
      <View style={styles.coreSourceRow}>
        <Text style={styles.coreSource}>{s.sources}</Text>
        <Text style={styles.corePct}>{pctLabel}</Text>
      </View>
    </View>
  );
}

function AbilitiesLoadingSkeleton({ embedded }: { embedded?: boolean }) {
  const Inner = (
    <>
      <SkeletonBlock width="100%" height={100} borderRadius={20} />
      <View style={{ height: 16 }} />
      <View style={styles.coreGrid}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} width="48.5%" height={120} borderRadius={16} delay={i * 40} />
        ))}
      </View>
      <SkeletonBlock width="100%" height={90} borderRadius={16} delay={160} />
    </>
  );
  if (embedded) {
    return <View style={[styles.scroll, styles.scrollContent]}>{Inner}</View>;
  }
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {Inner}
    </ScrollView>
  );
}

export function AbilitiesTab({ embedded = false }: { embedded?: boolean }) {
  const { data: stats, isLoading, isError, refetch, isFetching } = useCharacterStats();
  const { data: streakData } = useProfileStreak();

  const weekCells = useMemo(() => {
    const heat = streakData?.heatmap ?? [];
    const last7 = heat.slice(-7);
    const pad = Math.max(0, 7 - last7.length);
    const blanks = Array.from({ length: pad }, () => null as (typeof last7)[0] | null);
    const cells = [...blanks, ...last7].slice(-7);
    const todayStr = new Date().toISOString().slice(0, 10);
    return cells.map((row, i) => {
      const letter = WEEK_LETTERS[i] ?? "?";
      if (!row) {
        return { letter, kind: "future" as const };
      }
      if (row.maintained) {
        return { letter, kind: "done" as const };
      }
      if (row.date === todayStr) {
        return { letter, kind: "today" as const };
      }
      return { letter, kind: "future" as const };
    });
  }, [streakData?.heatmap]);

  if (isLoading && !stats) {
    return <AbilitiesLoadingSkeleton embedded={embedded} />;
  }

  if (isError || !stats) {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorText}>Couldn&apos;t load abilities. Tap to retry.</Text>
        <Pressable onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryText}>{isFetching ? "…" : "Retry"}</Text>
        </Pressable>
      </View>
    );
  }

  const aura = STATS.aura;
  const auraLevel = stats.aura.level;
  const levelName = stats.aura.level_name;
  const arcPct = Math.min(100, Math.max(0, stats.aura.progress_percent));
  const filled = (arcPct / 100) * CIRC;
  const gap = CIRC - filled;

  const fullDaysWeek = weekCells.filter((c) => c.kind === "done").length;

  const wp = stats.willpower;
  const wpBar = Math.min(1, wp.progress_percent / 100);

  const main = (
    <>
      <View style={styles.auraCard}>
        <LinearGradient
          colors={["transparent", "rgba(192,132,252,0.6)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.auraTopLine}
        />
        <View style={styles.auraGlowBlob} />
        <Text style={styles.auraWatermark}>{aura.symbol}</Text>

        <View style={styles.auraTopRow}>
          <View style={styles.auraTagRow}>
            <View style={[styles.auraTagDot, { backgroundColor: "#C084FC", shadowColor: "#C084FC" }]} />
            <Text style={styles.auraTagText}>AURA</Text>
          </View>
          <View style={styles.auraPill}>
            <Text style={styles.auraPillText}>Level {auraLevel}</Text>
          </View>
        </View>

        <MaskedView
          style={styles.gradientTitleMask}
          maskElement={
            <Text style={styles.gradientTitleText} numberOfLines={1}>
              {levelName}
            </Text>
          }
        >
          <LinearGradient
            colors={["#C084FC", "#A78BFA"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </MaskedView>

        <Text style={styles.auraSubtitle}>Average of all five core abilities</Text>

        <View style={styles.auraBottomRow}>
          <View style={styles.arcWrap}>
            <Svg width={64} height={64} viewBox="0 0 64 64">
              <G transform="rotate(-90 32 32)">
                <Circle cx={32} cy={32} r={R} stroke={TRACK} strokeWidth={5} fill="none" />
                <Circle
                  cx={32}
                  cy={32}
                  r={R}
                  stroke="#C084FC"
                  strokeWidth={5}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${filled},${gap}`}
                />
              </G>
            </Svg>
            <View style={styles.arcCenter} pointerEvents="none">
              <Text style={styles.arcNum}>{auraLevel}</Text>
              <Text style={styles.arcOf}>of 10</Text>
            </View>
          </View>

          <View style={styles.miniGrid}>
            {MINI_ORDER.map((k) => (
              <StatMiniRow key={k} stat={stats[k]} />
            ))}
          </View>
        </View>
      </View>

      <SectionRule title="CORE ABILITIES" />
      <View style={styles.coreGrid}>
        {CORE_KEYS.map((k) => (
          <CoreStatCard key={k} stat={stats[k]} />
        ))}
      </View>

      <SectionRule title="DAILY AMBITION" />
      <View style={styles.willCard}>
        <View style={[styles.coreTopEdge, { backgroundColor: "#EF4444" }]} />
        <Text style={[styles.willWatermark, { color: "#EF4444" }]}>{STATS.willpower.symbol}</Text>
        <View style={styles.willInner}>
          <View style={styles.willLeft}>
            <View style={styles.coreHeader}>
              <View style={styles.coreHeaderLeft}>
                <View
                  style={[
                    styles.coreDot,
                    { backgroundColor: "#EF4444", shadowColor: "#EF4444" },
                  ]}
                />
                <Text style={styles.coreName}>WILLPOWER</Text>
              </View>
              <View style={styles.coreLvBadge}>
                <Text style={styles.coreLvBadgeText}>LV {wp.level}</Text>
              </View>
            </View>
            <Text style={styles.willLevelTitle}>{wp.level_name}</Text>
            <View style={styles.coreSpRow}>
              <Text style={[styles.coreSpNow, { color: "#EF4444" }]}>{wp.sp_current} SP</Text>
              <Text style={styles.coreSpNext}>/ {wp.sp_for_next || "—"}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFillWrap, { width: `${Math.round(wpBar * 100)}%` }]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: "#EF4444", shadowColor: "#EF4444" },
                  ]}
                />
                <View
                  style={[
                    styles.progressGlowDot,
                    { backgroundColor: "#EF4444", shadowColor: "#EF4444" },
                  ]}
                />
              </View>
            </View>
            <Text style={styles.willSource}>
              Today: {stats.missions_completed_today}/{Math.max(1, stats.total_missions_today)} missions
            </Text>
          </View>
          <View style={styles.willRight}>
            <Text style={styles.weekLbl}>LAST 7 DAYS</Text>
            <View style={styles.weekRow}>
              {weekCells.map((x, i) => (
                <View
                  key={i}
                  style={[
                    styles.dayBox,
                    x.kind === "done" && styles.dayDone,
                    x.kind === "today" && styles.dayToday,
                    x.kind === "future" && styles.dayFuture,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayLetter,
                      x.kind === "done" && styles.dayLetterDone,
                      x.kind === "today" && styles.dayLetterToday,
                      x.kind === "future" && styles.dayLetterFuture,
                    ]}
                  >
                    {x.letter}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.fullDaysHint}>{fullDaysWeek} full days (streak view) ↑</Text>
          </View>
        </View>
      </View>
    </>
  );

  if (embedded) {
    return <View style={[styles.scroll, styles.scrollContent]}>{main}</View>;
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {main}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  errorWrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    marginBottom: 16,
    fontFamily: "Inter_500Medium",
  },
  retryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_SUB,
    backgroundColor: BG_CARD,
  },
  retryText: { fontSize: 14, color: TEXT2, fontFamily: "Inter_600SemiBold" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 100 },
  auraCard: {
    backgroundColor: BG_CARD,
    borderWidth: 1,
    borderColor: "rgba(192,132,252,0.25)",
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
    marginBottom: 16,
    position: "relative",
  },
  auraTopLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  auraGlowBlob: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(192,132,252,0.1)",
  },
  auraWatermark: {
    position: "absolute",
    right: 16,
    top: "50%",
    marginTop: -45,
    fontSize: 90,
    fontWeight: "900",
    color: "rgba(192,132,252,0.06)",
    fontFamily: "Inter_800ExtraBold",
    zIndex: 0,
  },
  auraTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    zIndex: 1,
  },
  auraTagRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  auraTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  auraTagText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#C084FC",
    textTransform: "uppercase",
    fontFamily: "Inter_700Bold",
  },
  auraPill: {
    backgroundColor: "rgba(192,132,252,0.1)",
    borderWidth: 1,
    borderColor: "rgba(192,132,252,0.25)",
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  auraPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#C084FC",
    fontFamily: "Inter_700Bold",
  },
  gradientTitleMask: {
    alignSelf: "stretch",
    height: 36,
    marginBottom: 4,
    justifyContent: "center",
    zIndex: 1,
  },
  gradientTitleText: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1,
    color: "#000000",
    fontFamily: "Inter_800ExtraBold",
  },
  auraSubtitle: {
    fontSize: 12,
    color: MUTED,
    marginBottom: 16,
    zIndex: 1,
  },
  auraBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    zIndex: 1,
  },
  arcWrap: { width: 64, height: 64, position: "relative" },
  arcCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  arcNum: { fontSize: 13, fontWeight: "800", color: "#C084FC", fontFamily: "Inter_800ExtraBold" },
  arcOf: { fontSize: 8, fontWeight: "500", color: MUTED, fontFamily: "Inter_500Medium" },
  miniGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  miniCell: { width: "33%", paddingRight: 6, marginBottom: 8 },
  miniLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: 2,
    fontFamily: "Inter_600SemiBold",
  },
  miniTrack: {
    height: 3,
    backgroundColor: TRACK,
    borderRadius: 3,
    overflow: "hidden",
  },
  miniFill: {
    height: "100%",
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 2,
  },
  miniLv: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
    fontFamily: "Inter_700Bold",
  },
  sectionRuleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  sectionRuleText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    color: MUTED,
    textTransform: "uppercase",
    fontFamily: "Inter_700Bold",
  },
  sectionRuleLine: { flex: 1, height: 1, backgroundColor: TRACK },
  coreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  coreCard: {
    backgroundColor: BG_CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER_SUB,
    padding: 14,
    overflow: "hidden",
    position: "relative",
    marginBottom: 0,
  },
  coreTopEdge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.8,
  },
  coreWatermark: {
    position: "absolute",
    right: 10,
    bottom: 6,
    fontSize: 52,
    fontWeight: "900",
    opacity: 0.07,
    fontFamily: "Inter_800ExtraBold",
  },
  coreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  coreHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  coreDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 5,
    elevation: 3,
  },
  coreName: {
    fontSize: 11,
    fontWeight: "700",
    color: TEXT2,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: "Inter_700Bold",
  },
  coreLvBadge: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  coreLvBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: MUTED,
    fontFamily: "Inter_700Bold",
  },
  coreLevelName: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: TEXT,
    marginBottom: 2,
    fontFamily: "Inter_800ExtraBold",
  },
  coreSpRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 10 },
  coreSpNow: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold" },
  coreSpNext: { fontSize: 10, color: "#4B5563", fontFamily: "Inter_500Medium" },
  progressTrack: {
    height: 3,
    backgroundColor: TRACK,
    borderRadius: 3,
    overflow: "visible",
    position: "relative",
  },
  progressFillWrap: {
    height: 3,
    borderRadius: 3,
    position: "relative",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    width: "100%",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 2,
  },
  progressGlowDot: {
    position: "absolute",
    right: -3,
    top: -1.5,
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 3,
  },
  coreSourceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 5,
  },
  coreSource: { fontSize: 9, color: MUTED, fontFamily: "Inter_500Medium" },
  corePct: { fontSize: 9, color: "#4B5563", fontFamily: "Inter_500Medium" },
  willCard: {
    backgroundColor: BG_CARD,
    borderWidth: 1,
    borderColor: BORDER_SUB,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    overflow: "hidden",
    position: "relative",
    marginBottom: 24,
  },
  willWatermark: {
    position: "absolute",
    right: 16,
    bottom: 4,
    fontSize: 70,
    fontWeight: "900",
    opacity: 0.07,
    fontFamily: "Inter_800ExtraBold",
  },
  willInner: { flexDirection: "row", alignItems: "center", gap: 16, zIndex: 1 },
  willLeft: { flex: 1, minWidth: 0 },
  willLevelTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: TEXT,
    marginBottom: 6,
    fontFamily: "Inter_800ExtraBold",
  },
  willSource: { fontSize: 9, color: MUTED, marginTop: 6, fontFamily: "Inter_500Medium" },
  willRight: { alignItems: "center", flexShrink: 0 },
  weekLbl: {
    fontSize: 9,
    color: MUTED,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontFamily: "Inter_600SemiBold",
  },
  weekRow: { flexDirection: "row", gap: 4, marginTop: 2 },
  dayBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  dayDone: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  dayToday: {
    backgroundColor: "rgba(239,68,68,0.2)",
    borderWidth: 1,
    borderColor: "#EF4444",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  dayFuture: {
    backgroundColor: "#1A1F30",
    borderWidth: 1,
    borderColor: "#2A3050",
  },
  dayLetter: { fontSize: 8, fontWeight: "700", fontFamily: "Inter_700Bold" },
  dayLetterDone: { color: "#EF4444" },
  dayLetterToday: { color: "#EF4444" },
  dayLetterFuture: { color: MUTED },
  fullDaysHint: {
    fontSize: 9,
    fontWeight: "700",
    color: "#EF4444",
    marginTop: 4,
    fontFamily: "Inter_700Bold",
  },
});
