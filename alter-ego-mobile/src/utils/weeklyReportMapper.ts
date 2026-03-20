/**
 * Maps backend weekly report payloads → WeeklyReportScreen UI model.
 */

import type { WeeklyReportRow } from "@/utils/api";
import type { PastReportSummary, WeeklyReportData } from "@/types/weeklyReportUi";

export function mapRowToWeeklyReportData(
  row: WeeklyReportRow,
  past: PastReportSummary[]
): WeeklyReportData {
  const d = row.this_week_data ?? {};
  const completion = (d.day_of_week_completion as number[] | undefined) ?? [
    0, 0, 0, 0, 0, 0, 0,
  ];
  const maxPct = Math.max(...completion, 1);
  const daily_xp = completion.map((pct) => Math.round((pct / 100) * 180));
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
    power_score: 0,
    power_score_change: 0,
    streak_current: (d.current_streak as number) ?? 0,
    streak_longest_month: (d.current_streak as number) ?? 0,
    daily_xp,
    pet_stage: (d.pet_stage as number) ?? 0,
    pet_name: (d.pet_name as string) ?? "—",
    pet_next_name: "—",
    days_to_next_pet: null,
    pet_was_sad: false,
    gap_days: 0,
    gap_change: 0,
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
