"""
Aether Sigil — missions completed after the daily XP cap earn Aether (Surge State).
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

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


def _normalize_difficulty(raw: str | None) -> str:
    d = (raw or "easy").strip().lower()
    if d == "elite":
        return "hard"
    return d if d in AETHER_PER_MISSION else "easy"


def _fetch_sigil_row(user_id: str) -> dict | None:
    res = (
        supabase_admin.table("sigil_state")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None


def _ensure_sigil_row(user_id: str) -> dict:
    row = _fetch_sigil_row(user_id)
    if row:
        return row
    supabase_admin.table("sigil_state").insert({"user_id": user_id}).execute()
    row = _fetch_sigil_row(user_id)
    if not row:
        raise RuntimeError("sigil_state insert failed")
    return row


async def check_and_award_aether(
    user_id: str,
    mission_id: str,
    mission_difficulty: str,
    xp_today_before: int,
    xp_earned_this_mission: int,
    user_character_stage: int,
    today: str,
) -> dict:
    """
    Called after XP is logged for this completion. Awards Aether only if the user was
    already at/over the daily XP cap *before* this mission's XP (true overflow completions).
    """
    sigil = _ensure_sigil_row(user_id)

    if str(sigil.get("last_aether_date") or "") != today:
        supabase_admin.table("sigil_state").update(
            {
                "aether_today": 0,
                "surge_active": False,
                "last_aether_date": today,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("user_id", user_id).execute()
        sigil = _fetch_sigil_row(user_id) or sigil
        sigil["aether_today"] = 0
        sigil["surge_active"] = False

    daily_cap = int(DAILY_XP_CAPS.get(int(user_character_stage), 100))
    xp_after = int(xp_today_before) + int(xp_earned_this_mission)
    at_or_past_cap_after = xp_after >= daily_cap
    was_past_cap_before = int(xp_today_before) >= daily_cap

    surge_just_activated = at_or_past_cap_after and int(xp_today_before) < daily_cap <= xp_after

    missions_today = (
        supabase_admin.table("missions")
        .select("id, completed")
        .eq("user_id", user_id)
        .eq("mission_date", today)
        .execute()
        .data
        or []
    )
    all_complete = len(missions_today) > 0 and all(m.get("completed") for m in missions_today)

    diff_key = _normalize_difficulty(mission_difficulty)
    aether_for_mission = (
        int(sigil.get(f"aether_per_{diff_key}") or AETHER_PER_MISSION.get(diff_key, AETHER_PER_MISSION["easy"]))
        if was_past_cap_before
        else 0
    )

    bonus_aether = 0
    if all_complete and at_or_past_cap_after:
        existing_bonus = (
            supabase_admin.table("sigil_aether_log")
            .select("id")
            .eq("user_id", user_id)
            .eq("log_date", today)
            .eq("source", "all_complete_bonus")
            .limit(1)
            .execute()
        )
        if not (existing_bonus.data or []):
            bonus_aether = int(sigil.get("aether_surge_bonus") or AETHER_ALL_COMPLETE_BONUS)

    total_aether_gain = aether_for_mission + bonus_aether

    if total_aether_gain == 0:
        now = datetime.now(timezone.utc).isoformat()
        supabase_admin.table("sigil_state").update(
            {
                "surge_active": at_or_past_cap_after,
                "updated_at": now,
            }
        ).eq("user_id", user_id).execute()
        return {
            "aether_awarded": 0,
            "surge_activated": bool(surge_just_activated),
            "surge_active": bool(at_or_past_cap_after),
            "level_up": False,
            "new_level": None,
            "new_level_name": None,
            "total_aether": int(sigil.get("total_aether") or 0),
        }
    old_total = int(sigil.get("total_aether") or 0)
    old_level = get_sigil_level(old_total)
    new_total_aether = old_total + total_aether_gain
    new_level = get_sigil_level(new_total_aether)
    level_up = new_level > old_level
    new_level_name = SIGIL_LEVEL_NAMES[new_level - 1] if level_up else None

    now = datetime.now(timezone.utc).isoformat()
    update = {
        "total_aether": new_total_aether,
        "aether_today": int(sigil.get("aether_today") or 0) + total_aether_gain,
        "surge_active": True,
        "sigil_level": new_level,
        "level_name": SIGIL_LEVEL_NAMES[new_level - 1],
        "updated_at": now,
    }
    if level_up:
        update["last_level_up_at"] = now

    supabase_admin.table("sigil_state").update(update).eq("user_id", user_id).execute()

    log_rows: list[dict] = []
    if aether_for_mission > 0:
        log_rows.append(
            {
                "user_id": user_id,
                "log_date": today,
                "aether_earned": aether_for_mission,
                "source": f"mission_{diff_key}",
                "mission_id": mission_id,
            }
        )
    if bonus_aether > 0:
        log_rows.append(
            {
                "user_id": user_id,
                "log_date": today,
                "aether_earned": bonus_aether,
                "source": "all_complete_bonus",
                "mission_id": mission_id,
            }
        )
    if log_rows:
        supabase_admin.table("sigil_aether_log").insert(log_rows).execute()

    logger.info(
        "Aether +%s for user %s (mission %s, bonus %s) total=%s level=%s",
        total_aether_gain,
        user_id,
        aether_for_mission,
        bonus_aether,
        new_total_aether,
        new_level,
    )

    return {
        "aether_awarded": total_aether_gain,
        "surge_activated": bool(surge_just_activated),
        "surge_active": True,
        "level_up": level_up,
        "new_level": new_level if level_up else None,
        "new_level_name": new_level_name,
        "total_aether": new_total_aether,
    }


async def get_sigil_data(user_id: str) -> dict:
    row = _fetch_sigil_row(user_id)
    if not row:
        return {
            "sigil_level": 1,
            "level_name": "The Ember",
            "total_aether": 0,
            "aether_today": 0,
            "surge_active": False,
            "progress": get_sigil_progress(0),
            "aether_history": [],
        }

    total = int(row.get("total_aether") or 0)
    progress = get_sigil_progress(total)

    thirty_days_ago = (date.today() - timedelta(days=30)).isoformat()
    history = (
        supabase_admin.table("sigil_aether_log")
        .select("log_date, aether_earned")
        .eq("user_id", user_id)
        .gte("log_date", thirty_days_ago)
        .order("log_date")
        .execute()
        .data
        or []
    )

    daily: defaultdict[str, int] = defaultdict(int)
    for r in history:
        d = str(r.get("log_date") or "")
        daily[d] += int(r.get("aether_earned") or 0)
    aether_history = [{"date": k, "aether": v} for k, v in sorted(daily.items())]

    return {
        "sigil_level": int(row.get("sigil_level") or progress["level"]),
        "level_name": row.get("level_name") or progress["name"],
        "total_aether": total,
        "aether_today": int(row.get("aether_today") or 0),
        "surge_active": bool(row.get("surge_active")),
        "progress": progress,
        "aether_history": aether_history,
    }


async def reset_daily_surge(user_id: str, local_today: str) -> None:
    """Reset daily Surge / aether_today counters at the start of a new local day (cron)."""
    now = datetime.now(timezone.utc).isoformat()
    supabase_admin.table("sigil_state").update(
        {
            "aether_today": 0,
            "surge_active": False,
            "last_aether_date": local_today,
            "updated_at": now,
        }
    ).eq("user_id", user_id).execute()
