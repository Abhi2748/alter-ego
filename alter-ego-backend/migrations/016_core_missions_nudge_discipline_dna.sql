-- Per-pillar core mission difficulty + progression (core mission agent + recalibration)

ALTER TABLE public.discipline_dna
  ADD COLUMN IF NOT EXISTS core_sleep_difficulty TEXT NOT NULL DEFAULT 'easy'
    CHECK (core_sleep_difficulty IN ('easy', 'medium', 'hard', 'elite')),
  ADD COLUMN IF NOT EXISTS core_movement_difficulty TEXT NOT NULL DEFAULT 'easy'
    CHECK (core_movement_difficulty IN ('easy', 'medium', 'hard', 'elite')),
  ADD COLUMN IF NOT EXISTS core_hydration_difficulty TEXT NOT NULL DEFAULT 'easy'
    CHECK (core_hydration_difficulty IN ('easy', 'medium', 'hard', 'elite')),
  ADD COLUMN IF NOT EXISTS core_mindfulness_difficulty TEXT NOT NULL DEFAULT 'easy'
    CHECK (core_mindfulness_difficulty IN ('easy', 'medium', 'hard', 'elite')),
  ADD COLUMN IF NOT EXISTS core_no_phone_difficulty TEXT NOT NULL DEFAULT 'easy'
    CHECK (core_no_phone_difficulty IN ('easy', 'medium', 'hard', 'elite')),

  ADD COLUMN IF NOT EXISTS core_sleep_clean_weeks INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS core_movement_clean_weeks INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS core_hydration_clean_weeks INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS core_mindfulness_clean_weeks INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS core_no_phone_clean_weeks INTEGER NOT NULL DEFAULT 0,

  ADD COLUMN IF NOT EXISTS core_sleep_difficulty_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS core_movement_difficulty_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS core_hydration_difficulty_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS core_mindfulness_difficulty_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS core_no_phone_difficulty_changed_at TIMESTAMPTZ,

  ADD COLUMN IF NOT EXISTS pending_difficulty_change TEXT;

COMMENT ON COLUMN public.discipline_dna.pending_difficulty_change IS
  'Hints for weekly report: pillar:ready flags and/or auto difficulty change summaries';
