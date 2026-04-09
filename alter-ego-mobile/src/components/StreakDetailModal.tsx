/**
 * Streak detail UI — full-screen layout (used by StreakDetailScreen).
 * Four visual tiers from docs/StreakDetail_Mockup.html:
 *   1–6: Awakening (violet) · 7–29: On a Roll (ember) · 30–89: Inferno · 90+: Legendary (gold)
 */

import React, { useCallback, useMemo } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaskedView from "@react-native-masked-view/masked-view";
import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg";

export interface StreakHeatmapEntry {
  date: string;
  maintained?: boolean;
  missions_done?: number;
}

export interface StreakDetailContentProps {
  onClose: () => void;
  currentStreak: number;
  longestStreak: number;
  freezeCount: number;
  heatmap: StreakHeatmapEntry[];
}

interface TierConfig {
  title: string;
  icon: string;
  bgColors: readonly [string, string];
  accent: string;
  accentMuted: string;
  accentDim: string;
  numberStyle: "solid" | "gradient";
  numberGradient?: readonly [string, string, string];
  quote: string;
  quoteAttr: string;
  closeBg: string;
  closeBorder: string;
  headerTitleColor: string;
  /** Radial hero glow (mock blur simulation) */
  heroGlowTint: string;
}

const TIERS: TierConfig[] = [
  {
    title: "AWAKENING",
    icon: "⚡",
    bgColors: ["#0A0812", "#060508"],
    accent: "#A78BFA",
    accentMuted: "rgba(167,139,250,0.42)",
    accentDim: "rgba(139,92,246,0.06)",
    numberStyle: "solid",
    quote:
      "Every expert was once a beginner. Every pro was once an amateur. The first days are the hardest.",
    quoteAttr: "Day {n} of your journey",
    closeBg: "rgba(139,92,246,0.08)",
    closeBorder: "rgba(139,92,246,0.15)",
    headerTitleColor: "rgba(139,92,246,0.6)",
    heroGlowTint: "#8B5CF6",
  },
  {
    title: "ON A ROLL",
    icon: "🔥",
    bgColors: ["#100904", "#080502"],
    accent: "#FB923C",
    accentMuted: "rgba(251,146,60,0.42)",
    accentDim: "rgba(249,115,22,0.05)",
    numberStyle: "solid",
    quote:
      "We are what we repeatedly do. Excellence, then, is not an act but a habit.",
    quoteAttr: "Aristotle · Day {n}",
    closeBg: "rgba(249,115,22,0.08)",
    closeBorder: "rgba(249,115,22,0.15)",
    headerTitleColor: "rgba(249,115,22,0.55)",
    heroGlowTint: "#F97316",
  },
  {
    title: "INFERNO",
    icon: "🔥",
    bgColors: ["#120600", "#0A0400"],
    accent: "#FDBA74",
    accentMuted: "rgba(251,146,60,0.45)",
    accentDim: "rgba(234,88,12,0.06)",
    numberStyle: "gradient",
    numberGradient: ["#FDE68A", "#F97316", "#C2410C"],
    quote:
      "Success is the sum of small efforts, repeated day in and day out. This is what {n} days of proof looks like.",
    quoteAttr: "Day {n} · Inferno tier",
    closeBg: "rgba(239,68,68,0.08)",
    closeBorder: "rgba(239,68,68,0.14)",
    headerTitleColor: "rgba(239,68,68,0.5)",
    heroGlowTint: "#DC2626",
  },
  {
    title: "LEGENDARY",
    icon: "👑",
    bgColors: ["#140E00", "#0E0A00"],
    accent: "#FDE68A",
    accentMuted: "rgba(253,224,71,0.45)",
    accentDim: "rgba(245,158,11,0.06)",
    numberStyle: "gradient",
    numberGradient: ["#FEF9C3", "#FBBF24", "#B45309"],
    quote:
      "It does not matter how slowly you go as long as you do not stop. {n} days of not stopping.",
    quoteAttr: "Confucius · Day {n} · Legendary",
    closeBg: "rgba(251,191,36,0.08)",
    closeBorder: "rgba(251,191,36,0.15)",
    headerTitleColor: "rgba(251,191,36,0.5)",
    heroGlowTint: "#FBBF24",
  },
];

function getTier(streak: number): TierConfig {
  if (streak >= 90) return TIERS[3];
  if (streak >= 30) return TIERS[2];
  if (streak >= 7) return TIERS[1];
  return TIERS[0];
}

const MILESTONES = [1, 3, 7, 14, 30, 60, 90, 180, 365];

function nextMilestone(streak: number): { target: number; label: string } | null {
  const next = MILESTONES.find((m) => streak < m);
  if (!next) return null;
  const labels: Record<number, string> = {
    1: "1 day",
    3: "3 days",
    7: "1 week",
    14: "14 days",
    30: "1 month",
    60: "2 months",
    90: "3 months",
    180: "6 months",
    365: "1 year",
  };
  return { target: next, label: labels[next] ?? `${next} days` };
}

function heroSubtitle(streak: number): string {
  if (streak === 1) {
    return "Day one. The hardest step is always the first.";
  }
  if (streak >= 90) {
    return `${streak} days without breaking. You are in the top 1% of all users.`;
  }
  if (streak >= 30) {
    return `${streak} days of unbroken discipline. This is no longer a habit — it's identity.`;
  }
  if (streak >= 7) {
    return "Two weeks of discipline within reach. You're building real momentum.";
  }
  if (streak < 7) {
    return "The discipline is forming. Show up again tomorrow.";
  }
  return "The discipline is forming. Show up again tomorrow.";
}

const WEEK_DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function currentWeekActivity(heatmap: StreakHeatmapEntry[]): boolean[] {
  const today = new Date();
  const todayDow = today.getDay();
  const monOffset = todayDow === 0 ? -6 : 1 - todayDow;
  const heatmapMap = new Map(heatmap.map((h) => [h.date.slice(0, 10), h]));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + monOffset + i);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entry = heatmapMap.get(ymd);
    return !!(entry?.maintained || (entry?.missions_done ?? 0) > 0);
  });
}

function last14Activity(heatmap: StreakHeatmapEntry[]): boolean[] {
  const today = new Date();
  const heatmapMap = new Map(heatmap.map((h) => [h.date.slice(0, 10), h]));
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 13 + i);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entry = heatmapMap.get(ymd);
    return !!(entry?.maintained || (entry?.missions_done ?? 0) > 0);
  });
}

function todayDowIndex(): number {
  const dow = new Date().getDay();
  return dow === 0 ? 6 : dow - 1;
}

const HEADER_SIDE = 36;
const SCREEN_W = Dimensions.get("window").width;

function GradientStatText({
  children,
  gradient,
  fontSize,
  letterSpacing,
}: {
  children: string;
  gradient: readonly [string, string, string];
  fontSize: number;
  letterSpacing?: number;
}) {
  return (
    <MaskedView
      style={{ height: fontSize + 8, minWidth: 40, alignSelf: "center" }}
      maskElement={
        <Text
          style={{
            fontSize,
            fontWeight: "900",
            color: "#000",
            textAlign: "center",
            letterSpacing,
            lineHeight: fontSize + 4,
          }}
        >
          {children}
        </Text>
      }
    >
      <LinearGradient
        colors={[...gradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </MaskedView>
  );
}

function GradientHeroNumber({
  value,
  gradient,
}: {
  value: number;
  gradient: readonly [string, string, string];
}) {
  const s = String(value);
  return (
    <MaskedView
      style={{ height: 128, width: SCREEN_W - 40, alignSelf: "center", marginBottom: 6 }}
      maskElement={
        <Text
          style={{
            fontSize: 112,
            fontWeight: "900",
            color: "#000",
            textAlign: "center",
            lineHeight: 120,
            letterSpacing: -4,
            paddingTop: 4,
          }}
        >
          {s}
        </Text>
      }
    >
      <LinearGradient
        colors={[...gradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </MaskedView>
  );
}

function HeroRadialGlow({
  color,
}: {
  color: string;
}) {
  const gradientId = `hero-glow-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <View pointerEvents="none" style={styles.heroGlowSvgWrap}>
      <Svg width="100%" height="100%" viewBox="0 0 320 320">
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="45%" r="50%" fx="50%" fy="45%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <Stop offset="22%" stopColor={color} stopOpacity={0.16} />
            <Stop offset="42%" stopColor={color} stopOpacity={0.09} />
            <Stop offset="68%" stopColor={color} stopOpacity={0.035} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="320" height="320" fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}

export function StreakDetailContent({
  onClose,
  currentStreak,
  longestStreak,
  freezeCount,
  heatmap,
}: StreakDetailContentProps) {
  const insets = useSafeAreaInsets();
  const tier = getTier(currentStreak);
  const next = nextMilestone(currentStreak);
  const weekActivity = useMemo(() => currentWeekActivity(heatmap), [heatmap]);
  const heatmap14 = useMemo(() => last14Activity(heatmap), [heatmap]);
  const todayIdx = todayDowIndex();

  const fillTemplate = useCallback(
    (s: string) => s.replace(/\{n\}/g, String(currentStreak)),
    [currentStreak]
  );

  const showFreezeRow = currentStreak >= 7 && freezeCount > 0;

  const thirdStatMain = next ? `${next.target - currentStreak}d` : "🏆";
  const thirdStatSub = next ? `To ${next.label}` : "All milestones";

  const renderFirstStatValue = () => {
    if (tier.numberStyle === "gradient" && tier.numberGradient) {
      return (
        <GradientStatText gradient={tier.numberGradient} fontSize={32} letterSpacing={-1}>
          {String(currentStreak)}
        </GradientStatText>
      );
    }
    return (
      <Text style={[styles.statVal, { color: tier.accent }]} numberOfLines={1} adjustsFontSizeToFit>
        {currentStreak}
      </Text>
    );
  };

  const renderThirdStatValue = () => {
    if (!next) {
      return <Text style={[styles.statValNeutral, { fontSize: 28 }]}>🏆</Text>;
    }
    const str = thirdStatMain;
    return (
      <Text style={[styles.statValNeutral, styles.statThirdCompact]} numberOfLines={1} adjustsFontSizeToFit>
        {str}
      </Text>
    );
  };

  return (
    <LinearGradient
      colors={[...tier.bgColors]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.root}
    >
      <ScrollView
        style={[styles.scrollView, { paddingTop: insets.top }]}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 16 }]}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeBtn,
              {
                backgroundColor: tier.closeBg,
                borderColor: tier.closeBorder,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            hitSlop={8}
          >
            <Text style={[styles.closeBtnText, { color: tier.headerTitleColor }]}>✕</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: tier.headerTitleColor }]}>STREAK</Text>
          <View style={{ width: HEADER_SIDE }} />
        </View>

        <View style={styles.heroSection}>
          <HeroRadialGlow color={tier.heroGlowTint} />
          <View
            style={[
              styles.iconBadge,
              {
                backgroundColor: tier.accentDim,
                borderColor: tier.accentMuted,
              },
            ]}
          >
            <Text style={styles.iconEmoji}>{tier.icon}</Text>
          </View>

          {tier.numberStyle === "gradient" && tier.numberGradient ? (
            <GradientHeroNumber value={currentStreak} gradient={tier.numberGradient} />
          ) : (
            <Text style={[styles.heroNumber, { color: tier.accent }]}>{currentStreak}</Text>
          )}

          <Text style={[styles.heroUnit, { color: tier.accent }]}>DAY STREAK</Text>
          <Text style={[styles.heroTitle, { color: tier.accent }]}>{tier.title}</Text>
          <Text style={styles.heroSub}>{heroSubtitle(currentStreak)}</Text>
        </View>

        <View style={styles.weekStrip}>
          {WEEK_DAY_LABELS.map((label, i) => {
            const done = weekActivity[i];
            const isToday = i === todayIdx;
            const isFuture = i > todayIdx;
            return (
              <View key={i} style={styles.dayCell}>
                <Text style={[styles.dayLabel, { color: "#9CA3AF" }]}>{label}</Text>
                <View
                  style={[
                    styles.dayPip,
                    done &&
                      !isToday && {
                        backgroundColor: tier.accentDim,
                        borderColor: tier.accentMuted,
                        borderWidth: 1,
                      },
                    isToday &&
                      done && {
                        borderWidth: 2,
                        borderColor: tier.accent,
                        backgroundColor: tier.accentDim,
                      },
                    isToday &&
                      !done && {
                        borderWidth: 2,
                        borderColor: tier.accentMuted,
                        backgroundColor: "rgba(255,255,255,0.03)",
                      },
                    isFuture && {
                      backgroundColor: "rgba(255,255,255,0.04)",
                      borderColor: "rgba(255,255,255,0.07)",
                      borderWidth: 1,
                    },
                    !done &&
                      !isToday &&
                      !isFuture && {
                        backgroundColor: "rgba(255,255,255,0.04)",
                        borderColor: "rgba(255,255,255,0.07)",
                        borderWidth: 1,
                      },
                  ]}
                >
                  {done ? <Text style={[styles.dayCheck, { color: tier.accent }]}>✓</Text> : null}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderColor: tier.accentMuted, backgroundColor: tier.accentDim }]}>
            {renderFirstStatValue()}
            <Text style={styles.statLblMuted}>Current</Text>
          </View>
          <View style={[styles.statCard, styles.statCardNeutral]}>
            <Text style={styles.statValNeutral} numberOfLines={1} adjustsFontSizeToFit>
              {longestStreak}
            </Text>
            <Text style={styles.statLblNeutral}>Best ever</Text>
          </View>
          <View style={[styles.statCard, styles.statCardNeutral]}>
            {renderThirdStatValue()}
            <Text style={styles.statLblNeutral} numberOfLines={2}>
              {thirdStatSub}
            </Text>
          </View>
        </View>

        <View style={[styles.heatmapCard, { borderColor: tier.accentMuted }]}>
          <Text style={styles.heatmapTitle}>Last 2 weeks</Text>
          <View style={styles.heatmapGrid}>
            {heatmap14.map((active, i) => (
              <View
                key={i}
                style={[
                  styles.heatmapCell,
                  active
                    ? {
                        backgroundColor:
                          tier.numberStyle === "gradient" && tier.numberGradient
                            ? tier.numberGradient[1]
                            : tier.accent,
                        opacity: 0.35 + 0.5 * ((i + 1) / 14),
                      }
                    : { backgroundColor: "rgba(255,255,255,0.04)" },
                ]}
              />
            ))}
          </View>
        </View>

        <View style={[styles.quoteCard, { borderColor: tier.accentMuted, backgroundColor: tier.accentDim }]}>
          <LinearGradient
            colors={["transparent", tier.accentMuted, "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.quoteTopLine}
          />
          <Text style={[styles.quoteMark, { color: tier.accent }]}>{"\u201C"}</Text>
          <Text style={[styles.quoteText, { color: tier.accent }]}>{fillTemplate(tier.quote)}</Text>
          <Text style={[styles.quoteAttr, { color: tier.accent }]}>— {fillTemplate(tier.quoteAttr)}</Text>
        </View>

        {showFreezeRow ? (
          <View style={styles.freezeRow}>
            <Text style={styles.freezeIcon}>🧊</Text>
            <View style={styles.freezeText}>
              <Text style={styles.freezeTitle}>Streak Shields</Text>
              <Text style={styles.freezeSub}>Protects your streak for 1 missed day</Text>
            </View>
            <Text style={styles.freezeCount}>×{freezeCount}</Text>
          </View>
        ) : null}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 20,
    marginBottom: 0,
  },
  closeBtn: {
    width: HEADER_SIDE,
    height: HEADER_SIDE,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  closeBtnText: { fontSize: 18, fontWeight: "300" },
  headerTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 3,
    pointerEvents: "none",
  },
  heroSection: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 32,
    position: "relative",
    minHeight: 320,
    overflow: "visible",
  },
  heroGlowSvgWrap: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    width: 320,
    height: 320,
  },
  iconBadge: {
    width: 88,
    height: 88,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    zIndex: 1,
  },
  iconEmoji: { fontSize: 42, lineHeight: 48 },
  heroNumber: {
    fontSize: 112,
    fontWeight: "900",
    lineHeight: 120,
    letterSpacing: -4,
    marginTop: 4,
    marginBottom: 6,
    zIndex: 1,
    includeFontPadding: false,
  },
  heroUnit: {
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 4,
    textTransform: "uppercase",
    marginTop: 0,
    marginBottom: 10,
    opacity: 0.45,
    zIndex: 1,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 4,
    textTransform: "uppercase",
    marginBottom: 8,
    zIndex: 1,
  },
  heroSub: {
    fontSize: 12,
    color: "rgba(229,231,235,0.4)",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 240,
    zIndex: 1,
    fontWeight: "400",
  },
  weekStrip: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 5,
    marginBottom: 28,
  },
  dayCell: { alignItems: "center", gap: 5 },
  dayLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1,
    opacity: 0.3,
  },
  dayPip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  dayCheck: { fontSize: 14, fontWeight: "800" },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 86,
  },
  statCardNeutral: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  statVal: { fontSize: 32, fontWeight: "900", lineHeight: 34, letterSpacing: -1 },
  statValNeutral: {
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 34,
    letterSpacing: -1,
    color: "#E5E7EB",
  },
  statThirdCompact: {
    fontSize: 22,
  },
  statLblMuted: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#9CA3AF",
    marginTop: 4,
    opacity: 0.55,
    textAlign: "center",
  },
  statLblNeutral: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
  heatmapCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  heatmapTitle: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 12,
    color: "rgba(255,255,255,0.35)",
  },
  heatmapGrid: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 3,
    justifyContent: "space-between",
  },
  heatmapCell: {
    flex: 1,
    minWidth: 10,
    maxWidth: 24,
    aspectRatio: 1,
    borderRadius: 3,
  },
  quoteCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 16,
    overflow: "hidden",
  },
  quoteTopLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  quoteMark: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "400",
    opacity: 0.15,
    marginBottom: 4,
  },
  quoteText: {
    fontSize: 13,
    lineHeight: 22,
    fontStyle: "italic",
    opacity: 0.7,
  },
  quoteAttr: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1,
    marginTop: 10,
    opacity: 0.35,
  },
  freezeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "rgba(59,130,246,0.06)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.2)",
    marginBottom: 8,
  },
  freezeIcon: { fontSize: 20 },
  freezeText: { flex: 1 },
  freezeTitle: { fontSize: 12, fontWeight: "600", color: "#93C5FD" },
  freezeSub: { fontSize: 10, color: "rgba(147,197,253,0.5)", marginTop: 2 },
  freezeCount: {
    fontSize: 22,
    fontWeight: "900",
    color: "#93C5FD",
    letterSpacing: -0.5,
  },
});
