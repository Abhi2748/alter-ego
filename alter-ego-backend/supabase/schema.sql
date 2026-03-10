-- ALTER EGO — Full Supabase schema (12 tables) + RLS
-- Phase 2 Backend. Run in Supabase SQL Editor.
--
-- Before you run:
-- 1. In Supabase Dashboard: Project → SQL Editor → New query.
-- 2. If this is a fresh project, paste and run the whole file.
-- 3. If you already have older tables: either use a new project, or drop existing
--    tables in reverse dependency order (e.g. milestone_log, interest_progress,
--    nudge_log, weekly_reports, leaderboard_scores, streak_log, twin_chat, twin_state,
--    pet_state, character_state, missions, users) then run this file.

-- =============================================================================
-- 1. USERS
-- id matches auth.users.id. discipline_dna holds Twin/nudge params (Section 8.1).
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  created_at timestamptz DEFAULT now(),
  archetype text,
  discipline_dna jsonb,
  available_hours_per_day numeric,
  interests text[],
  quit_targets text[],
  gender text,
  trial_start_date timestamptz,
  subscription_status text DEFAULT 'trial',
  rating_prompted_at timestamptz,
  push_token text,
  nudge_frequency text DEFAULT 'medium' CHECK (nudge_frequency IN ('low','medium','high')),
  last_opened_at timestamptz,
  timezone text DEFAULT 'UTC'
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_insert_own" ON users;
CREATE POLICY "users_select_own" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- =============================================================================
-- 2. MISSIONS
-- pillar = core pillar (sleep/movement/etc); interest = interest name; mission_streak = consecutive days completed.
-- =============================================================================
CREATE TABLE IF NOT EXISTS missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('core','interest','personal','recovery')),
  pillar text,
  interest text,
  title text NOT NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('Easy','Medium','Hard')),
  xp_value int NOT NULL,
  pet_food_value int NOT NULL,
  mission_streak int DEFAULT 0,
  completed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "missions_all_own" ON missions;
CREATE POLICY "missions_all_own" ON missions FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS missions_user_created ON missions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS missions_user_expires ON missions(user_id, expires_at) WHERE expires_at IS NOT NULL;

-- =============================================================================
-- 3. CHARACTER_STATE
-- One row per user. stage 1–6, total_xp.
-- =============================================================================
CREATE TABLE IF NOT EXISTS character_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  stage int DEFAULT 1,
  total_xp int DEFAULT 0,
  gender text,
  last_updated timestamptz DEFAULT now()
);

ALTER TABLE character_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "character_state_all_own" ON character_state;
CREATE POLICY "character_state_all_own" ON character_state FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- 4. PET_STATE
-- One row per user. stage 0 = no pet (Days 1–6). total_pet_food, pet_health_state.
-- =============================================================================
CREATE TABLE IF NOT EXISTS pet_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  stage int DEFAULT 0,
  pet_health_state text DEFAULT 'healthy',
  total_pet_food int DEFAULT 0,
  consistency_days int DEFAULT 0,
  last_updated timestamptz DEFAULT now()
);

ALTER TABLE pet_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pet_state_all_own" ON pet_state;
CREATE POLICY "pet_state_all_own" ON pet_state FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- 5. TWIN_STATE (Section 8.2)
-- Twin simulation state: xp, character/pet stage, gap_state, strip_message, etc.
-- =============================================================================
CREATE TABLE IF NOT EXISTS twin_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  twin_xp int DEFAULT 0,
  twin_pet_food int DEFAULT 0,
  twin_character_stage int DEFAULT 1,
  twin_pet_stage int DEFAULT 0,
  streak int DEFAULT 0,
  current_gap_state text CHECK (current_gap_state IN ('user_ahead','neck_and_neck','slightly_behind','significantly_behind')),
  consistency_ceiling float DEFAULT 1.0,
  strip_message text,
  last_passed_at timestamptz,
  last_updated timestamptz DEFAULT now()
);

ALTER TABLE twin_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "twin_state_all_own" ON twin_state;
CREATE POLICY "twin_state_all_own" ON twin_state FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- 6. TWIN_CHAT
-- Conversation history for Twin Chat (and Nudge engagement signal).
-- =============================================================================
CREATE TABLE IF NOT EXISTS twin_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','twin')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE twin_chat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "twin_chat_all_own" ON twin_chat;
CREATE POLICY "twin_chat_all_own" ON twin_chat FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS twin_chat_user_created ON twin_chat(user_id, created_at DESC);

-- =============================================================================
-- 7. STREAK_LOG
-- One row per user per day. core_completed 0–5 (streak day = all 5 Core). completion_level 0–4.
-- =============================================================================
CREATE TABLE IF NOT EXISTS streak_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  core_completed int DEFAULT 0,
  completion_level int NOT NULL CHECK (completion_level BETWEEN 0 AND 4),
  xp_earned int DEFAULT 0,
  pet_food_earned int DEFAULT 0,
  UNIQUE(user_id, date)
);

ALTER TABLE streak_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "streak_log_all_own" ON streak_log;
CREATE POLICY "streak_log_all_own" ON streak_log FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS streak_log_user_date ON streak_log(user_id, date DESC);

-- =============================================================================
-- 7b. JOURNAL_ENTRIES
-- Standalone daily journal (no Core mission). FAB from Home → JournalEditorScreen.
-- =============================================================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  content text NOT NULL,
  word_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "journal_entries_all_own" ON journal_entries;
CREATE POLICY "journal_entries_all_own" ON journal_entries FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS journal_entries_user_date ON journal_entries(user_id, date DESC);

-- =============================================================================
-- 8. LEADERBOARD_SCORES
-- One row per user. Power Score formula uses this + streak/character/pet.
-- =============================================================================
CREATE TABLE IF NOT EXISTS leaderboard_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  power_score numeric NOT NULL,
  streak int NOT NULL DEFAULT 0,
  pet_stage int NOT NULL DEFAULT 0,
  character_stage int NOT NULL DEFAULT 1,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE leaderboard_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leaderboard_scores_select_all" ON leaderboard_scores;
DROP POLICY IF EXISTS "leaderboard_scores_update_own" ON leaderboard_scores;
DROP POLICY IF EXISTS "leaderboard_scores_insert_own" ON leaderboard_scores;
CREATE POLICY "leaderboard_scores_select_all" ON leaderboard_scores FOR SELECT USING (true);
CREATE POLICY "leaderboard_scores_update_own" ON leaderboard_scores FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "leaderboard_scores_insert_own" ON leaderboard_scores FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 9. WEEKLY_REPORTS
-- Sunday 3am server time. wins/slipped/twin_paragraph/next_week etc.
-- =============================================================================
CREATE TABLE IF NOT EXISTS weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  this_week_data jsonb,
  wins jsonb,
  slipped jsonb,
  keep_watching text,
  twin_paragraph text,
  twin_closing text,
  next_week text,
  power_score_delta int,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_reports_all_own" ON weekly_reports;
CREATE POLICY "weekly_reports_all_own" ON weekly_reports FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS weekly_reports_user_week ON weekly_reports(user_id, week_start DESC);

-- =============================================================================
-- 10. NUDGE_LOG
-- Each sent nudge. opened_at = when user opened the app from that nudge (null if not).
-- =============================================================================
CREATE TABLE IF NOT EXISTS nudge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text,
  content text,
  sent_at timestamptz DEFAULT now(),
  tone_used text,
  opened_at timestamptz
);

ALTER TABLE nudge_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nudge_log_all_own" ON nudge_log;
CREATE POLICY "nudge_log_all_own" ON nudge_log FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS nudge_log_user_sent ON nudge_log(user_id, sent_at DESC);

-- =============================================================================
-- 11. INTEREST_PROGRESS
-- Per-interest level and XP (L1–L10).
-- =============================================================================
CREATE TABLE IF NOT EXISTS interest_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interest text NOT NULL,
  level int DEFAULT 1,
  total_xp int DEFAULT 0,
  session_count int DEFAULT 0,
  last_session_at timestamptz,
  current_tier int DEFAULT 1 CHECK (current_tier BETWEEN 1 AND 4),
  pending_upgrade boolean DEFAULT false,
  skip_flag boolean DEFAULT false,
  UNIQUE(user_id, interest)
);

ALTER TABLE interest_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "interest_progress_all_own" ON interest_progress;
CREATE POLICY "interest_progress_all_own" ON interest_progress FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- 12. MILESTONE_LOG
-- Interest milestones (e.g. "7 Days of Fitness") for cards and badges.
-- =============================================================================
CREATE TABLE IF NOT EXISTS milestone_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interest text NOT NULL,
  milestone_name text NOT NULL,
  earned_at timestamptz DEFAULT now(),
  badge_icon text
);

ALTER TABLE milestone_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "milestone_log_all_own" ON milestone_log;
CREATE POLICY "milestone_log_all_own" ON milestone_log FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS milestone_log_user_earned ON milestone_log(user_id, earned_at DESC);

-- Optional: for existing DBs created before twin_pet_food was added, run:
-- ALTER TABLE twin_state ADD COLUMN IF NOT EXISTS twin_pet_food int DEFAULT 0;
-- Optional: for interest_progress difficulty adaptation (§7.1), run:
-- ALTER TABLE interest_progress ADD COLUMN IF NOT EXISTS current_tier int DEFAULT 1;
-- ALTER TABLE interest_progress ADD COLUMN IF NOT EXISTS pending_upgrade boolean DEFAULT false;
-- ALTER TABLE interest_progress ADD COLUMN IF NOT EXISTS skip_flag boolean DEFAULT false;
-- Optional: for Nudge Agent (§2, §3), run:
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS last_opened_at timestamptz;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC';
-- Optional: for Weekly Report Section 1 data, run:
-- ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS this_week_data jsonb;
-- Journal + milestones: journal_entries and milestone_log are in this file; no extra migration needed.

-- =============================================================================
-- PET UNLOCK (Day 7) — §2.1, §3.2 H2
-- When consecutive qualifying days (core_completed >= 5) reaches 7 and pet is locked: unlock Cub.
-- Run after pet_state and streak_log exist:
-- ALTER TABLE pet_state ADD COLUMN IF NOT EXISTS unlocked_at timestamptz;
-- Then run the function and trigger below.
-- =============================================================================
ALTER TABLE pet_state ADD COLUMN IF NOT EXISTS unlocked_at timestamptz;

CREATE OR REPLACE FUNCTION streak_log_consecutive_qualifying_days(p_uid uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  streak int := 0;
  prev_date date := NULL;
BEGIN
  FOR r IN
    SELECT date, core_completed
    FROM streak_log
    WHERE user_id = p_uid
    ORDER BY date DESC
  LOOP
    IF (r.core_completed IS NULL OR r.core_completed < 5) THEN
      EXIT;
    END IF;
    IF prev_date IS NULL THEN
      prev_date := r.date;
      streak := 1;
    ELSIF prev_date - r.date = 1 THEN
      streak := streak + 1;
      prev_date := r.date;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  RETURN streak;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_pet_unlock_on_streak_7()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  consecutive int;
  pet_stage int;
BEGIN
  consecutive := streak_log_consecutive_qualifying_days(NEW.user_id);
  IF consecutive < 7 THEN
    RETURN NEW;
  END IF;
  SELECT stage INTO pet_stage FROM pet_state WHERE user_id = NEW.user_id;
  IF pet_stage IS NULL OR pet_stage <> 0 THEN
    RETURN NEW;
  END IF;
  UPDATE pet_state
  SET stage = 1, unlocked_at = now(), last_updated = now()
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pet_unlock_on_streak_7 ON streak_log;
CREATE TRIGGER pet_unlock_on_streak_7
  AFTER INSERT OR UPDATE OF core_completed
  ON streak_log
  FOR EACH ROW
  EXECUTE PROCEDURE trigger_pet_unlock_on_streak_7();
