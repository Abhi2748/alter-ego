/**
 * Quit paths API — GET /api/v1/quits
 */

import { apiClient } from "@/services/api";

export interface QuitFrequencyEntry {
  log_date: string;
  count: number;
  unit: "times" | "minutes";
}

export interface QuitMissionItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  mission_category: "observation" | "competing_response" | "consolidation";
}

export interface QuitInsightItem {
  id: string;
  phase: string;
  title: string;
  body: string;
  unlocked_at: string;
}

export interface QuitTarget {
  path_id: string;
  habit_name: string;
  habit_normalized: string;
  initials: string;
  trigger_profile: {
    contexts: string[];
    awareness: string;
    quit_goal: string;
  };
  underlying_need: string;
  need_description?: string;
  current_phase: "mapping" | "disruption" | "consolidation";
  frequency_unit: "times" | "minutes";
  frequency_today: number;
  frequency_history: QuitFrequencyEntry[];
  frequency_baseline?: number;
  frequency_reduction_pct: number;
  days_active: number;
  missions: QuitMissionItem[];
  insights: QuitInsightItem[];
  status: "active" | "completed" | "paused" | "referral_only";
  requires_professional_referral: boolean;
  referral_message: string;
  phase_missions_completed?: number;
  total_phase_days?: number;
  top_triggers?: Array<{ tag: string; count: number }>;
  urge_trend?: Array<{ week_label: string; level: number }>;
  last_slip_context?: string[] | null;
  has_checkin_data?: boolean;
  weekly_urge_pending?: boolean;
}

export interface CreateQuitPathBody {
  habit_name: string;
  trigger_contexts: string[];
  awareness_level: string;
  quit_goal: string;
}

export const fetchQuits = (): Promise<QuitTarget[]> =>
  apiClient.get<QuitTarget[]>("/api/v1/quits").then((r) => (Array.isArray(r) ? r : []));

export const createQuitPath = (body: CreateQuitPathBody) =>
  apiClient.post<{
    path_id: string;
    starting_phase: string;
    status: string;
  }>("/api/v1/quits", body);

export const logFrequency = (pathId: string, count: number) =>
  apiClient.post(`/api/v1/quits/${pathId}/frequency`, { count });

export const advancePhase = (pathId: string) =>
  apiClient.post<{
    advanced: boolean;
    new_phase?: string;
    insight?: { title: string; body: string };
    message?: string;
  }>(`/api/v1/quits/${pathId}/advance-phase`);

export const deleteQuit = (pathId: string) =>
  apiClient.delete(`/api/v1/quits/${pathId}`);

export const updateTriggerProfile = (
  pathId: string,
  trigger_contexts: string[],
  awareness_level: string
) =>
  apiClient.patch(`/api/v1/quits/${pathId}/trigger-profile`, {
    trigger_contexts,
    awareness_level,
  });

export interface CheckinBody {
  checkin_type: "slip_context" | "weekly_urge" | "phase_transition";
  context_tags?: string[];
  urge_level?: "barely_noticed" | "manageable" | "hard" | "nearly_gave_in" | "slipped";
  free_text?: string;
}

export const logCheckin = (pathId: string, body: CheckinBody) =>
  apiClient.post<{ ok: boolean }>(`/api/v1/quits/${pathId}/checkin`, body);

export const fetchTriggerProfile = (pathId: string) =>
  apiClient.get(`/api/v1/quits/${pathId}/trigger-profile`);

export const fetchUrgeTrend = (pathId: string) =>
  apiClient.get<{ urge_trend: Array<{ week_label: string; level: number }> }>(
    `/api/v1/quits/${pathId}/urge-trend`
  );
