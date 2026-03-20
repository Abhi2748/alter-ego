# Power Score — formula (backend)

Stored on `users.power_score` (0–1000). Recalculated in **`user_local_maintenance_job`** (~01:00 in the user’s `users.timezone`), and via **`calculate_power_score`** / **`calculate_all_power_scores`**.

## Weights (`POWER_SCORE_WEIGHTS` in `app/core/constants.py`)

| Component | Weight | Meaning |
|-----------|--------|---------|
| `xp_stage_progress` | **0.35** | Progress through current **character stage** (XP vs stage thresholds). |
| `pet_stage` | **0.20** | Normalised **pet stage** (1–8), only if pet is unlocked. |
| `streak` | **0.25** | Current **streak**, capped at **`POWER_SCORE_STREAK_CAP` (100)** days. |
| `completion_rate` | **0.20** | **30-day** mission completion ratio from **`streak_log`**. |

Weights sum to **1.0**. Final score is **clamped** to **`POWER_SCORE_MAX` (1000)**.

## How each part is computed (see `app/services/power_score_service.py`)

1. **XP / stage (35%)**  
   - Maps `total_xp` into the current stage band using `XP_THRESHOLDS`.  
   - Combines “completed” stages plus fractional progress in the current stage, then multiplies by `0.35 × 1000`.

2. **Pet (20%)**  
   - If `pet_unlocked` and `pet_stage > 0`: \((pet\_stage - 1) / (TOTAL\_PET\_STAGES - 1)\) × `0.20 × 1000`.  
   - Else **0**.

3. **Streak (25%)**  
   - `min(current_streak, 100) / 100` × `0.25 × 1000`.

4. **30-day completion (20%)**  
   - Loads `streak_log` rows with **`log_date` ≥ (user local today − 30 days)** (same calendar anchor as missions).  
   - `completion_rate = sum(total_missions_done) / sum(total_missions)` (0 if no missions logged).  
   - × `0.20 × 1000`.

## Product copy note

Marketing text sometimes says “30-day streak” for the streak term; the **code** uses a **100-day cap** for the streak *component* (`POWER_SCORE_STREAK_CAP`). The **completion** piece is explicitly **30 days**.
