/**
 * Journal entries — GET list / GET one / POST save (invalidates missions when needed).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { missionsService, type JournalSaveResponse } from "@/services/missions";
import {
  applyMissionCompletionSideEffects,
  MISSION_KEYS,
} from "@/hooks/useMissions";
import { PROFILE_KEYS } from "@/hooks/useProfile";
import { emitMissionCompletionCelebration } from "@/utils/missionCompletionBridge";
import { requestGapMomentCheck } from "@/utils/gapMomentCheckBridge";

export const JOURNAL_KEYS = {
  all: ["journal"] as const,
  list: () => [...JOURNAL_KEYS.all, "list"] as const,
  detail: (id: string) => [...JOURNAL_KEYS.all, "detail", id] as const,
};

const STALE_MS = 60 * 1000;

export function useJournalList() {
  return useQuery({
    queryKey: JOURNAL_KEYS.list(),
    queryFn: () => missionsService.listJournalEntries({ limit: 365 }),
    staleTime: STALE_MS,
  });
}

export function useJournalEntry(entryId: string | null | undefined) {
  return useQuery({
    queryKey: JOURNAL_KEYS.detail(entryId ?? ""),
    queryFn: () => missionsService.getJournalEntryById(entryId!),
    enabled: !!entryId,
    staleTime: STALE_MS,
  });
}

export function useSaveJournal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      content: string;
      date: string;
      title?: string;
      bookmarked?: boolean;
    }) => missionsService.saveJournal(body),

    onSuccess: async (data: JournalSaveResponse) => {
      queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.all });
      const completion = data.completion;
      if (completion && completion.success && !completion.already_completed) {
        await applyMissionCompletionSideEffects(queryClient, completion);
        emitMissionCompletionCelebration(completion, {});
        requestGapMomentCheck();
      }
      queryClient.invalidateQueries({ queryKey: MISSION_KEYS.today });
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.overview });
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.streak });
    },
  });
}
