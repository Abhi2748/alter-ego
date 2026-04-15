import React, { useCallback, useEffect, useRef, useState } from "react";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { ProfileStackParamList } from "@/navigation/types";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import {
  useInterests,
  useUpdateDifficulty,
  useUpdateSchedule,
  useChangeGoal,
  useDeleteInterest,
  useCreateInterest,
  usePauseInterest,
  useResumeInterest,
  useUpdateTimeline,
} from "@/hooks/useInterests";
import type { InterestInsight, InterestPathDisplay } from "@/types/interestPath";
import { InterestCard } from "@/components/profile/InterestCard";
import { ManageSheet } from "@/components/profile/interest/ManageSheet";
import { DifficultySheet } from "@/components/profile/interest/DifficultySheet";
import { ScheduleSheet } from "@/components/profile/interest/ScheduleSheet";
import { TimelineSheet } from "@/components/profile/interest/TimelineSheet";
import { ChangeGoalFlow } from "@/components/profile/interest/ChangeGoalFlow";
import { DeleteModal } from "@/components/profile/interest/DeleteModal";
import { InsightModal } from "@/components/profile/interest/InsightModal";
import { getErrorMessage, isApiError } from "@/services/api";
import { AddInterestSheet } from "@/components/AddInterestSheet";
import { PROFILE_KEYS } from "@/hooks/useProfile";

function SkeletonCard() {
  const o = useSharedValue(0.4);
  React.useEffect(() => {
    o.value = withRepeat(
      withTiming(0.7, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[styles.skelCard, style]}>
      <View style={styles.skelLine} />
      <View style={[styles.skelLine, { width: "60%" }]} />
      <View style={[styles.skelLine, { width: "40%", marginTop: 24 }]} />
    </Animated.View>
  );
}

type PendingSheetIntent = { sheet: "schedule" | "goal" | "timeline"; pathId: string } | null;

type InterestsTabProps = {
  pendingSheetIntent?: PendingSheetIntent;
  onPendingSheetConsumed?: () => void;
};

export function InterestsTab({
  pendingSheetIntent = null,
  onPendingSheetConsumed,
}: InterestsTabProps) {
  const queryClient = useQueryClient();
  const navigation = useNavigation<StackNavigationProp<ProfileStackParamList>>();
  const { data, isLoading, isError, refetch, isFetching } = useInterests();
  const updateDifficulty = useUpdateDifficulty();
  const updateSchedule = useUpdateSchedule();
  const updateTimeline = useUpdateTimeline();
  const changeGoal = useChangeGoal();
  const deleteInterest = useDeleteInterest();
  const createInterest = useCreateInterest();
  const pauseInterest = usePauseInterest();
  const resumeInterest = useResumeInterest();

  const manageSheetRef = useRef<BottomSheetModal>(null);
  const difficultySheetRef = useRef<BottomSheetModal>(null);
  const scheduleSheetRef = useRef<BottomSheetModal>(null);
  const timelineSheetRef = useRef<BottomSheetModal>(null);
  const suppressManagePathClear = useRef(false);
  const pendingProcessedKeyRef = useRef<string | null>(null);

  const [managedPath, setManagedPath] = useState<InterestPathDisplay | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "err" | "ok" } | null>(null);
  const [goalFlowOpen, setGoalFlowOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [insightOpen, setInsightOpen] = useState(false);
  const [insightPayload, setInsightPayload] = useState<{
    title: string;
    body: string;
    color: string;
  } | null>(null);
  const [addInterestOpen, setAddInterestOpen] = useState(false);

  const paths = data?.paths ?? [];
  const activePaths = paths.filter((p) => !p.arc_paused);
  const pausedPaths = paths.filter((p) => p.arc_paused);

  const openAddInterest = useCallback(() => setAddInterestOpen(true), []);

  const handleManageSheetDismiss = useCallback(() => {
    if (suppressManagePathClear.current) {
      suppressManagePathClear.current = false;
      return;
    }
    setManagedPath(null);
  }, []);

  const dismissManageThen = useCallback((then: () => void) => {
    suppressManagePathClear.current = true;
    manageSheetRef.current?.dismiss();
    setTimeout(then, 120);
  }, []);

  useEffect(() => {
    if (!pendingSheetIntent) {
      pendingProcessedKeyRef.current = null;
      return;
    }
    if (isLoading && !data) return;
    if (!data?.paths?.length) return;
    const p = data.paths.find((x) => x.path_id === pendingSheetIntent.pathId);
    if (!p) return;
    const sig = `${pendingSheetIntent.pathId}:${pendingSheetIntent.sheet}`;
    if (pendingProcessedKeyRef.current === sig) return;
    pendingProcessedKeyRef.current = sig;
    setManagedPath(p);
    const t = setTimeout(() => {
      if (pendingSheetIntent.sheet === "schedule") scheduleSheetRef.current?.present();
      else if (pendingSheetIntent.sheet === "goal") setGoalFlowOpen(true);
      else if (pendingSheetIntent.sheet === "timeline") timelineSheetRef.current?.present();
      onPendingSheetConsumed?.();
    }, 120);
    return () => clearTimeout(t);
  }, [pendingSheetIntent, data?.paths, onPendingSheetConsumed, isLoading]);

  const openManage = useCallback((p: InterestPathDisplay) => {
    setManagedPath(p);
    requestAnimationFrame(() => manageSheetRef.current?.present());
  }, []);

  const openInterestDetail = useCallback(
    (p: InterestPathDisplay) => {
      navigation.navigate("ProfileInterestDetail", { pathId: p.path_id });
    },
    [navigation]
  );

  const showError = (e: unknown) => {
    const msg = isApiError(e) ? e.message : getErrorMessage(e);
    setToast({ msg: msg || "Something went wrong.", kind: "err" });
    setTimeout(() => setToast(null), 3200);
  };

  const handlePause = async (pathId: string) => {
    try {
      await pauseInterest.mutateAsync({ interestId: pathId });
      setToast({ msg: "Arc paused. Missions will stop until you resume.", kind: "ok" });
      setTimeout(() => setToast(null), 2800);
    } catch (e) {
      showError(e);
    }
  };

  const handleResume = async (pathId: string) => {
    try {
      await resumeInterest.mutateAsync(pathId);
      setToast({ msg: "Arc resumed. Missions will appear tomorrow.", kind: "ok" });
      setTimeout(() => setToast(null), 2800);
    } catch (e) {
      showError(e);
    }
  };

  const handleInsightTap = (ins: InterestInsight, colorHex: string) => {
    if (!ins.unlocked) return;
    setInsightPayload({
      title: ins.title,
      body: ins.body,
      color: colorHex.startsWith("#") ? colorHex : `#${colorHex}`,
    });
    setInsightOpen(true);
  };

  if (isLoading && !data) {
    return (
      <View style={styles.root}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.contentPad}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SkeletonCard />
          <View style={{ height: 14 }} />
          <SkeletonCard />
        </ScrollView>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.root}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.contentPad}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.emptyWrap}>
            <Text style={styles.errTxt}>Couldn&apos;t load interests.</Text>
            <Pressable onPress={() => refetch()} style={styles.retry}>
              <Text style={styles.retryTxt}>{isFetching ? "…" : "Retry"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (paths.length === 0) {
    return (
      <View style={styles.root}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.contentPad}
          keyboardShouldPersistTaps="handled"
        >
          {createInterest.isPending ? (
            <View style={styles.emptyPreparing}>
              <ActivityIndicator size="large" color="#8B5CF6" />
              <Text style={styles.emptyPreparingTitle}>Building your interest</Text>
              <Text style={styles.emptyPreparingSub}>
                We&apos;re creating your path on our servers (missions and insights). This can take a little while.
              </Text>
              <Text style={styles.emptyPreparingHint}>
                You can leave this screen — your interest will show up when it&apos;s ready. Pull down to refresh.
              </Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No interests yet</Text>
              <Text style={styles.emptySub}>
                Add an interest to build a path toward a real goal.
              </Text>
              <Pressable style={styles.addPrimaryWrap} onPress={openAddInterest}>
                <LinearGradient
                  colors={["#6D28D9", "#8B5CF6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.addPrimary}
                >
                  <Text style={styles.addPrimaryTxt}>+ Add Interest</Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}
        </ScrollView>
        <AddInterestSheet
          visible={addInterestOpen}
          onClose={() => setAddInterestOpen(false)}
          onSave={(payload, handlers) => {
            createInterest.mutate(payload, {
              onError: (e) => {
                handlers.onError(e);
              },
              onSuccess: async (data) => {
                await queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.interests });
                setToast({ msg: "Interest added. Your path is ready.", kind: "ok" });
                setTimeout(() => setToast(null), 2800);
                handlers.onSuccess(data?.interest_id ?? null);
              },
            });
          }}
          onSaveError={showError}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        {toast ? (
          <View style={toast.kind === "err" ? styles.toastErr : styles.toastOk}>
            <Text style={toast.kind === "err" ? styles.toastErrTxt : styles.toastOkTxt}>
              {toast.msg}
            </Text>
          </View>
        ) : null}

        {createInterest.isPending ? (
          <View style={styles.preparingBanner}>
            <ActivityIndicator size="small" color="#8B5CF6" />
            <View style={styles.preparingBannerText}>
              <Text style={styles.preparingBannerTitle}>Building your interest</Text>
              <Text style={styles.preparingBannerSub}>
                We&apos;re creating your path on our servers (missions and insights). This can take a little while — you
                can leave this screen. Pull down to refresh when you&apos;re back.
              </Text>
            </View>
          </View>
        ) : null}

        {activePaths.map((p) => (
          <Pressable key={p.path_id} onPress={() => openInterestDetail(p)}>
            <InterestCard path={p} onManage={openManage} onInsightTap={handleInsightTap} />
          </Pressable>
        ))}

        {pausedPaths.length > 0 ? (
          <>
            <View style={styles.pausedDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>Paused</Text>
              <View style={styles.dividerLine} />
            </View>
            {pausedPaths.map((p) => (
              <View key={p.path_id} style={{ position: "relative" }}>
                <Pressable onPress={() => openInterestDetail(p)}>
                  <InterestCard path={p} onManage={openManage} onInsightTap={handleInsightTap} />
                </Pressable>
                <Pressable style={styles.resumeBtn} onPress={() => void handleResume(p.path_id)}>
                  <Text style={styles.resumeBtnText}>Resume →</Text>
                </Pressable>
              </View>
            ))}
          </>
        ) : null}

        <Pressable style={styles.addDashed} onPress={openAddInterest}>
          <Text style={styles.addDashedPlus}>+</Text>
          <Text style={styles.addDashedTxt}>Add New Interest</Text>
        </Pressable>
      </ScrollView>

      <AddInterestSheet
        visible={addInterestOpen}
        onClose={() => setAddInterestOpen(false)}
        onSave={(payload, handlers) => {
          createInterest.mutate(payload, {
            onError: (e) => {
              handlers.onError(e);
            },
            onSuccess: async (data) => {
              await queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.interests });
              setToast({ msg: "Interest added. Your path is ready.", kind: "ok" });
              setTimeout(() => setToast(null), 2800);
              handlers.onSuccess(data?.interest_id ?? null);
            },
          });
        }}
        onSaveError={showError}
      />

      <ManageSheet
        sheetRef={manageSheetRef}
        path={managedPath}
        onDismiss={handleManageSheetDismiss}
        onChangeDifficulty={() =>
          dismissManageThen(() => difficultySheetRef.current?.present())
        }
        onChangeSchedule={() =>
          dismissManageThen(() => scheduleSheetRef.current?.present())
        }
        onChangeGoal={() => dismissManageThen(() => setGoalFlowOpen(true))}
        onPause={() => {
          if (!managedPath) return;
          dismissManageThen(() => void handlePause(managedPath.path_id));
        }}
        onDelete={() => dismissManageThen(() => setDeleteOpen(true))}
      />

      <DifficultySheet
        sheetRef={difficultySheetRef}
        path={managedPath}
        onSave={async (tier) => {
          if (!managedPath) return;
          try {
            await updateDifficulty.mutateAsync({ pathId: managedPath.path_id, tier });
          } catch (e) {
            showError(e);
            throw e;
          }
        }}
      />

      <ScheduleSheet
        sheetRef={scheduleSheetRef}
        path={managedPath}
        onSave={async (days) => {
          if (!managedPath) return;
          try {
            await updateSchedule.mutateAsync({
              pathId: managedPath.path_id,
              active_days: days,
            });
          } catch (e) {
            showError(e);
            throw e;
          }
        }}
      />

      <TimelineSheet
        sheetRef={timelineSheetRef}
        path={managedPath}
        onSave={async (target_timeline) => {
          if (!managedPath) return;
          try {
            await updateTimeline.mutateAsync({
              interestId: managedPath.path_id,
              target_timeline,
            });
            setToast({ msg: "Timeline updated. Your arc will adjust.", kind: "ok" });
            setTimeout(() => setToast(null), 2800);
          } catch (e) {
            showError(e);
            throw e;
          }
        }}
      />

      <ChangeGoalFlow
        visible={goalFlowOpen}
        onClose={() => setGoalFlowOpen(false)}
        interestName={managedPath?.interest_name ?? ""}
        insightsUnlocked={managedPath?.insights_unlocked_count ?? 0}
        onSubmit={async (goal, level) => {
          if (!managedPath) return;
          await changeGoal.mutateAsync({
            pathId: managedPath.path_id,
            new_goal: goal,
            experience_level: level,
          });
        }}
        onSubmitError={showError}
        onSuccessMessage={() => {
          setToast({ msg: "Path reset. Building new plan...", kind: "ok" });
          setTimeout(() => setToast(null), 2800);
        }}
      />

      <DeleteModal
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        interestName={managedPath?.interest_name ?? ""}
        questsCompleted={managedPath?.completed_quests_count ?? 0}
        insightsUnlocked={managedPath?.insights_unlocked_count ?? 0}
        onDelete={async () => {
          if (!managedPath) return;
          try {
            await deleteInterest.mutateAsync(managedPath.path_id);
          } catch (e) {
            showError(e);
            throw e;
          }
        }}
      />

      <InsightModal
        visible={insightOpen && !!insightPayload?.title}
        onClose={() => {
          setInsightOpen(false);
          setInsightPayload(null);
        }}
        colorHex={insightPayload?.color ?? "#8B5CF6"}
        title={insightPayload?.title ?? ""}
        body={insightPayload?.body ?? ""}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, backgroundColor: "#07080F" },
  scroll: { flex: 1 },
  contentPad: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 88 },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 88,
    flexGrow: 1,
  },
  skelCard: {
    height: 420,
    borderRadius: 18,
    backgroundColor: "#0C0E1A",
    padding: 16,
  },
  skelLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#1A1F30",
    marginBottom: 10,
    width: "85%",
  },
  emptyWrap: {
    paddingHorizontal: 24,
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
    textAlign: "center",
  },
  emptySub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 20,
  },
  addPrimaryWrap: { borderRadius: 14, overflow: "hidden" },
  addPrimary: {
    height: 48,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  addPrimaryTxt: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_700Bold" },
  errTxt: { color: "#9CA3AF", marginBottom: 12, fontSize: 14 },
  retry: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A3050",
  },
  retryTxt: { color: "#A78BFA", fontFamily: "Inter_600SemiBold" },
  addDashed: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(139,92,246,0.05)",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(139,92,246,0.18)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginBottom: 24,
  },
  addDashedPlus: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: "rgba(139,92,246,0.45)",
  },
  addDashedTxt: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(139,92,246,0.45)",
  },
  toastErr: {
    backgroundColor: "rgba(127,29,29,0.35)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.35)",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  toastErrTxt: { color: "#FCA5A5", fontSize: 12, textAlign: "center" },
  toastOk: {
    backgroundColor: "rgba(139,92,246,0.12)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.35)",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  toastOkTxt: { color: "#C4B5FD", fontSize: 12, textAlign: "center" },
  pausedDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(42,48,80,0.3)",
  },
  dividerLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#2A3050",
  },
  resumeBtn: {
    position: "absolute",
    bottom: 20,
    right: 22,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  resumeBtnText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(139,92,246,0.5)",
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
  emptyPreparing: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: "center",
    backgroundColor: "#141824",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A3050",
  },
  emptyPreparingTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
    marginTop: 16,
    textAlign: "center",
  },
  emptyPreparingSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 18,
  },
  emptyPreparingHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    marginTop: 12,
    textAlign: "center",
    lineHeight: 17,
  },
});
