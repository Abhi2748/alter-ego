import { apiClient } from "@/services/api";

export type LeaderboardEntryApi = {
  rank: number;
  user_id: string;
  username: string;
  power_score: number;
  character_stage: number;
  character_stage_name?: string;
  pet_stage: number;
  pet_name?: string | null;
  current_streak: number;
  is_current_user?: boolean;
};

export type LeaderboardResponse = {
  entries: LeaderboardEntryApi[];
  current_user: {
    rank: number;
    power_score: number;
    username: string | null;
    character_stage: number;
    in_top_100: boolean;
  };
  total_users: number;
  last_updated?: string;
};

export const leaderboardService = {
  getLeaderboard: () =>
    apiClient.get<LeaderboardResponse>("/api/v1/leaderboard"),
};
