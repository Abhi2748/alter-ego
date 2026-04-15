/**
 * Profile → Interests (paths, quests, manage sheets).
 */

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { InterestsTab } from "@/components/profile/InterestsTab";
import type { ProfileStackParamList } from "@/navigation/types";
import { InterestPlanScreen } from "@/components/InterestPlanScreen";
import { useInterests } from "@/hooks/useInterests";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { InterestPathDisplay } from "@/types/interestPath";

export function ProfileInterestsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ProfileStackParamList, "ProfileInterests">>();
  const pendingSheet = route.params?.pendingSheet;
  const pathIdParam = route.params?.pathId;
  const pendingSheetIntent =
    pendingSheet && pathIdParam ? { sheet: pendingSheet, pathId: pathIdParam } : null;
  const { data: interestsData } = useInterests();
  const [planQueue, setPlanQueue] = useState<InterestPathDisplay[]>([]);
  const [planQueueIdx, setPlanQueueIdx] = useState(0);
  const [planChecked, setPlanChecked] = useState(false);

  const consumePendingSheet = useCallback(() => {
    navigation.setParams({ pendingSheet: undefined, pathId: undefined } as never);
  }, [navigation]);

  useEffect(() => {
    if (!interestsData?.paths || planChecked) return;
    setPlanChecked(true);
    const checkPlans = async () => {
      const unseen: InterestPathDisplay[] = [];
      for (const p of interestsData.paths) {
        const key = `plan_seen_${p.path_id}`;
        const seen = await AsyncStorage.getItem(key).catch(() => null);
        if (!seen && p.achievable_outcome) {
          unseen.push(p);
        }
      }
      if (unseen.length > 0) {
        setPlanQueue(unseen);
        setPlanQueueIdx(0);
      }
    };
    void checkPlans();
  }, [interestsData?.paths, planChecked]);

  const handlePlanConfirm = useCallback(async () => {
    const current = planQueue[planQueueIdx];
    if (current) {
      await AsyncStorage.setItem(`plan_seen_${current.path_id}`, "1").catch(() => {});
    }
    if (planQueueIdx + 1 < planQueue.length) {
      setPlanQueueIdx((i) => i + 1);
    } else {
      setPlanQueue([]);
    }
  }, [planQueue, planQueueIdx]);

  return (
    <LinearGradient
      colors={["#09091A", "#07080F"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.root}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {Platform.OS === "ios" ? <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} /> : null}
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color="#6B7280" />
          </Pressable>
          <Text style={styles.headerTitle}>Interests</Text>
          <View style={styles.backBtn} />
        </View>
      </View>
      {planQueue.length > 0 && planQueueIdx < planQueue.length ? (
        <View style={[StyleSheet.absoluteFill, { zIndex: 50 }]}>
          <InterestPlanScreen
            interest={{
              name: planQueue[planQueueIdx].interest_name,
              level_label: planQueue[planQueueIdx].experience_label ?? "Beginner",
              timeline_label: planQueue[planQueueIdx].target_date
                ? `Goal: ${new Date(planQueue[planQueueIdx].target_date!).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
                : "Open practice",
              achievable_outcome: planQueue[planQueueIdx].achievable_outcome,
              progression_milestones: planQueue[planQueueIdx].progression_milestones,
              recommended_resources: planQueue[planQueueIdx].recommended_resources,
            }}
            onConfirm={handlePlanConfirm}
            ctaLabel={
              planQueueIdx + 1 < planQueue.length
                ? `Got it — next interest (${planQueueIdx + 2}/${planQueue.length})`
                : "Start my journey"
            }
          />
        </View>
      ) : null}
      <View style={styles.body}>
        <InterestsTab
          pendingSheetIntent={pendingSheetIntent}
          onPendingSheetConsumed={consumePendingSheet}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, minHeight: 0 },
  header: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.35)",
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#E5E7EB",
    fontFamily: "Inter_700Bold",
  },
});
