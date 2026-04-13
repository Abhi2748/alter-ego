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
  Platform,
  Image,
  Alert,
  InteractionManager,
  Dimensions,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RouteProp } from "@react-navigation/native";
import type { MainTabParamList } from "../navigation/types";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { XPProgressBar, XPProgressBarRef } from "../components/XPProgressBar";
import { getNextStageNameForBar } from "@/constants/characterProgression";
import { PetEvolutionModal } from "../components/PetEvolutionModal";
import { HomeMissionCard } from "../components/HomeMissionCard";
import type { MissionType, MissionStatus } from "../components/MissionCard";
import { AddMissionModal } from "../components/AddMissionModal";
import { CharacterEvolutionOverlay } from "../components/CharacterEvolutionOverlay";
import { StageTwinMessageOverlay } from "@/components/StageTwinMessageOverlay";
import { HomeMissionSectionsSkeleton } from "@/components/HomeMissionSectionsSkeleton";
import { useUserStore } from "@/store/userStore";
import {
  useTodayMissions,
  useCompleteMission,
  useDeletePersonalMission,
  MISSION_KEYS,
} from "@/hooks/useMissions";
import { DeleteMissionSheet } from "@/components/DeleteMissionSheet";
import { MissionRemovedToast } from "@/components/MissionRemovedToast";
import { StreakAchievementOverlay } from "@/components/StreakAchievementOverlay";
import { TwinPulse } from "@/components/TwinPulse";
import { useTwinStrip } from "@/hooks/useTwinStrip";
import type { CompleteMissionResponse, Mission } from "@/services/missions";
import {
  emitMissionCompletionCelebration,
  setMissionCompletionCelebrationHandler,
} from "@/utils/missionCompletionBridge";
import {
  runMissionCompletionCelebrationUI,
  type MissionCompletionCelebrationContext,
} from "@/utils/missionCompletionCelebration";
import { missionsService } from "@/services/missions";
import { apiClient, getErrorMessage } from "@/services/api";
import { useProfileStreak } from "@/hooks/useProfile";
import { SpGainToast } from "@/components/SpGainToast";
import { SurgeIndicator } from "@/components/SurgeIndicator";
import { AetherToast } from "@/components/AetherToast";
import { SigilLevelUpOverlay, type SigilLevelUpPayload } from "@/components/SigilLevelUpOverlay";
import { FractureOverlay } from "@/components/FractureOverlay";
import { SevenDayMirror } from "@/components/SevenDayMirror";
import { AbsenceInterstitial } from "@/components/AbsenceInterstitial";
import { RecoveryBanner } from "@/components/RecoveryBanner";
import PetDialogueBubble from "@/components/PetDialogueBubble";
import {
  fetchMirrorData,
  fetchReturnState,
  type MirrorResponse,
  type ReturnStateResponse,
} from "@/services/profile";
import { useSigilData } from "@/hooks/useSigil";
import { SIGIL_PLACEHOLDER_DATA } from "@/services/sigil";
import {
  parseStatTag,
  resolveStatKeyForMission,
  type AbilityStatKey,
} from "@/constants/stats";
import { getCharacterImageSource, getPetImageSource } from "@/constants/characterPetAssets";
import { PET_STAGE_NAMES } from "@/constants/petProgression";
import { pickPetDialogue, type PetDialogueContext } from "@/constants/petDialogue";
import { useCharacterStats } from "@/hooks/useStats";
import { useInterests } from "@/hooks/useInterests";
import {
  INTEREST_COLORS,
  QUIT_ORANGE,
  getInterestColorByHex,
} from "@/constants/missionColors";
import { SeasonBanner } from '@/components/SeasonBanner';
import { useCurrentSeason } from '@/hooks/useSeason';
/** AsyncStorage keys for streak-break ceremony (B1 Fracture). */
const AE_LAST_STREAK_KEY_PREFIX = "ae_last_streak_";
const AE_FRACTURE_SHOWN_KEY_PREFIX = "ae_fracture_shown_";

/** YYYY-MM-DD in the device's local calendar (not UTC). Must match GET /missions/today mission_date. */
function localCalendarYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Calendar days since registration (day 1 = first day), device-local; mirrors backend intent for mirror eligibility. */
function profileUsageDayCount(registrationDate: string | undefined): number {
  if (!registrationDate) return 0;
  const datePart = registrationDate.slice(0, 10);
  const parts = datePart.split("-").map((x) => parseInt(x, 10));
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return 0;
  const [y, m, d] = parts;
  const reg = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const regDay = new Date(reg.getFullYear(), reg.getMonth(), reg.getDate());
  const diffDays = Math.floor((today.getTime() - regDay.getTime()) / 86400000);
  return diffDays + 1;
}

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

/** Match Profile hero character (`charWrap` 168×252). */
const CHARACTER_WIDTH = 168;
const CHARACTER_HEIGHT = 252;
/** Home hero companion art (~10% larger than prior 76×76). */
const HERO_PET_SIZE = Math.round(76 * 1.1);
const HERO_PET_COLUMN_MARGIN_BOTTOM = 14;
/** Tight stack above companion: pet column + margin + small gap; tail sits just above head. */
const PET_DIALOGUE_WRAP_BOTTOM = HERO_PET_SIZE + HERO_PET_COLUMN_MARGIN_BOTTOM + 8;
/** Floor for dialogue width when measuring (readable single column). */
const PET_DIALOGUE_MIN_SCREEN_W = 168;
/** Pet art uses `contain` and often sits left; tail aim slightly past geometric center toward the head. */
const PET_DIALOGUE_TAIL_CENTER_NUDGE = 10;
const TOP_BAR_HEIGHT = 56;
const TAB_BAR_HEIGHT = 56;
const CONTENT_PADDING_BOTTOM = 96;
const JOURNAL_FAB_BOTTOM_GAP = 8;
const SCROLL_PADDING_H = 16;

/** Device local YYYY-MM-DD — fallback before /profile/streak returns `calendar_date`. */
function formatDeviceLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function asMissionArray(raw: unknown): Mission[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is Mission =>
      item != null &&
      typeof item === "object" &&
      typeof (item as Mission).id === "string" &&
      (item as Mission).id.length > 0
  );
}

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

type PetDialogueTriggerReason = "session_open" | "mission_complete" | "reminder";

const PET_DIALOGUE_MIN_COOLDOWN_MS = 45000;
const PET_DIALOGUE_MIN_VISIBLE_MS = 4500;
const PET_DIALOGUE_MAX_VISIBLE_MS = 6000;
const PET_DIALOGUE_MIN_REMINDER_MS = 90000;
const PET_DIALOGUE_MAX_REMINDER_MS = 150000;
const PET_DIALOGUE_MAX_SHOWS_PER_SESSION = 3;

function missionApiToCard(
  m: Partial<Mission> | null | undefined,
  category: "Core" | "Interest" | "Resistance" | "Personal"
): PlaceholderMission {
  const diff = String(m?.difficulty ?? "").toLowerCase();
  const difficulty = diff === "easy" ? "Easy" : diff === "medium" ? "Medium" : diff === "hard" ? "Hard" : "Medium";
  return {
    id: typeof m?.id === "string" ? m.id : "",
    title: m?.title ?? "",
    category,
    difficulty,
    xpValue: m?.xp_value ?? 0,
    petFoodValue: m?.pf_value ?? 0,
    status: m?.completed ? ("complete" as const) : ("pending" as const),
    missionType: (category === "Core"
      ? "core"
      : category === "Interest"
        ? "interest"
        : category === "Resistance"
          ? "resistance"
          : "personal") as MissionType,
    missionStreak:
      typeof m?.mission_streak === "number" && Number.isFinite(m.mission_streak)
        ? Math.max(0, Math.floor(m.mission_streak))
        : 0,
    interestName: (m?.interest_name ?? "").trim() || undefined,
    quitTargetName: (m?.quit_target_name ?? "").trim() || undefined,
  };
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning 👋";
  if (h >= 12 && h < 17) return "Good afternoon 👋";
  if (h >= 17 && h < 21) return "Good evening 👋";
  return "Good night 🌙";
}

function getTwinCompletionNote(mission: Mission): string | undefined {
  if (mission.twin_completed === false) return "You got there first.";
  if (!mission.twin_completed) return undefined;
  const hour = mission.twin_completed_at_hour;
  if (hour == null || typeof hour !== "number") {
    return "Your Twin was done with this before noon.";
  }
  const now = new Date().getHours();
  const hoursAgo = Math.max(0, now - hour);
  if (hoursAgo === 0) return "Your Twin just finished this.";
  if (hoursAgo === 1) return "Your Twin finished this an hour ago.";
  if (hoursAgo < 5) return `Your Twin finished this ${hoursAgo} hours ago.`;
  return "Your Twin was done with this before noon.";
}

function buildSpToastGains(
  gains: StatGains | undefined
): Array<{ statKey: AbilityStatKey; amount: number }> {
  if (!gains) return [];
  const out: Array<{ statKey: AbilityStatKey; amount: number }> = [];
  const pk = gains.primary_stat ? parseStatTag(gains.primary_stat) : undefined;
  if (pk && gains.primary_sp > 0) {
    out.push({ statKey: pk, amount: gains.primary_sp });
  }
  if (gains.discipline_sp > 0) {
    out.push({ statKey: "discipline", amount: gains.discipline_sp });
  }
  if (gains.willpower_bonus_sp > 0) {
    out.push({ statKey: "willpower", amount: gains.willpower_bonus_sp });
  }
  return out;
}

function WillpowerNudgeCard({
  completedToday,
  totalMissionsToday,
}: {
  completedToday: number;
  totalMissionsToday: number;
}) {
  const total = totalMissionsToday;
  const c = completedToday;
  if (total <= 0 || c >= total) return null;

  let line: string;
  let phaseTarget: number;

  if (c < 4 && total >= 4) {
    const rem = 4 - c;
    phaseTarget = 4;
    line = `${rem} more mission${rem === 1 ? "" : "s"} = +20 Willpower SP`;
  } else if (total >= 6 && c < 6 && c >= 4) {
    const rem = 6 - c;
    phaseTarget = 6;
    line = `${rem} more mission${rem === 1 ? "" : "s"} = +45 Willpower SP`;
  } else {
    const rem = total - c;
    phaseTarget = total;
    line = `${rem} more mission${rem === 1 ? "" : "s"} = +80 Willpower SP (full day)`;
  }

  return (
    <View style={willNudgeStyles.card}>
      <Text style={willNudgeStyles.symbol}>⬡</Text>
      <View style={willNudgeStyles.mid}>
        <Text style={willNudgeStyles.title}>{line}</Text>
        <Text style={willNudgeStyles.sub}>Complete your day fully to earn it</Text>
      </View>
      <Text style={willNudgeStyles.fraction}>
        {c}/{phaseTarget}
      </Text>
    </View>
  );
}

const willNudgeStyles = StyleSheet.create({
  card: {
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  symbol: { fontSize: 16, color: "#EF4444", fontFamily: "Inter_700Bold" },
  mid: { flex: 1 },
  title: {
    fontSize: 11,
    fontWeight: "700",
    color: "#EF4444",
    marginBottom: 1,
    fontFamily: "Inter_700Bold",
  },
  sub: { fontSize: 10, color: "#6B7280", fontFamily: "Inter_500Medium" },
  fraction: {
    fontSize: 13,
    fontWeight: "800",
    color: "#EF4444",
    fontFamily: "Inter_800ExtraBold",
  },
});

export function HomeScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const route = useRoute<RouteProp<MainTabParamList, "Home">>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const xpBarRef = useRef<XPProgressBarRef>(null);
  const petHeroBlockRef = useRef<View>(null);
  const [petDialogueMaxWidth, setPetDialogueMaxWidth] = useState(() => {
    const w = Dimensions.get("window").width;
    return Math.min(318, Math.max(PET_DIALOGUE_MIN_SCREEN_W, w - SCROLL_PADDING_H * 2 - 8));
  });

  const updatePetDialogueMaxWidth = useCallback(() => {
    const node = petHeroBlockRef.current;
    if (!node) return;
    node.measureInWindow((x, _y, w, _h) => {
      const minLeft = insets.left + SCROLL_PADDING_H;
      const petRight = x + w;
      const cap = Math.floor(petRight - minLeft - 6);
      setPetDialogueMaxWidth(Math.max(PET_DIALOGUE_MIN_SCREEN_W, cap));
    });
  }, [insets.left]);

  useEffect(() => {
    updatePetDialogueMaxWidth();
  }, [windowWidth, updatePetDialogueMaxWidth]);

  const profile = useUserStore((state) => state.profile);
  const fetchProfile = useUserStore((state) => state.fetchProfile);
  const [deferSecondaryHomeData, setDeferSecondaryHomeData] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setDeferSecondaryHomeData(true);
    });
    return () => task.cancel();
  }, []);
  const { data: todayData, isPending, isFetching, error, refetch } = useTodayMissions();
  const { data: characterStats } = useCharacterStats({ enabled: deferSecondaryHomeData });
  /** No cached missions yet — show full mission-area skeleton (top may already render from profile). */
  const showMissionSkeletons = !error && !todayData && (isPending || isFetching);
  const { mutate: completeMission, isPending: isCompleting } = useCompleteMission();
  const { mutate: deletePersonalMission } = useDeletePersonalMission();
  const { data: twinStrip } = useTwinStrip();
  const { data: streakProfile } = useProfileStreak();
  const { data: sigilSnapshot } = useSigilData({ enabled: deferSecondaryHomeData });
  const { data: currentSeason } = useCurrentSeason();
  const seasonEnded =
    currentSeason?.status === "completed" || currentSeason?.status === "failed";
  const seasonEndedUnseen = seasonEnded && currentSeason?.completion_seen !== true;
  const sigilData = sigilSnapshot ?? SIGIL_PLACEHOLDER_DATA;
  const surgeActive = sigilData.surge_active === true;

  const [aetherToastVisible, setAetherToastVisible] = useState(false);
  const [aetherToastAmount, setAetherToastAmount] = useState(0);
  const [sigilLevelUp, setSigilLevelUp] = useState<SigilLevelUpPayload | null>(null);
  const [surgeJustActivated, setSurgeJustActivated] = useState(false);

  useEffect(() => {
    if (!surgeJustActivated) return;
    const t = setTimeout(() => setSurgeJustActivated(false), 4000);
    return () => clearTimeout(t);
  }, [surgeJustActivated]);

  const [streakAnimationData, setStreakAnimationData] = useState<{
    show: boolean;
    count: number;
    tier: string;
  } | null>(null);
  /** Dedupes parallel completes: only one overlay per (anchor day × streak count). */
  const streakOverlayTokenRef = useRef<string | null>(null);
  const [evolutionData, setEvolutionData] = useState<{
    new_stage: number;
    new_stage_name: string;
  } | null>(null);
  const [petEvolutionData, setPetEvolutionData] = useState<{
    new_stage: number;
    new_pet_name: string;
  } | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [evolutionOverlayVisible, setEvolutionOverlayVisible] = useState(false);
  const [stageTwinMsgVisible, setStageTwinMsgVisible] = useState(false);
  const [stageTwinMsgStageName, setStageTwinMsgStageName] = useState("");
  const [evolutionStageName, setEvolutionStageName] = useState("The Focused");

  const handleStageTwinMsgComplete = useCallback(() => {
    setStageTwinMsgVisible(false);
    setEvolutionOverlayVisible(true);
  }, []);

  const [deleteSheetVisible, setDeleteSheetVisible] = useState(false);
  const [missionToDelete, setMissionToDelete] = useState<Mission | null>(null);
  const [removeSuccessToast, setRemoveSuccessToast] = useState(false);
  const [removeErrorToast, setRemoveErrorToast] = useState(false);
  const [spToast, setSpToast] = useState<{
    k: number;
    gains: Array<{ statKey: AbilityStatKey; amount: number }>;
    footerNote?: string;
  } | null>(null);
  const [fractureVisible, setFractureVisible] = useState(false);
  const [fractureStreakCount, setFractureStreakCount] = useState(0);
  const fractureMemoryLastPositiveStreakRef = useRef(0);
  const [mirrorDismissed, setMirrorDismissed] = useState(false);
  const [absenceInterstitialSessionOpen, setAbsenceInterstitialSessionOpen] = useState(false);
  const [absenceInterstitialDismissed, setAbsenceInterstitialDismissed] = useState(false);
  const [petDialogueText, setPetDialogueText] = useState<string | null>(null);
  const [petDialogueVisible, setPetDialogueVisible] = useState(false);

  useEffect(() => {
    if (!petDialogueText) return;
    const id = requestAnimationFrame(() => updatePetDialogueMaxWidth());
    return () => cancelAnimationFrame(id);
  }, [petDialogueText, updatePetDialogueMaxWidth]);

  const petDialogueAutoHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const petDialogueReminderRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const petDialogueLastShownAtRef = useRef(0);
  const petDialogueSessionCountRef = useRef(0);
  const petDialogueLastLineRef = useRef<string | null>(null);
  const petDialogueRecentLinesRef = useRef<string[]>([]);
  const petDialogueAbsenceShownRef = useRef(false);
  const petDialogueQueuedReasonRef = useRef<PetDialogueTriggerReason | null>(null);

  const mirrorDayCount = profileUsageDayCount(profile?.registration_date);
  const shouldFetchMirror =
    !!profile?.username && !mirrorDismissed && mirrorDayCount >= 7;

  const { data: mirrorData } = useQuery<MirrorResponse>({
    queryKey: ["mirror", profile?.username ?? ""],
    queryFn: fetchMirrorData,
    enabled: shouldFetchMirror,
    staleTime: Infinity,
    retry: 1,
    throwOnError: false,
  });

  const { data: returnState } = useQuery<ReturnStateResponse>({
    queryKey: ["return-state"],
    queryFn: fetchReturnState,
    enabled: !!profile,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    throwOnError: false,
  });

  const absenceDays = returnState?.absence_days ?? twinStrip?.absence_days ?? 0;
  const meetsAbsenceInterstitialThreshold = absenceDays >= 3;

  useEffect(() => {
    if (!profile || absenceInterstitialDismissed) return;
    if (meetsAbsenceInterstitialThreshold) {
      setAbsenceInterstitialSessionOpen(true);
    }
  }, [profile, meetsAbsenceInterstitialThreshold, absenceInterstitialDismissed]);

  const shouldShowAbsenceInterstitial =
    !absenceInterstitialDismissed &&
    absenceInterstitialSessionOpen &&
    absenceDays >= 3;

  const petAbsenceOpacity = absenceDays >= 2 ? 0.6 : 1;
  const isPetUnlocked = (profile?.pet_unlocked ?? false) && (profile?.pet_stage ?? 0) >= 1;
  const overlayBlockingPetDialogue =
    fractureVisible ||
    shouldShowAbsenceInterstitial ||
    stageTwinMsgVisible ||
    evolutionOverlayVisible ||
    !!petEvolutionData;

  const handleLongAbsenceAck = useCallback(async () => {
    try {
      await apiClient.post("/api/v1/profile/long-absence-ack", {});
    } catch {
      /* non-blocking */
    }
    queryClient.invalidateQueries({ queryKey: ["return-state"] });
    void fetchProfile();
  }, [queryClient, fetchProfile]);

  // Backend sets mirror_shown on first success and may return already_shown true in the same payload as observations.
  const mirrorVisible =
    !mirrorDismissed &&
    mirrorData?.eligible === true &&
    (mirrorData?.observations?.length ?? 0) > 0;

  const { data: interestsData } = useInterests();
  const interestColorById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of interestsData?.paths ?? []) {
      const raw = p.color_hex?.trim() ?? "";
      const hex = raw.startsWith("#") ? raw : raw ? `#${raw}` : INTEREST_COLORS[0].primary;
      if (p.path_id) m[p.path_id] = hex;
    }
    return m;
  }, [interestsData?.paths]);

  const missionPayload = todayData?.missions;
  const coreList = asMissionArray(missionPayload?.core);
  const interestList = asMissionArray(missionPayload?.interest);
  const resistanceList = asMissionArray(missionPayload?.resistance);
  const personalList = asMissionArray(missionPayload?.personal);

  const focusSectionScheme = useMemo(() => {
    const id = interestList[0]?.interest_id;
    const hex =
      (id && interestColorById[id]) ? interestColorById[id] : INTEREST_COLORS[0].primary;
    return getInterestColorByHex(hex);
  }, [interestList, interestColorById]);

  const coreMissions = coreList.map((m) => missionApiToCard(m, "Core"));
  const interestMissions = interestList.map((m) => missionApiToCard(m, "Interest"));
  const resistanceMissions = resistanceList.map((m) => missionApiToCard(m, "Resistance"));
  const personalMissions = personalList.map((m) => missionApiToCard(m, "Personal"));

  const missionById = useMemo(() => {
    const m = new Map<string, Mission>();
    for (const x of [...coreList, ...interestList, ...resistanceList, ...personalList]) {
      if (x?.id) m.set(x.id, x);
    }
    return m;
  }, [coreList, interestList, resistanceList, personalList]);

  const celebrationCtxRef = useRef<MissionCompletionCelebrationContext>(
    {} as MissionCompletionCelebrationContext
  );
  celebrationCtxRef.current = {
    xpBarRef,
    queryClient,
    missionById,
    setStreakAnimationData,
    setEvolutionStageName,
    setEvolutionData,
    setEvolutionOverlayVisible,
    setStageTwinMessageVisible: setStageTwinMsgVisible,
    setStageTwinMessageStageName: setStageTwinMsgStageName,
    setPetEvolutionData,
    setSpToast,
    setAetherToastAmount,
    setAetherToastVisible,
    setSurgeJustActivated,
    setSigilLevelUp,
  };

  const dayNumber = todayData?.day_number ?? 1;
  const isDay1To14 = dayNumber >= 1 && dayNumber <= 14;
  const completedToday = todayData?.summary?.completed ?? 0;
  const missionsCompletedForNudge =
    characterStats?.missions_completed_today ?? completedToday;
  const totalMissionsForNudge =
    characterStats?.total_missions_today ?? todayData?.summary?.total ?? 0;
  const showStartAnywhereHelper = completedToday === 0 && isDay1To14;

  const username = profile?.username ?? "";
  const characterStage = profile?.character_stage ?? 1;
  const stageTitle = profile?.character_stage_name ?? "The Awakened";
  const displayXP = profile?.total_xp ?? 0;
  /** 0–100 within current stage — same as profile/overview (fill bar to next threshold). */
  const stageProgressPct = profile?.stage_progress_pct ?? 0;
  /** Stage name you’re progressing toward (e.g. The Focused while still Awakened). */
  const nextStageLabel = getNextStageNameForBar(characterStage);
  const petStage = profile?.pet_stage ?? 0;
  const totalPetFood = profile?.total_pf ?? 0;
  const streak = profile?.current_streak ?? 0;

  const streakHeatmap = streakProfile?.heatmap ?? [];
  const heatmapEligibleSince =
    (streakProfile as { heatmap_eligible_since?: string | null } | undefined)?.heatmap_eligible_since ?? null;
  const heatmapByDate = useMemo(() => new Map(streakHeatmap.map((r) => [r.date, r])), [streakHeatmap]);
  /**
   * "Today" for the strip must match backend missions/streak (get_user_date). Using the heatmap's last row
   * breaks after midnight: that row is often still yesterday until streak_log exists — then the real today
   * was misclassified as "future" and the today ring disappeared.
   */
  const calendarAnchorStr = useMemo(() => {
    const raw = (streakProfile as { calendar_date?: string } | null | undefined)?.calendar_date;
    if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
      return raw.trim();
    }
    return formatDeviceLocalYmd();
  }, [streakProfile]);
  const anchorUTCDate = useMemo(() => {
    const anchorParts = calendarAnchorStr.split("-").map((x) => Number(x));
    const ay = anchorParts[0];
    const am = anchorParts[1];
    const ad = anchorParts[2];
    let d = new Date(Date.UTC(ay, am - 1, ad));
    if (!Number.isFinite(d.getTime())) {
      const t = new Date();
      d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
    }
    return d;
  }, [calendarAnchorStr]);
  // Mon–Sun week containing calendarAnchorStr (Mon=0 … Sun=6).
  const weekDates = useMemo(() => {
    const anchorMonBased = (anchorUTCDate.getUTCDay() + 6) % 7;
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(anchorUTCDate);
      d.setUTCDate(d.getUTCDate() - anchorMonBased + i);
      return d.toISOString().slice(0, 10);
    });
  }, [anchorUTCDate]);
  /** Mon–Sun dots vs calendar anchor (user TZ): today = ring until streak earned, then solid orange; past miss = empty; future = dim. */
  const weekDotType = useMemo(() => {
    return weekDates.map((dateStr) => {
      const row = heatmapByDate.get(dateStr);
      if (dateStr > calendarAnchorStr) return "future" as const;
      if (heatmapEligibleSince && dateStr < heatmapEligibleSince) return "inactive" as const;
      if (dateStr === calendarAnchorStr) {
        return row?.maintained === true ? ("today_done" as const) : ("today" as const);
      }
      if (row?.maintained === true) return "done" as const;
      return "missed" as const;
    });
  }, [weekDates, heatmapByDate, calendarAnchorStr, heatmapEligibleSince]);

  useEffect(() => {
    streakOverlayTokenRef.current = null;
  }, [calendarAnchorStr]);

  useEffect(() => {
    if (!profile) return;

    const uname = (profile.username || "user").trim() || "user";
    const currentStreak = profile.current_streak ?? 0;

    if (currentStreak > 0) {
      fractureMemoryLastPositiveStreakRef.current = Math.max(
        fractureMemoryLastPositiveStreakRef.current,
        currentStreak
      );
    }

    let cancelled = false;
    const lastKey = `${AE_LAST_STREAK_KEY_PREFIX}${uname}`;
    const today = new Date().toISOString().slice(0, 10);
    const shownKey = `${AE_FRACTURE_SHOWN_KEY_PREFIX}${uname}_${today}`;

    const run = async () => {
      try {
        if (currentStreak > 0) {
          await AsyncStorage.setItem(lastKey, String(currentStreak));
        }

        const alreadyShown = await AsyncStorage.getItem(shownKey);
        if (cancelled || alreadyShown === "1") return;

        const lastStr = await AsyncStorage.getItem(lastKey);
        let lastFromDisk: number | null = null;
        if (lastStr != null && lastStr !== "") {
          const n = parseInt(lastStr, 10);
          lastFromDisk = Number.isFinite(n) ? n : null;
        }

        let lastPositive: number | null = null;
        if (lastFromDisk != null && lastFromDisk >= 3) {
          lastPositive = lastFromDisk;
        } else if (fractureMemoryLastPositiveStreakRef.current >= 3) {
          lastPositive = fractureMemoryLastPositiveStreakRef.current;
        }

        if (currentStreak === 0 && lastPositive != null) {
          await AsyncStorage.setItem(shownKey, "1");
          if (!cancelled) {
            setFractureStreakCount(lastPositive);
            setFractureVisible(true);
          }
        }
      } catch {
        if (cancelled) return;
        const mem = fractureMemoryLastPositiveStreakRef.current;
        if (currentStreak === 0 && mem >= 3) {
          setFractureStreakCount(mem);
          setFractureVisible(true);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [profile, profile?.current_streak, profile?.username]);

  const nextPetName =
    petStage >= 1 && petStage < 8 ? PET_STAGE_NAMES[petStage] : null;
  const pfProgress = profile?.pf_progress_pct ?? 0;
  const petLevelPct = pfProgress / 100;

  useEffect(() => {
    const handler = (result: CompleteMissionResponse, source: { missionId?: string }) => {
      runMissionCompletionCelebrationUI(result, source, celebrationCtxRef.current);
    };
    setMissionCompletionCelebrationHandler(handler);
    return () => setMissionCompletionCelebrationHandler(null);
  }, []);

  const showTwinStrip = twinStrip?.has_twin && twinStrip?.strip_message;
  const twinStripMessage = twinStrip?.strip_message ?? null;

  useEffect(() => {
    if (
      todayData &&
      (todayData.summary?.total ?? 0) === 0 &&
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

  const clearPetDialogueTimers = useCallback(() => {
    if (petDialogueAutoHideRef.current) {
      clearTimeout(petDialogueAutoHideRef.current);
      petDialogueAutoHideRef.current = null;
    }
    if (petDialogueReminderRef.current) {
      clearTimeout(petDialogueReminderRef.current);
      petDialogueReminderRef.current = null;
    }
  }, []);

  const getPetDialogueContext = useCallback(
    (reason: PetDialogueTriggerReason): PetDialogueContext => {
      const total = todayData?.summary?.total ?? 0;
      const completed = todayData?.summary?.completed ?? 0;
      const shouldPreferAbsence = absenceDays >= 1 && !petDialogueAbsenceShownRef.current;

      if (shouldPreferAbsence) {
        petDialogueAbsenceShownRef.current = true;
        return "absence_return";
      }
      if (reason === "mission_complete") return "mission_completed";
      if (total > 0 && completed === 0) return "low_progress";
      if (total > 0 && completed < total) return "missions_left";
      return "warm_default";
    },
    [todayData?.summary?.completed, todayData?.summary?.total, absenceDays]
  );

  const showPetDialogue = useCallback(
    (reason: PetDialogueTriggerReason) => {
      if (!isPetUnlocked) return false;
      if (overlayBlockingPetDialogue) {
        petDialogueQueuedReasonRef.current = reason;
        return false;
      }
      if (petDialogueSessionCountRef.current >= PET_DIALOGUE_MAX_SHOWS_PER_SESSION) return false;

      const now = Date.now();
      if (now - petDialogueLastShownAtRef.current < PET_DIALOGUE_MIN_COOLDOWN_MS) return false;

      const context = getPetDialogueContext(reason);
      const nextLine = pickPetDialogue(
        context,
        petDialogueLastLineRef.current,
        petDialogueRecentLinesRef.current
      );
      if (!nextLine) return false;

      clearPetDialogueTimers();
      petDialogueLastShownAtRef.current = now;
      petDialogueLastLineRef.current = nextLine;
      petDialogueRecentLinesRef.current = [
        ...petDialogueRecentLinesRef.current.filter((line) => line !== nextLine),
        nextLine,
      ].slice(-3);
      petDialogueSessionCountRef.current += 1;
      petDialogueQueuedReasonRef.current = null;

      setPetDialogueText(nextLine);
      setPetDialogueVisible(true);

      const visibleFor =
        PET_DIALOGUE_MIN_VISIBLE_MS +
        Math.floor(Math.random() * (PET_DIALOGUE_MAX_VISIBLE_MS - PET_DIALOGUE_MIN_VISIBLE_MS + 1));
      petDialogueAutoHideRef.current = setTimeout(() => {
        setPetDialogueVisible(false);
      }, visibleFor);
      return true;
    },
    [clearPetDialogueTimers, getPetDialogueContext, isPetUnlocked, overlayBlockingPetDialogue]
  );

  const schedulePetDialogueReminder = useCallback(() => {
    if (petDialogueReminderRef.current) {
      clearTimeout(petDialogueReminderRef.current);
      petDialogueReminderRef.current = null;
    }
    const delay =
      PET_DIALOGUE_MIN_REMINDER_MS +
      Math.floor(Math.random() * (PET_DIALOGUE_MAX_REMINDER_MS - PET_DIALOGUE_MIN_REMINDER_MS + 1));

    petDialogueReminderRef.current = setTimeout(() => {
      if (Math.random() <= 0.35) {
        void showPetDialogue("reminder");
      }
      schedulePetDialogueReminder();
    }, delay);
  }, [showPetDialogue]);

  useEffect(() => {
    if (!overlayBlockingPetDialogue) return;
    setPetDialogueVisible(false);
  }, [overlayBlockingPetDialogue]);

  useEffect(() => {
    if (overlayBlockingPetDialogue) return;
    if (!petDialogueQueuedReasonRef.current) return;
    void showPetDialogue(petDialogueQueuedReasonRef.current);
  }, [overlayBlockingPetDialogue, showPetDialogue]);

  useFocusEffect(
    useCallback(() => {
      petDialogueSessionCountRef.current = 0;
      petDialogueAbsenceShownRef.current = false;
      petDialogueRecentLinesRef.current = [];
      setPetDialogueVisible(false);
      setPetDialogueText(null);
      clearPetDialogueTimers();

      const sessionChance = 0.3;
      const starterDelay = setTimeout(() => {
        if (Math.random() <= sessionChance) {
          void showPetDialogue("session_open");
        }
      }, 1100);

      schedulePetDialogueReminder();

      return () => {
        clearTimeout(starterDelay);
        clearPetDialogueTimers();
        petDialogueQueuedReasonRef.current = null;
      };
    }, [clearPetDialogueTimers, schedulePetDialogueReminder, showPetDialogue])
  );

  const handleComplete = useCallback(
    (missionId: string) => {
      completeMission(missionId, {
        onSuccess: (result) => {
          emitMissionCompletionCelebration(result, { missionId });
          if (Math.random() <= 0.5) {
            void showPetDialogue("mission_complete");
          }
        },
        onError: (e) => {
          Alert.alert("Can't mark done", getErrorMessage(e));
        },
      });
    },
    [completeMission, showPetDialogue]
  );

  const handleAddMission = useCallback(
    async (title: string, difficulty: "Easy" | "Medium" | "Hard") => {
      const today = localCalendarYmd();
      const tierMap = { Easy: "easy", Medium: "medium", Hard: "hard" } as const;
      const tier = tierMap[difficulty];
      const estimated_minutes =
        difficulty === "Easy" ? 10 : difficulty === "Medium" ? 25 : 45;
      await missionsService.createPersonalMission({
        mission_text: title,
        tier,
        xp: 0,
        pf: 0,
        estimated_minutes,
        date: today,
      });
      await queryClient.invalidateQueries({ queryKey: MISSION_KEYS.today });
    },
    [queryClient]
  );

  const handleSuggestTier = useCallback(async (title: string) => {
    const estimate = await missionsService.estimatePersonalMission(title);
    if (!estimate) return null;
    const t = estimate.tier.toLowerCase();
    let suggested_difficulty: "Easy" | "Medium" | "Hard";
    if (t === "easy") suggested_difficulty = "Easy";
    else if (t === "hard") suggested_difficulty = "Hard";
    else if (t === "multiday") suggested_difficulty = "Medium";
    else suggested_difficulty = "Medium";
    return {
      suggested_difficulty,
      xp_value: estimate.xp,
      pet_food_value: estimate.pf,
    };
  }, []);

  const openTwin = () => navigation.navigate("Twin");

  const dismissStreakOverlay = useCallback(() => {
    setStreakAnimationData(null);
  }, []);

  const dismissFractureOverlay = useCallback(() => {
    setFractureVisible(false);
  }, []);

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

  const openPersonalDeleteSheet = useCallback((apiMission: Mission) => {
    setMissionToDelete(apiMission);
    setDeleteSheetVisible(true);
  }, []);

  const openMissionDetail = useCallback(
    (apiMission: Mission) => {
      if (!apiMission?.id) return;
      const parentNav = (navigation as any).getParent?.();
      const target = parentNav ?? navigation;
      target.navigate("MissionDetail", { missionId: apiMission.id });
    },
    [navigation]
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
          <Pressable
            style={styles.avatarWrap}
            onPress={() => {
              let nav: any = navigation;
              for (let i = 0; i < 6; i++) {
                const names = nav?.getState?.()?.routeNames;
                if (names?.includes('Achievements')) { nav.navigate('Achievements'); return; }
                nav = nav?.getParent?.();
              }
            }}
            hitSlop={6}
          >
            <View style={styles.avatarClip}>
              {profile?.profile_photo_url ? (
                <Image source={{ uri: profile.profile_photo_url }} style={styles.avatarImg} resizeMode="cover" />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {(username || "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
          <Text style={styles.greeting} numberOfLines={1}>{greeting}</Text>
          {surgeActive && <SurgeIndicator visible />}
        </View>
      </View>

      {/* 2. Streak strip */}
      <Pressable
        style={styles.streakStrip}
        onPress={() => {
          let nav: { getParent?: () => unknown; getState?: () => { routeNames?: string[] }; navigate: (name: string) => void } =
            navigation as never;
          for (let i = 0; i < 6; i++) {
            if (!nav) return;
            const names = nav.getState?.()?.routeNames;
            if (names?.includes("StreakDetail")) {
              nav.navigate("StreakDetail");
              return;
            }
            nav = nav.getParent?.() as never;
          }
        }}
        hitSlop={4}
      >
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
            {weekDotType.map((status, i) =>
              status === "today" ? (
                <View key={`${weekDates[i]}-today`} style={styles.weekDotTodayRingOuter}>
                  <View style={styles.weekDotTodayRingInner} />
                </View>
              ) : (
                <View
                  key={weekDates[i]}
                  style={[
                    styles.weekDot,
                    status === "done" || status === "today_done" ? styles.weekDotDone : null,
                    status === "missed" ? styles.weekDotMissed : null,
                    status === "inactive" ? styles.weekDotInactive : null,
                  ]}
                />
              )
            )}
          </View>
        </View>
      </Pressable>

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{getErrorMessage(error)}</Text>
          <Pressable onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <TwinPulse
        statusLine={twinStrip?.status_line}
        message={showTwinStrip ? twinStripMessage : null}
        userXpToday={twinStrip?.user_xp_today}
        twinXpToday={twinStrip?.twin_xp_today}
        hasTwin={twinStrip?.has_twin ?? false}
        onPress={openTwin}
        absenceDays={absenceDays}
        absenceMessage={twinStrip?.absence_strip_message}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: CONTENT_PADDING_BOTTOM }]}
        showsVerticalScrollIndicator={false}
        bounces={true}
        removeClippedSubviews={false}
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
            <View style={styles.heroFiguresRow}>
              <View style={styles.characterHero}>
                <Image
                  source={getCharacterImageSource(characterStage)}
                  style={styles.characterHeroImage}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              </View>
              {isPetUnlocked ? (
                <View
                  ref={petHeroBlockRef}
                  style={styles.heroPetBlock}
                  onLayout={updatePetDialogueMaxWidth}
                  collapsable={false}
                >
                  <View style={styles.heroPetColumn} pointerEvents="none">
                    <View style={[styles.heroPetSlot, { opacity: petAbsenceOpacity }]}>
                      <Image
                        source={getPetImageSource(petStage)}
                        style={styles.heroPetImage}
                        resizeMode="contain"
                        accessibilityIgnoresInvertColors
                      />
                    </View>
                  </View>
                  {petDialogueText ? (
                    <View style={styles.petDialogueOverlay} pointerEvents="none">
                      <PetDialogueBubble
                        visible={petDialogueVisible}
                        text={petDialogueText}
                        tailCenterFromRight={HERO_PET_SIZE / 2 + PET_DIALOGUE_TAIL_CENTER_NUDGE}
                        wrapBottom={PET_DIALOGUE_WRAP_BOTTOM}
                        maxWidth={petDialogueMaxWidth}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.xpWrap}>
            <View style={styles.xpLabelRow}>
              <Text style={styles.xpLabelLeft}>
                {surgeActive ? `✦ ${displayXP} XP · SURGE` : `✦ ${displayXP} XP`}
              </Text>
              <Text style={styles.xpLabelRight}>→ {nextStageLabel}</Text>
            </View>
            <XPProgressBar
              ref={xpBarRef}
              stageProgressPct={stageProgressPct}
              characterStage={characterStage}
              nextStageName={nextStageLabel}
              width={252}
              hideLabels
            />
          {isPetUnlocked && (
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

        {/* Season Banner — active season */}
        {currentSeason && currentSeason.status === "active" ? (
          <SeasonBanner
            season={currentSeason}
            onPress={() => {
              const parentNav = (navigation as any).getParent?.();
              const target = parentNav ?? navigation;
              target.navigate("SeasonDetail");
            }}
          />
        ) : null}

        {/* Season ended prompt */}
        {seasonEndedUnseen && currentSeason ? (
          <Pressable
            style={seasonEndedStyles.banner}
            onPress={() => {
              const parentNav = (navigation as any).getParent?.();
              const target = parentNav ?? navigation;
              target.navigate("SeasonCompletion");
            }}
          >
            <Text style={seasonEndedStyles.label}>
              {currentSeason.status === "failed" ? "⚠️" : "🏆"}
              {`  Season ${currentSeason.season_number} has ended`}
            </Text>
            <Text style={seasonEndedStyles.sub}>Tap to see your results →</Text>
          </Pressable>
        ) : null}

        {/* Empty state: missions being prepared */}
        {!isPending && !error && todayData && (todayData.summary?.total ?? 0) === 0 ? (
          <View style={styles.emptyMissionsWrap}>
            <Text style={styles.emptyMissionsText}>Your missions are being prepared…</Text>
          </View>
        ) : null}

        {/* 5–8. Mission sections — skeleton while first fetch (e.g. slow network after onboarding). */}
        {showMissionSkeletons ? <HomeMissionSectionsSkeleton /> : null}

        {/* 5–8. Mission sections — only when we have missions */}
        {todayData && (todayData.summary?.total ?? 0) > 0 ? (
        <>
        {returnState?.recovery_active === true && returnState.recovery_days_remaining > 0 ? (
          <RecoveryBanner
            daysRemaining={returnState.recovery_days_remaining}
            reason={
              profile?.return_reason &&
              ["life", "motivation", "forgot", "break", "unsure"].includes(profile.return_reason)
                ? profile.return_reason
                : "life"
            }
          />
        ) : null}
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
            {coreList.map((apiMission, i) => {
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
                    missionId={m.id}
                    onComplete={handleComplete}
                    onPress={() => openMissionDetail(apiMission)}
                    missionType={m.missionType}
                    missionStreak={m.missionStreak ?? 0}
                    appearIndex={i}
                    statKey={
                      parseStatTag(apiMission.stat_tag) ??
                      resolveStatKeyForMission("core", apiMission.core_pillar ?? null)
                    }
                    twinCompleted={apiMission.twin_completed === true}
                  />
                );
              })}
          </View>
        </View>

        {/* 6. Today's Focus (Interest) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <LinearGradient
                colors={[focusSectionScheme.primary, focusSectionScheme.deep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.sectionBarFocus}
              />
              <Text style={[styles.sectionTitle, { color: focusSectionScheme.primary }]}>
                TODAY&apos;S FOCUS
              </Text>
            </View>
            <Text style={styles.sectionFraction}>
              <Text style={styles.sectionFractionDone}>{interestMissions.filter((m) => m.status === "complete").length}</Text>
              /{interestMissions.length} done
            </Text>
          </View>
          <View style={styles.cards}>
            {(todayData?.missions?.interest ?? []).map((apiMission, i) => {
                const m = missionApiToCard(apiMission, "Interest");
                const iid = apiMission.interest_id ?? "";
                const accent =
                  iid && interestColorById[iid] ? interestColorById[iid] : undefined;
                return (
                  <HomeMissionCard
                    key={m.id}
                    title={m.title}
                    category={m.category}
                    difficulty={m.difficulty}
                    xpValue={m.xpValue}
                    petFoodValue={m.petFoodValue}
                    status={m.status}
                    missionId={m.id}
                    onComplete={handleComplete}
                    onPress={() => openMissionDetail(apiMission)}
                    missionType={m.missionType}
                    interestName={m.interestName}
                    missionStreak={m.missionStreak ?? 0}
                    appearIndex={i}
                    statKey={resolveStatKeyForMission("interest", apiMission.core_pillar ?? null)}
                    twinCompleted={apiMission.twin_completed === true}
                    accentColor={accent}
                  />
                );
              })}
          </View>
        </View>

        {/* 7. Resistance (Quit Target Missions) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <View style={styles.sectionBarResistance} />
              <Text
                style={[styles.sectionTitle, { color: QUIT_ORANGE.primary, fontSize: 13, fontWeight: "600" }]}
              >
                RESISTANCE
              </Text>
            </View>
            <Text style={styles.sectionFraction}>
              <Text style={styles.sectionFractionDone}>{resistanceMissions.filter((m) => m.status === "complete").length}</Text>
              /{resistanceMissions.length} done
            </Text>
          </View>
          <View style={styles.cards}>
            {resistanceList.map((apiMission, i) => {
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
                  missionId={m.id}
                  onComplete={handleComplete}
                  onPress={() => openMissionDetail(apiMission)}
                  missionType="resistance"
                  quitTargetName={m.quitTargetName}
                  dayCounter={m.dayCounter}
                  appearIndex={i}
                  statKey={
                    parseStatTag(apiMission.stat_tag) ??
                    resolveStatKeyForMission("resistance", apiMission.core_pillar ?? null)
                  }
                />
              );
            })}
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
            {personalList.map((apiMission, i) => {
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
                  missionId={m.id}
                  onComplete={handleComplete}
                  onPress={
                    m.status === "pending" ? () => openPersonalDeleteSheet(apiMission) : undefined
                  }
                  missionType={m.missionType}
                  missionStreak={m.missionStreak ?? 0}
                  appearIndex={i}
                  statKey={
                    parseStatTag(apiMission.stat_tag) ??
                    resolveStatKeyForMission("personal", apiMission.core_pillar ?? null)
                  }
                  twinCompleted={apiMission.twin_completed === true}
                />
              );
            })}
          </View>
          {showStartAnywhereHelper && (
            <Text style={styles.startAnywhereHelper}>Start anywhere. Every mission counts.</Text>
          )}

          {/* Add Personal Mission */}
          <Pressable style={styles.addPersonalButton} onPress={() => setAddModalVisible(true)}>
            <Text style={styles.addPersonalPlus}>+</Text>
            <Text style={styles.addPersonalLabel}>Add Personal Mission</Text>
          </Pressable>
          <WillpowerNudgeCard
            completedToday={missionsCompletedForNudge}
            totalMissionsToday={totalMissionsForNudge}
          />
        </View>
        </>
        ) : null}
      </ScrollView>

      {spToast ? (
        <SpGainToast
          key={spToast.k}
          gains={spToast.gains}
          footerNote={spToast.footerNote}
          onFinish={() => setSpToast(null)}
        />
      ) : null}

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
      <StageTwinMessageOverlay
        visible={stageTwinMsgVisible}
        stageName={stageTwinMsgStageName}
        onComplete={handleStageTwinMsgComplete}
      />
      <CharacterEvolutionOverlay
        visible={evolutionOverlayVisible}
        onClose={() => setEvolutionOverlayVisible(false)}
        stageName={evolutionStageName}
      />

      <PetEvolutionModal
        visible={
          !!petEvolutionData &&
          !stageTwinMsgVisible &&
          !evolutionOverlayVisible
        }
        petName={petEvolutionData?.new_pet_name ?? ""}
        onClose={() => setPetEvolutionData(null)}
      />

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
          onDismiss={dismissStreakOverlay}
        />
      ) : null}

      <AetherToast
        amount={aetherToastAmount}
        visible={aetherToastVisible}
        onDismiss={() => {
          setAetherToastVisible(false);
          setAetherToastAmount(0);
        }}
      />
      <SigilLevelUpOverlay payload={sigilLevelUp} onClose={() => setSigilLevelUp(null)} />

      <FractureOverlay
        visible={fractureVisible}
        streakCount={fractureStreakCount}
        archetype={profile?.archetype ?? ""}
        onDismiss={dismissFractureOverlay}
      />

      <SevenDayMirror
        visible={mirrorVisible}
        observations={mirrorData?.observations ?? []}
        closingLine={mirrorData?.closing_line ?? "I'll know more next week."}
        onDismiss={() => setMirrorDismissed(true)}
      />

      <AbsenceInterstitial
        visible={shouldShowAbsenceInterstitial}
        absenceDays={absenceDays}
        interstitialMessage={twinStrip?.absence_interstitial_message}
        accomplishments={twinStrip?.twin_accomplishments ?? []}
        isLongAbsence={returnState?.is_long_absence ?? absenceDays >= 14}
        longAbsenceMessage={returnState?.long_absence_message ?? null}
        shouldAskQuestion={
          returnState?.should_ask_question ?? absenceDays >= 7
        }
        onDismiss={() => setAbsenceInterstitialDismissed(true)}
        onLongAbsenceDismiss={handleLongAbsenceAck}
        onReasonSubmitted={() => {
          queryClient.invalidateQueries({ queryKey: ["twin", "strip"] });
          queryClient.invalidateQueries({ queryKey: ["return-state"] });
          void fetchProfile();
        }}
      />
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
    borderRadius: 10,
    backgroundColor: "#141824",
    borderWidth: 1.5,
    borderColor: "rgba(139,92,246,0.35)",
    shadowColor: "rgba(109,40,217,0.2)",
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
    overflow: "hidden",
  },
  avatarClip: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    overflow: "hidden",
  },
  avatarPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 15, fontWeight: "700", color: "rgba(139,92,246,0.8)" },
  avatarImg: { width: "100%", height: "100%" },
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
    borderWidth: 0,
    shadowColor: "rgba(249,115,22,0.45)",
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  /** Start of anchor day — orange ring only (nested; border-only is unreliable on RN). */
  weekDotTodayRingOuter: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: EMBER,
    alignItems: "center",
    justifyContent: "center",
  },
  weekDotTodayRingInner: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(12,10,20,0.98)",
  },
  /** Past day, streak not earned — empty (no orange). */
  weekDotMissed: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  /** Before account existed in week strip. */
  weekDotInactive: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
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
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    position: "relative",
    zIndex: 1,
    width: "100%",
  },
  heroFiguresRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 14,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    paddingLeft: 4,
    paddingRight: 8,
    transform: [{ translateX: -14 }],
    overflow: "visible",
    position: "relative",
  },
  /**
   * Fills heroPetBlock only (pet column width). Row uses justifyContent center; a full-row overlay
   * made right:0 the row edge, not the companion — tail pointed into empty margin.
   */
  petDialogueOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    overflow: "visible",
  },
  heroPetBlock: {
    width: HERO_PET_SIZE,
    minHeight: CHARACTER_HEIGHT,
    position: "relative",
    justifyContent: "flex-end",
    alignItems: "center",
    overflow: "visible",
    marginLeft: 2,
    marginBottom: HERO_PET_COLUMN_MARGIN_BOTTOM,
    zIndex: 4,
  },
  characterHero: {
    width: CHARACTER_WIDTH,
    height: CHARACTER_HEIGHT,
    overflow: "hidden",
    borderRadius: 20,
  },
  characterHeroImage: {
    width: "100%",
    height: "100%",
  },
  /** Pet + dialogue: overflow visible so wide bubble is not clipped by 76px slot */
  heroPetColumn: {
    width: HERO_PET_SIZE,
    overflow: "visible",
    alignItems: "center",
  },
  heroPetSlot: {
    width: HERO_PET_SIZE,
    height: HERO_PET_SIZE,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  heroPetImage: {
    width: HERO_PET_SIZE,
    height: HERO_PET_SIZE,
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
    backgroundColor: QUIT_ORANGE.primary,
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

const seasonEndedStyles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: "rgba(124,58,237,0.07)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.22)",
    borderRadius: 13,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#E8EAF0",
    marginBottom: 3,
  },
  sub: {
    fontSize: 11,
    color: "#8B8FA8",
  },
});
