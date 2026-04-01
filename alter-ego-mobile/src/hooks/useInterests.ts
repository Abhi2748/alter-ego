import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profileService, type CreateInterestPayload } from '@/services/profile';
import { PROFILE_KEYS } from '@/hooks/useProfile';
import type { ProfileInterestApiRow } from '@/types/interestPath';
import { toInterestPathDisplay } from '@/types/interestPath';
import type { InterestPathDisplay } from '@/types/interestPath';

export function useInterests() {
  return useQuery({
    queryKey: PROFILE_KEYS.interests,
    queryFn: async () => {
      const data = (await profileService.getInterests()) as {
        interests: ProfileInterestApiRow[];
      };
      const rows = data.interests ?? [];
      const paths: InterestPathDisplay[] = rows.map((r) =>
        toInterestPathDisplay({
          ...r,
          name: r.name ?? null,
          user_goal: r.user_goal ?? null,
        })
      );
      return { interests: rows, paths };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });
}

export function useCompleteQuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pathId, questId }: { pathId: string; questId: string }) =>
      profileService.completeInterestQuest(pathId, questId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PROFILE_KEYS.interests });
    },
  });
}

export function useMarkCriterion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      pathId: string;
      questId: string;
      index: number;
      done: boolean;
    }) =>
      profileService.patchInterestQuestCriterion(vars.pathId, {
        quest_id: vars.questId,
        index: vars.index,
        done: vars.done,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PROFILE_KEYS.interests });
    },
  });
}

export function useUpdateDifficulty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { pathId: string; tier: 'easy' | 'medium' | 'hard' }) =>
      profileService.putInterestDifficulty(vars.pathId, vars.tier),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PROFILE_KEYS.interests });
    },
  });
}

export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { pathId: string; active_days: number[] }) =>
      profileService.putInterestSchedule(vars.pathId, vars.active_days),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PROFILE_KEYS.interests });
    },
  });
}

export function useCreateInterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateInterestPayload) => profileService.createInterest(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PROFILE_KEYS.interests });
    },
  });
}

export function useChangeGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      pathId: string;
      new_goal: string;
      experience_level: 'beginner' | 'intermediate' | 'advanced';
    }) => profileService.putInterestGoalPath(vars.pathId, vars),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PROFILE_KEYS.interests });
    },
  });
}

export function useDeleteInterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pathId: string) => profileService.deleteInterest(pathId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PROFILE_KEYS.interests });
    },
  });
}

export function usePauseInterest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ interestId, reason }: { interestId: string; reason?: string }) =>
      profileService.pauseInterest(interestId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.interests });
    },
  });
}

export function useResumeInterest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (interestId: string) => profileService.resumeInterest(interestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.interests });
    },
  });
}

export function useUpdateTimeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      interestId,
      target_timeline,
    }: {
      interestId: string;
      target_timeline: string;
    }) => profileService.updateInterestTimeline(interestId, target_timeline),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.interests });
    },
  });
}
