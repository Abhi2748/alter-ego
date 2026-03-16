/**
 * Profile → Interests tab. Interest cards with XP, schedule pills, milestones.
 * Spec §2. Premium dark cinematic UI.
 */

import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { InterestOut, MilestoneOut } from "../utils/api";
import { getLevelAndProgress, MILESTONE_DEFS } from "../types/interests";
import { MilestoneIcon } from "../components/MilestoneIcons";
import { MilestoneDetailModal } from "../components/MilestoneDetailModal";
import { AddInterestSheet } from "../components/AddInterestSheet";
import { EditInterestSheet } from "../components/EditInterestSheet";

const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const CARD_BG = "rgba(14,13,28,0.90)";
const CARD_BORDER = "rgba(42,48,80,0.50)";
const VIOLET = "#8B5CF6";
const VIOLET_DEEP = "#5B21B6";
const VIOLET_GLOW = "#A78BFA";
const GOLD = "#FBBF24";
const TEXT = "#E5E7EB";
const MUTED = "#6B7280";
const DIM = "#374151";
const VERY_DIM = "#2D3146";

interface ProfileInterestsTabProps {
  interests: InterestOut[];
  onRefetch: () => void;
  onAddInterest: (payload: {
    interest_description: string;
    interest_level: string;
    goal_description: string;
    schedule_days: number[];
  }) => Promise<void>;
  onEditGoal: (interestId: string, payload: { new_goal: string; progress_level: string; progress_detail?: string }) => Promise<void>;
  onEditDifficulty: (interestId: string, tier: "easy" | "medium" | "hard") => Promise<void>;
  onEditSchedule: (interestId: string, days: string[]) => Promise<void>;
  onDeleteInterest?: (interestId: string) => Promise<void>;
}

export function ProfileInterestsTab({
  interests,
  onRefetch,
  onAddInterest,
  onEditGoal,
  onEditDifficulty,
  onEditSchedule,
  onDeleteInterest,
}: ProfileInterestsTabProps) {
  const insets = useSafeAreaInsets();
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [editSheetInterest, setEditSheetInterest] = useState<InterestOut | null>(null);
  const [editMode, setEditMode] = useState<"menu" | "goal" | "difficulty" | "schedule">("menu");
  const [milestoneModal, setMilestoneModal] = useState<{
    milestone: MilestoneOut;
    interestName: string;
    interestId: string;
  } | null>(null);

  const openAddSheet = useCallback(() => setAddSheetVisible(true), []);
  const closeAddSheet = useCallback(() => setAddSheetVisible(false), []);

  const openEditMenu = useCallback((interest: InterestOut) => {
    setEditSheetInterest(interest);
    setEditMode("menu");
  }, []);
  const openEditSchedule = useCallback((interest: InterestOut) => {
    setEditSheetInterest(interest);
    setEditMode("schedule");
  }, []);
  const closeEditSheet = useCallback(() => {
    setEditSheetInterest(null);
    setEditMode("menu");
  }, []);

  const handleAddSuccess = useCallback(() => {
    closeAddSheet();
    onRefetch();
  }, [closeAddSheet, onRefetch]);

  const handleSaveGoal = useCallback(
    async (interestId: string, payload: { new_goal: string; progress_level: string; progress_detail?: string }) => {
      await onEditGoal(interestId, payload);
      closeEditSheet();
      onRefetch();
    },
    [onEditGoal, closeEditSheet, onRefetch]
  );
  const handleSaveDifficulty = useCallback(
    async (interestId: string, tier: "easy" | "medium" | "hard") => {
      await onEditDifficulty(interestId, tier);
      closeEditSheet();
      onRefetch();
    },
    [onEditDifficulty, closeEditSheet, onRefetch]
  );
  const handleSaveSchedule = useCallback(
    async (interestId: string, days: string[]) => {
      await onEditSchedule(interestId, days);
      closeEditSheet();
      onRefetch();
    },
    [onEditSchedule, closeEditSheet, onRefetch]
  );

  const handleDeleteInterest = useCallback(
    async (interestId: string) => {
      if (onDeleteInterest) await onDeleteInterest(interestId);
      closeEditSheet();
      onRefetch();
    },
    [onDeleteInterest, closeEditSheet, onRefetch]
  );

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 80 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>YOUR INTERESTS</Text>

        {interests.map((interest) => {
          const { level, progressInLevel, currentInLevel, targetInLevel } = getLevelAndProgress(interest.current_xp);
          const nextLevel = Math.min(level + 1, 10);
          const isL10 = level === 10;
          const milestones = interest.milestones ?? [];

          return (
            <Pressable
              key={interest.id}
              onLongPress={() => openEditMenu(interest)}
              style={styles.cardPressable}
            >
            <View style={styles.card}>
              <LinearGradient
                colors={["transparent", "rgba(139,92,246,0.25)", "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cardAccent}
              />
              <View style={styles.cardTopRow}>
                <Text style={styles.interestName} numberOfLines={1}>
                  {interest.interest_name}
                </Text>
                <View style={styles.cardTopRight}>
                  <View style={[styles.levelBadge, isL10 && styles.levelBadgeGold]}>
                    <Text style={[styles.levelBadgeText, isL10 && styles.levelBadgeTextGold]}>L{level}</Text>
                  </View>
                  <Pressable
                    onPress={() => openEditMenu(interest)}
                    style={styles.moreBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="ellipsis-horizontal" size={18} color={MUTED} />
                  </Pressable>
                </View>
              </View>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>✦ {interest.current_xp} / {interest.xp_for_next_level} XP</Text>
                <Text style={styles.xpNext}>→ L{nextLevel}</Text>
              </View>
              <View style={styles.trackWrap}>
                <View style={styles.track}>
                  <View style={[styles.trackFill, { width: `${Math.min(1, progressInLevel) * 100}%` }]}>
                    <LinearGradient
                      colors={[VIOLET_DEEP, VIOLET, VIOLET_GLOW]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </View>
                </View>
                <View style={styles.glowDot} />
              </View>
              <View style={styles.metaRow}>
                <View style={styles.schedulePills}>
                  {DAY_LABELS.map((label, idx) => {
                    const key = DAY_KEYS[idx];
                    const selected = interest.schedule_days?.includes(key) ?? false;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => openEditSchedule(interest)}
                        style={[styles.dayPill, selected && styles.dayPillSelected]}
                      >
                        <Text style={[styles.dayPillText, selected && styles.dayPillTextSelected]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.sessionsText}>{interest.total_sessions} sessions</Text>
              </View>

              <View style={styles.milestonesSection}>
                <Text style={styles.milestonesLabel}>MILESTONES</Text>
                {MILESTONE_DEFS.map((def, idx) => {
                  const ms = milestones.find((m) => m.milestone_number === def.number) ?? {
                    id: `ms-${def.number}`,
                    milestone_number: def.number,
                    name: def.name,
                    trigger_label: def.unit === "sessions" ? `${def.trigger} sessions` : `${def.trigger}-day streak`,
                    earned_at: null,
                    is_unlocked: false,
                    sessions_at_earn: null,
                    xp_at_earn: null,
                    xp_total_at_earn: null,
                    streak_at_earn: null,
                    tier_at_earn: null,
                    quote: null,
                  };
                  const unlocked = ms.is_unlocked;
                  const sessionsToGo = def.unit === "sessions"
                    ? Math.max(0, def.trigger - (interest.total_sessions ?? 0))
                    : null;
                  const isLast = idx === MILESTONE_DEFS.length - 1;

                  if (unlocked) {
                    return (
                      <Pressable
                        key={ms.id}
                        style={[styles.milestoneRow, isLast && styles.milestoneRowLast]}
                        onPress={() =>
                          setMilestoneModal({
                            milestone: ms,
                            interestName: interest.interest_name,
                            interestId: interest.id,
                          })
                        }
                      >
                        <View style={styles.milestoneAccentWrap}>
                          <LinearGradient
                            colors={["transparent", "rgba(139,92,246,0.60)", "transparent"]}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                            style={StyleSheet.absoluteFill}
                          />
                        </View>
                        <View style={styles.milestoneIconBox}>
                          <MilestoneIcon number={def.number} color={VIOLET} size={26} />
                        </View>
                        <View style={styles.milestoneInfo}>
                          <Text style={styles.milestoneName}>{ms.name}</Text>
                          <Text style={styles.milestoneSub}>
                            Earned {ms.earned_at ? new Date(ms.earned_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={13} color={VERY_DIM} />
                      </Pressable>
                    );
                  }
                  return (
                    <View key={ms.id} style={[styles.milestoneRow, styles.milestoneRowLocked, isLast && styles.milestoneRowLast]}>
                      <View style={styles.milestoneIconBoxLocked}>
                        <MilestoneIcon number={def.number} color={DIM} size={26} />
                      </View>
                      <View style={styles.milestoneInfo}>
                        <Text style={styles.milestoneNameLocked}>{ms.name}</Text>
                        <Text style={styles.milestoneSubLocked}>
                          {sessionsToGo != null ? `${sessionsToGo} sessions to go` : "Locked"}
                        </Text>
                      </View>
                      <Ionicons name="lock-closed-outline" size={13} color={VERY_DIM} />
                    </View>
                  );
                })}
              </View>
            </View>
            </Pressable>
          );
        })}

        <Pressable style={styles.addButton} onPress={openAddSheet}>
          <Ionicons name="add" size={14} color={DIM} />
          <Text style={styles.addButtonText}>Add Interest</Text>
        </Pressable>
      </ScrollView>

      <AddInterestSheet
        visible={addSheetVisible}
        onClose={closeAddSheet}
        onSave={onAddInterest}
        onSuccess={handleAddSuccess}
      />

      {editSheetInterest && (
        <EditInterestSheet
          visible={!!editSheetInterest}
          interest={editSheetInterest}
          mode={editMode}
          onClose={closeEditSheet}
          onSwitchMode={setEditMode}
          onSaveGoal={handleSaveGoal}
          onSaveDifficulty={handleSaveDifficulty}
          onSaveSchedule={handleSaveSchedule}
          onDelete={onDeleteInterest ? handleDeleteInterest : undefined}
        />
      )}

      {milestoneModal && (
        <MilestoneDetailModal
          visible
          milestone={milestoneModal.milestone}
          interestName={milestoneModal.interestName}
          onClose={() => setMilestoneModal(null)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: DIM,
    marginBottom: 10,
  },
  cardPressable: {},
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 0,
    marginBottom: 14,
    position: "relative",
    overflow: "hidden",
  },
  cardAccent: {
    position: "absolute",
    top: 0,
    left: "15%",
    right: "15%",
    height: 1,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardTopRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  moreBtn: { padding: 4 },
  interestName: { flex: 1, fontSize: 18, fontWeight: "800", color: TEXT, letterSpacing: -0.3, marginRight: 8 },
  levelBadge: {
    backgroundColor: "rgba(109,40,217,0.20)",
    borderWidth: 1.5,
    borderColor: "rgba(139,92,246,0.45)",
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  levelBadgeGold: {
    backgroundColor: "rgba(245,158,11,0.15)",
    borderColor: "rgba(245,158,11,0.45)",
  },
  levelBadgeText: { fontSize: 11, fontWeight: "700", color: VIOLET_GLOW },
  levelBadgeTextGold: { color: GOLD },
  xpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  xpLabel: { fontSize: 9, fontWeight: "600", color: "rgba(167,139,250,0.5)" },
  xpNext: { fontSize: 9, color: VERY_DIM },
  trackWrap: { marginBottom: 6, position: "relative" },
  track: {
    height: 5,
    borderRadius: 5,
    backgroundColor: "rgba(20,20,40,0.9)",
    overflow: "hidden",
  },
  trackFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 5,
    overflow: "hidden",
    shadowColor: "rgba(139,92,246,0.40)",
    shadowRadius: 10,
  },
  glowDot: {
    position: "absolute",
    right: 0,
    top: -2,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: VIOLET_GLOW,
    borderWidth: 1.5,
    borderColor: "#09091A",
    shadowColor: "rgba(192,132,252,0.52)",
    shadowRadius: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  schedulePills: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  dayPill: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.50)",
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  dayPillSelected: {
    backgroundColor: "rgba(139,92,246,0.12)",
    borderColor: "rgba(139,92,246,0.20)",
  },
  dayPillText: { fontSize: 9, fontWeight: "600", color: MUTED },
  dayPillTextSelected: { color: VIOLET },
  sessionsText: { fontSize: 11, color: DIM },
  milestonesSection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(42,48,80,0.30)",
    paddingTop: 12,
    paddingBottom: 8,
  },
  milestonesLabel: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: VERY_DIM,
    marginBottom: 8,
  },
  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingLeft: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.20)",
    position: "relative",
  },
  milestoneRowLocked: { opacity: 0.28 },
  milestoneRowLast: { borderBottomWidth: 0, paddingBottom: 14 },
  milestoneAccentWrap: {
    position: "absolute",
    left: 0,
    top: 4,
    bottom: 4,
    width: 2,
    borderRadius: 2,
    overflow: "hidden",
  },
  milestoneIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(109,40,217,0.15)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneIconBoxLocked: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(20,22,36,0.5)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneInfo: { flex: 1 },
  milestoneName: { fontSize: 13, fontWeight: "600", color: TEXT },
  milestoneNameLocked: { fontSize: 13, fontWeight: "600", color: DIM },
  milestoneSub: { fontSize: 11, color: "#4B5563", marginTop: 2 },
  milestoneSubLocked: { fontSize: 11, color: VERY_DIM, marginTop: 2 },
  addButton: {
    height: 52,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: CARD_BORDER,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addButtonText: { fontSize: 14, fontWeight: "600", color: DIM },
});
