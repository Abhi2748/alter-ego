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
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  COLORS,
  SPACING,
  GRADIENTS,
  RADIUS,
} from "../constants/theme";
import { SecondaryButton } from "../components/SecondaryButton";
import { AddInterestOnboardingModal, type OnboardingInterestItem } from "../components/AddInterestOnboardingModal";
import { EditInterestDetailsModal, type InterestDetails } from "../components/EditInterestDetailsModal";
import { MilestoneAchievementCard } from "../components/MilestoneAchievementCard";
import { MilestoneRow } from "../components/MilestoneRow";
import MilestoneCardScreen from "../components/MilestoneCardScreen";
import {
  MILESTONE_DEFINITIONS,
  PLACEHOLDER_MILESTONES,
  type InterestMilestone,
} from "../constants/milestoneDefinitions";
import { supabase } from "../utils/supabase";
import { getInterests, patchInterest } from "../utils/api";

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
  self_level?: "Still figuring it out" | "Getting the hang of it" | "Pretty solid";
  learning_goal?: string;
  milestones?: InterestMilestone[];
}

/** Placeholder: L2 40% (360 XP), L1 15% (30 XP). Phase 1: same milestone data per interest. */
const PLACEHOLDER_INTERESTS: InterestItem[] = [
  { id: "1", name: "Fitness", totalXp: 360, schedule: [0, 2, 4], self_level: "Getting the hang of it", learning_goal: "Run a 5K.", milestones: PLACEHOLDER_MILESTONES },
  { id: "2", name: "Reading", totalXp: 30, schedule: [1, 3, 5], self_level: "Still figuring it out", learning_goal: "Finish 1 book a month.", milestones: PLACEHOLDER_MILESTONES },
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
  const [editInterest, setEditInterest] = useState<InterestItem | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) return;
          const res = await getInterests(session.access_token);
          if (!mounted) return;
          const list: InterestItem[] = (res.interests || []).map((r) => ({
            id: r.interest,
            name: r.interest,
            totalXp: r.total_xp ?? 0,
            schedule: (r.schedule ?? [0, 2, 4]) as number[],
            self_level: (r.self_level ?? "Still figuring it out") as any,
            learning_goal: (r.learning_goal ?? "") as string,
            milestones: PLACEHOLDER_MILESTONES,
          }));
          if (list.length > 0) setInterests(list);
        } catch (_) {
          // keep placeholder
        }
      })();
      return () => {
        mounted = false;
      };
    }, [])
  );

  const openEdit = useCallback((interest: InterestItem) => {
    setEditInterest(interest);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditInterest(null);
  }, []);

  const handleSaveInterestDetails = useCallback((interestId: string, next: InterestDetails) => {
    setInterests((prev) =>
      prev.map((i) =>
        i.id === interestId
          ? { ...i, schedule: next.schedule, self_level: next.self_level, learning_goal: next.learning_goal }
          : i
      )
    );
    setEditInterest(null);

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        await patchInterest(session.access_token, interestId, {
          self_level: next.self_level,
          learning_goal: next.learning_goal,
          schedule: next.schedule,
        });
      } catch (_) {}
    })();
  }, []);

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

  const handleConfirmAddInterest = useCallback((item: OnboardingInterestItem) => {
    const newInterest: InterestItem = {
      id: String(Date.now()),
      name: item.name,
      totalXp: 0,
      schedule: item.schedule && item.schedule.length > 0 ? item.schedule : [0, 2, 4],
      self_level: item.level,
      learning_goal: item.learning_goal,
    };
    setInterests((prev) => [...prev, newInterest]);
    setAddModalVisible(false);
  }, []);

  const [activeMilestone, setActiveMilestone] = useState<{
    milestone: InterestMilestone;
    definition: (typeof MILESTONE_DEFINITIONS)[0];
    interestName: string;
  } | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());

  const toggleSelectForDelete = useCallback((id: string) => {
    setSelectedForDelete((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const startDeleteMode = useCallback(() => {
    setMenuVisible(false);
    setDeleteMode(true);
    setSelectedForDelete(new Set());
  }, []);

  const cancelDeleteMode = useCallback(() => {
    setDeleteMode(false);
    setSelectedForDelete(new Set());
  }, []);

  const confirmDeleteSelected = useCallback(() => {
    const ids = Array.from(selectedForDelete);
    if (ids.length === 0) return;
    const names = interests.filter((i) => ids.includes(i.id)).map((i) => i.name).join(", ");
    const idSet = new Set(ids);
    Alert.alert(
      "Remove interests?",
      `Remove ${ids.length} interest${ids.length > 1 ? "s" : ""}: ${names}? You can add them again later.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setInterests((prev) => prev.filter((i) => !idSet.has(i.id)));
            setDeleteMode(false);
            setSelectedForDelete(new Set());
          },
        },
      ]
    );
  }, [selectedForDelete, interests]);

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
        <Pressable
          onPress={() => setMenuVisible(true)}
          style={styles.menuBtn}
          hitSlop={12}
        >
          <Ionicons name="ellipsis-vertical" size={22} color={COLORS.text} />
        </Pressable>
      </View>

      {menuVisible && (
        <Modal visible transparent animationType="fade">
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuVisible(false)}>
            <View style={styles.menuCard}>
              <Pressable
                style={styles.menuItem}
                onPress={startDeleteMode}
              >
                <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                <Text style={styles.menuItemTextDanger}>Delete an interest</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}

      {deleteMode && (
        <View style={[styles.deleteModeBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
          <Pressable onPress={cancelDeleteMode} style={styles.deleteModeCancel}>
            <Text style={styles.deleteModeCancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={confirmDeleteSelected}
            disabled={selectedForDelete.size === 0}
            style={[
              styles.deleteModeConfirm,
              selectedForDelete.size === 0 && styles.deleteModeConfirmDisabled,
            ]}
          >
            <Text style={styles.deleteModeConfirmText}>
              Delete {selectedForDelete.size > 0 ? `(${selectedForDelete.size})` : ""}
            </Text>
          </Pressable>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + SPACING.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeader}>YOUR INTERESTS</Text>
        <Text style={styles.sectionHint}>Tap an interest to edit level, goal, or schedule.</Text>

        {interests.map((interest) => {
          const { level, progressInLevel } = getLevelAndProgress(interest.totalXp);
          const isL10 = level === 10;
          const milestones = interest.milestones ?? [];

          const isSelectedForDelete = deleteMode && selectedForDelete.has(interest.id);
          return (
            <View
              key={interest.id}
              style={[
                styles.interestRow,
                isSelectedForDelete && styles.interestRowSelectedDelete,
              ]}
            >
              <Pressable
                onPress={() => {
                  if (deleteMode) toggleSelectForDelete(interest.id);
                  else openEdit(interest);
                }}
                style={({ pressed }) => [
                  styles.interestRowPressable,
                  pressed && !deleteMode && styles.interestRowPressed,
                ]}
              >
                {deleteMode && (
                  <View style={[styles.selectCircle, isSelectedForDelete && styles.selectCircleSelected]}>
                    {isSelectedForDelete && <Ionicons name="checkmark" size={16} color={COLORS.text} />}
                  </View>
                )}
                <View style={styles.interestRowInner}>
                  <View style={styles.interestMain}>
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

                    <View style={styles.activeDaysWrap}>
                      <Text style={styles.activeDaysText} numberOfLines={1}>
                        {formatActiveDays(interest.schedule)}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>

              {!deleteMode && (
              <View style={styles.milestonesInBlock}>
                <Text style={styles.milestonesLabel}>MILESTONES</Text>
                {MILESTONE_DEFINITIONS.map((def, idx) => {
                  const ms = milestones.find((m) => m.milestone_id === def.id);
                  return (
                    <MilestoneRow
                      key={def.id}
                      definition={def}
                      milestone={
                        ms ?? {
                          milestone_id: def.id,
                          earned: false,
                          earned_at: null,
                          soul_line: null,
                          stats: null,
                          interest_icon: null,
                        }
                      }
                      onPress={() => {
                        if (ms?.earned) {
                          setActiveMilestone({
                            milestone: ms,
                            definition: def,
                            interestName: interest.name,
                          });
                        }
                      }}
                      rowIndex={idx}
                    />
                  );
                })}
              </View>
              )}
            </View>
          );
        })}

        <View style={styles.addButtonWrap}>
          <SecondaryButton
            label="+ Add Interest"
            onPress={handleAddInterest}
            style={styles.addButton}
          />
        </View>

      </ScrollView>

      <EditInterestDetailsModal
        visible={!!editInterest}
        interestName={editInterest?.name ?? ""}
        initial={{
          self_level: (editInterest?.self_level ?? "Still figuring it out") as any,
          learning_goal: editInterest?.learning_goal ?? "",
          schedule: editInterest?.schedule ?? [0, 2, 4],
        }}
        onClose={closeEditModal}
        onSave={(next) => {
          if (editInterest) handleSaveInterestDetails(editInterest.id, next);
        }}
      />
      <AddInterestOnboardingModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAdd={handleConfirmAddInterest}
      />

      {activeMilestone && (
        <MilestoneCardScreen
          visible={activeMilestone !== null}
          onClose={() => setActiveMilestone(null)}
          milestone={activeMilestone.milestone}
          definition={activeMilestone.definition}
          interestName={activeMilestone.interestName}
        />
      )}
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
    flex: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: COLORS.text,
  },
  menuBtn: {
    padding: SPACING.xs,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 56,
    paddingRight: SPACING.screenPadding,
  },
  menuCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 200,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
  },
  menuItemTextDanger: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: COLORS.danger,
  },
  deleteModeBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.screenPadding,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  deleteModeCancel: {
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
  },
  deleteModeCancelText: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: COLORS.muted,
  },
  deleteModeConfirm: {
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.danger,
  },
  deleteModeConfirmDisabled: {
    opacity: 0.5,
  },
  deleteModeConfirmText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
  interestRowSelectedDelete: {
    borderColor: COLORS.violet,
    borderWidth: 2,
  },
  selectCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  selectCircleSelected: {
    borderColor: COLORS.violet,
    backgroundColor: COLORS.violet,
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
    marginBottom: SPACING.xs,
  },
  sectionHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.text2,
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
  interestRowPressable: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  interestRowPressed: {
    opacity: 0.85,
  },
  milestonesInBlock: {
    marginTop: 12,
  },
  milestonesLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: COLORS.muted,
    marginBottom: 8,
    marginTop: 4,
  },
  interestRowInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  interestMain: {
    flex: 1,
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
