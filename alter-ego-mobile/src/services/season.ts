/**
 * Season / Arc API service.
 * Backend endpoint: GET /api/v1/seasons/current
 * Returns null gracefully if no season is active or backend returns 404/error.
 */

import { apiClient } from '@/services/api';

// ── Types ──────────────────────────────────────────────────────────────────

export type SeasonTier = 'perfect' | 'clear' | 'partial' | 'failed';
export type SeasonStatus = 'active' | 'completed' | 'failed' | 'between';

export interface SeasonPhaseTarget {
  mission: string;              // e.g. "Sleep"
  target: string;               // e.g. "7.5h target"
  next_phase_target: string | null;  // e.g. "7.5h + consistent schedule"
  icon: string;                 // emoji e.g. "🌙"
  icon_bg_color: string;        // e.g. "rgba(124,58,237,0.1)"
}

export interface SeasonPhase {
  phase_number: number;         // 1, 2, 3
  name: string;                 // "Ignition", "Rising", "Locking In"
  days_start: number;           // 1
  days_end: number;             // 10
  status: 'done' | 'active' | 'upcoming';
  targets: SeasonPhaseTarget[];
  days_in_phase: number;        // how many days of this phase are done
  days_total_phase: number;     // total days in this phase
}

export interface SeasonDayLog {
  day_number: number;           // 1–30 (or 1–66)
  status: 'perfect' | 'complete' | 'missed' | 'today' | 'future';
}

export interface SeasonTwinComparison {
  user_days_complete: number;
  twin_days_complete: number;
  twin_message: string;
}

export interface CurrentSeason {
  season_number: number;        // 1, 2, 3…
  season_name: string;          // "The Spark", "The Forge"…
  season_theme: string;         // "Prove you can show up."
  archetype_name: string;       // archetype-specific season name variant
  status: SeasonStatus;
  current_day: number;          // day within season (1-based)
  total_days: number;           // 30 (S1) or 66 (S2+)
  days_completed: number;       // days with ≥60% missions done
  days_perfect: number;         // days with all 6 done
  days_missed: number;
  started_at: string;           // ISO date
  ends_at: string;              // ISO date
  projected_tier: SeasonTier;   // based on current completion rate
  current_phase: number;        // 1, 2 or 3
  phases: SeasonPhase[];
  day_log: SeasonDayLog[];
  twin_comparison: SeasonTwinComparison;
  season_color: string;         // "#F97316" ember for S1, "#D97706" amber for S2, "#06B6D4" cyan for S3
  /** XP awarded on completion. Only present when status === 'completed'. */
  xp_awarded?: number | null;
  /** Title unlocked on completion. Only present when status === 'completed'. */
  title_unlocked?: string | null;
  /** Twin's closing journal entry. Only present when status === 'completed'. */
  twin_closing_entry?: string | null;
  /** Actual completion tier — only present when status is 'completed' or 'failed'. */
  completion_tier?: SeasonTier | null;
  /** Whether this completion has already been seen/acknowledged by the user. */
  completion_seen?: boolean;
}

// ── API calls ──────────────────────────────────────────────────────────────

export const seasonService = {
  getCurrentSeason: () =>
    apiClient.get<CurrentSeason>('/api/v1/seasons/current'),
};
