# Edge-case audit snapshot

**Scope:** This is a **targeted** pass (high-impact data paths + common crash vectors), not a line-by-line proof of every screen. Full “every function” certification would be ongoing QA + automated tests.

## Backend

| Area | Issue | Fix |
|------|--------|-----|
| **Power Score** | 30-day window used server `date.today()` | Anchor to **user local today** via `get_user_date`. |
| **Power Score** | Queried `streak_log.date` / `completed_missions` (invalid columns) | Use **`log_date`**, **`total_missions_done`**, **`total_missions`**. |
| **Power Score** | Nullable numeric fields from DB | Coerce **`int()`** / **`bool()`** for stage, XP, streak, pet. |
| **GET /reports/weekly** | Week key used UTC `date.today()` | Use **`local_completed_week_bounds`** (same as generation). |
| **GET /profile/stats** | `since` used UTC | Anchor **`since`** to user **local** calendar. |
| **GET /profile/streak** | 52-week `since` used UTC | Same; single user fetch includes **timezone**. |
| **generate_weekly_report** | Duplicated week math | Delegates to **`local_completed_week_bounds`**. |
| **generate_day_summary** | `streak_row` could be `None` → `[0]` crash | Normalise to **`data or []`** before indexing. |
| **Quit planner** | `days_since_slip` used UTC `date.today()` | Use **`get_user_date(user.timezone)`**. |

## Mobile

| Area | Issue | Fix |
|------|--------|-----|
| **missionsService** | Partial API JSON (missing arrays) | **`normalizeTodayMissionsResponse`** for today + by-date. |
| **useMissions** | Optimistic update assumed `missions` / `summary` always present | **`?.`** and **defaults** on mutate paths. |
| **HomeScreen** | `todayData?.missions.core` throws if `missions` undefined | **`missions?.core`** (and summary **`?.`**). |

## Already documented elsewhere

- Timezone scheduler + mission sync: **`TIMEZONE_AND_MISSIONS.md`**, **`EDGE_CASES.md`**.

## Recommended next steps (not done here)

- E2E / integration tests for Power Score + weekly report fetch with non-UTC timezone.
- ESLint rule or codegen for navigation typing to reduce `as any`.
- Broader screen audit using crash analytics (Sentry) once in production.
