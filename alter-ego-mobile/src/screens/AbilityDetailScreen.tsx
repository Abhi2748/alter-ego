/**
 * AbilityDetailScreen — full-screen detail for one stat.
 * Design: stat-colored atmospheric hero (grid + ghost symbol),
 * progress ring, missions list, level journey timeline.
 */

import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { ProfileStackParamList } from "@/navigation/types";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, G } from "react-native-svg";
import { useCharacterStats } from "@/hooks/useStats";
import {
  ABILITY_DETAILS,
  LEVEL_NAMES,
  LEVEL_THRESHOLDS,
  WILLPOWER_BONUS,
  type AbilityKey,
} from "@/constants/abilityDetails";

const RING_SIZE = 144;
const RING_RADIUS = 62;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

const ABILITY_KEYS = Object.keys(ABILITY_DETAILS) as AbilityKey[];

export function AbilityDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<StackNavigationProp<ProfileStackParamList>>();
  const route = useRoute<RouteProp<ProfileStackParamList, "AbilityDetail">>();
  const { statKey } = route.params;

  const key = statKey as AbilityKey;
  const config = ABILITY_KEYS.includes(key) ? ABILITY_DETAILS[key] : undefined;

  const { data: characterStats, isLoading } = useCharacterStats();

  const stat = characterStats?.[key];

  const thresholds: number[] = characterStats?.meta?.level_thresholds ?? LEVEL_THRESHOLDS;
  const levelNames: string[] = characterStats?.meta?.level_names ?? LEVEL_NAMES;

  /** Server order: per-stat fields from GET /stats, then top-level meta — local constants only if absent. */
  const dailyCap: number =
    stat?.daily_cap ?? characterStats?.meta?.daily_caps?.[key] ?? 0;

  const contributingSources: string[] =
    stat?.contributing ?? characterStats?.meta?.contributing?.[key] ?? [];

  const currentLevel = stat?.level ?? 1;
  const spCurrent = stat?.sp_current ?? 0;
  const spForNext = stat?.sp_for_next ?? thresholds[1] ?? 150;
  const progressPct = stat?.progress_percent ?? 0;

  const ringDash = RING_CIRC * Math.min(1, progressPct / 100);
  const ringGap = RING_CIRC - ringDash;

  const screenBg = (() => {
    if (statKey === "vitality") return "#050C08";
    if (statKey === "focus") return "#080612";
    if (statKey === "craft") return "#0C0A04";
    if (statKey === "discipline") return "#0C0704";
    if (statKey === "willpower") return "#0A0505";
    return "#06070E";
  })();

  if (!characterStats && isLoading) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: screenBg, paddingTop: insets.top }]}>
        <ActivityIndicator color="#8B5CF6" size="large" />
      </View>
    );
  }

  if (!config || !characterStats) {
    return (
      <View style={[styles.root, { backgroundColor: "#06070E", paddingTop: insets.top }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#6B7280" />
        </Pressable>
        <Text style={styles.fallbackText}>Unable to load this ability.</Text>
      </View>
    );
  }

  const { color, bgTint, symbol, label, description, missions, isWillpower } = config;

  const spToNext = Math.max(0, (spForNext ?? 0) - spCurrent);
  const atMax = currentLevel >= 10;

  return (
    <View style={[styles.root, { backgroundColor: screenBg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 4, borderBottomColor: color + "1A" }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#6B7280" />
        </Pressable>
        <Text style={[styles.headerTitle, { color }]}>{label}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 + 64 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <LinearGradient
            colors={[bgTint, "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View style={styles.heroGrid} pointerEvents="none" />

          <Text style={[styles.heroSymbol, { color }]} pointerEvents="none">
            {symbol}
          </Text>

          <View style={[styles.chip, { borderColor: color + "40", backgroundColor: color + "18" }]}>
            <View style={[styles.chipDot, { backgroundColor: color, shadowColor: color }]} />
            <Text style={[styles.chipText, { color }]}>{label.toUpperCase()}</Text>
          </View>

          <View style={styles.ringWrap}>
            <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ringSvg}>
              <G transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}>
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  fill="none"
                  stroke="rgba(42,48,80,0.35)"
                  strokeWidth={5}
                />
                {ringDash > 0 && (
                  <Circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_RADIUS}
                    fill="none"
                    stroke={color}
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeDasharray={`${ringDash},${ringGap}`}
                  />
                )}
              </G>
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={styles.ringNum}>{currentLevel}</Text>
              <Text style={styles.ringOf}>of 10</Text>
            </View>
          </View>

          <Text style={[styles.levelName, { color }]}>
            {levelNames[currentLevel - 1] ?? "Dormant"}
          </Text>

          <Text style={styles.spLine}>
            <Text style={{ color, fontWeight: "700" }}>{spCurrent} SP </Text>
            <Text>
              {atMax
                ? "earned · max level"
                : `earned · ${spToNext} to next level`}
            </Text>
          </Text>

          <Text style={styles.desc}>{description}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTopLine}>
            <LinearGradient
              colors={["transparent", color + "38", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <Text style={styles.cardTitle}>
            {atMax
              ? `LEVEL 10 · ${levelNames[9] ?? "Eternal"}`
              : `PROGRESS TO LEVEL ${currentLevel + 1} · ${levelNames[currentLevel] ?? "—"}`}
          </Text>
          <View style={styles.progNums}>
            <Text style={[styles.progBig, { color }]}>{spCurrent}</Text>
            <Text style={styles.progTotal}>/ {atMax ? "—" : spForNext} SP</Text>
          </View>
          <View style={styles.progTrack}>
            <View
              style={[
                styles.progFill,
                {
                  width: `${Math.min(100, progressPct)}%` as `${number}%`,
                  backgroundColor: color,
                },
              ]}
            />
            {progressPct > 2 && !atMax && (
              <View
                style={[
                  styles.progDot,
                  {
                    left: `${Math.min(97, progressPct)}%` as `${number}%`,
                    backgroundColor: color,
                    shadowColor: color,
                  },
                ]}
              />
            )}
          </View>
          <Text style={styles.progHint}>
            {atMax
              ? "Maximum level reached"
              : `${spToNext} SP remaining · complete contributing missions daily`}
          </Text>
        </View>

        {isWillpower && (
          <View style={styles.card}>
            <View style={styles.cardTopLine}>
              <LinearGradient
                colors={["transparent", color + "38", "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
            <Text style={styles.cardTitle}>DAILY COMPLETION BONUS</Text>
            <Text style={styles.cardSub}>
              Finish more missions in one day and earn bonus Willpower SP on top of normal gains.
            </Text>
            {WILLPOWER_BONUS.map((tier, i) => (
              <View
                key={i}
                style={[
                  styles.bonusTier,
                  {
                    borderColor: color + "33",
                    backgroundColor: color + "14",
                  },
                ]}
              >
                <Text style={[styles.bonusMissions, i === 2 && { color: "#E5E7EB", fontWeight: "700" }]}>
                  {tier.label}
                </Text>
                <View style={[styles.bonusBadge, { borderColor: color + "44", backgroundColor: color + "20" }]}>
                  <Text style={[styles.bonusSp, { color: i === 2 ? "#FCA5A5" : color }]}>
                    +{tier.sp} SP
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardTopLine}>
            <LinearGradient
              colors={["transparent", color + "38", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <Text style={styles.cardTitle}>WHAT BUILDS {label.toUpperCase()}</Text>
          {contributingSources.length > 0 && (
            <Text style={styles.contributingFromApi}>{contributingSources.join(" · ")}</Text>
          )}
          {missions.map((m, i) => (
            <View
              key={i}
              style={[
                styles.missionRow,
                i === missions.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 },
              ]}
            >
              <View style={[styles.missionIcon, { backgroundColor: color + "1A", borderColor: color + "38" }]}>
                <Text style={styles.missionEmoji}>{m.emoji}</Text>
              </View>
              <View style={styles.missionInfo}>
                <Text style={styles.missionName}>{m.name}</Text>
                <Text style={styles.missionSub}>{m.sub}</Text>
              </View>
              <View style={styles.missionSp}>
                <Text style={[styles.missionSpVal, { color }]}>8–32 SP</Text>
                <Text style={styles.missionSpLbl}>per completion</Text>
              </View>
            </View>
          ))}
          {dailyCap > 0 && (
            <View style={[styles.capRow, { backgroundColor: color + "14", borderColor: color + "33" }]}>
              <Text style={[styles.capLabel, { color, opacity: 0.6 }]}>Daily cap for {label}</Text>
              <Text style={[styles.capVal, { color }]}>{dailyCap} SP / day</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardTopLine}>
            <LinearGradient
              colors={["transparent", color + "38", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <Text style={styles.cardTitle}>YOUR JOURNEY · 10 LEVELS</Text>
          {levelNames.map((name, i) => {
            const lvl = i + 1;
            const isCurrent = lvl === currentLevel;
            const isDone = lvl < currentLevel;
            const threshold = thresholds[i] ?? 0;
            const isLast = i === levelNames.length - 1;
            return (
              <View key={lvl} style={styles.ljRow}>
                <View style={styles.ljLeft}>
                  <View
                    style={[
                      styles.ljDot,
                      isCurrent && {
                        backgroundColor: color + "33",
                        borderColor: color,
                        borderWidth: 2,
                        ...(Platform.OS === "ios"
                          ? {
                              shadowColor: color,
                              shadowOpacity: 0.5,
                              shadowRadius: 8,
                              shadowOffset: { width: 0, height: 0 },
                            }
                          : { elevation: 4 }),
                      },
                      isDone && { backgroundColor: color + "28", borderColor: color + "55", borderWidth: 1 },
                      !isCurrent &&
                        !isDone && {
                          backgroundColor: "rgba(42,48,80,0.4)",
                          borderColor: "rgba(42,48,80,0.6)",
                          borderWidth: 1,
                        },
                    ]}
                  >
                    <Text
                      style={[
                        styles.ljDotNum,
                        { color: isCurrent ? color : isDone ? color + "AA" : "#374151" },
                      ]}
                    >
                      {lvl}
                    </Text>
                  </View>
                  {!isLast && (
                    <View
                      style={[
                        styles.ljConnector,
                        { backgroundColor: isCurrent ? color + "33" : "rgba(42,48,80,0.3)" },
                      ]}
                    />
                  )}
                </View>

                <View style={[styles.ljContent, isLast && { paddingBottom: 0 }]}>
                  <Text
                    style={[
                      styles.ljName,
                      isCurrent && { color, fontWeight: "700" },
                      isDone && { color: color + "AA" },
                      !isCurrent && !isDone && { color: "rgba(255,255,255,0.3)" },
                    ]}
                  >
                    {name}
                  </Text>
                  <Text style={styles.ljSp}>
                    {threshold >= 1000
                      ? `${(threshold / 1000).toFixed(threshold % 1000 === 0 ? 0 : 1)}k`
                      : String(threshold)}
                  </Text>
                  {isCurrent && (
                    <View style={[styles.ljYou, { borderColor: color + "40", backgroundColor: color + "18" }]}>
                      <Text style={[styles.ljYouText, { color }]}>you</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center" },
  fallbackText: { color: "#9CA3AF", fontSize: 14, paddingHorizontal: 24, fontFamily: "Inter_500Medium" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    backgroundColor: "rgba(6,7,14,0.88)",
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },

  hero: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 28,
    marginBottom: 12,
    position: "relative",
    overflow: "hidden",
  },
  heroGrid: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
  heroSymbol: {
    position: "absolute",
    fontSize: 170,
    fontWeight: "900",
    opacity: 0.04,
    lineHeight: 170,
    fontFamily: "Inter_800ExtraBold",
    textAlign: "center",
    top: "50%",
    marginTop: -85,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    zIndex: 1,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  chipText: { fontSize: 10, fontWeight: "800", letterSpacing: 2, fontFamily: "Inter_800ExtraBold" },

  ringWrap: { width: RING_SIZE, height: RING_SIZE, position: "relative", marginBottom: 18, zIndex: 1 },
  ringSvg: { position: "absolute", top: 0, left: 0 },
  ringCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  ringNum: {
    fontSize: 36,
    fontWeight: "900",
    color: "#E5E7EB",
    lineHeight: 40,
    fontFamily: "Inter_800ExtraBold",
  },
  ringOf: { fontSize: 10, color: "rgba(255,255,255,0.3)" },

  levelName: {
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -1.5,
    lineHeight: 40,
    marginBottom: 6,
    zIndex: 1,
    fontFamily: "Inter_800ExtraBold",
  },
  spLine: { fontSize: 13, color: "rgba(255,255,255,0.32)", zIndex: 1 },
  desc: {
    fontSize: 12,
    color: "rgba(255,255,255,0.32)",
    lineHeight: 21,
    maxWidth: 290,
    textAlign: "center",
    marginTop: 10,
    zIndex: 1,
  },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: 16,
    marginBottom: 12,
    overflow: "hidden",
    position: "relative",
  },
  cardTopLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  cardTitle: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.22)",
    marginBottom: 14,
    fontFamily: "Inter_700Bold",
  },
  contributingFromApi: {
    fontSize: 10,
    color: "rgba(255,255,255,0.28)",
    lineHeight: 15,
    marginTop: -8,
    marginBottom: 12,
    fontFamily: "Inter_500Medium",
  },
  cardSub: { fontSize: 11, color: "rgba(255,255,255,0.28)", lineHeight: 17, marginBottom: 14 },

  progNums: { flexDirection: "row", alignItems: "baseline", gap: 5, marginBottom: 10 },
  progBig: { fontSize: 32, fontWeight: "900", letterSpacing: -1, lineHeight: 34, fontFamily: "Inter_800ExtraBold" },
  progTotal: { fontSize: 14, color: "rgba(255,255,255,0.28)" },
  progTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginBottom: 8,
    overflow: "visible",
    position: "relative",
  },
  progFill: { height: "100%", borderRadius: 4 },
  progDot: {
    position: "absolute",
    top: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
    marginLeft: -7,
  },
  progHint: { fontSize: 11, color: "rgba(255,255,255,0.25)", lineHeight: 16 },

  bonusTier: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 7,
  },
  bonusMissions: { flex: 1, fontSize: 13, color: "rgba(255,255,255,0.55)" },
  bonusBadge: { paddingVertical: 3, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  bonusSp: { fontSize: 14, fontWeight: "900", fontFamily: "Inter_800ExtraBold" },

  missionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  missionIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderWidth: 1,
  },
  missionEmoji: { fontSize: 17 },
  missionInfo: { flex: 1 },
  missionName: { fontSize: 13, fontWeight: "600", color: "#E5E7EB" },
  missionSub: { fontSize: 10, color: "rgba(255,255,255,0.28)", marginTop: 2 },
  missionSp: { alignItems: "flex-end", flexShrink: 0 },
  missionSpVal: { fontSize: 13, fontWeight: "800", fontFamily: "Inter_800ExtraBold" },
  missionSpLbl: { fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 2 },
  capRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    padding: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  capLabel: { fontSize: 11, flex: 1 },
  capVal: { fontSize: 13, fontWeight: "800", fontFamily: "Inter_800ExtraBold" },

  ljRow: { flexDirection: "row", alignItems: "stretch", gap: 12 },
  ljLeft: { flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 },
  ljDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  ljDotNum: { fontSize: 8, fontWeight: "800", fontFamily: "Inter_800ExtraBold" },
  ljConnector: { width: 2, flex: 1, minHeight: 6, marginTop: 2 },
  ljContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 10,
    paddingTop: 1,
  },
  ljName: { fontSize: 13, fontWeight: "600", flex: 1, fontFamily: "Inter_600SemiBold" },
  ljSp: { fontSize: 10, color: "rgba(255,255,255,0.2)" },
  ljYou: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 5, borderWidth: 1 },
  ljYouText: { fontSize: 8, fontWeight: "800", letterSpacing: 1, fontFamily: "Inter_800ExtraBold" },
});
