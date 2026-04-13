import { useQuery } from '@tanstack/react-query';
import { achievementsService, type AchievementsResponse } from '@/services/achievements';

export const ACHIEVEMENT_KEYS = {
  all: ['achievements'] as const,
};

export function useAchievements() {
  return useQuery<AchievementsResponse | null>({
    queryKey: ACHIEVEMENT_KEYS.all,
    queryFn: async () => {
      try {
        return await achievementsService.getAll();
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    throwOnError: false,
  });
}
