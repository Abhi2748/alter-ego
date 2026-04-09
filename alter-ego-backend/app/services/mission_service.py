from __future__ import annotations

import json
import logging
from collections import Counter, defaultdict
from datetime import datetime, date, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from app.core.supabase_client import supabase_admin, run_query

logger = logging.getLogger(__name__)

_MISSION_TITLE_INJECTION_PHRASES = (
    "ignore previous",
    "system:",
    "assistant:",
    "you are now",
)
_FALLBACK_CORE_MISSION_TITLE = "Complete a mindfulness task today"


def _sanitize_core_mission_title(title: str, *, user_id: str) -> str:
    raw = str(title or "")[:200].strip()
    low = raw.lower()
    if any(p in low for p in _MISSION_TITLE_INJECTION_PHRASES):
        logger.error(
            json.dumps(
                {
                    "event": "mission_injection_attempt",
                    "user_id": user_id,
                    "title_preview": raw[:50],
                }
            )
        )
        return _FALLBACK_CORE_MISSION_TITLE
    return raw if raw else _FALLBACK_CORE_MISSION_TITLE


from app.core.constants import (
    CORE_MISSIONS,
    DAILY_PF_CAPS,
    DAILY_XP_CAPS,
    MISSION_PF,
    MISSION_XP_BY_TYPE,
    PET_UNLOCK_DAY,
    RECOVERY_MISSION_OVERRIDES,
    get_completion_copy,
    resolve_stat_tag,
)
from app.services.mission_row_utils import mission_row_completed
from app.services.progression_service import (
    check_character_stage_progression,
    check_pet_stage_progression,
)
from app.services.streak_service import process_streak, sync_streak_if_lapsed


def isoweekday_for_mission_date(mission_date: str) -> int:
    """
    ISO weekday 1=Monday .. 7=Sunday for the calendar date in mission_date (YYYY-MM-DD).

    mission_date is always the user's logical calendar day (from get_user_date), so the
    weekday is independent of timezone string — the label already encodes the day.
    """
    try:
        return date.fromisoformat(mission_date).isoweekday()
    except Exception:
        return datetime.now(timezone.utc).isoweekday()


def parse_interest_active_days(raw) -> list[int]:
    """
    Normalise active_days from DB (json/list) to ISO weekdays 1–7.
    Accepts legacy 0–6 (Mon–Sun index from the app) by mapping n -> n+1.
    Empty / invalid => all seven days.
    """
    if raw is None:
        return [1, 2, 3, 4, 5, 6, 7]
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            return [1, 2, 3, 4, 5, 6, 7]
    if not isinstance(raw, list) or len(raw) == 0:
        return [1, 2, 3, 4, 5, 6, 7]
    values: list[int] = []
    for x in raw:
        try:
            values.append(int(x))
        except (TypeError, ValueError):
            continue

    if not values:
        return [1, 2, 3, 4, 5, 6, 7]

    # Detect which scheme the app is using.
    # - Legacy scheme: contains 0 (Mon) .. 6 (Sun)
    # - ISO scheme: 1 (Mon) .. 7 (Sun)
    legacy_mode = any(n == 0 for n in values)

    out: list[int] = []
    if legacy_mode:
        for n in values:
            if 0 <= n <= 6:
                out.append(n + 1)
    else:
        for n in values:
            if 1 <= n <= 7:
                out.append(n)

    return sorted(set(out)) or [1, 2, 3, 4, 5, 6, 7]


def interest_eligible_for_mission_date(interest: dict, mission_date: str) -> bool:
    if not interest.get("is_active", True):
        return False
    weekday = isoweekday_for_mission_date(mission_date)
    active = parse_interest_active_days(interest.get("active_days"))
    return weekday in active


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


def local_completed_week_bounds(timezone_str: str) -> tuple[date, date]:
    """
    Completed Mon–Sun week stored in weekly_reports (week_start Monday, week_end Sunday).

    week_end is the most recent Sunday (inclusive): on Sunday local time, that Sunday is the
    end of the week just completed, so Saturday signup + Sunday 03:00 job targets the same
    week the app expects when fetching /reports/weekly (fixes off-by-one on Sundays).
    """
    try:
        tz = ZoneInfo(timezone_str)
    except Exception:
        tz = timezone.utc
    local_today = datetime.now(tz).date()
    # Monday=0 .. Sunday=6 → days back to Sunday (0 if today is Sunday)
    days_back = (local_today.weekday() + 1) % 7
    week_end = local_today - timedelta(days=days_back)
    week_start = week_end - timedelta(days=6)
    return week_start, week_end


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


async def ensure_pet_unlocked_if_eligible(user_id: str) -> bool:
    """
    If the user has been registered >= PET_UNLOCK_DAY and pet_unlocked is still false,
    unlock the companion (idempotent). Used from GET /profile/overview so unlock does not
    depend only on the hourly scheduler at local hour 1.
    """
    from app.core.constants import PET_UNLOCK_DAY

    res = await run_query(supabase_admin.table("users")
        .select("registration_date, pet_unlocked, pet_stage, timezone")
        .eq("id", user_id)
        .single())
    row = res.data or {}
    if row.get("pet_unlocked"):
        return False
    tz = str(row.get("timezone") or "UTC")
    days = get_days_since_registration(str(row.get("registration_date") or ""), tz)
    if days < PET_UNLOCK_DAY:
        return False
    updates: dict = {"pet_unlocked": True, "pet_state": "happy"}
    if not row.get("pet_stage"):
        updates["pet_stage"] = 1
    await run_query(supabase_admin.table("users").update(updates).eq("id", user_id))
    logger.info(
        json.dumps(
            {
                "event": "pet_unlocked_on_demand",
                "user_id": str(user_id),
                "days_since_registration": days,
            }
        )
    )
    return True


async def generate_core_missions_for_user(user_id: str, mission_date: str) -> list[dict]:
    """
    Generates core pillar missions (3–5 by day since signup + archetype) plus journal.
    Idempotent: if any core row exists for this user+date, returns existing rows.
    """
    from app.agents.core_mission_agent import (
        CORE_TIER_SPECS,
        estimated_minutes_for,
        generate_core_missions,
        pillars_for_day,
    )

    existing = await run_query(supabase_admin.table("missions")
        .select("*")
        .eq("user_id", user_id)
        .eq("mission_date", mission_date)
        .eq("type", "core"))
    if existing.data:
        return existing.data

    user_res = await run_query(supabase_admin.table("users")
        .select(
            "archetype, registration_date, timezone, "
            "recovery_mode_reason, recovery_mode_until"
        )
        .eq("id", user_id)
        .limit(1))
    user = (user_res.data or [None])[0]
    if not user:
        return []

    tz_str = user.get("timezone") or "UTC"
    try:
        tz = ZoneInfo(tz_str)
    except Exception:
        tz = timezone.utc

    reg_raw = user.get("registration_date") or ""
    try:
        reg_dt = datetime.fromisoformat(str(reg_raw).replace("Z", "+00:00"))
        reg_day = reg_dt.astimezone(tz).date()
    except Exception:
        reg_day = date.today()

    try:
        mday = date.fromisoformat(mission_date)
    except Exception:
        mday = date.today()

    days_active = max(0, (mday - reg_day).days)
    archetype = str(user.get("archetype") or "structured_climber")

    dna_res = await run_query(supabase_admin.table("discipline_dna").select("*").eq("user_id", user_id).limit(1))
    dna_row = (dna_res.data or [None])[0] or {}

    pillar_keys = ["sleep", "movement", "hydration", "mindfulness", "no_phone"]
    pillar_difficulties: dict[str, str] = {}
    for pk in pillar_keys:
        col = f"core_{pk}_difficulty"
        raw = dna_row.get(col, "easy")
        pillar_difficulties[pk] = str(raw or "easy").lower()

    seven_start = (mday - timedelta(days=7)).isoformat()
    recent = (
        await run_query(supabase_admin.table("missions")
        .select("core_pillar, completed, is_journal_mission, mission_date")
        .eq("user_id", user_id)
        .eq("type", "core")
        .gte("mission_date", seven_start))
        .data
        or []
    )

    pillar_rates: dict[str, float] = {}
    for pillar in pillar_keys:
        pm = [
            m
            for m in recent
            if (m.get("core_pillar") or "") == pillar and not m.get("is_journal_mission")
        ]
        if pm:
            pillar_rates[pillar] = sum(1 for m in pm if m.get("completed")) / len(pm)
        else:
            pillar_rates[pillar] = 0.7

    last_titles_res = (
        await run_query(supabase_admin.table("missions")
        .select("title, created_at")
        .eq("user_id", user_id)
        .eq("type", "core")
        .eq("is_journal_mission", False)
        .order("created_at", desc=True)
        .limit(24))
        .data
        or []
    )
    last_mission_texts = [str(m["title"]) for m in last_titles_res if m.get("title")][:6]

    recovery_overrides: dict = {}
    recovery_pillars_today: list[str] | None = None
    rm_reason = user.get("recovery_mode_reason")
    rm_until = user.get("recovery_mode_until")
    if rm_reason and rm_until:
        try:
            until_d = date.fromisoformat(str(rm_until)[:10])
            if mday <= until_d:
                rkey = str(rm_reason).strip().lower()
                recovery_overrides = dict(RECOVERY_MISSION_OVERRIDES.get(rkey, {}))
                mp = recovery_overrides.get("max_pillars")
                if isinstance(mp, int) and mp > 0:
                    full = pillars_for_day(archetype, days_active)
                    recovery_pillars_today = full[:mp]
        except Exception:
            recovery_overrides = {}
            recovery_pillars_today = None

    diff_cap = recovery_overrides.get("difficulty_cap")
    if isinstance(diff_cap, str) and diff_cap:
        cap = diff_cap.lower()
        if cap in ("easy", "medium", "hard", "elite"):
            cap_rank = {"easy": 0, "medium": 1, "hard": 2, "elite": 3}
            c = cap_rank[cap]
            for pk in pillar_keys:
                cur = str(pillar_difficulties.get(pk, "easy")).lower()
                if cap_rank.get(cur, 0) > c:
                    pillar_difficulties[pk] = cap

    # Per-pillar streaks + typical completion hour (Phase 3 context for core agent)
    pillar_streaks: dict[str, int] = {}
    pillar_completion_hour: dict[str, str] = {}
    try:
        streak_cutoff = (mday - timedelta(days=30)).isoformat()
        streak_rows = (
            await run_query(supabase_admin.table("missions")
            .select("core_pillar, mission_date, completed, is_journal_mission")
            .eq("user_id", user_id)
            .eq("type", "core")
            .gte("mission_date", streak_cutoff)
            .lte("mission_date", mission_date)
            .order("mission_date", desc=True))
            .data
            or []
        )
        by_pillar: dict[str, list[dict]] = defaultdict(list)
        for row in streak_rows:
            if row.get("is_journal_mission"):
                continue
            p = str(row.get("core_pillar") or "")
            if p:
                by_pillar[p].append(row)
        mission_day = mday
        for pillar, rows in by_pillar.items():
            dates_completed = {
                str(row["mission_date"])
                for row in rows
                if row.get("completed")
            }
            streak = 0
            check_date = mission_day - timedelta(days=1)
            while str(check_date) in dates_completed:
                streak += 1
                check_date -= timedelta(days=1)
            pillar_streaks[pillar] = streak
    except Exception:
        pass

    try:
        hour_rows = (
            await run_query(supabase_admin.table("missions")
            .select("core_pillar, completed_at")
            .eq("user_id", user_id)
            .eq("type", "core")
            .eq("completed", True)
            .eq("is_journal_mission", False)
            .not_.is_("completed_at", "null")
            .order("completed_at", desc=True)
            .limit(70))
            .data
            or []
        )
        pillar_hours: dict[str, list[int]] = defaultdict(list)
        for row in hour_rows:
            p = str(row.get("core_pillar") or "")
            cat = str(row.get("completed_at") or "")
            if p and cat and p != "journal":
                try:
                    dt = datetime.fromisoformat(cat.replace("Z", "+00:00"))
                    pillar_hours[p].append(dt.hour)
                except Exception:
                    pass
        for pillar, hours_list in pillar_hours.items():
            if hours_list:
                buckets: list[str] = []
                for h in hours_list:
                    if 5 <= h <= 11:
                        buckets.append("morning")
                    elif 12 <= h <= 16:
                        buckets.append("afternoon")
                    elif 17 <= h <= 22:
                        buckets.append("evening")
                if buckets:
                    pillar_completion_hour[pillar] = Counter(buckets).most_common(1)[0][0]
    except Exception:
        pass

    batch = await generate_core_missions(
        archetype=archetype,
        days_active=days_active,
        pillar_difficulties=pillar_difficulties,
        recent_pillar_completions=pillar_rates,
        last_core_missions=last_mission_texts,
        recovery_pillars_today=recovery_pillars_today,
        pillar_streaks=pillar_streaks,
        pillar_completion_hour=pillar_completion_hour,
    )

    journal_cfg = next(m for m in CORE_MISSIONS if m.get("is_journal_mission"))

    rows: list[dict] = []
    for m in batch.missions:
        diff = str(m.difficulty).lower()
        if diff not in ("easy", "medium", "hard", "elite"):
            diff = "easy"
        xp = MISSION_XP_BY_TYPE["core"].get(diff, MISSION_XP_BY_TYPE["core"]["easy"])
        pf = MISSION_PF["core"].get(diff, MISSION_PF["core"]["easy"])
        spec_text = CORE_TIER_SPECS[m.pillar][diff]
        rows.append(
            {
                "user_id": user_id,
                "type": "core",
                "title": _sanitize_core_mission_title(m.title, user_id=user_id),
                "difficulty": diff,
                "xp_value": xp,
                "pf_value": pf,
                "mission_date": mission_date,
                "completed": False,
                "is_journal_mission": False,
                "core_pillar": m.pillar,
                "stat_tag": resolve_stat_tag(m.pillar, "core"),
                "estimated_minutes": estimated_minutes_for(m.pillar, diff),
                "rationale": spec_text,
            }
        )

    xp_boost_pct = int(recovery_overrides.get("xp_boost_pct", 0) or 0)
    if xp_boost_pct > 0:
        boost = 1.0 + (xp_boost_pct / 100.0)
        for row in rows:
            if not row.get("is_journal_mission"):
                row["xp_value"] = int(round(int(row.get("xp_value") or 0) * boost))

    rows.append(
        {
            "user_id": user_id,
            "type": "core",
            "title": journal_cfg["title"],
            "difficulty": journal_cfg["difficulty"],
            "xp_value": journal_cfg["xp"],
            "pf_value": journal_cfg["pf"],
            "mission_date": mission_date,
            "completed": False,
            "is_journal_mission": True,
            "core_pillar": journal_cfg["pillar"],
            "stat_tag": resolve_stat_tag(journal_cfg["pillar"], "core"),
            "estimated_minutes": journal_cfg["estimated_minutes"],
            "rationale": journal_cfg["rationale"],
        }
    )

    try:
        inserted = await run_query(supabase_admin.table("missions").insert(rows))
        out: list[dict] = list(inserted.data) if inserted.data else []
        if not out:
            fetched = await run_query(supabase_admin.table("missions")
                .select("*")
                .eq("user_id", user_id)
                .eq("mission_date", mission_date)
                .eq("type", "core"))
            out = fetched.data or []
        logger.info(
            json.dumps(
                {
                    "event": "missions_generated",
                    "user_id": user_id,
                    "date": mission_date,
                    "count": len(out),
                    "recovery_active": bool(recovery_overrides),
                }
            )
        )
        return out
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "mission_generation_error",
                    "user_id": user_id,
                    "date": mission_date,
                    "error": str(e)[:200],
                }
            )
        )
        raise


async def get_today_missions(user_id: str, mission_date: str) -> list[dict]:
    """
    Returns all missions for a user on a given date.
    Ordered: core first, then interest, then resistance, then personal.
    """
    result = await run_query(supabase_admin.table("missions")
        .select("*")
        .eq("user_id", user_id)
        .eq("mission_date", mission_date))
    rows = result.data or []
    order = {"core": 0, "interest": 1, "resistance": 2, "personal": 3, "recovery": 4}
    return sorted(rows, key=lambda r: order.get(r.get("type") or "", 99))


async def get_today_missions_by_type(user_id: str, mission_date: str, mission_type: str) -> list[dict]:
    result = await run_query(supabase_admin.table("missions")
        .select("*")
        .eq("user_id", user_id)
        .eq("mission_date", mission_date)
        .eq("type", mission_type))
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
    mission_result = await run_query(supabase_admin.table("missions")
        .select("*")
        .eq("id", mission_id)
        .eq("user_id", user_id)
        .single())

    if not mission_result.data:
        raise HTTPException(status_code=404, detail="Mission not found")

    mission = mission_result.data

    user_result = await run_query(supabase_admin.table("users")
        .select(
            "total_xp, total_pf, character_stage, timezone, pet_stage, pet_unlocked, "
            "current_streak, power_score, absence_days, registration_date"
        )
        .eq("id", user_id)
        .single())
    user = user_result.data or {}

    # PF is disabled until companion unlock (day 6). If scheduler hasn't run yet on day 6,
    # unlock on-demand so rewards start immediately on the correct day.
    pet_unlocked = bool(user.get("pet_unlocked"))
    if not pet_unlocked:
        tz = str(user.get("timezone") or "UTC")
        days_since_registration = get_days_since_registration(
            str(user.get("registration_date") or ""), tz
        )
        if days_since_registration >= PET_UNLOCK_DAY:
            unlock_updates: dict = {"pet_unlocked": True, "pet_state": "happy"}
            if not int(user.get("pet_stage") or 0):
                unlock_updates["pet_stage"] = 1
            await run_query(supabase_admin.table("users").update(unlock_updates).eq("id", user_id))
            pet_unlocked = True
            user["pet_unlocked"] = True
            if "pet_stage" in unlock_updates:
                user["pet_stage"] = unlock_updates["pet_stage"]

    _sigil_empty = {
        "aether_awarded": 0,
        "surge_activated": False,
        "surge_active": False,
        "level_up": False,
        "new_level": None,
        "new_level_name": None,
    }

    if mission_row_completed(mission):
        return {
            "success": True,
            "already_completed": True,
            "xp_earned": 0,
            "pf_earned": 0,
            "new_total_xp": int(user.get("total_xp") or 0),
            "new_total_pf": int(user.get("total_pf") or 0),
            "power_score": int(user.get("power_score") or 0),
            "stat_gains": {
                "primary_stat": None,
                "primary_sp": 0,
                "discipline_sp": 0,
                "willpower_bonus_sp": 0,
                "level_ups": [],
            },
            "willpower_progress": {
                "missions_completed_today": 0,
                "total_missions_today": 0,
            },
            "sigil": _sigil_empty,
            "completion_copy": None,
        }

    if mission.get("is_journal_mission"):
        from app.core.journal_rules import journal_stored_qualifies_for_mission

        je = await run_query(supabase_admin.table("journal_entries")
            .select("title, content")
            .eq("user_id", user_id)
            .eq("mission_date", str(mission.get("mission_date") or ""))
            .limit(1))
        row = (je.data or [None])[0]
        if not row or not journal_stored_qualifies_for_mission(
            row.get("title"),
            row.get("content"),
        ):
            raise HTTPException(
                status_code=400,
                detail="We don't see a saved journal entry for today yet. Open Journal, write at least a couple of lines, and tap Save — this mission completes automatically.",
            )

    # Ensure mission is for "today" (user's timezone)
    today = get_user_date(user.get("timezone", "UTC") or "UTC")
    if str(mission.get("mission_date")) != today:
        raise HTTPException(status_code=400, detail="Mission is not for today")

    # Mark mission complete
    await run_query(supabase_admin.table("missions").update(
        {"completed": True, "completed_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", mission_id))

    # Calculate XP/PF earned from stored values
    xp_earned = int(mission.get("xp_value") or 0)
    pf_earned = int(mission.get("pf_value") or 0) if pet_unlocked else 0

    # Enforce daily cap
    character_stage = int(user.get("character_stage") or 1)
    daily_xp_cap = int(DAILY_XP_CAPS.get(character_stage, 100))
    daily_pf_cap = int(DAILY_PF_CAPS.get(character_stage, 160))

    xp_today_result = await run_query(supabase_admin.table("xp_log").select("amount").eq("user_id", user_id).eq("log_date", today))
    xp_today = sum(int(row.get("amount") or 0) for row in (xp_today_result.data or []))

    pf_today_result = await run_query(supabase_admin.table("pf_log").select("amount").eq("user_id", user_id).eq("log_date", today))
    pf_today = sum(int(row.get("amount") or 0) for row in (pf_today_result.data or []))

    xp_earned = max(0, min(xp_earned, daily_xp_cap - xp_today))
    pf_earned = max(0, min(pf_earned, daily_pf_cap - pf_today))

    current_total_xp = int(user.get("total_xp") or 0)
    current_total_pf = int(user.get("total_pf") or 0)
    new_total_xp = current_total_xp + xp_earned
    new_total_pf = current_total_pf + pf_earned

    # Log XP and PF
    if xp_earned > 0:
        await run_query(supabase_admin.table("xp_log").insert(
            {
                "user_id": user_id,
                "amount": xp_earned,
                "source_mission_id": mission_id,
                "character_stage_at": character_stage,
                "total_after": new_total_xp,
                "log_date": today,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ))

    pet_stage = int(user.get("pet_stage") or 0)
    if pf_earned > 0:
        await run_query(supabase_admin.table("pf_log").insert(
            {
                "user_id": user_id,
                "amount": pf_earned,
                "source_mission_id": mission_id,
                "pet_stage_at": pet_stage,
                "total_after": new_total_pf,
                "log_date": today,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ))

    absence_before = int(user.get("absence_days") or 0)
    try:
        from app.services.absence_service import reset_absence

        reset_absence(supabase_admin, user_id, today)
    except Exception:
        logger.exception("reset_absence failed after mission complete user=%s", user_id)

    try:
        if absence_before >= 3:
            from app.services.gap_moment_service import queue_gap_moment

            absence_key = str(absence_before) if absence_before in (3, 5, 7) else "default"
            await queue_gap_moment(user_id, "absence_return", absence_key)
    except Exception:
        pass

    # Update user totals
    await run_query(supabase_admin.table("users").update({"total_xp": new_total_xp, "total_pf": new_total_pf}).eq("id", user_id))

    try:
        from app.services.strip_message_service import update_strip_message
        from app.services.twin_service import refresh_twin_gap_state

        await refresh_twin_gap_state(user_id)
        await update_strip_message(user_id, force=True)
    except Exception:
        logger.exception("twin strip refresh failed after mission complete user=%s", user_id)

    # Progression checks
    stage_evolved = await check_character_stage_progression(user_id, new_total_xp, character_stage)
    if stage_evolved:
        try:
            from app.services.gap_moment_service import queue_gap_moment

            await queue_gap_moment(user_id, "stage_evolution")
        except Exception:
            pass

    pet_evolved = await check_pet_stage_progression(user_id, new_total_pf, pet_stage, pet_unlocked)
    if pet_evolved:
        try:
            from app.services.gap_moment_service import queue_gap_moment

            await queue_gap_moment(user_id, "pet_evolution")
        except Exception:
            pass

    await sync_streak_if_lapsed(user_id)
    streak_result = await process_streak(user_id)

    from app.services.power_score_service import calculate_power_score

    new_power_score = int(user.get("power_score") or 0)
    try:
        new_power_score = await calculate_power_score(user_id, log_event=False)
    except Exception:
        logger.exception("calculate_power_score failed after mission complete user=%s", user_id)
        ps_row = await run_query(supabase_admin.table("users")
            .select("power_score")
            .eq("id", user_id)
            .single())
        new_power_score = int((ps_row.data or {}).get("power_score") or 0)

    # Category C — milestone notifications (immediate, pre-written, no LLM)
    from app.agents.nudge_agent import send_category_c_notification

    milestone = streak_result.get("milestone_reached")
    if milestone is not None:
        await send_category_c_notification(user_id, f"streak_{milestone}")
    if stage_evolved:
        await send_category_c_notification(user_id, f"stage_{stage_evolved['new_stage']}")
    if pet_evolved:
        await send_category_c_notification(user_id, f"pet_stage_{pet_evolved['new_stage']}")

    stat_result = {
        "primary_stat": None,
        "primary_sp_awarded": 0,
        "discipline_sp_awarded": 0,
        "willpower_bonus_sp": 0,
        "level_ups": [],
        "missions_completed_today": 0,
        "total_missions_today": 0,
    }
    try:
        from app.services.stat_service import award_sp_for_mission

        stat_result = await award_sp_for_mission(
            user_id=user_id,
            mission=mission,
            difficulty=str(mission.get("difficulty") or "easy"),
            today=today,
        )
    except Exception:
        logger.exception("Stat SP award failed for user %s", user_id)

    sigil_result = dict(_sigil_empty)
    try:
        from app.services.sigil_service import check_and_award_aether

        total_xp_today_after = xp_today + xp_earned
        sigil_result = check_and_award_aether(
            user_id=user_id,
            mission_id=mission_id,
            mission_difficulty=str(mission.get("difficulty") or "easy"),
            xp_earned_this_completion=xp_earned,
            user_stage=character_stage,
            total_xp_today=total_xp_today_after,
            today_str=today,
        )
    except Exception:
        logger.exception("Sigil / aether award failed user=%s", user_id)

    twin_already_done: bool | None = None
    try:
        m_title = str(mission.get("title") or "").strip()
        if m_title:
            twin_log = await run_query(supabase_admin.table("twin_mission_log")
                .select("id")
                .eq("user_id", user_id)
                .eq("mission_date", today)
                .eq("mission_title", m_title)
                .limit(1))
            twin_already_done = bool(twin_log.data)
    except Exception:
        twin_already_done = None

    twin_xp_for_copy = 0
    try:
        twin_rec = await run_query(supabase_admin.table("twin_daily_record")
            .select("xp_earned")
            .eq("user_id", user_id)
            .eq("record_date", today))
        tr = twin_rec.data or []
        twin_xp_for_copy = int(tr[0].get("xp_earned") or 0) if tr else 0
    except Exception:
        pass

    user_xp_before = xp_today
    user_xp_after = xp_today + xp_earned
    user_takes_lead = user_xp_before <= twin_xp_for_copy and user_xp_after > twin_xp_for_copy

    all_complete_today = False
    try:
        missions_today = await run_query(supabase_admin.table("missions")
            .select("id, completed")
            .eq("user_id", user_id)
            .eq("mission_date", today))
        rows = missions_today.data or []
        if rows:
            all_complete_today = all(m.get("completed") for m in rows)
    except Exception:
        pass

    if all_complete_today:
        try:
            from app.services.gap_moment_service import queue_gap_moment

            await queue_gap_moment(user_id, "all_complete")
        except Exception:
            pass

    streak_milestone_hit = streak_result.get("milestone_reached") is not None

    completion_copy = get_completion_copy(
        user_takes_lead=user_takes_lead,
        surge_activated=bool(sigil_result.get("surge_activated")),
        all_complete=all_complete_today,
        twin_already_done=twin_already_done,
        stage_evolved=bool(stage_evolved),
        streak_milestone=streak_milestone_hit,
    )

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
        "power_score": new_power_score,
        "stat_gains": {
            "primary_stat": stat_result["primary_stat"],
            "primary_sp": stat_result["primary_sp_awarded"],
            "discipline_sp": stat_result["discipline_sp_awarded"],
            "willpower_bonus_sp": stat_result["willpower_bonus_sp"],
            "level_ups": stat_result["level_ups"],
        },
        "willpower_progress": {
            "missions_completed_today": stat_result["missions_completed_today"],
            "total_missions_today": stat_result["total_missions_today"],
        },
        "sigil": sigil_result,
        "completion_copy": completion_copy,
    }


async def sync_today_planner_missions(user_id: str, mission_date: str) -> dict:
    """
    Align interest + resistance missions with current interests / quit targets for this date.

    - Deletes **incomplete** missions that no longer apply (inactive interest, wrong active day,
      removed interest id, inactive/conquered quit target).
    - Never deletes **completed** missions (audit / streak history).
    - Creates missing missions for eligible interests and quit targets (planner is idempotent
      per interest_id / quit_target_id for that date).

    Called from GET /missions/today so mid-day profile changes show up without waiting for cron.
    """
    from app.agents.interest_planner_agent import generate_interest_mission
    from app.services.quit_service import sync_quit_path_missions_for_date

    interests_res = await run_query(supabase_admin.table("interests").select("*").eq("user_id", user_id))
    all_interests = interests_res.data or []

    eligible_interest_ids: set[str] = set()
    active_interest_rows: list[dict] = []
    for row in all_interests:
        if not row.get("is_active", True):
            continue
        if interest_eligible_for_mission_date(row, mission_date):
            eligible_interest_ids.add(str(row["id"]))
            active_interest_rows.append(row)

    int_missions = await run_query(supabase_admin.table("missions")
        .select("id, interest_id, completed")
        .eq("user_id", user_id)
        .eq("mission_date", mission_date)
        .eq("type", "interest")).data or []

    removed_interest = 0
    for m in int_missions:
        if m.get("completed"):
            continue
        iid = m.get("interest_id")
        if iid is None or str(iid) not in eligible_interest_ids:
            await run_query(supabase_admin.table("missions").delete().eq("id", m["id"]))
            removed_interest += 1

    paths_res = await run_query(supabase_admin.table("quit_paths")
        .select("id")
        .eq("user_id", user_id)
        .eq("status", "active"))
    quit_path_rows = paths_res.data or []
    eligible_path_ids = {str(p["id"]) for p in quit_path_rows}

    res_missions = await run_query(supabase_admin.table("missions")
        .select("id, quit_path_id, completed")
        .eq("user_id", user_id)
        .eq("mission_date", mission_date)
        .eq("type", "resistance")).data or []

    removed_resistance = 0
    for m in res_missions:
        if m.get("completed"):
            continue
        qpid = m.get("quit_path_id")
        if qpid is None or str(qpid) not in eligible_path_ids:
            await run_query(supabase_admin.table("missions").delete().eq("id", m["id"]))
            removed_resistance += 1

    user_row = await run_query(supabase_admin.table("users")
        .select("character_stage, daily_hours_floor, archetype, timezone")
        .eq("id", user_id)
        .single())
    user = user_row.data or {}
    dna_row = await run_query(supabase_admin.table("discipline_dna")
        .select("completion_rate_7d, mission_skip_pattern, peak_day")
        .eq("user_id", user_id)
        .single())
    discipline_dna = dna_row.data or {}

    for interest in active_interest_rows:
        try:
            await generate_interest_mission(
                user_id=user_id,
                interest=interest,
                mission_date=mission_date,
                user=user,
                discipline_dna=discipline_dna,
            )
        except Exception as e:
            logger.error("sync_today_planner_missions: interest %s: %s", interest.get("id"), e)

    try:
        await sync_quit_path_missions_for_date(user_id, mission_date)
    except Exception as e:
        logger.error("sync_today_planner_missions: quit_paths sync: %s", e)

    return {
        "removed_interest": removed_interest,
        "removed_resistance": removed_resistance,
        "eligible_interests": len(active_interest_rows),
        "eligible_quits": len(quit_path_rows),
    }


async def delete_stale_incomplete_personal_missions(user_id: str, today: str) -> None:
    """Remove incomplete personal missions dated before the user's local today (fresh daily list)."""
    try:
        await run_query(supabase_admin.table("missions")
            .delete()
            .eq("user_id", user_id)
            .eq("type", "personal")
            .eq("completed", False)
            .lt("mission_date", today))
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "delete_stale_personal_error",
                    "user_id": user_id,
                    "today": today,
                    "error": str(e)[:200],
                }
            )
        )


TIER_ORDER = ["easy", "medium", "hard", "elite"]
CORE_PILLARS = ["sleep", "movement", "hydration", "mindfulness", "no_phone"]
MIN_DAYS_BETWEEN_AUTO_CORE_CHANGES = 14


async def recalibrate_core_pillar_difficulties(user_id: str) -> list[str]:
    """
    Per-pillar core difficulty progression. Called from twin recalibration cadence.
    """
    now = datetime.now(timezone.utc)
    fourteen_days_ago = (now.date() - timedelta(days=14)).isoformat()

    dna_res = await run_query(supabase_admin.table("discipline_dna").select("*").eq("user_id", user_id).limit(1))
    if not dna_res.data:
        return []
    dna = dna_res.data[0]

    recent_missions = (
        await run_query(supabase_admin.table("missions")
        .select("core_pillar, completed, mission_date, is_journal_mission")
        .eq("user_id", user_id)
        .eq("type", "core")
        .gte("mission_date", fourteen_days_ago)
        .eq("is_journal_mission", False))
        .data
        or []
    )

    updates: dict = {}
    difficulty_changes: list[str] = []
    pending_ready: list[str] = []

    for pillar in CORE_PILLARS:
        col_diff = f"core_{pillar}_difficulty"
        col_weeks = f"core_{pillar}_clean_weeks"
        col_changed = f"core_{pillar}_difficulty_changed_at"

        current_difficulty = str(dna.get(col_diff) or "easy").lower()
        if current_difficulty not in TIER_ORDER:
            current_difficulty = "easy"
        clean_weeks = int(dna.get(col_weeks) or 0)
        last_changed_at = dna.get(col_changed)

        if last_changed_at:
            try:
                last_changed = datetime.fromisoformat(str(last_changed_at).replace("Z", "+00:00"))
                if (now - last_changed).days < MIN_DAYS_BETWEEN_AUTO_CORE_CHANGES:
                    continue
            except Exception:
                pass

        pillar_missions = [m for m in recent_missions if (m.get("core_pillar") or "") == pillar]
        if not pillar_missions:
            continue

        pillar_completed = sum(1 for m in pillar_missions if m.get("completed"))
        pillar_total = len(pillar_missions)
        missed = pillar_total - pillar_completed

        if missed >= 4 and current_difficulty != "easy":
            idx = TIER_ORDER.index(current_difficulty)
            new_difficulty = TIER_ORDER[max(0, idx - 1)]
            updates[col_diff] = new_difficulty
            updates[col_weeks] = 0
            updates[col_changed] = now.isoformat()
            difficulty_changes.append(
                f"{pillar.replace('_', ' ').title()}: {current_difficulty} → {new_difficulty} (dropped)"
            )
            continue

        days_in_period = min(pillar_total, 14)
        days_completed = pillar_completed
        is_clean_period = days_completed >= max(1, days_in_period - 1)
        is_perfect_period = days_completed == days_in_period and days_in_period > 0

        if is_clean_period:
            new_clean = clean_weeks + 1
            updates[col_weeks] = new_clean
            if new_clean >= 2 and current_difficulty != "elite":
                idx = TIER_ORDER.index(current_difficulty)
                new_difficulty = TIER_ORDER[min(len(TIER_ORDER) - 1, idx + 1)]
                updates[col_diff] = new_difficulty
                updates[col_weeks] = 0
                updates[col_changed] = now.isoformat()
                difficulty_changes.append(
                    f"{pillar.replace('_', ' ').title()}: {current_difficulty} → {new_difficulty} (advanced)"
                )
            elif is_perfect_period and current_difficulty != "elite":
                pending_ready.append(f"{pillar}:ready")
        else:
            updates[col_weeks] = 0

    pending_parts: list[str] = []
    prev_pending = dna.get("pending_difficulty_change")
    if prev_pending:
        pending_parts.append(str(prev_pending))
    if pending_ready:
        pending_parts.append(", ".join(pending_ready))
    if difficulty_changes:
        pending_parts.append("; ".join(difficulty_changes))

    if pending_parts:
        updates["pending_difficulty_change"] = " | ".join(pending_parts)

    if updates:
        await run_query(supabase_admin.table("discipline_dna").update(updates).eq("user_id", user_id))

    if difficulty_changes:
        logger.info("Core difficulty changes for %s: %s", user_id, difficulty_changes)

    return difficulty_changes


async def update_pillar_difficulty(user_id: str, pillar: str, direction: str) -> dict:
    """
    User taps harder/easier on a core pillar. direction: 'up' | 'down'
    """
    if pillar not in CORE_PILLARS:
        return {"updated": False, "reason": "Invalid pillar."}
    if direction not in ("up", "down"):
        return {"updated": False, "reason": "Invalid direction."}

    now = datetime.now(timezone.utc)
    col_diff = f"core_{pillar}_difficulty"
    col_changed = f"core_{pillar}_difficulty_changed_at"
    col_weeks = f"core_{pillar}_clean_weeks"

    dna_res = await run_query(supabase_admin.table("discipline_dna")
        .select(f"{col_diff}, {col_changed}")
        .eq("user_id", user_id)
        .limit(1))
    dna = (dna_res.data or [None])[0]
    if not dna:
        return {"updated": False, "reason": "No discipline profile yet."}

    current = str(dna.get(col_diff) or "easy").lower()
    if current not in TIER_ORDER:
        current = "easy"
    last_changed = dna.get(col_changed)
    if last_changed:
        try:
            last_dt = datetime.fromisoformat(str(last_changed).replace("Z", "+00:00"))
            if (now - last_dt).days < 7:
                return {"updated": False, "reason": "Changed too recently. Try again in a few days."}
        except Exception:
            pass

    idx = TIER_ORDER.index(current)
    if direction == "up":
        new_idx = min(len(TIER_ORDER) - 1, idx + 1)
    else:
        new_idx = max(0, idx - 1)
    if new_idx == idx:
        return {
            "updated": False,
            "reason": f"Already at {'maximum' if direction == 'up' else 'minimum'} difficulty.",
        }

    new_difficulty = TIER_ORDER[new_idx]
    await run_query(supabase_admin.table("discipline_dna").update(
        {
            col_diff: new_difficulty,
            col_changed: now.isoformat(),
            col_weeks: 0,
        }
    ).eq("user_id", user_id))

    return {"updated": True, "pillar": pillar, "old": current, "new": new_difficulty}

