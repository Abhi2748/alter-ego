/**
 * Full-screen streak detail — opened from Home streak strip or Profile → Streak hero.
 */

import React from "react";
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
  const profile = useUserStore((s) => s.profile);
  const { data } = useProfileStreak();
  const streakProfile = data as StreakApiShape | undefined;

  const currentStreak = streakProfile?.current_streak ?? profile?.current_streak ?? 0;
  const longestStreak = streakProfile?.longest_streak ?? profile?.longest_streak ?? 0;
  const freezeCount = streakProfile?.streak_freeze_count ?? profile?.streak_freeze_count ?? 0;
  const heatmap = streakProfile?.heatmap ?? [];

  return (
    <StreakDetailContent
      onClose={() => navigation.goBack()}
      currentStreak={currentStreak}
      longestStreak={longestStreak}
      freezeCount={freezeCount}
      heatmap={heatmap}
    />
  );
}
