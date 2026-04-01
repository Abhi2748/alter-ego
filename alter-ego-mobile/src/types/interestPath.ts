/**
 * Profile → Interests path UI (GET /api/v1/profile/interests → ui_path).
 */

export type InterestInsight = {
  id: string;
  title: string;
  body: string;
  unlocked: boolean;
};

export type PathQuest = {
  id: string;
  order: number;
  title: string;
  description: string;
  success_criteria: string[];
  criteria_done: boolean[];
  status: "completed" | "active" | "locked";
  estimated_total: number;
  estimated_days_remaining: number;
};

export type InterestPath = {
  path_id: string;
  interest_name: string;
  goal_text: string;
  color_hex: string;
  experience_label: string;
  schedule_days: number[];
  difficulty: "easy" | "medium" | "hard";
  craft_sp: number;
  next_craft_threshold: number;
  craft_level_name: string;
  quests: PathQuest[];
  insights: InterestInsight[];
  completed_quests_count: number;
  total_quests: number;
  insights_unlocked_count: number;
  insights_total: number;
};

/** Row fields merged for sheets + cards */
export type InterestPathDisplay = InterestPath & {
  schedule_abbrev: string;
  difficulty_label: string;
  // Arc fields (migration 035 / GET profile/interests)
  sessions_completed?: number;
  total_planned_sessions?: number | null;
  current_arc_phase?: string; // "foundation" | "building" | "applying" | "mastery" | "no_deadline"
  arc_phase_label?: string;
  target_date?: string | null;
  arc_paused?: boolean;
  progress_pct?: number | null;
};

export type ProfileInterestApiRow = {
  id: string;
  name: string | null;
  /** Hex from DB, e.g. #14B8A6 */
  color?: string | null;
  user_goal: string | null;
  current_difficulty_tier?: string | null;
  active_days?: number[] | null;
  ui_path?: InterestPath | null;
  schedule_abbrev?: string | null;
  difficulty_label?: string | null;
  sessions_completed?: number | null;
  total_planned_sessions?: number | null;
  current_arc_phase?: string | null;
  arc_phase_label?: string | null;
  target_date?: string | null;
  arc_paused?: boolean | null;
  progress_pct?: number | null;
};

export function fallbackInterestPathDisplay(row: ProfileInterestApiRow): InterestPathDisplay {
  const name = row.name?.trim() || "Interest";
  return {
    path_id: row.id,
    interest_name: name,
    goal_text: row.user_goal?.trim() || "—",
    color_hex: "#8B5CF6",
    experience_label: "—",
    schedule_days: [1, 2, 3, 4, 5, 6, 7],
    difficulty: "medium",
    craft_sp: 0,
    next_craft_threshold: 200,
    craft_level_name: "—",
    quests: [],
    insights: [],
    completed_quests_count: 0,
    total_quests: 0,
    insights_unlocked_count: 0,
    insights_total: 0,
    schedule_abbrev: "—",
    difficulty_label: "—",
    sessions_completed: row.sessions_completed ?? undefined,
    total_planned_sessions: row.total_planned_sessions ?? undefined,
    current_arc_phase: row.current_arc_phase ?? undefined,
    arc_phase_label: row.arc_phase_label ?? undefined,
    target_date: row.target_date ?? undefined,
    arc_paused: row.arc_paused ?? undefined,
    progress_pct: row.progress_pct ?? undefined,
  };
}

export function toInterestPathDisplay(row: ProfileInterestApiRow): InterestPathDisplay {
  const p = row.ui_path;
  const hexFromRow = row.color?.trim();
  if (!p || !Array.isArray(p.quests)) {
    const f = fallbackInterestPathDisplay(row);
    return {
      ...f,
      color_hex: hexFromRow?.startsWith("#") ? hexFromRow : f.color_hex,
      schedule_abbrev: row.schedule_abbrev ?? f.schedule_abbrev,
      difficulty_label: row.difficulty_label ?? f.difficulty_label,
      sessions_completed: row.sessions_completed ?? f.sessions_completed,
      total_planned_sessions: row.total_planned_sessions ?? f.total_planned_sessions,
      current_arc_phase: row.current_arc_phase ?? f.current_arc_phase,
      arc_phase_label: row.arc_phase_label ?? f.arc_phase_label,
      target_date: row.target_date ?? f.target_date,
      arc_paused: row.arc_paused ?? f.arc_paused,
      progress_pct: row.progress_pct ?? f.progress_pct,
    };
  }
  return {
    ...p,
    color_hex: hexFromRow?.startsWith("#") ? hexFromRow : p.color_hex,
    schedule_abbrev: row.schedule_abbrev ?? "—",
    difficulty_label: row.difficulty_label ?? "—",
    sessions_completed: row.sessions_completed ?? undefined,
    total_planned_sessions: row.total_planned_sessions ?? undefined,
    current_arc_phase: row.current_arc_phase ?? undefined,
    arc_phase_label: row.arc_phase_label ?? undefined,
    target_date: row.target_date ?? undefined,
    arc_paused: row.arc_paused ?? undefined,
    progress_pct: row.progress_pct ?? undefined,
  };
}
