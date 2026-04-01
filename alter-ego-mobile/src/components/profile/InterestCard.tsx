import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { InterestInsight, InterestPathDisplay } from "@/types/interestPath";
import { darkenHex, hexWithAlpha, interestInitials } from "@/utils/interestColor";
import { getInterestColorByHex } from "@/constants/missionColors";

export type InterestCardProps = {
  path: InterestPathDisplay;
  onManage: (path: InterestPathDisplay) => void;
  onInsightTap: (insight: InterestInsight, colorHex: string) => void;
};

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function Tag({
  label,
  bg,
  border,
  color,
}: {
  label: string;
  bg: string;
  border: string;
  color: string;
}) {
  return (
    <View style={[styles.tag, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.tagText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function PathStrip({ path, C }: { path: InterestPathDisplay; C: string }) {
  const qs = path.quests;
  const goalDone = path.completed_quests_count >= path.total_quests && path.total_quests > 0;
  const n = qs.length + 1;

  const nodeState = (i: number): "done" | "active" | "locked" | "goal" => {
    if (i < qs.length) {
      const q = qs[i];
      if (q.status === "completed") return "done";
      if (q.status === "active") return "active";
      return "locked";
    }
    if (goalDone) return "done";
    return "goal";
  };

  const lineColor = (leftIdx: number) => {
    const left = nodeState(leftIdx);
    return left === "done" ? hexWithAlpha(C, "52") : "#1A1F30";
  };

  return (
    <View style={styles.pathStrip}>
      <View style={styles.pathHeader}>
        <Text style={styles.pathHeaderLbl}>YOUR PATH</Text>
        <Text style={styles.pathHeaderMeta}>
          {path.completed_quests_count} / {path.total_quests} Quests
        </Text>
      </View>
      <View style={styles.nodesRow}>
        {Array.from({ length: n }).map((_, i) => {
          const st = nodeState(i);
          const isGoal = i === qs.length;
          return (
            <View key={i} style={styles.nodeCell}>
              {i < n - 1 ? (
                <View
                  style={[
                    styles.connector,
                    { backgroundColor: lineColor(i) },
                  ]}
                />
              ) : null}
              <View
                style={[
                  styles.nodeDot,
                  st === "done" && {
                    backgroundColor: hexWithAlpha(C, "2E"),
                    borderColor: C,
                    borderWidth: 1.5,
                  },
                  st === "active" && {
                    backgroundColor: hexWithAlpha(C, "38"),
                    borderColor: C,
                    borderWidth: 2,
                    shadowColor: hexWithAlpha(C, "66"),
                    shadowOpacity: 1,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 6,
                  },
                  st === "locked" && {
                    backgroundColor: "#10131E",
                    borderColor: "#1A1F30",
                    borderWidth: 1.5,
                  },
                  st === "goal" && {
                    backgroundColor: "#10131E",
                    borderColor: "#1A1F30",
                    borderWidth: 1.5,
                  },
                ]}
              >
                {st === "done" && !isGoal ? (
                  <Text style={[styles.nodeCheck, { color: C }]}>✓</Text>
                ) : isGoal ? (
                  <Text style={[styles.nodeStar, { color: st === "done" ? C : "#2E3450" }]}>★</Text>
                ) : st === "active" ? (
                  <View style={[styles.activeInnerDot, { backgroundColor: C }]} />
                ) : (
                  <Text style={styles.nodeLock}> </Text>
                )}
              </View>
              <Text
                style={[
                  styles.nodeLbl,
                  st === "done" && { color: "#6B7280" },
                  st === "active" && { color: C, fontFamily: "Inter_700Bold" },
                  (st === "locked" || st === "goal") && { color: "#2E3450" },
                ]}
                numberOfLines={2}
              >
                {isGoal
                  ? "Goal"
                  : st === "locked"
                    ? "???"
                    : qs[i]?.title.slice(0, 18) ?? "?"}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function InterestCard({ path, onManage, onInsightTap }: InterestCardProps) {
  const scheme = getInterestColorByHex(
    path.color_hex?.startsWith("#") ? path.color_hex : `#${path.color_hex ?? "14B8A6"}`
  );
  const C = scheme.primary;
  const darker = scheme.deep;
  const initials = interestInitials(path.interest_name);
  const craftPct = Math.min(1, path.craft_sp / Math.max(1, path.next_craft_threshold));

  const scheduleMask = [1, 2, 3, 4, 5, 6, 7].map((d) => path.schedule_days.includes(d));

  const showArc =
    path.sessions_completed !== undefined || !!path.current_arc_phase;

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={["transparent", hexWithAlpha(C, "40"), "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.cardTopGlow}
      />

      <View style={styles.headerRow}>
        <View
          style={[
            styles.initials,
            { backgroundColor: hexWithAlpha(C, "1E"), borderColor: hexWithAlpha(C, "38") },
          ]}
        >
          <Text style={[styles.initialsTxt, { color: C }]}>{initials}</Text>
        </View>
        <View style={styles.metaCol}>
          <Text style={styles.interestName} numberOfLines={1}>
            {path.interest_name}
          </Text>
          <Text style={styles.goalTxt} numberOfLines={2}>
            {path.goal_text}
          </Text>
          <View style={styles.tagsRow}>
            <Tag
              label={path.experience_label}
              bg={hexWithAlpha(C, "1A")}
              border={hexWithAlpha(C, "38")}
              color={C}
            />
            <Tag
              label={path.schedule_abbrev}
              bg={hexWithAlpha(C, "12")}
              border={hexWithAlpha(C, "28")}
              color={darkenHex(C, 0.85)}
            />
            <Tag
              label={path.difficulty_label}
              bg={hexWithAlpha(C, "0C")}
              border={hexWithAlpha(C, "22")}
              color={darkenHex(C, 0.9)}
            />
          </View>
        </View>
        <Pressable
          onPress={() => onManage(path)}
          style={styles.moreBtn}
          hitSlop={8}
        >
          <Text style={styles.moreBtnTxt}>⋯</Text>
        </Pressable>
      </View>

      {showArc ? (
        <View style={styles.arcSection}>
          <View style={styles.arcTopRow}>
            <View
              style={[
                styles.phaseBadge,
                { backgroundColor: hexWithAlpha(C, "1A"), borderColor: hexWithAlpha(C, "30") },
              ]}
            >
              <Text style={[styles.phaseBadgeText, { color: C }]}>
                {path.arc_phase_label ?? path.current_arc_phase ?? "Open Practice"}
              </Text>
            </View>
            {path.progress_pct != null ? (
              <Text style={[styles.arcPct, { color: C }]}>{Math.round(path.progress_pct)}%</Text>
            ) : null}
          </View>

          {path.total_planned_sessions ? (
            <View style={styles.arcTrack}>
              <LinearGradient
                colors={[darkenHex(C, 0.7), C]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.arcFill,
                  {
                    width: `${Math.min(100, Math.round(path.progress_pct ?? 0))}%`,
                  },
                ]}
              />
            </View>
          ) : (
            <View style={[styles.arcTrack, { backgroundColor: hexWithAlpha(C, "0A") }]} />
          )}

          <View style={styles.arcMeta}>
            <Text style={styles.arcMetaText}>
              {path.sessions_completed ?? 0}
              {path.total_planned_sessions
                ? ` / ${path.total_planned_sessions} sessions`
                : " sessions"}
            </Text>
            {path.target_date ? (
              <Text style={styles.arcMetaText}>
                {(() => {
                  try {
                    const d = new Date(path.target_date!);
                    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                  } catch {
                    return path.target_date;
                  }
                })()}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {path.arc_paused ? (
        <View style={styles.pausedBanner}>
          <Text style={styles.pausedBannerText}>Arc paused — no new missions until resumed</Text>
        </View>
      ) : null}

      <View style={styles.craftRow}>
        <Text style={[styles.craftSym, { color: C, textShadowColor: hexWithAlpha(C, "72") }]}>
          ✦
        </Text>
        <View style={styles.craftCol}>
          <View style={styles.craftTop}>
            <Text style={[styles.craftLbl, { color: C }]}>
              Craft · {path.craft_level_name}
            </Text>
            <Text style={styles.craftSp}>
              {path.craft_sp} / {path.next_craft_threshold} SP
            </Text>
          </View>
          <View style={styles.craftTrack}>
            <View
              style={[
                styles.craftFill,
                {
                  width: `${Math.round(craftPct * 100)}%`,
                  backgroundColor: C,
                  shadowColor: hexWithAlpha(C, "66"),
                  shadowOpacity: 0.9,
                  shadowRadius: 5,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 3,
                },
              ]}
            >
              <View
                style={[
                  styles.craftGlowDot,
                  {
                    backgroundColor: C,
                    shadowColor: hexWithAlpha(C, "72"),
                  },
                ]}
              />
            </View>
          </View>
        </View>
        <View style={styles.dayGrid}>
          {DAY_LETTERS.map((L, i) => {
            const on = scheduleMask[i];
            return (
              <View
                key={i}
                style={[
                  styles.dayBox,
                  on
                    ? { backgroundColor: hexWithAlpha(C, "1A"), borderColor: hexWithAlpha(C, "42") }
                    : { backgroundColor: "#161A27", borderColor: "#222840" },
                ]}
              >
                <Text style={[styles.dayBoxTxt, { color: on ? C : "#6B7280" }]}>{L}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {path.quests.length > 0 ? <PathStrip path={path} C={C} /> : null}

      <View style={styles.insightsBox}>
        <View style={styles.insightsHeader}>
          <Text style={styles.insightsLbl}>INSIGHTS EARNED</Text>
          <Text style={styles.insightsMeta}>
            {path.insights_unlocked_count} / {path.insights_total} unlocked
          </Text>
        </View>
        <View style={styles.dotsRow}>
          {path.insights.map((ins) => (
            <Pressable
              key={ins.id}
              disabled={!ins.unlocked}
              onPress={() => onInsightTap(ins, C)}
              style={[
                styles.insDot,
                ins.unlocked
                  ? {
                      backgroundColor: hexWithAlpha(C, "24"),
                      borderColor: hexWithAlpha(C, "4D"),
                      shadowColor: hexWithAlpha(C, "2E"),
                      shadowOpacity: 1,
                      shadowRadius: 7,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: 4,
                    }
                  : { backgroundColor: "#10131E", borderColor: "#1A1F30" },
              ]}
            >
              {ins.unlocked ? (
                <Text style={{ fontSize: 11 }}>💡</Text>
              ) : (
                <Text style={styles.insLockQ}>?</Text>
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0C0E1A",
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
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    paddingTop: 14,
    paddingHorizontal: 14,
  },
  arcSection: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.04)",
    marginTop: 6,
  },
  arcTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  phaseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  phaseBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  arcPct: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  arcTrack: {
    height: 3,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
    marginBottom: 6,
  },
  arcFill: {
    height: "100%",
    borderRadius: 3,
  },
  arcMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  arcMetaText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#4B5563",
  },
  pausedBanner: {
    marginHorizontal: 14,
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(42,48,80,0.25)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.4)",
  },
  pausedBannerText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#4B5563",
    textAlign: "center",
  },
  initials: {
    width: 42,
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  initialsTxt: {
    fontSize: 15,
    fontFamily: "Inter_800ExtraBold",
    letterSpacing: -0.5,
  },
  metaCol: { flex: 1, minWidth: 0 },
  interestName: {
    fontSize: 16,
    fontFamily: "Inter_800ExtraBold",
    color: "#E5E7EB",
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  goalTxt: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    lineHeight: 15,
    marginBottom: 7,
  },
  tagsRow: { flexDirection: "row", gap: 5, flexWrap: "wrap" },
  tag: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagText: { fontSize: 9, fontFamily: "Inter_700Bold" },
  moreBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  moreBtnTxt: { color: "#9CA3AF", fontSize: 16, marginTop: -2 },
  craftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.04)",
    marginTop: 10,
  },
  craftSym: {
    fontSize: 13,
    fontFamily: "Inter_800ExtraBold",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 7,
  },
  craftCol: { flex: 1, minWidth: 0 },
  craftTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  craftLbl: { fontSize: 11, fontFamily: "Inter_700Bold" },
  craftSp: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#4B5563" },
  craftTrack: {
    height: 3,
    borderRadius: 3,
    backgroundColor: "#1A1F30",
    overflow: "visible",
  },
  craftFill: {
    height: 3,
    borderRadius: 3,
    position: "relative",
  },
  craftGlowDot: {
    position: "absolute",
    right: -3.5,
    top: -2,
    width: 7,
    height: 7,
    borderRadius: 4,
    shadowOpacity: 0.85,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  dayGrid: { flexDirection: "row", gap: 3, flexShrink: 0 },
  dayBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayBoxTxt: { fontSize: 7, fontFamily: "Inter_600SemiBold" },
  pathStrip: {
    marginHorizontal: 11,
    marginBottom: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: "#090B14",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    borderRadius: 13,
  },
  pathHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  pathHeaderLbl: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#3D4460",
    letterSpacing: 2,
  },
  pathHeaderMeta: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#6B7280" },
  nodesRow: { flexDirection: "row", alignItems: "flex-start" },
  nodeCell: {
    flex: 1,
    alignItems: "center",
    position: "relative",
    minWidth: 0,
  },
  connector: {
    position: "absolute",
    left: "50%",
    width: "100%",
    top: 10,
    height: 1.5,
    zIndex: 0,
  },
  nodeDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  nodeCheck: { fontSize: 9, fontFamily: "Inter_800ExtraBold" },
  nodeStar: { fontSize: 10, fontFamily: "Inter_700Bold" },
  nodeLock: { fontSize: 8 },
  activeInnerDot: { width: 6, height: 6, borderRadius: 3 },
  nodeLbl: {
    marginTop: 4,
    fontSize: 7,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    maxWidth: 38,
    lineHeight: 10,
  },
  insightsBox: {
    marginHorizontal: 11,
    marginBottom: 13,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: "#090B14",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    borderRadius: 13,
  },
  insightsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  insightsLbl: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#3D4460",
    letterSpacing: 1,
  },
  insightsMeta: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#6B7280" },
  dotsRow: { flexDirection: "row", gap: 5, flexWrap: "wrap" },
  insDot: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  insLockQ: {
    position: "absolute",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#2E3450",
  },
});
