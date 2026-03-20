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
  narrative: string;
  one_win: string;
  one_focus: string;
  twin_message: string;
  next_week_note: string;
  past_reports: PastReportSummary[];
}
