/**
 * Quit path detail — full-screen stack route (Profile → Quits → card).
 * Ember aesthetic; actions: slip, update triggers, delete.
 */

import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import {
  useRoute,
  useNavigation,
  useFocusEffect,
  type RouteProp,
} from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { ProfileStackParamList } from "@/navigation/types";
import type { QuitTarget, QuitTargetInput } from "@/types/quits";
import type { QuitMilestoneOut } from "@/types/quitMilestone";
import {
  useQuits,
  useDeleteQuit,
  useLogCheckin,
  useUpdateTriggerProfile,
  useConquerQuit,
} from "@/hooks/useQuits";
import { SlipContextPicker } from "@/components/profile/SlipContextPicker";
import { QuitManageSheet } from "@/components/profile/QuitManageSheet";
import { QuitInsightModal } from "@/components/profile/QuitInsightModal";
import { QuitMilestoneModal } from "@/components/QuitMilestoneModal";
import { QuitTargetProfileSheet } from "@/components/onboarding/QuitTargetProfileSheet";
import { QUIT_ORANGE } from "@/constants/missionColors";

/** Declining urge trend (positive). */
const DECLINE_POSITIVE = "#4ADE80";

const EMBER = "#F97316";
const EMBER_DIM = "rgba(249,115,22,0.35)";
const EMBER_FAINT = "rgba(249,115,22,0.12)";
const EMBER_GHOST = "rgba(249,115,22,0.06)";
const BG_CARD = "rgba(14,8,4,0.95)";
const BORDER = "rgba(249,115,22,0.1)";
const TEXT = "#E5E7EB";
const MUTED = "#9CA3AF";
const DIM = "#6B7280";
const VERY_DIM = "#374151";

const BG_GRADIENT: [string, string] = ["#0D0906", "#060301"];

function displayTag(raw: string): string {
  return raw.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

const PHASE_LABELS: Record<string, string> = {
  mapping: "Mapping",
  disruption: "Disruption",
  consolidation: "Consolidation",
};

export function QuitDetailScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<ProfileStackParamList, "QuitDetail">>();
  const navigation = useNavigation<StackNavigationProp<ProfileStackParamList>>();
  const { pathId } = route.params;

  const { data: targetsRaw = [], isLoading, refetch } = useQuits();
  const targets = targetsRaw as QuitTarget[];
  const target = targets.find((t) => t.path_id === pathId) ?? null;

  const deleteMutation = useDeleteQuit();
  const logCheckin = useLogCheckin();
  const updateProfileMutation = useUpdateTriggerProfile();
  const conquerMutation = useConquerQuit();

  const manageRef = useRef<BottomSheetModal>(null);
  const [manageTarget, setManageTarget] = useState<QuitTarget | null>(null);
  const [insight, setInsight] = useState<{ title: string; body: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuitTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [slipPickerVisible, setSlipPickerVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [profileHabitName, setProfileHabitName] = useState("");
  const [profileInitial, setProfileInitial] = useState<
    Partial<Pick<QuitTargetInput, "contexts" | "awareness" | "quit_goal">> | undefined
  >(undefined);
  const editingPathIdRef = useRef<string | null>(null);
  const [milestoneModal, setMilestoneModal] = useState<{
    milestone: QuitMilestoneOut;
    quitName: string;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const handleProfileComplete = useCallback(
    (profile: QuitTargetInput) => {
      setProfileVisible(false);
      setProfileInitial(undefined);
      const editId = editingPathIdRef.current;
      editingPathIdRef.current = null;
      if (editId) {
        updateProfileMutation.mutate(
          {
            pathId: editId,
            contexts: profile.contexts,
            awareness: profile.awareness,
          },
          {
            onSuccess: () => {
              setManageTarget(null);
              void refetch();
            },
          }
        );
      }
    },
    [updateProfileMutation, refetch]
  );

  const handleConquer = useCallback(async () => {
    if (!manageTarget) return;
    manageRef.current?.dismiss();
    const pathName = manageTarget.habit_name;
    const pid = manageTarget.path_id;
    setManageTarget(null);
    try {
      const result = await conquerMutation.mutateAsync(pid);
      if (result?.milestone) {
        setMilestoneModal({
          milestone: result.milestone as QuitMilestoneOut,
          quitName: result.quit_name ?? pathName,
        });
      }
      void refetch();
    } catch {
      void refetch();
    }
  }, [manageTarget, conquerMutation, refetch]);

  const handleSlipSave = useCallback(
    (tags: string[], freeText?: string) => {
      if (!target) return;
      setSlipPickerVisible(false);
      const context_tags = tags.map((t) => t.toLowerCase().replace(/\s+/g, "_"));
      logCheckin.mutate({
        pathId: target.path_id,
        body: {
          checkin_type: "slip_context",
          context_tags,
          free_text: freeText,
        },
      });
    },
    [target, logCheckin]
  );

  const handleSlipSkip = useCallback(() => {
    setSlipPickerVisible(false);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync(deleteTarget.path_id);
      setDeleteTarget(null);
      navigation.goBack();
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleteMutation, navigation]);

  const onUpdateTriggers = useCallback(() => {
    if (!target) return;
    setManageTarget(target);
    manageRef.current?.present();
  }, [target]);

  const onLogSlip = useCallback(() => {
    setSlipPickerVisible(true);
  }, []);

  const onDeletePress = useCallback(() => {
    if (target) setDeleteTarget(target);
  }, [target]);

  if (isLoading && !target) {
    return (
      <LinearGradient colors={BG_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.root}>
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={EMBER} />
        </View>
      </LinearGradient>
    );
  }

  if (!target) {
    return (
      <LinearGradient colors={BG_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.root}>
        <View style={[styles.centered, { paddingTop: insets.top, paddingHorizontal: 24 }]}>
          <Text style={styles.missingText}>Couldn&apos;t find this quit path.</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.missingBack}>
            <Text style={styles.missingBackTxt}>Go back</Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  const phase = target.current_phase;
  const phaseLabel = PHASE_LABELS[phase] ?? phase;
  const isConquered = target.status === "completed";

  const topTriggers = target.top_triggers?.length
    ? target.top_triggers
    : (target.trigger_profile.contexts || []).map((c) => ({ tag: c, count: 0 }));

  const maxCount = Math.max(...topTriggers.map((t) => t.count), 1);

  const urgeTrend = target.urge_trend || [];
  const maxUrge = Math.max(...urgeTrend.map((u) => u.level), 1);

  const trendVerdict = (() => {
    if (urgeTrend.length < 2) return null;
    const first = urgeTrend[0].level;
    const last = urgeTrend[urgeTrend.length - 1].level;
    if (last < first - 0.5) {
      const levelLabel = last <= 2 ? "Manageable" : "Easier";
      return { text: `↓ Declining · ${levelLabel}`, color: DECLINE_POSITIVE };
    }
    if (last > first + 0.5) return { text: "↑ Increasing", color: "#F87171" };
    return { text: "→ Stable", color: "#9CA3AF" };
  })();

  return (
    <LinearGradient colors={BG_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.root}>
      <View style={[styles.safeTop, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={DIM} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerName} numberOfLines={2}>
              {target.habit_name}
            </Text>
            <Text style={styles.headerSub}>
              {isConquered ? "CONQUERED" : `${phaseLabel} · Day ${target.days_active}`}
            </Text>
          </View>
          <View style={styles.headerDayWrap}>
            <Text style={styles.headerDayNum}>{target.days_active}</Text>
            <Text style={styles.headerDayUnit}>DAYS</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.phaseGuideCard}>
            <Text style={styles.phaseGuideTitle}>Phase guide</Text>
            <View style={styles.phaseGuideRow}>
              {(["mapping", "disruption", "consolidation"] as const).map((p) => {
                const active = p === target.current_phase;
                const passed =
                  (p === "mapping" && (target.current_phase === "disruption" || target.current_phase === "consolidation")) ||
                  (p === "disruption" && target.current_phase === "consolidation");
                return (
                  <View key={p} style={[styles.phaseGuideStep, active && styles.phaseGuideStepActive]}>
                    <View
                      style={[
                        styles.phaseGuideDot,
                        active && styles.phaseGuideDotActive,
                        passed && styles.phaseGuideDotPassed,
                      ]}
                    />
                    <Text
                      style={[
                        styles.phaseGuideLabel,
                        active && styles.phaseGuideLabelActive,
                        passed && styles.phaseGuideLabelPassed,
                      ]}
                    >
                      {PHASE_LABELS[p]}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.phaseGuideSub}>
              Phase progress auto-advances after readiness criteria are met.
            </Text>
          </View>

          {!!target.phase_readiness?.criteria?.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Readiness</Text>
              {target.phase_readiness.criteria.map((criterion, idx) => (
                <View key={`${criterion.label}-${idx}`} style={styles.readinessRow}>
                  <View style={[
                    styles.readinessDot,
                    criterion.met ? styles.readinessDotMet : styles.readinessDotUnmet,
                  ]}>
                    {criterion.met ? (
                      <Text style={styles.readinessDotCheck}>✓</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.readinessText, criterion.met && styles.readinessTextMet]}>
                    {criterion.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {topTriggers.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Trigger frequency ·{" "}
                {target.frequency_history.length > 0
                  ? `${target.frequency_history.length} days`
                  : "All time"}
              </Text>
              {topTriggers.slice(0, 5).map((tr, i) => (
                <View key={`${tr.tag}-${i}`} style={styles.trigRow}>
                  <Text style={styles.trigName}>{displayTag(tr.tag)}</Text>
                  <View style={styles.trigTrack}>
                    <LinearGradient
                      colors={["rgba(124,45,12,0.8)", "rgba(249,115,22,0.85)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.trigFill,
                        { width: `${Math.max(8, (tr.count / maxCount) * 100)}%` as `${number}%` },
                      ]}
                    />
                  </View>
                  {tr.count > 0 ? <Text style={styles.trigCount}>{tr.count}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}

          {urgeTrend.length >= 2 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Weekly urge trend</Text>
              <View style={styles.trendChart}>
                {urgeTrend.map((u, i) => {
                  const isNow = i === urgeTrend.length - 1;
                  const barH = Math.max(4, (u.level / maxUrge) * 52);
                  const opacity = 0.3 + (u.level / 5) * 0.6;
                  return (
                    <View key={i} style={styles.tcCol}>
                      <View
                        style={[
                          styles.tcBar,
                          {
                            height: barH,
                            backgroundColor: EMBER,
                            opacity,
                            ...(isNow && {
                              shadowColor: EMBER,
                              shadowOpacity: 0.45,
                              shadowRadius: 8,
                              shadowOffset: { width: 0, height: 0 },
                              elevation: 4,
                            }),
                          },
                        ]}
                      />
                      <Text style={[styles.tcLabel, isNow && styles.tcLabelNow]}>
                        {u.week_label ?? `W${i + 1}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {trendVerdict ? (
                <View style={styles.trendLine}>
                  <Text style={[styles.trendVerdict, { color: trendVerdict.color }]}>
                    {trendVerdict.text}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {target.insights.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Insights · {target.insights.length} unlocked</Text>
              {target.insights.slice(0, 3).map((ins) => (
                <Pressable
                  key={`${ins.title}-${ins.unlocked_at}`}
                  style={styles.insightRow}
                  onPress={() => setInsight({ title: ins.title, body: ins.body })}
                >
                  <View style={styles.insightIcon}>
                    <Text style={{ fontSize: 14 }}>💡</Text>
                  </View>
                  <Text style={styles.insightText} numberOfLines={2}>
                    {ins.title}
                  </Text>
                  <Ionicons name="chevron-forward" size={12} color={VERY_DIM} />
                </Pressable>
              ))}
            </View>
          ) : null}

          {!isConquered ? (
            <>
              <View style={styles.actionRow}>
                <Pressable style={[styles.actBtn, styles.actPrimary]} onPress={onLogSlip}>
                  <Text style={styles.actPrimaryEmoji}>🔥</Text>
                  <Text style={styles.actPrimaryText}>Log a slip</Text>
                </Pressable>
                <Pressable style={[styles.actBtn, styles.actGhost]} onPress={onUpdateTriggers}>
                  <Text style={styles.actGhostText}>Update triggers</Text>
                </Pressable>
              </View>

              <View style={styles.actionRow}>
                <Pressable style={[styles.actBtn, styles.actDanger]} onPress={onDeletePress}>
                  <Text style={styles.actDangerText}>Delete</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable style={[styles.actBtnFull, styles.actDanger]} onPress={onDeletePress}>
              <Text style={styles.actDangerText}>Delete this quit target</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      <View style={styles.bottomEmber} pointerEvents="none" />

      <QuitManageSheet
        sheetRef={manageRef}
        target={manageTarget}
        onDismiss={() => setManageTarget(null)}
        onUpdateTriggerProfile={() => {
          if (!manageTarget) return;
          editingPathIdRef.current = manageTarget.path_id;
          manageRef.current?.dismiss();
          setProfileHabitName(manageTarget.habit_name);
          setProfileInitial({
            contexts: manageTarget.trigger_profile.contexts,
            awareness: manageTarget.trigger_profile.awareness,
            quit_goal: manageTarget.trigger_profile.quit_goal,
          });
          setTimeout(() => setProfileVisible(true), 280);
        }}
        onDelete={() => {
          if (manageTarget) setDeleteTarget(manageTarget);
          manageRef.current?.dismiss();
        }}
        onConquer={handleConquer}
      />

      <QuitTargetProfileSheet
        habitName={profileHabitName}
        visible={profileVisible}
        initialProfile={profileInitial}
        onComplete={handleProfileComplete}
        onDismiss={() => {
          setProfileVisible(false);
          setProfileInitial(undefined);
        }}
      />

      <QuitInsightModal
        visible={!!insight}
        title={insight?.title ?? ""}
        body={insight?.body ?? ""}
        onClose={() => setInsight(null)}
      />

      <SlipContextPicker
        visible={slipPickerVisible}
        habitName={target.habit_name}
        onSave={handleSlipSave}
        onSkip={handleSlipSkip}
      />

      <Modal visible={!!deleteTarget} transparent animationType="fade">
        <View style={styles.delBackdrop}>
          <View style={styles.delCard}>
            <Text style={styles.delIcon}>🗑</Text>
            <Text style={styles.delTitle}>Delete {deleteTarget?.habit_name}?</Text>
            <Text style={styles.delBody}>
              This will permanently delete your quit plan, all phase progress, and{" "}
              {deleteTarget?.insights.length ?? 0} insights earned.{"\n\n"}
              <Text style={styles.delStrong}>This cannot be undone.</Text>
            </Text>
            <Pressable
              style={[styles.delDanger, deleting && { opacity: 0.7 }]}
              onPress={confirmDelete}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator color={QUIT_ORANGE.primary} />
              ) : (
                <Text style={styles.delDangerTxt}>Delete permanently</Text>
              )}
            </Pressable>
            <Pressable style={styles.delGhost} onPress={() => setDeleteTarget(null)}>
              <Text style={styles.delGhostTxt}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {milestoneModal ? (
        <QuitMilestoneModal
          visible
          milestone={milestoneModal.milestone}
          quitName={milestoneModal.quitName}
          onClose={() => setMilestoneModal(null)}
        />
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeTop: { flex: 1, zIndex: 2 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  missingText: { color: MUTED, fontSize: 14, textAlign: "center", marginBottom: 16 },
  missingBack: { paddingVertical: 12, paddingHorizontal: 20 },
  missingBackTxt: { color: EMBER_DIM, fontFamily: "Inter_600SemiBold", fontSize: 14 },

  bottomEmber: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: "rgba(194,65,12,0.07)",
    zIndex: 0,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: "rgba(8,5,2,0.92)",
    minHeight: 56,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    marginLeft: -4,
  },
  headerCenter: {
    flex: 1,
    paddingRight: 8,
    paddingLeft: 4,
    justifyContent: "center",
    minHeight: 44,
  },
  headerName: {
    fontSize: 20,
    fontWeight: "900",
    color: TEXT,
    letterSpacing: 0.3,
    fontFamily: "Inter_800ExtraBold",
  },
  headerSub: {
    fontSize: 9,
    color: EMBER_DIM,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 2,
  },
  headerDayWrap: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
    paddingTop: 2,
    minWidth: 52,
  },
  headerDayNum: {
    fontSize: 32,
    fontWeight: "900",
    color: EMBER_DIM,
    lineHeight: 32,
    letterSpacing: -1,
    fontFamily: "Inter_800ExtraBold",
  },
  headerDayUnit: {
    fontSize: 7,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "rgba(249,115,22,0.3)",
    marginTop: 1,
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 12 },

  section: {
    backgroundColor: BG_CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: EMBER_DIM,
    marginBottom: 14,
  },
  phaseGuideCard: {
    backgroundColor: "rgba(14,8,4,0.95)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.10)",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    overflow: "hidden",
  },
  phaseGuideTitle: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(249,115,22,0.35)",
    marginBottom: 12,
  },
  phaseGuideRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  phaseGuideStep: { flex: 1, alignItems: "center", gap: 6 },
  phaseGuideStepActive: {
    backgroundColor: "rgba(249,115,22,0.06)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.15)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 4,
  },
  phaseGuideDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(107,114,128,0.45)",
    backgroundColor: "rgba(17,24,39,0.8)",
  },
  phaseGuideDotActive: {
    borderColor: "rgba(249,115,22,0.9)",
    backgroundColor: "rgba(249,115,22,0.22)",
  },
  phaseGuideDotPassed: {
    borderColor: "rgba(167,139,250,0.7)",
    backgroundColor: "rgba(167,139,250,0.22)",
  },
  phaseGuideLabel: {
    fontSize: 10,
    color: "#6B7280",
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  phaseGuideLabelActive: { color: "#FDBA74" },
  phaseGuideLabelPassed: { color: "#C4B5FD" },
  phaseGuideSub: {
    fontSize: 11,
    color: "#9CA3AF",
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
  readinessRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  readinessDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  readinessDotMet: {
    backgroundColor: "rgba(249,115,22,0.15)",
    borderColor: "rgba(249,115,22,0.60)",
  },
  readinessDotUnmet: {
    backgroundColor: "rgba(42,48,80,0.50)",
    borderColor: "rgba(42,48,80,0.80)",
  },
  readinessDotCheck: {
    fontSize: 8,
    fontWeight: "800",
    color: "#F97316",
  },
  readinessText: {
    flex: 1,
    fontSize: 12,
    color: "#9CA3AF",
    fontFamily: "Inter_500Medium",
    lineHeight: 17,
  },
  readinessTextMet: { color: "#DDD6FE" },

  trigRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 9,
  },
  trigName: { fontSize: 11, color: MUTED, width: 80, flexShrink: 0 },
  trigTrack: {
    flex: 1,
    height: 5,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 5,
    overflow: "hidden",
  },
  trigFill: { height: "100%", borderRadius: 5 },
  trigCount: {
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(251,146,60,0.8)",
    minWidth: 18,
    textAlign: "right",
    fontFamily: "Inter_700Bold",
  },

  trendChart: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-end",
    height: 56,
    marginBottom: 10,
  },
  tcCol: { flex: 1, alignItems: "center", gap: 4 },
  tcBar: { width: "100%", borderRadius: 3 },
  tcLabel: { fontSize: 8, color: VERY_DIM },
  tcLabelNow: { color: EMBER_DIM },
  trendLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  trendVerdict: { fontSize: 12, fontWeight: "600" },

  insightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  insightIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: EMBER_GHOST,
    borderWidth: 1,
    borderColor: EMBER_FAINT,
    alignItems: "center",
    justifyContent: "center",
  },
  insightText: { flex: 1, fontSize: 12, color: MUTED },

  actionRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  actBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  actBtnFull: {
    minHeight: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  actPrimary: {
    backgroundColor: "rgba(124,45,12,0.9)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.3)",
    shadowColor: EMBER,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  actPrimaryEmoji: { fontSize: 14 },
  actPrimaryText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  actGhost: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.35)",
  },
  actGhostText: { fontSize: 11, fontWeight: "700", color: DIM },
  actDanger: {
    backgroundColor: "rgba(127,29,29,0.07)",
    borderWidth: 1,
    borderColor: "rgba(127,29,29,0.2)",
  },
  actDangerText: { fontSize: 11, fontWeight: "700", color: "rgba(239,68,68,0.5)" },

  delBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  delCard: {
    width: "100%",
    backgroundColor: "#0F1220",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 20,
  },
  delIcon: { fontSize: 32, textAlign: "center", marginBottom: 8 },
  delTitle: {
    fontSize: 16,
    fontFamily: "Inter_800ExtraBold",
    color: "#E5E7EB",
    textAlign: "center",
    marginBottom: 12,
  },
  delBody: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  delStrong: { color: QUIT_ORANGE.text, fontFamily: "Inter_700Bold" },
  delDanger: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: QUIT_ORANGE.surface,
    borderWidth: 1,
    borderColor: QUIT_ORANGE.border2,
    alignItems: "center",
    marginBottom: 8,
  },
  delDangerTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: QUIT_ORANGE.text },
  delGhost: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  delGhostTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#6B7280" },
});
