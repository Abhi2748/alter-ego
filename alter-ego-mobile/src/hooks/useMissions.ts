/**
 * React Query hooks for missions.
 * Handles caching, background refresh, and optimistic updates.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  missionsService,
  fetchMissionDetail,
  type CompleteMissionResponse,
  type Mission,
  type TodayMissionsResponse,
} from "@/services/missions";
import { useUserStore } from "@/store/userStore";
import { PROFILE_KEYS } from "@/hooks/useProfile";
import { STATS_KEYS } from "@/hooks/useStats";
import { SIGIL_KEYS } from "@/hooks/useSigil";
import { SEASON_KEYS } from "@/hooks/useSeason";
import { triggerMissionCompletionHaptic } from "@/utils/haptics";

// Query keys — centralised so invalidation works correctly
export const MISSION_KEYS = {
  today: ["missions", "today"] as const,
  byDate: (date: string) => ["missions", "date", date] as const,
  detail: (missionId: string) => ["missions", "detail", missionId] as const,
};

function findMissionById(
  data: TodayMissionsResponse | undefined,
  missionId: string
): Mission | undefined {
  if (!data?.missions) return undefined;
  const { core, interest, resistance, personal } = data.missions;
  return [...core, ...interest, ...resistance, ...personal].find((m) => m.id === missionId);
}

// ── Fetch today's missions ─────────────────────────────────────────────────

const TODAY_MISSIONS_STALE_MS = 2 * 60 * 1000;

export function useTodayMissions() {
  return useQuery({
    queryKey: MISSION_KEYS.today,
    queryFn: missionsService.getTodayMissions,
    staleTime: TODAY_MISSIONS_STALE_MS,
    refetchOnMount: true,
  });
}

export function useMissionDetail(missionId: string) {
  return useQuery({
    queryKey: MISSION_KEYS.detail(missionId),
    queryFn: () => fetchMissionDetail(missionId),
    enabled: !!missionId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Prefetch today's missions (e.g. during Archetype Reveal / 7-day screen) so Home loads from cache.
 */
export function prefetchTodayMissions(queryClient: QueryClient) {
  return queryClient.prefetchQuery({
    queryKey: MISSION_KEYS.today,
    queryFn: missionsService.getTodayMissions,
    staleTime: TODAY_MISSIONS_STALE_MS,
  });
}

/** Profile + cache updates after a successful mission completion (swipe, journal save, etc.). */
export async function applyMissionCompletionSideEffects(
  queryClient: QueryClient,
  result: CompleteMissionResponse
) {
  if (result.already_completed) return;

  void triggerMissionCompletionHaptic(result);

  const { profile, fetchProfile } = useUserStore.getState();
  if (!profile) {
    await fetchProfile();
  }

  const {
    updateXP,
    updatePF,
    updateStreak,
    updatePowerScore,
    updatePetStage,
  } = useUserStore.getState();

  updateXP(
    result.xp_earned,
    result.new_total_xp,
    result.stage_evolved
      ? {
          stage: result.stage_evolved.new_stage,
          name: result.stage_evolved.new_stage_name,
        }
      : undefined
  );
  updatePF(result.pf_earned, result.new_total_pf);

  if (result.streak_updated && result.current_streak != null) {
    updateStreak(result.current_streak);
  }

  if (result.pet_evolved) {
    updatePetStage(
      result.pet_evolved.new_stage,
      result.pet_evolved.new_pet_name
    );
  }

  if (result.power_score != null && typeof result.power_score === "number") {
    updatePowerScore(result.power_score);
  }

  queryClient.invalidateQueries({ queryKey: MISSION_KEYS.today });
  queryClient.invalidateQueries({ queryKey: ["missions", "detail"] });
  queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.streak });
  queryClient.invalidateQueries({ queryKey: ["twin", "state"] });
  queryClient.invalidateQueries({ queryKey: ["twin", "strip"] });
  queryClient.invalidateQueries({ queryKey: ["twin", "feed"] });
  queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.overview });
  queryClient.invalidateQueries({ queryKey: STATS_KEYS.all });
  queryClient.invalidateQueries({ queryKey: SIGIL_KEYS.all });
  queryClient.invalidateQueries({ queryKey: SEASON_KEYS.current });
}

// ── Complete a mission ─────────────────────────────────────────────────────

export function useCompleteMission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (missionId: string) =>
      missionsService.completeMission(missionId),

    onMutate: async (missionId: string) => {
      await queryClient.cancelQueries({ queryKey: MISSION_KEYS.today });

      const previousData =
        queryClient.getQueryData<TodayMissionsResponse>(MISSION_KEYS.today);

      const target = findMissionById(previousData, missionId);
      if (target?.is_journal_mission) {
        return { previousData };
      }

      queryClient.setQueryData<TodayMissionsResponse>(
        MISSION_KEYS.today,
        (old) => {
          if (!old) return old;
          const core = old.missions?.core ?? [];
          const interest = old.missions?.interest ?? [];
          const resistance = old.missions?.resistance ?? [];
          const personal = old.missions?.personal ?? [];
          const updateMissions = (missions: typeof core) =>
            missions.map((m) =>
              m.id === missionId
                ? { ...m, completed: true }
                : m
            );
          return {
            ...old,
            missions: {
              core: updateMissions(core),
              interest: updateMissions(interest),
              resistance: updateMissions(resistance),
              personal: updateMissions(personal),
            },
            summary: {
              ...old.summary,
              completed: old.summary.completed + 1,
            },
          };
        }
      );

      return { previousData };
    },

    onSuccess: (result: CompleteMissionResponse) => {
      void applyMissionCompletionSideEffects(queryClient, result);
    },

    onError: (_error, _missionId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(MISSION_KEYS.today, context.previousData);
      }
    },
  });
}

// ── Rate a mission ─────────────────────────────────────────────────────────

export function useRateMission() {
  return useMutation({
    mutationFn: ({
      missionId,
      rating,
      feedback,
    }: {
      missionId: string;
      rating: number;
      feedback?: string;
    }) =>
      missionsService.rateMission(missionId, {
        rating,
        feedback_text: feedback,
      }),
  });
}

// ── Delete personal mission ───────────────────────────────────────────────

export function useDeletePersonalMission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (missionId: string) => missionsService.deletePersonalMission(missionId),

    onMutate: async (missionId: string) => {
      await queryClient.cancelQueries({ queryKey: MISSION_KEYS.today });

      const previousData =
        queryClient.getQueryData<TodayMissionsResponse>(MISSION_KEYS.today);

      queryClient.setQueryData<TodayMissionsResponse>(
        MISSION_KEYS.today,
        (old) => {
          if (!old) return old;
          const prevPersonal = old.missions?.personal ?? [];
          const personal = prevPersonal.filter((m) => m.id !== missionId);
          return {
            ...old,
            missions: {
              ...old.missions,
              core: old.missions?.core ?? [],
              interest: old.missions?.interest ?? [],
              resistance: old.missions?.resistance ?? [],
              personal,
            },
            summary: {
              ...old.summary,
              total: Math.max(0, (old.summary?.total ?? 0) - 1),
            },
          };
        }
      );

      return { previousData };
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MISSION_KEYS.today });
    },

    onError: (_error, _missionId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(MISSION_KEYS.today, context.previousData);
      }
    },
  });
}
