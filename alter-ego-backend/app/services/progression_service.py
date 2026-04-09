"""
Progression checks — called after every mission completion.
Checks if XP crosses a stage threshold or PF crosses a pet threshold.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.core.constants import (
    PF_THRESHOLDS,
    PET_NAMES,
    STAGE_NAMES,
    TOTAL_CHARACTER_STAGES,
    TOTAL_PET_STAGES,
    XP_THRESHOLDS,
)
from app.core.supabase_client import supabase_admin


async def check_character_stage_progression(
    user_id: str,
    new_total_xp: int,
    current_stage: int,
) -> dict | None:
    """
    Checks if new_total_xp crosses the next stage threshold.
    If yes: updates character_stage, logs milestone, returns evolution data.
    If no: returns None.
    """
    if current_stage >= TOTAL_CHARACTER_STAGES:
        return None  # Already at max stage

    next_threshold = XP_THRESHOLDS[current_stage]  # stage 1 -> idx 1 (stage 2 threshold)
    if new_total_xp < next_threshold:
        return None

    new_stage = current_stage + 1
    new_stage_name = STAGE_NAMES[new_stage - 1]

    await run_query(supabase_admin.table("users").update({"character_stage": new_stage}).eq("id", user_id))

    await run_query(supabase_admin.table("milestone_log").insert(
        {
            "user_id": user_id,
            "milestone_type": f"stage_{new_stage}",
            "earned_at": datetime.now(timezone.utc).isoformat(),
        }
    ))

    try:
        from app.services.mail_service import send_stage_evolved_mail_if_needed

        await send_stage_evolved_mail_if_needed(user_id, new_stage, new_stage_name)
    except Exception:
        pass

    return {"new_stage": new_stage, "new_stage_name": new_stage_name}


async def check_pet_stage_progression(
    user_id: str,
    new_total_pf: int,
    current_pet_stage: int,
    pet_unlocked: bool,
) -> dict | None:
    """
    Checks if new_total_pf crosses the next pet stage threshold.
    Only runs if pet is unlocked.
    If yes: updates pet_stage, logs milestone, returns evolution data.
    If no: returns None.
    """
    if not pet_unlocked:
        return None

    if current_pet_stage >= TOTAL_PET_STAGES:
        return None  # Already at max stage

    next_threshold = PF_THRESHOLDS[current_pet_stage]  # stage 1 -> idx 1 (stage 2 threshold)
    if new_total_pf < next_threshold:
        return None

    new_pet_stage = current_pet_stage + 1
    new_pet_name = PET_NAMES[new_pet_stage - 1]

    await run_query(supabase_admin.table("users").update({"pet_stage": new_pet_stage}).eq("id", user_id))

    await run_query(supabase_admin.table("milestone_log").insert(
        {
            "user_id": user_id,
            "milestone_type": f"pet_stage_{new_pet_stage}",
            "earned_at": datetime.now(timezone.utc).isoformat(),
        }
    ))

    return {"new_stage": new_pet_stage, "new_pet_name": new_pet_name}

