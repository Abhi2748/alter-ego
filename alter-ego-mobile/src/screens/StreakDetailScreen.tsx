/**
 * Full-screen streak detail — opened from Home streak strip or Profile → Streak hero.
 */

import React, { useCallback, useRef } from "react";
import type { ParamListBase } from "@react-navigation/native";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { MainStackParamList } from "@/navigation/types";
import { StreakDetailContent } from "@/components/StreakDetailModal";
import { useUserStore } from "@/store/userStore";
import { useProfileStreak } from "@/hooks/useProfile";
import type { StreakHeatmapEntry } from "@/components/StreakDetailModal";

type StreakApiShape = {
  current_streak?: number;
  longest_streak?: number;
  streak_freeze_count?: number;
  heatmap?: StreakHeatmapEntry[];
};

export function StreakDetailScreen() {
  const navigation = useNavigation<StackNavigationProp<MainStackParamList>>();
  const closeOnceRef = useRef(false);
  const profile = useUserStore((s) => s.profile);
  const { data } = useProfileStreak();
  const streakProfile = data as StreakApiShape | undefined;

  const currentStreak = streakProfile?.current_streak ?? profile?.current_streak ?? 0;
  const longestStreak = streakProfile?.longest_streak ?? profile?.longest_streak ?? 0;
  const freezeCount = streakProfile?.streak_freeze_count ?? profile?.streak_freeze_count ?? 0;
  const heatmap = streakProfile?.heatmap ?? [];

  /**
   * Pop the stack (same as Day detail) so the card exits left→right. Navigating to MainTabs
   * replays a “push” transition and looks reversed on close.
   */
  const onClose = useCallback(() => {
    if (closeOnceRef.current) return;
    closeOnceRef.current = true;
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      const nav = navigation as unknown as StackNavigationProp<ParamListBase>;
      nav.navigate("MainTabs", { screen: "Home" });
    }
  }, [navigation]);

  return (
    <StreakDetailContent
      onClose={onClose}
      currentStreak={currentStreak}
      longestStreak={longestStreak}
      freezeCount={freezeCount}
      heatmap={heatmap}
    />
  );
}
