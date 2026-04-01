export type QuitPhase = "mapping" | "disruption" | "consolidation";
export type AwarenessLevel = "subconscious" | "semi_conscious" | "conscious";
export type QuitGoal = "stop_completely" | "reduce_significantly" | "make_conscious";

export const PHASE_CONFIG = {
  mapping: {
    name: "Trigger Mapping",
    label: "Phase 1",
    color: "#8B5CF6",
    colorBg: "rgba(139,92,246,0.10)",
    colorBorder: "rgba(139,92,246,0.20)",
    description:
      "No willpower required yet — just observation. We need to understand your pattern before building your strategy.",
  },
  disruption: {
    name: "Competing Response",
    label: "Phase 2",
    color: "#EF4444",
    colorBg: "rgba(239,68,68,0.10)",
    colorBorder: "rgba(239,68,68,0.20)",
    description:
      "Build a physical response that intercepts the habit. Your missions now target your specific triggers.",
  },
  consolidation: {
    name: "Consolidation",
    label: "Phase 3",
    color: "#2DD4BF",
    colorBg: "rgba(45,212,191,0.10)",
    colorBorder: "rgba(45,212,191,0.20)",
    description:
      "The competing response is becoming automatic. Missions now focus on high-risk situations and edge cases.",
  },
} as const;

export interface TriggerProfile {
  contexts: string[];
  awareness: AwarenessLevel;
  quit_goal: QuitGoal;
}

export interface QuitMission {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  /** API field from quit_paths missions list */
  mission_category?: "observation" | "competing_response" | "consolidation";
  mission_type?: "observation" | "competing_response" | "consolidation";
}

export interface FrequencyEntry {
  log_date?: string;
  date?: string;
  count: number;
  unit: "times" | "minutes";
}

export interface QuitInsight {
  title: string;
  body: string;
  unlocked_at: string;
}

export interface QuitTarget {
  path_id: string;
  habit_name: string;
  habit_normalized: string;
  initials: string;
  trigger_profile: TriggerProfile;
  current_phase: QuitPhase;
  frequency_unit: "times" | "minutes";
  frequency_today: number;
  frequency_history: FrequencyEntry[];
  frequency_reduction_pct: number;
  days_active: number;
  missions: QuitMission[];
  phase_missions_completed: number;
  total_phase_days: number;
  insights: QuitInsight[];
  status: "active" | "completed" | "paused" | "referral_only";
  underlying_need?: string;
  need_description?: string;
  requires_professional_referral?: boolean;
  referral_message?: string;
  /** Check-in derived fields (living trigger profile) */
  top_triggers?: Array<{ tag: string; count: number }>;
  urge_trend?: Array<{ week_label: string; level: number }>;
  last_slip_context?: string[] | null;
  has_checkin_data?: boolean;
  weekly_urge_pending?: boolean;
}

/** Q12 profile sheet output + onboarding payload. */
export interface QuitTargetInput {
  name: string;
  contexts: string[];
  awareness: AwarenessLevel;
  quit_goal: QuitGoal;
}

export function phaseOrder(phase: QuitPhase): number {
  if (phase === "mapping") return 1;
  if (phase === "disruption") return 2;
  return 3;
}

export function awarenessDisplay(a: AwarenessLevel): string {
  if (a === "subconscious") return "Usually not aware until it's done";
  if (a === "semi_conscious") return "Aware while doing it";
  return "Fully conscious choice";
}
