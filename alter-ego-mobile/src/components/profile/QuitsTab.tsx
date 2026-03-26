import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
} from "react-native";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import type { QuitTarget, QuitTargetInput } from "@/types/quits";
import {
  useQuits,
  useLogFrequency,
  useAdvancePhase,
  useDeleteQuit,
  useUpdateTriggerProfile,
  useCreateQuitPath,
} from "@/hooks/useQuits";
import { QuitCard } from "@/components/profile/QuitCard";
import { QuitManageSheet } from "@/components/profile/QuitManageSheet";
import { QuitInsightModal } from "@/components/profile/QuitInsightModal";
import { QuitTargetProfileSheet } from "@/components/onboarding/QuitTargetProfileSheet";
import { getErrorMessage, isApiError } from "@/services/api";
import { QUIT_ORANGE } from "@/constants/missionColors";

function SkeletonCard() {
  const o = useSharedValue(0.35);
  React.useEffect(() => {
    o.value = withRepeat(
      withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[styles.skelCard, style]}>
      <View style={styles.skelLine} />
      <View style={[styles.skelLine, { width: "55%" }]} />
      <View style={{ height: 20 }} />
      <View style={styles.skelBarRow}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <View key={i} style={styles.skelBar} />
        ))}
      </View>
      <View style={{ height: 24 }} />
      <View style={[styles.skelLine, { width: "100%", height: 80 }]} />
    </Animated.View>
  );
}

export function QuitsTab() {
  const { data: targetsRaw = [], isLoading, isError, isFetching, refetch } = useQuits();
  const targets = targetsRaw as QuitTarget[];
  const logMutation = useLogFrequency();
  const advanceMutation = useAdvancePhase();
  const deleteMutation = useDeleteQuit();
  const updateProfileMutation = useUpdateTriggerProfile();
  const createMutation = useCreateQuitPath();
  const manageRef = useRef<BottomSheetModal>(null);
  const [manageTarget, setManageTarget] = useState<QuitTarget | null>(null);
  const [insight, setInsight] = useState<{ title: string; body: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuitTarget | null>(null);
  const [profileVisible, setProfileVisible] = useState(false);
  const [profileHabitName, setProfileHabitName] = useState("");
  const [profileInitial, setProfileInitial] = useState<
    Partial<Pick<QuitTargetInput, "contexts" | "awareness" | "quit_goal">> | undefined
  >(undefined);
  const [addNameModal, setAddNameModal] = useState(false);
  const [addNameDraft, setAddNameDraft] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [advancingPathId, setAdvancingPathId] = useState<string | null>(null);
  const editingPathIdRef = useRef<string | null>(null);
  /** True after submitting a new quit (not profile edit) until the list includes the path or error/timeout. */
  const [creatingQuitPath, setCreatingQuitPath] = useState(false);

  const openManage = useCallback((t: QuitTarget) => {
    setManageTarget(t);
    manageRef.current?.present();
  }, []);

  const closeManage = useCallback(() => {
    setManageTarget(null);
  }, []);

  const onFrequencyLog = useCallback(
    (pathId: string, count: number) => {
      logMutation.mutate({ pathId, count });
    },
    [logMutation]
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
            },
          }
        );
        return;
      }
      createMutation.mutate({
        habit_name: profile.name,
        trigger_contexts: profile.contexts,
        awareness_level: profile.awareness,
        quit_goal: profile.quit_goal,
      });
      setAddNameDraft("");
    },
    [createMutation, updateProfileMutation]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync(deleteTarget.path_id);
      setDeleteTarget(null);
      manageRef.current?.dismiss();
      setManageTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleteMutation]);

  if (isError) {
    return (
      <View style={styles.flex}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          nestedScrollEnabled
        >
          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerTxt}>
              ALTER EGO provides habit-tracking tools and behavioural suggestions for general wellbeing. It is not a
              medical or addiction treatment service. For serious dependencies, always consult a doctor or licensed
              counsellor.
            </Text>
          </View>
          <Text style={{ color: "#9CA3AF", textAlign: "center", marginBottom: 12 }}>
            Couldn&apos;t load quit targets.
          </Text>
          <Pressable onPress={() => refetch()} style={styles.nameModalPrimary}>
            <Text style={styles.nameModalPrimaryTxt}>Retry</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  const showSkeleton = isLoading && targets.length === 0;
  const showEmpty = !isLoading && targets.length === 0;
  const showQuitPreparingEmpty = showEmpty && (creatingQuitPath || createMutation.isPending);

  const scrollContentCombined = [
    styles.scrollContent,
    showEmpty && !showSkeleton && styles.scrollContentEmptyCentered,
  ];

  const scrollMaintain =
    Platform.OS === "ios"
      ? {
          maintainVisibleContentPosition: {
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 100,
          },
        }
      : {};

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={scrollContentCombined}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !showSkeleton}
            onRefresh={() => refetch()}
            tintColor="#8B5CF6"
          />
        }
        {...scrollMaintain}
      >
        {showSkeleton ? (
          <>
            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerTxt}>
                ALTER EGO provides habit-tracking tools and behavioural suggestions for general wellbeing. It is not a
                medical or addiction treatment service. For serious dependencies, always consult a doctor or licensed
                counsellor.
              </Text>
            </View>
            <SkeletonCard />
            <View style={{ height: 12 }} />
            <SkeletonCard />
          </>
        ) : showEmpty ? (
          showQuitPreparingEmpty ? (
            <View style={styles.emptyCard}>
              <ActivityIndicator size="large" color="#8B5CF6" />
              <Text style={styles.preparingTitle}>Building your path</Text>
              <Text style={styles.preparingSub}>
                We&apos;re setting up your quit plan on our servers. This can take a little while while we prepare
                missions and insights for you.
              </Text>
              <Text style={styles.preparingHint}>
                You can leave this tab — your target will show up when it&apos;s ready. Pull down to refresh if needed.
              </Text>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nothing to quit yet</Text>
              <Text style={styles.emptySub}>
                Add a habit you want to break and we&apos;ll build a plan specific to your triggers.
              </Text>
              <Pressable
                style={styles.addDashed}
                onPress={() => {
                  setAddNameModal(true);
                }}
              >
                <Text style={styles.addPlus}>+</Text>
                <Text style={styles.addTxt}>Add Quit Target</Text>
              </Pressable>
            </View>
          )
        ) : (
          <>
            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerTxt}>
                ALTER EGO provides habit-tracking tools and behavioural suggestions for general wellbeing. It is not a
                medical or addiction treatment service. For serious dependencies, always consult a doctor or licensed
                counsellor.
              </Text>
            </View>
            {targets.map((t) => (
              <QuitCard
                key={t.path_id}
                target={t}
                onFrequencyLog={onFrequencyLog}
                onMenuPress={() => openManage(t)}
                onInsightPress={(title, body) => setInsight({ title, body })}
                onAdvancePhase={() => {
                  setAdvancingPathId(t.path_id);
                  advanceMutation.mutate(t.path_id, {
                    onSettled: () => setAdvancingPathId(null),
                    onSuccess: (data) => {
                      const ins =
                        data && typeof data === "object" && "insight" in data
                          ? (data as { insight?: { title: string; body: string } }).insight
                          : undefined;
                      if (ins?.title && ins?.body) setInsight({ title: ins.title, body: ins.body });
                    },
                  });
                }}
                advancing={advancingPathId === t.path_id}
              />
            ))}
            {creatingQuitPath || createMutation.isPending ? (
              <View style={styles.preparingBanner}>
                <ActivityIndicator size="small" color="#8B5CF6" />
                <View style={styles.preparingBannerText}>
                  <Text style={styles.preparingBannerTitle}>Building your path</Text>
                  <Text style={styles.preparingBannerSub}>
                    We&apos;re setting up your quit plan on our servers (missions and insights). This can take a little
                    while — you can leave this tab. Pull down to refresh when you&apos;re back.
                  </Text>
                </View>
              </View>
            ) : null}
            <Pressable
              style={styles.addDashedList}
              onPress={() => {
                setAddNameDraft("");
                setAddNameModal(true);
              }}
            >
              <Text style={styles.addPlus}>+</Text>
              <Text style={styles.addTxt}>Add Quit Target</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <QuitManageSheet
        sheetRef={manageRef}
        target={manageTarget}
        onDismiss={closeManage}
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

      <Modal visible={addNameModal} transparent animationType="fade">
        <Pressable style={styles.nameModalBackdrop} onPress={() => setAddNameModal(false)}>
          <Pressable style={styles.nameModalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.nameModalTitle}>New quit target</Text>
            <TextInput
              style={styles.nameModalInput}
              placeholder="What do you want to quit?"
              placeholderTextColor="#6B7280"
              value={addNameDraft}
              onChangeText={setAddNameDraft}
            />
            <View style={styles.nameModalRow}>
              <Pressable style={styles.nameModalGhost} onPress={() => setAddNameModal(false)}>
                <Text style={styles.nameModalGhostTxt}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.nameModalPrimary, addNameDraft.trim().length < 2 && { opacity: 0.4 }]}
                disabled={addNameDraft.trim().length < 2}
                onPress={() => {
                  setProfileHabitName(addNameDraft.trim());
                  setProfileInitial(undefined);
                  setAddNameModal(false);
                  setProfileVisible(true);
                }}
              >
                <Text style={styles.nameModalPrimaryTxt}>Continue</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  disclaimerBox: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(107,114,128,0.06)",
    borderWidth: 1,
    borderColor: "rgba(107,114,128,0.14)",
    marginBottom: 14,
  },
  disclaimerTxt: {
    fontSize: 11,
    color: "#6B7280",
    lineHeight: 17.6,
    fontFamily: "Inter_400Regular",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 },
  /** Vertical center for empty / preparing-only content inside the main ScrollView */
  scrollContentEmptyCentered: { flexGrow: 1, justifyContent: "center", paddingTop: 24, paddingBottom: 48 },
  skelCard: {
    height: 380,
    borderRadius: 18,
    backgroundColor: "#0C0E1A",
    borderWidth: 1,
    borderColor: "#1A1F30",
    padding: 16,
  },
  skelLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#1A1F30",
    marginBottom: 10,
    width: "70%",
  },
  skelBarRow: { flexDirection: "row", gap: 4, alignItems: "flex-end", height: 28 },
  skelBar: { flex: 1, height: 18, borderRadius: 3, backgroundColor: "#1A1F30" },
  emptyCard: {
    backgroundColor: "#0C0A0A",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    padding: 24,
    alignItems: "center",
  },
  preparingTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
    textAlign: "center",
    marginTop: 20,
    marginBottom: 8,
  },
  preparingSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 12,
  },
  preparingHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 17,
  },
  preparingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#141824",
    borderWidth: 1,
    borderColor: "#2A3050",
    marginBottom: 14,
  },
  preparingBannerText: { flex: 1 },
  preparingBannerTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#E5E7EB",
  },
  preparingBannerSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    marginTop: 2,
    lineHeight: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
    textAlign: "center",
  },
  emptySub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 18,
  },
  addDashed: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    width: "100%",
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: QUIT_ORANGE.border,
    backgroundColor: QUIT_ORANGE.surface,
  },
  addDashedList: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: QUIT_ORANGE.border,
    backgroundColor: QUIT_ORANGE.surface,
    marginBottom: 24,
  },
  addPlus: { fontSize: 18, color: QUIT_ORANGE.muted, fontFamily: "Inter_700Bold" },
  addTxt: { fontSize: 13, color: QUIT_ORANGE.text, fontFamily: "Inter_600SemiBold" },
  nameModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    padding: 24,
  },
  nameModalCard: {
    backgroundColor: "#100C0C",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 20,
  },
  nameModalTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#E5E7EB", marginBottom: 12 },
  nameModalInput: {
    backgroundColor: "#12100F",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: QUIT_ORANGE.border,
    padding: 14,
    fontSize: 14,
    color: "#E5E7EB",
    marginBottom: 16,
  },
  nameModalRow: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  nameModalGhost: { paddingVertical: 10, paddingHorizontal: 12 },
  nameModalGhostTxt: { color: "#6B7280", fontFamily: "Inter_600SemiBold" },
  nameModalPrimary: {
    backgroundColor: QUIT_ORANGE.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  nameModalPrimaryTxt: { color: "#FFFFFF", fontFamily: "Inter_700Bold" },
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
