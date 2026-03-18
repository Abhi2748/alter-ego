-- Add intervention_hour to quit_targets
-- Stores the local hour (0-23) when the user typically experiences the urge
-- Extracted from urge_timing free text during normalisation
-- Nullable — not all quit targets have a specific urge time

ALTER TABLE quit_targets
ADD COLUMN IF NOT EXISTS intervention_hour INTEGER
CHECK (intervention_hour IS NULL OR (intervention_hour >= 0 AND intervention_hour <= 23));

-- Add nudge_category to nudge_log for analytics
ALTER TABLE nudge_log
ADD COLUMN IF NOT EXISTS nudge_category TEXT
CHECK (nudge_category IS NULL OR nudge_category IN ('A', 'B', 'C'));

-- Add intervention_hour to interest normaliser prompt output note
COMMENT ON COLUMN quit_targets.intervention_hour IS
'Local hour (0-23) when urge typically hits. Extracted from urge_timing by normalisation agent. Used for Category B nudges.';
