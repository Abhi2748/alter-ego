-- Per-mission Twin simulation completions for Home UI (shadow mark + completion micro-copy).
-- Rows are written by the backend after twin_daily_record is upserted (service role).

CREATE TABLE IF NOT EXISTS public.twin_mission_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mission_date    DATE NOT NULL,
  mission_title   TEXT NOT NULL,
  core_pillar     TEXT,
  mission_type    TEXT NOT NULL,
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  simulated_hour  INTEGER NOT NULL DEFAULT 9 CHECK (simulated_hour >= 0 AND simulated_hour <= 23),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT twin_mission_log_unique UNIQUE (user_id, mission_date, mission_title)
);

CREATE INDEX IF NOT EXISTS idx_twin_mission_log_user_date
  ON public.twin_mission_log(user_id, mission_date DESC);

ALTER TABLE public.twin_mission_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'twin_mission_log' AND policyname = 'twin_mission_log_select_own'
  ) THEN
    CREATE POLICY "twin_mission_log_select_own" ON public.twin_mission_log
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;
