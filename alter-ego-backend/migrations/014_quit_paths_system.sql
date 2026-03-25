-- Quit Target Path system (replaces quit_targets + planner quit missions).
-- Run after 013. Apply in Supabase SQL editor in order with prior migrations.

DROP TABLE IF EXISTS public.quit_missions CASCADE;
DROP TABLE IF EXISTS public.user_quit_targets CASCADE;

-- Remove legacy FK columns that reference quit_targets
ALTER TABLE public.missions DROP CONSTRAINT IF EXISTS missions_quit_target_id_fkey;
ALTER TABLE public.missions DROP COLUMN IF EXISTS quit_target_id;

ALTER TABLE public.mission_ratings DROP CONSTRAINT IF EXISTS mission_ratings_quit_target_id_fkey;
ALTER TABLE public.mission_ratings DROP COLUMN IF EXISTS quit_target_id;

ALTER TABLE public.milestone_log DROP CONSTRAINT IF EXISTS milestone_log_quit_target_id_fkey;
ALTER TABLE public.milestone_log DROP COLUMN IF EXISTS quit_target_id;

DROP TABLE IF EXISTS public.quit_targets CASCADE;

-- ── quit_paths ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quit_paths (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  habit_name              TEXT NOT NULL,
  habit_normalized        TEXT NOT NULL,
  initials                TEXT NOT NULL,

  trigger_contexts        TEXT[] NOT NULL DEFAULT '{}',
  awareness_level         TEXT NOT NULL DEFAULT 'semi_conscious'
                            CHECK (awareness_level IN ('subconscious','semi_conscious','conscious')),
  quit_goal               TEXT NOT NULL DEFAULT 'stop_completely'
                            CHECK (quit_goal IN ('stop_completely','reduce_significantly','make_conscious')),

  underlying_need         TEXT NOT NULL DEFAULT 'stress_anxiety',
  need_description        TEXT,

  current_phase           TEXT NOT NULL DEFAULT 'mapping'
                            CHECK (current_phase IN ('mapping','disruption','consolidation')),
  phase_started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mapping_complete        BOOLEAN NOT NULL DEFAULT FALSE,
  disruption_complete     BOOLEAN NOT NULL DEFAULT FALSE,

  phase_1_focus           TEXT,
  competing_response      TEXT,

  frequency_unit          TEXT NOT NULL DEFAULT 'times'
                            CHECK (frequency_unit IN ('times','minutes')),
  frequency_today         INTEGER NOT NULL DEFAULT 0,
  frequency_baseline      DOUBLE PRECISION,
  frequency_reduction_pct INTEGER NOT NULL DEFAULT 0,

  status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','completed','paused','referral_only')),
  requires_professional_referral BOOLEAN NOT NULL DEFAULT FALSE,
  referral_message        TEXT NOT NULL DEFAULT '',

  intervention_hour       INTEGER,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT quit_paths_user_habit_unique UNIQUE (user_id, habit_normalized)
);

ALTER TABLE public.quit_paths ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own quit paths" ON public.quit_paths;
CREATE POLICY "Users manage own quit paths"
  ON public.quit_paths FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_quit_paths_user ON public.quit_paths(user_id);

-- ── quit_frequency_log ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quit_frequency_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quit_path_id    UUID NOT NULL REFERENCES public.quit_paths(id) ON DELETE CASCADE,
  log_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  count           INTEGER NOT NULL DEFAULT 0,
  unit            TEXT NOT NULL DEFAULT 'times',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quit_freq_unique UNIQUE (quit_path_id, log_date)
);

ALTER TABLE public.quit_frequency_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own frequency logs" ON public.quit_frequency_log;
CREATE POLICY "Users manage own frequency logs"
  ON public.quit_frequency_log FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_quit_freq_path ON public.quit_frequency_log(quit_path_id, log_date DESC);

-- ── quit_insights ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quit_insights (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quit_path_id    UUID NOT NULL REFERENCES public.quit_paths(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phase           TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.quit_insights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own quit insights" ON public.quit_insights;
CREATE POLICY "Users manage own quit insights"
  ON public.quit_insights FOR ALL USING (auth.uid() = user_id);

-- ── missions: quit path link + agent fields ───────────────────────────────
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS quit_path_id UUID REFERENCES public.quit_paths(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mission_category TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS underlying_need TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_missions_quit_path ON public.missions(quit_path_id) WHERE quit_path_id IS NOT NULL;

ALTER TABLE public.mission_ratings
  ADD COLUMN IF NOT EXISTS quit_path_id UUID REFERENCES public.quit_paths(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mission_ratings_quit_path
  ON public.mission_ratings(quit_path_id, created_at DESC)
  WHERE quit_path_id IS NOT NULL;
