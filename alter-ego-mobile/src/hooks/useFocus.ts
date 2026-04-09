import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFocusTag,
  deleteFocusTag,
  fetchFocusSettings,
  fetchFocusStats,
  fetchFocusTags,
  logFocusSession,
  patchFocusSettings,
  type LogSessionBody,
  type FocusSettings,
} from "@/services/focus";

export const FOCUS_KEYS = {
  all: ["focus"] as const,
  tags: () => [...FOCUS_KEYS.all, "tags"] as const,
  stats: () => [...FOCUS_KEYS.all, "stats"] as const,
  settings: () => [...FOCUS_KEYS.all, "settings"] as const,
};

export function useFocusTags() {
  return useQuery({
    queryKey: FOCUS_KEYS.tags(),
    queryFn: fetchFocusTags,
    staleTime: 1000 * 60 * 5,
  });
}

export function useFocusStats() {
  return useQuery({
    queryKey: FOCUS_KEYS.stats(),
    queryFn: fetchFocusStats,
    staleTime: 1000 * 60 * 2,
  });
}

export function useFocusSettings() {
  return useQuery({
    queryKey: FOCUS_KEYS.settings(),
    queryFn: fetchFocusSettings,
    staleTime: 1000 * 60 * 10,
  });
}

export function useCreateFocusTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) =>
      createFocusTag(name, color),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: FOCUS_KEYS.tags() });
      void qc.invalidateQueries({ queryKey: FOCUS_KEYS.stats() });
    },
  });
}

export function useDeleteFocusTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => deleteFocusTag(tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: FOCUS_KEYS.tags() }),
  });
}

export function useLogFocusSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LogSessionBody) => logFocusSession(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: FOCUS_KEYS.stats() });
      void qc.invalidateQueries({ queryKey: FOCUS_KEYS.tags() });
    },
  });
}

export function usePatchFocusSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<FocusSettings>) => patchFocusSettings(updates),
    onSuccess: (data) => {
      qc.setQueryData(FOCUS_KEYS.settings(), data);
    },
  });
}
