/**
 * React Query hooks for the Twin tab.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { twinService, type TwinMessage } from '@/services/twin';

export const TWIN_KEYS = {
  state: ['twin', 'state'] as const,
  strip: ['twin', 'strip'] as const,
  chat: ['twin', 'chat'] as const,
  toneHistory: ['twin', 'tone-history'] as const,
};

// ── Twin comparison state ──────────────────────────────────────────────────

export function useTwinState() {
  return useQuery({
    queryKey: TWIN_KEYS.state,
    queryFn: async () => twinService.getState(),
    staleTime: 30 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    /** Twin's "today" XP prorates as simulated missions unlock by time — refresh periodically. */
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
  });
}

export { useTwinStrip } from "./useTwinStrip";

// ── Chat history ───────────────────────────────────────────────────────────

export function useTwinChatHistory(limit = 50) {
  return useQuery({
    queryKey: [...TWIN_KEYS.chat, limit] as const,
    queryFn: async () => twinService.getChatHistory(limit),
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });
}

export function useTwinToneHistory() {
  return useQuery({
    queryKey: TWIN_KEYS.toneHistory,
    queryFn: async () => twinService.getToneHistory(),
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });
}

export function useRateTwinMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      messageId,
      rating,
    }: {
      messageId: string;
      rating: -1 | 0 | 1;
    }) => twinService.rateTwinMessage(messageId, rating),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: TWIN_KEYS.toneHistory });
      await queryClient.invalidateQueries({ queryKey: TWIN_KEYS.chat });
    },
  });
}

// ── Send message ───────────────────────────────────────────────────────────

type TwinChatHistoryData = Awaited<ReturnType<typeof twinService.getChatHistory>>;

export function useSendTwinMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (message: string) => twinService.sendMessage(message),

    onMutate: async (message: string) => {
      const limitKeySuffixes = queryClient
        .getQueryCache()
        .findAll({ queryKey: TWIN_KEYS.chat })
        .map((query) => query.queryKey)
        .filter((queryKey) => Array.isArray(queryKey) && queryKey.length >= 3);

      await Promise.all(
        limitKeySuffixes.map((queryKey) =>
          queryClient.cancelQueries({ queryKey })
        )
      );

      const previousDataByKey = new Map<
        string,
        { queryKey: readonly unknown[]; data: unknown }
      >();

      for (const queryKey of limitKeySuffixes) {
        const existingData = queryClient.getQueryData(queryKey);
        previousDataByKey.set(JSON.stringify(queryKey), {
          queryKey,
          data: existingData,
        });

        queryClient.setQueryData<TwinChatHistoryData | undefined>(
          queryKey,
          (old) => {
            if (!old) return old;
            const optimisticMessage: TwinMessage = {
              id: `temp-${Date.now()}`,
              role: 'user',
              content: message,
              created_at: new Date().toISOString(),
            };
            return { ...old, messages: [...old.messages, optimisticMessage] };
          }
        );
      }

      return { previousDataByKey };
    },

    onSuccess: () => {
      // Refetch so message IDs match DB (required for tone ratings).
      queryClient.invalidateQueries({ queryKey: TWIN_KEYS.chat });
    },

    onError: (_error, _message, context) => {
      if (!context?.previousDataByKey) return;
      for (const entry of context.previousDataByKey.values()) {
        queryClient.setQueryData(entry.queryKey, entry.data);
      }
    },
  });
}

