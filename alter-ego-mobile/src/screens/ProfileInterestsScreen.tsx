/**
 * Profile → Interests. YOUR INTERESTS list: name, L[N] + Twin L[N+1], XP bar (within level), active days.
 * Long-press → confirm Remove. "+ Add Interest". MILESTONES section.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  COLORS,
  SPACING,
  GRADIENTS,
  RADIUS,
} from "../constants/theme";
import { SecondaryButton } from "../components/SecondaryButton";
import { InterestSchedulePickerModal } from "../components/InterestSchedulePickerModal";
import { AddInterestModal } from "../components/AddInterestModal";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Interest level XP thresholds L1..L10 (CLAUDE §9). */
const INTEREST_LEVEL_THRESHOLDS = [
  0, 200, 600, 1400, 3000, 6000, 11000, 18000, 28000, 42000,
];

function getLevelAndProgress(
  totalXp: number
): { level: number; progressInLevel: number } {
  let level = 1;
  for (let i = 1; i < 10; i++) {
    if (totalXp >= INTEREST_LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  if (level >= 10) return { level: 10, progressInLevel: 1 };
  const low = INTEREST_LEVEL_THRESHOLDS[level - 1];
  const high = INTEREST_LEVEL_THRESHOLDS[level];
  const progressInLevel =
    high > low ? (totalXp - low) / (high - low) : 0;
  return { level, progressInLevel };
}

export interface InterestItem {
  id: string;
  name: string;
  totalXp: number;
  schedule: number[];
}

/** Placeholder: L2 40% (360 XP), L1 15% (30 XP). */
const PLACEHOLDER_INTERESTS: InterestItem[] = [
  { id: "1", name: "Fitness", totalXp: 360, schedule: [0, 2, 4] },
  { id: "2", name: "Reading", totalXp: 30, schedule: [1, 3, 5] },
];

function formatActiveDays(schedule: number[]): string {
  if (schedule.length === 0) return "No days set";
  return schedule.map((i) => DAY_LABELS[i]).join(" · ");
}

const BAR_HEIGHT = 8;
const BAR_RADIUS = 8;

function InterestXpBar({ progress }: { progress: number }) {
  const fillWidth = Math.min(1, Math.max(0, progress));
  return (
    <View style={styles.xpBarTrack}>
      <View style={[styles.xpBarFillWrap, { width: `${fillWidth * 100}%` }]}>
        <LinearGradient
          colors={GRADIENTS.xpBar.colors}
          start={GRADIENTS.xpBar.start}
          end={GRADIENTS.xpBar.end}
          style={styles.xpBarFill}
        />
      </View>
    </View>
  );
}

export function ProfileInterestsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [interests, setInterests] = useState<InterestItem[]>(PLACEHOLDER_INTERESTS);
  const [scheduleModalInterest, setScheduleModalInterest] =
    useState<InterestItem | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);

  const openSchedule = useCallback((interest: InterestItem) => {
    setScheduleModalInterest(interest);
  }, []);

  const closeScheduleModal = useCallback(() => {
    setScheduleModalInterest(null);
  }, []);

  const handleSaveSchedule = useCallback(
    (interestId: string, schedule: number[]) => {
      setInterests((prev) =>
        prev.map((i) => (i.id === interestId ? { ...i, schedule } : i))
      );
      setScheduleModalInterest(null);
    },
    []
  );

  const handleLongPressRemove = useCallback((interest: InterestItem) => {
    Alert.alert(
      "Remove interest",
      `Remove "${interest.name}"? You can add it again later.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            setInterests((prev) => prev.filter((i) => i.id !== interest.id)),
        },
      ]
    );
  }, []);

  const handleAddInterest = useCallback(() => {
    setAddModalVisible(true);
  }, []);

  const handleConfirmAddInterest = useCallback((name: string) => {
    const newInterest: InterestItem = {
      id: String(Date.now()),
      name,
      totalXp: 0,
      schedule: [],
    };
    setInterests((prev) => [...prev, newInterest]);
    setAddModalVisible(false);
    setScheduleModalInterest(newInterest);
  }, []);

  return (
    <LinearGradient
      colors={GRADIENTS.background.colors}
      start={GRADIENTS.background.start}
      end={GRADIENTS.background.end}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Interests</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + SPACING.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeader}>YOUR INTERESTS</Text>

        {interests.map((interest) => {
          const { level, progressInLevel } = getLevelAndProgress(interest.totalXp);
          const isL10 = level === 10;

          return (
            <Pressable
              key={interest.id}
              onLongPress={() => handleLongPressRemove(interest)}
              delayLongPress={400}
              style={styles.interestRow}
            >
              <View style={styles.interestTopRow}>
                <Text style={styles.interestName} numberOfLines={1}>
                  {interest.name}
                </Text>
                <View
                  style={[
                    styles.levelBadge,
                    isL10 && styles.levelBadgeGolden,
                  ]}
                >
                  <Text style={styles.levelBadgeText}>L{level}</Text>
                </View>
              </View>

              <View style={styles.xpBarWrap}>
                <InterestXpBar progress={progressInLevel} />
              </View>

              <Pressable
                onPress={() => openSchedule(interest)}
                style={styles.activeDaysWrap}
                hitSlop={8}
              >
                <Text style={styles.activeDaysText} numberOfLines={1}>
                  {formatActiveDays(interest.schedule)}
                </Text>
              </Pressable>
            </Pressable>
          );
        })}

        <View style={styles.addButtonWrap}>
          <SecondaryButton
            label="+ Add Interest"
            onPress={handleAddInterest}
            style={styles.addButton}
          />
        </View>

        <View style={styles.milestonesSection}>
          <Text style={styles.milestonesHeader}>MILESTONES</Text>
          <View style={styles.milestoneCards}>
            <View style={styles.milestoneCard}>
              <Text style={styles.milestoneTitle}>First session</Text>
              <Text style={styles.milestoneSub}>Complete 1 session</Text>
            </View>
            <View style={styles.milestoneCard}>
              <Text style={styles.milestoneTitle}>Level 3</Text>
              <Text style={styles.milestoneSub}>Reach 600 XP in an interest</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <InterestSchedulePickerModal
        visible={!!scheduleModalInterest}
        onClose={closeScheduleModal}
        interestName={scheduleModalInterest?.name ?? ""}
        currentSchedule={scheduleModalInterest?.schedule ?? []}
        onSave={(schedule) => {
          if (scheduleModalInterest)
            handleSaveSchedule(scheduleModalInterest.id, schedule);
        }}
      />
      <AddInterestModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAdd={handleConfirmAddInterest}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { marginRight: SPACING.sm },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: COLORS.text,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: SPACING.lg,
  },
  sectionHeader: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  interestRow: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: SPACING.cardPadding,
    marginBottom: SPACING.cardGap,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  interestTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  interestName: {
    flex: 1,
    minWidth: 0,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(139,92,246,0.15)",
    borderWidth: 1,
    borderColor: COLORS.violet,
  },
  levelBadgeGolden: {
    borderColor: "#F59E0B",
    borderWidth: 1.5,
  },
  levelBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.violet,
  },
  xpBarWrap: {
    marginBottom: SPACING.sm,
  },
  xpBarTrack: {
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    backgroundColor: COLORS.surface2,
    overflow: "hidden",
  },
  xpBarFillWrap: {
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#8B5CF6",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 6,
        }
      : { elevation: 6 }),
  },
  xpBarFill: {
    width: "100%",
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
  },
  activeDaysWrap: {
    alignSelf: "flex-start",
  },
  activeDaysText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.muted,
  },
  addButtonWrap: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
    alignItems: "center",
  },
  addButton: {
    alignSelf: "center",
    minWidth: 200,
  },
  milestonesSection: {
    marginTop: SPACING.md,
  },
  milestonesHeader: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  milestoneCards: {
    gap: SPACING.cardGap,
  },
  milestoneCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: SPACING.cardPadding,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.cardGap,
  },
  milestoneTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: COLORS.text,
  },
  milestoneSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 4,
  },
});
