export interface PastReportSummary {
  report_id: string;
  week_start: string;
  week_end: string;
  power_score: number;
  streak: number;
}

export interface WeeklyReportData {
  week_start: string;
  week_end: string;
  power_score: number;
  power_score_change: number;
  streak_current: number;
  streak_longest_month: number;
  daily_xp: number[];
  pet_stage: number;
  pet_name: string;
  pet_next_name: string;
  days_to_next_pet: number | null;
  pet_was_sad: boolean;
  gap_days: number;
  gap_change: number;
  // Gap (real values, not hardcoded 0)
  gap_xp: number; // absolute XP gap between user and twin
  gap_change_xp: number; // positive = grew, negative = closed, 0 = unchanged
  user_is_ahead: boolean;

  // Focus sessions
  focus_total_seconds: number;
  focus_session_count: number;
  focus_avg_seconds: number;
  focus_top_tag_name: string | null;
  focus_top_tag_seconds: number;

  // Per-interest and per-quit (for THIS WEEK block)
  interest_arcs: Array<{
    interest_name: string;
    sessions_completed_this_week: number;
    arc_phase: string;
    goal?: string | null;
    progress_pct?: number | null;
  }>;
  quit_progress: Array<{
    habit_name: string;
    current_phase: string;
    days_in_phase: number | null;
  }>;

  // Structured THIS WEEK stats
  best_day_label: string | null;
  best_day_count: number;
  hardest_day_label: string | null;
  hardest_day_count: number;
  days_active: number;
  completion_rate_pct: number;
  xp_earned: number;
  pf_earned: number;
  missions_completed: number;
  missions_total: number;
  core_days_complete: number;

  narrative?: string;
  one_win: string;
  one_focus: string;
  twin_message: string;
  next_week_note: string;
  past_reports: PastReportSummary[];
}
