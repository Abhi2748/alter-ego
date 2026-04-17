from datetime import datetime, timedelta, date as date_type
import math
import logging

from app.core.constants import (
    XP_THRESHOLDS,
    POWER_SCORE_WEIGHTS,
    POWER_SCORE_MAX,
    POWER_SCORE_STREAK_CAP,
    TOTAL_PET_STAGES,
)
from app.core.supabase_client import supabase_admin, run_query
from app.services.mission_service import get_user_date

logger = logging.getLogger(__name__)


def fetch_user_30d_completion_rate(user_id: str, thirty_days_ago: str) -> float:
    """Ratio of missions done vs assigned from streak_log over the last 30 local days."""
    streak_rows = (
        supabase_admin.table("streak_log")
        .select("total_missions_done, total_missions")
        .eq("user_id", user_id)
        .gte("log_date", thirty_days_ago)
        .execute()
        .data
        or []
    )
    if not streak_rows:
        return 0.0
    total_done = sum(int(r.get("total_missions_done", 0) or 0) for r in streak_rows)
    total_possible = sum(int(r.get("total_missions", 0) or 0) for r in streak_rows)
    return (total_done / total_possible) if total_possible > 0 else 0.0


def fetch_twin_30d_completion_rate(user_id: str, thirty_days_ago: str) -> float:
    """Twin's simulated completion rate from twin_daily_record (last 30 days)."""
    rows = (
        supabase_admin.table("twin_daily_record")
        .select("missions_completed, missions_assigned")
        .eq("user_id", user_id)
        .gte("record_date", thirty_days_ago)
        .execute()
        .data
        or []
    )
    if not rows:
        return 0.0
    total_done = sum(int(r.get("missions_completed", 0) or 0) for r in rows)
    total_assigned = sum(int(r.get("missions_assigned", 0) or 0) for r in rows)
    return (total_done / total_assigned) if total_assigned > 0 else 0.0


def compute_power_score_value(
    character_stage: int,
    total_xp: int,
    pet_stage: int,
    pet_unlocked: bool,
    current_streak: int,
    completion_rate: float,
) -> int:
    """
    Same formula as persisted user power score (0–POWER_SCORE_MAX).
    Used for both the user and the twin (twin fields passed in).
    """
    character_stage = max(1, int(character_stage or 1))
    total_xp = int(total_xp or 0)
    pet_stage = int(pet_stage or 0)
    current_streak = int(current_streak or 0)
    completion_rate = max(0.0, min(1.0, float(completion_rate or 0.0)))

    stage_idx = max(0, min(len(XP_THRESHOLDS) - 1, character_stage - 1))
    stage_start = XP_THRESHOLDS[stage_idx]
    if character_stage < len(XP_THRESHOLDS):
        stage_end = XP_THRESHOLDS[stage_idx + 1]
        stage_range = stage_end - stage_start
        stage_progress = (total_xp - stage_start) / stage_range if stage_range > 0 else 1.0
    else:
        stage_progress = 1.0

    stage_progress = max(0.0, min(1.0, stage_progress))

    stage_component = (
        ((character_stage - 1) / len(XP_THRESHOLDS))
        + (stage_progress / len(XP_THRESHOLDS))
    ) * POWER_SCORE_WEIGHTS["xp_stage_progress"] * POWER_SCORE_MAX

    if pet_unlocked and pet_stage > 0 and TOTAL_PET_STAGES > 0:
        pet_component = (
            pet_stage / TOTAL_PET_STAGES
        ) * POWER_SCORE_WEIGHTS["pet_stage"] * POWER_SCORE_MAX
    else:
        pet_component = 0.0

    streak_capped = min(current_streak, POWER_SCORE_STREAK_CAP)
    streak_component = (
        math.sqrt(streak_capped / POWER_SCORE_STREAK_CAP)
    ) * POWER_SCORE_WEIGHTS["streak"] * POWER_SCORE_MAX

    completion_component = (
        completion_rate * POWER_SCORE_WEIGHTS["completion_rate"] * POWER_SCORE_MAX
    )

    total = round(
        stage_component + pet_component + streak_component + completion_component
    )
    return max(0, min(POWER_SCORE_MAX, total))


async def calculate_power_score(user_id: str, *, log_event: bool = True) -> int:
    """
    Calculate and store the Power Score for a user.
    Called nightly by the cron job and after mission completion (log_event=False).
    Returns the calculated score (0-POWER_SCORE_MAX).
    """
    user_result = (
        await run_query(supabase_admin.table("users")
        .select(
            "total_xp, character_stage, pet_stage, pet_unlocked, "
            "current_streak, power_score, timezone"
        )
        .eq("id", user_id)
        .single())
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
    completion_rate = fetch_user_30d_completion_rate(user_id, thirty_days_ago)

    total = compute_power_score_value(
        character_stage,
        total_xp,
        pet_stage,
        pet_unlocked,
        current_streak,
        completion_rate,
    )

    await run_query(supabase_admin.table("users").update({"power_score": total}).eq("id", user_id))

    if log_event:
        await run_query(supabase_admin.table("power_score_log").insert(
            {"user_id": user_id, "score": total, "calculated_at": datetime.utcnow().isoformat()}
        ))

    return total


async def calculate_all_power_scores() -> int:
    """
    Calculate power scores for all onboarded users.
    Called nightly by the cron job.
    Returns count of users processed.
    """
    users = (
        ((await run_query(supabase_admin.table("users")
        .select("id")
        .eq("onboarding_complete", True))).data)
        or []
    )

    count = 0
    for user in users:
        try:
            await calculate_power_score(user["id"], log_event=True)
            count += 1
        except Exception as e:
            logger.error("Power score failed for user %s: %s", user.get("id"), e)
    return count
