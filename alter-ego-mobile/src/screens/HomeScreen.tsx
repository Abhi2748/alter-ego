/**
 * Home Screen — Screen 16 v1.1. TopBar + Hero + Twin Strip + Core / Today's Focus / Personal missions.
 */

import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { TopBar } from "../components/TopBar";
import { XPProgressBar, XPProgressBarRef } from "../components/XPProgressBar";
import { TwinAlertStrip } from "../components/TwinAlertStrip";
import { PetAnimation } from "../components/PetAnimation";
import MissionCard from "../components/MissionCard";
import type { MissionType, MissionStatus } from "../components/MissionCard";
import { AddMissionModal } from "../components/AddMissionModal";
import { COLORS, SPACING, GRADIENTS } from "../constants/theme";

const CHARACTER_WIDTH = 140;
const CHARACTER_HEIGHT = 180;
const PET_OFFSET = 8;
const PET_SIZE = 70;
const HERO_HEIGHT = CHARACTER_HEIGHT + 8 + 20 + 8 + 16;
const SECTION_GAP = 24;
const CONTENT_PADDING_BOTTOM = 96;

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
};

const CORE_MISSIONS: PlaceholderMission[] = [
  {
    id: "core-1",
    title: "Daily Journal",
    category: "Core",
    difficulty: "Easy",
    xpValue: 50,
    petFoodValue: 10,
    status: "pending",
    missionType: "core",
  },
  {
    id: "core-2",
    title: "Drink 2L water",
    category: "Core",
    difficulty: "Easy",
    xpValue: 50,
    petFoodValue: 10,
    status: "pending",
    missionType: "core",
  },
];

const INTEREST_MISSIONS: PlaceholderMission[] = [
  {
    id: "int-1",
    title: "30 min workout",
    category: "Fitness",
    difficulty: "Medium",
    xpValue: 100,
    petFoodValue: 20,
    status: "pending",
    missionType: "interest",
    interestName: "Fitness",
  },
  {
    id: "int-2",
    title: "Stretch routine",
    category: "Fitness",
    difficulty: "Medium",
    xpValue: 100,
    petFoodValue: 20,
    status: "pending",
    missionType: "interest",
    interestName: "Fitness",
  },
];

const PERSONAL_INITIAL: PlaceholderMission[] = [
  {
    id: "per-1",
    title: "Read for 20 minutes",
    category: "Personal",
    difficulty: "Easy",
    xpValue: 50,
    petFoodValue: 10,
    status: "pending",
    missionType: "personal",
  },
];

const INITIAL_DISPLAY_XP = 3240;

export function HomeScreen() {
  const navigation = useNavigation();
  const xpBarRef = useRef<XPProgressBarRef>(null);

  const [displayXP, setDisplayXP] = useState(INITIAL_DISPLAY_XP);
  const [coreMissions, setCoreMissions] = useState(CORE_MISSIONS);
  const [interestMissions, setInterestMissions] = useState(INTEREST_MISSIONS);
  const [personalMissions, setPersonalMissions] = useState(PERSONAL_INITIAL);
  const [addModalVisible, setAddModalVisible] = useState(false);

  const triggerXpBarAnimation = () => {
    setTimeout(() => xpBarRef.current?.animateXpGain(), 0);
  };

  const handleCompleteCore = (id: string) => {
    const mission = coreMissions.find((m) => m.id === id);
    if (mission) setDisplayXP((prev) => prev + mission.xpValue);
    setCoreMissions((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "complete" as MissionStatus } : m))
    );
    triggerXpBarAnimation();
  };
  const handleCompleteInterest = (id: string) => {
    const mission = interestMissions.find((m) => m.id === id);
    if (mission) setDisplayXP((prev) => prev + mission.xpValue);
    setInterestMissions((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "complete" as MissionStatus } : m))
    );
    triggerXpBarAnimation();
  };
  const handleCompletePersonal = (id: string) => {
    const mission = personalMissions.find((m) => m.id === id);
    if (mission) setDisplayXP((prev) => prev + mission.xpValue);
    setPersonalMissions((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "complete" as MissionStatus } : m))
    );
    triggerXpBarAnimation();
  };

  const handleAddMission = (title: string, difficulty: "Easy" | "Medium" | "Hard") => {
    setPersonalMissions((prev) => [
      ...prev,
      {
        id: `per-${Date.now()}`,
        title,
        category: "Personal",
        difficulty,
        xpValue: difficulty === "Easy" ? 50 : difficulty === "Medium" ? 100 : 200,
        petFoodValue: difficulty === "Easy" ? 10 : difficulty === "Medium" ? 20 : 40,
        status: "pending",
        missionType: "personal",
      },
    ]);
  };

  const openTwin = () => {
    navigation.navigate("Twin");
  };

  return (
    <LinearGradient
      colors={GRADIENTS.background.colors}
      start={GRADIENTS.background.start}
      end={GRADIENTS.background.end}
      style={styles.container}
    >
      <TopBar
        username="shadow_wolf_77"
        stageTitle="The Awakened"
        powerScore={1240}
      />
      <View style={styles.scrollWrapper}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: CONTENT_PADDING_BOTTOM },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
        {/* Zone 1: Hero (220px) */}
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.characterPlaceholder} />
            <View style={styles.petWrap}>
              <PetAnimation stage={1} isHappy={true} size={PET_SIZE} />
            </View>
          </View>
          <View style={styles.xpWrap}>
            <XPProgressBar
              ref={xpBarRef}
              currentXP={displayXP}
              nextStageXP={10000}
              nextStageName="The Focused"
            />
          </View>
        </View>

        {/* Zone 2: Twin Alert Strip (16px below XP bar) */}
        <View style={styles.twinStripWrap}>
          <TwinAlertStrip
            message="You hesitated yesterday. I didn't."
            hasNewMessage={false}
            onPress={openTwin}
          />
        </View>

        {/* Zone 3: Missions */}
        <View style={styles.sections}>
          {/* CORE */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, styles.coreHeader]}>CORE</Text>
            <View style={styles.cards}>
              {coreMissions.map((m) => (
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
                />
              ))}
            </View>
          </View>

          {/* TODAY'S FOCUS */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeader, styles.focusHeader]}>TODAY'S FOCUS</Text>
              <Pressable
                style={styles.scheduleLink}
                onPress={() => {}}
                hitSlop={8}
              >
                <Text style={styles.scheduleLinkText}>Schedule</Text>
              </Pressable>
            </View>
            <View style={styles.cards}>
              {interestMissions.map((m) => (
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
                />
              ))}
            </View>
          </View>

          {/* PERSONAL */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeader, styles.personalHeader]}>PERSONAL</Text>
              <Pressable
                style={styles.addLink}
                onPress={() => setAddModalVisible(true)}
                hitSlop={8}
              >
                <Text style={styles.addLinkText}>+ Add</Text>
              </Pressable>
            </View>
            <View style={styles.cards}>
              {personalMissions.map((m) => (
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
                />
              ))}
            </View>
          </View>
        </View>
        </ScrollView>
      </View>

      <AddMissionModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAdd={handleAddMission}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollWrapper: {
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.screenPadding,
    flexGrow: 1,
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
  characterPlaceholder: {
    width: CHARACTER_WIDTH,
    height: CHARACTER_HEIGHT,
    backgroundColor: COLORS.violetDeep,
    opacity: 0.8,
    borderRadius: 8,
  },
  petWrap: {
    marginLeft: PET_OFFSET,
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
  coreHeader: {
    color: COLORS.core,
  },
  focusHeader: {
    color: COLORS.violet,
  },
  personalHeader: {
    color: COLORS.muted,
  },
  scheduleLink: {
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 8,
  },
  scheduleLinkText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.violet,
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
});
