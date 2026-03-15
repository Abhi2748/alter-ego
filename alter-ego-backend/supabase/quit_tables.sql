-- Quit targets and milestones. Run in Supabase SQL Editor after main schema.
-- Adds: quit_targets, quit_milestones + RLS.

-- Quit targets table
CREATE TABLE IF NOT EXISTS quit_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quit_description TEXT NOT NULL,
  quit_name TEXT NOT NULL,
  trigger_description TEXT,
  underlying_need TEXT,
  need_category TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','conquered','paused')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_clean_streak INTEGER NOT NULL DEFAULT 0,
  best_clean_streak INTEGER NOT NULL DEFAULT 0,
  total_clean_days INTEGER NOT NULL DEFAULT 0,
  slip_count INTEGER NOT NULL DEFAULT 0,
  cravings_resisted INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  conquered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quit milestones table
CREATE TABLE IF NOT EXISTS quit_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quit_target_id UUID NOT NULL REFERENCES quit_targets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone_type TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clean_days_at_earn INTEGER,
  phase_at_earn TEXT,
  slip_duration_hours INTEGER,
  quote TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE quit_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE quit_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own their quit targets" ON quit_targets;
CREATE POLICY "Users own their quit targets"
  ON quit_targets FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own their quit milestones" ON quit_milestones;
CREATE POLICY "Users own their quit milestones"
  ON quit_milestones FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS quit_targets_user_id ON quit_targets(user_id);
CREATE INDEX IF NOT EXISTS quit_milestones_quit_target_id ON quit_milestones(quit_target_id);
CREATE INDEX IF NOT EXISTS quit_milestones_user_id ON quit_milestones(user_id);
