/**
 * Interest milestone definitions and data types. Used by MilestoneRow and MilestoneCardScreen.
 */

export interface MilestoneStats {
  sessions_count: number;
  xp_total: number;
  tier: string;
  streak_days?: number;
  heatmap_days?: number[];
  tier_bar_pct?: number;
  old_tier?: string;
  new_tier?: string;
  days_since_start?: number;
  best_streak?: number;
  heatmap_month?: number[];
  days_span?: string;
}

export interface InterestMilestone {
  milestone_id: string;
  earned: boolean;
  earned_at: string | null;
  soul_line: string | null;
  stats: MilestoneStats | null;
  interest_icon: string | null;
}

export interface MilestoneDefinition {
  id: string;
  number: number;
  title: string;
  icon: string | null;
  lockedHint: string;
  isRare?: boolean;
}

export const MILESTONE_DEFINITIONS: MilestoneDefinition[] = [
  {
    id: "first_step",
    number: 1,
    title: "First Step",
    icon: "⚡",
    lockedHint: "Complete your first session",
  },
  {
    id: "seven_days",
    number: 2,
    title: "7 Days In",
    icon: "🔥",
    lockedHint: "7 consecutive sessions",
  },
  {
    id: "ten_sessions",
    number: 3,
    title: "10 Sessions",
    icon: "🎯",
    lockedHint: "10 completed sessions",
  },
  {
    id: "tier_up",
    number: 4,
    title: "Levelled Up",
    icon: "⬆️",
    lockedHint: "Reach Medium tier",
  },
  {
    id: "one_month",
    number: 5,
    title: "One Month",
    icon: "📅",
    lockedHint: "30 days since first session",
  },
  {
    id: "fifty_sessions",
    number: 6,
    title: "50 Sessions",
    icon: null,
    lockedHint: "50 completed sessions",
  },
  {
    id: "hundred_sessions",
    number: 7,
    title: "100 Sessions",
    icon: "👑",
    lockedHint: "100 completed sessions",
    isRare: true,
  },
];

export const PLACEHOLDER_MILESTONES: InterestMilestone[] = [
  {
    milestone_id: "first_step",
    earned: true,
    earned_at: "2026-03-13T09:14:00Z",
    soul_line: "The day you decided guitar was worth one hour.",
    stats: { sessions_count: 1, xp_total: 15, tier: "Easy" },
    interest_icon: null,
  },
  {
    milestone_id: "seven_days",
    earned: true,
    earned_at: "2026-03-20T20:02:00Z",
    soul_line: "Seven days of showing up for guitar. Most people stop at three.",
    stats: {
      sessions_count: 9,
      xp_total: 148,
      tier: "Easy",
      streak_days: 7,
      heatmap_days: [2, 3, 1, 3, 2, 4, 3],
    },
    interest_icon: null,
  },
  {
    milestone_id: "ten_sessions",
    earned: true,
    earned_at: "2026-03-27T10:30:00Z",
    soul_line: "Ten sessions is where dabbling ends and doing begins.",
    stats: { sessions_count: 10, xp_total: 214, tier: "Easy", tier_bar_pct: 72 },
    interest_icon: null,
  },
  { milestone_id: "tier_up", earned: false, earned_at: null, soul_line: null, stats: null, interest_icon: null },
  { milestone_id: "one_month", earned: false, earned_at: null, soul_line: null, stats: null, interest_icon: null },
  { milestone_id: "fifty_sessions", earned: false, earned_at: null, soul_line: null, stats: null, interest_icon: "🎸" },
  { milestone_id: "hundred_sessions", earned: false, earned_at: null, soul_line: null, stats: null, interest_icon: null },
];
