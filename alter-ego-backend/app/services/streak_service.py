"""
Streak calculation with progressive tier system.

Tier 1 (default): 2 core OR 1 interest OR 3+ among core+interest (resistance excluded)
Tier 2 (character stage 2 reached): 4 core + 1 interest
Tier 3 (30-day streak hit for first time): all 5 core missions
Tier 4 (60-day streak hit for first time): all 5 core + 1 interest + 1 personal

Journal mission does NOT count toward streak requirement in any tier.
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone

from postgrest.types import CountMethod

from app.core.constants import STREAK_TIER_REQUIREMENTS
from app.core.supabase_client import supabase_admin, run_query
from app.services.mission_row_utils import mission_row_completed

logger = logging.getLogger(__name__)


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
        and mission_row_completed(m)
    )
    interest_done = sum(
        1 for m in completed_missions if m.get("type") == "interest" and mission_row_completed(m)
    )
    personal_done = sum(
        1 for m in completed_missions if m.get("type") == "personal" and mission_row_completed(m)
    )

    if req.get("core_or_interest"):
        # Do not require resistance — users without quit targets would never streak.
        pillar_done = core_done + interest_done
        return (
            core_done >= req["core_minimum"]
            or interest_done >= 1
            or pillar_done >= 3
        )

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

    user_result = await run_query(supabase_admin.table("users").select("*").eq("id", user_id).single())
    user = user_result.data or {}

    today = get_user_date(user.get("timezone", "UTC") or "UTC")

    missions_result = await run_query(supabase_admin.table("missions").select("*").eq("user_id", user_id).eq("mission_date", today))
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

    # Single winner per calendar day: concurrent mission completes must not each
    # return streak_achieved_today / fire duplicate animations or milestone inserts.
    # Use count=exact so we detect rows matched even when the PATCH body is empty
    # (204 / minimal representation) — do not rely on update_res.data alone.
    # Quote ISO date in or() so PostgREST does not treat hyphens as filter syntax.
    update_res = await run_query(supabase_admin.table("users")
        .update(update_data, count=CountMethod.exact)
        .eq("id", user_id)
        .or_(f'last_streak_date.is.null,last_streak_date.neq."{today}"'))
    rows_affected = update_res.count
    if rows_affected is None:
        rows_affected = len(update_res.data or [])
    if rows_affected <= 0:
        user_fresh = (
            ((await run_query(supabase_admin.table("users").select("*").eq("id", user_id).single())).data) or {}
        )
        fr_streak = int(user_fresh.get("current_streak") or 0)
        return {
            "streak_maintained": True,
            "current_streak": fr_streak,
            "streak_achieved_today": False,
            "tier_upgraded": False,
            "new_tier": None,
            "milestone_reached": None,
            "animation_tier": get_animation_tier(fr_streak),
            "leaderboard_just_unlocked": False,
        }

    # streak_log upsert
    xp_today = sum(
        int(r.get("amount") or 0)
        for r in (
            ((await run_query(supabase_admin.table("xp_log").select("amount").eq("user_id", user_id).eq("log_date", today))).data)
            or []
        )
    )
    pf_today = sum(
        int(r.get("amount") or 0)
        for r in (
            ((await run_query(supabase_admin.table("pf_log").select("amount").eq("user_id", user_id).eq("log_date", today))).data)
            or []
        )
    )

    core_done = sum(
        1
        for m in today_missions
        if m.get("type") == "core" and not m.get("is_journal_mission", False) and m.get("completed")
    )

    await run_query(supabase_admin.table("streak_log").upsert(
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
    ))

    # leaderboard unlock
    leaderboard_just_unlocked = False
    if new_streak >= LEADERBOARD_UNLOCK_STREAK and not user.get("leaderboard_unlocked"):
        await run_query(supabase_admin.table("users").update(
            {"leaderboard_unlocked": True, "leaderboard_unlocked_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", user_id))
        leaderboard_just_unlocked = True

    milestone_reached = None
    if new_streak in STREAK_MILESTONES:
        milestone_reached = new_streak
        await run_query(supabase_admin.table("milestone_log").insert(
            {
                "user_id": user_id,
                "milestone_type": f"streak_{new_streak}",
                "earned_at": datetime.now(timezone.utc).isoformat(),
            }
        ))

    try:
        from app.services.gap_moment_service import queue_gap_moment

        if new_streak in (7, 14, 21, 30, 60, 90, 150):
            await queue_gap_moment(user_id, "streak_milestone", str(new_streak))
    except Exception:
        pass

    try:
        from app.services.mail_service import check_and_send_streak_milestone, send_app_mail

        await check_and_send_streak_milestone(user_id, new_streak)
        if tier_upgraded and new_tier:
            desc = (STREAK_TIER_REQUIREMENTS.get(new_tier) or {}).get("description") or str(
                new_tier
            )
            await send_app_mail(
                user_id,
                "streak_requirement_update",
                {"requirement_description": desc},
            )
    except Exception:
        pass

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


async def sync_streak_if_lapsed(user_id: str) -> bool:
    """
    Apply streak break when the last streak-earning calendar day is **before yesterday**
    in the user's timezone.

    - Streak is *not* broken at the start of "today" while the user can still complete
      today's missions; it breaks only after a full local day has passed without an update.
    - Safe to call on every app open (idempotent). Also used by the hourly scheduler so
      the DB is not stuck on a stale streak until the next 1am job.
    """
    from app.services.mission_service import get_user_date

    try:
        user_result = await run_query(supabase_admin.table("users")
            .select("last_streak_date, timezone")
            .eq("id", user_id)
            .single())
        user = user_result.data or {}
        last_streak = user.get("last_streak_date")
        if not last_streak:
            return False

        tz = user.get("timezone", "UTC") or "UTC"
        today = get_user_date(tz)
        yesterday = (date.fromisoformat(today) - timedelta(days=1)).isoformat()

        # Lexicographic compare is valid for ISO YYYY-MM-DD
        if str(last_streak) < str(yesterday):
            await handle_streak_break(user_id)
            return True
        return False
    except Exception as e:
        logger.warning("sync_streak_if_lapsed failed user=%s: %s", user_id, str(e)[:200])
        return False


async def handle_streak_break(user_id: str) -> None:
    """
    Called by the midnight cron when a user did not meet their
    streak requirement yesterday.

    Days 1-29 of absence: freeze XP, set pet to sad state
    Day 30+: apply dynamic penalty
    """
    from app.core.constants import STREAK_FREEZE_DAYS
    from app.services.mission_service import get_user_date

    user_result = await run_query(supabase_admin.table("users")
        .select(
            "current_streak, last_streak_date, total_xp, timezone, streak_freeze_count"
        )
        .eq("id", user_id)
        .single())
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

    old_streak = int(user.get("current_streak") or 0)

    # ── Streak freeze: consume one inventory freeze if available ─────────────
    try:
        freeze_count = int(user.get("streak_freeze_count") or 0)
        if freeze_count > 0:
            await run_query(supabase_admin.table("users").update(
                {"streak_freeze_count": freeze_count - 1}
            ).eq("id", user_id))
            logger.info(
                json.dumps(
                    {
                        "event": "streak_freeze_consumed",
                        "user_id": user_id,
                        "freezes_remaining": freeze_count - 1,
                    }
                )
            )
            try:
                from app.services.gap_moment_service import queue_gap_moment

                await queue_gap_moment(user_id, "absence_return", "freeze_used")
            except Exception:
                pass
            return
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "streak_freeze_check_error",
                    "user_id": user_id,
                    "error": str(e)[:200],
                }
            )
        )

    await run_query(supabase_admin.table("users").update({"pet_state": "sad", "current_streak": 0}).eq("id", user_id))

    try:
        from app.services.gap_moment_service import queue_gap_moment

        await queue_gap_moment(user_id, "streak_broken", str(old_streak))
    except Exception:
        pass

    if days_absent <= STREAK_FREEZE_DAYS:
        await run_query(supabase_admin.table("users").update({"xp_frozen": True}).eq("id", user_id))
        return

    total_xp = int(user.get("total_xp") or 0)
    penalty_pct = min(0.30, (days_absent - STREAK_FREEZE_DAYS) * 0.05)
    penalty = int(total_xp * penalty_pct)
    new_xp = max(0, total_xp - penalty)
    await run_query(supabase_admin.table("users").update({"total_xp": new_xp, "xp_frozen": False}).eq("id", user_id))

