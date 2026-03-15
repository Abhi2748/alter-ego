/**
 * Quit target and milestone types. Spec §8.
 * 5 phases: Awareness (1–10), Replacement (11–30), Reflex (31–60), Rewired (61–90), Free (91+).
 */

export type QuitPhase = "awareness" | "replacement" | "reflex" | "rewired" | "free";

export type QuitMilestoneType =
  | "day_1"
  | "day_3"
  | "day_7"
  | "day_14"
  | "day_30"
  | "day_60"
  | "day_90"
  | "day_365"
  | "comeback"
  | "conquered";

export interface QuitMilestone {
  id: string;
  milestone_type: QuitMilestoneType;
  earned_at: string | null;
  is_unlocked: boolean;
  clean_days_at_earn: number | null;
  cravings_at_earn: number | null;
  phase_at_earn: string | null;
  days_away: number | null;
  quote: string | null;
  slip_duration_hours: number | null;
  return_speed: "strong" | "good" | null;
}

export interface QuitTarget {
  id: string;
  quit_description: string;
  quit_name: string;
  trigger_description: string;
  underlying_need: string;
  need_category: string;
  status: "active" | "conquered" | "paused";
  started_at: string;
  current_clean_streak: number;
  best_clean_streak: number;
  total_clean_days: number;
  slip_count: number;
  cravings_resisted: number;
  current_phase: QuitPhase;
  days_in_current_phase: number;
  conquered_at: string | null;
  milestones: QuitMilestone[];
}

export const QUIT_PHASE_RANGES: { phase: QuitPhase; start: number; end: number; label: string }[] = [
  { phase: "awareness", start: 1, end: 10, label: "Awareness" },
  { phase: "replacement", start: 11, end: 30, label: "Replacement" },
  { phase: "reflex", start: 31, end: 60, label: "Reflex" },
  { phase: "rewired", start: 61, end: 90, label: "Rewired" },
  { phase: "free", start: 91, end: 9999, label: "Free" },
];

export const QUIT_MILESTONE_DEFS: {
  type: QuitMilestoneType;
  name: string;
  trigger_days: number;
  unit: "days";
}[] = [
  { type: "day_1", name: "First Day", trigger_days: 1, unit: "days" },
  { type: "day_3", name: "Three Days", trigger_days: 3, unit: "days" },
  { type: "day_7", name: "One Week", trigger_days: 7, unit: "days" },
  { type: "day_14", name: "Two Weeks", trigger_days: 14, unit: "days" },
  { type: "day_30", name: "One Month", trigger_days: 30, unit: "days" },
  { type: "day_60", name: "Two Months", trigger_days: 60, unit: "days" },
  { type: "day_90", name: "Three Months", trigger_days: 90, unit: "days" },
  { type: "day_365", name: "One Year", trigger_days: 365, unit: "days" },
];

export function getPhaseForDay(day: number): QuitPhase {
  for (const r of QUIT_PHASE_RANGES) {
    if (day >= r.start && day <= r.end) return r.phase;
  }
  return "free";
}

export function getPhaseLabel(phase: QuitPhase): string {
  return QUIT_PHASE_RANGES.find((r) => r.phase === phase)?.label ?? "Free";
}

/** Short label for tight UI (e.g. milestone card) so "Replacement" fits on one line. */
export function getPhaseShortLabel(phase: QuitPhase): string {
  const short: Record<QuitPhase, string> = {
    awareness: "Aware.",
    replacement: "Replace.",
    reflex: "Reflex",
    rewired: "Rewired",
    free: "Free",
  };
  return short[phase] ?? "Free";
}

export function getPhaseRange(phase: QuitPhase): { start: number; end: number } {
  const r = QUIT_PHASE_RANGES.find((x) => x.phase === phase);
  return r ? { start: r.start, end: r.end } : { start: 91, end: 9999 };
}
