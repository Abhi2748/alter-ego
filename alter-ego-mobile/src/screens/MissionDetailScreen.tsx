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
  TextInput,
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

function RatingIcon({ value, color }: { value: 1 | 3 | 5; color: string }) {
  if (value === 1) {
    return (
      <Svg width={26} height={20} viewBox="0 0 26 20">
        <Path
          d="M3 17L8 7L13 13L18 5L23 17Z"
          stroke={color}
          strokeWidth={1.7}
          fill="none"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  if (value === 3) {
    return (
      <Svg width={26} height={20} viewBox="0 0 26 20">
        <Path
          d="M3 14 Q13 6 23 14"
          stroke={color}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  return (
    <Svg width={26} height={20} viewBox="0 0 26 20">
      <Path
        d="M5 14 Q13 10 21 14"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
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
  const [feedbackText, setFeedbackText] = useState<string>("");
  const [feedbackFocused, setFeedbackFocused] = useState(false);

  const serverRating = mission?.difficulty_rating;
  const effectiveRating =
    serverRating === 1 || serverRating === 3 || serverRating === 5 ? serverRating : localRating;

  useEffect(() => {
    if (serverRating === 1 || serverRating === 3 || serverRating === 5) {
      setLocalRating(serverRating);
    }
    setFeedbackText(mission?.feedback_text ?? "");
  }, [serverRating, mission?.feedback_text]);

  const isCompleted = mission?.completed === true;
  const ratedLocked = serverRating === 1 || serverRating === 3 || serverRating === 5;

  const diffKey = useMemo(() => normDifficulty(mission?.difficulty), [mission?.difficulty]);
  const pill = useMemo(() => difficultyPill(diffKey), [diffKey]);

  const selectRatingTile = useCallback(
    (rating: 1 | 3 | 5) => {
      if (ratedLocked || !isCompleted) return;
      setLocalRating(rating);
    },
    [ratedLocked, isCompleted]
  );

  const submitRating = useCallback(() => {
    if (!missionId || ratedLocked || !isCompleted || localRating === null) return;
    rateMission(
      { missionId, rating: localRating, feedback: feedbackText.trim() || undefined },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: MISSION_KEYS.detail(missionId) });
        },
        onError: (e) => {
          Alert.alert("Could not save rating", getErrorMessage(e));
        },
      }
    );
  }, [missionId, ratedLocked, isCompleted, localRating, feedbackText, rateMission, queryClient]);

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
  const domainKnowledge = (mission.domain_knowledge ?? "").trim();
  const showResistance = Boolean(mission.quit_path_id) || mission.type === "resistance";
  const isInterest = mission.type === "interest";
  const canSubmitRating = isCompleted && !ratedLocked && localRating !== null;

  return (
    <LinearGradient colors={BG_GRADIENT} style={styles.container}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── HEADER ── */}
          <View style={styles.headerBar}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
              <Ionicons name="chevron-back" size={22} color={TEXT_PRIMARY} />
            </Pressable>
            <Text style={styles.headerType} numberOfLines={2}>
              {typeHdr}
            </Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.padH}>
            {/* ── DIFFICULTY + TIME + XP ── */}
            <View style={styles.metaRow}>
              <View style={[styles.diffChip, { backgroundColor: pill.bg, borderColor: pill.border }]}>
                <View style={[styles.diffDot, { backgroundColor: pill.text }]} />
                <Text style={[styles.diffChipTxt, { color: pill.text }]}>{pill.label}</Text>
              </View>
              {minutes != null ? (
                <View style={styles.timeBadge}>
                  <Ionicons name="time-outline" size={12} color={TEXT_MUTED} />
                  <Text style={styles.timeTxt}>{minutes} min</Text>
                </View>
              ) : null}
              <View style={styles.xpBadge}>
                <Text style={styles.xpTxt}>★ {mission.xp_value ?? 0} XP</Text>
              </View>
            </View>

            {/* ── TITLE ── */}
            <Text style={styles.title}>{mission.title}</Text>

            {/* ── HOW TO DO THIS (interest missions only) ── */}
            {isInterest && desc.length > 0 ? (
              <>
                <View style={styles.sectionHdr}>
                  <View style={[styles.sectionBar, { backgroundColor: "#6D28D9" }]} />
                  <Text style={styles.sectionLabel}>How to do this</Text>
                </View>
                <View style={styles.guideCard}>
                  <Text style={styles.guideText}>{desc}</Text>
                </View>
                <View style={styles.blockDivider} />
              </>
            ) : null}

            {/* ── MISSION DESCRIPTION (resistance / personal / core) ── */}
            {!isInterest && desc.length > 0 ? (
              <>
                <View style={styles.sectionHdr}>
                  <View style={[styles.sectionBar, { backgroundColor: "#6D28D9" }]} />
                  <Text style={styles.sectionLabel}>Mission</Text>
                </View>
                <Text style={styles.bodyText}>{desc}</Text>
                <View style={styles.blockDivider} />
              </>
            ) : null}

            {/* ── WHY THIS TODAY ── */}
            {rationale.length > 0 ? (
              <>
                <View style={styles.sectionHdr}>
                  <View style={[styles.sectionBar, { backgroundColor: "#374151" }]} />
                  <Text style={styles.sectionLabel}>Why this today</Text>
                </View>
                <Text style={styles.rationaleText}>{rationale}</Text>
                <View style={styles.blockDivider} />
              </>
            ) : null}

            {/* ── THE RESEARCH (interest missions only, if available) ── */}
            {isInterest && domainKnowledge.length > 0 ? (
              <>
                <View style={styles.sectionHdr}>
                  <View style={[styles.sectionBar, { backgroundColor: "#1F2937" }]} />
                  <Text style={styles.sectionLabel}>The research</Text>
                </View>
                <View style={styles.researchCard}>
                  <Text style={styles.researchText}>{domainKnowledge}</Text>
                </View>
                <View style={styles.blockDivider} />
              </>
            ) : null}

            {/* ── RESISTANCE CONTEXT ── */}
            {showResistance ? (
              <>
                <View style={styles.sectionHdr}>
                  <View style={[styles.sectionBar, { backgroundColor: "#991B1B" }]} />
                  <Text style={styles.sectionLabel}>Resistance context</Text>
                </View>
                <View style={styles.resistCard}>
                  <Text style={styles.resistPhase}>{phaseLabel(mission.quit_phase)}</Text>
                  <Text style={styles.resistNeed}>
                    {(mission.quit_need_description ?? "").trim() ||
                      "Your plan is built around how this habit shows up for you."}
                  </Text>
                </View>
                <View style={styles.blockDivider} />
              </>
            ) : null}

            {/* ── RATING SECTION (post-completion) ── */}
            {isCompleted ? (
              <View style={styles.ratingSection}>
                {ratedLocked ? (
                  <>
                    <Text style={styles.rateLbl}>How hard was this?</Text>
                    <View style={styles.ratingRow}>
                      {(
                        [
                          {
                            value: 1 as const,
                            label: "Too Hard",
                            color: "#EF4444",
                            selectedStyle: styles.rateCellHardOn,
                          },
                          {
                            value: 3 as const,
                            label: "Just Right",
                            color: "#8B5CF6",
                            selectedStyle: styles.rateCellMidOn,
                          },
                          {
                            value: 5 as const,
                            label: "Too Easy",
                            color: "#A78BFA",
                            selectedStyle: styles.rateCellEasyOn,
                          },
                        ] as const
                      ).map((opt) => (
                        <View
                          key={opt.value}
                          style={[
                            styles.rateCell,
                            effectiveRating === opt.value ? opt.selectedStyle : styles.rateCellOff,
                            styles.rateCellLocked,
                          ]}
                        >
                          <RatingIcon value={opt.value} color={opt.color} />
                          <Text style={[styles.rateCellLbl, { color: opt.color }]}>{opt.label}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.ratingSaved}>
                      <Ionicons name="checkmark-circle" size={15} color="#8B5CF6" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ratingSavedTxt}>Rating saved. Your missions will adapt.</Text>
                        {feedbackText.length > 0 ? (
                          <Text style={styles.ratingSavedFeedback}>&ldquo;{feedbackText}&rdquo;</Text>
                        ) : null}
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.rateLbl}>How hard was this?</Text>
                    <View style={styles.ratingRow}>
                      {(
                        [
                          {
                            value: 1 as const,
                            label: "Too Hard",
                            color: "#EF4444",
                            selectedStyle: styles.rateCellHardOn,
                          },
                          {
                            value: 3 as const,
                            label: "Just Right",
                            color: "#8B5CF6",
                            selectedStyle: styles.rateCellMidOn,
                          },
                          {
                            value: 5 as const,
                            label: "Too Easy",
                            color: "#A78BFA",
                            selectedStyle: styles.rateCellEasyOn,
                          },
                        ] as const
                      ).map((opt) => (
                        <Pressable
                          key={opt.value}
                          onPress={() => selectRatingTile(opt.value)}
                          style={[
                            styles.rateCell,
                            localRating === opt.value ? opt.selectedStyle : styles.rateCellOff,
                          ]}
                        >
                          {localRating === opt.value ? (
                            <View style={[styles.rateCheck, { backgroundColor: opt.color }]}>
                              <Ionicons name="checkmark" size={9} color="white" />
                            </View>
                          ) : null}
                          <RatingIcon value={opt.value} color={opt.color} />
                          <Text style={[styles.rateCellLbl, { color: opt.color }]}>{opt.label}</Text>
                        </Pressable>
                      ))}
                    </View>

                    <View style={[styles.feedbackWrap, feedbackFocused && styles.feedbackWrapFocused]}>
                      <TextInput
                        style={styles.feedbackInput}
                        placeholder="Tell us more (optional)..."
                        placeholderTextColor={TEXT_DIM}
                        value={feedbackText}
                        onChangeText={setFeedbackText}
                        onFocus={() => setFeedbackFocused(true)}
                        onBlur={() => setFeedbackFocused(false)}
                        multiline
                        maxLength={200}
                        returnKeyType="done"
                        blurOnSubmit
                      />
                      {feedbackText.length > 0 ? (
                        <Text style={styles.feedbackCount}>{feedbackText.length}/200</Text>
                      ) : null}
                    </View>

                    <Pressable
                      onPress={submitRating}
                      disabled={!canSubmitRating || ratingPending}
                      style={[
                        styles.submitRatingBtn,
                        (!canSubmitRating || ratingPending) && styles.submitRatingBtnDisabled,
                      ]}
                    >
                      {ratingPending ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : (
                        <Text
                          style={[
                            styles.submitRatingTxt,
                            !canSubmitRating && styles.submitRatingTxtDisabled,
                          ]}
                        >
                          {localRating === null ? "Select a rating above" : "Submit Rating"}
                        </Text>
                      )}
                    </Pressable>
                  </>
                )}
              </View>
            ) : null}
          </View>

          {/* ── FOOTER BUTTON ── */}
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
                    <>
                      <Text style={styles.completeBtnTxt}>Complete Mission</Text>
                      <Text style={styles.completeBtnXp}>★ {mission.xp_value ?? 0} XP</Text>
                    </>
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
  scrollContent: { paddingBottom: 48 },
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
    fontSize: 10,
    fontWeight: "700",
    color: TEXT_MUTED,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  diffChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  diffDot: { width: 6, height: 6, borderRadius: 3 },
  diffChipTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "#1E2333",
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  timeTxt: { fontSize: 11, color: TEXT_MUTED },
  xpBadge: {
    marginLeft: "auto",
    backgroundColor: "rgba(139,92,246,0.10)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.22)",
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  xpTxt: { fontSize: 11, fontWeight: "700", color: "#A78BFA" },

  title: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
    color: TEXT_PRIMARY,
    lineHeight: 30,
    marginBottom: 20,
  },

  sectionHdr: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionBar: { width: 3, height: 14, borderRadius: 2 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    color: TEXT_DIM,
  },
  blockDivider: {
    height: 1,
    backgroundColor: "#1E2333",
    marginVertical: 20,
  },

  guideCard: {
    backgroundColor: "rgba(139,92,246,0.05)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.14)",
    borderRadius: 14,
    padding: 14,
  },
  guideText: { fontSize: 13, color: "#C4B5FD", lineHeight: 22 },

  bodyText: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 23 },

  rationaleText: { fontSize: 13, color: TEXT_MUTED, lineHeight: 22 },

  researchCard: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "#1E2333",
    borderRadius: 12,
    padding: 14,
  },
  researchText: { fontSize: 12, color: TEXT_DIM, lineHeight: 20 },

  resistCard: {
    backgroundColor: "#140C0C",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.14)",
  },
  resistPhase: { fontSize: 13, fontWeight: "700", color: "#EF4444", marginBottom: 6 },
  resistNeed: { fontSize: 12, color: TEXT_MUTED, lineHeight: 18 },

  ratingSection: { marginBottom: 8 },
  rateLbl: { fontSize: 13, fontWeight: "700", color: TEXT_SECONDARY, marginBottom: 12 },
  ratingRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  rateCell: {
    flex: 1,
    height: 76,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 4,
    position: "relative",
  },
  rateCellOff: { backgroundColor: "#141824", borderWidth: 1, borderColor: "#1E2333" },
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
  rateCellLocked: { opacity: 0.7 },
  rateCellLbl: { fontSize: 10, fontWeight: "600" },
  rateCheck: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  feedbackWrap: {
    backgroundColor: "#141824",
    borderWidth: 1.5,
    borderColor: "#1E2333",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    minHeight: 52,
  },
  feedbackWrapFocused: { borderColor: "rgba(139,92,246,0.4)" },
  feedbackInput: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    lineHeight: 19,
    minHeight: 28,
    padding: 0,
    textAlignVertical: "top",
  },
  feedbackCount: { fontSize: 10, color: TEXT_DIM, textAlign: "right", marginTop: 4 },

  submitRatingBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#6D28D9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#6D28D9",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  submitRatingBtnDisabled: {
    backgroundColor: "#141824",
    ...Platform.select({ ios: { shadowOpacity: 0 }, android: { elevation: 0 } }),
  },
  submitRatingTxt: { fontSize: 13, fontWeight: "700", color: "white" },
  submitRatingTxtDisabled: { color: TEXT_DIM },

  ratingSaved: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(16,185,129,0.07)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.18)",
    borderRadius: 12,
    padding: 12,
  },
  ratingSavedTxt: { fontSize: 12, fontWeight: "600", color: "#6EE7B7" },
  ratingSavedFeedback: { fontSize: 11, color: TEXT_MUTED, marginTop: 3, fontStyle: "italic" },

  footer: { paddingHorizontal: 16, marginTop: 20 },
  completeBtn: {
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#8B5CF6",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  completeBtnTxt: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
  completeBtnXp: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.6)" },
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
  skelLine: { height: 14, borderRadius: 7, backgroundColor: "#1E2333", width: "60%", marginBottom: 10 },
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
