/**
 * Twin API service.
 * All twin-related API calls go through here.
 */

import { apiClient } from '@/services/api';

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
  twin_timeline?: TwinTimelineEvent[];
  user: TwinUserState;
  twin: TwinRivalState;
  gap: TwinGapState;
}

export interface TwinMessage {
  id: string;
  role: 'user' | 'twin';
  content: string;
  created_at: string;
  /** Present for role=twin when user rated this line */
  tone_rating?: 'positive' | 'neutral' | 'negative' | null;
}

export interface TwinChatHistoryResponse {
  messages: TwinMessage[];
}

export interface TwinChatResponse {
  response: string;
  user_message_id?: string | null;
  twin_message_id?: string | null;
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
    };
  },

  // Chat history
  getChatHistory: (limit = 50) =>
    apiClient.get<TwinChatHistoryResponse>(
      `/api/v1/twin/chat/history?limit=${limit}`
    ),

  // Send message to twin
  sendMessage: (message: string) =>
    apiClient.post<TwinChatResponse>('/api/v1/twin/chat', { message }),

  submitToneRating: (messageId: string, rating: 'positive' | 'neutral' | 'negative') =>
    apiClient.post<{ ok: boolean; tone_type?: string }>('/api/v1/twin/tone-rating', {
      message_id: messageId,
      rating,
    }),

  getToneHistory: () =>
    apiClient.get<TwinToneHistoryResponse>('/api/v1/twin/tone-history'),
};

