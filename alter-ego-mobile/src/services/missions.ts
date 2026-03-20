/**
 * Mission API service.
 * All mission-related API calls go through here.
 */

import { apiClient } from "@/services/api";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Mission {
  id: string;
  type?: "core" | "interest" | "resistance" | "personal";
  title: string;
  difficulty: "Easy" | "Medium" | "Hard" | string;
  xp_value: number;
  pf_value: number;
  completed: boolean;
  completed_at?: string | null;
  is_journal_mission?: boolean;
  core_pillar?: string | null;
  interest_id?: string | null;
  quit_target_id?: string | null;
  rationale?: string | null;
  phase_principle?: string | null;
  domain_knowledge?: string | null;
  estimated_minutes?: number | null;
  mission_date?: string;
}

export interface TodayMissionsResponse {
  date: string;
  day_number?: number;
  missions: {
    core: Mission[];
    interest: Mission[];
    resistance: Mission[];
    personal: Mission[];
  };
  summary: {
    total: number;
    completed: number;
    xp_available: number;
    pf_available: number;
  };
}

export interface CompleteMissionResponse {
  success: boolean;
  already_completed?: boolean;
  xp_earned: number;
  pf_earned: number;
  new_total_xp: number;
  new_total_pf: number;
  daily_xp_remaining?: number;
  daily_pf_remaining?: number;
  stage_evolved?: { new_stage: number; new_stage_name: string } | null;
  pet_evolved?: { new_stage: number; new_pet_name: string } | null;
  streak_updated?: boolean;
  current_streak?: number;
  streak_animation?: {
    show: boolean;
    streak_count: number;
    animation_tier: string;
  };
  tier_upgraded?: boolean;
  new_streak_tier?: string | null;
  milestone_reached?: number | null;
  leaderboard_just_unlocked?: boolean;
}

export interface MissionRatingRequest {
  rating: number;
  feedback_text?: string;
}

export interface PersonalMissionEstimate {
  tier: "easy" | "medium" | "hard" | "multiday";
  xp: number;
  pf: number;
  reasoning: string;
  estimated_minutes: number;
}

export interface CreatePersonalMissionRequest {
  mission_text: string;
  tier: string;
  xp: number;
  pf: number;
  estimated_minutes: number;
  date: string;
  multiday_days?: number;
}

/** Ensures list sections exist so UI/hooks never crash on partial API payloads. */
export function normalizeTodayMissionsResponse(
  data: TodayMissionsResponse | null | undefined
): TodayMissionsResponse {
  const m = data?.missions;
  return {
    date: data?.date ?? "",
    day_number: data?.day_number,
    missions: {
      core: Array.isArray(m?.core) ? m.core : [],
      interest: Array.isArray(m?.interest) ? m.interest : [],
      resistance: Array.isArray(m?.resistance) ? m.resistance : [],
      personal: Array.isArray(m?.personal) ? m.personal : [],
    },
    summary: {
      total: Number(data?.summary?.total ?? 0),
      completed: Number(data?.summary?.completed ?? 0),
      xp_available: Number(data?.summary?.xp_available ?? 0),
      pf_available: Number(data?.summary?.pf_available ?? 0),
    },
  };
}

// ── API calls ──────────────────────────────────────────────────────────────

export const missionsService = {
  getTodayMissions: async () => {
    const raw = await apiClient.get<TodayMissionsResponse>("/api/v1/missions/today");
    return normalizeTodayMissionsResponse(raw);
  },

  getMissionsByDate: async (dateStr: string) => {
    const raw = await apiClient.get<TodayMissionsResponse>(
      `/api/v1/missions/date/${dateStr}`
    );
    return normalizeTodayMissionsResponse(raw);
  },

  completeMission: (missionId: string) =>
    apiClient.post<CompleteMissionResponse>(
      `/api/v1/missions/${missionId}/complete`
    ),

  rateMission: (missionId: string, data: MissionRatingRequest) =>
    apiClient.post(`/api/v1/missions/${missionId}/rate`, data),

  saveJournal: (content: string, date: string) =>
    apiClient.post("/api/v1/missions/journal/save", { content, date }),

  estimatePersonalMission: (missionText: string) =>
    apiClient.post<PersonalMissionEstimate>(
      "/api/v1/missions/personal/estimate",
      { mission_text: missionText }
    ),

  createPersonalMission: (data: CreatePersonalMissionRequest) =>
    apiClient.post<Mission>("/api/v1/missions/personal/create", data),

  deletePersonalMission: (missionId: string) =>
    apiClient.delete(`/api/v1/missions/personal/${missionId}`),
};
