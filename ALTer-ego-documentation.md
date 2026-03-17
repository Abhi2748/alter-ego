# ALTER EGO — Documentation (Build Log)

This file is a running log of what we change in the codebase as we build ALTER EGO (mobile + backend), step by step.

---

## 2026-03-17 — B1: Initial database schema migration

### Goal
Create the complete PostgreSQL schema from scratch for Supabase/Postgres: enums, tables, indexes, triggers, Row Level Security (RLS), and per-table policies so each user can only access their own rows.

### What we did
- **Created an idempotent SQL migration** that can be re-run safely.
- **Added all enum types** required by the app/backend contract (archetype, tone, gap state, mission types/difficulty, subscription tiers, etc.).
- **Created all core tables** for users, onboarding, interests, quit targets, missions, journal, XP/PF logs, streak log, Twin system tables, summaries/reports, milestones/power score, in-app mail, nudges/events, and feedback submissions.
- **Added `updated_at` trigger support**:
  - `update_updated_at()` trigger function.
  - Per-table triggers created with existence checks so re-running the migration does not error.
- **Enabled RLS** on every table and **created policies**:
  - `users`: select/update own row (by `auth.uid() = id`)
  - All other tables: select/insert/update/delete only own rows (by `auth.uid() = user_id`)
  - Policies are created inside guarded `DO $$ ... $$` blocks so the migration can be re-run.
- **Created `leaderboard_view`** for fast leaderboard reads.

### Files created/changed
- **Created** `alter-ego-backend/migrations/001_initial_schema.sql`
- **Created** `ALTer-ego-documentation.md` (this file)

### Notes / Decisions
- The migration includes `CREATE EXTENSION IF NOT EXISTS pgcrypto;` so `gen_random_uuid()` works.
- `CREATE POLICY IF NOT EXISTS` is not supported in Postgres, so policies are created with guarded checks against `pg_policies`.

### Follow-up change
- Replaced the enum creation block in `alter-ego-backend/migrations/001_initial_schema.sql` to use `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` for each enum (a safe re-run pattern compatible across Postgres versions/environments where `CREATE TYPE IF NOT EXISTS` may not be available/desired).

---

## 2026-03-17 — B2: Authentication (Google OAuth + Anonymous)

### Goal
Support:
- **Anonymous sign-in** (“Sign in later”) with a persistent Supabase session.
- **Google OAuth sign-in**.
- **Link Google** to an existing anonymous user later **without losing data** (same `user_id`).

### What we did
- **Backend**:
  - Added a backend Supabase client module with both:
    - `supabase_admin` (service role, bypasses RLS)
    - `supabase` (anon, respects RLS)
  - Added auth endpoints:
    - `POST /api/v1/auth/verify-token`
    - `POST /api/v1/auth/link-google`
    - `GET /api/v1/auth/me`
  - Wired the new auth router into `alter-ego-backend/main.py`.
- **Mobile**:
  - Added a Supabase client configured for React Native with **SecureStore-backed session persistence** (AsyncStorage fallback).
  - Added an auth service with:
    - `signInAnonymously`, `signInWithGoogle`, `linkGoogleAccount`, `signOut`,
      `getCurrentSession`, `getAuthToken`, `isAnonymousUser`, `onAuthStateChange`
  - Updated `app.json` deep link scheme to **`alter-ego`** so OAuth can redirect back into the app.

### Files created/changed
- **Created** `alter-ego-backend/app/core/supabase_client.py`
- **Created** `alter-ego-backend/app/api/auth.py`
- **Changed** `alter-ego-backend/main.py`
- **Created** `alter-ego-mobile/src/lib/supabase.ts`
- **Created** `alter-ego-mobile/src/services/auth.ts`
- **Changed** `alter-ego-mobile/app.json` (scheme)

### Notes / Decisions
- The service role key is **backend-only** (never goes into the app).
- Mobile uses anon key + device storage adapter so the session survives app restarts.
- Linking Google uses Supabase identity linking so the user keeps the same underlying account and data.

---

## 2026-03-17 — B3: Backend central constants

### Goal
Create a single source of truth for **all locked product constants** so backend modules never hardcode progression thresholds, caps, mission values, streak requirements, Twin parameters, or Power Score weights.

### What we did
- **Created** `alter-ego-backend/app/core/constants.py` exactly as specified.
- This file centralizes character/pet progression thresholds, daily caps, mission XP/PF values, streak tiers, archetype definitions, core missions, Twin system parameters, Power Score weights, multi-day mission rules, and nudge/report scheduling constants.

### Files created/changed
- **Created** `alter-ego-backend/app/core/constants.py`

### Follow-up change
- Updated progression thresholds in `alter-ego-backend/app/core/constants.py`:
  - `XP_THRESHOLDS` → `[0, 800, 9_800, 36_800, 108_800, 375_200]`
  - `PF_THRESHOLDS` → `[0, 400, 2_800, 10_000, 26_800, 62_000, 113_200, 242_800]`

---

## 2026-03-17 — B4: Archetype classification (deterministic)

### Goal
Create a deterministic (non-LLM) archetype classifier from onboarding answers **Q4–Q10** that returns one of:
`restless_creator`, `reluctant_achiever`, `structured_climber`, `lone_wolf`, `social_performer`.

### What we did
- **Created** `alter-ego-backend/app/core/archetype.py` with:
  - `classify_archetype(answers)` weighted scoring + graceful handling of unknown values
  - Tie-break priority: `structured_climber > lone_wolf > restless_creator > reluctant_achiever > social_performer`
  - `get_archetype_data()` and `get_initial_dna()` pulling definitions from `app.core.constants`
- Included the specified `__main__` tests and verified they pass when run directly.

### Files created/changed
- **Created** `alter-ego-backend/app/core/archetype.py`

---

## 2026-03-17 — B5: Interest + quit-target normalisation (GPT-4o-mini)

### Goal
Turn free-text onboarding inputs into structured domain knowledge that the Planner Agent can use to generate research-backed missions:
- Interests (e.g. “guitar”, “Muay Thai”, “cooking Indian food”)
- Quit targets (habit patterns to reduce/quit)

### What we did
- **Created** `alter-ego-backend/app/agents/interest_normaliser.py`:
  - `normalise_interest(raw_text, level_text, user_goal=None)` using `gpt-4o-mini` via `langchain-openai`
  - `normalise_quit_target(raw_text, description=None, trigger=None)` using the quit-target prompt
  - Robust JSON parsing + **safe fallbacks** (never breaks onboarding if OpenAI fails or returns invalid JSON)
  - Adds `needs_review: True` when confidence < 0.70
  - Logs only **raw text + confidence** (not the full model output) to keep logs clean
- Imports from `app.core.constants` (interest level mapping + phases) to avoid hardcoding shared domain primitives.

### Files created/changed
- **Created** `alter-ego-backend/app/agents/interest_normaliser.py`

### Follow-up fix
- Reverted the temporary “safe import / lazy init” changes so `interest_normaliser.py` matches the intended runtime assumptions:
  - `python-dotenv` + `langchain-openai` are required
  - `OPENAI_API_KEY` must be set in the environment
  - LLM is initialised at import time (fail-fast if misconfigured)

---

## 2026-03-17 — B6 + B7: Onboarding API (progressive save + username checks)

### Goal
- **B6**: Save each onboarding question immediately so partial progress is never lost.
- **B7**: Provide a fast username availability endpoint for realtime debounce checks.

### What we did
- **Created** service layer `alter-ego-backend/app/services/onboarding_service.py`:
  - `generate_random_username()` + async uniqueness wrapper
  - `validate_username()` enforcing format + reserved list
  - `save_onboarding_step()` upserts `onboarding_answers` and updates derived `users` fields for specific questions
  - `get_onboarding_progress()` returns saved answers + `users.onboarding_complete`
  - `check_username_availability()` returns `{available, reason, suggestion}`
  - `create_profile_if_missing()` idempotently creates the initial `users` + `discipline_dna` rows
- **Created** router `alter-ego-backend/app/api/onboarding.py`:
  - `POST /api/v1/onboarding/step`
  - `GET /api/v1/onboarding/progress`
  - `GET /api/v1/users/check-username`
  - `POST /api/v1/users/create-profile`
  - Auth uses `get_user_id_from_token` from `app/api/auth.py`.
- **Wired** the new router into `alter-ego-backend/main.py` and stopped mounting the legacy `routes/onboarding.py` router so the API matches B6/B7.

### Files created/changed
- **Created** `alter-ego-backend/app/api/onboarding.py`
- **Created** `alter-ego-backend/app/services/onboarding_service.py`
- **Changed** `alter-ego-backend/main.py`

### Follow-up fix
- Fixed a pre-existing backend startup blocker in `alter-ego-backend/agents/planner_agent.py`:
  - Corrected the `generate_interest_mission(...)` function signature ordering (Python disallows non-default args after default args).

---

## 2026-03-17 — Backend cleanup (prune legacy code)

### Goal
Remove legacy backend modules so only the files created in this build remain, simplifying the codebase and preventing old route/agent imports from interfering with new work.

### What we did
- Deleted **all** Python files and folders under `alter-ego-backend/` that were not on the keep-list.
- Reset `alter-ego-backend/main.py` to a minimal FastAPI app that only mounts:
  - `app/api/auth.py`
  - `app/api/onboarding.py`
- Removed leftover Python cache + unused backend folders.

### Files kept (allowlist)
- `venv/` (untouched)
- `requirements.txt`, `.env`, `main.py`
- `app/core/supabase_client.py`
- `app/core/constants.py`
- `app/core/archetype.py`
- `app/agents/interest_normaliser.py`
- `app/api/auth.py`
- `app/api/onboarding.py`
- `app/services/onboarding_service.py`
- `migrations/001_initial_schema.sql`

---

## 2026-03-17 — B8: Onboarding complete endpoint

### Goal
Finalize onboarding with a single endpoint that:
- Reads all saved answers
- Classifies archetype (Q4–Q10)
- Normalises interests + quit targets (GPT-4o-mini)
- Writes `users.archetype`, marks onboarding complete, sets initial `discipline_dna`
- Creates `twin_state` (idempotent)
- Returns archetype reveal payload to the mobile app

### What we did
- Added `POST /api/v1/onboarding/complete` in `alter-ego-backend/app/api/onboarding.py`.
- Implemented `complete_onboarding(user_id)` in `alter-ego-backend/app/services/onboarding_service.py` with:
  - Interest inserts into `interests` table (uses `INTEREST_LEVEL_MAP` for starting tier/phase)
  - Quit target inserts into `quit_targets` table
  - `discipline_dna` update via `get_initial_dna(archetype_key)`
  - `twin_state` creation with `TWIN_INITIAL_CONSISTENCY`
  - Defensive error handling: never returns 500; includes `notes` array when partial steps fail

---

## 2026-03-17 — B9: Core mission generation + missions API

### Goal
Generate the **6 fixed Core missions** from `CORE_MISSIONS` (no LLM) each day per user and serve today/date mission lists to the mobile app.

### What we did
- **Created** `alter-ego-backend/app/services/mission_service.py`:
  - `generate_core_missions_for_user(user_id, mission_date)` (idempotent: returns existing 6 if already created)
  - `get_today_missions(user_id, mission_date)` (returns missions ordered by type)
  - `get_user_date(timezone)` + `get_days_since_registration(registration_date, timezone)`
- **Created** `alter-ego-backend/app/api/missions.py`:
  - `GET /api/v1/missions/today` (ensures core missions exist, then returns grouped missions + summary)
  - `GET /api/v1/missions/date/{date}` (returns missions if present, otherwise empty groups)
- **Updated** `alter-ego-backend/main.py` to mount the missions router.

---

## 2026-03-17 — B10: Interest Mission Planner Agent (GPT-4o-mini)

### Goal
Generate daily **interest missions** grounded in the stored interest domain knowledge (evidence base + level context) from B5, with adaptive difficulty and non-repetition rules.

### What we did
- **Created** `alter-ego-backend/app/agents/planner_agent.py`:
  - `INTEREST_PLANNER_SYSTEM_PROMPT` (exact prompt provided)
  - `generate_interest_mission(...)`:
    - Active-day scheduling via `interest.active_days`
    - Idempotent check to avoid duplicates for the same interest/date
    - Pulls last 5 completed missions + last 5 ratings/feedback
    - Computes available minutes from `daily_hours_floor` + `INTEREST_LEVEL_MAP`
    - Calls `gpt-4o-mini` and stores mission details in `missions` table
    - Falls back to a simple presence mission if the LLM fails
  - `generate_all_interest_missions(user_id, mission_date)` for all active interests
- **Updated** `alter-ego-backend/app/api/missions.py`:
  - Added `POST /api/v1/missions/generate-interest` to manually generate today’s interest missions (cron fallback).

---

## 2026-03-17 — B11: Quit Target Mission Agent (Resistance missions)

### Goal
Generate daily **resistance missions** for quit targets that always prescribe a **positive replacement action** addressing the underlying need (never “avoid/stop/resist” in the title).

### What we did
- **Updated** `alter-ego-backend/app/agents/planner_agent.py`:
  - Added `QUIT_PLANNER_SYSTEM_PROMPT` (exact prompt provided)
  - Added `generate_quit_target_mission(...)` (idempotent per quit_target/date; stores `type='resistance'`)
  - Added `generate_all_quit_target_missions(user_id, mission_date)` for all active, non-conquered quit targets
- **Updated** `alter-ego-backend/app/services/mission_service.py`:
  - Added `get_today_missions_by_type(user_id, mission_date, mission_type)` helper
- **Updated** `alter-ego-backend/app/api/missions.py`:
  - Added `POST /api/v1/missions/generate-resistance`
  - Updated `GET /api/v1/missions/today` to ensure **interest + resistance** missions exist for today (cron fallback) before returning the full mission list.

---

## 2026-03-17 — B12: Mission completion, rating, and journal save

### Goal
- Complete missions instantly (XP/PF rewards + daily caps + progression checks) for immediate UI animation.
- Store mission ratings/feedback for future Planner improvements.
- Save journal entries and auto-complete the journal mission at 50+ words.

### What we did
- **Created** `alter-ego-backend/app/services/progression_service.py`:
  - `check_character_stage_progression(...)` (updates `users.character_stage`, logs `milestone_log`)
  - `check_pet_stage_progression(...)` (updates `users.pet_stage`, logs `milestone_log`)
- **Updated** `alter-ego-backend/app/services/mission_service.py`:
  - Added `complete_mission(user_id, mission_id)`:
    - Validates mission ownership + today-only completion
    - Marks mission complete
    - Enforces daily caps via `DAILY_XP_CAPS` / `DAILY_PF_CAPS` using `xp_log` / `pf_log` sums
    - Writes `xp_log` + `pf_log`, updates `users.total_xp` + `users.total_pf`
    - Runs progression checks (stage/pet evolution)
    - Returns a fast completion payload (streak is stubbed for B19)
- **Updated** `alter-ego-backend/app/api/missions.py`:
  - `POST /api/v1/missions/{mission_id}/complete`
  - `POST /api/v1/missions/{mission_id}/rate`
  - `POST /api/v1/missions/journal/save` (journal entry upsert + auto-complete journal mission at `JOURNAL_MIN_WORDS`)

---

## 2026-03-17 — B13: Daily reset cron + personal missions

### Goal
- Run a timezone-aware **daily mission reset** (midnight per user timezone) to generate the new day’s missions.
- Let users create **personal missions** with GPT-estimated effort tier (XP/PF) before saving.

### What we did
- **Created** `alter-ego-backend/app/core/scheduler.py`:
  - APScheduler `AsyncIOScheduler` setup
  - Implemented `daily_mission_reset_job()` (runs hourly; generates core + interest + resistance missions for users whose local time is 00:00–00:59)
  - Registered placeholder jobs for later B steps (log “not yet implemented”)
- **Created** `alter-ego-backend/app/agents/personal_mission_agent.py`:
  - `estimate_personal_mission_tier(mission_text)` using `gpt-4o-mini` with JSON parsing + safe fallback
- **Updated** `alter-ego-backend/app/api/missions.py`:
  - `POST /api/v1/missions/personal/estimate`
  - `POST /api/v1/missions/personal/create` (max 2/day; inserts `type='personal'`)
  - `DELETE /api/v1/missions/personal/{mission_id}` (only if not completed)
- **Updated** `alter-ego-backend/main.py`:
  - Starts scheduler on startup and shuts it down on app shutdown

---

## 2026-03-17 — B18–B20: Pet unlock cron + streak tiers + streak animations

### Goal
- **B18**: Daily cron to unlock pet on Day 6 after registration.
- **B19**: Real streak calculation using progressive tier requirements (tier_1 → tier_4).
- **B20**: Streak animation trigger tier mapping (standard/day30/day60/day100/day200/day365).

### What we did
- **Created** `alter-ego-backend/app/services/streak_service.py`:
  - `evaluate_streak_requirement(...)` (journal excluded)
  - `check_streak_tier_upgrade(...)`
  - `process_streak(user_id)` (updates users streak fields, upserts `streak_log`, logs milestones, unlocks leaderboard at first threshold)
  - `get_animation_tier(streak)`
  - `handle_streak_break(user_id)` (pet sad + xp freeze/penalty rules)
- **Updated** `alter-ego-backend/app/services/mission_service.py`:
  - `complete_mission(...)` now calls `process_streak(user_id)` and returns `streak_animation`, tier/milestone fields, and leaderboard unlock flag
- **Updated** `alter-ego-backend/app/core/scheduler.py`:
  - Replaced the `pet_unlock_check` stub with `pet_unlock_check_job()`:
    - Unlocks pet on `PET_UNLOCK_DAY`
    - Calls `handle_streak_break()` when needed


