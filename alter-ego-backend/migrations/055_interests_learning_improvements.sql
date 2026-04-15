-- ═══════════════════════════════════════════════════════════════════════
-- Migration 055: Interest learning improvements
--
-- Adds five columns to public.interests to support:
--   - Honest goal calibration (achievable_outcome)
--   - Domain-specific learning roadmap (progression_milestones)
--   - Learning resource recommendations (recommended_resources)
--   - Session-level skill continuity ledger (covered_skills)
--   - Feedback-driven next session override (next_session_note)
-- ═══════════════════════════════════════════════════════════════════════

-- What the user can realistically achieve in their chosen timeline
-- (written by the normaliser at interest creation; shown to the user on setup)
ALTER TABLE public.interests
    ADD COLUMN IF NOT EXISTS achievable_outcome TEXT;

-- Ordered list of skill milestones for this domain at this level
-- e.g. ["confident line control", "basic geometric shapes", "tonal shading"]
-- Written by normaliser; planner reads this to know what to target next
ALTER TABLE public.interests
    ADD COLUMN IF NOT EXISTS progression_milestones JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Curated learning resources for this domain
-- [{type, title, author, why}, ...]
-- Written by normaliser; shown in Interest Detail screen and referenced in missions
ALTER TABLE public.interests
    ADD COLUMN IF NOT EXISTS recommended_resources JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Running list of skills the user has actually covered (one entry per completed mission)
-- e.g. ["wrist control", "ellipses", "pressure variation"]
-- Appended by arc_service after each completed mission; read by planner for continuity
ALTER TABLE public.interests
    ADD COLUMN IF NOT EXISTS covered_skills JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Specific issue to address in the next session (written from user feedback)
-- e.g. "User doesn't understand hip rotation mechanics"
-- Planner reads this at highest priority; cleared after mission is generated
ALTER TABLE public.interests
    ADD COLUMN IF NOT EXISTS next_session_note TEXT;
