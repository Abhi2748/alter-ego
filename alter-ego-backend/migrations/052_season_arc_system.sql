-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 052: Season / Arc system
--
-- Adds two tables:
--   user_seasons    — one row per season per user (current + history)
--   season_day_log  — one row per calendar day within a season
--
-- Backend service writes to these. Frontend reads via GET /api/v1/seasons/current.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── user_seasons ─────────────────────────────────────────────────────────────
-- Tracks each season arc a user runs. Starts empty; Season 1 is created
-- automatically on the first mission completion after onboarding.

CREATE TABLE IF NOT EXISTS public.user_seasons (
    id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Identity
    season_number         int         NOT NULL DEFAULT 1 CHECK (season_number >= 1),
    season_name           text        NOT NULL DEFAULT 'The Spark',
    archetype_season_name text,                           -- archetype-specific name variant (nullable)
    season_theme          text        NOT NULL DEFAULT 'Prove you can show up.',
    season_color          text        NOT NULL DEFAULT '#F97316',   -- hex, used by frontend

    -- State
    status                text        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'completed', 'failed', 'between')),
    current_phase         int         NOT NULL DEFAULT 1 CHECK (current_phase >= 1),           -- 1–3 for S1, 1–5 for S2+

    -- Timeline
    total_days            int         NOT NULL DEFAULT 30 CHECK (total_days > 0),
    started_at            date        NOT NULL,
    ends_at               date        NOT NULL,

    -- Progress counters (updated nightly by scheduler + on mission completion)
    days_completed        int         NOT NULL DEFAULT 0,           -- days with ≥60% core missions done
    days_perfect          int         NOT NULL DEFAULT 0,           -- days with all 6 core missions done
    days_missed           int         NOT NULL DEFAULT 0,           -- calendar days with <60% (and season running)

    -- Completion (filled when status → completed or failed)
    completion_tier       text                  CHECK (completion_tier IN ('perfect', 'clear', 'partial', 'failed')),
    completion_seen       bool        NOT NULL DEFAULT false,       -- true once user views completion screen
    xp_awarded            int,                                      -- XP granted on season end
    title_unlocked        text,                                     -- equippable title string
    twin_closing_entry    text,                                     -- AI-generated closing journal entry

    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    CHECK (ends_at >= started_at)
);

-- Only one active season per user at any time
CREATE UNIQUE INDEX IF NOT EXISTS user_seasons_one_active_idx
    ON public.user_seasons (user_id)
    WHERE status = 'active';

-- Fast lookup: all seasons for a user ordered by season_number
CREATE INDEX IF NOT EXISTS user_seasons_user_idx
    ON public.user_seasons (user_id, season_number DESC);

-- RLS
ALTER TABLE public.user_seasons ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'user_seasons'
          AND policyname = 'user_seasons_select_own'
    ) THEN
        CREATE POLICY "user_seasons_select_own" ON public.user_seasons
            FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'user_seasons'
          AND policyname = 'user_seasons_insert_own'
    ) THEN
        CREATE POLICY "user_seasons_insert_own" ON public.user_seasons
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'user_seasons'
          AND policyname = 'user_seasons_update_own'
    ) THEN
        CREATE POLICY "user_seasons_update_own" ON public.user_seasons
            FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Keep updated_at current on row updates (function exists in 001_initial_schema.sql)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'user_seasons_updated_at'
    ) THEN
        CREATE TRIGGER user_seasons_updated_at
            BEFORE UPDATE ON public.user_seasons
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END $$;

-- No DELETE policy — seasons are permanent records


-- ── season_day_log ────────────────────────────────────────────────────────────
-- One row per calendar day within a season.
-- Written by the nightly scheduler (user_local_maintenance_job) or
-- on mission completion for today's row.
-- The full 30 or 66 rows are NOT pre-inserted — rows are created as days pass.
-- Frontend derives 'future' status from absence of a row + days remaining.

CREATE TABLE IF NOT EXISTS public.season_day_log (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    season_id       uuid        NOT NULL REFERENCES public.user_seasons(id) ON DELETE CASCADE,

    day_number      int         NOT NULL CHECK (day_number >= 1),   -- 1-indexed day within the season (1 = started_at)
    log_date        date        NOT NULL,   -- actual calendar date (user's local timezone)

    -- Outcome for this day
    status          text        NOT NULL DEFAULT 'missed'
                        CHECK (status IN ('perfect', 'complete', 'missed')),
                        -- 'perfect'  = all 6 core missions done
                        -- 'complete' = ≥60% core missions done (streak counts)
                        -- 'missed'   = <60% (season day lost)

    missions_done   int         NOT NULL DEFAULT 0 CHECK (missions_done >= 0),   -- core missions completed this day
    missions_total  int         NOT NULL DEFAULT 6 CHECK (missions_total > 0),   -- core missions available this day

    created_at      timestamptz NOT NULL DEFAULT now(),

    CHECK (missions_done <= missions_total),
    UNIQUE (season_id, day_number),
    UNIQUE (season_id, log_date)
);

CREATE INDEX IF NOT EXISTS season_day_log_season_idx
    ON public.season_day_log (season_id, day_number);

CREATE INDEX IF NOT EXISTS season_day_log_user_idx
    ON public.season_day_log (user_id, log_date);

-- RLS
ALTER TABLE public.season_day_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'season_day_log'
          AND policyname = 'season_day_log_select_own'
    ) THEN
        CREATE POLICY "season_day_log_select_own" ON public.season_day_log
            FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'season_day_log'
          AND policyname = 'season_day_log_insert_own'
    ) THEN
        CREATE POLICY "season_day_log_insert_own" ON public.season_day_log
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'season_day_log'
          AND policyname = 'season_day_log_update_own'
    ) THEN
        CREATE POLICY "season_day_log_update_own" ON public.season_day_log
            FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;
