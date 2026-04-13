"""
season_service.py — Season / Arc system logic.

Responsibilities:
  - Create Season 1 automatically when a user has no active season
  - Build the full season API response dict for GET /api/v1/seasons/current
  - Record each past day's outcome into season_day_log (called by nightly scheduler)
  - Close an expired season: compute tier, award XP, set completion state
  - Begin the next season when the user acknowledges the completion screen

Called by: app/api/seasons.py (Step 4) and the nightly scheduler (future step).
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Optional

from app.core.constants import (
    SEASON_PHASE_DEFINITIONS,
    SEASON_PHASE_MISSION_TARGETS,
    get_season_completion_tier,
    get_season_metadata,
    get_season_phase,
    get_season_phase_info,
    get_season_title,
    get_season_twin_closing,
    get_season_xp,
)
from app.core.supabase_client import run_query, supabase_admin

logger = logging.getLogger(__name__)

# ── Core pillar display metadata ──────────────────────────────────────────────
# Maps core_pillar DB value → (display_name, emoji_icon, icon_bg_color).
# Kept here (not in constants.py) because it is UI-adjacent data used only
# when building the API response, not in game logic.

_PILLAR_DISPLAY: dict[str, tuple[str, str, str]] = {
    "sleep":       ("Sleep",       "🌙", "rgba(124,58,237,0.1)"),
    "movement":    ("Movement",    "🏃", "rgba(34,197,94,0.1)"),
    "hydration":   ("Hydration",   "💧", "rgba(59,130,246,0.1)"),
    "mindfulness": ("Mindfulness", "🧘", "rgba(124,58,237,0.1)"),
    "no_phone":    ("No Phone",    "📵", "rgba(249,115,22,0.1)"),
    "journal":     ("Journal",     "📓", "rgba(217,119,6,0.1)"),
}

# Ordered list — controls the order targets appear in the API response.
_PILLAR_ORDER = ["sleep", "movement", "hydration", "mindfulness", "no_phone", "journal"]


# ── Internal helpers ──────────────────────────────────────────────────────────

def _current_day_number(started_at: str, today: str) -> int:
    """Returns the 1-indexed day number within the season (clamped to ≥ 1)."""
    try:
        delta = (date.fromisoformat(today) - date.fromisoformat(str(started_at))).days
        return max(1, delta + 1)
    except Exception:
        return 1


def _phase_status(phase: dict, current_day: int) -> str:
    """Returns 'done' | 'active' | 'upcoming' for a phase dict."""
    if current_day > phase["day_end"]:
        return "done"
    if phase["day_start"] <= current_day <= phase["day_end"]:
        return "active"
    return "upcoming"


def _build_targets(season_number: int, phase_number: int) -> list[dict]:
    """
    Builds the ordered list of phase mission targets for the API response.
    Falls back to season 2 targets for mastery seasons (3+).
    """
    key = min(season_number, 2)
    phase_targets = (SEASON_PHASE_MISSION_TARGETS.get(key) or {}).get(phase_number) or {}
    result = []
    for pillar in _PILLAR_ORDER:
        info = phase_targets.get(pillar, {})
        display_name, icon, icon_bg = _PILLAR_DISPLAY.get(
            pillar, (pillar.capitalize(), "⬡", "rgba(100,100,100,0.1)")
        )
        result.append({
            "mission":          display_name,
            "target":           info.get("target", ""),
            "next_phase_target": info.get("next"),
            "icon":             icon,
            "icon_bg_color":    icon_bg,
        })
    return result


def _build_phases(season_number: int, total_days: int, current_day: int) -> list[dict]:
    """Builds the phases list for the API response."""
    key = min(season_number, 2)
    phase_defs = SEASON_PHASE_DEFINITIONS.get(key, [])
    result = []
    for p in phase_defs:
        status = _phase_status(p, current_day)
        phase_total_days = p["day_end"] - p["day_start"] + 1
        if status == "done":
            days_in_phase = phase_total_days
        elif status == "active":
            days_in_phase = max(0, current_day - p["day_start"] + 1)
        else:
            days_in_phase = 0
        result.append({
            "phase_number":     p["phase"],
            "name":             p["name"],
            "days_start":       p["day_start"],
            "days_end":         p["day_end"],
            "status":           status,
            "targets":          _build_targets(season_number, p["phase"]),
            "days_in_phase":    days_in_phase,
            "days_total_phase": phase_total_days,
        })
    return result


async def _build_day_log(
    season_id: str,
    total_days: int,
    started_at: str,
    current_day: int,
    today: str,
) -> list[dict]:
    """
    Builds the full day_log list for the API response.
    Past days come from season_day_log rows in the DB.
    Today is always 'today'.
    Future days are always 'future'.
    """
    rows_result = await run_query(
        supabase_admin.table("season_day_log")
        .select("day_number, status")
        .eq("season_id", season_id)
        .order("day_number")
    )
    past_by_day: dict[int, str] = {
        int(r["day_number"]): r["status"]
        for r in (rows_result.data or [])
    }

    log = []
    for n in range(1, total_days + 1):
        if n < current_day:
            # Past day — use DB status; fall back to 'missed' if row missing
            log.append({"day_number": n, "status": past_by_day.get(n, "missed")})
        elif n == current_day:
            log.append({"day_number": n, "status": "today"})
        else:
            log.append({"day_number": n, "status": "future"})
    return log


async def _build_twin_comparison(
    user_id: str,
    started_at: str,
    today: str,
    user_days_complete: int,
) -> dict:
    """
    Builds the twin_comparison block for the API response.
    Counts days in the season window where the twin earned XP > 0.
    Falls back gracefully if twin_daily_record is unavailable.
    """
    twin_days_complete = 0
    try:
        twin_result = await run_query(
            supabase_admin.table("twin_daily_record")
            .select("xp_earned")
            .eq("user_id", user_id)
            .gte("record_date", str(started_at))
            .lte("record_date", today)
        )
        twin_days_complete = sum(
            1 for r in (twin_result.data or [])
            if int(r.get("xp_earned") or 0) > 0
        )
    except Exception as e:
        logger.warning("season twin_comparison fallback user=%s: %s", user_id, str(e)[:120])
        # Graceful fallback: twin is one day behind the user
        twin_days_complete = max(0, user_days_complete - 1)

    gap = user_days_complete - twin_days_complete
    if gap > 0:
        s = "s" if gap != 1 else ""
        message = f"You're {gap} day{s} ahead. Don't let the gap close."
    elif gap < 0:
        behind = abs(gap)
        s = "s" if behind != 1 else ""
        message = f"Your Twin is {behind} day{s} ahead. Stay close."
    else:
        message = "You and your Twin are level. Season progress tied."

    return {
        "user_days_complete": user_days_complete,
        "twin_days_complete": twin_days_complete,
        "twin_message":       message,
    }


# ── Public service functions ──────────────────────────────────────────────────

async def get_active_season(user_id: str) -> dict | None:
    """
    Returns the active season row for a user, or None if no season is active.
    """
    result = await run_query(
        supabase_admin.table("user_seasons")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "active")
        .limit(1)
    )
    rows = result.data or []
    return rows[0] if rows else None


async def get_most_recent_season(user_id: str) -> dict | None:
    """
    Returns the most recent season row (active or completed/failed).
    Used when status is 'between' or when showing the completion screen.
    """
    result = await run_query(
        supabase_admin.table("user_seasons")
        .select("*")
        .eq("user_id", user_id)
        .order("season_number", desc=True)
        .limit(1)
    )
    rows = result.data or []
    return rows[0] if rows else None


async def ensure_user_has_season(
    user_id: str,
    timezone_str: str,
    archetype: str,
) -> dict | None:
    """
    Creates Season 1 if the user has no season at all.
    Returns the existing or newly created active season row.
    Does nothing if a season (any status) already exists.
    """
    from app.services.mission_service import get_user_date

    # Check if any season exists (active or otherwise)
    any_result = await run_query(
        supabase_admin.table("user_seasons")
        .select("id, status")
        .eq("user_id", user_id)
        .limit(1)
    )
    if any_result.data:
        # Season already exists — return active one or None
        return await get_active_season(user_id)

    # No season at all — create Season 1
    today = get_user_date(timezone_str)
    meta = get_season_metadata(1)

    started_at = today
    ends_at = str(date.fromisoformat(today) + timedelta(days=meta["total_days"] - 1))

    archetype_key = (archetype or "").lower().replace(" ", "_").replace("-", "_")
    archetype_name = (meta.get("archetype_names") or {}).get(archetype_key, meta["season_name"])

    insert_result = await run_query(
        supabase_admin.table("user_seasons").insert({
            "user_id":               user_id,
            "season_number":         1,
            "season_name":           meta["season_name"],
            "archetype_season_name": archetype_name,
            "season_theme":          meta["season_theme"],
            "season_color":          meta["season_color"],
            "status":                "active",
            "total_days":            meta["total_days"],
            "current_phase":         1,
            "started_at":            started_at,
            "ends_at":               ends_at,
            "days_completed":        0,
            "days_perfect":          0,
            "days_missed":           0,
        })
    )
    rows = insert_result.data or []
    if not rows:
        logger.error("ensure_user_has_season insert returned no rows user=%s", user_id)
        return None

    logger.info(
        "season_created user=%s season_number=1 started_at=%s ends_at=%s",
        user_id, started_at, ends_at,
    )
    return rows[0]


async def build_season_response(
    user_id: str,
    season: dict,
    today: str,
) -> dict:
    """
    Builds the full API response dict for GET /api/v1/seasons/current.
    Matches the CurrentSeason TypeScript interface expected by the frontend.
    """
    season_number = int(season["season_number"])
    started_at    = str(season["started_at"])
    ends_at       = str(season["ends_at"])
    total_days    = int(season["total_days"])
    status        = str(season["status"])

    # Current day within season (clamped so it never exceeds total_days)
    current_day = min(_current_day_number(started_at, today), total_days)
    current_phase = get_season_phase(season_number, current_day)

    days_completed = int(season.get("days_completed") or 0)
    days_perfect   = int(season.get("days_perfect")   or 0)
    days_missed    = int(season.get("days_missed")     or 0)

    # Projected tier (live estimate during active season)
    projected_tier = get_season_completion_tier(days_completed, total_days)

    # Phases
    phases = _build_phases(season_number, total_days, current_day)

    # Day log
    day_log = await _build_day_log(
        season_id=str(season["id"]),
        total_days=total_days,
        started_at=started_at,
        current_day=current_day,
        today=today,
    )

    # Twin comparison
    twin_comparison = await _build_twin_comparison(
        user_id=user_id,
        started_at=started_at,
        today=today,
        user_days_complete=days_completed,
    )

    return {
        "season_number":    season_number,
        "season_name":      season.get("season_name", ""),
        "season_theme":     season.get("season_theme", ""),
        "archetype_name":   season.get("archetype_season_name") or season.get("season_name", ""),
        "season_color":     season.get("season_color", "#F97316"),
        "status":           status,
        "current_day":      current_day,
        "total_days":       total_days,
        "days_completed":   days_completed,
        "days_perfect":     days_perfect,
        "days_missed":      days_missed,
        "started_at":       started_at,
        "ends_at":          ends_at,
        "projected_tier":   projected_tier,
        "current_phase":    current_phase,
        "phases":           phases,
        "day_log":          day_log,
        "twin_comparison":  twin_comparison,
        # Completion fields — only populated when status is completed or failed
        "completion_tier":     season.get("completion_tier"),
        "completion_seen":     bool(season.get("completion_seen", False)),
        "xp_awarded":          season.get("xp_awarded"),
        "title_unlocked":      season.get("title_unlocked"),
        "twin_closing_entry":  season.get("twin_closing_entry"),
    }


async def record_season_day(
    user_id: str,
    season_id: str,
    log_date: str,
    day_number: int,
    missions_done: int,
    missions_total: int,
) -> None:
    """
    Writes one day's outcome into season_day_log and updates the season counters.
    Called by the nightly scheduler for the previous calendar day.

    Status rules:
      - 'perfect'  = all missions done (missions_done == missions_total)
      - 'complete' = ≥ 60% done (streak-qualifying)
      - 'missed'   = < 60% done
    """
    if missions_total <= 0:
        return

    pct = missions_done / missions_total
    if missions_done >= missions_total:
        day_status = "perfect"
    elif pct >= 0.60:
        day_status = "complete"
    else:
        day_status = "missed"

    # Upsert the day log row
    await run_query(
        supabase_admin.table("season_day_log").upsert(
            {
                "user_id":        user_id,
                "season_id":      season_id,
                "day_number":     day_number,
                "log_date":       log_date,
                "status":         day_status,
                "missions_done":  missions_done,
                "missions_total": missions_total,
            },
            on_conflict="season_id,day_number",
        )
    )

    # Recount all counters from the log (source of truth)
    all_rows_result = await run_query(
        supabase_admin.table("season_day_log")
        .select("status")
        .eq("season_id", season_id)
    )
    all_rows = all_rows_result.data or []

    new_completed = sum(1 for r in all_rows if r["status"] in ("perfect", "complete"))
    new_perfect   = sum(1 for r in all_rows if r["status"] == "perfect")
    new_missed    = sum(1 for r in all_rows if r["status"] == "missed")

    # Recompute current phase from the season row
    season_result = await run_query(
        supabase_admin.table("user_seasons")
        .select("season_number, started_at, total_days")
        .eq("id", season_id)
        .single()
    )
    season = season_result.data or {}
    from app.services.mission_service import get_user_date
    tz_result = await run_query(
        supabase_admin.table("users").select("timezone").eq("id", user_id).single()
    )
    tz = (tz_result.data or {}).get("timezone", "UTC") or "UTC"
    today = get_user_date(tz)
    current_day = min(
        _current_day_number(str(season.get("started_at", today)), today),
        int(season.get("total_days", 30)),
    )
    current_phase = get_season_phase(int(season.get("season_number", 1)), current_day)

    await run_query(
        supabase_admin.table("user_seasons").update({
            "days_completed": new_completed,
            "days_perfect":   new_perfect,
            "days_missed":    new_missed,
            "current_phase":  current_phase,
        }).eq("id", season_id)
    )

    logger.info(
        "season_day_recorded user=%s season_id=%s day=%d status=%s",
        user_id, season_id, day_number, day_status,
    )


async def close_expired_season(user_id: str, season: dict, today: str) -> dict:
    """
    Closes a season whose ends_at is before today.
    Computes the final tier, awards XP, writes the Twin closing entry.
    Sets status to 'completed' or 'failed'. Sets completion_seen = False
    so the frontend HomeScreen shows the 'season ended' prompt.

    Returns the updated season dict.
    Called by the nightly scheduler.
    """
    season_id      = str(season["id"])
    season_number  = int(season["season_number"])
    season_name    = str(season.get("season_name", ""))
    total_days     = int(season["total_days"])
    days_completed = int(season.get("days_completed") or 0)
    days_perfect   = int(season.get("days_perfect")   or 0)
    days_missed    = int(season.get("days_missed")     or 0)

    tier     = get_season_completion_tier(days_completed, total_days)
    status   = "failed" if tier == "failed" else "completed"
    xp       = get_season_xp(tier, season_number)
    title    = get_season_title(season_number, tier)
    closing  = get_season_twin_closing(
        tier=tier,
        season_name=season_name,
        days_completed=days_completed,
        total_days=total_days,
        days_missed=days_missed,
        days_perfect=days_perfect,
    )

    update_payload: dict = {
        "status":             status,
        "completion_tier":    tier,
        "completion_seen":    False,
        "xp_awarded":         xp,
        "title_unlocked":     title,
        "twin_closing_entry": closing,
    }

    await run_query(
        supabase_admin.table("user_seasons")
        .update(update_payload)
        .eq("id", season_id)
    )

    # Award XP to user if earned
    if xp > 0:
        try:
            user_result = await run_query(
                supabase_admin.table("users")
                .select("total_xp")
                .eq("id", user_id)
                .single()
            )
            current_xp = int((user_result.data or {}).get("total_xp") or 0)
            await run_query(
                supabase_admin.table("users")
                .update({"total_xp": current_xp + xp})
                .eq("id", user_id)
            )
        except Exception as e:
            logger.error(
                "close_expired_season xp_award failed user=%s: %s", user_id, str(e)[:200]
            )

    logger.info(
        "season_closed user=%s season_number=%d tier=%s status=%s xp=%d",
        user_id, season_number, tier, status, xp,
    )
    return {**season, **update_payload}


async def begin_next_season(user_id: str, current_season_number: int, timezone_str: str) -> dict | None:
    """
    Creates the next season row after the user acknowledges the completion screen.
    Called by POST /api/v1/seasons/begin-next.
    Returns the new active season row.
    """
    from app.services.mission_service import get_user_date

    next_number = current_season_number + 1
    meta        = get_season_metadata(next_number)
    today       = get_user_date(timezone_str)
    started_at  = today
    ends_at     = str(date.fromisoformat(today) + timedelta(days=meta["total_days"] - 1))

    # Fetch archetype for the name variant
    try:
        user_result = await run_query(
            supabase_admin.table("users").select("archetype").eq("id", user_id).single()
        )
        archetype = (user_result.data or {}).get("archetype", "") or ""
    except Exception:
        archetype = ""

    archetype_key  = archetype.lower().replace(" ", "_").replace("-", "_")
    archetype_name = (meta.get("archetype_names") or {}).get(archetype_key, meta["season_name"])

    insert_result = await run_query(
        supabase_admin.table("user_seasons").insert({
            "user_id":               user_id,
            "season_number":         next_number,
            "season_name":           meta["season_name"],
            "archetype_season_name": archetype_name,
            "season_theme":          meta["season_theme"],
            "season_color":          meta["season_color"],
            "status":                "active",
            "total_days":            meta["total_days"],
            "current_phase":         1,
            "started_at":            started_at,
            "ends_at":               ends_at,
            "days_completed":        0,
            "days_perfect":          0,
            "days_missed":           0,
        })
    )
    rows = insert_result.data or []
    if not rows:
        logger.error(
            "begin_next_season insert failed user=%s next_number=%d", user_id, next_number
        )
        return None

    logger.info(
        "season_started user=%s season_number=%d started_at=%s ends_at=%s",
        user_id, next_number, started_at, ends_at,
    )
    return rows[0]


async def mark_completion_seen(user_id: str, season_id: str) -> None:
    """
    Sets completion_seen = True on the season row.
    Called when the user views the completion screen (POST /api/v1/seasons/seen).
    This hides the 'season ended' prompt on HomeScreen.
    """
    await run_query(
        supabase_admin.table("user_seasons")
        .update({"completion_seen": True})
        .eq("id", season_id)
        .eq("user_id", user_id)
    )
