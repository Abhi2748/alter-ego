/**
 * Twin API service.
 * All twin-related API calls go through here.
 */

import { Platform } from 'react-native';

import { apiClient } from '@/services/api';
import { supabase } from '@/utils/supabase';
import type { DayComparison, PillarDNA } from '@/utils/api';

// ── Types ──────────────────────────────────────────────────────────────────

interface Mission {
  id: string;
  title: string;
  type: string;
  difficulty: string;
  completed: boolean;
  xp_value: number;
}

export interface TwinUserState {
  username: string;
  total_xp: number;
  character_stage: number;
  character_stage_name: string;
  pet_stage: number;
  pet_name: string | null;
  pet_unlocked: boolean;
  current_streak: number;
  power_score: number;
  missions_today: Mission[];
  missions_completed_today: number;
  missions_total_today: number;
  xp_earned_today: number;
}

export interface TwinRivalState {
  twin_xp: number;
  character_stage: number;
  character_stage_name: string;
  pet_stage: number;
  pet_name: string | null;
  pet_unlocked: boolean;
  streak: number;
  power_score: number;
  gap_state:
    | 'user_ahead'
    | 'neck_and_neck'
    | 'slightly_behind'
    | 'significantly_behind';
  missions_completed_today: number;
  missions_total_today: number;
  missed_mission_titles: string[];
  xp_earned_today: number;
}

export interface TwinGapState {
  xp_difference: number;
  user_is_ahead: boolean;
  gap_state: string;
  days_user_ahead: number;
}

export interface TwinTimelineEvent {
  mission_title: string;
  mission_type: string;
  difficulty: string;
  xp_earned: number;
  completed_at: string;
}

export interface TwinStateResponse {
  strip_message?: string | null;
  /** Rivalry-focused line for Twin Comparison tab — not the home strip. */
  comparison_line?: string | null;
  /** Identity line for Rank Card — not strip copy. */
  rank_card_oracle?: string | null;
  twin_timeline?: TwinTimelineEvent[];
  user: TwinUserState;
  twin: TwinRivalState;
  gap: TwinGapState;
  week_heatmap?: DayComparison[];
  pillar_dna?: PillarDNA[];
}

/** GET /api/v1/twin/feed — Shadow Feed timeline */
export interface FeedEntry {
  entry_type:
    | 'twin_completion'
    | 'twin_incomplete'
    | 'user_completion'
    | 'user_incomplete'
    | 'observation'
    | 'day_summary';
  timestamp_iso: string;
  display_time: string;
  entry_date: string;
  mission_title?: string | null;
  mission_type?: string | null;
  core_pillar?: string | null;
  xp_earned?: number | null;
  twin_note?: string | null;
  is_twin: boolean;
  is_user: boolean;
  is_shared_interest?: boolean | null;
  observation_text?: string | null;
  summary_date_label?: string | null;
  summary_missions_done?: number | null;
  summary_missions_total?: number | null;
  summary_xp?: number | null;
  summary_twin_quote?: string | null;
}

export interface ShadowFeedResponse {
  entries: FeedEntry[];
  today_twin_xp: number;
  today_user_xp: number;
  today_twin_done: number;
  today_user_done: number;
  has_more_today: boolean;
  pending_count: number;
}

export async function fetchShadowFeed(daysBack = 3): Promise<ShadowFeedResponse> {
  return apiClient.get<ShadowFeedResponse>(`/api/v1/twin/feed?days_back=${daysBack}`);
}

export type { DayComparison, PillarDNA };

export interface TwinMessage {
  id: string;
  role: 'user' | 'twin';
  content: string;
  created_at: string;
  /** Present for role=twin when user rated this line */
  tone_rating?: 'positive' | 'neutral' | 'negative' | null;
  /** -1 / 0 / 1 from twin_messages (preferred when set) */
  message_rating?: number | null;
  /** Twin-initiated (scheduler); shown with subtle affordance in chat */
  is_proactive?: boolean | null;
  is_read?: boolean | null;
  /** Voice used for this line (rival / philosopher / silent_force) */
  tone_used?: string | null;
}

export interface TwinChatHistoryResponse {
  messages: TwinMessage[];
}

export interface TwinChatResponse {
  response: string;
  message?: string | null;
  message_id?: string | null;
  user_message_id?: string | null;
  twin_message_id?: string | null;
  emotional_register?: string | null;
  is_safety_response?: boolean;
  safety_category?: string | null;
  tone_used?: string | null;
}

/** Normalise POST /twin/chat JSON (handles minor shape drift / string uuids). */
function parseTwinChatResponse(raw: unknown): TwinChatResponse {
  if (!raw || typeof raw !== 'object') {
    return { response: '' };
  }
  const o = raw as Record<string, unknown>;
  const response =
    typeof o.response === 'string'
      ? o.response
      : typeof o.message === 'string'
        ? o.message
        : '';
  const strOrNull = (v: unknown): string | null | undefined => {
    if (v === null || v === undefined) return v as null | undefined;
    if (typeof v === 'string') return v;
    return String(v);
  };
  return {
    response,
    message: strOrNull(o.message) ?? (response || null),
    message_id: strOrNull(o.message_id) ?? null,
    user_message_id: strOrNull(o.user_message_id) ?? null,
    twin_message_id: strOrNull(o.twin_message_id) ?? null,
    emotional_register: strOrNull(o.emotional_register) ?? null,
    is_safety_response: Boolean(o.is_safety_response),
    safety_category: strOrNull(o.safety_category) ?? null,
    tone_used: strOrNull(o.tone_used) ?? null,
  };
}

export interface TwinStreamEvent {
  type: 'chunk' | 'replace' | 'done' | 'meta' | 'error';
  text?: string;
  twin_message_id?: string | null;
  user_message_id?: string | null;
  tone_used?: string | null;
  is_safety_response?: boolean;
  message?: string;
}

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onReplace: (text: string) => void;
  onMeta: (meta: Pick<TwinStreamEvent, 'twin_message_id' | 'user_message_id' | 'tone_used' | 'is_safety_response'>) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

export interface TwinToneHistoryResponse {
  ratings: Array<{
    tone_id: string;
    tone_name: string;
    tone_emoji: string;
    rating: 'positive' | 'neutral' | 'negative';
    count: number;
    percentage: number;
  }>;
  total_ratings: number;
  current_blend: string[];
}

/** Matches GET /api/v1/twin/strip (and normalised for hooks). */
export interface TwinStripData {
  has_twin: boolean;
  gap_state?:
    | 'user_ahead'
    | 'neck_and_neck'
    | 'slightly_behind'
    | 'significantly_behind';
  gap_xp?: number;
  user_is_ahead?: boolean;
  twin_stage?: number;
  twin_pet_stage?: number;
  twin_pet_unlocked?: boolean;
  strip_message: string | null;
  last_updated?: string | null;
  status_line?: string | null;
  user_xp_today?: number | null;
  twin_xp_today?: number | null;
  absence_days?: number | null;
  absence_strip_message?: string | null;
  absence_interstitial_message?: string | null;
  twin_accomplishments?: Array<{ text: string; time_label: string }> | null;
  /** Twin relationship arc phase (observer | challenger | mirror | rival | partner) */
  relationship_phase?: string | null;
}

export interface TwinChallenge {
  id: string;
  challenge_type: string;
  challenge_text: string;
  target_value: number;
  current_value: number;
  status: 'pending' | 'accepted' | 'completed' | 'failed' | 'declined';
  issued_at: string;
  accepted_at: string | null;
  expires_at: string;
  completed_at: string | null;
  xp_reward: number;
  days_remaining: number;
}

export interface GapMomentParticleConfig {
  color: 'orange' | 'violet';
  density: 'high' | 'medium' | 'low' | 'minimal';
}

export interface GapMoment {
  id: string;
  trigger_type: string;
  trigger_value: string | null;
  headline: string;
  subtext: string;
  accent_color: string;
  particle_config: GapMomentParticleConfig;
  mission_count: number | null;
}

// ── API calls ──────────────────────────────────────────────────────────────

export const twinService = {
  // Twin comparison screen data
  getState: () => apiClient.get<TwinStateResponse>('/api/v1/twin/state'),

  // Twin strip (home screen + comparison fallback)
  getStrip: async (): Promise<TwinStripData> => {
    const raw = (await apiClient.get<Record<string, unknown>>('/api/v1/twin/strip')) as Record<
      string,
      unknown
    >;
    return {
      has_twin: Boolean(raw?.has_twin),
      gap_state: raw?.gap_state as TwinStripData['gap_state'],
      gap_xp: typeof raw?.gap_xp === 'number' ? raw.gap_xp : undefined,
      user_is_ahead: typeof raw?.user_is_ahead === 'boolean' ? raw.user_is_ahead : undefined,
      twin_stage: typeof raw?.twin_stage === 'number' ? raw.twin_stage : undefined,
      twin_pet_stage: typeof raw?.twin_pet_stage === 'number' ? raw.twin_pet_stage : undefined,
      twin_pet_unlocked:
        typeof raw?.twin_pet_unlocked === 'boolean' ? raw.twin_pet_unlocked : undefined,
      strip_message: (raw?.strip_message as string) ?? null,
      last_updated: (raw?.last_updated as string) ?? null,
      status_line:
        raw?.status_line === undefined
          ? undefined
          : raw?.status_line === null
            ? null
            : String(raw.status_line),
      user_xp_today:
        raw?.user_xp_today === null
          ? null
          : typeof raw?.user_xp_today === 'number'
            ? raw.user_xp_today
            : undefined,
      twin_xp_today:
        raw?.twin_xp_today === null
          ? null
          : typeof raw?.twin_xp_today === 'number'
            ? raw.twin_xp_today
            : undefined,
      absence_days:
        raw?.absence_days === null
          ? null
          : typeof raw?.absence_days === 'number'
            ? raw.absence_days
            : undefined,
      absence_strip_message:
        raw?.absence_strip_message === undefined
          ? undefined
          : raw?.absence_strip_message === null
            ? null
            : String(raw.absence_strip_message),
      absence_interstitial_message:
        raw?.absence_interstitial_message === undefined
          ? undefined
          : raw?.absence_interstitial_message === null
            ? null
            : String(raw.absence_interstitial_message),
      twin_accomplishments: Array.isArray(raw?.twin_accomplishments)
        ? (raw.twin_accomplishments as TwinStripData['twin_accomplishments'])
        : raw?.twin_accomplishments === null
          ? null
          : undefined,
      relationship_phase:
        raw?.relationship_phase === undefined
          ? undefined
          : raw?.relationship_phase === null
            ? null
            : String(raw.relationship_phase),
    };
  },

  // Chat history
  getChatHistory: (limit = 50) =>
    apiClient.get<TwinChatHistoryResponse>(
      `/api/v1/twin/chat/history?limit=${limit}`
    ),

  // Send message to twin (non-streaming) — direct fetch with timeout, no apiClient retries
  sendMessage: async (message: string): Promise<TwinChatResponse> => {
    const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000').replace(
      /\/$/,
      ''
    );

    // eslint-disable-next-line no-console -- debug twin chat failures on device
    console.log('[twin.sendMessage] BASE_URL =', BASE_URL);
    // eslint-disable-next-line no-console -- debug twin chat failures on device
    console.log('[twin.sendMessage] message =', message);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('No active session');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40_000);

    try {
      const res = await fetch(`${BASE_URL}/api/v1/twin/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // eslint-disable-next-line no-console -- debug twin chat failures on device
      console.log('[twin.sendMessage] status =', res.status);

      if (!res.ok) {
        let errMsg = `Request failed (${res.status})`;
        let rawBody: unknown = null;

        try {
          rawBody = await res.json();
        } catch {
          rawBody = null;
        }

        // eslint-disable-next-line no-console -- debug twin chat failures on device
        console.log('[twin.sendMessage] error body =', rawBody);

        if (res.status === 429) {
          errMsg = 'Too many messages. Wait a moment and try again.';
        } else if (
          rawBody &&
          typeof rawBody === 'object' &&
          'detail' in rawBody
        ) {
          const detail = (rawBody as Record<string, unknown>).detail;

          if (typeof detail === 'string') {
            errMsg = detail;
          } else if (Array.isArray(detail)) {
            const first = detail[0];
            if (typeof first === 'string') {
              errMsg = first;
            } else if (first && typeof first === 'object') {
              const msg = (first as Record<string, unknown>).msg;
              const loc = (first as Record<string, unknown>).loc;
              if (typeof msg === 'string' && Array.isArray(loc)) {
                errMsg = `${msg} (${loc.join(' > ')})`;
              } else if (typeof msg === 'string') {
                errMsg = msg;
              } else {
                errMsg = JSON.stringify(detail);
              }
            } else {
              errMsg = JSON.stringify(detail);
            }
          }
        } else if (
          rawBody &&
          typeof rawBody === 'object' &&
          typeof (rawBody as Record<string, unknown>).message === 'string'
        ) {
          errMsg = String((rawBody as Record<string, unknown>).message);
        } else if (
          rawBody &&
          typeof rawBody === 'object' &&
          typeof (rawBody as Record<string, unknown>).error === 'string'
        ) {
          errMsg = String((rawBody as Record<string, unknown>).error);
        }

        throw new Error(errMsg);
      }

      const raw = await res.json();
      // eslint-disable-next-line no-console -- debug twin chat failures on device
      console.log('[twin.sendMessage] success body =', raw);
      return parseTwinChatResponse(raw);
    } catch (e) {
      // eslint-disable-next-line no-console -- debug twin chat failures on device
      console.log('[twin.sendMessage] caught error =', e);
      clearTimeout(timeoutId);
      if (e instanceof Error && e.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      throw e;
    }
  },

  sendMessageStream: async (
    message: string,
    token: string,
    callbacks: StreamCallbacks
  ): Promise<void> => {
    const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000').replace(
      /\/$/,
      ''
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000);

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let completed = false;

    const parseHttpErrorMessage = async (res: Response): Promise<string> => {
      if (res.status === 429) {
        return 'Too many messages. Wait a moment and try again.';
      }
      let errMsg = `Request failed (${res.status})`;
      try {
        const body = (await res.json()) as Record<string, unknown>;
        if (typeof body.detail === 'string') errMsg = body.detail;
        else if (typeof body.message === 'string') errMsg = body.message;
        else if (typeof body.error === 'string') errMsg = body.error;
      } catch {
        /* ignore parse errors */
      }
      return errMsg;
    };

    const completeViaNonStreaming = async (): Promise<void> => {
      try {
        const res = await fetch(`${BASE_URL}/api/v1/twin/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache',
          },
          body: JSON.stringify({ message }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const errMsg = await parseHttpErrorMessage(res);
          if (!completed) callbacks.onError(errMsg);
          return;
        }
        const raw = await res.json();
        const result = parseTwinChatResponse(raw);
        const replyText =
          (result.response || result.message || '').trim() || "I'm here. Say that again.";
        callbacks.onReplace(replyText);
        callbacks.onMeta({
          twin_message_id: result.twin_message_id ?? null,
          user_message_id: result.user_message_id ?? null,
          tone_used: result.tone_used ?? null,
          is_safety_response: result.is_safety_response ?? false,
        });
        completed = true;
        callbacks.onDone();
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          if (!completed) callbacks.onError('Request timed out. Please try again.');
          return;
        }
        if (!completed) callbacks.onError('Network error. Check your connection.');
      }
    };

    try {
      // Expo Go / React Native: fetch cannot consume SSE reliably — never hit /chat/stream
      // (avoids backend completing stream then a duplicate /chat failing with 422).
      if (Platform.OS !== 'web') {
        await completeViaNonStreaming();
        return;
      }

      let response: Response;
      try {
        response = await fetch(`${BASE_URL}/api/v1/twin/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
          body: JSON.stringify({ message }),
          signal: controller.signal,
        });
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          if (!completed) callbacks.onError('Request timed out. Please try again.');
          return;
        }
        if (!completed) callbacks.onError('Network error. Check your connection.');
        return;
      }

      if (!response.ok) {
        const errMsg = await parseHttpErrorMessage(response);
        if (!completed) callbacks.onError(errMsg);
        return;
      }

      const body = response.body;
      if (!body || typeof body.getReader !== 'function') {
        await completeViaNonStreaming();
        return;
      }

      const r = body.getReader();
      if (!r) {
        await completeViaNonStreaming();
        return;
      }
      reader = r;

      const decoder = new TextDecoder();
      let buffer = '';

      let doneReceived = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done || doneReceived) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const raw = trimmed.slice(5).trim();
            if (!raw) continue;

            let event: TwinStreamEvent;
            try {
              event = JSON.parse(raw) as TwinStreamEvent;
            } catch {
              continue;
            }

            switch (event.type) {
              case 'chunk':
                if (event.text) callbacks.onChunk(event.text);
                break;
              case 'replace':
                if (event.text) callbacks.onReplace(event.text);
                break;
              case 'done':
                doneReceived = true;
                completed = true;
                callbacks.onDone();
                break;
              case 'meta':
                callbacks.onMeta({
                  twin_message_id: event.twin_message_id ?? null,
                  user_message_id: event.user_message_id ?? null,
                  tone_used: event.tone_used ?? null,
                  is_safety_response: event.is_safety_response ?? false,
                });
                break;
              case 'error':
                if (!doneReceived && !completed) {
                  doneReceived = true;
                  callbacks.onError(event.message ?? 'Unknown error');
                }
                break;
            }
          }
        }
      } catch {
        if (!doneReceived && !completed) {
          callbacks.onError('Stream interrupted.');
        }
      } finally {
        if (reader) reader.releaseLock();
      }
    } finally {
      clearTimeout(timeoutId);
    }
  },

  submitToneRating: (messageId: string, rating: 'positive' | 'neutral' | 'negative') =>
    apiClient.post<{ ok: boolean; tone_type?: string }>('/api/v1/twin/tone-rating', {
      message_id: messageId,
      rating,
    }),

  rateTwinMessage: (messageId: string, rating: -1 | 0 | 1) =>
    apiClient.post<{ rated: boolean }>(`/api/v1/twin/chat/${messageId}/rate`, { rating }),

  getToneHistory: () =>
    apiClient.get<TwinToneHistoryResponse>('/api/v1/twin/tone-history'),

  getShadowFeed: (daysBack = 3) =>
    apiClient.get<ShadowFeedResponse>(`/api/v1/twin/feed?days_back=${daysBack}`),

  /** Mark proactive Twin lines read when chat opens (best-effort). */
  markMessagesRead: async (): Promise<void> => {
    try {
      await apiClient.post('/api/v1/twin/chat/mark-read');
    } catch {
      // non-critical
    }
  },

  getChallenge: () => apiClient.get<TwinChallenge | null>('/api/v1/twin/challenge'),

  acceptChallenge: () =>
    apiClient.post<{ ok: boolean; status: string | null }>('/api/v1/twin/challenge/accept'),

  declineChallenge: () =>
    apiClient.post<{ ok: boolean; status: string | null }>('/api/v1/twin/challenge/decline'),

  getGapMoment: () => apiClient.get<GapMoment | null>('/api/v1/twin/gap-moment'),

  dismissGapMoment: (id: string) =>
    apiClient.post<{ ok: boolean }>('/api/v1/twin/gap-moment/dismiss', { id }),
};

