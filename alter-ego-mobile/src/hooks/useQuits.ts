import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  advancePhase,
  createQuitPath,
  deleteQuit,
  fetchQuits,
  logFrequency,
  updateTriggerProfile,
  type CreateQuitPathBody,
} from "@/services/quits";
import { MISSION_KEYS } from "@/hooks/useMissions";

export const QUIT_KEYS = {
  all: ["quits"] as const,
  list: () => [...QUIT_KEYS.all, "list"] as const,
};

export function useQuits() {
  return useQuery({
    queryKey: QUIT_KEYS.list(),
    queryFn: fetchQuits,
    staleTime: 1000 * 60 * 2,
  });
}

export function useLogFrequency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pathId, count }: { pathId: string; count: number }) =>
      logFrequency(pathId, count),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUIT_KEYS.all }),
  });
}

export function useAdvancePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pathId: string) => advancePhase(pathId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUIT_KEYS.all }),
  });
}

export function useDeleteQuit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pathId: string) => deleteQuit(pathId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUIT_KEYS.all }),
  });
}

export function useUpdateTriggerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      pathId,
      contexts,
      awareness,
    }: {
      pathId: string;
      contexts: string[];
      awareness: string;
    }) => updateTriggerProfile(pathId, contexts, awareness),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUIT_KEYS.all }),
  });
}

export function useCreateQuitPath() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateQuitPathBody) => createQuitPath(body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: QUIT_KEYS.all });
      await qc.refetchQueries({ queryKey: QUIT_KEYS.list() });
      void qc.invalidateQueries({ queryKey: MISSION_KEYS.today });
    },
  });
}
