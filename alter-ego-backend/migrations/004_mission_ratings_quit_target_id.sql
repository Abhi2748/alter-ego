-- mission_ratings: link resistance-mission ratings to quit_targets (parallel to interest_id).
-- Required by planner_agent quit sync, POST /missions/{id}/rate, and quit-target rating history.

ALTER TABLE mission_ratings
  ADD COLUMN IF NOT EXISTS quit_target_id UUID REFERENCES quit_targets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mission_ratings_quit_target
  ON mission_ratings(quit_target_id, created_at DESC)
  WHERE quit_target_id IS NOT NULL;

COMMENT ON COLUMN mission_ratings.quit_target_id IS
  'Set when the rated mission is type resistance; mirrors missions.quit_target_id.';
