# Edge cases addressed — timezone & missions

This document lists behavioural edge cases and what we implemented. It is not an exhaustive audit of the entire app.

## Timezone

| Edge case | Behaviour |
|-----------|-----------|
| Invalid or missing `users.timezone` | Scheduler maintenance jobs fall back to **UTC** for `ZoneInfo` (same as `get_user_date` fallback). |
| User travels / DST | App pushes device TZ on resume (`AppProviders`) so backend jobs use the updated IANA zone. |
| UTC cron ran same instant for everyone | Replaced with **per-user local hour** for day summary, power score, mail, weekly report (Sunday 3 local). |

## Calendar day vs wall clock

| Edge case | Behaviour |
|-----------|-----------|
| Interest `active_days` checked against “now” instead of stored date | **Fixed:** `generate_interest_mission` uses **`mission_date`** weekday + normalised `active_days` (see `parse_interest_active_days`). |
| `active_days` stored as 0–6 (Mon–Sun) vs ISO 1–7 | **Normalised** in `parse_interest_active_days` so both conventions map to ISO weekdays. |
| Batch jobs run in arbitrary order at 1:00 local | Twin sim required missions; **twin** bootstraps core + `sync_today_planner_missions` if today’s list is empty. |

## Mid-day profile changes

| Edge case | Behaviour |
|-----------|-----------|
| User removes today from schedule or deactivates interest | **Incomplete** interest mission for today is **deleted** on next `GET /missions/today`. **Completed** mission kept. |
| User adds interest or becomes eligible today | Planner runs for that interest; idempotent insert if row missing. |
| Quit target paused/conquered | **Incomplete** resistance mission removed; completed kept. |
| Orphan `interest_id` on mission (row deleted) | Treated as not eligible → incomplete mission **removed**. |

## Deferred vs immediate

| Expectation | Implementation |
|-------------|----------------|
| Nightly summaries, power score, mail, weekly report | **~1:00 local** (summary + score + mail) and **Sunday 3:00 local** (weekly). |
| Today’s list after editing interests/quits | **Immediate** on next **Home / GET today** via `sync_today_planner_missions`. |

## FAQ / copy

| Edge case | Change |
|-----------|--------|
| FAQ said interest edits “next day only” | Updated to reflect **same-day sync** when opening missions. |
| FAQ said power score “every night” | Updated to **~1:00 in your timezone**. |

## Known follow-ups (not fully solved here)

- **Interest difficulty / goal** mid-day: we do **not** auto-regenerate an **incomplete** mission solely for tier/goal text changes; schedule/eligibility/removals are covered.
- **`/api/v1/interests` CRUD** in `alter-ego-mobile/src/utils/api.ts`: if the backend router is added later, call **`GET /missions/today`** or a dedicated sync after mutations (today’s sync already runs on Home).

**Power Score 30-day window** is anchored to the user’s local calendar (see **`POWER_SCORE.md`**).
