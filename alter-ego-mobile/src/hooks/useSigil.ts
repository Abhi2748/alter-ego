import { useQuery } from "@tanstack/react-query";
import { fetchSigilData, SIGIL_PLACEHOLDER_DATA } from "@/services/sigil";
import { useUserStore } from "@/store/userStore";

export const SIGIL_KEYS = {
  all: ["sigil"] as const,
  detail: () => [...SIGIL_KEYS.all, "detail"] as const,
};

export function useSigilData() {
  const profile = useUserStore((s) => s.profile);
  return useQuery({
    queryKey: SIGIL_KEYS.detail(),
    queryFn: fetchSigilData,
    enabled: profile != null,
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });
}

export { SIGIL_PLACEHOLDER_DATA };
