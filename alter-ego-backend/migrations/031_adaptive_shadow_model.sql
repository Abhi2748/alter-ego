-- Adaptive Shadow Model: twin_state columns for rolling XP / comeback / absence tracking.
ALTER TABLE public.twin_state
  ADD COLUMN IF NOT EXISTS twin_rolling_avg_xp    NUMERIC  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS twin_yesterday_xp       INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS twin_comeback_day       INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS twin_consecutive_absent INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS twin_last_active_date   DATE;
