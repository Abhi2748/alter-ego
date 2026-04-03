/**
 * Twin Comparison Screen — Tab 3. Today + Journal tabs.
 * Arena, total XP bar (lifetime totals + gap; daily XP lives on Home Twin strip), verdict, heatmap, pillar DNA.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTwinState, useTwinStrip } from "@/hooks/useTwin";
import { twinService } from "@/services/twin";
import type { DayComparison, PillarDNA, TwinActivity, TwinComparisonOut } from "../utils/api";
import { apiClient, isApiError } from "@/services/api";
import { TwinComparisonShareCard } from "../components/TwinComparisonShareCard";
import { SkeletonBlock } from "@/components/SkeletonBlock";
import { useUserStore } from "@/store/userStore";
import {
  CHARACTER_STAGE_NAMES,
  DAILY_XP_CAPS,
} from "@/constants/characterProgression";

const CHAT_FAB_BOTTOM = 8;
const CHAT_FAB_RIGHT = 16;
const CHAT_FAB_SIZE = 56;

/** Shown only when strip copy has not loaded from the API yet. */
const DEFAULT_TWIN_VERDICT = "Still here.";

export type TwinJournalEntry = {
  id: string;
  entry_date: string;
  content: string;
  relationship_phase: string;
  /** User missions that day (reference). */
  missions_completed: number;
  missions_total: number;
  /** Twin's simulated missions — shown in the journal card header. */
  twin_missions_completed?: number;
  twin_missions_total?: number;
  is_new?: boolean;
};

function localCalendarYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatJournalDateLabel(entryDate: string): string {
  const d = entryDate.slice(0, 10);
  const today = localCalendarYmd();
  if (d === today) return "Today";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
  if (d === yStr) return "Yesterday";
  try {
    const dt = new Date(`${d}T12:00:00`);
    return dt.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return entryDate;
  }
}

function getDeltaPill(
  userRate: number,
  twinRate: number
): { label: string; variant: "user" | "twin" | "even" } {
  const diff = Math.round((userRate - twinRate) * 100);
  if (Math.abs(diff) <= 5) return { label: "Even", variant: "even" };
  if (diff > 0) return { label: `You +${diff}%`, variant: "user" };
  return { label: `Twin +${Math.abs(diff)}%`, variant: "twin" };
}

function NarrativeConfrontation({ text }: { text: string }) {
  return (
    <View style={styles.confrontation}>
      <LinearGradient
        colors={["rgba(139,92,246,0.07)", "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Text style={styles.confrontationEyebrow}>THE GAP</Text>
      <Text style={styles.confrontationText}>{text}</Text>
    </View>
  );
}

function JournalPreview({
  entry,
  onPress,
}: {
  entry: TwinJournalEntry;
  onPress: () => void;
}) {
  const preview = (() => {
    const c = entry.content ?? "";
    const dot = c.indexOf(". ");
    if (dot > 0 && dot < 120) return c.slice(0, dot + 1);
    if (c.length > 120) return `${c.slice(0, 117)}...`;
    return c;
  })();

  return (
    <View style={styles.journalPreview}>
      <View style={styles.journalPreviewHdr}>
        <View style={styles.journalPreviewEyebrowRow}>
          <View style={styles.journalPreviewDot} />
          <Text style={styles.journalPreviewEyebrow}>Twin&apos;s Journal</Text>
        </View>
        <Text style={styles.journalPreviewDate}>{formatJournalDateLabel(entry.entry_date)}</Text>
      </View>
      <Text style={styles.journalPreviewText}>&ldquo;{preview}&rdquo;</Text>
      <Pressable onPress={onPress} style={styles.journalReadMore}>
        <Text style={styles.journalReadMoreText}>Read more →</Text>
      </Pressable>
    </View>
  );
}

function TwinChallengeCard({
  challenge,
  onAccept,
  onDecline,
  loading,
}: {
  challenge: import("@/services/twin").TwinChallenge;
  onAccept: () => void;
  onDecline: () => void;
  loading: boolean;
}) {
  const progressPct = Math.min(
    100,
    Math.round((challenge.current_value / Math.max(challenge.target_value, 1)) * 100)
  );
  const isPending = challenge.status === "pending";
  const isAccepted = challenge.status === "accepted";
  const isCompleted = challenge.status === "completed";

  return (
    <View style={challengeStyles.card}>
      {/* Top shimmer line */}
      <LinearGradient
        colors={["transparent", "rgba(139,92,246,0.4)", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={challengeStyles.topLine}
        pointerEvents="none"
      />

      {/* Header */}
      <View style={challengeStyles.header}>
        <View style={challengeStyles.eyebrowRow}>
          <View style={challengeStyles.pulseDot} />
          <Text style={challengeStyles.eyebrow}>Twin Challenge</Text>
        </View>
        {isCompleted ? (
          <Text style={challengeStyles.completedBadge}>Completed ✓</Text>
        ) : (
          <Text style={challengeStyles.timer}>
            {challenge.days_remaining === 0
              ? "Last day"
              : `${challenge.days_remaining}d left`}
          </Text>
        )}
      </View>

      {/* Challenge text */}
      <Text style={challengeStyles.text}>{challenge.challenge_text}</Text>

      {/* Progress (only when accepted or completed) */}
      {(isAccepted || isCompleted) ? (
        <View style={challengeStyles.progressSection}>
          <View style={challengeStyles.progressLabels}>
            <Text style={challengeStyles.progressLabelLeft}>Progress</Text>
            <Text style={challengeStyles.progressLabelRight}>
              {challenge.current_value} / {challenge.target_value}
            </Text>
          </View>
          <View style={challengeStyles.track}>
            <View
              style={[
                challengeStyles.fill,
                { width: `${progressPct}%` as any },
                isCompleted && challengeStyles.fillCompleted,
              ]}
            />
          </View>
        </View>
      ) : null}

      {/* XP reward line */}
      <Text style={challengeStyles.xpLine}>
        Reward: +{challenge.xp_reward} Aether
      </Text>

      {/* Actions (only when pending) */}
      {isPending ? (
        <View style={challengeStyles.actions}>
          <Pressable
            style={[challengeStyles.btn, challengeStyles.btnAccept]}
            onPress={onAccept}
            disabled={loading}
          >
            <LinearGradient
              colors={["#5B21B6", "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={challengeStyles.btnGradient}
            >
              <Text style={challengeStyles.btnAcceptText}>
                {loading ? "…" : "Accept"}
              </Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            style={[challengeStyles.btn, challengeStyles.btnDecline]}
            onPress={onDecline}
            disabled={loading}
          >
            <Text style={challengeStyles.btnDeclineText}>Decline</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const challengeStyles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginTop: 14,
    backgroundColor: "rgba(139,92,246,0.04)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
    borderRadius: 14,
    padding: 14,
    paddingTop: 16,
    position: "relative",
    overflow: "hidden",
  },
  topLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#8B5CF6",
    ...Platform.select({
      ios: {
        shadowColor: "#8B5CF6",
        shadowOpacity: 0.9,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 2 },
    }),
  },
  eyebrow: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    color: "rgba(139,92,246,0.6)",
    textTransform: "uppercase",
  },
  timer: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#4B5563",
  },
  completedBadge: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#22C55E",
  },
  text: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#E5E7EB",
    lineHeight: 19,
    marginBottom: 10,
  },
  progressSection: {
    marginBottom: 8,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  progressLabelLeft: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
  },
  progressLabelRight: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#A78BFA",
  },
  track: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#8B5CF6",
  },
  fillCompleted: {
    backgroundColor: "#22C55E",
  },
  xpLine: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "rgba(139,92,246,0.45)",
    marginBottom: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  btn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    overflow: "hidden",
  },
  btnAccept: {},
  btnDecline: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnAcceptText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  btnDeclineText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#4B5563",
  },
});

export function TwinComparisonScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [shareVisible, setShareVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<"today" | "journal">("today");
  const [journalSeen, setJournalSeen] = useState(false);

  const {
    data: twinData,
    isLoading: loading,
    error,
    refetch,
  } = useTwinState();

  const { data: stripData } = useTwinStrip();
  const profile = useUserStore((s) => s.profile);

  const comparison: TwinComparisonOut | null = useMemo(() => {
    if (!twinData) return null;

    const user = twinData.user;
    const twin = twinData.twin;
    const gap = twinData.gap;

    const inferredGapDays = gap.user_is_ahead ? -Math.abs(gap.days_user_ahead) : gap.days_user_ahead;

    const timeline = twinData.twin_timeline ?? [];
    const activities: TwinActivity[] = timeline.map((row) => {
      const d = String(row.difficulty ?? "medium").toLowerCase();
      const difficulty: TwinActivity["difficulty"] =
        d === "easy" ? "Easy" : d === "hard" || d === "elite" ? "Hard" : "Medium";
      const mt = String(row.mission_type ?? "core").toLowerCase();
      const mission_type: TwinActivity["mission_type"] =
        mt === "interest" ? "focus" : mt === "personal" ? "personal" : "core";
      return {
        mission_title: row.mission_title,
        mission_type,
        difficulty,
        xp_earned: row.xp_earned,
        completed_at: row.completed_at,
      };
    });

    const stripMessage =
      twinData.strip_message?.trim() ||
      stripData?.strip_message?.trim() ||
      null;

    return {
      user_xp: user.total_xp,
      user_pet_stage: user.pet_stage,
      user_pet_stage_name: user.pet_name ?? "",
      user_streak: user.current_streak,
      user_power_score: user.power_score,

      twin_xp: twin.twin_xp,
      twin_pet_stage: twin.pet_stage,
      twin_pet_stage_name: twin.pet_name ?? "",
      twin_streak: twin.streak,
      twin_power_score: twin.power_score,

      current_gap_state: twin.gap_state,
      gap_line: "",
      strip_message: stripMessage,
      comparison_line: twinData.comparison_line?.trim() ?? null,
      gap_days: inferredGapDays,
      username: user.username,
      twin_today_activities: activities,
      week_heatmap: twinData.week_heatmap,
      pillar_dna: twinData.pillar_dna,
    };
  }, [stripData?.strip_message, twinData, profile?.current_streak, profile?.power_score]);

  const { data: journalData, refetch: refetchJournal } = useQuery({
    queryKey: ["twin", "journal"],
    queryFn: async () => {
      try {
        return await apiClient.get<TwinJournalEntry[]>("/api/v1/twin/journal");
      } catch (e) {
        if (isApiError(e) && (e.status === 404 || e.status === 405)) {
          return [];
        }
        return [];
      }
    },
    enabled: !!twinData,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: "always",
    retry: 1,
  });

  const queryClient = useQueryClient();

  const { data: challengeData } = useQuery({
    queryKey: ["twin", "challenge"],
    queryFn: async () => {
      try {
        return await twinService.getChallenge();
      } catch {
        return null;
      }
    },
    enabled: !!twinData,
    staleTime: 60 * 1000,
    refetchOnMount: "always",
  });

  const [challengeLoading, setChallengeLoading] = useState(false);

  const handleAcceptChallenge = async () => {
    setChallengeLoading(true);
    try {
      await twinService.acceptChallenge();
      await queryClient.invalidateQueries({ queryKey: ["twin", "challenge"] });
    } catch {
      // silent fail
    } finally {
      setChallengeLoading(false);
    }
  };

  const handleDeclineChallenge = async () => {
    setChallengeLoading(true);
    try {
      await twinService.declineChallenge();
      await queryClient.invalidateQueries({ queryKey: ["twin", "challenge"] });
    } catch {
      // silent fail
    } finally {
      setChallengeLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (activeTab === "journal" && twinData) {
        void refetchJournal();
      }
    }, [activeTab, twinData, refetchJournal])
  );

  const handleTabPress = useCallback((tab: "today" | "journal") => {
    setActiveTab(tab);
    if (tab === "journal") {
      setJournalSeen(true);
      void apiClient.post("/api/v1/twin/journal/mark-read").catch(() => {});
    }
  }, []);

  const showJournalDot = useMemo(() => {
    if (journalSeen) return false;
    if (!journalData || journalData.length === 0) return false;
    const latest = journalData[0];
    const today = localCalendarYmd();
    return latest.entry_date.slice(0, 10) === today;
  }, [journalData, journalSeen]);

  const openTwinChat = () => {
    (navigation as any).navigate("TwinChat");
  };

  const weekHeatmap: DayComparison[] = twinData?.week_heatmap ?? [];
  const pillarDna: PillarDNA[] = twinData?.pillar_dna ?? [];

  const twinVerdict =
    twinData?.comparison_line?.trim() ||
    stripData?.strip_message?.trim() ||
    (loading && !twinData ? "…" : DEFAULT_TWIN_VERDICT);

  const userStage = Math.min(Math.max(twinData?.user.character_stage ?? 1, 1), 6);
  const twinStage = Math.min(Math.max(twinData?.twin.character_stage ?? 1, 1), 6);
  const userDailyCap = DAILY_XP_CAPS[userStage] ?? 100;
  const twinDailyCap = DAILY_XP_CAPS[twinStage] ?? 100;

  /** Lifetime totals — daily XP is on the Home Twin strip. */
  const userTotalXp = twinData?.user.total_xp ?? 0;
  const twinTotalXp = twinData?.twin.twin_xp ?? 0;

  const xpMax = Math.max(userTotalXp, twinTotalXp, 1);
  const userXpPct = Math.min((userTotalXp / xpMax) * 100, 100);
  const twinXpPct = Math.min((twinTotalXp / xpMax) * 100, 100);
  const userStageName =
    twinData?.user.character_stage_name ??
    CHARACTER_STAGE_NAMES[userStage - 1] ??
    "The Awakened";
  const twinStageName =
    twinData?.twin.character_stage_name ??
    CHARACTER_STAGE_NAMES[twinStage - 1] ??
    "The Awakened";
  const userStageLbl = (CHARACTER_STAGE_NAMES[userStage - 1] ?? "Awakened").toUpperCase();
  const twinStageLbl = (CHARACTER_STAGE_NAMES[twinStage - 1] ?? "Awakened").toUpperCase();

  const todayTab = (
    <>
      <View style={styles.arena}>
        <LinearGradient
          colors={["transparent", "rgba(109,40,217,0.08)", "transparent"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.arenaSide}>
          <Text style={styles.arenaSideLabel}>YOU</Text>
          <View style={styles.charCard}>
            <Text style={styles.charStageLbl}>{userStageLbl}</Text>
          </View>
          <Text style={styles.charName}>{comparison?.username ?? "You"}</Text>
          <Text style={styles.charStageName}>{userStageName}</Text>
        </View>

        <View style={styles.fractureWrap}>
          <LinearGradient
            colors={["transparent", "rgba(192,132,252,0.85)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.fractureLine}
          />
        </View>

        <View style={styles.arenaSide}>
          <Text style={[styles.arenaSideLabel, styles.arenaSideLabelTwin]}>TWIN</Text>
          <View style={[styles.charCard, styles.charCardTwin]}>
            <Text style={[styles.charStageLbl, styles.charStageLblTwin]}>{twinStageLbl}</Text>
          </View>
          <Text style={[styles.charName, styles.charNameTwin]}>Shadow</Text>
          <Text style={[styles.charStageName, styles.charStageNameTwin]}>{twinStageName}</Text>
        </View>
      </View>

      <View style={styles.xpStripWrap}>
        <Text style={styles.xpStripCaption}>Total XP</Text>
        <View style={styles.xpStrip}>
          <View style={styles.xpCol}>
            <Text style={styles.xpYouLbl}>{userTotalXp.toLocaleString()} XP</Text>
            <Text style={styles.xpCapHint}>Daily cap {userDailyCap}</Text>
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFillTwin, { width: `${twinXpPct}%` }]} />
            <View style={[styles.xpFillUser, { width: `${userXpPct}%` }]} />
            <View
              style={[
                styles.xpMarker,
                styles.xpMarkerUser,
                { left: `${Math.max(0, userXpPct - 1.5)}%` },
              ]}
            />
            <View
              style={[
                styles.xpMarker,
                styles.xpMarkerTwin,
                { left: `${Math.max(0, twinXpPct - 1.5)}%` },
              ]}
            />
          </View>
          <View style={[styles.xpCol, styles.xpColTwin]}>
            <Text style={styles.xpTwinLbl}>{twinTotalXp.toLocaleString()} XP</Text>
            <Text style={styles.xpCapHintTwin}>Daily cap {twinDailyCap}</Text>
          </View>
        </View>
      </View>

      {twinVerdict ? <NarrativeConfrontation text={twinVerdict} /> : null}

      {weekHeatmap.length > 0 ? (
        <View style={styles.heatmapSection}>
          <View style={styles.sectionHdr}>
            <Text style={styles.sectionTitle}>7-Day Discipline</Text>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotUser]} />
                <Text style={styles.legendTxt}>You</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotTwin]} />
                <Text style={styles.legendTxt}>Twin</Text>
              </View>
            </View>
          </View>
          <View style={styles.heatmapGrid}>
            {weekHeatmap.map((day) => {
              const maxBarH = 44;
              const twinH = Math.max(3, day.twin_completion_rate * maxBarH);
              const userH = Math.max(3, day.user_completion_rate * maxBarH);
              return (
                <View key={day.date} style={styles.heatmapDay}>
                  <View style={styles.heatmapBarWrap}>
                    <View
                      style={[
                        styles.heatmapBarTwin,
                        { height: twinH },
                        day.is_today && { opacity: 0.6 },
                      ]}
                    />
                    <View
                      style={[
                        styles.heatmapBarUser,
                        { height: userH },
                        day.is_today && { opacity: 0.5 },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.heatmapDayLbl,
                      day.is_today && styles.heatmapDayLblToday,
                    ]}
                  >
                    {day.day_label[0]}
                    {day.is_today ? "·" : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {challengeData &&
      challengeData.status !== "declined" &&
      challengeData.status !== "failed" ? (
        <TwinChallengeCard
          challenge={challengeData}
          onAccept={handleAcceptChallenge}
          onDecline={handleDeclineChallenge}
          loading={challengeLoading}
        />
      ) : null}

      {pillarDna.length > 0 ? (
        <View style={styles.dnaSection}>
          <View style={styles.sectionHdr}>
            <Text style={styles.sectionTitle}>Discipline DNA</Text>
            <Text style={styles.sectionSubtitle}>7-day avg</Text>
          </View>
          {pillarDna.map((row) => {
            const { label, variant } = getDeltaPill(row.user_rate, row.twin_rate);
            const fillRate = Math.max(row.user_rate, row.twin_rate);
            const fillColor =
              variant === "user"
                ? "rgba(249,115,22,0.55)"
                : variant === "twin"
                  ? "rgba(139,92,246,0.58)"
                  : "rgba(107,114,128,0.35)";
            return (
              <View key={row.pillar} style={styles.dnaRow}>
                <Text style={styles.dnaPillarLbl}>{row.pillar_label}</Text>
                <View style={styles.dnaDeltaTrack}>
                  <View
                    style={[
                      styles.dnaDeltaFill,
                      {
                        width: `${Math.round(fillRate * 100)}%`,
                        backgroundColor: fillColor,
                      },
                    ]}
                  />
                </View>
                <View
                  style={[
                    styles.dnaDeltaPill,
                    variant === "user" && styles.dnaDeltaPillUser,
                    variant === "twin" && styles.dnaDeltaPillTwin,
                    variant === "even" && styles.dnaDeltaPillEven,
                  ]}
                >
                  <Text
                    style={[
                      styles.dnaDeltaPillText,
                      variant === "user" && styles.dnaDeltaPillTextUser,
                      variant === "twin" && styles.dnaDeltaPillTextTwin,
                      variant === "even" && styles.dnaDeltaPillTextEven,
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {journalData && journalData.length > 0 ? (
        <JournalPreview
          entry={journalData[0]}
          onPress={() => handleTabPress("journal")}
        />
      ) : null}
    </>
  );

  const journalTab = (
    <>
      <View style={styles.journalHdr}>
        <Text style={styles.journalEyebrow}>TWIN&apos;S JOURNAL</Text>
        <Text style={styles.journalSub}>&ldquo;What I observed. What I know.&rdquo;</Text>
      </View>

      {!journalData || journalData.length === 0 ? (
        <View style={styles.journalEmpty}>
          <Text style={styles.journalEmptyTxt}>
            &ldquo;The journal grows as the Twin learns. Come back tomorrow.&rdquo;
          </Text>
        </View>
      ) : (
        journalData.map((entry, idx) => (
          <View
            key={entry.id}
            style={[styles.journalEntry, idx === 0 && styles.journalEntryToday]}
          >
            <View style={styles.journalAccent} />
            <Text style={styles.journalDate}>
              {formatJournalDateLabel(entry.entry_date)}
              {(entry.twin_missions_total ?? 0) > 0
                ? ` · ${entry.twin_missions_completed ?? 0}/${entry.twin_missions_total}`
                : ""}
            </Text>
            <Text style={styles.journalText}>&ldquo;{entry.content}&rdquo;</Text>
            {entry.relationship_phase ? (
              <View style={styles.journalMeta}>
                <Text style={styles.journalTag}>
                  {entry.relationship_phase.charAt(0).toUpperCase() +
                    entry.relationship_phase.slice(1)}
                </Text>
              </View>
            ) : null}
          </View>
        ))
      )}
    </>
  );

  if (loading && !comparison) {
    return (
      <LinearGradient
        colors={["#09091A", "#06070E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.container, styles.centered]}
      >
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + 10, paddingBottom: 14, paddingHorizontal: 16 },
          ]}
        >
          <View
            style={[styles.headerTitleWrap, { top: insets.top + 10, bottom: 14 }]}
            pointerEvents="none"
          >
            <Text style={styles.headerTitle}>Shadow Twin</Text>
          </View>
          <View style={styles.shareBtn} />
        </View>

        <View style={styles.sectionTabs}>
          <View style={[styles.sectionTab, styles.sectionTabActive]}>
            <Text style={[styles.sectionTabText, styles.sectionTabTextActive]}>Today</Text>
          </View>
          <View style={styles.sectionTab}>
            <Text style={styles.sectionTabText}>Journal</Text>
          </View>
        </View>

        <View style={{ flex: 1, width: "100%" }}>
          <View
            style={{
              height: 218,
              flexDirection: "row",
              paddingHorizontal: 16,
              alignItems: "flex-end",
              justifyContent: "space-between",
              paddingBottom: 16,
            }}
          >
            <View style={{ alignItems: "center", gap: 8, flex: 1 }}>
              <SkeletonBlock width={72} height={120} borderRadius={14} />
              <SkeletonBlock width={56} height={10} delay={80} />
            </View>
            <View style={{ width: 2, height: 100, backgroundColor: "#1E2333", opacity: 0.5 }} />
            <View style={{ alignItems: "center", gap: 8, flex: 1 }}>
              <SkeletonBlock width={72} height={120} borderRadius={14} delay={40} />
              <SkeletonBlock width={56} height={10} delay={120} />
            </View>
          </View>
          <View style={{ paddingHorizontal: 18, paddingVertical: 12 }}>
            <SkeletonBlock width="100%" height={8} borderRadius={4} delay={100} />
          </View>
          <View style={{ paddingHorizontal: 14, marginTop: 8 }}>
            <SkeletonBlock width="100%" height={64} borderRadius={12} delay={150} />
          </View>
          <View style={{ paddingHorizontal: 14, marginTop: 16 }}>
            <SkeletonBlock width="60%" height={10} delay={200} />
            <View style={{ flexDirection: "row", gap: 4, marginTop: 12 }}>
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <SkeletonBlock key={i} width={32} height={48} borderRadius={4} delay={200 + i * 20} />
              ))}
            </View>
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#09091A", "#06070E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 10,
            paddingBottom: 14,
            paddingHorizontal: 16,
          },
        ]}
      >
        <View
          style={[styles.headerTitleWrap, { top: insets.top + 10, bottom: 14 }]}
          pointerEvents="none"
        >
          <Text style={styles.headerTitle}>Shadow Twin</Text>
        </View>
        <Pressable
          onPress={() => setShareVisible(true)}
          style={styles.shareBtn}
          hitSlop={12}
          accessibilityLabel="Share comparison"
        >
          <Ionicons name="share-outline" size={18} color="#8B5CF6" />
        </Pressable>
      </View>

      <View style={styles.sectionTabs}>
        <Pressable
          style={[styles.sectionTab, activeTab === "today" && styles.sectionTabActive]}
          onPress={() => handleTabPress("today")}
        >
          <Text
            style={[
              styles.sectionTabText,
              activeTab === "today" && styles.sectionTabTextActive,
            ]}
          >
            Today
          </Text>
        </Pressable>
        <Pressable
          style={[styles.sectionTab, activeTab === "journal" && styles.sectionTabActive]}
          onPress={() => handleTabPress("journal")}
        >
          <Text
            style={[
              styles.sectionTabText,
              activeTab === "journal" && styles.sectionTabTextActive,
            ]}
          >
            Journal
          </Text>
          {showJournalDot ? <View style={styles.journalNotifDot} /> : null}
        </Pressable>
      </View>

      {error && !comparison ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : "Could not load comparison"}
          </Text>
          <Pressable onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingBottom: CHAT_FAB_BOTTOM + CHAT_FAB_SIZE + insets.bottom + 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === "today" ? todayTab : journalTab}
        </ScrollView>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.chatFab,
          { bottom: CHAT_FAB_BOTTOM, right: CHAT_FAB_RIGHT },
          pressed && styles.chatFabPressed,
        ]}
        onPress={openTwinChat}
      >
        <LinearGradient
          colors={["#5B21B6", "#8B5CF6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.chatFabGradient}
        >
          <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>

      <TwinComparisonShareCard
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        comparison={comparison}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: "flex-start", alignItems: "stretch" },
  errorWrap: { padding: 16, alignItems: "center", justifyContent: "center", flex: 1 },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
  retryButton: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 16 },
  retryLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#8B5CF6" },

  header: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: "rgba(9,9,26,0.7)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.4)",
  },
  headerTitleWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: "#E5E7EB",
  },
  shareBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(139,92,246,0.10)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTabs: {
    flexDirection: "row",
    padding: 10,
    paddingHorizontal: 16,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.2)",
  },
  sectionTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
    position: "relative",
  },
  sectionTabActive: {
    backgroundColor: "rgba(139,92,246,0.08)",
    borderColor: "rgba(139,92,246,0.18)",
  },
  sectionTabText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#4B5563",
    letterSpacing: 0.3,
  },
  sectionTabTextActive: { color: "#A78BFA" },

  arena: {
    height: 218,
    flexDirection: "row",
    alignItems: "stretch",
    position: "relative",
    overflow: "hidden",
  },
  arenaSide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 18,
    gap: 6,
    position: "relative",
  },
  arenaSideLabel: {
    position: "absolute",
    top: 18,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 3,
    textTransform: "uppercase",
    color: "rgba(229,231,235,0.22)",
  },
  arenaSideLabelTwin: { color: "rgba(167,139,250,0.28)" },
  charCard: {
    width: 92,
    height: 136,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.45)",
    backgroundColor: "rgba(20,15,48,0.7)",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 9,
    overflow: "hidden",
  },
  charCardTwin: {
    borderColor: "rgba(139,92,246,0.22)",
    backgroundColor: "rgba(35,15,68,0.75)",
  },
  charStageLbl: {
    fontSize: 7,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "rgba(107,114,128,0.35)",
    fontFamily: "Inter_600SemiBold",
  },
  charStageLblTwin: { color: "rgba(139,92,246,0.32)" },
  charName: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#9CA3AF",
  },
  charNameTwin: { color: "#A78BFA" },
  charStageName: { fontSize: 9, color: "#4B5563" },
  charStageNameTwin: { color: "rgba(139,92,246,0.45)" },

  fractureWrap: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 72,
    marginLeft: -36,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  fractureLine: {
    position: "absolute",
    width: 2,
    top: 12,
    bottom: 12,
  },

  xpStripWrap: {
    backgroundColor: "rgba(9,9,26,0.55)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.2)",
    paddingTop: 6,
    paddingBottom: 9,
  },
  xpStripCaption: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#6B7280",
    letterSpacing: 0.4,
    paddingHorizontal: 18,
    marginBottom: 4,
  },
  xpStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    gap: 10,
  },
  xpCol: {
    minWidth: 68,
    alignItems: "flex-start",
  },
  xpColTwin: {
    alignItems: "flex-end",
  },
  xpYouLbl: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "rgba(229,231,235,0.5)",
  },
  xpTwinLbl: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "rgba(167,139,250,0.6)",
    textAlign: "right",
  },
  xpCapHint: {
    marginTop: 2,
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    color: "#6B7280",
    letterSpacing: 0.2,
  },
  xpCapHintTwin: {
    marginTop: 2,
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    color: "#6B7280",
    letterSpacing: 0.2,
    textAlign: "right",
  },
  xpTrack: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 3,
    position: "relative",
    overflow: "visible",
  },
  xpFillTwin: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(167,139,250,0.65)",
    borderRadius: 3,
  },
  xpFillUser: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(229,231,235,0.4)",
    borderRadius: 3,
    zIndex: 1,
  },
  xpMarker: {
    position: "absolute",
    top: -3,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
    borderColor: "#06070E",
    zIndex: 2,
  },
  xpMarkerUser: { backgroundColor: "rgba(229,231,235,0.65)" },
  xpMarkerTwin: {
    backgroundColor: "rgba(167,139,250,0.9)",
    ...Platform.select({
      ios: {
        shadowColor: "rgba(167,139,250,0.5)",
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
      },
    }),
  },

  confrontation: {
    marginHorizontal: 14,
    marginTop: 10,
    backgroundColor: "rgba(14,12,28,0.85)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.5)",
    borderTopWidth: 2,
    borderTopColor: "rgba(139,92,246,0.6)",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    position: "relative",
    overflow: "hidden",
  },
  confrontationEyebrow: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    color: "rgba(139,92,246,0.55)",
    textTransform: "uppercase",
    marginBottom: 10,
  },
  confrontationText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#E5E7EB",
    lineHeight: 22,
    letterSpacing: -0.1,
  },

  sectionHdr: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.8,
    color: "#6B7280",
    textTransform: "uppercase",
  },
  sectionSubtitle: { fontSize: 9, color: "#374151" },
  legend: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendDotUser: { backgroundColor: "rgba(229,231,235,0.45)" },
  legendDotTwin: { backgroundColor: "rgba(139,92,246,0.7)" },
  legendTxt: { fontSize: 8, color: "#4B5563" },

  heatmapSection: { marginHorizontal: 14, marginTop: 14 },
  heatmapGrid: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  /** No gap + flex:1 — gap caused the 7th column to wrap (Sat looked “missing”). */
  heatmapDay: { flex: 1, minWidth: 0, alignItems: "center", gap: 3 },
  heatmapBarWrap: {
    width: "100%",
    minHeight: 48,
    flexDirection: "column",
    justifyContent: "flex-end",
    gap: 2,
    alignItems: "stretch",
  },
  heatmapBarTwin: {
    width: "100%",
    borderRadius: 3,
    backgroundColor: "rgba(139,92,246,0.65)",
  },
  heatmapBarUser: {
    width: "100%",
    borderRadius: 3,
    backgroundColor: "rgba(229,231,235,0.35)",
  },
  heatmapDayLbl: { fontSize: 8, color: "#374151", textAlign: "center" },
  heatmapDayLblToday: { color: "rgba(167,139,250,0.55)" },

  dnaSection: { marginHorizontal: 14, marginTop: 14, marginBottom: 4 },
  dnaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  dnaPillarLbl: {
    fontSize: 10,
    color: "#4B5563",
    width: 72,
    flexShrink: 0,
  },
  dnaDeltaTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 4,
    overflow: "hidden",
  },
  dnaDeltaFill: {
    height: "100%",
    borderRadius: 4,
  },
  dnaDeltaPill: {
    minWidth: 72,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    paddingHorizontal: 6,
    borderWidth: 1,
  },
  dnaDeltaPillUser: {
    backgroundColor: "rgba(249,115,22,0.1)",
    borderColor: "rgba(249,115,22,0.2)",
  },
  dnaDeltaPillTwin: {
    backgroundColor: "rgba(139,92,246,0.1)",
    borderColor: "rgba(139,92,246,0.2)",
  },
  dnaDeltaPillEven: {
    backgroundColor: "rgba(107,114,128,0.1)",
    borderColor: "rgba(107,114,128,0.15)",
  },
  dnaDeltaPillText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  dnaDeltaPillTextUser: { color: "#FB923C" },
  dnaDeltaPillTextTwin: { color: "#A78BFA" },
  dnaDeltaPillTextEven: { color: "#6B7280" },

  journalPreview: {
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 4,
    backgroundColor: "rgba(14,12,28,0.7)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.4)",
    borderLeftWidth: 2,
    borderLeftColor: "rgba(139,92,246,0.4)",
    borderRadius: 14,
    padding: 14,
  },
  journalPreviewHdr: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  journalPreviewEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  journalPreviewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#8B5CF6",
    opacity: 0.7,
  },
  journalPreviewEyebrow: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    color: "rgba(139,92,246,0.55)",
    textTransform: "uppercase",
  },
  journalPreviewDate: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    color: "#374151",
  },
  journalPreviewText: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(229,231,235,0.65)",
    lineHeight: 20,
    fontStyle: "italic",
  },
  journalReadMore: {
    marginTop: 10,
    alignSelf: "flex-start",
  },
  journalReadMoreText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#8B5CF6",
  },

  journalNotifDot: {
    position: "absolute",
    top: 5,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#8B5CF6",
    ...Platform.select({
      ios: {
        shadowColor: "#8B5CF6",
        shadowOpacity: 0.9,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 3 },
      default: {},
    }),
  },

  journalHdr: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  journalEyebrow: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    color: "#4B5563",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  journalSub: {
    fontSize: 11,
    color: "rgba(167,139,250,0.32)",
    fontStyle: "italic",
  },
  journalEntry: {
    marginHorizontal: 14,
    marginBottom: 9,
    backgroundColor: "rgba(255,255,255,0.018)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.09)",
    borderRadius: 14,
    padding: 14,
    position: "relative",
    overflow: "hidden",
  },
  journalEntryToday: {
    borderColor: "rgba(139,92,246,0.2)",
    backgroundColor: "rgba(139,92,246,0.028)",
  },
  journalAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "rgba(139,92,246,0.4)",
    borderRadius: 2,
  },
  journalDate: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    color: "rgba(139,92,246,0.38)",
    textTransform: "uppercase",
    marginBottom: 7,
  },
  journalText: {
    fontSize: 12.5,
    color: "rgba(229,231,235,0.75)",
    lineHeight: 21,
    fontStyle: "italic",
    fontFamily: "Inter_400Regular",
  },
  journalMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 9,
    flexWrap: "wrap",
  },
  journalTag: {
    fontSize: 9,
    color: "rgba(139,92,246,0.35)",
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  journalEmpty: {
    marginHorizontal: 14,
    marginTop: 20,
    padding: 24,
    backgroundColor: "rgba(255,255,255,0.01)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.15)",
    borderRadius: 14,
    alignItems: "center",
  },
  journalEmptyTxt: {
    fontSize: 12,
    color: "#2D3146",
    lineHeight: 19,
    fontStyle: "italic",
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },

  chatFab: {
    position: "absolute",
    width: CHAT_FAB_SIZE,
    height: CHAT_FAB_SIZE,
    borderRadius: CHAT_FAB_SIZE / 2,
    overflow: "hidden",
    zIndex: 10,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "rgba(139,92,246,0.45)",
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 },
        }
      : { elevation: 10 }),
  },
  chatFabPressed: { transform: [{ scale: 0.93 }] },
  chatFabGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
