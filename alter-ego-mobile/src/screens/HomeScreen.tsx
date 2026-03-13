/**
 * Home Screen — Screen 16 v1.1. Fetches real data from GET /home (character_state, pet_state, missions, twin strip).
 */

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RouteProp } from "@react-navigation/native";
import type { MainTabParamList } from "../navigation/types";
import { TopBar } from "../components/TopBar";
import { XPProgressBar, XPProgressBarRef } from "../components/XPProgressBar";
import { TwinAlertStrip } from "../components/TwinAlertStrip";
import { PetRoaming } from "../components/PetRoaming";
import MissionCard from "../components/MissionCard";
import type { MissionType, MissionStatus } from "../components/MissionCard";
import { SectionProgressRing } from "../components/SectionProgressRing";
import { AddMissionModal } from "../components/AddMissionModal";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, GRADIENTS } from "../constants/theme";
import { supabase } from "../utils/supabase";
import { getHome, completeMission, createMission, estimatePersonalTier, type MissionOut, type MissionCompleteOut } from "../utils/api";
import { CharacterEvolutionOverlay } from "../components/CharacterEvolutionOverlay";
import { MilestoneAchievementCard } from "../components/MilestoneAchievementCard";

const STAGE_NAMES = ["The Awakened", "The Focused", "The Burning", "The Relentless", "The Formidable", "The Sovereign"];

const TRIAL_START_KEY = "@alter_ego_trial_start_date";

const CHARACTER_WIDTH = 140;
const CHARACTER_HEIGHT = 180;
const PET_OFFSET = 8;
const PET_SIZE = 70;
const ROAMING_PET_SIZE = 80;
const HERO_HEIGHT = CHARACTER_HEIGHT + 8 + 20 + 8 + 16;
const SECTION_GAP = 24;
const CONTENT_PADDING_BOTTOM = 96;
/** Same significant gap as Twin Comparison (character zone below title bar). */
const HERO_TOP_GAP = 32;

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
};

function missionToCard(m: MissionOut): PlaceholderMission {
  return {
    id: m.id,
    title: m.title,
    category: m.type === "core" ? "Core" : m.type === "interest" ? (m.interest ?? "Interest") : "Personal",
    difficulty: m.difficulty as "Easy" | "Medium" | "Hard",
    xpValue: m.xp_value,
    petFoodValue: m.pet_food_value,
    status: m.completed_at ? ("complete" as const) : ("pending" as const),
    missionType: m.type as MissionType,
    interestName: m.interest ?? undefined,
    missionStreak: m.mission_streak ?? 0,
  };
}

/** Gap between journal FAB and the tab bar. Tab screen layout ends at top of tab bar, so bottom is relative to that. */
const JOURNAL_FAB_BOTTOM_GAP = 8;

export function HomeScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<MainTabParamList, "Home">>();
  const insets = useSafeAreaInsets();
  const xpBarRef = useRef<XPProgressBarRef>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayXP, setDisplayXP] = useState(0);
  const [nextStageXP, setNextStageXP] = useState(800);
  const [nextStageName, setNextStageName] = useState("The Focused");
  const [stageTitle, setStageTitle] = useState("The Awakened");
  const [coreMissions, setCoreMissions] = useState<PlaceholderMission[]>([]);
  const [interestMissions, setInterestMissions] = useState<PlaceholderMission[]>([]);
  const [personalMissions, setPersonalMissions] = useState<PlaceholderMission[]>([]);
  const [twinStripMessage, setTwinStripMessage] = useState<string | null>(null);
  const [petStage, setPetStage] = useState(0);
  const [petHealthState, setPetHealthState] = useState<string>("idle");
  const [powerScore, setPowerScore] = useState<number>(0);
  const [username, setUsername] = useState<string>("");
  const [evolutionOverlayVisible, setEvolutionOverlayVisible] = useState(false);
  const [evolutionStageName, setEvolutionStageName] = useState("The Focused");
  const [corePulseActive, setCorePulseActive] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [milestoneCard, setMilestoneCard] = useState<{
    interestName: string;
    milestoneNumber: number;
    milestoneName: string;
    twinCongratulation: string;
  } | null>(null);
  /** Content layout for pet roaming safe zone. */
  const [contentLayout, setContentLayout] = useState<{
    width: number;
    height: number;
  } | null>(null);
  /** Day 1–14: show "Start anywhere" helper when 0 completed today. Never shown after day 14. */
  const [isDay1To14, setIsDay1To14] = useState<boolean>(false);

  const fetchHome = useCallback(async () => {
    try {
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }
      const home = await getHome(session.access_token);
      const char = home.character_state;
      const pet = home.pet_state;
      setDisplayXP(char.total_xp);
      setNextStageXP(char.next_stage_xp);
      setNextStageName(char.next_stage_name);
      setStageTitle(STAGE_NAMES[Math.max(0, char.stage - 1)] ?? "The Awakened");
      setPetStage(pet.stage);
      setPetHealthState(pet.pet_health_state);
      setTwinStripMessage(home.twin_strip_message ?? null);
      const core = home.missions.filter((m) => m.type === "core").map(missionToCard);
      const interest = home.missions.filter((m) => m.type === "interest").map(missionToCard);
      const personal = home.missions.filter((m) => m.type === "personal").map(missionToCard);
      setCoreMissions(core);
      setInterestMissions(interest);
      setPersonalMissions(personal);
      setPowerScore(home.power_score ?? 0);
      setUsername(home.username ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load home");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchHome();
    }, [fetchHome])
  );

  useEffect(() => {
    (async () => {
      try {
        const today = new Date();
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().slice(0, 10);
        let stored = await AsyncStorage.getItem(TRIAL_START_KEY);
        if (!stored) {
          await AsyncStorage.setItem(TRIAL_START_KEY, todayDate);
          stored = todayDate;
        }
        const start = new Date(stored + "T00:00:00");
        const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const nowDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const diffMs = nowDate.getTime() - startDate.getTime();
        const dayNumber = Math.floor(diffMs / 86400000) + 1;
        setIsDay1To14(dayNumber >= 1 && dayNumber <= 14);
      } catch (_) {
        setIsDay1To14(false);
      }
    })();
  }, []);

  const windowHeight = Dimensions.get("window").height;
  const windowWidth = Dimensions.get("window").width;
  const TOP_BAR_HEIGHT = 56;
  const TAB_BAR_HEIGHT = 56;
  /** Pet roams only in the visible viewport (not the scrollable content height). */
  const viewportHeight = Math.max(0, windowHeight - insets.top - TOP_BAR_HEIGHT - TAB_BAR_HEIGHT);
  const heroX =
    (windowWidth - (CHARACTER_WIDTH + PET_OFFSET + ROAMING_PET_SIZE)) / 2 +
    CHARACTER_WIDTH +
    PET_OFFSET;
  const heroY = HERO_TOP_GAP + 4 + CHARACTER_HEIGHT / 2 - ROAMING_PET_SIZE / 2;

  const completedToday =
    coreMissions.filter((m) => m.status === "complete").length +
    interestMissions.filter((m) => m.status === "complete").length +
    personalMissions.filter((m) => m.status === "complete").length;
  const showStartAnywhereHelper = completedToday === 0 && isDay1To14;

  const triggerXpBarAnimation = () => {
    setTimeout(() => xpBarRef.current?.animateXpGain(), 0);
  };

  const applyCompleteResponse = (res: MissionCompleteOut) => {
    const char = res.character_state;
    const pet = res.pet_state;
    setDisplayXP(char.total_xp);
    setNextStageXP(char.next_stage_xp);
    setNextStageName(char.next_stage_name);
    setStageTitle(STAGE_NAMES[Math.max(0, char.stage - 1)] ?? "The Awakened");
    setPetStage(pet.stage);
    setPetHealthState(pet.pet_health_state);
    if (res.twin_strip_message != null) setTwinStripMessage(res.twin_strip_message);
    if (res.stage_up) {
      setEvolutionStageName(STAGE_NAMES[Math.max(0, char.stage - 1)] ?? "The Focused");
      setEvolutionOverlayVisible(true);
    }
    if (res.earned_milestone) {
      setMilestoneCard({
        interestName: res.earned_milestone.interest,
        milestoneNumber: res.earned_milestone.milestone_number,
        milestoneName: res.earned_milestone.milestone_name,
        twinCongratulation: res.earned_milestone.twin_congratulation,
      });
    }
  };

  const completeMissionAndSync = async (id: string, mission: PlaceholderMission) => {
    setDisplayXP((prev) => prev + mission.xpValue);
    triggerXpBarAnimation();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      try {
        const res = await completeMission(session.access_token, id);
        applyCompleteResponse(res);
      } catch (_) {
        setDisplayXP((prev) => prev - mission.xpValue);
      }
    }
  };

  const handleCompleteCore = (id: string) => {
    const mission = coreMissions.find((m) => m.id === id);
    if (mission) {
      const coreCompletedBefore = coreMissions.filter((m) => m.status === "complete").length;
      setCoreMissions((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "complete" as const } : m))
      );
      if (coreCompletedBefore === 2) setCorePulseActive(true);
      completeMissionAndSync(id, mission);
    }
  };
  const handleCompleteInterest = (id: string) => {
    const mission = interestMissions.find((m) => m.id === id);
    if (mission) {
      setInterestMissions((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "complete" as const } : m))
      );
      completeMissionAndSync(id, mission);
    }
  };
  const handleCompletePersonal = (id: string) => {
    const mission = personalMissions.find((m) => m.id === id);
    if (mission) {
      setPersonalMissions((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "complete" as const } : m))
      );
      completeMissionAndSync(id, mission);
    }
  };

  const handleAddMission = async (title: string, difficulty: "Easy" | "Medium" | "Hard") => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not signed in");
    const mission = await createMission(session.access_token, { title, difficulty, type: "personal" });
    setPersonalMissions((prev) => [...prev, missionToCard(mission)]);
  };

  const handleSuggestTier = async (title: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    return estimatePersonalTier(session.access_token, title);
  };

  const openTwin = () => {
    navigation.navigate("Twin");
  };

  useFocusEffect(
    useCallback(() => {
      if (route.params?.journalJustCompleted) {
        navigation.setParams({ journalJustCompleted: undefined });
        fetchHome();
      }
    }, [route.params?.journalJustCompleted, fetchHome, navigation])
  );

  useEffect(() => {
    if (!corePulseActive) return;
    const t = setTimeout(() => setCorePulseActive(false), 600);
    return () => clearTimeout(t);
  }, [corePulseActive]);


  if (loading) {
    return (
      <LinearGradient
        colors={GRADIENTS.background.colors}
        start={GRADIENTS.background.start}
        end={GRADIENTS.background.end}
        style={[styles.container, styles.centered]}
      >
        <ActivityIndicator size="large" color={COLORS.violet} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={GRADIENTS.background.colors}
      start={GRADIENTS.background.start}
      end={GRADIENTS.background.end}
      style={styles.container}
    >
      <TopBar
        username={username || "—"}
        stageTitle={stageTitle}
        powerScore={powerScore}
      />
      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => { setLoading(true); fetchHome(); }} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.scrollWrapper}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: CONTENT_PADDING_BOTTOM, minHeight: windowHeight },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
        <View
          style={styles.contentWrap}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setContentLayout((prev) =>
              prev?.width === width && prev?.height === height
                ? prev
                : { width, height }
            );
          }}
        >
        {/* Zone 1: Hero — pet roams from here; placeholder keeps layout. Core completion pulse when all 3 Core done. */}
        <View style={[styles.hero, { marginTop: HERO_TOP_GAP }]}>
          <View style={styles.heroRow}>
            <View style={styles.characterWrap}>
              <View style={styles.characterPlaceholder} />
              {corePulseActive && <View style={styles.corePulse} />}
            </View>
            <View style={[styles.petWrap, styles.petPlaceholder]} />
          </View>
          <View style={styles.xpWrap}>
            <XPProgressBar
              ref={xpBarRef}
              currentXP={displayXP}
              nextStageXP={nextStageXP}
              nextStageName={nextStageName}
            />
          </View>
        </View>

        {/* Zone 2: Twin Alert Strip (16px below XP bar) */}
        <View style={styles.twinStripWrap}>
          <TwinAlertStrip
            message={twinStripMessage ?? "Your rival is you — one week ahead."}
            hasNewMessage={false}
            onPress={openTwin}
          />
        </View>

        {/* Zone 3: Missions — adaptability copy: "Start anywhere" when 0 done, "Today's Missions" after first (CLAUDE §9) */}
        <View style={styles.sections}>
          <Text style={styles.sectionTitle}>
            {completedToday === 0 ? "Start anywhere." : "Today's Missions"}
          </Text>
          {/* CORE */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeader, styles.coreHeader]}>CORE</Text>
              <View style={styles.sectionHeaderRing}>
                <SectionProgressRing
                  completed={coreMissions.filter((m) => m.status === "complete").length}
                  total={coreMissions.length}
                  variant="core"
                />
              </View>
            </View>
            <View style={styles.cards}>
              {coreMissions.map((m, i) => (
                <MissionCard
                  key={m.id}
                  title={m.title}
                  category={m.category}
                  difficulty={m.difficulty}
                  xpValue={m.xpValue}
                  petFoodValue={m.petFoodValue}
                  status={m.status}
                  onComplete={() => handleCompleteCore(m.id)}
                  missionType={m.missionType}
                  missionStreak={m.missionStreak ?? 0}
                  appearIndex={i}
                />
              ))}
            </View>
          </View>

          {/* TODAY'S FOCUS — schedule edited in Profile → Interests */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeader, styles.focusHeader]}>TODAY'S FOCUS</Text>
              <View style={styles.sectionHeaderRing}>
                <SectionProgressRing
                  completed={interestMissions.filter((m) => m.status === "complete").length}
                  total={interestMissions.length}
                  variant="interest"
                />
              </View>
            </View>
            <View style={styles.cards}>
              {interestMissions.map((m, i) => (
                <MissionCard
                  key={m.id}
                  title={m.title}
                  category={m.category}
                  difficulty={m.difficulty}
                  xpValue={m.xpValue}
                  petFoodValue={m.petFoodValue}
                  status={m.status}
                  onComplete={() => handleCompleteInterest(m.id)}
                  missionType={m.missionType}
                  interestName={m.interestName}
                  missionStreak={m.missionStreak ?? 0}
                  appearIndex={i}
                />
              ))}
            </View>
          </View>

          {/* PERSONAL */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeader, styles.personalHeader]}>PERSONAL</Text>
              <View style={styles.sectionHeaderRight}>
                <View style={styles.sectionHeaderRing}>
                  <SectionProgressRing
                    completed={personalMissions.filter((m) => m.status === "complete").length}
                    total={personalMissions.length}
                    variant="personal"
                  />
                </View>
                <Pressable
                  style={styles.addLink}
                  onPress={() => setAddModalVisible(true)}
                  hitSlop={8}
                >
                  <Text style={styles.addLinkText}>+ Add</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.cards}>
              {personalMissions.map((m, i) => (
                <MissionCard
                  key={m.id}
                  title={m.title}
                  category={m.category}
                  difficulty={m.difficulty}
                  xpValue={m.xpValue}
                  petFoodValue={m.petFoodValue}
                  status={m.status}
                  onComplete={() => handleCompletePersonal(m.id)}
                  missionType={m.missionType}
                  missionStreak={m.missionStreak ?? 0}
                  appearIndex={i}
                />
              ))}
            </View>
            {showStartAnywhereHelper && (
              <Text style={styles.startAnywhereHelper}>
                Start anywhere. Every mission counts.
              </Text>
            )}
          </View>
        </View>

        </View>
        </ScrollView>
      </View>

      {/* Pet roams in visible viewport only (fixed overlay), not in scroll content */}
      {viewportHeight > 0 && windowWidth > 0 && petStage >= 1 && (
        <View
          style={[
            styles.petViewportOverlay,
            {
              top: insets.top + TOP_BAR_HEIGHT,
              width: windowWidth,
              height: viewportHeight,
            },
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

      <Pressable
        style={[styles.journalFab, { bottom: JOURNAL_FAB_BOTTOM_GAP }]}
        onPress={() => (navigation as any).navigate("JournalList")}
      >
        <Ionicons name="book-outline" size={24} color="#FFFFFF" />
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  errorWrap: {
    paddingHorizontal: SPACING.screenPadding,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.text2,
    flex: 1,
  },
  retryButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.violet,
    borderRadius: 10,
  },
  retryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: COLORS.text,
  },
  scrollWrapper: {
    flex: 1,
    minHeight: 0,
  },
  scrollWrapperShrink: {
    flex: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.screenPadding,
    flexGrow: 1,
  },
  contentWrap: {
    flex: 1,
    minHeight: 0,
    position: "relative",
  },
  petViewportOverlay: {
    position: "absolute",
    left: 0,
    zIndex: 10,
  },
  hero: {
    height: HERO_HEIGHT,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 4,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  characterWrap: {
    position: "relative",
  },
  characterPlaceholder: {
    width: CHARACTER_WIDTH,
    height: CHARACTER_HEIGHT,
    backgroundColor: COLORS.violetDeep,
    opacity: 0.8,
    borderRadius: 8,
  },
  corePulse: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.violet,
    backgroundColor: "transparent",
  },
  petWrap: {
    marginLeft: PET_OFFSET,
  },
  petPlaceholder: {
    width: ROAMING_PET_SIZE,
    height: ROAMING_PET_SIZE,
  },
  xpWrap: {
    marginTop: 8,
    alignItems: "center",
  },
  twinStripWrap: {
    marginTop: 16,
    marginHorizontal: -SPACING.screenPadding,
  },
  sections: {
    marginTop: SECTION_GAP,
  },
  section: {
    marginBottom: SECTION_GAP,
  },
  sectionTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: SPACING.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionHeader: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
    paddingHorizontal: 0,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
    paddingHorizontal: 0,
  },
  sectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  sectionHeaderRing: {
    marginLeft: SPACING.sm,
  },
  coreHeader: {
    color: COLORS.core,
  },
  focusHeader: {
    color: COLORS.violet,
  },
  personalHeader: {
    color: COLORS.muted,
  },
  startAnywhereHelper: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    fontStyle: "italic",
    color: COLORS.muted,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  addLink: {
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 8,
  },
  addLinkText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.violet,
  },
  cards: {
    gap: SPACING.cardGap,
  },
  journalFab: {
    position: "absolute",
    right: SPACING.screenPadding,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.violet,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "ios" ? { shadowColor: COLORS.violet, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8 } : { elevation: 8 }),
  },
});
