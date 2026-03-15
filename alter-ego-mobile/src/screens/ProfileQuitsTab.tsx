/**
 * Profile → Quits tab. Quit target cards, clean streak hero, milestones, add/conquer. Spec §2.
 * Ember/amber accent. No schedule. No shame language.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { QuitTargetOut, QuitMilestoneOut } from "../utils/api";
import {
  QUIT_MILESTONE_DEFS,
  QUIT_PHASE_RANGES,
  getPhaseLabel,
  getPhaseRange,
} from "../types/quits";
import { QuitMilestoneIcon } from "../components/QuitMilestoneIcons";
import { QuitMilestoneModal } from "../components/QuitMilestoneModal";
import { AddQuitSheet } from "../components/AddQuitSheet";
import { SlipRecoveryModal } from "../components/SlipRecoveryModal";
import { MarkAsConqueredSheet } from "../components/MarkAsConqueredSheet";

const CARD_BG = "rgba(14,13,28,0.90)";
const CARD_BORDER = "rgba(42,48,80,0.50)";
const EMBER = "#F97316";
const VIOLET_GLOW = "#A78BFA";
const VIOLET = "#8B5CF6";
const GREEN = "#10B981";
const LIGHT_GREEN = "#6EE7B7";
const TEXT = "#E5E7EB";
const MUTED = "#6B7280";
const DIM = "#374151";
const VERY_DIM = "#2D3146";

const PHASE_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  awareness: {
    bg: "rgba(109,40,217,0.12)",
    border: "rgba(139,92,246,0.30)",
    color: "#A78BFA",
  },
  replacement: {
    bg: "rgba(249,115,22,0.12)",
    border: "rgba(249,115,22,0.30)",
    color: "#FB923C",
  },
  reflex: {
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.30)",
    color: "#FCD34D",
  },
  rewired: {
    bg: "rgba(217,70,239,0.12)",
    border: "rgba(217,70,239,0.30)",
    color: "#F0ABFC",
  },
  free: {
    bg: "rgba(251,191,36,0.12)",
    border: "rgba(251,191,36,0.35)",
    color: "#FBBF24",
  },
};

interface ProfileQuitsTabProps {
  targets: QuitTargetOut[];
  onRefetch: () => void;
  onAddQuit: (payload: { quit_description: string; trigger_description: string }) => Promise<void>;
  onConquer: (targetId: string, payload: { conquered_at: string; final_clean_days: number; cravings_resisted: number }) => Promise<void>;
  onOpenTwinChat?: (contextMessage: string) => void;
}

export function ProfileQuitsTab({
  targets,
  onRefetch,
  onAddQuit,
  onConquer,
  onOpenTwinChat,
}: ProfileQuitsTabProps) {
  const insets = useSafeAreaInsets();
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<QuitTargetOut | null>(null);
  const [milestoneModal, setMilestoneModal] = useState<{
    milestone: QuitMilestoneOut;
    quitName: string;
  } | null>(null);
  const [slipModalTarget, setSlipModalTarget] = useState<QuitTargetOut | null>(null);
  const [conquerSheetTarget, setConquerSheetTarget] = useState<QuitTargetOut | null>(null);
  const prevTargetsRef = useRef<QuitTargetOut[]>([]);

  const activeTargets = targets.filter((t) => t.status === "active");

  useEffect(() => {
    const prev = prevTargetsRef.current;
    for (const t of targets) {
      if (t.status !== "active") continue;
      const prevT = prev.find((p) => p.id === t.id);
      const hadStreak = prevT ? prevT.current_clean_streak > 0 : false;
      if (hadStreak && t.current_clean_streak === 0) {
        setSlipModalTarget(t);
        break;
      }
    }
    prevTargetsRef.current = targets;
  }, [targets]);
  const conqueredTargets = targets.filter((t) => t.status === "conquered");

  const openAddSheet = useCallback(() => setAddSheetVisible(true), []);
  const closeAddSheet = useCallback(() => setAddSheetVisible(false), []);
  const openEditMenu = useCallback((target: QuitTargetOut) => setEditTarget(target), []);
  const closeEditMenu = useCallback(() => setEditTarget(null), []);
  const openConquerSheet = useCallback((target: QuitTargetOut) => {
    setEditTarget(null);
    setConquerSheetTarget(target);
  }, []);
  const closeConquerSheet = useCallback(() => setConquerSheetTarget(null), []);

  const handleAddSuccess = useCallback(() => {
    closeAddSheet();
    onRefetch();
  }, [closeAddSheet, onRefetch]);

  const handleConquerConfirm = useCallback(async () => {
    if (!conquerSheetTarget) return;
    const payload = {
      conquered_at: new Date().toISOString(),
      final_clean_days: conquerSheetTarget.total_clean_days,
      cravings_resisted: conquerSheetTarget.cravings_resisted,
    };
    await onConquer(conquerSheetTarget.id, payload);
    closeConquerSheet();
    onRefetch();
    const syntheticConquered: QuitMilestoneOut = {
      id: `conquered-${conquerSheetTarget.id}`,
      milestone_type: "conquered",
      earned_at: payload.conquered_at,
      is_unlocked: true,
      clean_days_at_earn: payload.final_clean_days,
      cravings_at_earn: payload.cravings_resisted,
      phase_at_earn: "free",
      days_away: null,
      quote: "You decided you were done. And then you stayed done. Not everyone gets here.",
      slip_duration_hours: null,
      return_speed: null,
    };
    setMilestoneModal({ milestone: syntheticConquered, quitName: conquerSheetTarget.quit_name });
  }, [conquerSheetTarget, onConquer, closeConquerSheet, onRefetch]);

  const handleSlipStartAgain = useCallback(() => {
    setSlipModalTarget(null);
    onRefetch();
  }, [onRefetch]);
  const handleSlipNeedHelp = useCallback(() => {
    const t = slipModalTarget;
    setSlipModalTarget(null);
    if (t && onOpenTwinChat) {
      onOpenTwinChat(`I had a slip with ${t.quit_name}. Can you help me understand what triggered it?`);
    }
  }, [slipModalTarget, onOpenTwinChat]);

  const formatStarted = (iso: string) => {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 80 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>TARGETS · TAP TO EDIT</Text>

        {activeTargets.map((target) => {
          const phaseStyle = PHASE_STYLES[target.current_phase] ?? PHASE_STYLES.awareness;
          const phaseRange = getPhaseRange(target.current_phase as any);
          const phaseLength = phaseRange.end - phaseRange.start + 1;
          const progressInPhase = Math.min(1, target.days_in_current_phase / phaseLength);
          const nextPhase = QUIT_PHASE_RANGES[QUIT_PHASE_RANGES.findIndex((r) => r.phase === target.current_phase) + 1];
          const milestones = target.milestones ?? [];
          const standardMilestones = QUIT_MILESTONE_DEFS.map((def) => ({
            def,
            ms: milestones.find((m) => m.milestone_type === def.type),
          }));

          return (
            <Pressable key={target.id} onPress={() => openEditMenu(target)} style={styles.cardPressable}>
              <View style={styles.card}>
                <LinearGradient
                  colors={["transparent", "rgba(249,115,22,0.20)", "transparent"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.cardAccent}
                />
                <View style={styles.cardTopRow}>
                  <Text style={styles.quitName} numberOfLines={1}>
                    {target.quit_name}
                  </Text>
                  <View style={[styles.phaseBadge, { backgroundColor: phaseStyle.bg, borderColor: phaseStyle.border }]}>
                    <Text style={[styles.phaseBadgeText, { color: phaseStyle.color }]}>
                      {getPhaseLabel(target.current_phase as any)}
                    </Text>
                  </View>
                </View>

                <View style={styles.needChip}>
                  <View style={styles.needDot} />
                  <Text style={styles.needChipText}>{target.underlying_need || "Quit"}</Text>
                </View>

                <View style={styles.heroRow}>
                  <View style={styles.heroNumberWrap}>
                    <Text style={styles.heroNumber} numberOfLines={1}>
                      {target.current_clean_streak ?? 0}
                    </Text>
                  </View>
                  <View style={styles.heroInfo}>
                    <Text style={styles.heroLabel}>CLEAN DAYS</Text>
                    <Text style={styles.heroSub}>
                      Best: {target.best_clean_streak} days · Started {formatStarted(target.started_at)}
                    </Text>
                  </View>
                </View>

                <View style={styles.statsPills}>
                  <View style={styles.statPill}>
                    <Text style={[styles.statPillValue, styles.statPillValueStreak, { color: EMBER }]}>
                      {target.current_clean_streak ?? 0}
                    </Text>
                    <Text style={styles.statPillLabel}>This streak</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Text style={[styles.statPillValue, { color: VIOLET_GLOW }]}>{target.total_clean_days ?? 0}</Text>
                    <Text style={styles.statPillLabel}>Total clean</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Text style={[styles.statPillValue, { color: "#4B5563" }]}>{target.slip_count}</Text>
                    <Text style={styles.statPillLabel}>Slips</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Text style={[styles.statPillValue, { color: VIOLET }]}>~{target.cravings_resisted}</Text>
                    <Text style={styles.statPillLabel}>Cravings resisted</Text>
                  </View>
                </View>

                <View style={styles.phaseProgress}>
                  <View style={styles.phaseProgressLabelRow}>
                    <Text style={styles.phaseProgressLabel}>
                      {getPhaseLabel(target.current_phase as any)} Phase · Day {target.days_in_current_phase} of {phaseRange.end}
                    </Text>
                    <Text style={styles.phaseProgressNext}>
                      → {nextPhase?.label ?? "Free"} at day {phaseRange.end + 1}
                    </Text>
                  </View>
                  <View style={styles.phaseTrack}>
                    <View style={[styles.phaseFill, { width: `${progressInPhase * 100}%` }]}>
                      <LinearGradient
                        colors={["#C2410C", EMBER, "#FBBF24"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.milestonesSection}>
                  <Text style={styles.milestonesLabel}>MILESTONES</Text>
                  {standardMilestones.map(({ def, ms }, idx) => {
                    const unlocked = ms?.is_unlocked ?? false;
                    const daysAway = ms?.days_away ?? def.trigger_days - target.total_clean_days;
                    const earnedDate = ms?.earned_at
                      ? new Date(ms.earned_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "";
                    const isLast = idx === standardMilestones.length - 1;
                    return (
                      <Pressable
                        key={def.type}
                        onPress={() => unlocked && ms && setMilestoneModal({ milestone: ms, quitName: target.quit_name })}
                        style={[
                          styles.milestoneRow,
                          !unlocked && styles.milestoneRowLocked,
                          isLast && styles.milestoneRowLast,
                        ]}
                        disabled={!unlocked}
                      >
                        {unlocked && (
                          <LinearGradient
                            colors={["transparent", "rgba(249,115,22,0.60)", "transparent"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={styles.milestoneAccent}
                          />
                        )}
                        <View style={[styles.milestoneIconBox, unlocked ? styles.milestoneIconBoxUnlocked : styles.milestoneIconBoxLocked]}>
                          <QuitMilestoneIcon
                            type={def.type}
                            color={unlocked ? "#F97316" : VERY_DIM}
                            size={14}
                          />
                        </View>
                        <View style={styles.milestoneInfo}>
                          <Text style={[styles.milestoneName, !unlocked && styles.milestoneNameLocked]}>{def.name}</Text>
                          <Text style={styles.milestoneSub}>
                            {unlocked ? `Earned ${earnedDate}` : `${Math.max(0, daysAway)} days away`}
                          </Text>
                        </View>
                        {unlocked ? (
                          <Ionicons name="chevron-forward" size={13} color={VERY_DIM} />
                        ) : (
                          <Ionicons name="lock-closed-outline" size={13} color="#1F2937" />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </Pressable>
          );
        })}

        <Pressable onPress={openAddSheet} style={styles.addBtn}>
          <Ionicons name="add" size={14} color={DIM} />
          <Text style={styles.addBtnText}>Add Quit Target</Text>
        </Pressable>

        {conqueredTargets.length > 0 && (
          <>
            <View style={styles.conqueredLabelRow}>
              <View style={styles.conqueredDot} />
              <Text style={styles.sectionLabel}>CONQUERED</Text>
            </View>
            {conqueredTargets.map((target) => {
              const conqueredMs = target.milestones?.find((m) => m.milestone_type === "conquered");
              return (
                <Pressable
                  key={target.id}
                  onPress={() => conqueredMs && setMilestoneModal({ milestone: conqueredMs, quitName: target.quit_name })}
                  style={styles.conqueredCardWrap}
                >
                  <View style={[styles.card, styles.conqueredCard]}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.quitName}>{target.quit_name}</Text>
                      <View style={styles.conqueredBadge}>
                        <Text style={styles.conqueredBadgeText}>✦ Conquered</Text>
                      </View>
                    </View>
                    <View style={styles.heroRow}>
                      <Text style={[styles.heroNumber, styles.heroNumberSmall]}>{target.total_clean_days}</Text>
                      <Text style={styles.heroSub}>clean days · ~{target.cravings_resisted} cravings resisted</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>

      <AddQuitSheet
        visible={addSheetVisible}
        onClose={closeAddSheet}
        onSave={onAddQuit}
        onSuccess={handleAddSuccess}
      />

      {editTarget && (
        <Modal visible transparent animationType="slide">
          <View style={styles.editSheetOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeEditMenu} />
            <View style={[styles.editSheetInner, { paddingBottom: insets.bottom + 24 }]} onStartShouldSetResponder={() => true}>
            <Text style={styles.editSheetTitle}>{editTarget.quit_name}</Text>
            <Text style={styles.editSheetSub}>What would you like to do?</Text>
            <Pressable
              style={styles.editMenuCard}
              onPress={() => openConquerSheet(editTarget)}
            >
              <View style={styles.editMenuIconGreen}>
                <QuitMilestoneIcon type="conquered" color={GREEN} size={22} />
              </View>
              <View style={styles.editMenuText}>
                <Text style={styles.editMenuTitleText}>Mark as Conquered</Text>
                <Text style={styles.editMenuSubText}>I'm done with this — for good</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={VERY_DIM} />
            </Pressable>
            <Pressable onPress={closeEditMenu} style={styles.editSheetClose}>
              <Text style={styles.editSheetCloseText}>Cancel</Text>
            </Pressable>
          </View>
          </View>
        </Modal>
      )}

      {conquerSheetTarget && (
        <MarkAsConqueredSheet
          visible
          quitName={conquerSheetTarget.quit_name}
          finalCleanDays={conquerSheetTarget.total_clean_days}
          cravingsResisted={conquerSheetTarget.cravings_resisted}
          journeyDays={Math.max(1, Math.floor((Date.now() - new Date(conquerSheetTarget.started_at + "T12:00:00").getTime()) / 86400000))}
          onConfirm={handleConquerConfirm}
          onCancel={closeConquerSheet}
        />
      )}

      {slipModalTarget && (
        <SlipRecoveryModal
          visible
          quitName={slipModalTarget.quit_name}
          bestStreak={slipModalTarget.best_clean_streak}
          totalCleanDays={slipModalTarget.total_clean_days}
          cravingsResisted={slipModalTarget.cravings_resisted}
          onStartAgain={handleSlipStartAgain}
          onNeedHelp={handleSlipNeedHelp}
          onClose={() => setSlipModalTarget(null)}
        />
      )}

      {milestoneModal && (
        <QuitMilestoneModal
          visible
          milestone={milestoneModal.milestone}
          quitName={milestoneModal.quitName}
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
  conqueredLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 24, marginBottom: 10 },
  conqueredDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: GREEN },
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
  conqueredCard: { opacity: 0.6 },
  conqueredCardWrap: { marginBottom: 14 },
  cardAccent: { position: "absolute", top: 0, left: "15%", right: "15%", height: 1 },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  quitName: { fontSize: 18, fontWeight: "800", color: TEXT, letterSpacing: -0.3, flex: 1, marginRight: 8 },
  phaseBadge: {
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  phaseBadgeText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  needChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.40)",
    alignSelf: "flex-start",
  },
  needDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: MUTED },
  needChipText: { fontSize: 9, fontWeight: "600", letterSpacing: 0.3, color: DIM },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.025)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.30)",
    marginBottom: 14,
  },
  heroNumberWrap: { minWidth: 56, justifyContent: "center" },
  heroNumber: { fontSize: 52, fontWeight: "800", letterSpacing: -2, lineHeight: 56, color: EMBER },
  heroNumberSmall: { fontSize: 28 },
  heroInfo: { flex: 1, justifyContent: "center" },
  heroLabel: { fontSize: 13, fontWeight: "700", color: TEXT, letterSpacing: 1, marginBottom: 3 },
  heroSub: { fontSize: 11, color: DIM },
  statsPills: { flexDirection: "row", gap: 8, marginBottom: 14 },
  statPill: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.30)",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
  },
  statPillValue: { fontSize: 16, fontWeight: "800" },
  statPillValueStreak: { fontSize: 20 },
  statPillLabel: { fontSize: 8, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", color: DIM, marginTop: 4, textAlign: "center" },
  phaseProgress: { marginBottom: 14 },
  phaseProgressLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  phaseProgressLabel: { fontSize: 10, fontWeight: "700", color: "#FB923C" },
  phaseProgressNext: { fontSize: 10, color: DIM },
  phaseTrack: { height: 4, borderRadius: 4, backgroundColor: "rgba(20,20,40,0.90)", overflow: "hidden" },
  phaseFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 4, overflow: "hidden" },
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
    paddingVertical: 10,
    paddingLeft: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.18)",
    position: "relative",
  },
  milestoneRowLocked: { opacity: 0.28 },
  milestoneRowLast: { borderBottomWidth: 0, paddingBottom: 14 },
  milestoneAccent: {
    position: "absolute",
    left: 0,
    top: 4,
    bottom: 4,
    width: 2,
    borderRadius: 2,
  },
  milestoneIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneIconBoxUnlocked: {
    backgroundColor: "rgba(194,65,12,0.12)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.22)",
  },
  milestoneIconBoxLocked: {
    backgroundColor: "rgba(20,22,36,0.50)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.30)",
  },
  milestoneInfo: { flex: 1 },
  milestoneName: { fontSize: 13, fontWeight: "600", color: TEXT },
  milestoneNameLocked: { color: DIM },
  milestoneSub: { fontSize: 11, color: "#4B5563", marginTop: 2 },
  addBtn: {
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
  addBtnText: { fontSize: 14, fontWeight: "600", color: DIM },
  conqueredBadge: {
    backgroundColor: "rgba(16,185,129,0.10)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.25)",
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  conqueredBadgeText: { fontSize: 9, fontWeight: "700", color: LIGHT_GREEN },
  editSheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  editSheetInner: {
    backgroundColor: "#111623",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.50)",
    borderBottomWidth: 0,
  },
  editSheetTitle: { fontSize: 17, fontWeight: "800", color: TEXT, textAlign: "center", marginBottom: 4 },
  editSheetSub: { fontSize: 12, color: "#4B5563", textAlign: "center", marginBottom: 20 },
  editMenuCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.40)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  editMenuIconGreen: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "rgba(16,185,129,0.10)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  editMenuText: { flex: 1 },
  editMenuTitleText: { fontSize: 15, fontWeight: "700", color: TEXT },
  editMenuSubText: { fontSize: 12, color: "#4B5563", marginTop: 2 },
  editSheetClose: { marginTop: 8, alignItems: "center" },
  editSheetCloseText: { fontSize: 13, color: MUTED },
});
