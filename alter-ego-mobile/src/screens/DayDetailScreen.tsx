import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import type { MainStackParamList } from "../navigation/types";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import { missionsService, type Mission } from "@/services/missions";
import { reportsService } from "@/services/reports";
import { profileService } from "@/services/profile";
import { getErrorMessage } from "@/services/api";
import { useUserStore } from "@/store/userStore";
import type { UserProfile } from "@/store/userStore";
import {
  formatLocalYmd,
  isCalendarDayTappable,
  registrationFirstLocalCalendarDay,
} from "@/utils/calendarDate";
import {
  CHARACTER_IDENTITY_PAGE_IMAGE,
  getPetImageSource,
} from "@/constants/characterPetAssets";

type DayDetailRouteProp = RouteProp<MainStackParamList, "DayDetail">;

interface DayMission {
  id: string;
  title: string;
  type: "core" | "interest" | "personal" | "resistance";
  difficulty: "easy" | "medium" | "hard";
  xp_value: number;
  pf_value: number;
  completed: boolean;
  interest_name?: string;
  mission_streak?: number;
}

interface DayHistory {
  date: string;
  day_number: number;
  weekday: string;
  is_streak_day: boolean;
  streak_at_day: number;
  streak_broke_here: boolean;
  character_stage: number;
  character_stage_name: string;
  evolved_today: boolean;
  evolved_from: string | null;
  evolved_to: string | null;
  pet_stage: number;
  pet_name: string;
  pet_state: "happy" | "sad";
  xp_earned: number;
  xp_daily_cap: number;
  xp_total_start_of_day: number;
  pf_earned: number;
  pf_daily_cap: number;
  pf_total_start_of_day: number;
  missions_total: number;
  missions_completed: number;
  completion_pct: number;
  missions: DayMission[];
  summary: string | null;
}

function formatFullDate(d: DayHistory): string {
  return `${d.weekday}, ${new Date(d.date + "T12:00:00").toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;
}

const DAILY_XP_CAPS: Record<number, number> = {
  1: 100,
  2: 150,
  3: 200,
  4: 280,
  5: 380,
  6: 500,
};
const DAILY_PF_CAPS: Record<number, number> = {
  1: 160,
  2: 240,
  3: 360,
  4: 480,
  5: 640,
  6: 800,
};

function dayNumberForDate(registrationDate: string | undefined, day: string): number {
  if (!registrationDate) return 1;
  try {
    const regStr = registrationDate.slice(0, 10);
    const reg = new Date(regStr + "T12:00:00");
    const d = new Date(day + "T12:00:00");
    const diff = Math.round((d.getTime() - reg.getTime()) / 86400000);
    return Math.max(1, diff + 1);
  } catch {
    return 1;
  }
}

function mapMissionToDay(m: Mission, section: DayMission["type"]): DayMission {
  const diffRaw = String(m.difficulty ?? "easy").toLowerCase();
  const difficulty: DayMission["difficulty"] =
    diffRaw === "medium" ? "medium" : diffRaw === "hard" ? "hard" : "easy";
  const interestLabel =
    section === "interest"
      ? (m.interest_name ?? "").trim() || undefined
      : section === "resistance"
        ? (m.quit_target_name ?? "").trim() || undefined
        : undefined;
  return {
    id: m.id,
    title: m.title,
    type: section,
    difficulty,
    xp_value: m.xp_value,
    pf_value: m.pf_value ?? 0,
    completed: !!m.completed,
    interest_name: interestLabel,
    mission_streak: 0,
  };
}

function buildHistory(
  date: string,
  profile: UserProfile | null,
  missionsRes: Awaited<ReturnType<typeof missionsService.getMissionsByDate>>,
  summaryText: string | null,
  heatmapRow: {
    maintained: boolean;
    streak_count: number;
    xp_earned: number;
    pf_earned: number;
    missions_done: number;
    missions_total: number;
  } | null,
  evolvedToday: boolean,
  evolvedFrom: string | null,
  evolvedTo: string | null
): DayHistory {
  const weekday = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
  const day_number = dayNumberForDate(profile?.registration_date, date);
  const stage = Math.min(6, Math.max(1, profile?.character_stage ?? 1));
  const xpCap = DAILY_XP_CAPS[stage] ?? 100;
  const pfCap = DAILY_PF_CAPS[stage] ?? 160;

  const core = (missionsRes.missions.core ?? []).map((m) => mapMissionToDay(m, "core"));
  const interest = (missionsRes.missions.interest ?? []).map((m) => mapMissionToDay(m, "interest"));
  const resistance = (missionsRes.missions.resistance ?? []).map((m) => mapMissionToDay(m, "resistance"));
  const personal = (missionsRes.missions.personal ?? []).map((m) => mapMissionToDay(m, "personal"));
  const missions = [...core, ...interest, ...resistance, ...personal];

  const total = missions.length;
  const completed = missions.filter((m) => m.completed).length;
  const completion_pct = total > 0 ? Math.round((100 * completed) / total) : 0;

  // Authoritative: sum rewards from missions completed that day (streak_log denormalized fields can be stale or missing).
  const xp_from_missions = missions
    .filter((m) => m.completed)
    .reduce((s, m) => s + (Number(m.xp_value) || 0), 0);
  const pf_from_missions = missions
    .filter((m) => m.completed)
    .reduce((s, m) => s + (Number(m.pf_value) || 0), 0);
  const xp_earned =
    xp_from_missions > 0 || pf_from_missions > 0 || !heatmapRow
      ? xp_from_missions
      : Number(heatmapRow.xp_earned ?? 0);
  const pf_earned =
    xp_from_missions > 0 || pf_from_missions > 0 || !heatmapRow
      ? pf_from_missions
      : Number(heatmapRow.pf_earned ?? 0);

  const is_streak_day = heatmapRow ? !!heatmapRow.maintained : false;
  const streak_at_day = heatmapRow?.streak_count ?? 0;
  const streak_broke_here = heatmapRow ? !heatmapRow.maintained && streak_at_day === 0 : false;

  const pet_stage = profile?.pet_stage ?? 0;
  const pet_name = profile?.pet_name ?? (pet_stage > 0 ? "Pet" : "—");
  const pet_state: "happy" | "sad" =
    pet_stage > 0 && heatmapRow && !heatmapRow.maintained ? "sad" : "happy";

  return {
    date,
    day_number,
    weekday,
    is_streak_day,
    streak_at_day,
    streak_broke_here,
    character_stage: profile?.character_stage ?? 1,
    character_stage_name: profile?.character_stage_name ?? "—",
    evolved_today: evolvedToday,
    evolved_from: evolvedFrom,
    evolved_to: evolvedTo,
    pet_stage,
    pet_name,
    pet_state,
    xp_earned,
    xp_daily_cap: xpCap,
    xp_total_start_of_day: profile?.total_xp ?? 0,
    pf_earned,
    pf_daily_cap: pfCap,
    pf_total_start_of_day: profile?.total_pf ?? 0,
    missions_total: total,
    missions_completed: completed,
    completion_pct,
    missions,
    summary: summaryText,
  };
}

export function DayDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<DayDetailRouteProp>();
  const { date } = route.params;
  const fetchProfile = useUserStore((s) => s.fetchProfile);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DayHistory | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!useUserStore.getState().profile) {
        await fetchProfile();
      }
      const p = useUserStore.getState().profile;

      const [missionsRes, daySummary, streakRes, identityRes] = await Promise.all([
        missionsService.getMissionsByDate(date),
        reportsService.getDaySummary(date).catch(() => ({ date, summary: "" })),
        profileService.getStreak(),
        profileService.getIdentity().catch(() => null),
      ]);

      const eligible =
        (streakRes as { heatmap_eligible_since?: string | null })?.heatmap_eligible_since ??
        registrationFirstLocalCalendarDay(p?.registration_date);
      const todayYmd = formatLocalYmd(new Date());
      const dateKey = String(date).slice(0, 10);
      if (!eligible || !isCalendarDayTappable(dateKey, eligible, todayYmd)) {
        setHistory(null);
        setError(
          !eligible
            ? "Could not verify your start date. Pull to refresh or try again."
            : dateKey > todayYmd
              ? "That day hasn’t happened yet."
              : "You weren’t on ALTER EGO yet this day."
        );
        setLoading(false);
        return;
      }

      const heatmap = (streakRes as { heatmap?: Array<Record<string, unknown>> })?.heatmap ?? [];
      const row = heatmap.find((h) => String(h.date).slice(0, 10) === dateKey);
      const heatmapRow = row
        ? {
            maintained: !!row.maintained,
            streak_count: Number(row.streak_count ?? 0),
            xp_earned: Number(row.xp_earned ?? 0),
            pf_earned: Number(row.pf_earned ?? 0),
            missions_done: Number(row.missions_done ?? 0),
            missions_total: Number(row.missions_total ?? 0),
          }
        : null;

      let evolvedToday = false;
      let evolvedFrom: string | null = null;
      let evolvedTo: string | null = null;
      if (identityRes && typeof identityRes === "object" && "stages" in identityRes) {
        const stages = (identityRes as { stages: Array<{ name: string; earned_at?: string | null }> }).stages;
        for (let i = 0; i < stages.length; i++) {
          const ea = stages[i]?.earned_at;
          if (ea && String(ea).slice(0, 10) === date) {
            evolvedToday = true;
            evolvedTo = stages[i].name;
            evolvedFrom = i > 0 ? stages[i - 1]?.name ?? null : null;
            break;
          }
        }
      }

      const summaryText =
        typeof daySummary?.summary === "string" && daySummary.summary.trim()
          ? daySummary.summary.trim()
          : null;

      const built = buildHistory(date, p, missionsRes, summaryText, heatmapRow, evolvedToday, evolvedFrom, evolvedTo);
      setHistory(built);
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e));
      setHistory(null);
    } finally {
      setLoading(false);
    }
  }, [date, fetchProfile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const formattedDate = useMemo(
    () => (history ? formatFullDate(history) : date),
    [history, date]
  );
  const dayNumber = history?.day_number ?? 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#07080F" }}>
      <LinearGradient
        colors={["#07080F", "#09091A", "#07080F"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#6B7280" />
        </Pressable>
        <Text style={styles.headerDate}>{formattedDate}</Text>
        <Text style={styles.headerDay}>Day {dayNumber}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading day history…</Text>
        </View>
      ) : error ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !history ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.errorText}>No data for this day.</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Date + Day number row */}
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dateTitle}>{formattedDate}</Text>
              <Text style={styles.dateSub}>
                {history.day_number} days into your journey
              </Text>
            </View>
            <View style={styles.dayNumberWrap}>
              <Text style={styles.dayNumberLabel}>DAY</Text>
              <Text style={styles.dayNumberValue}>{history.day_number}</Text>
            </View>
          </View>

          {/* Streak strip */}
          <View
            style={[
              styles.streakStrip,
              history.is_streak_day && !history.streak_broke_here
                ? styles.streakStripOn
                : styles.streakStripOff,
            ]}
          >
            <View style={styles.streakStripLeftIcon}>
              <Text style={{ fontSize: 14 }}>
                {history.is_streak_day && !history.streak_broke_here ? "🔥" : "⛓️"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={
                  history.is_streak_day && !history.streak_broke_here
                    ? styles.streakStripTitleOn
                    : styles.streakStripTitleOff
                }
              >
                {history.is_streak_day && !history.streak_broke_here
                  ? "Streak day"
                  : "Streak broke here"}
              </Text>
              <Text
                style={
                  history.is_streak_day && !history.streak_broke_here
                    ? styles.streakStripSubOn
                    : styles.streakStripSubOff
                }
              >
                {history.is_streak_day && !history.streak_broke_here
                  ? `${history.streak_at_day}-day streak at this point`
                  : `Was on a ${history.streak_at_day}-day streak`}
              </Text>
            </View>
          </View>

          {/* Evolution banner */}
          {history.evolved_today && (
            <View style={styles.evolutionBanner}>
              <LinearGradient
                colors={["rgba(109,40,217,0.15)", "rgba(88,28,135,0.10)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.evolutionTopAccent} />
              <View style={styles.evolutionContent}>
                <View style={styles.evolutionIconBox}>
                  <Text style={{ color: "#C084FC", fontSize: 16 }}>✦</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.evolutionTitle}>Character evolved on this day</Text>
                  <Text style={styles.evolutionSub}>
                    {history.evolved_from ?? history.character_stage_name}{" "}
                    <Text style={styles.evolutionStageArrow}>→</Text>{" "}
                    <Text style={styles.evolutionStageNew}>
                      {history.evolved_to ?? history.character_stage_name}
                    </Text>
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Snapshot card */}
            <View style={styles.snapshotCard}>
            <LinearGradient
              colors={["transparent", "rgba(139,92,246,0.25)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.snapshotAccent}
            />
            <Text style={styles.snapshotLabel}>YOUR SNAPSHOT ON THIS DAY</Text>
            <View style={styles.snapshotRow}>
              <View style={styles.snapshotFigures}>
                <View style={styles.snapshotCharWrap}>
                  <Image
                    source={CHARACTER_IDENTITY_PAGE_IMAGE}
                    style={styles.snapshotCharImage}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                  <View style={styles.snapshotCharStageBadge} pointerEvents="none">
                    <Text style={styles.snapshotCharStageText}>
                      STAGE {history.character_stage}
                    </Text>
                  </View>
                </View>
                <View style={styles.snapshotPetWrap}>
                  {history.pet_stage >= 1 ? (
                    <Image
                      source={getPetImageSource(history.pet_stage)}
                      style={[
                        styles.snapshotPetImage,
                        history.pet_state === "sad" && styles.snapshotPetImageSad,
                      ]}
                      resizeMode="contain"
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <View style={styles.snapshotPetPlaceholder} />
                  )}
                </View>
              </View>
              <View style={styles.snapshotMetaColumn}>
                <View style={styles.snapshotMetaItem}>
                  <Text style={styles.snapshotMetaValue}>
                    {history.character_stage_name}
                  </Text>
                  <Text style={styles.snapshotMetaLabel}>CHARACTER STAGE</Text>
                </View>
                <View style={styles.snapshotMetaItem}>
                  <Text style={[styles.snapshotMetaValue, { color: "#A78BFA" }]}>
                    {history.xp_earned}
                  </Text>
                  <Text style={styles.snapshotMetaLabel}>XP EARNED THIS DAY</Text>
                </View>
                <View style={styles.snapshotMetaItem}>
                  <Text style={[styles.snapshotMetaValue, { color: "#A78BFA" }]}>
                    {history.pf_earned}
                  </Text>
                  <Text style={styles.snapshotMetaLabel}>PET FOOD EARNED</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Reward cards */}
          <View style={styles.rewardRow}>
            <View
              style={[
                styles.rewardCard,
                history.xp_earned > 0 ? styles.rewardCardXp : styles.rewardCardMissed,
              ]}
            >
              <LinearGradient
                colors={["transparent", "rgba(139,92,246,0.40)", "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.rewardAccent}
              />
              <Text style={styles.rewardIcon}>★</Text>
              <Text
                style={[
                  styles.rewardValue,
                  history.xp_earned > 0 ? styles.rewardValueXp : styles.rewardValueMissed,
                ]}
              >
                {history.xp_earned}
              </Text>
              <Text style={styles.rewardLabel}>XP EARNED</Text>
              <Text style={styles.rewardCap}>
                {history.xp_earned > 0
                  ? `Cap: ${history.xp_daily_cap} XP`
                  : "Nothing earned"}
              </Text>
            </View>
            <View
              style={[
                styles.rewardCard,
                history.pf_earned > 0 ? styles.rewardCardPf : styles.rewardCardMissed,
              ]}
            >
              <LinearGradient
                colors={["transparent", "rgba(139,92,246,0.35)", "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.rewardAccent}
              />
              <Text style={styles.rewardIcon}>✦</Text>
              <Text
                style={[
                  styles.rewardValue,
                  history.pf_earned > 0 ? styles.rewardValuePf : styles.rewardValueMissed,
                ]}
              >
                {history.pf_earned}
              </Text>
              <Text style={styles.rewardLabel}>PET FOOD</Text>
              <Text style={styles.rewardCap}>
                {history.pf_earned > 0 ? `Cap: ${history.pf_daily_cap} PF` : "Pet was sad"}
              </Text>
            </View>
          </View>

          {/* Completion ring + summary */}
          <View style={styles.completionRow}>
            <View style={styles.completionRing}>
              <Svg width={56} height={56}>
                <Defs>
                  <SvgLinearGradient id="completionGrad" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#5B21B6" />
                    <Stop offset="1" stopColor="#A78BFA" />
                  </SvgLinearGradient>
                </Defs>
                {/* Track */}
                <Circle
                  cx={28}
                  cy={28}
                  r={22}
                  stroke="rgba(42,48,80,0.50)"
                  strokeWidth={5}
                  fill="none"
                />
                {/* Fill arc */}
                {history.completion_pct > 0 && (
                  <Circle
                    cx={28}
                    cy={28}
                    r={22}
                    stroke="url(#completionGrad)"
                    strokeWidth={5}
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 22}`}
                    strokeDashoffset={`${2 * Math.PI * 22 * (1 - history.completion_pct / 100)}`}
                    strokeLinecap="round"
                    transform="rotate(-90 28 28)"
                  />
                )}
              </Svg>
              <View style={styles.completionPctCenter}>
                <Text
                  style={[
                    styles.completionPctText,
                    history.completion_pct === 0 && styles.completionPctZero,
                    history.completion_pct === 100 && styles.completionPctFull,
                  ]}
                >
                  {history.completion_pct}%
                </Text>
              </View>
            </View>
            <View style={styles.completionTextCol}>
              <Text style={styles.completionTitle}>
                {history.missions_completed} of {history.missions_total} missions complete
              </Text>
              <Text style={styles.completionSub}>
                Core, Focus, Personal, and Resistance missions from this day.
              </Text>
            </View>
          </View>

          {/* Mission sections — read-only rows: done ✓, missed strikethrough + ✕ */}
          {["core", "interest", "personal", "resistance"].map((section) => {
            const missions = history.missions.filter((m) => m.type === section);
            if (!missions.length) return null;
            const done = missions.filter((m) => m.completed).length;
            const total = missions.length;

            const label =
              section === "core"
                ? "CORE"
                : section === "interest"
                  ? "FOCUS"
                  : section === "personal"
                    ? "PERSONAL"
                    : "RESISTANCE";

            const barStyle =
              section === "core"
                ? styles.sectionBarCore
                : section === "interest"
                  ? styles.sectionBarFocus
                  : section === "personal"
                    ? styles.sectionBarPersonal
                    : styles.sectionBarResistance;

            const labelStyle =
              section === "core"
                ? styles.sectionLabelCore
                : section === "interest"
                  ? styles.sectionLabelFocus
                  : section === "personal"
                    ? styles.sectionLabelPersonal
                    : styles.sectionLabelResistance;

            const doneColorStyle =
              section === "core"
                ? styles.sectionCountDoneCore
                : section === "interest"
                  ? styles.sectionCountDoneFocus
                  : section === "personal"
                    ? styles.sectionCountDonePersonal
                    : styles.sectionCountDoneResistance;

            return (
              <View key={section} style={styles.missionSection}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderLeft}>
                    <View style={[styles.sectionBar, barStyle]} />
                    <Text style={[styles.sectionLabel, labelStyle]}>{label}</Text>
                  </View>
                  <Text style={styles.sectionCount}>
                    <Text style={[styles.sectionCountDone, doneColorStyle]}>{done}</Text>
                    /{total}
                  </Text>
                </View>
                {missions.map((m) => {
                  const sub =
                    section === "interest" || section === "resistance"
                      ? m.interest_name
                      : undefined;
                  const diffLabel =
                    m.difficulty === "easy"
                      ? "Easy"
                      : m.difficulty === "medium"
                        ? "Medium"
                        : "Hard";
                  return (
                    <View key={m.id} style={styles.dayMissionRow}>
                      <Ionicons
                        name={m.completed ? "checkmark-circle" : "close-circle"}
                        size={22}
                        color={m.completed ? "#A78BFA" : "#6B7280"}
                        style={styles.dayMissionIcon}
                      />
                      <View style={styles.dayMissionMain}>
                        <Text
                          style={[
                            styles.dayMissionTitle,
                            !m.completed && styles.dayMissionTitleMissed,
                          ]}
                          numberOfLines={3}
                        >
                          {m.title}
                        </Text>
                        {!!sub && (
                          <Text style={styles.dayMissionSub} numberOfLines={1}>
                            {sub}
                          </Text>
                        )}
                        <Text style={styles.dayMissionTier}>{diffLabel}</Text>
                      </View>
                      <View style={styles.dayMissionRewards}>
                        <Text
                          style={[
                            styles.dayMissionXp,
                            !m.completed && styles.dayMissionRewardMuted,
                          ]}
                        >
                          +{m.xp_value} XP
                        </Text>
                        <Text
                          style={[
                            styles.dayMissionPf,
                            !m.completed && styles.dayMissionRewardMuted,
                          ]}
                        >
                          +{m.pf_value} PF
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
          <View
            style={[
              styles.summaryCard,
              !history.is_streak_day && styles.summaryCardMissed,
              history.evolved_today && styles.summaryCardEvolution,
            ]}
          >
            <Text style={styles.summaryLabel}>DAY SUMMARY</Text>
            <Text
              style={[
                styles.summaryText,
                history.evolved_today && styles.summaryTextEvolution,
                !history.is_streak_day && styles.summaryTextMissed,
              ]}
            >
              {history.summary ??
                `${history.missions_completed} missions completed. Streak at ${history.streak_at_day} days.`}
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.30)",
    backgroundColor: "rgba(8,9,26,0.85)",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.40)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  headerDate: { fontSize: 15, fontWeight: "700", color: "#E5E7EB", flex: 1 },
  headerDay: { fontSize: 11, color: "#374151" },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { fontSize: 12, color: "#9CA3AF", marginTop: 8 },
  errorText: { fontSize: 12, color: "#FCA5A5" },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 14,
  },
  dateTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#E5E7EB",
    letterSpacing: -0.4,
  },
  dateSub: {
    fontSize: 12,
    color: "#4B5563",
    marginTop: 2,
  },
  dayNumberWrap: {
    alignItems: "flex-end",
  },
  dayNumberLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#374151",
  },
  dayNumberValue: {
    fontSize: 28,
    fontWeight: "900",
    color: "#A78BFA",
    letterSpacing: -1,
  },

  streakStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
  },
  streakStripOn: {
    backgroundColor: "rgba(249,115,22,0.08)",
    borderColor: "rgba(249,115,22,0.20)",
  },
  streakStripOff: {
    backgroundColor: "rgba(42,48,80,0.20)",
    borderColor: "rgba(42,48,80,0.35)",
  },
  streakStripLeftIcon: {
    width: 24,
    alignItems: "center",
  },
  streakStripTitleOn: { fontSize: 12, fontWeight: "600", color: "#FB923C" },
  streakStripSubOn: { fontSize: 11, color: "#F97316" },
  streakStripTitleOff: { fontSize: 12, fontWeight: "600", color: "#374151" },
  streakStripSubOff: { fontSize: 11, color: "#2D3146" },

  evolutionBanner: {
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.30)",
    overflow: "hidden",
    position: "relative",
  },
  evolutionTopAccent: {
    position: "absolute",
    top: 0,
    left: "15%",
    right: "15%",
    height: 1,
    backgroundColor: "rgba(192,132,252,0.50)",
  },
  evolutionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  evolutionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(139,92,246,0.20)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  evolutionTitle: { fontSize: 12, fontWeight: "700", color: "#C4B5FD" },
  evolutionSub: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  evolutionStageArrow: { color: "#6B7280" },
  evolutionStageNew: { color: "#A78BFA", fontWeight: "600" },

  snapshotCard: {
    backgroundColor: "rgba(14,13,28,0.90)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.50)",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    overflow: "hidden",
  },
  snapshotAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  snapshotLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#2D3146",
    marginBottom: 12,
  },
  snapshotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  /** Character + companion bottom-aligned (same baseline as Identity / Companion heroes). */
  snapshotFigures: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  snapshotCharWrap: {
    width: 96,
    height: 128,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  snapshotCharImage: {
    width: "100%",
    height: "100%",
  },
  snapshotCharStageBadge: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: "rgba(7,8,15,0.72)",
  },
  snapshotCharStageText: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "rgba(167,139,250,0.85)",
    textAlign: "center",
  },
  snapshotPetWrap: {
    width: 72,
    height: 72,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  snapshotPetImage: {
    width: "100%",
    height: "100%",
  },
  snapshotPetImageSad: {
    opacity: 0.42,
  },
  snapshotPetPlaceholder: {
    width: "100%",
    height: "100%",
  },
  snapshotMetaColumn: {
    flex: 1,
    gap: 6,
  },
  snapshotMetaItem: {},
  snapshotMetaValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#E5E7EB",
  },
  snapshotMetaLabel: {
    fontSize: 9,
    color: "#374151",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  rewardRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  rewardCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    position: "relative",
    overflow: "hidden",
  },
  rewardCardXp: {
    backgroundColor: "rgba(109,40,217,0.10)",
    borderColor: "rgba(139,92,246,0.22)",
  },
  rewardCardPf: {
    backgroundColor: "rgba(109,40,217,0.10)",
    borderColor: "rgba(139,92,246,0.22)",
  },
  rewardCardMissed: {
    backgroundColor: "rgba(42,48,80,0.10)",
    borderColor: "rgba(42,48,80,0.25)",
  },
  rewardAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  rewardIcon: { fontSize: 16, marginBottom: 4 },
  rewardValue: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  rewardValueXp: { color: "#A78BFA" },
  rewardValuePf: { color: "#A78BFA" },
  rewardValueMissed: { color: "#374151" },
  rewardLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#374151",
    marginTop: 2,
  },
  rewardCap: { fontSize: 9, color: "#2D3146", marginTop: 2 },

  completionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    backgroundColor: "rgba(14,13,28,0.90)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.50)",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  completionRing: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  completionPctCenter: {
    position: "absolute",
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  completionPctText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#E5E7EB",
  },
  completionPctZero: { color: "#374151" },
  completionPctFull: { color: "#A78BFA" },
  completionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#E5E7EB",
  },
  completionSub: {
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 18,
    marginTop: 2,
  },
  completionTextCol: {
    flex: 1,
    minWidth: 0,
    alignSelf: "stretch",
    paddingTop: 2,
  },

  summaryCard: {
    backgroundColor: "rgba(10,8,22,0.70)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.30)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: "rgba(139,92,246,0.40)",
  },
  summaryCardMissed: {
    borderLeftColor: "rgba(42,48,80,0.50)",
  },
  summaryCardEvolution: {
    borderLeftColor: "rgba(192,132,252,0.55)",
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#374151",
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 12,
    fontStyle: "italic",
    color: "#6B7280",
    lineHeight: 20,
    flexShrink: 1,
    width: "100%",
  },
  summaryTextMissed: { color: "#374151" },
  summaryTextEvolution: { color: "#9CA3AF" },

  missionSection: {
    marginTop: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionBar: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  sectionBarCore: { backgroundColor: "#7F1D1D" },
  sectionBarFocus: { backgroundColor: "#6D28D9" },
  sectionBarPersonal: { backgroundColor: "rgba(107,114,128,0.4)" },
  sectionBarResistance: { backgroundColor: "#6B7280" },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  sectionLabelCore: { color: "#7F1D1D" },
  sectionLabelFocus: { color: "#8B5CF6" },
  sectionLabelPersonal: { color: "#6B7280" },
  sectionLabelResistance: { color: "#9CA3AF" },
  sectionCount: {
    marginLeft: "auto",
    fontSize: 10,
    color: "#374151",
  },
  sectionCountDone: {
    fontWeight: "700",
  },
  sectionCountDoneCore: { color: "#7F1D1D" },
  sectionCountDoneFocus: { color: "#8B5CF6" },
  sectionCountDonePersonal: { color: "#6B7280" },
  sectionCountDoneResistance: { color: "#9CA3AF" },
  missionRow: {
    backgroundColor: "#141824",
    borderWidth: 1,
    borderColor: "#1E2333",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
    position: "relative",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
  },
  missionRowCore: {},
  missionRowFocus: {},
  missionRowPersonal: {},
  missionRowResistance: {},
  missionMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  missionTextWrap: {
    flex: 1,
  },
  missionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E5E7EB",
  },
  missionTitleMissed: {
    color: "#4B5563",
    textDecorationLine: "line-through",
  },
  missionSub: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  missionRight: {
    alignItems: "flex-end",
  },
  missionDifficulty: {
    fontSize: 11,
    fontWeight: "600",
  },
  missionXp: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  missionCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  missionCheckDone: {
    backgroundColor: "rgba(139,92,246,0.15)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.35)",
  },
  missionCheckMissed: {
    backgroundColor: "rgba(42,48,80,0.20)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.35)",
  },
  missionCheckTextDone: {
    fontSize: 11,
    color: "#8B5CF6",
  },
  missionCheckTextMissed: {
    fontSize: 11,
    color: "#374151",
  },

  dayMissionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141824",
    borderWidth: 1,
    borderColor: "#1E2333",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  dayMissionIcon: {
    marginRight: 10,
  },
  dayMissionMain: {
    flex: 1,
    minWidth: 0,
  },
  dayMissionTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#E5E7EB",
  },
  dayMissionTitleMissed: {
    color: "#6B7280",
    textDecorationLine: "line-through",
  },
  dayMissionSub: {
    fontSize: 11,
    color: "#A78BFA",
    marginTop: 2,
  },
  dayMissionTier: {
    fontSize: 10,
    color: "#4B5563",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dayMissionRewards: {
    alignItems: "flex-end",
    marginLeft: 8,
  },
  dayMissionXp: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#A78BFA",
  },
  dayMissionPf: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 2,
  },
  dayMissionRewardMuted: {
    color: "#4B5563",
  },
});

