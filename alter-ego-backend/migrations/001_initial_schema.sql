-- ALTER EGO — Initial schema (idempotent)
-- This migration is safe to re-run.

-- Required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================================
-- SECTION 1 — ENUMS
-- =====================================================================================

-- Enums (safe to re-run)
DO $$ BEGIN
  CREATE TYPE archetype_type AS ENUM (
    'restless_creator', 'reluctant_achiever', 'structured_climber',
    'lone_wolf', 'social_performer'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tone_type AS ENUM ('rival', 'philosopher', 'silent_force');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE gap_behavior_type AS ENUM ('chase', 'rubber_band', 'steady');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE message_frequency_type AS ENUM ('high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE gap_state_type AS ENUM (
    'user_ahead', 'neck_and_neck', 'slightly_behind', 'significantly_behind'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mission_type AS ENUM (
    'core', 'interest', 'personal', 'resistance', 'recovery'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE difficulty_type AS ENUM ('easy', 'medium', 'hard', 'elite');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pet_state_type AS ENUM ('happy', 'sad');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_tier_type AS ENUM (
    'free', 'beta_free', 'premium', 'pro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE interest_level_text AS ENUM (
    'still_figuring_it_out', 'getting_the_hang_of_it', 'pretty_solid'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE gender_type AS ENUM ('male', 'female', 'prefer_not_to_say');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE streak_tier_type AS ENUM (
    'tier_1', 'tier_2', 'tier_3', 'tier_4'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE feedback_type AS ENUM ('bug', 'concern', 'suggestion', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mail_type AS ENUM (
    'welcome', 'twin_guide', 'first_streak_tip', 'leaderboard_unlock',
    'pet_unlock', 'day_7_checkin', 'streak_requirement_update',
    'first_difficulty_upgrade', 'twin_recalibration_note',
    'week_4_encouragement', 'general'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================================
-- SECTION 2 — CORE TABLES
-- =====================================================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id              UUID UNIQUE,
  google_id                 TEXT UNIQUE,
  email                     TEXT UNIQUE,
  username                  TEXT UNIQUE NOT NULL,
  gender                    gender_type,
  age                       INTEGER,
  archetype                 archetype_type,
  timezone                  TEXT NOT NULL DEFAULT 'UTC',

  -- Character progression
  character_stage           INTEGER NOT NULL DEFAULT 1 CHECK (character_stage BETWEEN 1 AND 6),
  total_xp                  INTEGER NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  xp_frozen                 BOOLEAN NOT NULL DEFAULT FALSE,

  -- Pet progression
  pet_stage                 INTEGER NOT NULL DEFAULT 0 CHECK (pet_stage BETWEEN 0 AND 8),
  total_pf                  INTEGER NOT NULL DEFAULT 0 CHECK (total_pf >= 0),
  pet_unlocked              BOOLEAN NOT NULL DEFAULT FALSE,
  pet_state                 pet_state_type NOT NULL DEFAULT 'happy',

  -- Streak
  current_streak            INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak            INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  streak_requirement_tier   streak_tier_type NOT NULL DEFAULT 'tier_1',
  last_streak_date          DATE,

  -- Power score (cached, recalculated nightly)
  power_score               INTEGER NOT NULL DEFAULT 0,

  -- Unlocks
  leaderboard_unlocked      BOOLEAN NOT NULL DEFAULT FALSE,
  leaderboard_unlocked_at   TIMESTAMPTZ,

  -- Subscription
  subscription_tier         subscription_tier_type NOT NULL DEFAULT 'free',
  trial_start_date          TIMESTAMPTZ,
  registration_date         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Onboarding
  onboarding_complete       BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_completed_at   TIMESTAMPTZ,

  -- Email connected flag (for settings warning)
  email_connected           BOOLEAN NOT NULL DEFAULT FALSE,

  -- Push notification token
  push_token                TEXT,
  notifications_enabled     BOOLEAN NOT NULL DEFAULT FALSE,

  -- Daily time commitment (from Q13 slider, in hours)
  daily_hours_floor         NUMERIC(3,1) NOT NULL DEFAULT 1.0,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'users_updated_at'
  ) THEN
    CREATE TRIGGER users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- Onboarding answers
CREATE TABLE IF NOT EXISTS onboarding_answers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,  -- e.g. 'q4_situation', 'q11_interests', 'q13_hours'
  answer_json  JSONB NOT NULL,
  answered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, question_key)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_answers_user ON onboarding_answers(user_id, answered_at DESC);

-- Interests
CREATE TABLE IF NOT EXISTS interests (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- What the user typed
  raw_text                   TEXT NOT NULL,

  -- Normalised by B5 agent
  normalised_name            TEXT NOT NULL,
  category                   TEXT NOT NULL,
  mission_domain             TEXT NOT NULL,
  level_context_beginner     TEXT,
  level_context_intermediate TEXT,
  level_context_advanced     TEXT,
  evidence_base              TEXT,  -- Research/practice knowledge stored here
  common_obstacles           TEXT[],

  -- User's stated level and goal
  level_text                 interest_level_text NOT NULL DEFAULT 'still_figuring_it_out',
  user_goal                  TEXT,
  active_days                INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5,6,7}',
  -- 1=Mon, 2=Tue, ..., 7=Sun. All days by default.

  -- Progression (updated as user completes missions)
  interest_level             INTEGER NOT NULL DEFAULT 1 CHECK (interest_level BETWEEN 1 AND 10),
  interest_xp                INTEGER NOT NULL DEFAULT 0,
  current_difficulty_tier    difficulty_type NOT NULL DEFAULT 'easy',
  current_phase              TEXT NOT NULL DEFAULT 'days_1_10',
  -- phases: days_1_10 / days_11_30 / days_31_60 / days_61_90 / days_90_plus

  -- Session tracking
  total_sessions             INTEGER NOT NULL DEFAULT 0,

  -- Status
  is_active                  BOOLEAN NOT NULL DEFAULT TRUE,

  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'interests_updated_at'
  ) THEN
    CREATE TRIGGER interests_updated_at
      BEFORE UPDATE ON interests
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_interests_user ON interests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interests_user_active ON interests(user_id, is_active) WHERE is_active = TRUE;

-- Quit targets
CREATE TABLE IF NOT EXISTS quit_targets (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- User input
  raw_text                TEXT NOT NULL,
  user_description        TEXT,  -- "tell us more about this habit"
  trigger_text            TEXT,  -- what triggers the urge
  urge_timing             TEXT,  -- "around 3pm", "after lunch", "when stressed"

  -- Agent classification
  normalised_name         TEXT NOT NULL,
  need_category           TEXT,
  -- boredom_dopamine / stress_anxiety / social_ritual /
  -- impulsivity_gratification / avoidance_procrastination / comfort_oral

  -- Progression
  current_phase           TEXT NOT NULL DEFAULT 'days_1_10',
  current_difficulty_tier difficulty_type NOT NULL DEFAULT 'easy',

  -- Clean tracking
  clean_days              INTEGER NOT NULL DEFAULT 0,
  last_slip_date          DATE,

  -- Status
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  conquered               BOOLEAN NOT NULL DEFAULT FALSE,
  conquered_at            TIMESTAMPTZ,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'quit_targets_updated_at'
  ) THEN
    CREATE TRIGGER quit_targets_updated_at
      BEFORE UPDATE ON quit_targets
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quit_targets_user ON quit_targets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quit_targets_user_active ON quit_targets(user_id, is_active) WHERE is_active = TRUE;

-- =====================================================================================
-- SECTION 3 — MISSION TABLES
-- =====================================================================================

-- Missions
CREATE TABLE IF NOT EXISTS missions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type                mission_type NOT NULL,
  title               TEXT NOT NULL,
  difficulty          difficulty_type NOT NULL,

  -- XP and PF values (pre-calculated at generation time)
  xp_value            INTEGER NOT NULL DEFAULT 0,
  pf_value            INTEGER NOT NULL DEFAULT 0,

  -- Foreign keys (nullable — core/personal missions don't link to these)
  interest_id         UUID REFERENCES interests(id) ON DELETE SET NULL,
  quit_target_id      UUID REFERENCES quit_targets(id) ON DELETE SET NULL,

  -- Mission date (the day this mission is for)
  mission_date        DATE NOT NULL,

  -- Completion
  completed           BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at        TIMESTAMPTZ,

  -- For journal mission: links to journal_entries
  is_journal_mission  BOOLEAN NOT NULL DEFAULT FALSE,

  -- Multi-day missions
  is_multiday         BOOLEAN NOT NULL DEFAULT FALSE,
  multiday_parent_id  UUID REFERENCES missions(id) ON DELETE CASCADE,
  multiday_day_number INTEGER,
  multiday_total_days INTEGER,

  -- Agent metadata (stored for feedback loop)
  rationale           TEXT,
  phase_principle     TEXT,
  domain_knowledge    TEXT,
  estimated_minutes   INTEGER,

  -- Mission core pillar (for core missions only)
  core_pillar         TEXT,  -- sleep/movement/hydration/mindfulness/no_phone/journal

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_missions_user_date ON missions(user_id, mission_date);
CREATE INDEX IF NOT EXISTS idx_missions_user_type ON missions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_missions_user_created ON missions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_missions_interest ON missions(interest_id) WHERE interest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_missions_quit_target ON missions(quit_target_id) WHERE quit_target_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_missions_multiday_parent ON missions(multiday_parent_id) WHERE multiday_parent_id IS NOT NULL;

-- Mission ratings
CREATE TABLE IF NOT EXISTS mission_ratings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id      UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  interest_id     UUID REFERENCES interests(id) ON DELETE SET NULL,
  quit_target_id  UUID REFERENCES quit_targets(id) ON DELETE SET NULL,
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback_text   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mission_ratings_user ON mission_ratings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mission_ratings_mission ON mission_ratings(mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_ratings_interest ON mission_ratings(interest_id, created_at) WHERE interest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mission_ratings_quit_target ON mission_ratings(quit_target_id, created_at DESC) WHERE quit_target_id IS NOT NULL;

-- =====================================================================================
-- SECTION 4 — JOURNAL
-- =====================================================================================

-- Journal entries
CREATE TABLE IF NOT EXISTS journal_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_date DATE NOT NULL,
  content      TEXT NOT NULL,
  word_count   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, mission_date)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'journal_entries_updated_at'
  ) THEN
    CREATE TRIGGER journal_entries_updated_at
      BEFORE UPDATE ON journal_entries
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_journal_entries_user ON journal_entries(user_id, mission_date DESC);

-- =====================================================================================
-- SECTION 5 — XP AND PF LOGS
-- =====================================================================================

-- XP log
CREATE TABLE IF NOT EXISTS xp_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount             INTEGER NOT NULL,
  source_mission_id  UUID REFERENCES missions(id) ON DELETE SET NULL,
  character_stage_at INTEGER NOT NULL,
  total_after        INTEGER NOT NULL,
  log_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_log_user_date ON xp_log(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_xp_log_user_created ON xp_log(user_id, created_at DESC);

-- PF log
CREATE TABLE IF NOT EXISTS pf_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount            INTEGER NOT NULL,
  source_mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  pet_stage_at      INTEGER NOT NULL,
  total_after       INTEGER NOT NULL,
  log_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pf_log_user_date ON pf_log(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_pf_log_user_created ON pf_log(user_id, created_at DESC);

-- =====================================================================================
-- SECTION 6 — STREAK
-- =====================================================================================

-- Streak log
CREATE TABLE IF NOT EXISTS streak_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date             DATE NOT NULL,

  -- What was completed that day
  core_completed_count INTEGER NOT NULL DEFAULT 0,
  interest_completed   BOOLEAN NOT NULL DEFAULT FALSE,
  personal_completed   BOOLEAN NOT NULL DEFAULT FALSE,
  total_missions_done  INTEGER NOT NULL DEFAULT 0,
  total_missions       INTEGER NOT NULL DEFAULT 0,

  -- Streak result for this day
  streak_maintained    BOOLEAN NOT NULL DEFAULT FALSE,
  streak_count         INTEGER NOT NULL DEFAULT 0,
  requirement_tier     streak_tier_type NOT NULL DEFAULT 'tier_1',

  -- XP and PF for this day (denormalised for quick chart access)
  xp_earned            INTEGER NOT NULL DEFAULT 0,
  pf_earned            INTEGER NOT NULL DEFAULT 0,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_streak_log_user_date ON streak_log(user_id, log_date);

-- =====================================================================================
-- SECTION 7 — TWIN SYSTEM
-- =====================================================================================

-- Discipline DNA
CREATE TABLE IF NOT EXISTS discipline_dna (
  user_id                UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Twin personality (set from archetype, adapted every 14 days)
  twin_intensity         INTEGER NOT NULL DEFAULT 3 CHECK (twin_intensity BETWEEN 1 AND 5),
  twin_tone_type         tone_type NOT NULL DEFAULT 'rival',
  twin_gap_behavior      gap_behavior_type NOT NULL DEFAULT 'rubber_band',
  twin_message_frequency message_frequency_type NOT NULL DEFAULT 'medium',

  -- Behavioural signals (updated nightly from activity data)
  completion_rate_7d     NUMERIC(5,2) NOT NULL DEFAULT 0,
  completion_rate_30d    NUMERIC(5,2) NOT NULL DEFAULT 0,
  activity_time_of_day   INTEGER,  -- Hour in 24h format (0-23), in user's timezone
  difficulty_tolerance   NUMERIC(5,2) NOT NULL DEFAULT 0,
  -- 0-100: % of hard/elite missions completed vs assigned

  mission_skip_pattern   JSONB,
  -- {"most_skipped_type": "interest", "most_skipped_pillar": "movement", "skip_streak": 3}

  twin_chat_engagement   TEXT NOT NULL DEFAULT 'none',
  -- high (>5 sessions/week) / medium (2-5) / low (1) / none

  gap_response_pattern   TEXT,
  -- motivated_by_gap / discouraged_by_gap / indifferent_to_gap (detected at recalibration)

  -- Calibration tracking
  last_calibration_at    TIMESTAMPTZ,
  calibration_count      INTEGER NOT NULL DEFAULT 0,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'discipline_dna_updated_at'
  ) THEN
    CREATE TRIGGER discipline_dna_updated_at
      BEFORE UPDATE ON discipline_dna
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- Twin state
CREATE TABLE IF NOT EXISTS twin_state (
  user_id                 UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Twin progression (mirrors user's but driven by consistency_ceiling)
  twin_xp                 INTEGER NOT NULL DEFAULT 0,
  twin_pf                 INTEGER NOT NULL DEFAULT 0,
  twin_character_stage    INTEGER NOT NULL DEFAULT 1,
  twin_pet_stage          INTEGER NOT NULL DEFAULT 0,
  twin_pet_unlocked       BOOLEAN NOT NULL DEFAULT FALSE,
  twin_streak             INTEGER NOT NULL DEFAULT 0,

  -- Gap mechanics
  current_gap_state       gap_state_type NOT NULL DEFAULT 'neck_and_neck',
  consistency_ceiling     NUMERIC(4,3) NOT NULL DEFAULT 0.850 CHECK (consistency_ceiling BETWEEN 0 AND 1),

  -- Home strip message
  strip_message           TEXT,
  last_strip_updated      TIMESTAMPTZ,

  -- Passed tracking
  last_passed_at          TIMESTAMPTZ,
  -- When the user last overtook the twin
  ceiling_recovery_target NUMERIC(4,3),
  ceiling_recovery_end    DATE,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'twin_state_updated_at'
  ) THEN
    CREATE TRIGGER twin_state_updated_at
      BEFORE UPDATE ON twin_state
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- Twin daily record
CREATE TABLE IF NOT EXISTS twin_daily_record (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_date              DATE NOT NULL,

  missions_assigned        INTEGER NOT NULL DEFAULT 0,
  missions_completed       INTEGER NOT NULL DEFAULT 0,
  completed_mission_ids    UUID[] NOT NULL DEFAULT '{}',
  missed_mission_titles    TEXT[] NOT NULL DEFAULT '{}',

  xp_earned                INTEGER NOT NULL DEFAULT 0,
  pf_earned                INTEGER NOT NULL DEFAULT 0,

  consistency_ceiling_used NUMERIC(4,3),

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, record_date)
);

CREATE INDEX IF NOT EXISTS idx_twin_daily_user_date ON twin_daily_record(user_id, record_date);

-- Twin messages
CREATE TABLE IF NOT EXISTS twin_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'twin')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_twin_messages_user ON twin_messages(user_id, created_at DESC);

-- =====================================================================================
-- SECTION 8 — REPORTS + SUMMARIES
-- =====================================================================================

-- Daily summaries
CREATE TABLE IF NOT EXISTS daily_summaries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  summary_text TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_summaries_user ON daily_summaries(user_id, summary_date DESC);

-- Weekly reports
CREATE TABLE IF NOT EXISTS weekly_reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start     DATE NOT NULL,
  week_end       DATE NOT NULL,

  -- Section 1: raw data (assembled from tables, no LLM)
  this_week_data JSONB NOT NULL DEFAULT '{}',

  -- Section 2-5: LLM generated
  wins           TEXT[] NOT NULL DEFAULT '{}',
  slipped        TEXT[] NOT NULL DEFAULT '{}',
  keep_watching  TEXT[] NOT NULL DEFAULT '{}',
  twin_paragraph TEXT,
  twin_closing   TEXT,
  next_week      TEXT,

  -- Anti-repetition: store opening lines for next report's prompt
  wins_opening   TEXT,
  twin_opening   TEXT,
  theme_used     TEXT,

  generated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_user ON weekly_reports(user_id, week_start DESC);

-- =====================================================================================
-- SECTION 9 — MILESTONES + POWER SCORE
-- =====================================================================================

-- Milestone log
CREATE TABLE IF NOT EXISTS milestone_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone_type TEXT NOT NULL,
  -- Examples: 'stage_2', 'pet_stage_3', 'pet_unlock', 'streak_30',
  --           'leaderboard_unlock', 'interest_first_step', 'interest_100_sessions',
  --           'interest_365_sessions', 'quit_conquered'
  interest_id    UUID REFERENCES interests(id) ON DELETE SET NULL,
  quit_target_id UUID REFERENCES quit_targets(id) ON DELETE SET NULL,
  card_shown     BOOLEAN NOT NULL DEFAULT FALSE,
  earned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestone_log_user ON milestone_log(user_id, earned_at DESC);

-- Power score log
CREATE TABLE IF NOT EXISTS power_score_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score         INTEGER NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_power_score_user ON power_score_log(user_id, calculated_at DESC);

-- =====================================================================================
-- SECTION 10 — IN-APP MAILS
-- =====================================================================================

-- App mails
CREATE TABLE IF NOT EXISTS app_mails (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mail_type     mail_type NOT NULL,
  subject       TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at       TIMESTAMPTZ,
  -- read_at NULL = unread

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_mails_user ON app_mails(user_id, sent_at DESC);

-- =====================================================================================
-- SECTION 11 — NOTIFICATIONS + EVENTS
-- =====================================================================================

-- Nudge log
CREATE TABLE IF NOT EXISTS nudge_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nudge_type TEXT NOT NULL,
  -- streak_warning / re_engagement / pet_nudge / milestone_approaching / momentum
  tone_used  tone_type NOT NULL,
  nudge_text TEXT NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened     BOOLEAN NOT NULL DEFAULT FALSE,
  opened_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nudge_log_user ON nudge_log(user_id, sent_at DESC);

-- Event log
CREATE TABLE IF NOT EXISTS event_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}',
  logged_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_log_user ON event_log(user_id, logged_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_log_name ON event_log(event_name, logged_at DESC);

-- =====================================================================================
-- SECTION 12 — SETTINGS + FEEDBACK
-- =====================================================================================

-- Feedback submissions
CREATE TABLE IF NOT EXISTS feedback_submissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  type        feedback_type NOT NULL,
  content     TEXT NOT NULL,
  app_version TEXT,
  device_info TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_submissions_user ON feedback_submissions(user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- =====================================================================================
-- SECTION 13 — ROW LEVEL SECURITY
-- =====================================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quit_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE streak_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE discipline_dna ENABLE ROW LEVEL SECURITY;
ALTER TABLE twin_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE twin_daily_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE twin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE power_score_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_mails ENABLE ROW LEVEL SECURITY;
ALTER TABLE nudge_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Users: can read and update their own row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_select_own'
  ) THEN
    CREATE POLICY "users_select_own" ON users
      FOR SELECT
      USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_update_own'
  ) THEN
    CREATE POLICY "users_update_own" ON users
      FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- All other tables: users can only see rows where user_id = their auth.uid()
-- Apply this pattern to every table with user_id
DO $$
DECLARE
  t TEXT;
  p TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'onboarding_answers', 'interests', 'quit_targets', 'missions',
    'mission_ratings', 'journal_entries', 'xp_log', 'pf_log',
    'streak_log', 'discipline_dna', 'twin_state', 'twin_daily_record',
    'twin_messages', 'daily_summaries', 'weekly_reports', 'milestone_log',
    'power_score_log', 'app_mails', 'nudge_log', 'event_log',
    'feedback_submissions'
  ] LOOP
    p := t || '_select_own';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = p
    ) THEN
      EXECUTE format(
        'CREATE POLICY "%s" ON %I FOR SELECT USING (auth.uid() = user_id)',
        p, t
      );
    END IF;

    p := t || '_insert_own';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = p
    ) THEN
      EXECUTE format(
        'CREATE POLICY "%s" ON %I FOR INSERT WITH CHECK (auth.uid() = user_id)',
        p, t
      );
    END IF;

    p := t || '_update_own';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = p
    ) THEN
      EXECUTE format(
        'CREATE POLICY "%s" ON %I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
        p, t
      );
    END IF;

    p := t || '_delete_own';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = p
    ) THEN
      EXECUTE format(
        'CREATE POLICY "%s" ON %I FOR DELETE USING (auth.uid() = user_id)',
        p, t
      );
    END IF;
  END LOOP;
END $$;

-- =====================================================================================
-- SECTION 14 — LEADERBOARD VIEW
-- =====================================================================================

CREATE OR REPLACE VIEW leaderboard_view AS
SELECT
  u.id,
  u.username,
  u.character_stage,
  u.pet_stage,
  u.current_streak,
  u.power_score,
  u.total_xp,
  u.leaderboard_unlocked
FROM users u
WHERE u.leaderboard_unlocked = TRUE
  AND u.onboarding_complete = TRUE
ORDER BY u.power_score DESC;

