-- Twin streak snapshot for the calendar day (for Twin journal & analytics).
-- Written when simulate_twin_day upserts twin_daily_record.

ALTER TABLE public.twin_daily_record
  ADD COLUMN IF NOT EXISTS twin_streak_after INTEGER;

COMMENT ON COLUMN public.twin_daily_record.twin_streak_after IS
  'Twin shadow streak count after simulating this record_date (same as twin_state.twin_streak after that day''s run).';
