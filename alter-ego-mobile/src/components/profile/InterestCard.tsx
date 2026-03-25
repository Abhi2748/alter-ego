import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import type { InterestInsight, InterestPathDisplay, PathQuest } from "@/types/interestPath";
import {
  darkenHex,
  hexWithAlpha,
  interestInitials,
} from "@/utils/interestColor";

export type InterestCardProps = {
  path: InterestPathDisplay;
  completingKey: string | null;
  onManage: (path: InterestPathDisplay) => void;
  onCompleteQuest: (pathId: string, questId: string) => void;
  onMarkCriterion: (pathId: string, questId: string, idx: number) => void;
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

function ActiveQuestSection({
  path,
  quest,
  C,
  darker,
  completing,
  onComplete,
  onMark,
}: {
  path: InterestPathDisplay;
  quest: PathQuest;
  C: string;
  darker: string;
  completing: boolean;
  onComplete: () => void;
  onMark: (idx: number) => void;
}) {
  const pulse = useSharedValue(0.5);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [pulse]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const doneCrit = quest.criteria_done.filter(Boolean).length;
  const frac = Math.min(1, doneCrit / Math.max(1, quest.estimated_total));

  return (
    <View style={[styles.questCard, { borderColor: hexWithAlpha(C, "2E") }]}>
      <LinearGradient
        colors={[C, darker]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.questLeftBar}
      />
      <View style={styles.questInner}>
        <View style={styles.questHeader}>
          <View style={styles.questHeaderLeft}>
            <View style={styles.activeLblRow}>
              <Animated.View style={[styles.pulseDot, { backgroundColor: C }, dotStyle]} />
              <Text style={[styles.activeLbl, { color: C }]}>ACTIVE QUEST</Text>
            </View>
            <Text style={styles.questName} numberOfLines={2}>
              {quest.title}
            </Text>
          </View>
          <View style={styles.questBadge}>
            <Text style={styles.questBadgeText}>
              {path.completed_quests_count + 1} / {path.total_quests}
            </Text>
          </View>
        </View>
        <Text style={styles.questDesc}>{quest.description}</Text>

        <View style={styles.qpRow}>
          <Text style={styles.qpLbl}>QUEST PROGRESS</Text>
          <Text style={[styles.qpFrac, { color: C }]}>
            {doneCrit} / {quest.estimated_total}
          </Text>
        </View>
        <View style={styles.bar5}>
          <LinearGradient
            colors={[darker, C]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.bar5Fill, { width: `${Math.round(frac * 100)}%` }]}
          />
          {frac > 0.05 ? (
            <View
              style={[
                styles.bar5Dot,
                {
                  backgroundColor: C,
                  left: `${Math.round(frac * 100)}%`,
                  marginLeft: -4.5,
                  borderColor: "#07080F",
                  shadowColor: C,
                  shadowOpacity: 0.55,
                  shadowRadius: 7,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 4,
                },
              ]}
            />
          ) : null}
        </View>

        <Text style={styles.critSectionLbl}>SUCCESS CRITERIA</Text>
        {quest.success_criteria.map((txt, idx) => {
          const done = !!quest.criteria_done[idx];
          return (
            <Pressable
              key={idx}
              style={styles.critRow}
              onPress={() => onMark(idx)}
              hitSlop={4}
            >
              <View
                style={[
                  styles.cb,
                  done
                    ? { backgroundColor: hexWithAlpha(C, "2E"), borderColor: C }
                    : { backgroundColor: "#151B2A", borderColor: "#222840" },
                ]}
              >
                {done ? (
                  <Text style={[styles.cbMark, { color: C }]}>✓</Text>
                ) : null}
              </View>
              <Text
                style={[
                  styles.critTxt,
                  done
                    ? { color: "#4B5563", textDecorationLine: "line-through" }
                    : { color: "#6B7280" },
                ]}
              >
                {txt}
              </Text>
            </Pressable>
          );
        })}

        <View style={styles.questFooter}>
          <Text style={styles.daysLeft}>
            ~<Text style={styles.daysLeftNum}>{quest.estimated_days_remaining}</Text> days remaining
          </Text>
          <Pressable
            onPress={onComplete}
            disabled={completing}
            style={[
              styles.readyBtn,
              { backgroundColor: hexWithAlpha(C, "17"), borderColor: hexWithAlpha(C, "4D") },
            ]}
          >
            {completing ? (
              <ActivityIndicator color={C} size="small" />
            ) : (
              <Text style={[styles.readyBtnTxt, { color: C }]}>I&apos;m ready →</Text>
            )}
          </Pressable>
        </View>
      </View>
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

export function InterestCard({
  path,
  completingKey,
  onManage,
  onCompleteQuest,
  onMarkCriterion,
  onInsightTap,
}: InterestCardProps) {
  const C = path.color_hex?.startsWith("#") ? path.color_hex : `#${path.color_hex ?? "8B5CF6"}`;
  const darker = darkenHex(C, 0.7);
  const initials = interestInitials(path.interest_name);
  const activeQuest = path.quests.find((q) => q.status === "active");
  const craftPct = Math.min(1, path.craft_sp / Math.max(1, path.next_craft_threshold));

  const scheduleMask = [1, 2, 3, 4, 5, 6, 7].map((d) => path.schedule_days.includes(d));

  const completing =
    activeQuest != null &&
    completingKey === `${path.path_id}:${activeQuest.id}`;

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

      {activeQuest ? (
        <ActiveQuestSection
          path={path}
          quest={activeQuest}
          C={C}
          darker={darker}
          completing={completing}
          onComplete={() => onCompleteQuest(path.path_id, activeQuest.id)}
          onMark={(idx) =>
            onMarkCriterion(path.path_id, activeQuest.id, idx)
          }
        />
      ) : path.total_quests > 0 ? (
        <View style={styles.pathCompleteBanner}>
          <Text style={styles.pathCompleteTxt}>Path complete — your goal is unlocked.</Text>
        </View>
      ) : null}

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
  questCard: {
    marginHorizontal: 11,
    marginBottom: 10,
    padding: 13,
    paddingLeft: 13 + 7,
    backgroundColor: "#0F1220",
    borderWidth: 1,
    borderRadius: 13,
    overflow: "hidden",
    position: "relative",
  },
  questLeftBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  questInner: { paddingLeft: 7 },
  questHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  questHeaderLeft: { flex: 1, maxWidth: "72%" },
  activeLblRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  pulseDot: { width: 5, height: 5, borderRadius: 2.5 },
  activeLbl: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
  },
  questName: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
    lineHeight: 17,
    maxWidth: 210,
  },
  questBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  questBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#6B7280" },
  questDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    lineHeight: 17,
    marginBottom: 10,
  },
  qpRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  qpLbl: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#9CA3AF" },
  qpFrac: { fontSize: 10, fontFamily: "Inter_800ExtraBold" },
  bar5: {
    height: 5,
    borderRadius: 5,
    backgroundColor: "#1A1F30",
    marginBottom: 10,
    overflow: "visible",
    position: "relative",
  },
  bar5Fill: {
    height: 5,
    borderRadius: 5,
    shadowColor: "#8B5CF6",
    shadowOpacity: 0.4,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },
  bar5Dot: {
    position: "absolute",
    top: -2,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
  },
  critSectionLbl: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: "#3D4460",
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  critRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 4,
  },
  cb: {
    width: 15,
    height: 15,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  cbMark: { fontSize: 8, fontFamily: "Inter_800ExtraBold" },
  critTxt: { flex: 1, fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular" },
  questFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.04)",
    paddingTop: 9,
    marginTop: 10,
  },
  daysLeft: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#3D4460" },
  daysLeftNum: { color: "#6B7280", fontFamily: "Inter_600SemiBold" },
  readyBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 7,
    borderWidth: 1,
    minWidth: 96,
    alignItems: "center",
  },
  readyBtnTxt: { fontSize: 10, fontFamily: "Inter_700Bold" },
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
  pathCompleteBanner: {
    marginHorizontal: 11,
    marginBottom: 10,
    padding: 12,
    backgroundColor: "#090B14",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  pathCompleteTxt: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#6B7280",
    textAlign: "center",
  },
});
