"""
Sigil / Aether: surge detection from daily XP cap, aether awards, persistence.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.core.constants import (
    AETHER_ALL_COMPLETE_BONUS,
    AETHER_PER_MISSION,
    DAILY_XP_CAPS,
    SIGIL_LEVEL_NAMES,
    get_sigil_level,
    get_sigil_progress,
)
from app.core.supabase_client import supabase_admin

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def check_and_award_aether(
    user_id: str,
    mission_id: str,
    mission_difficulty: str,
    xp_earned_this_completion: int,
    user_stage: int,
    total_xp_today: int,
    today_str: str,
) -> dict:
    """
    Called after every mission completion (after xp_log reflects this completion).
    """
    result: dict = {
        "aether_awarded": 0,
        "surge_activated": False,
        "surge_active": False,
        "level_up": False,
        "new_level": None,
        "new_level_name": None,
    }

    try:
        daily_cap = int(DAILY_XP_CAPS.get(user_stage, 100))
        xp_before = total_xp_today - xp_earned_this_completion
        surge_just_activated = xp_before < daily_cap and total_xp_today >= daily_cap
        in_surge = total_xp_today >= daily_cap

        sigil_row = (
            supabase_admin.table("sigil_state")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not sigil_row.data:
            supabase_admin.table("sigil_state").insert({"user_id": user_id}).execute()
            sigil_row = (
                supabase_admin.table("sigil_state")
                .select("*")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )

        if not sigil_row.data:
            logger.error("sigil_state missing after insert user=%s", user_id)
            return result

        sigil = sigil_row.data[0]
        surge_was_active = bool(sigil.get("surge_active"))

        # Surge and aether only apply after today's XP meets the daily cap (not stale surge from prior day).
        if not in_surge:
            if surge_was_active:
                supabase_admin.table("sigil_state").update(
                    {"surge_active": False, "updated_at": _now_iso()}
                ).eq("user_id", user_id).execute()
            return result

        if surge_just_activated:
            supabase_admin.table("sigil_state").update(
                {"surge_active": True, "updated_at": _now_iso()}
            ).eq("user_id", user_id).execute()

        result["surge_active"] = True
        result["surge_activated"] = surge_just_activated

        diff = str(mission_difficulty or "easy").lower()
        if diff == "elite":
            diff = "hard"
        aether = int(AETHER_PER_MISSION.get(diff, 15))

        missions_today = (
            supabase_admin.table("missions")
            .select("id, completed")
            .eq("user_id", user_id)
            .eq("mission_date", today_str)
            .execute()
        )
        rows = missions_today.data or []
        all_completed = bool(rows) and all(bool(m.get("completed")) for m in rows)
        if all_completed:
            aether += AETHER_ALL_COMPLETE_BONUS

        new_total = int(sigil.get("total_aether") or 0) + aether
        new_today = int(sigil.get("aether_today") or 0) + aether
        old_level = int(sigil.get("sigil_level") or 1)
        new_level = get_sigil_level(new_total)
        level_name = SIGIL_LEVEL_NAMES[new_level - 1]

        update_payload: dict = {
            "total_aether": new_total,
            "aether_today": new_today,
            "sigil_level": new_level,
            "level_name": level_name,
            "last_aether_date": today_str,
            "updated_at": _now_iso(),
        }
        if new_level > old_level:
            update_payload["last_level_up_at"] = _now_iso()

        supabase_admin.table("sigil_state").update(update_payload).eq("user_id", user_id).execute()

        supabase_admin.table("sigil_aether_log").insert(
            {
                "user_id": user_id,
                "log_date": today_str,
                "aether_earned": aether,
                "source": f"mission_{diff}",
                "mission_id": mission_id,
            }
        ).execute()

        result["aether_awarded"] = aether
        if new_level > old_level:
            result["level_up"] = True
            result["new_level"] = new_level
            result["new_level_name"] = level_name

        return result

    except Exception as e:
        logger.exception("check_and_award_aether failed for %s: %s", user_id, e)
        return result


def ensure_sigil_reflects_today_xp(user_id: str) -> None:
    """
    Clear stale surge / per-day aether before the daily scheduler runs (e.g. new local day, first app open).
    Surge must only show when today's logged XP has reached the daily cap.
    """
    try:
        from app.services.mission_service import get_user_date

        urow = (
            supabase_admin.table("users")
            .select("timezone, character_stage")
            .eq("id", user_id)
            .single()
            .execute()
        )
        tz = str((urow.data or {}).get("timezone") or "UTC").strip() or "UTC"
        today = get_user_date(tz)
        stage = int((urow.data or {}).get("character_stage") or 1)
        cap = int(DAILY_XP_CAPS.get(stage, 100))
        xp_rows = (
            supabase_admin.table("xp_log")
            .select("amount")
            .eq("user_id", user_id)
            .eq("log_date", today)
            .execute()
        )
        xp_today = sum(int(r.get("amount") or 0) for r in (xp_rows.data or []))
        srow = (
            supabase_admin.table("sigil_state")
            .select("surge_active")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not srow.data:
            return
        if xp_today < cap and bool(srow.data[0].get("surge_active")):
            reset_daily_surge(user_id)
    except Exception as e:
        logger.exception("ensure_sigil_reflects_today_xp failed for %s: %s", user_id, e)


def get_sigil_data(user_id: str) -> dict:
    try:
        ensure_sigil_reflects_today_xp(user_id)
        row = (
            supabase_admin.table("sigil_state")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not row.data:
            supabase_admin.table("sigil_state").insert({"user_id": user_id}).execute()
            row = (
                supabase_admin.table("sigil_state")
                .select("*")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )

        if not row.data:
            raise RuntimeError("sigil_state row missing")

        sigil = row.data[0]
        history = (
            supabase_admin.table("sigil_aether_log")
            .select("log_date, aether_earned")
            .eq("user_id", user_id)
            .order("log_date", desc=True)
            .limit(30)
            .execute()
        )
        aether_history = [
            {"date": str(r["log_date"]), "aether": int(r.get("aether_earned") or 0)}
            for r in (history.data or [])
        ]

        total = int(sigil.get("total_aether") or 0)
        prog = get_sigil_progress(total)

        return {
            "sigil_level": int(sigil.get("sigil_level") or prog["level"]),
            "level_name": str(sigil.get("level_name") or prog["name"]),
            "total_aether": total,
            "aether_today": int(sigil.get("aether_today") or 0),
            "surge_active": bool(sigil.get("surge_active")),
            # True once the user has earned any Aether (first Surge ever completed).
            # Drives the dormant vs active sigil screen on the frontend.
            "has_ever_surged": total > 0,
            "progress": prog,
            "aether_history": aether_history,
        }
    except Exception as e:
        logger.exception("get_sigil_data failed for %s: %s", user_id, e)
        return {
            "sigil_level": 1,
            "level_name": "The Ember",
            "total_aether": 0,
            "aether_today": 0,
            "surge_active": False,
            "has_ever_surged": False,
            "progress": get_sigil_progress(0),
            "aether_history": [],
        }


def reset_daily_surge(user_id: str) -> None:
    try:
        supabase_admin.table("sigil_state").update(
            {
                "surge_active": False,
                "aether_today": 0,
                "updated_at": _now_iso(),
            }
        ).eq("user_id", user_id).execute()
    except Exception as e:
        logger.exception("reset_daily_surge failed for %s: %s", user_id, e)
