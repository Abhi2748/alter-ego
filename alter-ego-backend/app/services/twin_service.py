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

import json
import logging
import random
from datetime import datetime, timedelta, date as date_type, timezone
from zoneinfo import ZoneInfo

from app.core.supabase_client import supabase_admin

logger = logging.getLogger(__name__)

# Twin “morning person” hours for simulated completion timestamps (6–12 bias).
_TWIN_LOG_MORNING_HOURS = (6, 7, 8, 9, 9, 10, 10, 11, 11, 12)


async def record_twin_mission_log_from_daily_record(
    user_id: str,
    today: str,
    completed_mission_ids: list,
    timezone_str: str,
) -> None:
    """
    After twin_daily_record is written, resolve completed_mission_ids against `missions`
    and upsert twin_mission_log (per-title rows). Does not change simulation math.
    Silent on error — never blocks Twin simulation.
    """
    try:
        tz_name = (timezone_str or "UTC").strip() or "UTC"
        try:
            tz = ZoneInfo(tz_name)
        except Exception:
            tz = ZoneInfo("UTC")

        id_list = [str(x) for x in (completed_mission_ids or []) if x is not None]
        supabase_admin.table("twin_mission_log").delete().eq("user_id", user_id).eq("mission_date", today).execute()

        if not id_list:
            logger.info(
                json.dumps(
                    {
                        "event": "twin_mission_log_recorded",
                        "user_id": user_id,
                        "date": today,
                        "count": 0,
                    }
                )
            )
            return

        mres = (
            supabase_admin.table("missions")
            .select("id, title, type, core_pillar")
            .eq("user_id", user_id)
            .in_("id", id_list)
            .execute()
        )
        by_id = {str(r.get("id")): r for r in (mres.data or []) if r.get("id")}

        d = date_type.fromisoformat(today)
        rows: list[dict] = []
        for i, mid in enumerate(id_list):
            r = by_id.get(str(mid))
            if not r:
                continue
            title = (r.get("title") or "").strip()
            if not title:
                continue
            simulated_hour = _TWIN_LOG_MORNING_HOURS[i % len(_TWIN_LOG_MORNING_HOURS)]
            local_dt = datetime(d.year, d.month, d.day, simulated_hour, 0, 0, tzinfo=tz)
            completed_at = local_dt.astimezone(timezone.utc).isoformat()
            mt = r.get("type") or "core"
            mt = str(mt).lower() if mt else "core"

            rows.append(
                {
                    "user_id": user_id,
                    "mission_date": today,
                    "mission_title": title,
                    "core_pillar": r.get("core_pillar"),
                    "mission_type": mt,
                    "simulated_hour": simulated_hour,
                    "completed_at": completed_at,
                }
            )

        if rows:
            supabase_admin.table("twin_mission_log").upsert(
                rows,
                on_conflict="user_id,mission_date,mission_title",
            ).execute()

        logger.info(
            json.dumps(
                {
                    "event": "twin_mission_log_recorded",
                    "user_id": user_id,
                    "date": today,
                    "count": len(rows),
                }
            )
        )
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "twin_mission_log_error",
                    "user_id": user_id,
                    "date": today,
                    "error": str(e),
                }
            )
        )

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
    try:
        return await _simulate_twin_day_impl(user_id)
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "twin_simulation_error",
                    "user_id": user_id,
                    "error": str(e)[:200],
                }
            )
        )
        return {"simulated": False, "reason": "error"}


async def _simulate_twin_day_impl(user_id: str) -> dict:
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
            "pet_unlocked, timezone, archetype, registration_date, streak_requirement_tier"
        )
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = user_result.data

    twin_result = supabase_admin.table("twin_state").select("*").eq("user_id", user_id).single().execute()
    twin = twin_result.data

    if not user or not twin:
        logger.info(
            json.dumps(
                {
                    "event": "twin_simulation_skipped",
                    "user_id": user_id,
                    "reason": "missing_state",
                    "date": None,
                }
            )
        )
        return {"simulated": False, "reason": "missing_state"}

    timezone_str = user.get("timezone", "UTC") or "UTC"
    today = get_user_date(timezone_str)

    # One simulation per user per calendar day (twin XP must not double-apply).
    existing_day = (
        supabase_admin.table("twin_daily_record")
        .select("id")
        .eq("user_id", user_id)
        .eq("record_date", today)
        .limit(1)
        .execute()
    )
    if existing_day.data:
        logger.info(
            json.dumps(
                {
                    "event": "twin_simulation_skipped",
                    "user_id": user_id,
                    "reason": "already_simulated_today",
                    "date": today,
                }
            )
        )
        return {"simulated": False, "reason": "already_simulated_today"}

    tz = ZoneInfo(timezone_str)
    day_of_week = datetime.now(tz).isoweekday()

    missions_result = (
        supabase_admin.table("missions")
        .select("id, type, difficulty, xp_value, pf_value, title, is_journal_mission, completed")
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
        logger.info(
            json.dumps(
                {
                    "event": "twin_simulation_skipped",
                    "user_id": user_id,
                    "reason": "no_missions_today",
                    "date": today,
                }
            )
        )
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

    personal_ms = [m for m in non_core_missions if m.get("type") == "personal"]
    rest_nc = [m for m in non_core_missions if m.get("type") != "personal"]

    core_rate = min(0.97, today_rate + 0.10)
    core_target = round(len(core_missions) * core_rate)
    non_core_target = round(len(non_core_missions) * today_rate)
    non_core_target = min(len(non_core_missions), max(0, non_core_target))

    if non_core_target > 0 and random.random() < 0.30:
        non_core_target = max(0, non_core_target - 1)

    completed_core = core_missions[:core_target]

    nc_total = len(non_core_missions)
    if nc_total > 0 and non_core_target > 0:
        p_cap = len(personal_ms)
        p_take = min(p_cap, max(0, round(non_core_target * p_cap / nc_total))) if p_cap else 0
        rem = min(len(rest_nc), max(0, non_core_target - p_take))
        completed_non_core = personal_ms[:p_take] + rest_nc[:rem]
    else:
        completed_non_core = []

    all_completed = completed_core + completed_non_core
    all_missed = [m for m in today_missions if m not in all_completed]

    twin_stage = int(twin.get("twin_character_stage") or 1)
    xp_cap = int(DAILY_XP_CAPS.get(twin_stage, 100))
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

    await record_twin_mission_log_from_daily_record(
        user_id,
        today,
        [m["id"] for m in all_completed],
        timezone_str,
    )

    from app.services.streak_service import evaluate_streak_requirement

    done_ids = {str(m.get("id")) for m in all_completed}
    twin_view_today = []
    for m in today_missions:
        mm = dict(m)
        mm["completed"] = str(m.get("id")) in done_ids
        twin_view_today.append(mm)

    streak_tier = user.get("streak_requirement_tier") or "tier_1"
    today_met = evaluate_streak_requirement(twin_view_today, streak_tier)

    yesterday = str(today_date - timedelta(days=1))
    y_missions_res = (
        supabase_admin.table("missions")
        .select("id, type, is_journal_mission, completed")
        .eq("user_id", user_id)
        .eq("mission_date", yesterday)
        .execute()
    )
    y_missions = y_missions_res.data or []
    y_rec_res = (
        supabase_admin.table("twin_daily_record")
        .select("completed_mission_ids")
        .eq("user_id", user_id)
        .eq("record_date", yesterday)
        .limit(1)
        .execute()
    )
    y_rows = y_rec_res.data or []
    yesterday_met = False
    if y_missions and y_rows:
        y_ids_raw = y_rows[0].get("completed_mission_ids") or []
        y_done = {str(x) for x in y_ids_raw}
        y_view = []
        for m in y_missions:
            mm = dict(m)
            mm["completed"] = str(m.get("id")) in y_done
            y_view.append(mm)
        yesterday_met = evaluate_streak_requirement(y_view, streak_tier)

    prev_twin_streak = int(twin.get("twin_streak") or 0)
    if not today_met:
        new_twin_streak = 0
    elif yesterday_met:
        new_twin_streak = prev_twin_streak + 1
    else:
        new_twin_streak = 1

    twin_update = {
        "twin_xp": new_twin_xp,
        "twin_pf": new_twin_pf,
        "twin_character_stage": new_twin_stage,
        "twin_pet_stage": new_twin_pet_stage,
        "twin_pet_unlocked": twin_pet_unlocked,
        "twin_streak": new_twin_streak,
        "current_gap_state": gap_state,
    }
    if user_passed_twin:
        twin_update["last_passed_at"] = datetime.utcnow().isoformat()

    supabase_admin.table("twin_state").update(twin_update).eq("user_id", user_id).execute()

    logger.info(
        json.dumps(
            {
                "event": "twin_simulated",
                "user_id": user_id,
                "date": today,
                "missions_completed": len(all_completed),
                "xp_earned": xp_earned,
                "rate": round(float(today_rate), 4),
            }
        )
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


async def ensure_twin_simulated_for_today(user_id: str) -> None:
    """
    If there is no twin_daily_record for the user's local today, run simulate_twin_day once.

    Scheduled job still runs at ~1:00 local; this fills the gap for users who open the app
    earlier so Twin Comparison and strip have data from day 1.
    """
    from app.services.mission_service import get_user_date

    user_row = (
        supabase_admin.table("users")
        .select("timezone, onboarding_complete")
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = user_row.data or {}
    if not user.get("onboarding_complete"):
        return

    today = get_user_date(user.get("timezone", "UTC") or "UTC")
    existing = (
        supabase_admin.table("twin_daily_record")
        .select("id")
        .eq("user_id", user_id)
        .eq("record_date", today)
        .limit(1)
        .execute()
    )
    if existing.data:
        return

    # Avoid calling simulate on every request before missions exist for today.
    has_mission = (
        supabase_admin.table("missions")
        .select("id")
        .eq("user_id", user_id)
        .eq("mission_date", today)
        .limit(1)
        .execute()
    )
    if not has_mission.data:
        return

    await simulate_twin_day(user_id)


async def generate_and_store_twin_journal(user_id: str, today: str) -> None:
    """
    Generates and stores the Twin's daily journal entry (one per user per calendar day).
    Intended to run after twin simulation for that day. Swallows all errors — never raises.
    Skips if a row already exists for (user_id, today) or if there is no twin_daily_record.
    """
    import asyncio
    import json as _json

    from app.agents.twin_chat_agent import get_relationship_phase
    from app.agents.twin_journal_agent import generate_twin_journal_entry
    from app.core.constants import TWIN_JOURNAL_FALLBACKS
    from app.services.mission_service import get_days_since_registration

    try:
        existing = (
            supabase_admin.table("twin_journal")
            .select("id")
            .eq("user_id", user_id)
            .eq("entry_date", today)
            .limit(1)
            .execute()
        )
        if existing.data:
            return

        rec_res = (
            supabase_admin.table("twin_daily_record")
            .select("missions_completed, missions_assigned, missed_mission_titles")
            .eq("user_id", user_id)
            .eq("record_date", today)
            .limit(1)
            .execute()
        )
        rows = rec_res.data or []
        if not rows:
            return

        twin_record = rows[0]

        user_res = (
            supabase_admin.table("users")
            .select("archetype, registration_date, timezone, total_xp, current_streak")
            .eq("id", user_id)
            .single()
            .execute()
        )
        journal_user = user_res.data or {}

        twin_res = (
            supabase_admin.table("twin_state")
            .select("twin_xp, twin_streak")
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        journal_twin = twin_res.data or {}

        tz = str(journal_user.get("timezone") or "UTC")
        reg_n = get_days_since_registration(str(journal_user.get("registration_date") or ""), tz)
        days_active = max(0, int(reg_n) - 1)
        phase_data = get_relationship_phase(days_active)
        relationship_phase = str(phase_data.get("phase") or "observer")
        archetype = str(journal_user.get("archetype") or "structured_climber")

        missions_completed = int(twin_record.get("missions_completed") or 0)
        missions_total = int(twin_record.get("missions_assigned") or 0)
        missed_titles = twin_record.get("missed_mission_titles") or []
        twin_xp = int(journal_twin.get("twin_xp") or 0)
        user_xp = int(journal_user.get("total_xp") or 0)
        user_streak = int(journal_user.get("current_streak") or 0)

        skipped_types: list[str] = []
        if missed_titles:
            try:
                titles = [str(t) for t in missed_titles[:10] if t]
                if titles:
                    missed_res = (
                        supabase_admin.table("missions")
                        .select("type, core_pillar, title")
                        .eq("user_id", user_id)
                        .eq("mission_date", today)
                        .in_("title", titles)
                        .execute()
                    )
                    for m in missed_res.data or []:
                        t = m.get("core_pillar") or m.get("type") or ""
                        t = str(t).strip()
                        if t and t not in skipped_types:
                            skipped_types.append(t)
            except Exception:
                pass

        completion_hour: int | None = None
        try:
            um = (
                supabase_admin.table("missions")
                .select("completed_at")
                .eq("user_id", user_id)
                .eq("mission_date", today)
                .eq("completed", True)
                .order("completed_at", desc=True)
                .limit(1)
                .execute()
            )
            if um.data and um.data[0].get("completed_at"):
                raw = um.data[0]["completed_at"]
                dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
                try:
                    local = dt.astimezone(ZoneInfo(tz))
                    completion_hour = local.hour
                except Exception:
                    completion_hour = dt.hour
        except Exception:
            pass

        if completion_hour is None:
            try:
                log_res = (
                    supabase_admin.table("twin_mission_log")
                    .select("simulated_hour")
                    .eq("user_id", user_id)
                    .eq("mission_date", today)
                    .order("simulated_hour", desc=True)
                    .limit(1)
                    .execute()
                )
                if log_res.data:
                    completion_hour = int(log_res.data[0].get("simulated_hour") or 9)
            except Exception:
                pass

        try:
            content = await asyncio.to_thread(
                generate_twin_journal_entry,
                archetype=archetype,
                relationship_phase=relationship_phase,
                days_active=days_active,
                missions_completed=missions_completed,
                missions_total=missions_total,
                skipped_types=skipped_types,
                completion_hour=completion_hour,
                streak=user_streak,
                twin_xp=twin_xp,
                user_xp=user_xp,
            )
        except Exception as e:
            logger.error(
                _json.dumps(
                    {
                        "event": "twin_journal_failed",
                        "user_id": user_id,
                        "date": today,
                    "error": str(e)[:200],
                }
            )
        )
            fallback_template = TWIN_JOURNAL_FALLBACKS.get(
                relationship_phase,
                TWIN_JOURNAL_FALLBACKS["observer"],
            )
            gap = abs(twin_xp - user_xp)
            content = fallback_template.format(
                N=days_active,
                done=missions_completed,
                total=missions_total,
                gap=f"{gap} XP",
            )
            logger.info(
                _json.dumps(
                    {
                        "event": "twin_journal_fallback_used",
                        "user_id": user_id,
                        "date": today,
                    }
                )
            )

        # D2: once per week, append one pet-reference sentence to the same entry
        try:
            import random as _random

            from app.core.constants import PET_TWIN_JOURNAL_LINES

            if days_active > 0 and days_active % 7 == 0:
                pet_line = _random.choice(PET_TWIN_JOURNAL_LINES)
                content = f"{content.rstrip()} {pet_line}"
        except Exception:
            pass

        supabase_admin.table("twin_journal").upsert(
            {
                "user_id": user_id,
                "entry_date": today,
                "content": content,
                "relationship_phase": relationship_phase,
                "missions_completed": missions_completed,
                "missions_total": missions_total,
                "archetype": archetype,
            },
            on_conflict="user_id,entry_date",
        ).execute()

        logger.info(
            _json.dumps(
                {
                    "event": "twin_journal_generated",
                    "user_id": user_id,
                    "date": today,
                    "phase": relationship_phase,
                }
            )
        )

    except Exception as e:
        logger.error(
            _json.dumps(
                {
                    "event": "twin_journal_error",
                    "user_id": user_id,
                    "date": today,
                    "error": str(e)[:200],
                }
            )
        )


def build_twin_day_timeline(
    user_id: str,
    today: str,
    completed_mission_ids: list | None,
    timezone_str: str | None = None,
) -> list[dict]:
    """
    Timeline rows for Twin Comparison — twin's completed missions today.
    Display times are synthetic but always between local 06:00 and min(now, 21:30)
    on the user's calendar day so nothing appears in the future.
    """
    ids = completed_mission_ids or []
    if not ids:
        return []

    mres = (
        supabase_admin.table("missions")
        .select("id, title, type, difficulty, xp_value")
        .eq("user_id", user_id)
        .in_("id", list(ids))
        .execute()
    )
    rows = mres.data or []
    id_to_row = {str(r.get("id")): r for r in rows}

    ordered: list[dict] = []
    for mid in ids:
        r = id_to_row.get(str(mid))
        if r:
            ordered.append(r)

    n = len(ordered)
    if n == 0:
        return []

    tz_name = (timezone_str or "UTC").strip() or "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")

    d = date_type.fromisoformat(today)
    now_local = datetime.now(tz)
    day_start = datetime(d.year, d.month, d.day, 6, 0, 0, tzinfo=tz)
    soft_end = datetime(d.year, d.month, d.day, 21, 30, 0, tzinfo=tz)

    if now_local.date() == d:
        cap = min(now_local, soft_end)
    else:
        cap = soft_end

    if cap <= day_start:
        latest = day_start + timedelta(minutes=30)
    else:
        latest = cap - timedelta(seconds=30)

    if latest < day_start:
        latest = day_start

    span_seconds = max(60, int((latest - day_start).total_seconds()))

    timestamps: list[datetime] = []
    if n == 1:
        timestamps.append(latest)
    else:
        for i in range(n):
            frac = i / (n - 1)
            t = day_start + timedelta(seconds=span_seconds * frac)
            if t > latest:
                t = latest
            timestamps.append(t)

    timeline: list[dict] = []
    for r, t in zip(ordered, timestamps, strict=True):
        timeline.append(
            {
                "mission_title": r.get("title") or "Mission",
                "mission_type": r.get("type") or "core",
                "difficulty": str(r.get("difficulty") or "easy"),
                "xp_earned": int(r.get("xp_value") or 0),
                "completed_at": t.replace(microsecond=0).isoformat(),
            }
        )
    return timeline


def get_twin_xp_comparison(user_id: str, today: str) -> dict:
    """
    Returns user's XP earned today vs Twin's XP earned today.
    Uses xp_log for user XP and twin_daily_record for Twin XP.
    Returns {"user_xp_today": int, "twin_xp_today": int} or
    {"user_xp_today": None, "twin_xp_today": None} on error.
    """
    try:
        user_result = (
            supabase_admin.table("xp_log")
            .select("amount")
            .eq("user_id", user_id)
            .eq("log_date", today)
            .execute()
        )
        user_xp = sum(int(r.get("amount") or 0) for r in (user_result.data or []))

        twin_result = (
            supabase_admin.table("twin_daily_record")
            .select("xp_earned")
            .eq("user_id", user_id)
            .eq("record_date", today)
            .execute()
        )
        twin_rows = twin_result.data or []
        twin_xp = int(twin_rows[0].get("xp_earned") or 0) if twin_rows else 0

        return {"user_xp_today": user_xp, "twin_xp_today": twin_xp}

    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "twin_strip_xp_error",
                    "user_id": user_id,
                    "error": str(e),
                }
            )
        )
        return {"user_xp_today": None, "twin_xp_today": None}


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

    from app.core.constants import RECALIBRATION_INTERVAL_DAYS

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

    unrated_calibrations = (
        supabase_admin.table("twin_messages")
        .select("id, message_rating")
        .eq("user_id", user_id)
        .not_.is_("message_rating", "null")
        .eq("rating_used_in_calibration", False)
        .execute()
        .data
        or []
    )
    if unrated_calibrations:
        current_signal = float(dna.get("tone_preference_signal") or 0.5)
        total_adjustment = sum(int(r["message_rating"]) * 0.05 for r in unrated_calibrations)
        new_signal = max(0.0, min(1.0, current_signal + total_adjustment))
        supabase_admin.table("discipline_dna").update(
            {
                "tone_preference_signal": new_signal,
                "chat_rating_count": int(dna.get("chat_rating_count") or 0) + len(unrated_calibrations),
                "last_rating_calibration_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("user_id", user_id).execute()
        ids = [r["id"] for r in unrated_calibrations]
        if ids:
            supabase_admin.table("twin_messages").update({"rating_used_in_calibration": True}).in_(
                "id", ids
            ).execute()
        dna["tone_preference_signal"] = new_signal
        dna["chat_rating_count"] = int(dna.get("chat_rating_count") or 0) + len(unrated_calibrations)
        logger.info(
            "Twin recalibration %s: tone_preference_signal %.2f → %.2f (%s ratings processed)",
            user_id,
            current_signal,
            new_signal,
            len(unrated_calibrations),
        )

    twin_result = (
        supabase_admin.table("twin_state")
        .select("consistency_ceiling, last_passed_at, current_gap_state, twin_xp")
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    twin = twin_result.data or {}

    today = date_type.today()
    lookback = RECALIBRATION_INTERVAL_DAYS
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

    from app.services.mission_service import recalibrate_core_pillar_difficulties

    try:
        await recalibrate_core_pillar_difficulties(user_id)
    except Exception as e:
        logger.error("recalibrate_core_pillar_difficulties failed user=%s: %s", user_id, e)

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


async def send_twin_message(user_id: str, message: str) -> dict:
    """
    Handle a user message to their Twin: context, safety check, structured twin reply, persistence.
    """
    try:
        return await _send_twin_message_impl(user_id, message)
    except ValueError:
        raise
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "twin_chat_error",
                    "user_id": user_id,
                    "error": str(e)[:200],
                }
            )
        )
        raise


async def _send_twin_message_impl(user_id: str, message: str) -> dict:
    from app.agents.twin_chat_agent import (
        SAFETY_RESPONSES,
        classify_message_safety,
        generate_twin_response,
    )
    from app.services.mission_service import get_days_since_registration, get_user_date

    now = datetime.now(timezone.utc).isoformat()

    user_res = (
        supabase_admin.table("users")
        .select(
            "username, archetype, registration_date, timezone, "
            "twin_tone_override, twin_tone_override_until"
        )
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    user = (user_res.data or [None])[0]
    if not user:
        raise ValueError("User not found")

    tz = user.get("timezone", "UTC") or "UTC"
    today = get_user_date(tz)

    twin_result = supabase_admin.table("twin_state").select("*").eq("user_id", user_id).execute()
    twin = twin_result.data[0] if twin_result.data else {
        "twin_xp": 0,
        "current_gap_state": "neck_and_neck",
        "twin_character_stage": 1,
        "twin_pet_stage": 0,
    }

    char_res = (
        supabase_admin.table("users")
        .select("total_xp, current_streak")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    char = (char_res.data or [None])[0] or {"total_xp": 0, "current_streak": 0}

    dna_result = supabase_admin.table("discipline_dna").select("*").eq("user_id", user_id).execute()
    dna = dna_result.data[0] if dna_result.data else {
        "twin_tone_type": "rival",
        "twin_intensity": 2,
        "twin_gap_behavior": "rubber_band",
        "tone_preference_signal": 0.5,
        "chat_rating_count": 0,
    }

    reg_day_n = get_days_since_registration(user.get("registration_date", ""), tz)
    days_active = max(0, int(reg_day_n) - 1)
    if days_active < 3 and int(dna.get("twin_intensity") or 3) > 2:
        dna = {**dna, "twin_intensity": 2}

    twin_tone_override_active: str | None = None
    try:
        raw_until = user.get("twin_tone_override_until")
        if raw_until:
            from datetime import datetime as dt_module, timezone as tz_module

            until_dt = dt_module.fromisoformat(str(raw_until).replace("Z", "+00:00"))
            if until_dt.tzinfo is None:
                until_dt = until_dt.replace(tzinfo=tz_module.utc)
            if dt_module.now(tz_module.utc) < until_dt:
                raw_ov = user.get("twin_tone_override")
                if raw_ov:
                    twin_tone_override_active = str(raw_ov).strip() or None
    except Exception:
        twin_tone_override_active = None

    interests_rows = (
        supabase_admin.table("interests")
        .select("normalised_name")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data
        or []
    )
    interests = [r["normalised_name"] for r in interests_rows if r.get("normalised_name")]

    if not interests:
        onboarding = (
            supabase_admin.table("onboarding_answers")
            .select("answer_json")
            .eq("user_id", user_id)
            .eq("question_key", "q11_interests")
            .limit(1)
            .execute()
            .data
        )
        if onboarding:
            raw = (onboarding[0].get("answer_json") or {}) if isinstance(onboarding[0], dict) else {}
            items = raw.get("interests") if isinstance(raw, dict) else []
            if isinstance(items, list):
                for it in items:
                    if isinstance(it, dict):
                        nm = (it.get("normalised_name") or it.get("raw_text") or "").strip()
                        if nm:
                            interests.append(nm)

    history = (
        supabase_admin.table("twin_messages")
        .select("role, content, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(12)
        .execute()
        .data
        or []
    )
    history = list(reversed(history))

    today_missions = (
        supabase_admin.table("missions")
        .select("title, type, completed")
        .eq("user_id", user_id)
        .eq("mission_date", today)
        .execute()
        .data
        or []
    )

    completed_count = sum(1 for m in today_missions if m.get("completed"))
    total_count = len(today_missions)
    missed_types = [str(m["type"]) for m in today_missions if not m.get("completed")]
    last_missed = missed_types[-1] if missed_types else "none"

    if total_count > 0:
        missions_summary = (
            f"Completed {completed_count}/{total_count} today."
            + (
                f" Missed types: {', '.join(missed_types[:3])}."
                if missed_types
                else " All complete."
            )
        )
    else:
        missions_summary = "No missions generated yet today."

    seven_start = (date_type.fromisoformat(today) - timedelta(days=7)).isoformat()
    recent_missions = (
        supabase_admin.table("missions")
        .select("completed")
        .eq("user_id", user_id)
        .gte("mission_date", seven_start)
        .execute()
        .data
        or []
    )
    completion_rate_7d = (
        sum(1 for m in recent_missions if m.get("completed")) / len(recent_missions)
        if recent_missions
        else 0.5
    )

    safety = await classify_message_safety(
        user_message=message,
        username=str(user.get("username") or "you"),
    )
    logger.info(
        json.dumps(
            {
                "event": "twin_chat_safety_checked",
                "user_id": user_id,
                "safety_category": str(safety.category),
            }
        )
    )

    block_response = None
    if safety.category == "crisis":
        severity = safety.crisis_severity or "passive"
        if severity not in ("passive", "active"):
            severity = "passive"
        block_response = SAFETY_RESPONSES[f"crisis_{severity}"]
        logger.warning(
            json.dumps(
                {
                    "event": "twin_chat_safety_block",
                    "user_id": user_id,
                    "safety_category": "crisis",
                    "severity": severity,
                    "message_preview": (message or "")[:50],
                }
            )
        )
    elif safety.category == "harmful_content":
        block_response = SAFETY_RESPONSES["harmful_content"]
        logger.warning(
            json.dumps(
                {
                    "event": "twin_chat_safety_block",
                    "user_id": user_id,
                    "safety_category": "harmful_content",
                    "message_preview": (message or "")[:50],
                }
            )
        )
    elif safety.category == "dependency" and safety.confidence > 0.8:
        block_response = SAFETY_RESPONSES["dependency"]

    chat_history = [
        {"sender": "user" if m.get("role") == "user" else "twin", "message": m.get("content") or ""}
        for m in history
    ]

    if block_response is not None:
        supabase_admin.table("twin_messages").insert(
            {"user_id": user_id, "role": "user", "content": message, "created_at": now}
        ).execute()
        supabase_admin.table("twin_messages").insert(
            {
                "user_id": user_id,
                "role": "twin",
                "content": block_response,
                "emotional_register": f"safety_block_{safety.category}",
                "created_at": now,
            }
        ).execute()
        logger.info(
            json.dumps(
                {
                    "event": "twin_chat_response",
                    "user_id": user_id,
                    "safety_category": str(safety.category),
                    "emotional_register": f"safety_block_{safety.category}",
                }
            )
        )
        return {
            "response": block_response,
            "message": block_response,
            "message_id": None,
            "twin_message_id": None,
            "user_message_id": None,
            "emotional_register": f"safety_block_{safety.category}",
            "is_safety_response": True,
            "safety_category": safety.category,
        }

    twin_response = await generate_twin_response(
        username=str(user.get("username") or "you"),
        user_message=message,
        chat_history=chat_history,
        twin_xp=int(twin.get("twin_xp") or 0),
        user_xp=int(char.get("total_xp") or 0),
        gap_state=str(twin.get("current_gap_state") or "neck_and_neck"),
        user_streak=int(char.get("current_streak") or 0),
        tone_type=str(dna.get("twin_tone_type") or "rival"),
        intensity=int(dna.get("twin_intensity") or 3),
        archetype=str(user.get("archetype") or "structured_climber"),
        interests=interests,
        recent_missions_summary=missions_summary,
        tone_preference_signal=float(dna.get("tone_preference_signal") or 0.5),
        last_missed_type=last_missed,
        days_active=days_active,
        user_completion_rate_7d=completion_rate_7d,
        twin_tone_override=twin_tone_override_active,
    )

    user_ins = (
        supabase_admin.table("twin_messages")
        .insert(
            {
                "user_id": user_id,
                "role": "user",
                "content": message,
                "created_at": now,
            }
        )
        .execute()
    )
    user_row = (user_ins.data or [None])[0] or {}
    user_message_id = user_row.get("id")

    twin_ins = (
        supabase_admin.table("twin_messages")
        .insert(
            {
                "user_id": user_id,
                "role": "twin",
                "content": twin_response.response,
                "emotional_register": twin_response.emotional_register,
                "conversation_note": twin_response.conversation_note,
                "created_at": now,
            }
        )
        .execute()
    )
    twin_row = (twin_ins.data or [None])[0] or {}
    twin_msg_id = twin_row.get("id")

    tid = str(twin_msg_id) if twin_msg_id else None
    uid = str(user_message_id) if user_message_id else None

    logger.info(
        json.dumps(
            {
                "event": "twin_chat_response",
                "user_id": user_id,
                "safety_category": str(safety.category),
                "emotional_register": str(twin_response.emotional_register or ""),
            }
        )
    )

    return {
        "response": twin_response.response,
        "message": twin_response.response,
        "message_id": tid,
        "twin_message_id": tid,
        "user_message_id": uid,
        "emotional_register": twin_response.emotional_register,
        "is_safety_response": False,
        "safety_category": None,
    }
