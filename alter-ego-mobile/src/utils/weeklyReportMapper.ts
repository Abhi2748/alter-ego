/**
 * Maps backend weekly report payloads → WeeklyReportScreen UI model.
 */

import type { WeeklyReportRow } from "@/utils/api";
import type { PastReportSummary, WeeklyReportData } from "@/types/weeklyReportUi";

export function mapRowToWeeklyReportData(
  row: WeeklyReportRow,
  past: PastReportSummary[]
): WeeklyReportData {
  const d = (row.this_week_data ?? {}) as Record<string, unknown>;
  const xpSeven = (d.day_of_week_xp as number[] | undefined);
  const completion = (d.day_of_week_completion as number[] | undefined) ?? [
    0, 0, 0, 0, 0, 0, 0,
  ];
  const daily_xp =
    xpSeven && xpSeven.length >= 7
      ? xpSeven.slice(0, 7)
      : completion.map((pct) => Math.round((pct / 100) * 180));
  const weekEnd = (() => {
    const s = new Date(row.week_start + "T00:00:00");
    s.setDate(s.getDate() + 6);
    return s.toISOString().slice(0, 10);
  })();
  const wins = row.wins ?? [];
  const one_win = wins.length > 0 ? wins.join(" ") : "—";
  const twinParts = [row.twin_paragraph, row.twin_closing].filter(Boolean);
  const twin_message = twinParts.length > 0 ? twinParts.join("\n") : "—";
  const slipped = row.slipped ?? [];
  const slippedText =
    Array.isArray(slipped) && slipped.length > 0 ? slipped.join(" ") : null;
  const kw = row.keep_watching;
  const kwText = Array.isArray(kw) ? kw.join(" ") : kw ?? null;
  const one_focus = slippedText ?? kwText ?? "—";

  return {
    week_start: row.week_start,
    week_end: weekEnd,
    power_score: (d.power_score as number) ?? 0,
    power_score_change: (d.power_score_change as number) ?? 0,
    streak_current: (d.current_streak as number) ?? 0,
    streak_longest_month: (d.longest_streak as number) ?? (d.current_streak as number) ?? 0,
    daily_xp,
    pet_stage: (d.pet_stage as number) ?? 0,
    pet_name: (d.pet_name as string) ?? "—",
    pet_next_name: "—",
    days_to_next_pet: null,
    pet_was_sad: false,
    // Gap — real values from this_week_data
    gap_xp: (d.gap_xp as number) ?? 0,
    gap_change_xp: (d.gap_change as number) ?? 0,
    user_is_ahead: Boolean(d.user_is_ahead),
    // Keep gap_days and gap_change for any existing usage (map from XP)
    gap_days: (d.gap_xp as number) ?? 0,
    gap_change: (d.gap_change as number) ?? 0,
    // Focus
    focus_total_seconds: (d.focus_total_seconds as number) ?? 0,
    focus_session_count: (d.focus_session_count as number) ?? 0,
    focus_avg_seconds: (d.focus_avg_seconds as number) ?? 0,
    focus_top_tag_name: (d.focus_top_tag_name as string | null) ?? null,
    focus_top_tag_seconds: (d.focus_top_tag_seconds as number) ?? 0,
    // Per-interest / per-quit
    interest_arcs: Array.isArray(d.interest_arcs) ? (d.interest_arcs as WeeklyReportData["interest_arcs"]) : [],
    quit_progress: Array.isArray(d.quit_progress) ? (d.quit_progress as WeeklyReportData["quit_progress"]) : [],
    // THIS WEEK structured stats
    best_day_label: (d.best_day as string) ?? null,
    best_day_count: (d.best_day_count as number) ?? 0,
    hardest_day_label: (d.hardest_day as string) ?? null,
    hardest_day_count: (d.hardest_day_count as number) ?? 0,
    days_active: (d.days_active as number) ?? 0,
    completion_rate_pct: Math.round(((d.completion_rate as number) ?? 0) * 100),
    xp_earned: (d.xp_earned as number) ?? 0,
    pf_earned: (d.pet_food_earned as number) ?? (d.pf_earned as number) ?? 0,
    missions_completed: (d.missions_completed as number) ?? 0,
    missions_total: (d.missions_total as number) ?? 0,
    core_days_complete: (d.core_days_complete as number) ?? 0,
    narrative: `You completed ${(d.missions_completed as number) ?? 0} of ${(d.missions_total as number) ?? 0} missions. Core: ${(d.core_days_complete as number) ?? 0}/${(d.core_days_total as number) ?? 0} days. ${(d.xp_earned as number) ?? 0} XP, ${(d.pet_food_earned as number) ?? 0} Pet Food.`,
    one_win,
    one_focus,
    twin_message,
    next_week_note: row.next_week ?? "—",
    past_reports: past,
  };
}

/** Build WeeklyReportRow from /reports/weekly JSON (current week). */
export function currentWeeklyToRow(
  j: Record<string, unknown>,
  syntheticId: string
): WeeklyReportRow {
  return {
    id: syntheticId,
    user_id: "",
    week_start: String(j.week_start ?? ""),
    this_week_data: (j.this_week_data as WeeklyReportRow["this_week_data"]) ?? {},
    wins: (j.wins as string[]) ?? [],
    slipped: (j.slipped as string[]) ?? [],
    keep_watching: j.keep_watching as WeeklyReportRow["keep_watching"],
    twin_paragraph: j.twin_paragraph as string | null,
    twin_closing: j.twin_closing as string | null,
    next_week: j.next_week as string | null,
    created_at: (j.generated_at as string) ?? undefined,
  };
}

/** Past report detail / weekly-by-id payload → row */
export function weeklyDetailToRow(j: Record<string, unknown>): WeeklyReportRow {
  return currentWeeklyToRow(j, String(j.id ?? j.week_start ?? "report"));
}
