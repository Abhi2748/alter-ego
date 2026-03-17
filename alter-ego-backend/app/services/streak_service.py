"""
Streak calculation with progressive tier system.

Tier 1 (default): any 2 core missions OR 1 interest mission
Tier 2 (character stage 2 reached): 4 core + 1 interest
Tier 3 (30-day streak hit for first time): all 5 core missions
Tier 4 (60-day streak hit for first time): all 5 core + 1 interest + 1 personal

Journal mission does NOT count toward streak requirement in any tier.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from app.core.supabase_client import supabase_admin


def evaluate_streak_requirement(completed_missions: list[dict], streak_tier: str) -> bool:
    """
    Returns True if today's completions satisfy the streak requirement
    for the given tier.

    completed_missions: list of mission dicts that are completed=True for today
    """
    from app.core.constants import STREAK_TIER_REQUIREMENTS

    req = STREAK_TIER_REQUIREMENTS[streak_tier]

    core_done = sum(
        1
        for m in completed_missions
        if m.get("type") == "core"
        and not m.get("is_journal_mission", False)
        and m.get("completed")
    )
    interest_done = sum(1 for m in completed_missions if m.get("type") == "interest" and m.get("completed"))
    personal_done = sum(1 for m in completed_missions if m.get("type") == "personal" and m.get("completed"))

    if req.get("core_or_interest"):
        return core_done >= req["core_minimum"] or interest_done >= 1

    return (
        core_done >= req["core_minimum"]
        and interest_done >= req["interest_minimum"]
        and personal_done >= req["personal_minimum"]
    )


def check_streak_tier_upgrade(user: dict, new_streak: int) -> str | None:
    """
    Checks if the user should move to the next streak tier.
    Returns the new tier string if upgraded, None if no change.
    """
    current_tier = user.get("streak_requirement_tier", "tier_1")

    if current_tier == "tier_1" and int(user.get("character_stage", 1) or 1) >= 2:
        return "tier_2"
    if current_tier == "tier_2" and new_streak >= 30:
        return "tier_3"
    if current_tier == "tier_3" and new_streak >= 60:
        return "tier_4"
    return None


def get_animation_tier(streak: int) -> str:
    """
    Returns the animation tier for the streak achievement animation.
    """
    if streak == 365:
        return "day365"
    if streak == 200:
        return "day200"
    if streak == 100:
        return "day100"
    if streak == 60:
        return "day60"
    if streak == 30:
        return "day30"
    return "standard"


async def process_streak(user_id: str) -> dict:
    """
    Called after every mission completion.
    Evaluates whether today's streak requirement is met.
    Updates current_streak, longest_streak, last_streak_date.
    Checks for tier upgrades.
    """
    from app.core.constants import LEADERBOARD_UNLOCK_STREAK, STREAK_MILESTONES
    from app.services.mission_service import get_user_date

    user_result = supabase_admin.table("users").select("*").eq("id", user_id).single().execute()
    user = user_result.data or {}

    today = get_user_date(user.get("timezone", "UTC") or "UTC")

    missions_result = (
        supabase_admin.table("missions").select("*").eq("user_id", user_id).eq("mission_date", today).execute()
    )
    today_missions = missions_result.data or []

    current_tier = user.get("streak_requirement_tier", "tier_1")
    streak_met = evaluate_streak_requirement(today_missions, current_tier)

    if not streak_met:
        return {
            "streak_maintained": False,
            "current_streak": int(user.get("current_streak") or 0),
            "streak_achieved_today": False,
            "tier_upgraded": False,
            "new_tier": None,
            "milestone_reached": None,
            "animation_tier": "standard",
        }

    last_streak_date = user.get("last_streak_date")
    current_streak = int(user.get("current_streak") or 0)

    if last_streak_date == today:
        return {
            "streak_maintained": True,
            "current_streak": current_streak,
            "streak_achieved_today": False,
            "tier_upgraded": False,
            "new_tier": None,
            "milestone_reached": None,
            "animation_tier": "standard",
        }

    yesterday = str(date.fromisoformat(today) - timedelta(days=1))
    if last_streak_date == yesterday:
        new_streak = current_streak + 1
    else:
        new_streak = 1

    update_data: dict = {"current_streak": new_streak, "last_streak_date": today}
    if new_streak > int(user.get("longest_streak") or 0):
        update_data["longest_streak"] = new_streak

    new_tier = check_streak_tier_upgrade(user, new_streak)
    tier_upgraded = False
    if new_tier:
        update_data["streak_requirement_tier"] = new_tier
        tier_upgraded = True

    supabase_admin.table("users").update(update_data).eq("id", user_id).execute()

    # streak_log upsert
    xp_today = sum(
        int(r.get("amount") or 0)
        for r in (
            supabase_admin.table("xp_log").select("amount").eq("user_id", user_id).eq("log_date", today).execute().data
            or []
        )
    )
    pf_today = sum(
        int(r.get("amount") or 0)
        for r in (
            supabase_admin.table("pf_log").select("amount").eq("user_id", user_id).eq("log_date", today).execute().data
            or []
        )
    )

    core_done = sum(
        1
        for m in today_missions
        if m.get("type") == "core" and not m.get("is_journal_mission", False) and m.get("completed")
    )

    supabase_admin.table("streak_log").upsert(
        {
            "user_id": user_id,
            "log_date": today,
            "core_completed_count": core_done,
            "interest_completed": any(m for m in today_missions if m.get("type") == "interest" and m.get("completed")),
            "personal_completed": any(m for m in today_missions if m.get("type") == "personal" and m.get("completed")),
            "total_missions_done": sum(1 for m in today_missions if m.get("completed")),
            "total_missions": len(today_missions),
            "streak_maintained": True,
            "streak_count": new_streak,
            "requirement_tier": current_tier,
            "xp_earned": xp_today,
            "pf_earned": pf_today,
        },
        on_conflict="user_id,log_date",
    ).execute()

    # leaderboard unlock
    leaderboard_just_unlocked = False
    if new_streak >= LEADERBOARD_UNLOCK_STREAK and not user.get("leaderboard_unlocked"):
        supabase_admin.table("users").update(
            {"leaderboard_unlocked": True, "leaderboard_unlocked_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", user_id).execute()
        leaderboard_just_unlocked = True

    milestone_reached = None
    if new_streak in STREAK_MILESTONES:
        milestone_reached = new_streak
        supabase_admin.table("milestone_log").insert(
            {
                "user_id": user_id,
                "milestone_type": f"streak_{new_streak}",
                "earned_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()

    animation_tier = get_animation_tier(new_streak)

    return {
        "streak_maintained": True,
        "current_streak": new_streak,
        "streak_achieved_today": True,
        "tier_upgraded": tier_upgraded,
        "new_tier": new_tier,
        "milestone_reached": milestone_reached,
        "animation_tier": animation_tier,
        "leaderboard_just_unlocked": leaderboard_just_unlocked,
    }


async def handle_streak_break(user_id: str) -> None:
    """
    Called by the midnight cron when a user did not meet their
    streak requirement yesterday.

    Days 1-29 of absence: freeze XP, set pet to sad state
    Day 30+: apply dynamic penalty
    """
    from app.core.constants import STREAK_FREEZE_DAYS
    from app.services.mission_service import get_user_date

    user_result = (
        supabase_admin.table("users")
        .select("current_streak, last_streak_date, total_xp, timezone")
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = user_result.data or {}

    last_streak = user.get("last_streak_date")
    if not last_streak:
        return

    today = get_user_date(user.get("timezone", "UTC") or "UTC")
    try:
        days_absent = (date.fromisoformat(today) - date.fromisoformat(str(last_streak))).days
    except Exception:
        return

    if days_absent <= 0:
        return

    supabase_admin.table("users").update({"pet_state": "sad", "current_streak": 0}).eq("id", user_id).execute()

    if days_absent <= STREAK_FREEZE_DAYS:
        supabase_admin.table("users").update({"xp_frozen": True}).eq("id", user_id).execute()
        return

    total_xp = int(user.get("total_xp") or 0)
    penalty_pct = min(0.30, (days_absent - STREAK_FREEZE_DAYS) * 0.05)
    penalty = int(total_xp * penalty_pct)
    new_xp = max(0, total_xp - penalty)
    supabase_admin.table("users").update({"total_xp": new_xp, "xp_frozen": False}).eq("id", user_id).execute()

