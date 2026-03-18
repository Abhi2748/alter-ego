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

export interface TwinStateResponse {
  user: TwinUserState;
  twin: TwinRivalState;
  gap: TwinGapState;
}

export interface TwinMessage {
  id: string;
  role: 'user' | 'twin';
  content: string;
  created_at: string;
}

export interface TwinChatHistoryResponse {
  messages: TwinMessage[];
}

export interface TwinChatResponse {
  response: string;
}

export interface TwinStripResponse {
  message: string | null;
}

// ── API calls ──────────────────────────────────────────────────────────────

export const twinService = {
  // Twin comparison screen data
  getState: () => apiClient.get<TwinStateResponse>('/api/v1/twin/state'),

  // Twin strip (home screen)
  getStrip: () => apiClient.get<TwinStripResponse>('/api/v1/twin/strip'),

  // Chat history
  getChatHistory: (limit = 50) =>
    apiClient.get<TwinChatHistoryResponse>(
      `/api/v1/twin/chat/history?limit=${limit}`
    ),

  // Send message to twin
  sendMessage: (message: string) =>
    apiClient.post<TwinChatResponse>('/api/v1/twin/chat', { message }),
};

