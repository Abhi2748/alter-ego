/**
 * Profile → Interests. ScrollView: each interest (name, L[N] badge, XP bar §2.5 inside card,
 * active days tappable → InterestSchedulePickerModal). Long-press → Remove strip. "+ Add Interest" opens name modal. Milestones section.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
  Alert,
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
import { XPProgressBar } from "../components/XPProgressBar";
import { SecondaryButton } from "../components/SecondaryButton";
import { InterestSchedulePickerModal } from "../components/InterestSchedulePickerModal";
import { AddInterestModal } from "../components/AddInterestModal";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface InterestItem {
  id: string;
  name: string;
  level: number;
  currentXP: number;
  nextStageXP: number;
  schedule: number[];
}

const PLACEHOLDER_INTERESTS: InterestItem[] = [
  {
    id: "1",
    name: "Fitness",
    level: 2,
    currentXP: 400,
    nextStageXP: 1000,
    schedule: [0, 2, 4],
  },
  {
    id: "2",
    name: "Reading",
    level: 1,
    currentXP: 150,
    nextStageXP: 1000,
    schedule: [1, 3, 5],
  },
];

function formatActiveDays(schedule: number[]): string {
  if (schedule.length === 0) return "No days set";
  return schedule.map((i) => DAY_LABELS[i]).join(", ");
}

export function ProfileInterestsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const contentWidth = width - SPACING.screenPadding * 2;
  const cardInnerWidth = contentWidth - SPACING.cardPadding * 2;

  const [interests, setInterests] = useState<InterestItem[]>(PLACEHOLDER_INTERESTS);
  const [scheduleModalInterest, setScheduleModalInterest] = useState<InterestItem | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [longPressId, setLongPressId] = useState<string | null>(null);

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

  const handleRemove = useCallback((interest: InterestItem) => {
    Alert.alert(
      "Remove interest",
      `Remove "${interest.name}"?`,
      [
        { text: "Cancel", style: "cancel", onPress: () => setLongPressId(null) },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setInterests((prev) => prev.filter((i) => i.id !== interest.id));
            setLongPressId(null);
          },
        },
      ]
    );
  }, []);

  const handleAddInterest = useCallback(() => {
    setAddModalVisible(true);
  }, []);

  const handleConfirmAddInterest = useCallback((name: string) => {
    setInterests((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name,
        level: 1,
        currentXP: 0,
        nextStageXP: 1000,
        schedule: [],
      },
    ]);
    setAddModalVisible(false);
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
        {interests.map((interest) => (
          <Pressable
            key={interest.id}
            onLongPress={() =>
              setLongPressId((id) => (id === interest.id ? null : interest.id))
            }
            delayLongPress={400}
            style={styles.interestCard}
          >
            <View style={styles.interestHeader}>
              <Text style={styles.interestName} numberOfLines={1}>
                {interest.name}
              </Text>
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>L{interest.level}</Text>
              </View>
            </View>

            <XPProgressBar
              currentXP={interest.currentXP}
              nextStageXP={interest.nextStageXP}
              nextStageName="Next level"
              width={cardInnerWidth}
            />

            <Pressable
              onPress={() => openSchedule(interest)}
              style={styles.activeDaysRow}
            >
              <Text style={styles.activeDaysLabel}>Active days</Text>
              <Text style={styles.activeDaysValue} numberOfLines={1}>
                {formatActiveDays(interest.schedule)}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
            </Pressable>

            {longPressId === interest.id && (
              <Pressable
                onPress={() => handleRemove(interest)}
                style={styles.removeStrip}
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.text2} />
                <Text style={styles.removeStripText}>Remove interest</Text>
              </Pressable>
            )}
          </Pressable>
        ))}

        <View style={styles.addButtonWrap}>
          <SecondaryButton
            label="+ Add Interest"
            onPress={handleAddInterest}
            style={styles.addButton}
          />
        </View>

        <View style={styles.milestonesSection}>
          <Text style={styles.milestonesLabel}>Milestones</Text>
          <Text style={styles.milestonesPlaceholder}>
            Interest milestones and rewards will appear here.
          </Text>
        </View>
      </ScrollView>

      <InterestSchedulePickerModal
        visible={!!scheduleModalInterest}
        onClose={closeScheduleModal}
        interestName={scheduleModalInterest?.name ?? ""}
        currentSchedule={scheduleModalInterest?.schedule ?? []}
        onSave={(schedule) => {
          if (scheduleModalInterest) handleSaveSchedule(scheduleModalInterest.id, schedule);
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
  interestCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: SPACING.cardPadding,
    marginBottom: SPACING.cardGap,
    borderWidth: 1,
    borderColor: COLORS.border,
    position: "relative",
  },
  interestHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: SPACING.sm,
    gap: 8,
  },
  interestName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
    flex: 1,
    minWidth: 0,
  },
  levelBadge: {
    backgroundColor: COLORS.violet,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.chip,
  },
  levelBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: COLORS.text,
  },
  removeStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  removeStripText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: COLORS.text2,
  },
  activeDaysRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.sm,
    gap: 6,
  },
  activeDaysLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.muted,
  },
  activeDaysValue: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.muted,
    flex: 1,
    minWidth: 0,
  },
  addButtonWrap: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
    paddingVertical: SPACING.sm,
    alignItems: "center",
  },
  addButton: {
    alignSelf: "center",
    minWidth: 200,
  },
  milestonesSection: {
    marginTop: SPACING.md,
  },
  milestonesLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 8,
  },
  milestonesPlaceholder: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.muted,
  },
});
