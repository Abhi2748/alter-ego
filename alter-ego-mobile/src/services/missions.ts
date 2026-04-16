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
  quit_path_id?: string | null;
  mission_category?: string | null;
  underlying_need?: string | null;
  description?: string | null;
  stat_tag?: string | null;
  /** Resolved from interests.normalised_name (API enrich) */
  interest_name?: string | null;
  /** Resolved from quit_paths.habit_name (API enrich) */
  quit_target_name?: string | null;
  is_quit_mission?: boolean;
  rationale?: string | null;
  phase_principle?: string | null;
  domain_knowledge?: string | null;
  estimated_minutes?: number | null;
  mission_date?: string;
  /** Present when twin_mission_log + inject succeeded */
  twin_completed?: boolean;
  twin_completed_at_hour?: number | null;
  /** Consecutive days completing this core pillar (non-journal); from GET today / date */
  mission_streak?: number;
}

/** Full row from GET /api/v1/missions/{uuid} */
export type MissionDetailApi = Mission & {
  quit_habit_name?: string | null;
  quit_phase?: string | null;
  quit_need_description?: string | null;
  quit_competing_response?: string | null;
  quit_need_category?: string | null;
  resource_reference?: string | null;
  /** 1 = too hard, 3 = just right, 5 = too easy — from mission_ratings */
  difficulty_rating?: number | null;
  /** Optional text the user submitted with their difficulty rating */
  feedback_text?: string | null;
};

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
  /** Recalculated on server after each completion */
  power_score?: number | null;

  stat_gains?: {
    primary_stat: string | null;
    primary_sp: number;
    discipline_sp: number;
    willpower_bonus_sp: number;
    level_ups: string[];
  };
  willpower_progress?: {
    missions_completed_today: number;
    total_missions_today: number;
  };
  sigil?: {
    aether_awarded: number;
    surge_activated: boolean;
    surge_active: boolean;
    level_up: boolean;
    new_level: number | null;
    new_level_name: string | null;
  };
  /** Server-selected micro-copy for SpGainToast footer */
  completion_copy?: string | null;
}

export interface MissionRatingRequest {
  rating: number;
  feedback_text?: string;
}

export interface CreatePersonalMissionRequest {
  mission_text: string;
  tier: string;
  xp: number;
  pf: number;
  estimated_minutes: number;
  /** YYYY-MM-DD; omit to let backend use user's local day */
  date?: string;
  multiday_days?: number;
}

/** Journal API row (list + detail). */
export type JournalApiEntry = {
  id: string;
  date: string;
  title: string;
  content: string;
  word_count: number;
  bookmarked: boolean;
  created_at?: string;
  updated_at?: string;
};

export type JournalSaveResponse = {
  saved: boolean;
  mission_completed: boolean;
  word_count: number;
  /** Present when this save triggered `complete_mission` for today's journal core mission. */
  completion?: CompleteMissionResponse | null;
};

export type JournalListApiResponse = { entries: JournalApiEntry[] };

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

export function fetchMissionDetail(missionId: string) {
  return apiClient.get<MissionDetailApi>(`/api/v1/missions/${missionId}`);
}

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

  listJournalEntries: async (params?: { fromDate?: string; toDate?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.fromDate) qs.set("from_date", params.fromDate);
    if (params?.toDate) qs.set("to_date", params.toDate);
    if (params?.limit != null) qs.set("limit", String(params.limit));
    const suffix = qs.size ? `?${qs.toString()}` : "";
    return apiClient.get<JournalListApiResponse>(`/api/v1/missions/journal${suffix}`);
  },

  getJournalEntryById: (entryId: string) =>
    apiClient.get<JournalApiEntry>(`/api/v1/missions/journal/${entryId}`),

  saveJournal: (body: {
    content: string;
    date: string;
    title?: string;
    bookmarked?: boolean;
  }) =>
    apiClient.post<JournalSaveResponse>("/api/v1/missions/journal/save", {
      content: body.content,
      date: body.date,
      title: body.title ?? "",
      bookmarked: body.bookmarked ?? false,
    }),

  createPersonalMission: (data: CreatePersonalMissionRequest) =>
    apiClient.post<Mission>("/api/v1/missions/personal/create", data),

  deletePersonalMission: (missionId: string) =>
    apiClient.delete(`/api/v1/missions/personal/${missionId}`),
};
