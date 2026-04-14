# ALTER EGO — Documentation (Build Log)

This file is a running log of what we change in the codebase as we build ALTER EGO (mobile + backend), step by step.

---

## 2026-04-13 — Static season-driven core missions

### What changed
- **Core missions:** Five pillar rows per day come from **`SEASON_CORE_MISSION_SPECS`** + active **season/phase** (`get_season_core_spec` in `constants.py`, `generate_core_missions_for_user` in `mission_service`). Journal row still from **`CORE_MISSIONS`**.
- **Removed** `app/agents/core_mission_agent.py` (no LLM for daily core copy).
- **DB:** Migration **`053_missions_core_unique.sql`** — dedupe + partial **unique** on `(user_id, mission_date, core_pillar)` for `type='core'`.
- **Copy:** FAQ (`settings.py`), welcome mail (`mail_service.py`), and docs (`CLAUDE.md`, handoff) updated to match.

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
- **Created** `alter-ego-mobile/src/services/auth.ts`
- **Changed** `alter-ego-mobile/app.json` (scheme)
- **Note:** Supabase client was later consolidated into `src/utils/supabase.ts` (see entry below).

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
  - `POST /api/v1/missions/personal/create` (inserts `type='personal'`; no per-day cap)
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

---

## 2026-03-17 — B21: Twin daily simulation cron (archetype rhythm)

### Goal
Simulate the twin’s daily behaviour as a personality-driven rival (not a fixed pacemaker) using archetype-specific rhythms and gaussian variance, and run it nightly via cron.

### What we did
- **Created** `alter-ego-backend/app/services/twin_service.py`:
  - `ARCHETYPE_RHYTHMS` + `DEFAULT_RHYTHM`
  - `get_twin_daily_rate(...)` (blends stored base rate with archetype base + day-of-week + gaussian variance)
  - `recalibrate_twin_base_rate(...)` (for later B25 use)
  - `simulate_twin_day(user_id)`:
    - Reads user/twin state + today’s missions
    - Samples daily completion rate, completes a subset (core slightly boosted)
    - Caps XP/PF by twin’s own daily caps and updates `twin_state` + `twin_daily_record`
    - Updates gap state (`user_ahead` / `neck_and_neck` / `slightly_behind` / `significantly_behind`)
  - `get_home_strip_context(user_id)` for later Twin strip UI
- **Updated** `alter-ego-backend/app/core/scheduler.py`:
  - Replaced `twin_simulation` stub with `twin_simulation_job()` scheduled at **01:00 UTC** to call `simulate_twin_day` for all onboarded users.

---

## 2026-03-17 — B22: Twin Chat Agent + Twin API

### Goal
Give the user a **Shadow Twin** that speaks like a real rival — grounded in their exact data (gap, missions, streak, interests, quit targets), not generic motivation.

### What we did
- **Created** `alter-ego-backend/app/agents/twin_chat_agent.py`:
  - `TWIN_CHAT_SYSTEM_PROMPT` — full persona + absolute rules (exact spec)
  - `get_twin_response(user_id, user_message)`:
    - Loads user/twin/dna, today’s missions, interests, quit targets, and last 20 chat messages
    - Builds the filled system prompt and sends it to `gpt-4o-mini`
    - Stores both user + twin messages in `twin_messages`
- **Created** `alter-ego-backend/app/api/twin.py`:
  - `POST /api/v1/twin/chat` — sends a message and returns the twin’s reply
  - `GET /api/v1/twin/chat/history` — returns last N messages
  - `GET /api/v1/twin/strip` — uses `get_home_strip_context` for the home Twin strip
  - `GET /api/v1/twin/state` — returns full twin vs user comparison data
- **Updated** `alter-ego-backend/main.py`:
  - Mounted the new `twin` router.

---

## 2026-03-17 — B25: Power Score calculation + nightly cron

### Goal
Compute a single **Power Score** (0–1000) per user that drives leaderboard ranking, combining:
- 35% XP stage progress
- 20% pet stage
- 25% current streak (capped)
- 20% 30-day completion rate.

### What we did
- **Created** `alter-ego-backend/app/services/power_score_service.py`:
  - `calculate_power_score(user_id)`:
    - Reads `users.total_xp`, `character_stage`, `pet_stage`, `pet_unlocked`, `current_streak`
    - Computes XP-stage progress, pet-stage normalised value, streak (capped at `POWER_SCORE_STREAK_CAP`), and 30-day completion rate from `streak_log`
    - Combines components using `POWER_SCORE_WEIGHTS` and clamps to `POWER_SCORE_MAX`
    - Updates `users.power_score` and inserts a row into `power_score_log`
  - `calculate_all_power_scores()` iterates over all onboarded users and recalculates their scores.
- **Updated** `alter-ego-backend/app/core/scheduler.py`:
  - Added `power_score_job()` scheduled at **01:30 UTC**, after the twin simulation job, which calls `calculate_all_power_scores()` nightly.

---

## 2026-03-17 — B26: Leaderboard API (Power Score–driven)

### Goal
Expose a Power Score–based leaderboard that unlocks after the first 3-day streak (or always for `beta_free` users) and returns both the global top 100 and the current user’s rank.

### What we did
- **Created** `alter-ego-backend/app/api/leaderboard.py`:
  - `GET /api/v1/leaderboard`:
    - Requires `leaderboard_unlocked = true` or `subscription_tier = 'beta_free'`
    - Returns top 100 users by `power_score` (with stage names and pet names) plus the current user’s rank even if outside the top 100
  - `GET /api/v1/leaderboard/rank`:
    - Lightweight endpoint returning only the current user’s rank, Power Score, and unlock flag for home-screen display.
- **Updated** `alter-ego-backend/main.py`:
  - Registered the new `leaderboard` router alongside existing routers.

---

## 2026-03-17 — B27: Subscription gate (beta bypass)

### Goal
Introduce a central subscription/feature gate that can be used post‑beta to restrict premium features while keeping **all features unlocked for beta users**.

### What we did
- **Created** `alter-ego-backend/app/core/subscription.py`:
  - `check_feature_access(user_id, feature)`:
    - Reads `users.subscription_tier`, `trial_start_date`, and `registration_date`
    - Returns `{allowed, reason: "beta"|"trial"|"subscriber"|"trial_expired", days_remaining}`
    - Beta users (`subscription_tier = "beta_free"`) always allowed
    - Premium/pro users always allowed
    - Free users allowed during `FREE_TRIAL_DAYS` window based on `trial_start_date` (fallback to `registration_date`)
  - `is_beta_user(subscription_tier)` helper for quick checks.
- No gates are yet enforced on routes (per spec); this is pure infrastructure for post‑beta.

---

## 2026-03-17 — B28: Twin home strip message system (rule‑based)

### Goal
Replace ad‑hoc or LLM‑generated home strip lines with a **rule‑based, zero‑LLM message system** driven by `gap_state × tone_type` and optional event tags, updated on a cadence controlled by `twin_message_frequency`.

### What we did
- **Created** `alter-ego-backend/app/services/strip_message_service.py`:
  - Defined `STRIP_MESSAGES[gap_state][tone_type]` banks and `EVENT_MESSAGES[event][tone_type]` overrides (all pre‑written copy).
  - `get_strip_message(gap_state, tone_type, event, username)`:
    - Picks the correct bank, falls back to `"neck_and_neck"` / `"rival"` if missing.
    - Injects `{username}` placeholder when present.
  - `update_strip_message(user_id, event=None)`:
    - Loads `twin_state.current_gap_state`, `strip_message`, `last_strip_updated`
    - Loads `discipline_dna.twin_tone_type` + `twin_message_frequency`
    - Respects cadence:
      - `high`: at most once per day
      - `medium`: every 2–3 days
      - `low`: weekly (unless an explicit `event` is passed, which always updates)
    - Avoids repeating the same message twice in a row where possible
    - Persists `strip_message` and `last_strip_updated` on `twin_state`.
- **Updated** `alter-ego-backend/app/core/scheduler.py`:
  - `twin_simulation_job()` now calls `update_strip_message(user["id"])` after each `simulate_twin_day(...)` to rotate the strip line nightly.
- **Updated** `alter-ego-backend/app/api/twin.py`:
  - `GET /api/v1/twin/strip`:
    - Still returns the home strip context from `get_home_strip_context(user_id)`
    - If `strip_message` is missing, calls `update_strip_message(user_id)` once and injects the generated line into the response.

---

## 2026-03-17 — B29: Weekly report agent

### Goal
Generate a **personal weekly discipline report** every Sunday at 03:00 UTC using GPT-4o-mini. The report is the only moment in the app that steps back and looks at the whole week — factual, no guilt, with anti-repetition across weeks.

### What we did
- **Created** `alter-ego-backend/app/agents/report_agent.py`:
  - `WEEKLY_REPORT_SYSTEM_PROMPT`: full prompt with this week’s data, anti-repetition hints (prev wins/twin openings, theme), and strict rules for Sections 2–5 (Wins, Slipped/Keep Watching, Twin paragraph + closing, Next week). Output is JSON only.
  - `generate_weekly_report(user_id)`:
    - Computes last week (Mon–Sun) and loads user, discipline_dna, twin_state, streak_log, missions, xp_log, pf_log, mission_ratings, milestone_log, quit_targets, previous weekly_reports.
    - Derives metrics (days_active, missions_completed, core_complete_days, most_skipped, best/hardest day, interests_worked, streak_events, stage/pet evolved, gap direction, etc.).
    - Builds prompt, calls GPT-4o-mini, parses JSON (with fence stripping). On failure, stores a minimal fallback report.
    - Builds `this_week_data` (Section 1, no LLM) and upserts into `weekly_reports` (on_conflict=user_id,week_start) with wins, slipped, keep_watching, twin_paragraph, twin_closing, next_week, wins_opening, twin_opening, theme_used.
- **Created** `alter-ego-backend/app/api/reports.py`:
  - `GET /api/v1/reports/weekly`: returns the current week’s report (week_start = last Monday) or `available: false` with message.
  - `GET /api/v1/reports/weekly/previous`: returns the previous week’s report.
- **Updated** `alter-ego-backend/app/core/scheduler.py`:
  - Replaced the weekly_report stub with `weekly_report_job()` at **Sunday 03:00 UTC**, calling `generate_weekly_report(user_id)` for each onboarded user.
- **Updated** `alter-ego-backend/main.py`:
  - Registered `reports_router`.

---

## 2026-03-17 — B30: Day summary generation

### Goal
Generate a **1–2 sentence archive entry** per day for the Day Detail screen (streak heatmap tap). Runs nightly at 01:30 UTC for yesterday; also generated on demand when the user requests a day that has no summary yet.

### What we did
- **Created** (in same file) `alter-ego-backend/app/agents/report_agent.py`:
  - `DAY_SUMMARY_SYSTEM_PROMPT`: factual, second-person past tense, no motivational language; references missions completed, core done, streak, XP, notable events.
  - `generate_day_summary(user_id, target_date)`:
    - If a row exists in `daily_summaries` for user_id + target_date, returns stored `summary_text`.
    - Otherwise loads missions, streak_log, xp_log, milestone_log for that day; computes completed/total, core_done, streak_count, day_number (since registration); builds prompt and calls GPT-4o-mini; on failure uses a one-line fallback.
    - Upserts into `daily_summaries` (on_conflict=user_id,summary_date) and returns the summary text.
- **Updated** `alter-ego-backend/app/api/reports.py`:
  - `GET /api/v1/reports/day/{date_str}`: returns `{ date, summary }`; calls `generate_day_summary(user_id, date_str)` so missing summaries are generated on demand.
- **Updated** `alter-ego-backend/app/core/scheduler.py`:
  - Replaced the day_summary stub with `day_summary_job()` at **01:30 UTC** daily; computes yesterday’s date and calls `generate_day_summary(user_id, yesterday)` for each onboarded user.
  - **Power Score job** moved from 01:30 to **01:45 UTC** to avoid overlap with day_summary.

---

## 2026-03-17 — B31: Nudge agent (three-category notifications)

### Goal
Implement a **three-category notification architecture**: Category A (re-engagement), Category B (quit target intervention at urge time), Category C (milestone — immediate, event-driven). Category C is pre-written; A and B use GPT-4o-mini with strict tone and anti-repetition rules.

### What we did
- **Created** `alter-ego-backend/migrations/002_add_intervention_hour.sql`:
  - Added `quit_targets.intervention_hour` (INTEGER 0–23, nullable) for Category B timing.
  - Added `nudge_log.nudge_category` (TEXT, 'A'|'B'|'C', nullable) for analytics.
- **Created** `alter-ego-backend/app/agents/nudge_agent.py`:
  - **Category C**: `MILESTONE_MESSAGES` dict (stage_2–6, pet_stage_2–8, pet_unlock, streak_3–365). `send_category_c_notification(user_id, milestone_type)` sends push and logs to nudge_log with category C. No LLM.
  - **Category A**: Gates (7am–10pm local, missions not all complete today, daily cap by frequency, ±2h of activity/archetype hour). Triggers: streak_warning, re_engagement, pet_nudge, milestone_approaching, momentum. `NUDGE_CATEGORY_A_PROMPT` + `_generate_category_a_nudge()`; last 3 nudges injected for anti-repetition.
  - **Category B**: Fires when `local_hour == quit_target.intervention_hour`. Gates: not after 11:30pm, today’s quit mission not done, no B already sent for that target today. `NUDGE_CATEGORY_B_PROMPT` + `_generate_category_b_nudge()` with phase rules (days_1_10 … days_90_plus).
  - `check_and_send_nudges()`: loads users with `onboarding_complete` and `notifications_enabled`, runs `check_category_a` and `check_category_b`; returns counts. Push via Expo push API (`exp.host/--/api/v2/push/send`).
- **Updated** `alter-ego-backend/app/services/mission_service.py`:
  - After `process_streak()` in `complete_mission()`, calls `send_category_c_notification` for `milestone_reached`, `stage_evolved`, and `pet_evolved` when applicable.
- **Updated** `alter-ego-backend/app/core/scheduler.py`:
  - Added `nudge_check_job()` every 60 minutes, calling `check_and_send_nudges()`.
- **Updated** `alter-ego-backend/app/agents/interest_normaliser.py` and **onboarding_service**:
  - Quit normalisation prompt and fallback now include `intervention_hour` (0–23 or null). Onboarding inserts `intervention_hour` into `quit_targets` from normalised output.

---

## 2026-03-17 — B32: In-app mail system

### Goal
Pre-written in-app mails triggered by events; stored in `app_mails` and displayed as inbox in Profile.

### What we did
- **Created** `alter-ego-backend/app/services/mail_service.py`:
  - `MAIL_CONTENT`: welcome, twin_guide, first_streak_tip, leaderboard_unlock, pet_unlock, day_7_checkin, streak_requirement_update, first_difficulty_upgrade, twin_recalibration_note, week_4_encouragement (subject + body markdown).
  - `send_app_mail(user_id, mail_type, template_data)` inserts into `app_mails`.
  - `send_welcome_mail_sequence(user_id)` sends welcome mail.
  - `check_and_send_scheduled_mails(user_id)` runs day-based logic: twin_guide (day 2+), week_4_encouragement (day 28+), each at most once. `twin_recalibration_note` is sent from `twin_recalibration_job` after each recalibration (day 7, 14, …). `day_7_checkin` template exists for optional use; not auto-sent (avoids duplicate with first recalibration mail).
- **Created** `alter-ego-backend/app/api/mail.py`:
  - `GET /api/v1/mail`: list mails for user, `unread_count`, `total`.
  - `POST /api/v1/mail/{mail_id}/read`: mark one read.
  - `POST /api/v1/mail/read-all`: mark all read.
- **Updated** `alter-ego-backend/app/services/onboarding_service.py`:
  - At end of `complete_onboarding()`, calls `send_welcome_mail_sequence(user_id)`.
- **Updated** `alter-ego-backend/app/core/scheduler.py`:
  - Added `mail_check_job()` daily at **00:30 UTC**, calling `check_and_send_scheduled_mails(user_id)` for each onboarded user.
- **Updated** `alter-ego-backend/main.py`:
  - Registered `mail_router`.

---

## 2026-03-17 — B33: Profile API (all tabs)

### Goal
Expose all profile tab data from a single module so the Profile screen can load overview, stats, streak, identity, companion, interests, and quits from the backend.

### What we did
- **Created** `alter-ego-backend/app/api/profile.py`:
  - `GET /api/v1/profile/overview` — main profile (username, archetype, character/pet stage, XP/PF progress, streak, power_score, registration_date, leaderboard_unlocked, email_connected, subscription_tier, unread_mail_count).
  - `GET /api/v1/profile/stats?days=30` — XP chart, completion rate, streak chart from `xp_log` and `streak_log`.
  - `GET /api/v1/profile/streak` — 52-week heatmap data, current/longest streak, streak_requirement_tier.
  - `GET /api/v1/profile/identity` — character stage list with milestones from `milestone_log` (stage_%).
  - `GET /api/v1/profile/companion` — pet stage list with milestones (pet_stage_%).
  - `GET /api/v1/profile/interests` — active interests with progress and milestone status (`INTEREST_MILESTONE_SESSIONS`).
  - `GET /api/v1/profile/quits` — quit targets with clean_days, phases (awareness/replacement/reflex/rewired/free), current_phase.
- All endpoints use `app.core.constants` (STAGE_NAMES, PET_NAMES, XP_THRESHOLDS, PF_THRESHOLDS, etc.) and `app.core.supabase_client`.
- **Updated** `alter-ego-backend/main.py`: registered `profile_router`.

### Files created/changed
- **Created** `alter-ego-backend/app/api/profile.py`
- **Changed** `alter-ego-backend/main.py`

---

## 2026-03-17 — B34: Settings + FAQ + contact form

### Goal
Serve FAQ, update username/notifications, accept feedback (with optional Zapier webhook), and allow account deletion.

### What we did
- **Created** `alter-ego-backend/app/api/settings.py`:
  - `GET /api/v1/settings/faq` — returns static FAQ list (no auth).
  - `POST /api/v1/settings/username` — validate + check availability via onboarding_service; update `users.username` (lowercased).
  - `POST /api/v1/settings/notifications` — update `push_token` and/or `notifications_enabled`.
  - `POST /api/v1/settings/feedback` — insert into `feedback_submissions` (type: bug|concern|suggestion|other); optional fire-and-forget POST to `ZAPIER_WEBHOOK_URL`.
  - `DELETE /api/v1/settings/account` — delete user row (cascades) then `supabase.auth.admin.delete_user`.
- **Updated** `alter-ego-backend/main.py`: registered `settings_router`.

### Files created/changed
- **Created** `alter-ego-backend/app/api/settings.py`
- **Changed** `alter-ego-backend/main.py`

---

## 2026-03-17 — B35: XP/PF level audit script

### Goal
Validate that stored user data and product constants stay in sync (no drift before beta).

### What we did
- **Created** `alter-ego-backend/app/services/audit_service.py`:
  - `run_audit()`: checks XP_THRESHOLDS/PF_THRESHOLDS ascending; STAGE_NAMES/PET_NAMES length; DAILY_XP_CAPS/DAILY_PF_CAPS for all stages; `MISSION_XP_BY_TYPE` (all tiers positive; interest matches resistance); fetches onboarded users and validates total_xp vs character_stage, total_pf vs pet_stage, stage bounds.
  - Returns `{ passed, issues[], warnings[], constants_validated }` and prints ✅/❌/⚠️.
- **Run:** from `alter-ego-backend/`: `python -m app.services.audit_service`.

### Files created/changed
- **Created** `alter-ego-backend/app/services/audit_service.py`

---

## 2026-03-17 — W1: Frontend wiring layer (API client + Zustand + React Query)

### Goal
Single base API client with auth headers and error handling, Zustand auth and user stores, and a root providers wrapper so all services and screens use the same foundation.

### What we did
- **Created** `alter-ego-mobile/src/services/api.ts`:
  - Base URL from `EXPO_PUBLIC_API_URL`; auth header from Supabase session.
  - `apiClient.get/post/put/patch/delete(path)` with retry (3×, exponential backoff), 401 → refresh session and retry once.
  - Error types: `ApiError`, `NetworkError`, `AuthError`; helpers: `isApiError`, `isAuthError`, `isNetworkError`, `getErrorMessage`.
- **Created** `alter-ego-mobile/src/store/authStore.ts` (Zustand):
  - State: session, user, isLoading, isAuthenticated, isAnonymous.
  - Actions: initialize(), setSession, signInAnonymously, signInWithGoogle (delegates to auth service), signOut, refreshSession.
- **Created** `alter-ego-mobile/src/store/userStore.ts` (Zustand):
  - UserProfile type matching `/api/v1/profile/overview`; fetchProfile(); optimistic updates: updateXP, updatePF, updateStreak, updateStage, updatePetStage, incrementUnreadMail, clearProfile.
- **Created** `alter-ego-mobile/src/providers/AppProviders.tsx`:
  - QueryClientProvider (staleTime 5m, gcTime 10m, retry 2); on mount runs auth initialize; when authenticated runs fetchProfile.
- **Updated** `alter-ego-mobile/App.tsx`: wrapped root with `<AppProviders>`.
- **Updated** `alter-ego-mobile/babel.config.js`: added `module-resolver` with `alias: { "@": "./src" }` (reanimated plugin remains last). Path alias `@/` → `src/` already present in `tsconfig.json`.

### Files created/changed
- **Created** `alter-ego-mobile/src/services/api.ts`
- **Created** `alter-ego-mobile/src/store/authStore.ts`
- **Created** `alter-ego-mobile/src/store/userStore.ts`
- **Created** `alter-ego-mobile/src/providers/AppProviders.tsx`
- **Changed** `alter-ego-mobile/App.tsx`
- **Changed** `alter-ego-mobile/babel.config.js`

---

## 2026-03-17 — Supabase client consolidation (single client, single import path)

### Goal
One Supabase client for the whole app; one import path (`@/utils/supabase`) everywhere.

### What we did
- **Replaced** `alter-ego-mobile/src/utils/supabase.ts` with a single consolidated client that combines:
  - **SecureStore** session persistence (from former `src/lib/supabase.ts`): Expo SecureStore on iOS/Android, AsyncStorage on web.
  - **Guest mode** (from former utils): `setGuestMode`, `clearGuestMode`, `isGuestMode`, and patched `getSession()` returning a guest session when enabled.
  - **fetchWithRetry** (from former utils): global fetch wrapper for Supabase (3 retries) for transient network failures.
- **Updated all imports** across the project to `@/utils/supabase` (replacing either `@/lib/supabase` or `../utils/supabase` / `./src/utils/supabase`).
- **Deleted** `alter-ego-mobile/src/lib/supabase.ts`.

### Files created/changed
- **Replaced** `alter-ego-mobile/src/utils/supabase.ts` (single client: SecureStore + guest mode + fetchWithRetry)
- **Changed** `alter-ego-mobile/src/services/auth.ts`, `src/services/api.ts`, `src/store/authStore.ts`, `App.tsx`, and all screens that imported supabase (SignUpScreen, HomeScreen, ProfileScreen, SettingsScreen, etc.) to use `@/utils/supabase`
- **Deleted** `alter-ego-mobile/src/lib/supabase.ts`

### Notes
- Screens and services must import from `@/utils/supabase` only. No other Supabase client file exists.

