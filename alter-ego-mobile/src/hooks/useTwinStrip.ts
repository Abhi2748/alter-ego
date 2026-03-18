/**
 * Hook for the twin strip on the home screen.
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api";

export interface TwinStripData {
  has_twin: boolean;
  gap_state?:
    | "user_ahead"
    | "neck_and_neck"
    | "slightly_behind"
    | "significantly_behind";
  gap_xp?: number;
  user_is_ahead?: boolean;
  twin_stage?: number;
  twin_pet_stage?: number;
  twin_pet_unlocked?: boolean;
  strip_message: string | null;
  last_updated?: string | null;
}

export function useTwinStrip() {
  return useQuery({
    queryKey: ["twin", "strip"],
    queryFn: () => apiClient.get<TwinStripData>("/api/v1/twin/strip"),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });
}
