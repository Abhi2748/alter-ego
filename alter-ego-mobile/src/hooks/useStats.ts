import { useQuery } from "@tanstack/react-query";
import { fetchCharacterStats, type CharacterStats } from "@/services/stats";

export const STATS_KEYS = {
  all: ["character_stats"] as const,
  detail: () => [...STATS_KEYS.all, "detail"] as const,
};

export function useCharacterStats(options?: { enabled?: boolean }) {
  return useQuery<CharacterStats>({
    queryKey: STATS_KEYS.detail(),
    queryFn: fetchCharacterStats,
    staleTime: 1000 * 60 * 2,
    retry: 2,
    enabled: options?.enabled !== false,
  });
}
