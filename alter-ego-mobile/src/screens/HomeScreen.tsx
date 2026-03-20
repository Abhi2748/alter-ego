/**
 * Home Screen — Premium dark cinematic layout.
 * Wired to backend: useTodayMissions, useUserStore, useTwinStrip, useCompleteMission.
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RouteProp } from "@react-navigation/native";
import type { MainStackParamList, MainTabParamList } from "../navigation/types";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { XPProgressBar, XPProgressBarRef } from "../components/XPProgressBar";
import { PetRoaming } from "../components/PetRoaming";
import { HomeMissionCard } from "../components/HomeMissionCard";
import type { MissionType, MissionStatus } from "../components/MissionCard";
import { AddMissionModal } from "../components/AddMissionModal";
import { CharacterEvolutionOverlay } from "../components/CharacterEvolutionOverlay";
import { MilestoneAchievementCard } from "../components/MilestoneAchievementCard";
import { SkeletonCard } from "@/components/SkeletonCard";
import { useUserStore } from "@/store/userStore";
import { useTodayMissions, useCompleteMission, useDeletePersonalMission } from "@/hooks/useMissions";
import { DeleteMissionSheet } from "@/components/DeleteMissionSheet";
import { MissionRemovedToast } from "@/components/MissionRemovedToast";
import { StreakAchievementOverlay } from "@/components/StreakAchievementOverlay";
import { useTwinStrip } from "@/hooks/useTwinStrip";
import type { Mission } from "@/services/missions";
import { missionsService } from "@/services/missions";
import { getErrorMessage } from "@/services/api";
import { useProfileStreak } from "@/hooks/useProfile";


// Design tokens (spec Section 1)
const BG_GRADIENT = ["#09091A", "#07080F"] as const;
const SURFACE_CARD = "#111623";
const SURFACE_BORDER = "#1A1F30";
const VIOLET = "#8B5CF6";
const VIOLET_DEEP = "#5B21B6";
const VIOLET_GLOW = "#A78BFA";
const VIOLET_LINE = "#C084FC";
const RED_CORE = "#EF4444";
const RED_DARK = "#991B1B";
const RED_LABEL = "#F87171";
const EMBER = "#F97316";
const TEXT_PRIMARY = "#E5E7EB";
const TEXT_MUTED = "#6B7280";
const TEXT_DIM = "#4B5563";
const PERSONAL_GREY = "#4B5563";
const PERSONAL_GREY_DARK = "#1F2937";

const CHARACTER_WIDTH = 118;
const CHARACTER_HEIGHT = 178;
const PET_SIZE = 72;
const PET_OFFSET = 10;
const ROAMING_PET_SIZE = 80;
const TOP_BAR_HEIGHT = 56;
const TAB_BAR_HEIGHT = 56;
const CONTENT_PADDING_BOTTOM = 96;
const JOURNAL_FAB_BOTTOM_GAP = 8;
const SCROLL_PADDING_H = 16;

type PlaceholderMission = {
  id: string;
  title: string;
  category: string;
  difficulty: "Easy" | "Medium" | "Hard";
  xpValue: number;
  petFoodValue: number;
  status: MissionStatus;
  missionType: MissionType;
  interestName?: string;
  missionStreak?: number;
  quitTargetName?: string;
  dayCounter?: number;
};

function missionApiToCard(
  m: Mission,
  category: "Core" | "Interest" | "Resistance" | "Personal"
): PlaceholderMission {
  const diff = String(m.difficulty ?? "").toLowerCase();
  const difficulty = diff === "easy" ? "Easy" : diff === "medium" ? "Medium" : diff === "hard" ? "Hard" : "Medium";
  return {
    id: m.id,
    title: m.title,
    category,
    difficulty,
    xpValue: m.xp_value ?? 0,
    petFoodValue: m.pf_value ?? 0,
    status: m.completed ? ("complete" as const) : ("pending" as const),
    missionType: (category === "Core"
      ? "core"
      : category === "Interest"
        ? "interest"
        : category === "Resistance"
          ? "resistance"
          : "personal") as MissionType,
    missionStreak: 0,
  };
}

function missionApiToDetailParam(
  m: Mission,
  type: "core" | "interest" | "resistance" | "personal",
  date: string
): MainStackParamList["MissionDetail"]["mission"] {
  const diff = String(m.difficulty ?? "").toLowerCase();
  const difficulty =
    diff === "easy" ? ("easy" as const) : diff === "medium" ? ("medium" as const) : diff === "hard" ? ("hard" as const) : ("medium" as const);

  return {
    id: m.id,
    type,
    title: m.title,
    difficulty,
    xp_value: m.xp_value ?? 0,
    pf_value: m.pf_value ?? 0,
    completed: !!m.completed,
    completed_at: m.completed_at ?? null,
    is_journal_mission: !!m.is_journal_mission,
    core_pillar: m.core_pillar ?? null,
    interest_id: m.interest_id ?? null,
    rationale: m.rationale ?? null,
    domain_knowledge: m.domain_knowledge ?? null,
    estimated_minutes: m.estimated_minutes ?? null,
    mission_date: m.mission_date ?? date,
  };
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning 👋";
  if (h >= 12 && h < 17) return "Good afternoon 👋";
  if (h >= 17 && h < 21) return "Good evening 👋";
  return "Good night 🌙";
}

const PET_NAMES = ["Cub", "Cat", "Fox", "Wolf", "Snow Leopard", "Panther", "Griffin", "Dragon"] as const;

export function HomeScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<MainTabParamList, "Home">>();
  const insets = useSafeAreaInsets();
  const xpBarRef = useRef<XPProgressBarRef>(null);
  const windowWidth = Dimensions.get("window").width;
  const windowHeight = Dimensions.get("window").height;
  const viewportHeight = Math.max(0, windowHeight - insets.top - TOP_BAR_HEIGHT - TAB_BAR_HEIGHT);
  const heroX = (windowWidth - (CHARACTER_WIDTH + PET_OFFSET + ROAMING_PET_SIZE)) / 2 + CHARACTER_WIDTH + PET_OFFSET;
  const heroY = 20 + 4 + CHARACTER_HEIGHT / 2 - ROAMING_PET_SIZE / 2;

  const profile = useUserStore((state) => state.profile);
  const { data: todayData, isLoading, error, refetch } = useTodayMissions();
  const { mutate: completeMission, isPending: isCompleting } = useCompleteMission();
  const { mutate: deletePersonalMission } = useDeletePersonalMission();
  const { data: twinStrip } = useTwinStrip();
  const { data: streakProfile } = useProfileStreak();

  const [streakAnimationData, setStreakAnimationData] = useState<{
    show: boolean;
    count: number;
    tier: string;
  } | null>(null);
  const [evolutionData, setEvolutionData] = useState<{
    new_stage: number;
    new_stage_name: string;
  } | null>(null);
  const [petEvolutionData, setPetEvolutionData] = useState<{
    new_stage: number;
    new_pet_name: string;
  } | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [milestoneCard, setMilestoneCard] = useState<{
    interestName: string;
    milestoneNumber: number;
    milestoneName: string;
    twinCongratulation: string;
  } | null>(null);
  const [evolutionOverlayVisible, setEvolutionOverlayVisible] = useState(false);
  const [evolutionStageName, setEvolutionStageName] = useState("The Focused");
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [deleteSheetVisible, setDeleteSheetVisible] = useState(false);
  const [missionToDelete, setMissionToDelete] = useState<Mission | null>(null);
  const [removeSuccessToast, setRemoveSuccessToast] = useState(false);
  const [removeErrorToast, setRemoveErrorToast] = useState(false);

  const coreMissions = (todayData?.missions?.core ?? []).map((m) => missionApiToCard(m, "Core"));
  const interestMissions = (todayData?.missions?.interest ?? []).map((m) => missionApiToCard(m, "Interest"));
  const resistanceMissions = (todayData?.missions?.resistance ?? []).map((m) => missionApiToCard(m, "Resistance"));
  const personalMissions = (todayData?.missions?.personal ?? []).map((m) => missionApiToCard(m, "Personal"));

  const dayNumber = todayData?.day_number ?? 1;
  const isDay1To14 = dayNumber >= 1 && dayNumber <= 14;
  const completedToday = todayData?.summary?.completed ?? 0;
  const showStartAnywhereHelper = completedToday === 0 && isDay1To14;

  const username = profile?.username ?? "";
  const characterStage = profile?.character_stage ?? 1;
  const stageTitle = profile?.character_stage_name ?? "The Awakened";
  const displayXP = profile?.total_xp ?? 0;
  const nextStageXP = profile?.xp_to_next_stage ?? 800;
  const nextStageName = profile?.character_stage_name ?? "The Focused";
  const petStage = profile?.pet_stage ?? 0;
  const totalPetFood = profile?.total_pf ?? 0;
  const streak = profile?.current_streak ?? 0;
  const petHealthState = "idle";

  const streakHeatmap = streakProfile?.heatmap ?? [];
  const heatmapByDate = useMemo(() => new Map(streakHeatmap.map((r) => [r.date, r])), [streakHeatmap]);
  // Treat the most recent heatmap date as "today" (backend anchors to the user's local calendar).
  const anchorDateStr = streakHeatmap.length
    ? streakHeatmap[streakHeatmap.length - 1].date
    : new Date().toISOString().slice(0, 10);
  const [ay, am, ad] = anchorDateStr.split("-").map((x) => Number(x));
  const anchorUTCDate = new Date(Date.UTC(ay, am - 1, ad));
  // Mon–Sun indices: Mon=0 ... Sun=6
  const anchorMonBased = (anchorUTCDate.getUTCDay() + 6) % 7;
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(anchorUTCDate);
      d.setUTCDate(d.getUTCDate() - anchorMonBased + i);
      return d.toISOString().slice(0, 10);
    });
  }, [anchorUTCDate, anchorMonBased]);
  const weekDotType = weekDates.map((dateStr) => {
    const row = heatmapByDate.get(dateStr);
    if (row?.maintained) return "done" as const;
    if (dateStr === anchorDateStr) return "today" as const;
    return "pending" as const;
  });

  const nextPetName = petStage >= 1 && petStage < 8 ? PET_NAMES[petStage - 1] : null;
  const pfProgress = profile?.pf_progress_pct ?? 0;
  const petLevelPct = pfProgress / 100;

  const triggerXpBarAnimation = useCallback(() => {
    setTimeout(() => xpBarRef.current?.animateXpGain(), 0);
  }, []);

  const handleComplete = useCallback(
    (missionId: string) => {
      triggerXpBarAnimation();
      completeMission(missionId, {
        onSuccess: (result) => {
          if (result.streak_animation?.show) {
            setStreakAnimationData({
              show: true,
              count: result.streak_animation.streak_count,
              tier: result.streak_animation.animation_tier,
            });
          }
          if (result.stage_evolved) {
            setEvolutionStageName(result.stage_evolved.new_stage_name);
            setEvolutionData(result.stage_evolved);
            setEvolutionOverlayVisible(true);
          }
          if (result.pet_evolved) {
            setPetEvolutionData(result.pet_evolved);
          }
          if (result.milestone_reached != null) {
            setMilestoneCard({
              interestName: "",
              milestoneNumber: result.milestone_reached,
              milestoneName: `Streak milestone: ${result.milestone_reached} days`,
              twinCongratulation: "Your Twin noticed.",
            });
          }
        },
      });
    },
    [completeMission, triggerXpBarAnimation]
  );

  const showTwinStrip = twinStrip?.has_twin && twinStrip?.strip_message;
  const twinStripMessage = twinStrip?.strip_message ?? null;

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  useEffect(() => {
    if (
      todayData &&
      todayData.summary.total === 0 &&
      coreMissions.length === 0 &&
      interestMissions.length === 0
    ) {
      const t = setTimeout(() => refetch(), 3000);
      return () => clearTimeout(t);
    }
  }, [todayData?.summary?.total, coreMissions.length, interestMissions.length, refetch]);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.journalJustCompleted) {
        navigation.setParams({ journalJustCompleted: undefined });
        refetch();
      }
    }, [route.params?.journalJustCompleted, refetch, navigation])
  );

  const handleAddMission = useCallback(
    async (title: string, difficulty: "Easy" | "Medium" | "Hard") => {
      const today = new Date().toISOString().slice(0, 10);
      const estimate = await missionsService.estimatePersonalMission(title);
      const tier = (estimate?.tier ?? "medium") as "easy" | "medium" | "hard" | "multiday";
      const xp = estimate?.xp ?? 15;
      const pf = estimate?.pf ?? 11;
      const estimated_minutes = estimate?.estimated_minutes ?? 15;
      await missionsService.createPersonalMission({
        mission_text: title,
        tier,
        xp,
        pf,
        estimated_minutes,
        date: today,
      });
      refetch();
    },
    [refetch]
  );

  const handleSuggestTier = useCallback(async (title: string) => {
    const estimate = await missionsService.estimatePersonalMission(title);
    if (!estimate) return null;
    const suggested_difficulty = (estimate.tier.charAt(0).toUpperCase() +
      estimate.tier.slice(1)) as "Easy" | "Medium" | "Hard";
    return {
      suggested_difficulty,
      xp_value: estimate.xp,
      pet_food_value: estimate.pf,
    };
  }, []);

  const openTwin = () => navigation.navigate("Twin");

  const handleConfirmDeletePersonal = useCallback(() => {
    if (!missionToDelete) return;
    const id = missionToDelete.id;
    setDeleteSheetVisible(false);
    setMissionToDelete(null);
    deletePersonalMission(id, {
      onSuccess: () => setRemoveSuccessToast(true),
      onError: () => setRemoveErrorToast(true),
    });
  }, [missionToDelete, deletePersonalMission]);

  const openMissionDetail = useCallback(
    (apiMission: Mission, type: "core" | "interest" | "resistance" | "personal") => {
      const parentNav = (navigation as any).getParent?.();
      const target = parentNav ?? navigation;
      target.navigate("MissionDetail", {
        mission: missionApiToDetailParam(
          apiMission,
          type,
          todayData?.date ?? new Date().toISOString().slice(0, 10)
        ),
      });
    },
    [navigation, todayData?.date]
  );

  const greeting = getGreeting();

  return (
    <View style={styles.container}>
      <LinearGradient colors={BG_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* 1. Top bar — avatar + greeting */}
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={styles.topBarRow}>
          <View style={styles.avatarWrap}>
            {profilePhotoUri ? (
              <Image source={{ uri: profilePhotoUri }} style={styles.avatarImg} resizeMode="cover" />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {(username || "?").charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.greeting} numberOfLines={1}>{greeting}</Text>
        </View>
      </View>

      {/* 2. Streak strip */}
      <View style={styles.streakStrip}>
        <View style={styles.streakLeft}>
          <Text style={styles.streakFlame}>🔥</Text>
          <Text style={styles.streakNum}>{streak}</Text>
          <View>
            <Text style={styles.streakLabel}>day streak</Text>
          </View>
        </View>
        <View style={styles.streakRight}>
          <Text style={styles.weekLabel}>This week</Text>
          <View style={styles.weekDotsRow}>
            {weekDotType.map((status, i) => (
              <View
                key={i}
                style={[
                  styles.weekDot,
                  status === "done" ? styles.weekDotDone : null,
                  status === "today" ? styles.weekDotToday : null,
                ]}
              />
            ))}
          </View>
        </View>
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{getErrorMessage(error)}</Text>
          <Pressable onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: CONTENT_PADDING_BOTTOM }]}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* 3. Hero zone */}
        <View style={styles.heroZone}>
          <View style={styles.heroAtmosphere} pointerEvents="none">
            <View style={[styles.glow1, { shadowColor: "rgba(80,20,160,0.20)" }]} />
            <View style={[styles.glow2, { shadowColor: "rgba(109,40,217,0.07)" }]} />
          </View>
          <View style={styles.heroFloor} pointerEvents="none">
            <LinearGradient
              colors={["transparent", "rgba(139,92,246,0.18)", "transparent"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={styles.heroRow}>
            <View style={styles.characterCard}>
              <LinearGradient
                colors={["rgba(60,25,130,0.30)", "rgba(10,10,22,0.75)"]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.characterRim} pointerEvents="none">
                <LinearGradient
                  colors={["transparent", "rgba(167,139,250,0.38)", "transparent"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
              <View style={styles.characterFade} pointerEvents="none">
                <LinearGradient colors={["rgba(7,8,15,0.55)", "transparent"]} style={StyleSheet.absoluteFill} />
              </View>
              <Text style={styles.characterLabel}>Stage {characterStage}</Text>
            </View>
            {petStage >= 1 ? (
              <View style={styles.petSpacer} />
            ) : (
              <View style={styles.petLocked}>
                <Text style={styles.petLockedText}>7-day streak to unlock</Text>
              </View>
            )}
          </View>
          <View style={styles.xpWrap}>
            <View style={styles.xpLabelRow}>
              <Text style={styles.xpLabelLeft}>✦ {displayXP} XP</Text>
              <Text style={styles.xpLabelRight}>→ {nextStageName}</Text>
            </View>
            <XPProgressBar
              ref={xpBarRef}
              currentXP={displayXP}
              nextStageXP={nextStageXP}
              nextStageName={nextStageName}
              width={252}
              hideLabels
            />
          {(profile?.pet_unlocked ?? false) && (
            <View style={styles.petFoodBar}>
              <View style={styles.petFoodLabelRow}>
                <Text style={styles.petFoodLabelLeft}>🌿 {totalPetFood} PF</Text>
                {nextPetName ? (
                  <Text style={styles.petFoodLabelRight}>→ {nextPetName}</Text>
                ) : (
                  <Text style={styles.petFoodLabelRight}>Max</Text>
                )}
              </View>
              <View style={styles.petFoodTrack}>
                <View
                  style={[styles.petFoodFillWrap, { width: `${(petLevelPct * 100).toFixed(1)}%` }]}
                  pointerEvents="none"
                >
                  <LinearGradient
                    colors={["#047857", "#10B981", "#34D399"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.petFoodFill}
                  />
                </View>
              </View>
            </View>
          )}
          </View>
        </View>

        {/* Empty state: missions being prepared */}
        {!isLoading && !error && todayData && todayData.summary.total === 0 ? (
          <View style={styles.emptyMissionsWrap}>
            <Text style={styles.emptyMissionsText}>Your missions are being prepared…</Text>
          </View>
        ) : null}

        {/* 4. Twin alert strip — full width */}
        <Pressable style={styles.twinStrip} onPress={openTwin}>
          <View style={styles.twinAvatar}>
            <LinearGradient
              colors={["rgba(100,35,200,0.62)", "rgba(192,132,252,0.22)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.twinAvatarLabel}>T</Text>
          </View>
          <Text style={styles.twinMessage} numberOfLines={1} ellipsizeMode="tail">
            {showTwinStrip ? twinStripMessage : "Your rival is you — one week ahead."}
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#374151" />
        </Pressable>

        {/* 5–8. Mission sections — only when we have missions */}
        {todayData && todayData.summary.total > 0 ? (
        <>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <LinearGradient colors={[RED_CORE, RED_DARK]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.sectionBarCore} />
              <Text style={[styles.sectionTitle, { color: RED_CORE }]}>CORE</Text>
            </View>
            <Text style={styles.sectionFraction}>
              <Text style={styles.sectionFractionDone}>{coreMissions.filter((m) => m.status === "complete").length}</Text>
              /{coreMissions.length} done
            </Text>
          </View>
          <View style={styles.cards}>
            {isLoading ? (
              <>
                <SkeletonCard leftEdgeColor="#7F1D1D" delay={0} />
                <SkeletonCard leftEdgeColor="#7F1D1D" delay={100} />
                <SkeletonCard leftEdgeColor="#7F1D1D" delay={200} />
              </>
            ) : (
              (todayData?.missions?.core ?? []).map((apiMission, i) => {
                const m = missionApiToCard(apiMission, "Core");
                return (
                  <HomeMissionCard
                    key={m.id}
                    title={m.title}
                    category={m.category}
                    difficulty={m.difficulty}
                    xpValue={m.xpValue}
                    petFoodValue={m.petFoodValue}
                    status={m.status}
                    onComplete={() => handleComplete(m.id)}
                    onPress={() => openMissionDetail(apiMission, "core")}
                    missionType={m.missionType}
                    missionStreak={m.missionStreak ?? 0}
                    appearIndex={i}
                  />
                );
              })
            )}
          </View>
        </View>

        {/* 6. Today's Focus (Interest) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <LinearGradient colors={[VIOLET, VIOLET_DEEP]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.sectionBarFocus} />
              <Text style={[styles.sectionTitle, { color: VIOLET }]}>INTEREST</Text>
            </View>
            <Text style={styles.sectionFraction}>
              <Text style={styles.sectionFractionDone}>{interestMissions.filter((m) => m.status === "complete").length}</Text>
              /{interestMissions.length} done
            </Text>
          </View>
          <View style={styles.cards}>
            {isLoading ? (
              <>
                <SkeletonCard leftEdgeColor="#8B5CF6" delay={300} />
                <SkeletonCard leftEdgeColor="#8B5CF6" delay={400} />
              </>
            ) : (
              (todayData?.missions.interest ?? []).map((apiMission, i) => {
                const m = missionApiToCard(apiMission, "Interest");
                return (
                  <HomeMissionCard
                    key={m.id}
                    title={m.title}
                    category={m.category}
                    difficulty={m.difficulty}
                    xpValue={m.xpValue}
                    petFoodValue={m.petFoodValue}
                    status={m.status}
                    onComplete={() => handleComplete(m.id)}
                    onPress={() => openMissionDetail(apiMission, "interest")}
                    missionType={m.missionType}
                    interestName={m.interestName}
                    missionStreak={m.missionStreak ?? 0}
                    appearIndex={i}
                  />
                );
              })
            )}
          </View>
        </View>

        {/* 7. Resistance (Quit Target Missions) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <View style={styles.sectionBarResistance} />
              <Text style={[styles.sectionTitle, { color: EMBER, fontSize: 13, fontWeight: "600" }]}>RESISTANCE</Text>
            </View>
            <Text style={styles.sectionFraction}>
              <Text style={styles.sectionFractionDone}>{resistanceMissions.filter((m) => m.status === "complete").length}</Text>
              /{resistanceMissions.length} done
            </Text>
          </View>
          <View style={styles.cards}>
            {isLoading ? (
              <>
                <SkeletonCard leftEdgeColor="#7F1D1D" delay={450} />
              </>
            ) : (
              (todayData?.missions?.resistance ?? []).map((apiMission, i) => {
                const m = missionApiToCard(apiMission, "Resistance");
                return (
                  <HomeMissionCard
                    key={m.id}
                    title={m.title}
                    category={m.category}
                    difficulty={m.difficulty}
                    xpValue={m.xpValue}
                    petFoodValue={m.petFoodValue}
                    status={m.status}
                    onComplete={() => handleComplete(m.id)}
                    onPress={() => openMissionDetail(apiMission, "resistance")}
                    missionType="resistance"
                    quitTargetName={m.quitTargetName}
                    dayCounter={m.dayCounter}
                    appearIndex={i}
                  />
                );
              })
            )}
          </View>
        </View>

        {/* 8. Personal (last) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <LinearGradient colors={[PERSONAL_GREY, PERSONAL_GREY_DARK]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.sectionBarPersonal} />
              <Text style={[styles.sectionTitle, { color: TEXT_MUTED }]}>PERSONAL</Text>
            </View>
            <Text style={styles.sectionFraction}>
              <Text style={styles.sectionFractionDone}>{personalMissions.filter((m) => m.status === "complete").length}</Text>
              /{personalMissions.length} done
            </Text>
          </View>
          <View style={styles.cards}>
            {isLoading ? (
              <SkeletonCard delay={500} />
            ) : (
              (todayData?.missions?.personal ?? []).map((apiMission, i) => {
                const m = missionApiToCard(apiMission, "Personal");
                return (
                  <HomeMissionCard
                    key={m.id}
                    title={m.title}
                    category={m.category}
                    difficulty={m.difficulty}
                    xpValue={m.xpValue}
                    petFoodValue={m.petFoodValue}
                    status={m.status}
                    onComplete={() => handleComplete(m.id)}
                    onPress={() => openMissionDetail(apiMission, "personal")}
                    missionType={m.missionType}
                    missionStreak={m.missionStreak ?? 0}
                    appearIndex={i}
                    onLongPress={
                      m.status === "pending"
                        ? () => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            setMissionToDelete(apiMission);
                            setDeleteSheetVisible(true);
                          }
                        : undefined
                    }
                  />
                );
              })
            )}
          </View>
          {showStartAnywhereHelper && (
            <Text style={styles.startAnywhereHelper}>Start anywhere. Every mission counts.</Text>
          )}

          {/* Add Personal Mission */}
          <Pressable style={styles.addPersonalButton} onPress={() => setAddModalVisible(true)}>
            <Text style={styles.addPersonalPlus}>+</Text>
            <Text style={styles.addPersonalLabel}>Add Personal Mission</Text>
          </Pressable>
        </View>
        </>
        ) : null}
      </ScrollView>

      {/* Pet roaming overlay */}
      {viewportHeight > 0 && windowWidth > 0 && petStage >= 1 && (
        <View
          style={[
            styles.petViewportOverlay,
            { top: insets.top + TOP_BAR_HEIGHT, width: windowWidth, height: viewportHeight },
          ]}
          pointerEvents="box-none"
        >
          <PetRoaming
            containerWidth={windowWidth}
            containerHeight={viewportHeight}
            heroX={heroX}
            heroY={heroY}
            stage={petStage}
            isHappy={petHealthState === "happy"}
          />
        </View>
      )}

      {/* Journal FAB — premium look (gradient + shadow, same as Twin chat FAB) */}
      <Pressable
        style={({ pressed }) => [styles.journalFab, { bottom: JOURNAL_FAB_BOTTOM_GAP }, pressed && styles.journalFabPressed]}
        onPress={() => (navigation as any).navigate("JournalList")}
      >
        <LinearGradient
          colors={[VIOLET_DEEP, VIOLET]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.journalFabGradient}
        >
          <Ionicons name="book-outline" size={24} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>

      <AddMissionModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAdd={handleAddMission}
        onSuggestTier={handleSuggestTier}
      />
      {milestoneCard && (
        <MilestoneAchievementCard
          visible={true}
          onClose={() => setMilestoneCard(null)}
          interestName={milestoneCard.interestName}
          milestoneNumber={milestoneCard.milestoneNumber}
          milestoneName={milestoneCard.milestoneName}
          twinCongratulation={milestoneCard.twinCongratulation}
        />
      )}
      {evolutionOverlayVisible && (
        <CharacterEvolutionOverlay
          visible={true}
          onClose={() => setEvolutionOverlayVisible(false)}
          stageName={evolutionStageName}
        />
      )}

      <DeleteMissionSheet
        visible={deleteSheetVisible}
        mission={missionToDelete}
        onConfirm={handleConfirmDeletePersonal}
        onCancel={() => {
          setDeleteSheetVisible(false);
          setMissionToDelete(null);
        }}
      />
      <MissionRemovedToast
        visible={removeSuccessToast}
        variant="success"
        message="Mission removed"
        onHidden={() => setRemoveSuccessToast(false)}
      />
      <MissionRemovedToast
        visible={removeErrorToast}
        variant="error"
        message="Couldn't remove mission. Try again."
        onHidden={() => setRemoveErrorToast(false)}
      />

      {streakAnimationData?.show ? (
        <StreakAchievementOverlay
          visible
          streakCount={streakAnimationData.count}
          onDismiss={() => setStreakAnimationData(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center" },
  errorWrap: {
    paddingHorizontal: SCROLL_PADDING_H,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: SURFACE_CARD,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_BORDER,
  },
  errorText: { fontSize: 14, color: TEXT_PRIMARY, flex: 1 },
  retryButton: { paddingVertical: 6, paddingHorizontal: 16, backgroundColor: VIOLET, borderRadius: 10 },
  retryText: { fontSize: 14, fontWeight: "600", color: TEXT_PRIMARY },
  emptyMissionsWrap: {
    paddingVertical: 24,
    paddingHorizontal: SCROLL_PADDING_H,
    alignItems: "center",
  },
  emptyMissionsText: {
    fontSize: 14,
    color: TEXT_MUTED,
    fontStyle: "italic",
  },

  topBar: {
    minHeight: TOP_BAR_HEIGHT,
    paddingBottom: 10,
    paddingHorizontal: SCROLL_PADDING_H,
    justifyContent: "flex-end",
    backgroundColor: "rgba(9,9,26,0.85)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.35)",
    overflow: "hidden",
  },
  topBarRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(80,30,160,0.7)",
    borderWidth: 1.5,
    borderColor: "rgba(139,92,246,0.35)",
    shadowColor: "rgba(109,40,217,0.2)",
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
    overflow: "hidden",
  },
  avatarPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 15, fontWeight: "700", color: "rgba(139,92,246,0.8)" },
  avatarImg: { width: 38, height: 38, borderRadius: 19 },
  greeting: { flex: 1, fontSize: 13, fontWeight: "400", color: TEXT_MUTED },

  streakStrip: {
    backgroundColor: "rgba(12,10,20,0.9)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(249,115,22,0.12)",
    paddingHorizontal: SCROLL_PADDING_H,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  streakLeft: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  streakFlame: { fontSize: 20 },
  streakNum: { fontSize: 22, fontWeight: "900", color: EMBER, letterSpacing: -0.5 },
  streakLabel: { fontSize: 10, fontWeight: "500", color: "rgba(249,115,22,0.6)", letterSpacing: 0.3, marginTop: 2 },
  streakRight: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 5 },
  weekLabel: { fontSize: 9, color: TEXT_DIM, letterSpacing: 0.8, textTransform: "uppercase", marginRight: 6, flexShrink: 0 },
  weekDotsRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  weekDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  weekDotDone: {
    backgroundColor: EMBER,
    shadowColor: "rgba(249,115,22,0.45)",
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  weekDotToday: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
    borderColor: EMBER,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SCROLL_PADDING_H, flexGrow: 1 },

  heroZone: {
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: "center",
    position: "relative",
  },
  heroAtmosphere: {
    position: "absolute",
    inset: 0,
  },
  glow1: {
    width: 260,
    height: 180,
    borderRadius: 130,
    alignSelf: "center",
    marginTop: 20,
    backgroundColor: "transparent",
    shadowRadius: 80,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  glow2: {
    position: "absolute",
    right: 60,
    top: 50,
    width: 140,
    height: 100,
    borderRadius: 70,
    backgroundColor: "transparent",
    shadowRadius: 50,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
  },
  heroFloor: {
    position: "absolute",
    bottom: 0,
    left: "8%",
    right: "8%",
    height: 1,
    overflow: "hidden",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
    position: "relative",
    zIndex: 1,
  },
  characterCard: {
    width: CHARACTER_WIDTH,
    height: CHARACTER_HEIGHT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.14)",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  characterRim: {
    position: "absolute",
    top: 0,
    left: "18%",
    right: "18%",
    height: 1,
    borderRadius: 1,
  },
  characterFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
  },
  characterLabel: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    fontSize: 8,
    color: "rgba(107,114,128,0.35)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    textAlign: "center",
  },
  petSpacer: {
    width: PET_SIZE,
    height: PET_SIZE,
    marginBottom: 14,
  },
  petLocked: {
    width: PET_SIZE,
    height: PET_SIZE,
    borderRadius: PET_SIZE / 2,
    marginBottom: 14,
    backgroundColor: "rgba(75,85,99,0.15)",
    borderWidth: 1,
    borderColor: "rgba(75,85,99,0.25)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  petLockedText: {
    fontSize: 8,
    color: TEXT_DIM,
    textAlign: "center",
  },
  xpWrap: { width: 252, zIndex: 1 },
  xpLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  xpLabelLeft: { fontSize: 10, fontWeight: "600", color: VIOLET_GLOW },
  xpLabelRight: { fontSize: 10, color: TEXT_DIM },
  petFoodBar: {
    marginTop: 10,
    width: 252,
  },
  petFoodLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  petFoodLabelLeft: {
    fontSize: 10,
    color: TEXT_DIM,
  },
  petFoodLabelRight: {
    fontSize: 10,
    color: TEXT_MUTED,
  },
  petFoodTrack: {
    height: 5,
    borderRadius: 5,
    backgroundColor: "rgba(20,24,36,1)",
    overflow: "hidden",
    position: "relative",
  },
  petFoodFillWrap: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 5,
    overflow: "hidden",
  },
  petFoodFill: {
    flex: 1,
    height: 5,
    borderRadius: 5,
    minWidth: 0,
  },

  twinStrip: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    marginHorizontal: -SCROLL_PADDING_H,
    backgroundColor: "rgba(12,12,28,0.7)",
    borderTopWidth: 1,
    borderTopColor: "rgba(42,48,80,0.38)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.38)",
  },
  twinAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(192,132,252,0.28)",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  twinAvatarLabel: { fontSize: 10, fontWeight: "700", color: "rgba(192,132,252,0.72)" },
  twinMessage: { flex: 1, fontSize: 12, fontWeight: "400", color: VIOLET, fontStyle: "italic" },

  section: { marginBottom: 0 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    paddingBottom: 9,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionBarCore: { width: 3, height: 13, borderRadius: 2 },
  sectionBarFocus: { width: 3, height: 13, borderRadius: 2 },
  sectionBarPersonal: { width: 3, height: 13, borderRadius: 2 },
  sectionBarResistance: {
    width: 3,
    height: 13,
    borderRadius: 2,
    backgroundColor: EMBER,
  },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1.8, textTransform: "uppercase" },
  sectionFraction: { fontSize: 11, fontWeight: "600", color: "#374151" },
  sectionFractionDone: { color: VIOLET_GLOW },
  cards: { gap: 7 },
  startAnywhereHelper: {
    fontSize: 13,
    fontStyle: "italic",
    color: TEXT_MUTED,
    marginTop: 16,
    marginBottom: 8,
  },
  addPersonalButton: {
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(75,85,99,0.08)",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(75,85,99,0.35)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
    marginBottom: 16,
  },
  addPersonalPlus: { fontSize: 18, color: TEXT_DIM, lineHeight: 1 },
  addPersonalLabel: { fontSize: 13, fontWeight: "500", color: TEXT_DIM, letterSpacing: 0.1 },

  petViewportOverlay: { position: "absolute", left: 0, zIndex: 10 },
  journalFab: {
    position: "absolute",
    right: SCROLL_PADDING_H,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? { shadowColor: VIOLET, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 16 }
      : { elevation: 10 }),
  },
  journalFabPressed: { opacity: 0.93, transform: [{ scale: 0.97 }] },
  journalFabGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});
