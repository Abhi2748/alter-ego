/**
 * Character stats (abilities / SP) — GET /api/v1/stats
 */

import { apiClient } from "@/services/api";

export interface StatProgress {
  key: string;
  sp: number;
  sp_today: number;
  level: number;
  level_name: string;
  sp_current: number;
  sp_for_next: number;
  sp_in_level: number;
  sp_needed: number;
  progress_percent: number;
  daily_cap?: number;
  contributing?: string[];
}

export interface AuraData {
  level: number;
  level_name: string;
  progress_percent: number;
}

export interface CharacterStats {
  aura: AuraData;
  vitality: StatProgress;
  focus: StatProgress;
  craft: StatProgress;
  discipline: StatProgress;
  willpower: StatProgress;
  missions_completed_today: number;
  total_missions_today: number;
  willpower_milestone_sp_awarded: number;
  meta?: {
    level_thresholds: number[];
    level_names: string[];
    daily_caps: Record<string, number>;
    contributing: Record<string, string[]>;
    willpower_bonus: Record<string, number>;
  };
}

export interface StatGains {
  primary_stat: string | null;
  primary_sp: number;
  discipline_sp: number;
  willpower_bonus_sp: number;
  level_ups: string[];
}

export const fetchCharacterStats = async (): Promise<CharacterStats> => {
  return apiClient.get<CharacterStats>("/api/v1/stats");
};
