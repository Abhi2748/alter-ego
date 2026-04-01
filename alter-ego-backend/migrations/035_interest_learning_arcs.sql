-- Migration 035: Interest Learning Arcs
-- Adds arc-based learning progression to the interests table.
-- The arc system tracks where a user is in their structured learning journey
-- toward a specific goal within a target timeline.

ALTER TABLE public.interests
    ADD COLUMN IF NOT EXISTS target_date DATE,
    ADD COLUMN IF NOT EXISTS original_target_date DATE,
    ADD COLUMN IF NOT EXISTS total_planned_sessions INT,
    ADD COLUMN IF NOT EXISTS sessions_completed INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_arc_phase TEXT DEFAULT 'foundation',
    -- values: foundation | building | applying | mastery | no_deadline
    ADD COLUMN IF NOT EXISTS arc_phase_session INT DEFAULT 0,
    -- session number within the current arc phase (resets on phase transition)
    ADD COLUMN IF NOT EXISTS timeline_adjusted_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS arc_paused BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS arc_paused_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS arc_paused_reason TEXT;
    -- values: user_requested | low_engagement | null

-- Index for efficient arc replanning queries (weekly job scans active, non-paused interests)
CREATE INDEX IF NOT EXISTS idx_interests_arc_active
    ON public.interests(user_id, arc_paused, target_date)
    WHERE is_active = TRUE AND arc_paused = FALSE;

-- Index for phase transition detection
CREATE INDEX IF NOT EXISTS idx_interests_sessions
    ON public.interests(user_id, sessions_completed, total_planned_sessions)
    WHERE is_active = TRUE;
