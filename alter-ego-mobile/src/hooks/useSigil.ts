import { useQuery } from "@tanstack/react-query";
import { fetchSigilData } from "@/services/sigil";

export const SIGIL_KEYS = {
  all: ["sigil"] as const,
  detail: () => [...SIGIL_KEYS.all, "detail"] as const,
};

export function useSigilData() {
  return useQuery({
    queryKey: SIGIL_KEYS.detail(),
    queryFn: fetchSigilData,
    staleTime: 1000 * 60 * 2,
  });
}
