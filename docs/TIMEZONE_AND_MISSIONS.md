# Timezone and daily missions (ALTER EGO)

## Source of truth

- **`users.timezone`** — IANA name (e.g. `America/New_York`). Used for:
  - Calendar **today** (`mission_date` on missions, streak checks, completion validation).
  - **Scheduler** windows (local hour/day), not a single UTC bucket for everyone.

## Mobile app

- **On cold start and when returning to foreground** (`AppProviders`), the app POSTs  
  `POST /api/v1/settings/notifications` with `{ timezone }` from  
  `Intl.DateTimeFormat().resolvedOptions().timeZone` so travel/DST/OS changes propagate.

## When things run (backend scheduler)

All of these iterate users hourly and filter by **that user’s** local time (invalid TZ → UTC fallback).

| Job | Local window | Purpose |
|-----|----------------|--------|
| `daily_mission_reset_job` | Hour **1** | If today has no core missions yet, create core + sync interest/resistance. |
| `pet_unlock_check_job` | Hour **1** | Pet unlock (day 6+), streak-break handling. |
| `twin_simulation_job` | Hour **1** | Twin daily simulation (bootstraps missions if still empty). |
| `twin_recalibration_job` | Hour **1** | Twin DNA recalibration: first on **day 7**, then every **7** days. |
| `user_local_maintenance_job` | Hour **1** | Yesterday’s **day summary**, **Power Score** recalc, **scheduled in-app mail**. |
| `weekly_report_local_job` | **Sunday** hour **3** | Weekly report generation. |
| `nudge_check_job` | Every hour | Nudge agent (internal rules). |

**Midnight–1:00 local:** If the user opens the app before 1:00, `GET /api/v1/missions/today` still creates today’s missions on demand.

## Shadow Twin (comparison + strip)

- **Scheduled:** `twin_simulation_job` runs at **local hour 1** (same window as mission reset). It runs `simulate_twin_day`, writes **`twin_daily_record`** for that calendar day, updates **`twin_state`** (XP, gap, streak), then **`update_strip_message`**.
- **On demand (day 1+ any time):** `GET /api/v1/twin/state` and `GET /api/v1/twin/strip` call **`ensure_twin_simulated_for_today`**. If there is **no** `twin_daily_record` row for the user’s **local today**, the server runs **`simulate_twin_day` once** (same logic as the job). Simulation is **idempotent per day**: a second run the same calendar day does **not** double-apply twin XP.
- **Strip text in Supabase:** New users get an initial **`twin_state.strip_message`** at onboarding (tone-matched). If it is still empty (legacy rows), **`get_twin_state`** triggers **`update_strip_message`** once.
- **Twin Comparison timeline:** Built from **`twin_daily_record.completed_mission_ids`** → mission titles/XP (`build_twin_day_timeline`). Display times are spread between the user’s local **06:00** and **min(now, 21:30)** on that calendar day so nothing appears in the future. Returned on **`GET /api/v1/twin/state`** as **`twin_timeline`** plus **`strip_message`**.

## Mission sync (interests & quit targets)

- **`sync_today_planner_missions`** (`app/services/mission_service.py`) runs from **`GET /api/v1/missions/today`** (and the daily reset path uses it too).
- **Removes** only **incomplete** interest/resistance missions that no longer match profile (inactive interest, wrong `active_days` for today’s calendar date, removed interest id, inactive/conquered quit target).
- **Never deletes** completed missions.
- **Ensures** planner-generated missions exist for each eligible interest and active quit target (idempotent per `interest_id` / `quit_target_id` + `mission_date`).

## Planner weekday

- Interest **active day** checks use the **`mission_date` calendar date** (not “now”), so behaviour stays consistent for sync, cron, and API.

## Weekly report window

- **`generate_weekly_report`** computes the completed Mon–Sun window from **the user’s local calendar date** at generation time (same formula as before, but anchored to user TZ).

## Power Score window

- The **30-day completion** slice uses **`streak_log.log_date`** from **user local today − 30 days** (`power_score_service` + `get_user_date`). Details: **`POWER_SCORE.md`**.

## Related files

- `alter-ego-backend/app/core/scheduler.py`
- `alter-ego-backend/app/services/mission_service.py`
- `alter-ego-backend/app/services/power_score_service.py`
- `alter-ego-backend/app/agents/planner_agent.py`
- `alter-ego-backend/app/agents/report_agent.py`
- `alter-ego-backend/app/api/missions.py`
- `alter-ego-backend/app/api/profile.py`
- `alter-ego-backend/app/api/reports.py`
- `alter-ego-backend/app/services/twin_service.py`
- `alter-ego-backend/app/api/settings.py` (FAQ + notifications timezone)
- `alter-ego-mobile/src/providers/AppProviders.tsx`
- `alter-ego-mobile/src/services/missions.ts`, `alter-ego-mobile/src/hooks/useMissions.ts`, `alter-ego-mobile/src/screens/HomeScreen.tsx`
