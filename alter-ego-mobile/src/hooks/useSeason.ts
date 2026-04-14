/**
 * Hook to fetch the user's current season.
 * Returns null data gracefully if no season is active.
 */

import { useQuery } from '@tanstack/react-query';
import {
  seasonService,
  type CurrentSeason,
  type SeasonHistoryResponse,
} from '@/services/season';

export const SEASON_KEYS = {
  current: ['season', 'current'] as const,
  history: ['season', 'history'] as const,
};

export function useCurrentSeason() {
  return useQuery<CurrentSeason | null>({
    queryKey: SEASON_KEYS.current,
    queryFn: async () => {
      try {
        return await seasonService.getCurrentSeason();
      } catch {
        // Endpoint missing, auth error, or unexpected failure — treat as no season
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    throwOnError: false,
  });
}

export function useSeasonHistory() {
  return useQuery<SeasonHistoryResponse>({
    queryKey: SEASON_KEYS.history,
    queryFn: async () => {
      try {
        return await seasonService.getSeasonHistory();
      } catch {
        return { history: [], total: 0 };
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    throwOnError: false,
  });
}
