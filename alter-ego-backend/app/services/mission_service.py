from __future__ import annotations

from datetime import datetime, date, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from app.core.supabase_client import supabase_admin
from app.core.constants import CORE_MISSIONS, DAILY_PF_CAPS, DAILY_XP_CAPS
from app.services.progression_service import (
    check_character_stage_progression,
    check_pet_stage_progression,
)
from app.services.streak_service import process_streak


def get_user_date(timezone_str: str) -> str:
    """
    Returns today's date string in the user's local timezone.
    Format: "YYYY-MM-DD"

    Uses Python's zoneinfo module (Python 3.9+).
    Falls back to UTC if timezone string is invalid.
    """
    try:
        tz = ZoneInfo(timezone_str)
        return datetime.now(tz).strftime("%Y-%m-%d")
    except Exception:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def get_days_since_registration(registration_date: str, timezone_str: str) -> int:
    """
    Returns how many days the user has been registered.
    Day 1 = the day they registered.
    Used to determine pet unlock (day 6), leaderboard unlock check, etc.
    """
    # Parse registration timestamp
    try:
        reg_dt = datetime.fromisoformat(str(registration_date).replace("Z", "+00:00"))
    except Exception:
        reg_dt = datetime.now(timezone.utc)

    # Resolve timezone
    try:
        tz = ZoneInfo(timezone_str)
    except Exception:
        tz = timezone.utc

    reg_day: date = reg_dt.astimezone(tz).date()
    today: date = datetime.now(tz).date()

    delta = (today - reg_day).days
    return max(1, delta + 1)


async def generate_core_missions_for_user(user_id: str, mission_date: str) -> list[dict]:
    """
    Generates all 6 core missions for a user for a given date.
    Inserts them into the missions table.
    Returns the list of created mission dicts.

    Rules:
    - Always generates all 6 core missions (sleep, movement, hydration,
      mindfulness, no_phone, journal)
    - If missions already exist for this user+date: return existing ones
      (idempotent — safe to call multiple times)
    - XP and PF values come directly from constants.py CORE_MISSIONS
    - Journal mission: set is_journal_mission=True, core_pillar="journal"
    - All missions start as completed=False
    """
    existing = (
        supabase_admin.table("missions")
        .select("*")
        .eq("user_id", user_id)
        .eq("mission_date", mission_date)
        .eq("type", "core")
        .execute()
    )
    if existing.data and isinstance(existing.data, list) and len(existing.data) >= 6:
        return existing.data

    rows: list[dict] = []
    for mission in CORE_MISSIONS:
        rows.append(
            {
                "user_id": user_id,
                "type": "core",
                "title": mission["title"],
                "difficulty": mission["difficulty"],
                "xp_value": mission["xp"],
                "pf_value": mission["pf"],
                "mission_date": mission_date,
                "completed": False,
                "is_journal_mission": bool(mission.get("is_journal_mission", False)),
                "core_pillar": mission["pillar"],
                "estimated_minutes": mission["estimated_minutes"],
                "rationale": mission["rationale"],
            }
        )

    inserted = supabase_admin.table("missions").insert(rows).execute()
    if inserted.data and isinstance(inserted.data, list) and len(inserted.data) >= 6:
        return inserted.data

    # Fallback: fetch what we just created
    fetched = (
        supabase_admin.table("missions")
        .select("*")
        .eq("user_id", user_id)
        .eq("mission_date", mission_date)
        .eq("type", "core")
        .execute()
    )
    return fetched.data or []


async def get_today_missions(user_id: str, mission_date: str) -> list[dict]:
    """
    Returns all missions for a user on a given date.
    Ordered: core first, then interest, then resistance, then personal.
    """
    result = (
        supabase_admin.table("missions")
        .select("*")
        .eq("user_id", user_id)
        .eq("mission_date", mission_date)
        .execute()
    )
    rows = result.data or []
    order = {"core": 0, "interest": 1, "resistance": 2, "personal": 3, "recovery": 4}
    return sorted(rows, key=lambda r: order.get(r.get("type") or "", 99))


async def get_today_missions_by_type(user_id: str, mission_date: str, mission_type: str) -> list[dict]:
    result = (
        supabase_admin.table("missions")
        .select("*")
        .eq("user_id", user_id)
        .eq("mission_date", mission_date)
        .eq("type", mission_type)
        .execute()
    )
    return result.data or []


async def complete_mission(user_id: str, mission_id: str) -> dict:
    """
    Marks a mission complete and processes all rewards.

    Steps:
    1. Validate mission exists, belongs to user, is for today, not already complete
    2. Mark mission complete
    3. Calculate XP and PF earned
    4. Check and enforce daily cap
    5. Update xp_log and pf_log
    6. Update users.total_xp and users.total_pf
    7. Check character stage progression
    8. Check pet stage progression
    9. Check streak (stub for now)
    10. Return result
    """
    mission_result = (
        supabase_admin.table("missions")
        .select("*")
        .eq("id", mission_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    if not mission_result.data:
        raise HTTPException(status_code=404, detail="Mission not found")

    mission = mission_result.data

    user_result = (
        supabase_admin.table("users")
        .select("total_xp, total_pf, character_stage, timezone, pet_stage, pet_unlocked, current_streak")
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = user_result.data or {}

    if mission.get("completed"):
        return {
            "success": True,
            "already_completed": True,
            "xp_earned": 0,
            "pf_earned": 0,
            "new_total_xp": int(user.get("total_xp") or 0),
            "new_total_pf": int(user.get("total_pf") or 0),
        }

    # Ensure mission is for "today" (user's timezone)
    today = get_user_date(user.get("timezone", "UTC") or "UTC")
    if str(mission.get("mission_date")) != today:
        raise HTTPException(status_code=400, detail="Mission is not for today")

    # Mark mission complete
    supabase_admin.table("missions").update(
        {"completed": True, "completed_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", mission_id).execute()

    # Calculate XP/PF earned from stored values
    xp_earned = int(mission.get("xp_value") or 0)
    pf_earned = int(mission.get("pf_value") or 0)

    # Enforce daily cap
    character_stage = int(user.get("character_stage") or 1)
    daily_xp_cap = int(DAILY_XP_CAPS.get(character_stage, 200))
    daily_pf_cap = int(DAILY_PF_CAPS.get(character_stage, 160))

    xp_today_result = (
        supabase_admin.table("xp_log").select("amount").eq("user_id", user_id).eq("log_date", today).execute()
    )
    xp_today = sum(int(row.get("amount") or 0) for row in (xp_today_result.data or []))

    pf_today_result = (
        supabase_admin.table("pf_log").select("amount").eq("user_id", user_id).eq("log_date", today).execute()
    )
    pf_today = sum(int(row.get("amount") or 0) for row in (pf_today_result.data or []))

    xp_earned = max(0, min(xp_earned, daily_xp_cap - xp_today))
    pf_earned = max(0, min(pf_earned, daily_pf_cap - pf_today))

    current_total_xp = int(user.get("total_xp") or 0)
    current_total_pf = int(user.get("total_pf") or 0)
    new_total_xp = current_total_xp + xp_earned
    new_total_pf = current_total_pf + pf_earned

    # Log XP and PF
    if xp_earned > 0:
        supabase_admin.table("xp_log").insert(
            {
                "user_id": user_id,
                "amount": xp_earned,
                "source_mission_id": mission_id,
                "character_stage_at": character_stage,
                "total_after": new_total_xp,
                "log_date": today,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()

    pet_stage = int(user.get("pet_stage") or 0)
    if pf_earned > 0:
        supabase_admin.table("pf_log").insert(
            {
                "user_id": user_id,
                "amount": pf_earned,
                "source_mission_id": mission_id,
                "pet_stage_at": pet_stage,
                "total_after": new_total_pf,
                "log_date": today,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()

    # Update user totals
    supabase_admin.table("users").update({"total_xp": new_total_xp, "total_pf": new_total_pf}).eq("id", user_id).execute()

    # Progression checks
    stage_evolved = await check_character_stage_progression(user_id, new_total_xp, character_stage)
    pet_evolved = await check_pet_stage_progression(user_id, new_total_pf, pet_stage, bool(user.get("pet_unlocked")))

    streak_result = await process_streak(user_id)

    return {
        "success": True,
        "xp_earned": xp_earned,
        "pf_earned": pf_earned,
        "new_total_xp": new_total_xp,
        "new_total_pf": new_total_pf,
        "daily_xp_remaining": max(0, daily_xp_cap - xp_today - xp_earned),
        "daily_pf_remaining": max(0, daily_pf_cap - pf_today - pf_earned),
        "stage_evolved": stage_evolved,
        "pet_evolved": pet_evolved,
        "streak_updated": streak_result["streak_achieved_today"],
        "current_streak": streak_result["current_streak"],
        "streak_animation": {
            "show": streak_result["streak_achieved_today"],
            "streak_count": streak_result["current_streak"],
            "animation_tier": streak_result["animation_tier"],
        },
        "tier_upgraded": streak_result.get("tier_upgraded", False),
        "new_streak_tier": streak_result.get("new_tier"),
        "milestone_reached": streak_result.get("milestone_reached"),
        "leaderboard_just_unlocked": streak_result.get("leaderboard_just_unlocked", False),
    }

