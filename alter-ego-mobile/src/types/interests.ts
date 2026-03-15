/**
 * Interest and Milestone types + 8 milestone definitions. Spec §7.
 */

export interface Milestone {
  id: string;
  milestone_number: number;
  name: string;
  trigger_label: string;
  earned_at: string | null;
  is_unlocked: boolean;
  sessions_at_earn: number | null;
  xp_at_earn: number | null;
  xp_total_at_earn: number | null;
  streak_at_earn: number | null;
  tier_at_earn: string | null;
  quote: string | null;
}

export interface Interest {
  id: string;
  interest_name: string;
  interest_description: string;
  level: number;
  current_xp: number;
  xp_for_next_level: number;
  schedule_days: string[];
  total_sessions: number;
  tier: "easy" | "medium" | "hard";
  goal_description: string;
  milestones: Milestone[];
}

export const MILESTONE_DEFS = [
  { number: 1, name: "First Step", trigger: 1, unit: "sessions" as const },
  { number: 2, name: "7 Days In", trigger: 7, unit: "streak" as const },
  { number: 3, name: "10 Sessions", trigger: 10, unit: "sessions" as const },
  { number: 4, name: "One Month", trigger: 30, unit: "sessions" as const },
  { number: 5, name: "50 Sessions", trigger: 50, unit: "sessions" as const },
  { number: 6, name: "100 Sessions", trigger: 100, unit: "sessions" as const },
  { number: 7, name: "200 Sessions", trigger: 200, unit: "sessions" as const },
  { number: 8, name: "365 Sessions", trigger: 365, unit: "sessions" as const },
];

/** Interest level XP thresholds L1..L10 (CLAUDE §9). */
export const INTEREST_LEVEL_THRESHOLDS = [
  0, 200, 600, 1400, 3000, 6000, 11000, 18000, 28000, 42000,
];

export function getLevelAndProgress(totalXp: number): {
  level: number;
  progressInLevel: number;
  currentInLevel: number;
  targetInLevel: number;
} {
  let level = 1;
  for (let i = 1; i < 10; i++) {
    if (totalXp >= INTEREST_LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  if (level >= 10) {
    return { level: 10, progressInLevel: 1, currentInLevel: 42000, targetInLevel: 42000 };
  }
  const low = INTEREST_LEVEL_THRESHOLDS[level - 1];
  const high = INTEREST_LEVEL_THRESHOLDS[level];
  const currentInLevel = totalXp - low;
  const targetInLevel = high - low;
  const progressInLevel = targetInLevel > 0 ? currentInLevel / targetInLevel : 0;
  return { level, progressInLevel, currentInLevel, targetInLevel };
}
