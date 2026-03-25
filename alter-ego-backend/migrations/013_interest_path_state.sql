-- Per-interest UI path / quest progress for Profile → Interests tab.
ALTER TABLE interests
  ADD COLUMN IF NOT EXISTS interest_path_state jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN interests.interest_path_state IS
  'Quest progress: { current: 0-2, criteria: {"0":[bool,bool],...}, bonus_insights: [] }';
