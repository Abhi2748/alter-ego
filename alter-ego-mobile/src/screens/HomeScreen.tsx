/**
 * Home Screen — Premium dark cinematic layout.
 * Top bar (avatar + greeting), streak strip, hero zone, twin alert, Core / Today's Focus / Personal sections.
 * Mission completion logic, pet roaming, XP, journal FAB unchanged.
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
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RouteProp } from "@react-navigation/native";
import type { MainTabParamList } from "../navigation/types";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { XPProgressBar, XPProgressBarRef } from "../components/XPProgressBar";
import { PetRoaming } from "../components/PetRoaming";
import { HomeMissionCard } from "../components/HomeMissionCard";
import type { MissionType, MissionStatus } from "../components/MissionCard";
import { AddMissionModal } from "../components/AddMissionModal";
import { CharacterEvolutionOverlay } from "../components/CharacterEvolutionOverlay";
import { MilestoneAchievementCard } from "../components/MilestoneAchievementCard";
import { supabase } from "../utils/supabase";
import {
  getHome,
  completeMission,
  createMission,
  estimatePersonalTier,
  type MissionOut,
  type MissionCompleteOut,
} from "../utils/api";

const STAGE_NAMES = ["The Awakened", "The Focused", "The Burning", "The Relentless", "The Formidable", "The Sovereign"];
const TRIAL_START_KEY = "@alter_ego_trial_start_date";

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

const RESISTANCE_PLACEHOLDER_MISSIONS: PlaceholderMission[] = [
  {
    id: "res-1",
    title: "Put your phone on the charger in another room before 10pm",
    category: "Resistance",
    difficulty: "Medium",
    xpValue: 20,
    petFoodValue: 16,
    status: "pending",
    missionType: "resistance",
    quitTargetName: "Social Media",
    dayCounter: 23,
  },
  {
    id: "res-2",
    title: "Drink a glass of water and do 10 pushups when the craving hits",
    category: "Resistance",
    difficulty: "Easy",
    xpValue: 10,
    petFoodValue: 8,
    status: "pending",
    missionType: "resistance",
    quitTargetName: "Junk Food",
    dayCounter: 5,
  },
];

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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning 👋";
  if (h >= 12 && h < 17) return "Good afternoon 👋";
  if (h >= 17 && h < 21) return "Good evening 👋";
  return "Good night 🌙";
}

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayXP, setDisplayXP] = useState(0);
  const [nextStageXP, setNextStageXP] = useState(800);
  const [nextStageName, setNextStageName] = useState("The Focused");
  const [stageTitle, setStageTitle] = useState("The Awakened");
  const [characterStage, setCharacterStage] = useState(1);
  const [characterGender, setCharacterGender] = useState<string>("male");
  const [coreMissions, setCoreMissions] = useState<PlaceholderMission[]>([]);
  const [interestMissions, setInterestMissions] = useState<PlaceholderMission[]>([]);
  const [personalMissions, setPersonalMissions] = useState<PlaceholderMission[]>([]);
  const [resistanceMissions] = useState<PlaceholderMission[]>(RESISTANCE_PLACEHOLDER_MISSIONS);
  const [twinStripMessage, setTwinStripMessage] = useState<string | null>(null);
  const [petStage, setPetStage] = useState(0);
  const [petHealthState, setPetHealthState] = useState<string>("idle");
  const [streak, setStreak] = useState(0);
  const [weekDots, setWeekDots] = useState<boolean[]>([false, false, false, false, false, false, false]);
  const [evolutionOverlayVisible, setEvolutionOverlayVisible] = useState(false);
  const [evolutionStageName, setEvolutionStageName] = useState("The Focused");
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [milestoneCard, setMilestoneCard] = useState<{
    interestName: string;
    milestoneNumber: number;
    milestoneName: string;
    twinCongratulation: string;
  } | null>(null);
  const [isDay1To14, setIsDay1To14] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);

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
      setCharacterStage(char.stage);
      setCharacterGender(char.gender ?? "male");
      setPetStage(pet.stage);
      setPetHealthState(pet.pet_health_state);
      setTwinStripMessage(home.twin_strip_message ?? null);
      setStreak(home.streak ?? 0);
      setWeekDots(home.week_dots ?? [false, false, false, false, false, false, false]);
      const core = home.missions.filter((m) => m.type === "core").map(missionToCard);
      const interest = home.missions.filter((m) => m.type === "interest").map(missionToCard);
      const personal = home.missions.filter((m) => m.type === "personal").map(missionToCard);
      setCoreMissions(core);
      setInterestMissions(interest);
      setPersonalMissions(personal);
      setUsername(home.username ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load home");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchHome(); }, [fetchHome]));

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
    setCharacterStage(char.stage);
    setCharacterGender(char.gender ?? "male");
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
      setCoreMissions((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "complete" as const } : m))
      );
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

  const openTwin = () => navigation.navigate("Twin");

  useFocusEffect(
    useCallback(() => {
      if (route.params?.journalJustCompleted) {
        navigation.setParams({ journalJustCompleted: undefined });
        fetchHome();
      }
    }, [route.params?.journalJustCompleted, fetchHome, navigation])
  );

  if (loading) {
    return (
      <LinearGradient colors={BG_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={VIOLET} />
      </LinearGradient>
    );
  }

  const greeting = getGreeting();
  const todayDotIndex = new Date().getDay();
  const monBased = todayDotIndex === 0 ? 6 : todayDotIndex - 1;

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
            {weekDots.map((done, i) => (
              <View
                key={i}
                style={[
                  styles.weekDot,
                  done && styles.weekDotDone,
                  i === monBased && styles.weekDotToday,
                ]}
              />
            ))}
          </View>
        </View>
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => { setLoading(true); fetchHome(); }} style={styles.retryButton}>
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
          </View>
        </View>

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
            {twinStripMessage ?? "Your rival is you — one week ahead."}
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#374151" />
        </Pressable>

        {/* 5. Core section */}
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
            {coreMissions.map((m, i) => (
              <HomeMissionCard
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
            {interestMissions.map((m, i) => (
              <HomeMissionCard
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
            {resistanceMissions.map((m, i) => (
              <HomeMissionCard
                key={m.id}
                title={m.title}
                category={m.category}
                difficulty={m.difficulty}
                xpValue={m.xpValue}
                petFoodValue={m.petFoodValue}
                status={m.status}
                onComplete={() => {}}
                missionType="resistance"
                quitTargetName={m.quitTargetName}
                dayCounter={m.dayCounter}
                appearIndex={i}
              />
            ))}
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
            {personalMissions.map((m, i) => (
              <HomeMissionCard
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
            <Text style={styles.startAnywhereHelper}>Start anywhere. Every mission counts.</Text>
          )}

          {/* Add Personal Mission */}
          <Pressable style={styles.addPersonalButton} onPress={() => setAddModalVisible(true)}>
            <Text style={styles.addPersonalPlus}>+</Text>
            <Text style={styles.addPersonalLabel}>Add Personal Mission</Text>
          </Pressable>
        </View>
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
    backgroundColor: "rgba(249,115,22,0.4)",
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
