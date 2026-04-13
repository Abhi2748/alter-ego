/**
 * Hook to fetch the user's current season.
 * Returns null data gracefully if no season is active.
 */

import { useQuery } from '@tanstack/react-query';
import { seasonService, type CurrentSeason } from '@/services/season';

export const SEASON_KEYS = {
  current: ['season', 'current'] as const,
};

export function useCurrentSeason() {
  return useQuery<CurrentSeason | null>({
    queryKey: SEASON_KEYS.current,
    queryFn: async () => {
      try {
        return await seasonService.getCurrentSeason();
      } catch {
        // Backend not yet built or no active season — return null silently
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    throwOnError: false,
  });
}
