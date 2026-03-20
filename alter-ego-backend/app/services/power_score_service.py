from datetime import datetime, timedelta, date as date_type
import logging

from app.core.constants import (
    XP_THRESHOLDS,
    POWER_SCORE_WEIGHTS,
    POWER_SCORE_MAX,
    POWER_SCORE_STREAK_CAP,
    TOTAL_PET_STAGES,
)
from app.core.supabase_client import supabase_admin
from app.services.mission_service import get_user_date

logger = logging.getLogger(__name__)


async def calculate_power_score(user_id: str) -> int:
    """
    Calculate and store the Power Score for a user.
    Called nightly by the cron job.
    Returns the calculated score (0-1000).
    """
    # Load user data
    user_result = (
        supabase_admin.table("users")
        .select(
            "total_xp, character_stage, pet_stage, pet_unlocked, "
            "current_streak, power_score, timezone"
        )
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = user_result.data or {}

    tz_str = str(user.get("timezone") or "UTC")
    try:
        anchor = date_type.fromisoformat(get_user_date(tz_str))
    except Exception:
        anchor = date_type.today()
    thirty_days_ago = str(anchor - timedelta(days=30))

    character_stage = int(user.get("character_stage") or 1)
    total_xp = int(user.get("total_xp") or 0)
    pet_stage = int(user.get("pet_stage") or 0)
    pet_unlocked = bool(user.get("pet_unlocked"))
    current_streak = int(user.get("current_streak") or 0)

    # ── Component 1: XP stage progress (35%) ────────────────────────────
    # How far through the current stage threshold
    stage_idx = max(0, min(len(XP_THRESHOLDS) - 1, character_stage - 1))
    stage_start = XP_THRESHOLDS[stage_idx]
    if character_stage < len(XP_THRESHOLDS):
        stage_end = XP_THRESHOLDS[stage_idx + 1]
        stage_range = stage_end - stage_start
        stage_progress = (total_xp - stage_start) / stage_range if stage_range > 0 else 1.0
    else:
        # Max stage — full credit
        stage_progress = 1.0

    stage_progress = max(0.0, min(1.0, stage_progress))

    # Add stage base (each completed stage = 1/6 of the component)
    # So a stage 3 user 50% through stage 3 = (2/6 + 0.5 * 1/6) = 41.7%
    stage_component = (
        ((character_stage - 1) / len(XP_THRESHOLDS))
        + (stage_progress / len(XP_THRESHOLDS))
    ) * POWER_SCORE_WEIGHTS["xp_stage_progress"] * POWER_SCORE_MAX

    # ── Component 2: Pet stage (20%) ─────────────────────────────────────
    if pet_unlocked and pet_stage > 0 and TOTAL_PET_STAGES > 1:
        pet_component = (
            (pet_stage - 1) / (TOTAL_PET_STAGES - 1)
        ) * POWER_SCORE_WEIGHTS["pet_stage"] * POWER_SCORE_MAX
    else:
        pet_component = 0.0

    # ── Component 3: Streak (25%) ─────────────────────────────────────────
    streak_capped = min(current_streak, POWER_SCORE_STREAK_CAP)
    streak_component = (
        streak_capped / POWER_SCORE_STREAK_CAP
    ) * POWER_SCORE_WEIGHTS["streak"] * POWER_SCORE_MAX

    # ── Component 4: 30-day completion rate (20%) ────────────────────────
    # Window anchored to user's local calendar day (matches missions / streak_log.log_date).
    streak_rows = (
        supabase_admin.table("streak_log")
        .select("total_missions_done, total_missions")
        .eq("user_id", user_id)
        .gte("log_date", thirty_days_ago)
        .execute()
        .data
        or []
    )

    if streak_rows:
        total_done = sum(int(r.get("total_missions_done", 0) or 0) for r in streak_rows)
        total_possible = sum(int(r.get("total_missions", 0) or 0) for r in streak_rows)
        completion_rate = (total_done / total_possible) if total_possible > 0 else 0.0
    else:
        completion_rate = 0.0

    completion_component = (
        completion_rate * POWER_SCORE_WEIGHTS["completion_rate"] * POWER_SCORE_MAX
    )

    # ── Total score ──────────────────────────────────────────────────────
    total = round(
        stage_component + pet_component + streak_component + completion_component
    )
    total = max(0, min(POWER_SCORE_MAX, total))

    # ── Store score ──────────────────────────────────────────────────────
    supabase_admin.table("users").update({"power_score": total}).eq("id", user_id).execute()

    supabase_admin.table("power_score_log").insert(
        {"user_id": user_id, "score": total, "calculated_at": datetime.utcnow().isoformat()}
    ).execute()

    return total


async def calculate_all_power_scores() -> int:
    """
    Calculate power scores for all onboarded users.
    Called nightly by the cron job.
    Returns count of users processed.
    """
    users = (
        supabase_admin.table("users")
        .select("id")
        .eq("onboarding_complete", True)
        .execute()
        .data
        or []
    )

    count = 0
    for user in users:
        try:
            await calculate_power_score(user["id"])
            count += 1
        except Exception as e:
            logger.error("Power score failed for user %s: %s", user.get("id"), e)
    return count

