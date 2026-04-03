/**
 * Quit milestone types for QuitMilestoneModal.
 */

export interface QuitMilestoneOut {
  milestone_type: string;
  earned_at: string | null;
  clean_days_at_earn: number | null;
  cravings_at_earn: number | null;
  phase_at_earn: string | null;
  quote: string | null;
  slip_duration_hours: number | null;
  return_speed: string | null;
}

export type QuitStreakPhase = "mapping" | "disruption" | "consolidation";

const PHASE_LABELS: Record<QuitStreakPhase, string> = {
  mapping: "Mapping",
  disruption: "Disruption",
  consolidation: "Consol.",
};

export function getStreakPhaseShortLabel(phase: QuitStreakPhase | string): string {
  if (phase === "mapping" || phase === "disruption" || phase === "consolidation") {
    return PHASE_LABELS[phase];
  }
  return String(phase);
}
