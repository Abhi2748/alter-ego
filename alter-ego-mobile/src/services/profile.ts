import { apiClient } from '@/services/api';

/** POST /api/v1/profile/interests — matches AddInterestSheet payload */
export interface CreateInterestPayload {
  interest_description: string;
  interest_level: string;
  goal_description: string;
  schedule_days: number[];
}

export interface MirrorObservation {
  text: string;
  bold_segments: string[];
  violet_segments: string[];
}

export interface MirrorResponse {
  eligible: boolean;
  already_shown: boolean;
  day_count: number;
  observations: MirrorObservation[];
  closing_line: string;
}

export function fetchMirrorData(): Promise<MirrorResponse> {
  return apiClient.get<MirrorResponse>('/api/v1/profile/mirror');
}

export interface ReturnStateResponse {
  absence_days: number;
  should_ask_question: boolean;
  is_long_absence: boolean;
  long_absence_message: string | null;
  already_answered_today: boolean;
  recovery_active: boolean;
  recovery_days_remaining: number;
}

export function fetchReturnState(): Promise<ReturnStateResponse> {
  return apiClient.get<ReturnStateResponse>('/api/v1/profile/return-state');
}

export const profileService = {
  getOverview: () => apiClient.get('/api/v1/profile/overview'),

  getStreak: () => apiClient.get('/api/v1/profile/streak'),

  getIdentity: () => apiClient.get('/api/v1/profile/identity'),

  getCompanion: () => apiClient.get('/api/v1/profile/companion'),

  getInterests: () => apiClient.get('/api/v1/profile/interests'),

  createInterest: (body: CreateInterestPayload) =>
    apiClient.post<{ success: boolean; interest_id?: string | null }>(
      '/api/v1/profile/interests',
      body
    ),

  getQuits: () => apiClient.get('/api/v1/profile/quits'),

  patchInterestQuestCriterion: (
    interestId: string,
    body: { quest_id: string; index: number; done: boolean }
  ) =>
    apiClient.patch<{ success: boolean }>(
      `/api/v1/profile/interests/${interestId}/quest/criterion`,
      body
    ),

  completeInterestQuest: (interestId: string, questId: string) =>
    apiClient.post<{ success: boolean; insight?: { title: string; body: string } }>(
      `/api/v1/profile/interests/${interestId}/quests/${questId}/complete`,
      {}
    ),

  putInterestDifficulty: (interestId: string, tier: 'easy' | 'medium' | 'hard') =>
    apiClient.put<{ success: boolean }>(`/api/v1/profile/interests/${interestId}/difficulty`, {
      tier,
    }),

  putInterestSchedule: (interestId: string, active_days: number[]) =>
    apiClient.put<{ success: boolean }>(`/api/v1/profile/interests/${interestId}/schedule`, {
      active_days,
    }),

  putInterestGoalPath: (
    interestId: string,
    body: { new_goal: string; experience_level: 'beginner' | 'intermediate' | 'advanced' }
  ) =>
    apiClient.put<{ success: boolean }>(`/api/v1/profile/interests/${interestId}/goal`, body),

  deleteInterest: (interestId: string) =>
    apiClient.delete<{ success: boolean }>(`/api/v1/profile/interests/${interestId}`),
};

