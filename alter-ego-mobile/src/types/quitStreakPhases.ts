/**
 * Legacy clean-streak phase model for quit milestones / API phase_at_earn.
 * Distinct from path phases (mapping / disruption / consolidation) in quits.ts.
 */

export type QuitStreakPhase = "awareness" | "replacement" | "reflex" | "rewired" | "free";

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

export interface QuitMilestoneDef {
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

export const QUIT_STREAK_PHASE_RANGES: {
  phase: QuitStreakPhase;
  start: number;
  end: number;
  label: string;
}[] = [
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

export function getStreakPhaseForDay(day: number): QuitStreakPhase {
  for (const r of QUIT_STREAK_PHASE_RANGES) {
    if (day >= r.start && day <= r.end) return r.phase;
  }
  return "free";
}

export function getStreakPhaseLabel(phase: QuitStreakPhase): string {
  return QUIT_STREAK_PHASE_RANGES.find((r) => r.phase === phase)?.label ?? "Free";
}

export function getStreakPhaseShortLabel(phase: QuitStreakPhase): string {
  const short: Record<QuitStreakPhase, string> = {
    awareness: "Aware.",
    replacement: "Replace.",
    reflex: "Reflex",
    rewired: "Rewired",
    free: "Free",
  };
  return short[phase] ?? "Free";
}

export function getStreakPhaseRange(phase: QuitStreakPhase): { start: number; end: number } {
  const r = QUIT_STREAK_PHASE_RANGES.find((x) => x.phase === phase);
  return r ? { start: r.start, end: r.end } : { start: 91, end: 9999 };
}
