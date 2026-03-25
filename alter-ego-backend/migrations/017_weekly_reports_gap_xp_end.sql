-- Store end-of-week twin vs user XP gap for week-over-week delta in reports
ALTER TABLE public.weekly_reports
  ADD COLUMN IF NOT EXISTS gap_xp_end INTEGER;

COMMENT ON COLUMN public.weekly_reports.gap_xp_end IS
  'Abs(user XP - twin XP) at end of this report week; used next week for gap_change';
