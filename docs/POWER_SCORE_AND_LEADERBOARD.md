# Power score & leaderboard (Supabase)

## Where power score lives

| Location | Purpose |
|----------|---------|
| **`public.users.power_score`** | Current score (integer, 0–1000). Updated after each mission completion and by the nightly job via `calculate_power_score`. |
| **`public.power_score_log`** | Optional history rows when the score is recalculated with `log_event=True` (nightly batch). Per-mission updates use `log_event=False` and do not insert here. |

Calculation logic: `alter-ego-backend/app/services/power_score_service.py` (`compute_power_score_value`, `calculate_power_score`).

## Beta leaderboard pool

- **Production:** Leaderboard lists only users with **`users.leaderboard_unlocked = true`**.
- **Beta:** If the requester has **`subscription_tier = 'beta_free'`**, the list includes anyone who is **`leaderboard_unlocked`** **or** **`subscription_tier = 'beta_free'`**, so a single beta tester still appears.
- **Staging override:** Set env **`ALTER_EGO_BETA_LEADERBOARD_POOL=1`** (or `true`) on the API. That **grants leaderboard access** (same as beta tier) and uses the **widened pool** so any onboarded user can appear — use **only in beta/staging**, never in production.

API: `alter-ego-backend/app/api/leaderboard.py`.
