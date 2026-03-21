/**
 * Hook for the twin strip on the home screen.
 * Uses twinService.getStrip() so response shape matches the API (strip_message, has_twin, …).
 */

import { useQuery } from "@tanstack/react-query";
import { twinService, type TwinStripData } from "@/services/twin";

export type { TwinStripData };

export function useTwinStrip() {
  return useQuery({
    queryKey: ["twin", "strip"],
    queryFn: () => twinService.getStrip(),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });
}
