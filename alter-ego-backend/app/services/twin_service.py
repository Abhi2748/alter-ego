"""
Twin Daily Simulation — Archetype Rhythm Model

The twin is not a pacemaker that runs at a fixed percentage ahead.
It is a rival with its own personality, its own good days and bad days.

Each archetype has a natural completion rhythm. The twin's daily rate
is drawn from this rhythm with gaussian variance — making it feel alive
and unpredictable, just like a real human competitor.

The user can genuinely pull ahead through consistent effort.
The twin naturally falls back when the user stops being a threat.
No artificial rubber-banding. The gap is earned in both directions.
"""

from __future__ import annotations

import logging
import random
from datetime import datetime

from app.core.supabase_client import supabase_admin

logger = logging.getLogger(__name__)

# Two-phase crossing recovery system
CROSSING_RECOVERY_DAYS = 6        # Phase 1: boost lasts 6 days after user crosses twin
CROSSING_RECOVERY_BOOST = 0.08    # Phase 1: +0.08 added to daily rate
DORMANT_GAP_TRIGGER_DAYS = 14     # Phase 2: activates after user leads for 14+ days
DORMANT_GAP_OFFSET = 0.05         # Phase 2: twin runs at user_7d_avg + this value

# Archetype rhythm profiles
ARCHETYPE_RHYTHMS = {
    "structured_climber": {
        "base_rate": 0.82,
        "variance": 0.07,
        "weekday_boost": 0.05,
        "weekend_penalty": 0.05,
    },
    "restless_creator": {
        "base_rate": 0.72,
        "variance": 0.18,
        "weekday_boost": 0.0,
        "weekend_penalty": 0.0,
    },
    "lone_wolf": {
        "base_rate": 0.78,
        "variance": 0.06,
        "weekday_boost": 0.0,
        "weekend_penalty": 0.0,
    },
    "reluctant_achiever": {
        "base_rate": 0.70,
        "variance": 0.15,
        "weekday_boost": 0.0,
        "weekend_penalty": 0.08,
    },
    "social_performer": {
        "base_rate": 0.75,
        "variance": 0.13,
        "weekday_boost": 0.06,
        "weekend_penalty": 0.05,
    },
}

DEFAULT_RHYTHM = {
    "base_rate": 0.75,
    "variance": 0.10,
    "weekday_boost": 0.0,
    "weekend_penalty": 0.0,
}


def get_twin_daily_rate(archetype: str, day_of_week: int, base_completion_rate: float) -> float:
    """
    Calculates the twin's completion rate for today.

    base_completion_rate is the long-term evolving rate stored in twin_state.
    The archetype rhythm modifies it with day-of-week and variance.

    Returns a float between 0.45 and 0.95.
    """
    rhythm = ARCHETYPE_RHYTHMS.get(archetype, DEFAULT_RHYTHM)

    archetype_base = rhythm["base_rate"]
    effective_base = (base_completion_rate + archetype_base) / 2

    is_weekday = day_of_week <= 5
    if is_weekday:
        effective_base += rhythm["weekday_boost"]
    else:
        effective_base -= rhythm["weekend_penalty"]

    daily_variance = random.gauss(0, rhythm["variance"])
    rate = effective_base + daily_variance

    return round(max(0.45, min(0.95, rate)), 3)


def recalibrate_twin_base_rate(current_base_rate: float, user_completion_rate_recent: float) -> float:
    """
    Called by the twin recalibration job (first on day 7, then every 7 days).
    Shifts the twin's base_completion_rate slightly based on recent user performance.
    """
    shift = 0.0
    if user_completion_rate_recent > 85:
        shift = 0.03
    elif user_completion_rate_recent < 50:
        shift = -0.03

    new_rate = current_base_rate + shift
    return round(max(0.60, min(0.90, new_rate)), 3)


async def simulate_twin_day(user_id: str) -> dict:
    """
    Simulates the twin's day for a given user.
    Called nightly by the cron job at 01:00 UTC.
    """
    from zoneinfo import ZoneInfo

    from app.core.constants import (
        DAILY_PF_CAPS,
        DAILY_XP_CAPS,
        GAP_THRESHOLDS,
        PET_UNLOCK_DAY,
        PF_THRESHOLDS,
        TOTAL_CHARACTER_STAGES,
        TOTAL_PET_STAGES,
        XP_THRESHOLDS,
    )
    from app.services.mission_service import get_days_since_registration, get_user_date

    user_result = (
        supabase_admin.table("users")
        .select(
            "total_xp, total_pf, character_stage, pet_stage, "
            "pet_unlocked, timezone, archetype, registration_date"
        )
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = user_result.data

    twin_result = supabase_admin.table("twin_state").select("*").eq("user_id", user_id).single().execute()
    twin = twin_result.data

    if not user or not twin:
        return {"simulated": False, "reason": "missing_state"}

    timezone_str = user.get("timezone", "UTC") or "UTC"
    today = get_user_date(timezone_str)

    tz = ZoneInfo(timezone_str)
    day_of_week = datetime.now(tz).isoweekday()

    missions_result = (
        supabase_admin.table("missions")
        .select("id, type, difficulty, xp_value, pf_value, title, is_journal_mission")
        .eq("user_id", user_id)
        .eq("mission_date", today)
        .execute()
    )
    today_missions = missions_result.data or []
    if not today_missions:
        # Local batch jobs may run in any order at 1:00; ensure today's rows exist before simulating.
        from app.services.mission_service import generate_core_missions_for_user, sync_today_planner_missions

        await generate_core_missions_for_user(user_id, today)
        await sync_today_planner_missions(user_id, today)
        missions_result = (
            supabase_admin.table("missions")
            .select("id, type, difficulty, xp_value, pf_value, title, is_journal_mission")
            .eq("user_id", user_id)
            .eq("mission_date", today)
            .execute()
        )
        today_missions = missions_result.data or []
    if not today_missions:
        return {"simulated": False, "reason": "no_missions_today"}

    archetype = user.get("archetype", "structured_climber")
    fallback_base = ARCHETYPE_RHYTHMS.get(archetype, DEFAULT_RHYTHM)["base_rate"]
    base_rate = float(twin.get("consistency_ceiling", fallback_base) or fallback_base)

    today_rate = get_twin_daily_rate(archetype, day_of_week, base_rate)

    # ── Two-phase crossing recovery ──────────────────────────────────────────
    from datetime import date as date_type, timedelta

    today_date = date_type.fromisoformat(today)
    last_passed_at = twin.get("last_passed_at")
    user_is_currently_ahead = int(user.get("total_xp", 0) or 0) > int(twin.get("twin_xp", 0) or 0)

    if last_passed_at and user_is_currently_ahead:
        try:
            last_passed_date = date_type.fromisoformat(str(last_passed_at)[:10])
            days_since_crossed = (today_date - last_passed_date).days
        except Exception:
            days_since_crossed = None

        if days_since_crossed is not None:
            if days_since_crossed <= CROSSING_RECOVERY_DAYS:
                today_rate = min(0.95, today_rate + CROSSING_RECOVERY_BOOST)
                logger.debug(
                    "simulate_twin_day: Phase 1 recovery active for user=%s day=%s/%s boosted_rate=%.3f",
                    user_id,
                    days_since_crossed,
                    CROSSING_RECOVERY_DAYS,
                    today_rate,
                )
            elif days_since_crossed > DORMANT_GAP_TRIGGER_DAYS:
                from app.core.supabase_client import supabase_admin as _sb

                seven_days_ago = str(today_date - timedelta(days=7))
                user_streak_rows = (
                    _sb.table("streak_log")
                    .select("total_missions_done, total_missions")
                    .eq("user_id", user_id)
                    .gte("log_date", seven_days_ago)
                    .execute()
                    .data
                    or []
                )

                if user_streak_rows:
                    total_done = sum(int(r.get("total_missions_done") or 0) for r in user_streak_rows)
                    total_possible = sum(int(r.get("total_missions") or 0) for r in user_streak_rows)
                    user_7d_avg = (total_done / total_possible) if total_possible > 0 else 0.70
                else:
                    user_7d_avg = 0.70

                phase2_rate = min(0.95, user_7d_avg + DORMANT_GAP_OFFSET)
                today_rate = max(today_rate, phase2_rate)

                logger.debug(
                    "simulate_twin_day: Phase 2 dormant gap active for user=%s days_ahead=%s "
                    "user_7d_avg=%.2f phase2_rate=%.3f final_rate=%.3f",
                    user_id,
                    days_since_crossed,
                    user_7d_avg,
                    phase2_rate,
                    today_rate,
                )

    # ── End of two-phase crossing recovery ───────────────────────────────────

    core_missions = [m for m in today_missions if m.get("type") == "core" and not m.get("is_journal_mission")]
    non_core_missions = [m for m in today_missions if m not in core_missions]

    core_rate = min(0.97, today_rate + 0.10)
    core_target = round(len(core_missions) * core_rate)
    non_core_target = round(len(non_core_missions) * today_rate)

    if non_core_target > 0 and random.random() < 0.30:
        non_core_target = max(0, non_core_target - 1)

    completed_core = core_missions[:core_target]
    completed_non_core = non_core_missions[:non_core_target]
    all_completed = completed_core + completed_non_core
    all_missed = [m for m in today_missions if m not in all_completed]

    twin_stage = int(twin.get("twin_character_stage") or 1)
    xp_cap = int(DAILY_XP_CAPS.get(twin_stage, 200))
    pf_cap = int(DAILY_PF_CAPS.get(twin_stage, 160))

    raw_xp_earned = sum(int(m.get("xp_value") or 0) for m in all_completed)
    raw_pf_earned = sum(int(m.get("pf_value") or 0) for m in all_completed)

    xp_earned = min(xp_cap, raw_xp_earned)
    pf_earned = min(pf_cap, raw_pf_earned)

    logger.debug(
        "simulate_twin_day debug: user_id=%s today_rate=%.3f total_missions=%s "
        "core_target=%s non_core_target=%s xp_earned=%s daily_cap_applied=%s",
        user_id,
        today_rate,
        len(today_missions),
        core_target,
        non_core_target,
        xp_earned,
        xp_cap,
    )

    new_twin_xp = int(twin.get("twin_xp") or 0) + xp_earned
    new_twin_pf = int(twin.get("twin_pf") or 0) + pf_earned

    new_twin_stage = twin_stage
    if twin_stage < TOTAL_CHARACTER_STAGES and new_twin_xp >= XP_THRESHOLDS[twin_stage]:
        new_twin_stage = twin_stage + 1

    twin_pet_stage = int(twin.get("twin_pet_stage") or 0)
    twin_pet_unlocked = bool(twin.get("twin_pet_unlocked"))
    new_twin_pet_stage = twin_pet_stage

    days_since_reg = get_days_since_registration(user.get("registration_date", ""), timezone_str)
    if days_since_reg >= PET_UNLOCK_DAY and not twin_pet_unlocked:
        twin_pet_unlocked = True
        new_twin_pet_stage = 1

    if twin_pet_unlocked and twin_pet_stage < TOTAL_PET_STAGES and new_twin_pf >= PF_THRESHOLDS[twin_pet_stage]:
        new_twin_pet_stage = twin_pet_stage + 1

    user_xp = int(user.get("total_xp") or 0)
    user_passed_twin = user_xp > new_twin_xp
    if user_passed_twin:
        gap_state = "user_ahead"
    else:
        gap_xp = new_twin_xp - user_xp
        gap_pct = gap_xp / max(user_xp, 1)
        if gap_pct <= GAP_THRESHOLDS["neck_and_neck"]:
            gap_state = "neck_and_neck"
        elif gap_pct <= GAP_THRESHOLDS["slightly_behind"]:
            gap_state = "slightly_behind"
        else:
            gap_state = "significantly_behind"

    supabase_admin.table("twin_daily_record").upsert(
        {
            "user_id": user_id,
            "record_date": today,
            "missions_assigned": len(today_missions),
            "missions_completed": len(all_completed),
            "completed_mission_ids": [m["id"] for m in all_completed],
            "missed_mission_titles": [m["title"] for m in all_missed],
            "xp_earned": xp_earned,
            "pf_earned": pf_earned,
            "consistency_ceiling_used": today_rate,
        },
        on_conflict="user_id,record_date",
    ).execute()

    twin_update = {
        "twin_xp": new_twin_xp,
        "twin_pf": new_twin_pf,
        "twin_character_stage": new_twin_stage,
        "twin_pet_stage": new_twin_pet_stage,
        "twin_pet_unlocked": twin_pet_unlocked,
        "twin_streak": int(twin.get("twin_streak") or 0)
        + (1 if len([m for m in completed_core if m.get("completed")]) >= 3 else 0),
        "current_gap_state": gap_state,
    }
    if user_passed_twin:
        twin_update["last_passed_at"] = datetime.utcnow().isoformat()

    supabase_admin.table("twin_state").update(twin_update).eq("user_id", user_id).execute()

    logger.debug(
        "simulate_twin_day: user=%s rate=%.2f completed=%s/%s xp=%s gap=%s",
        user_id,
        today_rate,
        len(all_completed),
        len(today_missions),
        xp_earned,
        gap_state,
    )

    return {
        "simulated": True,
        "today_rate": today_rate,
        "xp_earned": xp_earned,
        "pf_earned": pf_earned,
        "missions_completed": len(all_completed),
        "missions_total": len(today_missions),
        "gap_state": gap_state,
        "user_passed_twin": user_passed_twin,
    }


async def get_home_strip_context(user_id: str) -> dict:
    """
    Returns twin strip data for the home screen.
    Used by B26 to determine which strip message to show.
    """
    twin_result = (
        supabase_admin.table("twin_state")
        .select(
            "twin_xp, twin_character_stage, twin_pet_stage, "
            "current_gap_state, strip_message, last_strip_updated, "
            "twin_pet_unlocked"
        )
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    user_result = (
        supabase_admin.table("users")
        .select("total_xp, character_stage, current_streak")
        .eq("id", user_id)
        .single()
        .execute()
    )

    if not twin_result.data:
        return {"has_twin": False}

    twin = twin_result.data
    user = user_result.data or {}
    gap_xp = int(twin.get("twin_xp") or 0) - int(user.get("total_xp") or 0)

    return {
        "has_twin": True,
        "gap_state": twin.get("current_gap_state", "neck_and_neck"),
        "gap_xp": abs(gap_xp),
        "user_is_ahead": gap_xp < 0,
        "twin_stage": twin.get("twin_character_stage", 1),
        "twin_pet_stage": twin.get("twin_pet_stage", 0),
        "twin_pet_unlocked": twin.get("twin_pet_unlocked", False),
        "strip_message": twin.get("strip_message"),
        "last_updated": twin.get("last_strip_updated"),
    }


async def recalibrate_twin(user_id: str) -> dict:
    """
    First run on day 7 (after archetype-led period), then every 7 days.
    Updates discipline_dna parameters and twin base rate based on behaviour.
    """
    from datetime import date as date_type, timedelta

    from app.core.constants import TWIN_RECALIBRATION_INTERVAL_DAYS

    user_result = (
        supabase_admin.table("users")
        .select("total_xp, character_stage, current_streak, registration_date, timezone")
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = user_result.data or {}

    dna_result = (
        supabase_admin.table("discipline_dna").select("*").eq("user_id", user_id).single().execute()
    )
    dna = dna_result.data or {}

    twin_result = (
        supabase_admin.table("twin_state")
        .select("consistency_ceiling, last_passed_at, current_gap_state, twin_xp")
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    twin = twin_result.data or {}

    today = date_type.today()
    lookback = TWIN_RECALIBRATION_INTERVAL_DAYS
    window_start = str(today - timedelta(days=lookback))
    thirty_days_ago = str(today - timedelta(days=30))

    streak_rows = (
        supabase_admin.table("streak_log")
        .select("total_missions_done, total_missions")
        .eq("user_id", user_id)
        .gte("log_date", window_start)
        .execute()
        .data
        or []
    )

    total_done = sum(int(r.get("total_missions_done") or 0) for r in streak_rows)
    total_possible = sum(int(r.get("total_missions") or 0) for r in streak_rows)
    completion_rate_recent = (total_done / total_possible * 100) if total_possible > 0 else 0.0

    streak_rows_30 = (
        supabase_admin.table("streak_log")
        .select("total_missions_done, total_missions")
        .eq("user_id", user_id)
        .gte("log_date", thirty_days_ago)
        .execute()
        .data
        or []
    )
    done_30 = sum(int(r.get("total_missions_done") or 0) for r in streak_rows_30)
    poss_30 = sum(int(r.get("total_missions") or 0) for r in streak_rows_30)
    completion_rate_30d = (done_30 / poss_30 * 100) if poss_30 > 0 else 0.0

    chat_count = (
        supabase_admin.table("twin_messages")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("role", "user")
        .gte("created_at", datetime.utcnow() - timedelta(days=lookback))
        .execute()
        .count
        or 0
    )

    if chat_count >= 10:
        chat_engagement = "high"
    elif chat_count >= 3:
        chat_engagement = "medium"
    else:
        chat_engagement = "none"

    activity_events = (
        supabase_admin.table("event_log")
        .select("properties")
        .eq("user_id", user_id)
        .eq("event_name", "app_opened")
        .gte("logged_at", datetime.utcnow() - timedelta(days=lookback))
        .execute()
        .data
        or []
    )

    activity_hour = None
    if activity_events:
        from collections import Counter

        hours = []
        for e in activity_events:
            props = e.get("properties") or {}
            if "hour" in props:
                hours.append(props["hour"])
        if hours:
            activity_hour = Counter(hours).most_common(1)[0][0]

    gap_state = twin.get("current_gap_state", "neck_and_neck")
    user_is_ahead = int(user.get("total_xp") or 0) > int(twin.get("twin_xp") or 0)

    if user_is_ahead:
        gap_response = "motivated_by_gap" if completion_rate_recent > 75 else "indifferent_to_gap"
    elif gap_state == "significantly_behind":
        gap_response = "motivated_by_gap" if completion_rate_recent > 70 else "discouraged_by_gap"
    else:
        gap_response = "indifferent_to_gap"

    current_intensity = int(dna.get("twin_intensity") or 3)
    current_tone = dna.get("twin_tone_type", "rival")
    current_gap_behavior = dna.get("twin_gap_behavior", "rubber_band")
    current_frequency = dna.get("twin_message_frequency", "medium")

    updates: dict = {}

    if completion_rate_recent > 85 and current_intensity < 5:
        updates["twin_intensity"] = min(5, current_intensity + 1)
    elif completion_rate_recent < 45 and current_intensity > 1:
        updates["twin_intensity"] = max(1, current_intensity - 1)

    if gap_response == "motivated_by_gap":
        updates["twin_gap_behavior"] = "chase"
    elif gap_response == "discouraged_by_gap":
        updates["twin_gap_behavior"] = "rubber_band"
    elif gap_response == "indifferent_to_gap":
        updates["twin_gap_behavior"] = "steady"

    if chat_engagement == "high":
        updates["twin_message_frequency"] = "high"
    elif chat_engagement == "none" and current_frequency == "high":
        updates["twin_message_frequency"] = "medium"

    if activity_hour is not None:
        updates["activity_time_of_day"] = activity_hour

    updates["completion_rate_7d"] = round(completion_rate_recent, 2)
    updates["completion_rate_30d"] = round(completion_rate_30d, 2)
    updates["twin_chat_engagement"] = chat_engagement
    updates["gap_response_pattern"] = gap_response
    updates["last_calibration_at"] = datetime.utcnow().isoformat()
    updates["calibration_count"] = int(dna.get("calibration_count") or 0) + 1

    supabase_admin.table("discipline_dna").update(updates).eq("user_id", user_id).execute()

    current_base = float(twin.get("consistency_ceiling", 0.75))
    new_base = recalibrate_twin_base_rate(current_base, completion_rate_recent)
    if new_base != current_base:
        supabase_admin.table("twin_state").update({"consistency_ceiling": new_base}).eq("user_id", user_id).execute()

    return {
        "recalibrated": True,
        "calibration_count": updates["calibration_count"],
        "completion_rate_7d": round(completion_rate_recent, 1),
        "completion_rate_30d": round(completion_rate_30d, 1),
        "gap_response": gap_response,
        "chat_engagement": chat_engagement,
        "changes": {
            k: v
            for k, v in updates.items()
            if k in {"twin_intensity", "twin_gap_behavior", "twin_message_frequency", "twin_tone_type"}
        },
    }

