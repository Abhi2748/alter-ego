import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import { useQueryClient } from "@tanstack/react-query";
import type { MainStackParamList } from "@/navigation/types";
import { useCompleteMission, useMissionDetail, useRateMission, MISSION_KEYS } from "@/hooks/useMissions";
import { getErrorMessage } from "@/services/api";
import type { MissionDetailApi } from "@/services/missions";

type MissionDetailRoute = RouteProp<MainStackParamList, "MissionDetail">;

const BG_GRADIENT = ["#0D0F1A", "#07080F"] as const;

const TEXT_PRIMARY = "#E5E7EB";
const TEXT_DIM = "#4B5563";
const TEXT_MUTED = "#6B7280";
const TEXT_SECONDARY = "#9CA3AF";

function normDifficulty(d: string | undefined): "easy" | "medium" | "hard" | "elite" {
  const x = String(d ?? "easy").toLowerCase();
  if (x === "medium") return "medium";
  if (x === "hard") return "hard";
  if (x === "elite") return "elite";
  return "easy";
}

function phaseLabel(p: string | null | undefined): string {
  if (!p) return "—";
  if (p === "mapping") return "Mapping";
  if (p === "disruption") return "Disruption";
  return "Consolidation";
}

function headerTypeLabel(m: MissionDetailApi): string {
  const t = m.type ?? "core";
  if (t === "core") return "Core Mission";
  if (t === "interest") {
    const pillar = m.interest_name?.trim() || "Interest";
    return `Interest Mission · ${pillar}`;
  }
  if (t === "resistance") {
    const habit = m.quit_habit_name?.trim() || m.quit_target_name?.trim() || "Quit";
    return `Resistance Mission · ${habit}`;
  }
  if (t === "personal") return "Personal Mission";
  return "Mission";
}

function difficultyPill(diff: "easy" | "medium" | "hard" | "elite") {
  if (diff === "easy")
    return { bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.30)", text: "#8B5CF6", label: "EASY" };
  if (diff === "medium")
    return { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.30)", text: "#F59E0B", label: "MEDIUM" };
  if (diff === "hard")
    return { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.30)", text: "#EF4444", label: "HARD" };
  return { bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.30)", text: "#A78BFA", label: "ELITE" };
}

export function MissionDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<MissionDetailRoute>();
  const missionId = route.params.missionId;
  const queryClient = useQueryClient();

  const { data: mission, isLoading, isError, refetch, isFetching } = useMissionDetail(missionId);
  const { mutate: completeMission, isPending: completing } = useCompleteMission();
  const { mutate: rateMission, isPending: ratingPending } = useRateMission();

  const [localRating, setLocalRating] = useState<1 | 3 | 5 | null>(null);

  const serverRating = mission?.difficulty_rating;
  const effectiveRating =
    serverRating === 1 || serverRating === 3 || serverRating === 5 ? serverRating : localRating;

  useEffect(() => {
    if (serverRating === 1 || serverRating === 3 || serverRating === 5) {
      setLocalRating(serverRating);
    }
  }, [serverRating]);

  const isCompleted = mission?.completed === true;
  const ratedLocked = serverRating === 1 || serverRating === 3 || serverRating === 5;

  const diffKey = useMemo(() => normDifficulty(mission?.difficulty), [mission?.difficulty]);
  const pill = useMemo(() => difficultyPill(diffKey), [diffKey]);

  const submitRating = useCallback(
    (rating: 1 | 3 | 5) => {
      if (!missionId || ratedLocked || !isCompleted) return;
      setLocalRating(rating);
      rateMission(
        { missionId, rating },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: MISSION_KEYS.detail(missionId) });
          },
          onError: (e) => {
            Alert.alert("Could not save rating", getErrorMessage(e));
            setLocalRating(null);
          },
        }
      );
    },
    [missionId, ratedLocked, isCompleted, rateMission, queryClient]
  );

  const handleComplete = () => {
    if (!missionId) return;
    completeMission(missionId, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: MISSION_KEYS.detail(missionId) });
      },
      onError: (e) => {
        Alert.alert("Can't mark done", getErrorMessage(e));
      },
    });
  };

  if (isLoading && !mission) {
    return (
      <LinearGradient colors={BG_GRADIENT} style={styles.container}>
        <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
          <View style={styles.headerBar}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
              <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <View style={{ width: 44 }} />
          </View>
          <View style={styles.skeletonPad}>
            <View style={styles.skelLine} />
            <View style={[styles.skelLine, { width: "90%" }]} />
            <View style={[styles.skelLine, { width: "70%", marginTop: 20 }]} />
            <View style={[styles.skelLine, { width: "100%", height: 80, marginTop: 16 }]} />
            <ActivityIndicator color="#8B5CF6" style={{ marginTop: 32 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (isError || !mission) {
    return (
      <LinearGradient colors={BG_GRADIENT} style={styles.container}>
        <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
          <View style={styles.headerBar}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
              <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <View style={{ width: 44 }} />
          </View>
          <View style={styles.errorWrap}>
            <Text style={styles.errorTxt}>Could not load this mission</Text>
            <Pressable style={styles.retryBtn} onPress={() => refetch()} disabled={isFetching}>
              <Text style={styles.retryTxt}>{isFetching ? "Retrying…" : "Retry"}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const typeHdr = headerTypeLabel(mission);
  const minutes = mission.estimated_minutes ?? null;
  const desc = (mission.description ?? "").trim();
  const rationale = (mission.rationale ?? "").trim();
  const showResistance =
    Boolean(mission.quit_path_id) || mission.type === "resistance";

  return (
    <LinearGradient colors={BG_GRADIENT} style={styles.container}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerBar}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
              <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
            </Pressable>
            <Text style={styles.headerType} numberOfLines={2}>
              {typeHdr}
            </Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.padH}>
            <View style={styles.diffRow}>
              <View style={[styles.diffChip, { backgroundColor: pill.bg, borderColor: pill.border }]}>
                <Text style={[styles.diffChipTxt, { color: pill.text }]}>{pill.label}</Text>
              </View>
              {minutes != null ? (
                <View style={styles.timeRow}>
                  <Ionicons name="time-outline" size={14} color={TEXT_MUTED} />
                  <Text style={styles.timeTxt}>{minutes} min</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.title}>{mission.title}</Text>

            {desc.length > 0 ? (
              <View style={styles.block}>
                <Text style={styles.subHdr}>MISSION</Text>
                <Text style={styles.bodyMuted}>{desc}</Text>
              </View>
            ) : null}

            {rationale.length > 0 ? (
              <View style={[styles.block, styles.blockDivider]}>
                <Text style={styles.subHdr}>WHY THIS TODAY</Text>
                <Text style={styles.rationaleBody}>{rationale}</Text>
              </View>
            ) : null}

            {showResistance ? (
              <View style={[styles.block, styles.blockDivider]}>
                <View style={styles.resistCard}>
                  <Text style={styles.subHdr}>RESISTANCE CONTEXT</Text>
                  <Text style={styles.resistPhase}>{phaseLabel(mission.quit_phase)}</Text>
                  <Text style={styles.resistNeed}>
                    {(mission.quit_need_description ?? "").trim() || "Your plan is built around how this habit shows up for you."}
                  </Text>
                </View>
              </View>
            ) : null}

            {isCompleted ? (
              <View style={[styles.block, styles.blockDivider]}>
                <Text style={styles.rateLbl}>How hard was this?</Text>
                <View style={styles.ratingRow}>
                  <Pressable
                    disabled={ratedLocked || ratingPending}
                    onPress={() => submitRating(1)}
                    style={[
                      styles.rateCell,
                      effectiveRating === 1 ? styles.rateCellHardOn : styles.rateCellOff,
                    ]}
                  >
                    <Svg width={28} height={22} viewBox="0 0 28 22">
                      <Path
                        d="M4 18 L10 6 L14 14 L18 4 L24 18 Z"
                        stroke="#EF4444"
                        strokeWidth={1.8}
                        fill="none"
                        strokeLinejoin="round"
                      />
                    </Svg>
                    <Text style={[styles.rateCellLbl, { color: "#EF4444" }]}>Too Hard</Text>
                  </Pressable>
                  <Pressable
                    disabled={ratedLocked || ratingPending}
                    onPress={() => submitRating(3)}
                    style={[
                      styles.rateCell,
                      effectiveRating === 3 ? styles.rateCellMidOn : styles.rateCellOff,
                    ]}
                  >
                    <Svg width={28} height={22} viewBox="0 0 28 22">
                      <Path
                        d="M3 14 Q14 6 25 14"
                        stroke="#8B5CF6"
                        strokeWidth={2}
                        fill="none"
                        strokeLinecap="round"
                      />
                    </Svg>
                    <Text style={[styles.rateCellLbl, { color: "#8B5CF6" }]}>Just Right</Text>
                  </Pressable>
                  <Pressable
                    disabled={ratedLocked || ratingPending}
                    onPress={() => submitRating(5)}
                    style={[
                      styles.rateCell,
                      effectiveRating === 5 ? styles.rateCellEasyOn : styles.rateCellOff,
                    ]}
                  >
                    <Svg width={28} height={22} viewBox="0 0 28 22">
                      <Path
                        d="M6 14 Q14 10 22 14"
                        stroke="#A78BFA"
                        strokeWidth={2}
                        fill="none"
                        strokeLinecap="round"
                      />
                    </Svg>
                    <Text style={[styles.rateCellLbl, { color: "#A78BFA" }]}>Too Easy</Text>
                  </Pressable>
                </View>
                {ratingPending ? (
                  <ActivityIndicator color="#8B5CF6" style={{ marginTop: 12 }} />
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={styles.footer}>
            {!isCompleted ? (
              <Pressable
                onPress={handleComplete}
                disabled={completing}
                style={({ pressed }) => [pressed && !completing ? { transform: [{ scale: 0.98 }] } : null]}
              >
                <LinearGradient
                  colors={["#6D28D9", "#8B5CF6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.completeBtn, completing && { opacity: 0.7 }]}
                >
                  {completing ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.completeBtnTxt}>Complete Mission</Text>
                  )}
                </LinearGradient>
              </Pressable>
            ) : (
              <View style={styles.doneBtn}>
                <Text style={styles.doneBtnTxt}>Completed ✓</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  padH: { paddingHorizontal: 20 },
  headerBar: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(20,24,36,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerType: {
    flex: 1,
    marginHorizontal: 8,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    color: TEXT_MUTED,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  diffRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  diffChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  diffChipTxt: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  timeTxt: { fontSize: 10, color: TEXT_MUTED },
  title: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.6,
    color: TEXT_PRIMARY,
    lineHeight: 30,
    marginBottom: 12,
  },
  block: { marginBottom: 4 },
  blockDivider: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#1E2333",
  },
  subHdr: {
    fontSize: 9,
    fontWeight: "700",
    color: TEXT_DIM,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  bodyMuted: { fontSize: 14, color: TEXT_SECONDARY, lineHeight: 25 },
  rationaleBody: { fontSize: 13, color: TEXT_MUTED, lineHeight: 22 },
  resistCard: {
    backgroundColor: "#140C0C",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.12)",
  },
  resistPhase: { fontSize: 13, fontWeight: "700", color: "#EF4444", marginBottom: 6 },
  resistNeed: { fontSize: 12, color: TEXT_MUTED, lineHeight: 18 },
  rateLbl: { fontSize: 12, fontWeight: "700", color: TEXT_SECONDARY, marginBottom: 12 },
  ratingRow: { flexDirection: "row", gap: 8 },
  rateCell: {
    width: 80,
    height: 72,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 6,
  },
  rateCellOff: {
    backgroundColor: "#141824",
    borderWidth: 1,
    borderColor: "#1E2333",
  },
  rateCellHardOn: {
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1.5,
    borderColor: "#EF4444",
  },
  rateCellMidOn: {
    backgroundColor: "rgba(139,92,246,0.08)",
    borderWidth: 1.5,
    borderColor: "#8B5CF6",
  },
  rateCellEasyOn: {
    backgroundColor: "rgba(167,139,250,0.08)",
    borderWidth: 1.5,
    borderColor: "#A78BFA",
  },
  rateCellLbl: { marginTop: 6, fontSize: 10, fontWeight: "600" },
  footer: { paddingHorizontal: 16, marginTop: 24 },
  completeBtn: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#8B5CF6",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
        }
      : { elevation: 8 }),
  },
  completeBtnTxt: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
  doneBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: "#141824",
    borderWidth: 1,
    borderColor: "#1E2333",
    alignItems: "center",
    justifyContent: "center",
  },
  doneBtnTxt: { fontSize: 15, fontWeight: "700", color: TEXT_MUTED },
  skeletonPad: { paddingHorizontal: 20, paddingTop: 16 },
  skelLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: "#1E2333",
    width: "60%",
    marginBottom: 10,
  },
  errorWrap: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  errorTxt: { color: TEXT_SECONDARY, textAlign: "center", marginBottom: 16 },
  retryBtn: {
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "#141824",
    borderWidth: 1,
    borderColor: "#2A3050",
  },
  retryTxt: { color: TEXT_PRIMARY, fontWeight: "700" },
});
