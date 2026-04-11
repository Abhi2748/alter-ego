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

import hashlib
import json
import logging
import random
from datetime import datetime, timedelta, date as date_type, timezone
from zoneinfo import ZoneInfo

from app.core.constants import GAP_THRESHOLDS, TWIN_CHAT_MAX_USER_MSGS_PER_HOUR
from app.core.supabase_client import supabase_admin, run_query
from app.services.twin_tone_mix import normalize_twin_tone, pick_mixed_tone_for_message

logger = logging.getLogger(__name__)


class TwinChatRateLimited(Exception):
    """Too many user messages in the rolling window — avoids runaway LLM cost."""


def _assert_twin_chat_rate_limit(user_id: str) -> None:
    """Hard cap user messages per hour (DB count before any LLM calls)."""
    window_start = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    res = (
        supabase_admin.table("twin_messages")
        .select("id")
        .eq("user_id", user_id)
        .eq("role", "user")
        .gte("created_at", window_start)
        .limit(TWIN_CHAT_MAX_USER_MSGS_PER_HOUR + 1)
        .execute()
    )
    if len(res.data or []) > TWIN_CHAT_MAX_USER_MSGS_PER_HOUR:
        raise TwinChatRateLimited()


def compute_gap_state_from_totals(user_xp: int, twin_xp: int) -> str:
    """Same gap buckets as simulate_twin_day (lifetime XP vs lifetime twin XP)."""
    user_passed_twin = user_xp > twin_xp
    if user_passed_twin:
        return "user_ahead"
    gap_xp = twin_xp - user_xp
    gap_pct = gap_xp / max(user_xp, 1)
    if gap_pct <= GAP_THRESHOLDS["neck_and_neck"]:
        return "neck_and_neck"
    if gap_pct <= GAP_THRESHOLDS["slightly_behind"]:
        return "slightly_behind"
    return "significantly_behind"


async def refresh_twin_gap_state(user_id: str) -> tuple[str | None, str]:
    """
    Recompute current_gap_state from live lifetime totals (intraday user XP changes).
    Returns (previous_state, new_state) for callers that need to refresh strip copy.
    """
    user_result = await run_query(supabase_admin.table("users")
        .select("total_xp")
        .eq("id", user_id)
        .single())
    twin_result = await run_query(supabase_admin.table("twin_state")
        .select("twin_xp, current_gap_state")
        .eq("user_id", user_id)
        .single())
    if not twin_result.data:
        return None, "neck_and_neck"

    user_xp = int((user_result.data or {}).get("total_xp") or 0)
    twin_xp = int(twin_result.data.get("twin_xp") or 0)
    old_gs = twin_result.data.get("current_gap_state")
    new_gs = compute_gap_state_from_totals(user_xp, twin_xp)
    old_s = str(old_gs) if old_gs is not None else None
    if old_s != new_gs:
        await run_query(supabase_admin.table("twin_state").update({"current_gap_state": new_gs}).eq("user_id", user_id))
    return old_s, new_gs


# ── ARCHETYPE PILLAR PREFERENCES ─────────────────────────────────────────────
# Score 1–5: higher = Twin prefers this pillar (completes first when capacity limited)
# Lower score = Twin skips this when below full capacity
# Mirrors the psychological profile of each archetype.

ARCHETYPE_PILLAR_PREFERENCE: dict[str, dict[str, int]] = {
    "structured_climber": {
        # Systems-first: sleep/movement are non-negotiable structure
        "sleep": 5,
        "movement": 5,
        "no_phone": 4,
        "hydration": 3,
        "mindfulness": 2,
    },
    "lone_wolf": {
        # Self-reliant: physical discipline + distraction removal
        "movement": 5,
        "no_phone": 5,
        "sleep": 4,
        "hydration": 3,
        "mindfulness": 2,
    },
    "restless_creator": {
        # Energy/mood first: mindfulness and movement, skips rigid habits
        "mindfulness": 5,
        "movement": 4,
        "hydration": 3,
        "sleep": 3,
        "no_phone": 2,
    },
    "reluctant_achiever": {
        # Low-friction first: hydration and mindfulness are easy; avoids movement
        "hydration": 5,
        "mindfulness": 4,
        "sleep": 3,
        "no_phone": 2,
        "movement": 2,
    },
    "social_performer": {
        # Visible/physical: movement and sleep for performance, skips internal habits
        "movement": 5,
        "sleep": 4,
        "hydration": 4,
        "no_phone": 3,
        "mindfulness": 2,
    },
}

_DEFAULT_PILLAR_PREFERENCE: dict[str, int] = {
    "sleep": 4,
    "movement": 4,
    "hydration": 3,
    "mindfulness": 3,
    "no_phone": 3,
}


def _mission_local_hour_window(
    title: str,
    core_pillar: str | None,
    mission_type: str | None,
    is_journal_mission: bool | None,
) -> tuple[int, int]:
    """
    Returns inclusive [hour_min, hour_max] in local time for when this mission is plausible.
    Night/sleep missions must not appear in the morning feed.
    """
    t = (title or "").lower()
    p = (str(core_pillar or "")).lower()
    mt = (str(mission_type or "")).lower()

    # ── Journal ─────────────────────────────────────────────────────────
    # Evening reflection — never afternoon
    if is_journal_mission or "journal" in t or p == "journal":
        return (20, 22)

    # ── Sleep ────────────────────────────────────────────────────────────
    # Sleep missions are always night
    if any(
        k in t
        for k in (
            "bed",
            "bedtime",
            "midnight",
            "before midnight",
            "by midnight",
            "sleep",
            "before bed",
            "tonight",
            "night routine",
        )
    ):
        return (21, 23)
    if p == "sleep" or ("sleep" in t and "phone" not in t):
        return (21, 23)

    # ── Morning keywords (explicit) ──────────────────────────────────────
    if any(k in t for k in ("morning", "wake", "first thing", "sunrise")):
        return (6, 8)

    # ── Movement / Exercise ──────────────────────────────────────────────
    # Twin is a morning person — done before most people wake up
    if any(k in t for k in ("walk", "movement", "workout", "exercise", "gym", "steps", "run", "jog")):
        return (6, 8)
    if p == "movement":
        return (6, 8)

    # ── Mindfulness / Meditation ─────────────────────────────────────────
    # After morning movement — brief stillness window
    if any(k in t for k in ("mindful", "meditat", "breath", "reflect", "stillness")):
        return (7, 9)
    if p in ("mindfulness", "meditation"):
        return (7, 9)

    # ── Hydration ────────────────────────────────────────────────────────
    # Spread throughout the day: morning start or midday top-up
    # Using a wider window; hash-based selection will distribute naturally
    if any(k in t for k in ("hydration", "water", "glass of water", "drink")) and "before bed" not in t:
        return (8, 15)

    # ── No Phone / Screen ────────────────────────────────────────────────
    # Afternoon focus window
    if "phone" in t or p == "no_phone" or "screen" in t:
        return (13, 15)

    # ── Interest / Resistance ────────────────────────────────────────────
    # Late morning to early afternoon
    if mt in ("interest", "resistance"):
        return (10, 14)

    # ── Personal ─────────────────────────────────────────────────────────
    if mt == "personal":
        return (9, 18)

    # ── Default ──────────────────────────────────────────────────────────
    return (8, 18)


def _stable_minute(seed: str) -> int:
    h = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return int(h[:8], 16) % 46  # 0–45, stable per mission+day


def _assign_simulated_times_for_missions(
    mission_rows: list[dict],
    mission_date: str,
) -> list[tuple[dict, int, int]]:
    """
    Returns (mission_row, hour, minute) in chronological order for the simulated day.
    """
    enriched: list[tuple[tuple[int, int, int], dict]] = []
    for r in mission_rows:
        w = _mission_local_hour_window(
            str(r.get("title") or ""),
            r.get("core_pillar"),
            r.get("type"),
            r.get("is_journal_mission"),
        )
        tie = hash(str(r.get("title", "")) + mission_date) % 10000
        enriched.append(((w[0], w[1], tie), r))

    enriched.sort(key=lambda x: x[0])
    out: list[tuple[dict, int, int]] = []
    for idx, (_, r) in enumerate(enriched):
        w = _mission_local_hour_window(
            str(r.get("title") or ""),
            r.get("core_pillar"),
            r.get("type"),
            r.get("is_journal_mission"),
        )
        lo, hi = w
        span = max(1, hi - lo + 1)
        seed = f"{mission_date}|{r.get('title')}|{r.get('id')}|{idx}"
        h = lo + (abs(int(hashlib.md5(seed.encode()).hexdigest(), 16)) % span)
        minute = _stable_minute(seed + "|minute")
        out.append((r, h, minute))
    out.sort(key=lambda x: (x[1], x[2]))
    return out


def _sort_missions_by_twin_preference(
    missions: list[dict],
    archetype: str,
) -> list[dict]:
    """
    Sort missions so the Twin's preferred ones come first.
    When the Twin operates below full capacity, it completes the top of
    this list and skips the bottom — giving it consistent archetype-driven
    preferences rather than random skipping.

    Preference order:
    1. Core pillar preference score (archetype-specific)
    2. Difficulty: easy > medium > hard (Twin completes easier ones on lower-energy days)
    3. Mission type: core > interest > resistance > personal
    """
    prefs = ARCHETYPE_PILLAR_PREFERENCE.get(
        str(archetype or "").lower().replace(" ", "_"),
        _DEFAULT_PILLAR_PREFERENCE,
    )

    difficulty_rank = {"easy": 3, "medium": 2, "hard": 1, "elite": 0}
    type_rank = {"core": 4, "interest": 3, "resistance": 2, "personal": 1}

    def _score(m: dict) -> tuple[int, int, int]:
        pillar = str(m.get("core_pillar") or "").lower()
        pillar_score = prefs.get(pillar, 3)  # default mid-preference
        diff = str(m.get("difficulty") or "medium").lower()
        diff_score = difficulty_rank.get(diff, 2)
        mt = str(m.get("type") or "core").lower()
        type_score = type_rank.get(mt, 1)
        return (pillar_score, diff_score, type_score)

    return sorted(missions, key=_score, reverse=True)


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
        await run_query(supabase_admin.table("twin_mission_log").delete().eq("user_id", user_id).eq("mission_date", today))

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

        mres = await run_query(supabase_admin.table("missions")
            .select("id, title, type, core_pillar, is_journal_mission")
            .eq("user_id", user_id)
            .in_("id", id_list))
        by_id = {str(r.get("id")): r for r in (mres.data or []) if r.get("id")}

        mission_rows: list[dict] = []
        for mid in id_list:
            r = by_id.get(str(mid))
            if not r:
                continue
            title = (r.get("title") or "").strip()
            if not title:
                continue
            mission_rows.append(r)

        assigned = _assign_simulated_times_for_missions(mission_rows, today)
        d = date_type.fromisoformat(today)
        rows: list[dict] = []
        for r, hour, minute in assigned:
            title = (r.get("title") or "").strip()
            local_dt = datetime(d.year, d.month, d.day, hour, minute, 0, tzinfo=tz)
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
                    "simulated_hour": hour,
                    "completed_at": completed_at,
                }
            )

        if rows:
            await run_query(supabase_admin.table("twin_mission_log").upsert(
                rows,
                on_conflict="user_id,mission_date,mission_title",
            ))

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


async def backfill_twin_mission_log_simulated_hours_for_date(mission_date: str) -> dict:
    """
    One-off maintenance: recompute `simulated_hour` and `completed_at` for every
    `twin_mission_log` row on `mission_date`, using `_assign_simulated_times_for_missions`
    (same as `record_twin_mission_log_from_daily_record` / `_mission_local_hour_window`).

    Match missions by user + mission_date + title (case-insensitive) to recover
    `id` and `is_journal_mission` for stable hashes; if no mission row exists,
    falls back to log fields only.
    """
    try:
        date_type.fromisoformat(mission_date)
    except ValueError as e:
        raise ValueError("mission_date must be YYYY-MM-DD") from e

    # Paginate — default PostgREST cap can truncate large selects.
    page_size = 1000
    offset = 0
    all_logs: list[dict] = []
    while True:
        res = await run_query(supabase_admin.table("twin_mission_log")
            .select("*")
            .eq("mission_date", mission_date)
            .range(offset, offset + page_size - 1))
        batch = res.data or []
        all_logs.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    if not all_logs:
        return {
            "mission_date": mission_date,
            "rows_updated": 0,
            "users_processed": 0,
            "event": "twin_mission_log_backfill_empty",
        }

    by_user: dict[str, list[dict]] = {}
    for row in all_logs:
        uid = str(row.get("user_id") or "")
        if not uid:
            continue
        by_user.setdefault(uid, []).append(row)

    rows_updated = 0
    for user_id, logs in by_user.items():
        tz_name = "UTC"
        try:
            ures = await run_query(supabase_admin.table("users")
                .select("timezone")
                .eq("id", user_id)
                .single())
            if ures.data:
                tz_name = (ures.data.get("timezone") or "UTC").strip() or "UTC"
        except Exception:
            tz_name = "UTC"
        try:
            tz = ZoneInfo(tz_name)
        except Exception:
            tz = ZoneInfo("UTC")

        mres = await run_query(supabase_admin.table("missions")
            .select("id, title, type, core_pillar, is_journal_mission")
            .eq("user_id", user_id)
            .eq("mission_date", mission_date))
        missions = mres.data or []
        by_title_lower: dict[str, dict] = {}
        for m in missions:
            key = (str(m.get("title") or "")).strip().lower()
            if key:
                by_title_lower[key] = m

        mission_rows: list[dict] = []
        for log in logs:
            key = (str(log.get("mission_title") or "")).strip().lower()
            m = by_title_lower.get(key)
            if m:
                mission_rows.append(dict(m))
            else:
                mission_rows.append(
                    {
                        "id": None,
                        "title": log.get("mission_title"),
                        "type": log.get("mission_type") or "core",
                        "core_pillar": log.get("core_pillar"),
                        "is_journal_mission": None,
                    }
                )

        assigned = _assign_simulated_times_for_missions(mission_rows, mission_date)
        hour_by_title: dict[str, tuple[int, int]] = {}
        for r, hour, minute in assigned:
            tk = (str(r.get("title") or "")).strip().lower()
            if tk:
                hour_by_title[tk] = (hour, minute)

        upserts: list[dict] = []
        for log in logs:
            tk = (str(log.get("mission_title") or "")).strip().lower()
            pair = hour_by_title.get(tk)
            if not pair:
                logger.warning(
                    json.dumps(
                        {
                            "event": "twin_mission_log_backfill_skip",
                            "user_id": user_id,
                            "mission_date": mission_date,
                            "mission_title": log.get("mission_title"),
                        }
                    )
                )
                continue
            hour, minute = pair
            day = date_type.fromisoformat(mission_date)
            local_dt = datetime(day.year, day.month, day.day, hour, minute, 0, tzinfo=tz)
            completed_at = local_dt.astimezone(timezone.utc).isoformat()
            mt = str(log.get("mission_type") or "core").lower()
            upserts.append(
                {
                    "user_id": user_id,
                    "mission_date": mission_date,
                    "mission_title": log.get("mission_title"),
                    "core_pillar": log.get("core_pillar"),
                    "mission_type": mt,
                    "simulated_hour": hour,
                    "completed_at": completed_at,
                }
            )

        if upserts:
            await run_query(supabase_admin.table("twin_mission_log").upsert(
                upserts,
                on_conflict="user_id,mission_date,mission_title",
            ))
            rows_updated += len(upserts)

    logger.info(
        json.dumps(
            {
                "event": "twin_mission_log_backfill_done",
                "mission_date": mission_date,
                "rows_updated": rows_updated,
                "users_processed": len(by_user),
            }
        )
    )
    return {
        "mission_date": mission_date,
        "rows_updated": rows_updated,
        "users_processed": len(by_user),
        "event": "twin_mission_log_backfill_done",
    }


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

# ── MIRROR MODEL CONSTANTS ────────────────────────────────────────────────────

ARCHETYPE_EARLY_FACTOR: dict[str, float] = {
    "structured_climber": 0.88,
    "lone_wolf": 0.85,
    "restless_creator": 0.82,
    "reluctant_achiever": 0.80,
    "social_performer": 0.84,
}
_DEFAULT_EARLY_FACTOR = 0.84

ARCHETYPE_DAY_MODIFIERS: dict[str, dict[int, float]] = {
    "structured_climber": {
        1: 1.04,
        2: 1.04,
        3: 1.03,
        4: 1.03,
        5: 1.03,
        6: 0.88,
        7: 0.88,
    },
    "lone_wolf": {
        1: 1.06,
        2: 0.92,
        3: 1.05,
        4: 0.90,
        5: 1.04,
        6: 0.95,
        7: 1.02,
    },
    "restless_creator": {
        1: 1.05,
        2: 1.04,
        3: 0.92,
        4: 0.91,
        5: 1.08,
        6: 0.88,
        7: 0.84,
    },
    "reluctant_achiever": {
        1: 0.88,
        2: 0.94,
        3: 0.98,
        4: 1.02,
        5: 1.06,
        6: 0.90,
        7: 0.82,
    },
    "social_performer": {
        1: 1.05,
        2: 1.05,
        3: 1.04,
        4: 1.03,
        5: 1.08,
        6: 0.90,
        7: 0.88,
    },
}
_DEFAULT_DAY_MODIFIER: dict[int, float] = {
    1: 1.0,
    2: 1.0,
    3: 1.0,
    4: 1.0,
    5: 1.0,
    6: 0.92,
    7: 0.90,
}

ARCHETYPE_NOISE_VARIANCE: dict[str, float] = {
    "structured_climber": 0.03,
    "lone_wolf": 0.06,
    "restless_creator": 0.05,
    "reluctant_achiever": 0.04,
    "social_performer": 0.04,
}
_DEFAULT_NOISE_VARIANCE = 0.04

OVEREXTENSION_MODIFIERS: dict[int, float] = {1: 0.82, 2: 0.86, 3: 0.90}

TWIN_ABSENCE_DAY1_FACTOR = 1.00
TWIN_ABSENCE_DAY2_FACTOR = 0.80

MIRROR_FACTOR_HIGH_PERFORMANCE = 1.05
MIRROR_FACTOR_GOOD_PERFORMANCE = 1.02
MIRROR_FACTOR_BASE = 0.95
MIRROR_FACTOR_STRUGGLING = 0.92
MIRROR_FACTOR_POOR = 0.88


def compute_mirror_factor(
    days_active: int,
    archetype: str,
    completion_rate_7d: float,
    calibration_count: int,
) -> float:
    """
    Returns the mirror factor for the twin's XP today.

    Days 1–3: Fixed archetype warm-up factor.
    Days 4–7: Linear ramp from archetype factor to MIRROR_FACTOR_BASE.
    Day 8+: Based on user's 7d completion rate (recalibrated every 7 days).
    """
    _ = calibration_count  # reserved for future tuning
    arch = str(archetype or "").lower().replace(" ", "_")
    early = ARCHETYPE_EARLY_FACTOR.get(arch, _DEFAULT_EARLY_FACTOR)

    if days_active <= 3:
        return early

    if days_active <= 7:
        t = (days_active - 3) / 4.0
        return round(early + t * (MIRROR_FACTOR_BASE - early), 3)

    cr = float(completion_rate_7d or 0)
    if cr > 90:
        return MIRROR_FACTOR_HIGH_PERFORMANCE
    if cr > 80:
        return MIRROR_FACTOR_GOOD_PERFORMANCE
    if cr > 50:
        return MIRROR_FACTOR_BASE
    if cr > 30:
        return MIRROR_FACTOR_STRUGGLING
    return MIRROR_FACTOR_POOR


def get_archetype_day_modifier(archetype: str, day_of_week: int) -> float:
    """day_of_week: isoweekday() 1=Monday … 7=Sunday."""
    arch = str(archetype or "").lower().replace(" ", "_")
    modifiers = ARCHETYPE_DAY_MODIFIERS.get(arch, _DEFAULT_DAY_MODIFIER)
    return float(modifiers.get(day_of_week, 1.0))


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


def update_twin_adaptive_state(
    supabase,
    user_id: str,
    twin_xp_earned_today: int,
    user_xp_earned_today: int,
    new_comeback_day: int,
    new_consecutive_absent: int,
    today: str,
    prev_rolling_avg: float,
    prev_character_stage: int,
    new_character_stage: int,
    daily_cap: int,
) -> None:
    """
    Writes new adaptive state columns to twin_state.
    Called after twin_daily_record is written.
    Silent on error — never blocks simulation.
    """
    import json as _json

    from app.core.constants import DAILY_XP_CAPS

    try:
        # Stage transition: rescale rolling avg proportionally
        new_rolling_avg = prev_rolling_avg
        if new_character_stage != prev_character_stage:
            try:
                prev_s = max(1, min(6, int(prev_character_stage)))
                new_s = max(1, min(6, int(new_character_stage)))
                old_cap = DAILY_XP_CAPS[prev_s]
                new_cap = DAILY_XP_CAPS[new_s]
                if old_cap > 0 and prev_rolling_avg > 0:
                    new_rolling_avg = prev_rolling_avg * (new_cap / old_cap)
            except (IndexError, ZeroDivisionError, KeyError):
                pass  # Keep old avg on error

        supabase.table("twin_state").update(
            {
                "twin_rolling_avg_xp": new_rolling_avg,
                "twin_yesterday_xp": twin_xp_earned_today,
                "twin_comeback_day": new_comeback_day,
                "twin_consecutive_absent": new_consecutive_absent,
                "twin_last_active_date": today if user_xp_earned_today > 0 else None,
            }
        ).eq("user_id", user_id).execute()

    except Exception as e:
        logger.error(
            _json.dumps(
                {
                    "event": "twin_adaptive_state_update_error",
                    "user_id": user_id,
                    "error": str(e)[:200],
                }
            )
        )


async def simulate_twin_day(user_id: str) -> dict:
    """
    Twin mission selection for the user's local calendar day (1am job).
    Writes twin_daily_record with XP/PF placeholders; twin XP is finalized at 11pm local.
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
    from app.services.mission_service import get_user_date

    user_result = await run_query(
        supabase_admin.table("users")
        .select(
            "total_xp, total_pf, character_stage, pet_stage, "
            "pet_unlocked, timezone, archetype, registration_date, streak_requirement_tier"
        )
        .eq("id", user_id)
        .single()
    )
    user = user_result.data

    twin_result = await run_query(
        supabase_admin.table("twin_state").select("*").eq("user_id", user_id).single()
    )
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

    existing_day = await run_query(
        supabase_admin.table("twin_daily_record")
        .select("id")
        .eq("user_id", user_id)
        .eq("record_date", today)
        .limit(1)
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

    missions_result = await run_query(
        supabase_admin.table("missions")
        .select("id, type, difficulty, xp_value, pf_value, title, is_journal_mission, completed")
        .eq("user_id", user_id)
        .eq("mission_date", today)
    )
    today_missions = missions_result.data or []
    if not today_missions:
        from app.services.mission_service import generate_core_missions_for_user, sync_today_planner_missions

        await generate_core_missions_for_user(user_id, today)
        await sync_today_planner_missions(user_id, today)
        missions_result = await run_query(
            supabase_admin.table("missions")
            .select("id, type, difficulty, xp_value, pf_value, title, is_journal_mission")
            .eq("user_id", user_id)
            .eq("mission_date", today)
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
    rhythm = ARCHETYPE_RHYTHMS.get(archetype, DEFAULT_RHYTHM)
    effective_base = rhythm["base_rate"]
    is_weekday = day_of_week <= 5
    if is_weekday:
        effective_base += rhythm["weekday_boost"]
    else:
        effective_base -= rhythm["weekend_penalty"]
    daily_variance = random.gauss(0, rhythm["variance"])
    today_rate = round(max(0.45, min(0.95, effective_base + daily_variance)), 3)

    core_missions = [m for m in today_missions if m.get("type") == "core" and not m.get("is_journal_mission")]
    non_core_missions = [m for m in today_missions if m not in core_missions]

    sorted_core = _sort_missions_by_twin_preference(core_missions, archetype)
    sorted_non_core = _sort_missions_by_twin_preference(non_core_missions, archetype)

    personal_ms = [m for m in sorted_non_core if m.get("type") == "personal"]
    rest_nc = [m for m in sorted_non_core if m.get("type") != "personal"]

    core_rate = min(0.97, today_rate + 0.10)
    core_target = round(len(sorted_core) * core_rate)
    non_core_target = round(len(sorted_non_core) * today_rate)
    non_core_target = min(len(sorted_non_core), max(0, non_core_target))

    if non_core_target > 0 and random.random() < 0.30:
        non_core_target = max(0, non_core_target - 1)

    completed_core = sorted_core[:core_target]

    nc_total = len(sorted_non_core)
    if nc_total > 0 and non_core_target > 0:
        p_cap = len(personal_ms)
        p_take = min(p_cap, max(0, round(non_core_target * p_cap / nc_total))) if p_cap else 0
        rem = min(len(rest_nc), max(0, non_core_target - p_take))
        completed_non_core = personal_ms[:p_take] + rest_nc[:rem]
    else:
        completed_non_core = []

    all_completed = completed_core + completed_non_core
    all_missed = [m for m in today_missions if m not in all_completed]

    daily_payload: dict = {
        "user_id": user_id,
        "record_date": today,
        "missions_assigned": len(today_missions),
        "missions_completed": len(all_completed),
        "completed_mission_ids": [m["id"] for m in all_completed],
        "missed_mission_titles": [m["title"] for m in all_missed],
        "xp_earned": 0,
        "pf_earned": 0,
        "consistency_ceiling_used": today_rate,
        "twin_streak_after": 0,
    }
    await run_query(
        supabase_admin.table("twin_daily_record").upsert(
            daily_payload,
            on_conflict="user_id,record_date",
        )
    )

    await record_twin_mission_log_from_daily_record(
        user_id,
        today,
        [m["id"] for m in all_completed],
        timezone_str,
    )

    logger.info(
        json.dumps(
            {
                "event": "twin_simulated",
                "user_id": user_id,
                "date": today,
                "missions_completed": len(all_completed),
                "rate": round(float(today_rate), 4),
                "note": "xp_pending_finalization",
            }
        )
    )

    return {
        "simulated": True,
        "missions_completed": len(all_completed),
        "missions_total": len(today_missions),
        "note": "xp_pending_finalization",
    }


async def finalize_twin_xp_for_day(user_id: str) -> dict:
    """
    Called at 11pm local time for each user.
    Reads the user's actual XP earned today, applies the Mirror Formula,
    and writes the twin's final XP for the day into twin_state and twin_daily_record.
    """
    try:
        return await _finalize_twin_xp_impl(user_id)
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "twin_finalize_xp_error",
                    "user_id": user_id,
                    "error": str(e)[:200],
                }
            )
        )
        return {"finalized": False, "reason": "error"}


async def _finalize_twin_xp_impl(user_id: str) -> dict:
    from app.core.constants import (
        DAILY_PF_CAPS,
        PF_THRESHOLDS,
        TOTAL_CHARACTER_STAGES,
        TOTAL_PET_STAGES,
        XP_THRESHOLDS,
        PET_UNLOCK_DAY,
    )
    from app.services.mission_service import get_days_since_registration, get_user_date
    from app.services.streak_service import evaluate_streak_requirement

    user_res = await run_query(
        supabase_admin.table("users")
        .select(
            "total_xp, total_pf, character_stage, pet_stage, pet_unlocked, "
            "timezone, archetype, registration_date, streak_requirement_tier"
        )
        .eq("id", user_id)
        .single()
    )
    user = user_res.data
    if not user:
        return {"finalized": False, "reason": "user_not_found"}

    timezone_str = str(user.get("timezone") or "UTC")
    today = get_user_date(timezone_str)
    try:
        tz = ZoneInfo(timezone_str)
    except Exception:
        tz = ZoneInfo("UTC")

    existing_rec = await run_query(
        supabase_admin.table("twin_daily_record")
        .select(
            "xp_earned, missions_completed, missions_assigned, completed_mission_ids, missed_mission_titles"
        )
        .eq("user_id", user_id)
        .eq("record_date", today)
        .limit(1)
    )
    rec_rows = existing_rec.data or []

    if rec_rows and int(rec_rows[0].get("xp_earned") or 0) > 0:
        return {"finalized": False, "reason": "already_finalized"}

    if not rec_rows:
        return {"finalized": False, "reason": "no_twin_daily_record"}

    twin_res = await run_query(
        supabase_admin.table("twin_state")
        .select(
            "twin_xp, twin_pf, twin_character_stage, twin_pet_stage, "
            "twin_pet_unlocked, twin_streak, current_gap_state, "
            "twin_consecutive_absent, twin_overextension_day, twin_rolling_avg_xp"
        )
        .eq("user_id", user_id)
        .single()
    )
    twin = twin_res.data
    if not twin:
        return {"finalized": False, "reason": "twin_state_not_found"}

    dna_res = await run_query(
        supabase_admin.table("discipline_dna")
        .select("completion_rate_7d, calibration_count")
        .eq("user_id", user_id)
        .single()
    )
    dna = dna_res.data or {}
    completion_rate_7d = float(dna.get("completion_rate_7d") or 50)
    if completion_rate_7d <= 1.0:
        completion_rate_7d *= 100.0
    calibration_count = int(dna.get("calibration_count") or 0)

    xp_log_res = await run_query(
        supabase_admin.table("xp_log").select("amount").eq("user_id", user_id).eq("log_date", today)
    )
    user_xp_today = sum(int(r.get("amount") or 0) for r in (xp_log_res.data or []))

    today_date = date_type.fromisoformat(today)
    week_ago = str(today_date - timedelta(days=7))
    xp_week_res = await run_query(
        supabase_admin.table("xp_log")
        .select("amount, log_date")
        .eq("user_id", user_id)
        .gte("log_date", week_ago)
        .lt("log_date", today)
    )
    xp_week_rows = xp_week_res.data or []
    rolling_avg = (
        sum(int(r.get("amount") or 0) for r in xp_week_rows) / 7.0 if xp_week_rows else 50.0
    )
    rolling_avg = max(30.0, rolling_avg)

    twin_consecutive_absent = int(twin.get("twin_consecutive_absent") or 0)
    twin_overextension_day = int(twin.get("twin_overextension_day") or 0)
    prev_twin_xp = int(twin.get("twin_xp") or 0)
    prev_twin_pf = int(twin.get("twin_pf") or 0)

    days_active = max(
        0,
        get_days_since_registration(str(user.get("registration_date") or ""), timezone_str) - 1,
    )

    archetype = str(user.get("archetype") or "structured_climber")
    day_of_week = datetime.now(tz).isoweekday()

    user_is_active = user_xp_today > 0
    new_consecutive_absent = twin_consecutive_absent
    new_overextension_day = 0

    if user_is_active:
        new_consecutive_absent = 0

        mirror = compute_mirror_factor(
            days_active, archetype, completion_rate_7d, calibration_count
        )
        day_mod = get_archetype_day_modifier(archetype, day_of_week)
        over_mod = OVEREXTENSION_MODIFIERS.get(twin_overextension_day, 1.0)

        arch_key = archetype.lower().replace(" ", "_")
        noise_var = ARCHETYPE_NOISE_VARIANCE.get(arch_key, _DEFAULT_NOISE_VARIANCE)
        noise = 1.0 + random.gauss(0, noise_var)

        twin_xp_today = int(round(user_xp_today * mirror * day_mod * over_mod * noise))
        twin_xp_today = max(0, twin_xp_today)

        if twin_overextension_day > 0:
            new_overextension_day = twin_overextension_day + 1
            if new_overextension_day > 3:
                new_overextension_day = 0
        else:
            new_overextension_day = 0

    elif twin_consecutive_absent == 0:
        twin_xp_today = int(round(rolling_avg * TWIN_ABSENCE_DAY1_FACTOR))
        new_consecutive_absent = 1
        new_overextension_day = twin_overextension_day

    elif twin_consecutive_absent == 1:
        twin_xp_today = int(round(rolling_avg * TWIN_ABSENCE_DAY2_FACTOR))
        new_consecutive_absent = 2
        new_overextension_day = twin_overextension_day

    else:
        twin_xp_today = 0
        new_consecutive_absent = twin_consecutive_absent + 1
        new_overextension_day = twin_overextension_day

    twin_stage = int(twin.get("twin_character_stage") or 1)
    pf_cap = int(DAILY_PF_CAPS.get(twin_stage, 160))

    rec = rec_rows[0]
    missions_completed = int(rec.get("missions_completed") or 0)
    missions_assigned = int(rec.get("missions_assigned") or 1)
    today_missions_res = await run_query(
        supabase_admin.table("missions")
        .select("pf_value")
        .eq("user_id", user_id)
        .eq("mission_date", today)
    )
    raw_pf_total = sum(int(r.get("pf_value") or 0) for r in (today_missions_res.data or []))
    completion_ratio = missions_completed / max(missions_assigned, 1)
    twin_pf_today = min(pf_cap, int(round(raw_pf_total * completion_ratio)))

    new_twin_xp = prev_twin_xp + twin_xp_today
    new_twin_pf = prev_twin_pf + twin_pf_today

    new_twin_stage = twin_stage
    if twin_stage < TOTAL_CHARACTER_STAGES and new_twin_xp >= XP_THRESHOLDS[twin_stage]:
        new_twin_stage = twin_stage + 1

    twin_pet_stage = int(twin.get("twin_pet_stage") or 0)
    twin_pet_unlocked = bool(twin.get("twin_pet_unlocked"))
    new_twin_pet_stage = twin_pet_stage
    days_since_reg = get_days_since_registration(str(user.get("registration_date") or ""), timezone_str)

    if days_since_reg >= PET_UNLOCK_DAY and not twin_pet_unlocked:
        twin_pet_unlocked = True
        new_twin_pet_stage = 1

    if twin_pet_unlocked and twin_pet_stage < TOTAL_PET_STAGES:
        if new_twin_pf >= PF_THRESHOLDS[twin_pet_stage]:
            new_twin_pet_stage = twin_pet_stage + 1

    streak_tier = str(user.get("streak_requirement_tier") or "tier_1")
    completed_ids = rec.get("completed_mission_ids") or []
    today_m_res = await run_query(
        supabase_admin.table("missions")
        .select("id, type, is_journal_mission, completed")
        .eq("user_id", user_id)
        .eq("mission_date", today)
    )
    today_m = today_m_res.data or []
    done_set = {str(x) for x in completed_ids}
    twin_view = [{**m, "completed": str(m.get("id")) in done_set} for m in today_m]
    today_met = evaluate_streak_requirement(twin_view, streak_tier)

    yesterday = str(today_date - timedelta(days=1))
    y_missions_res = await run_query(
        supabase_admin.table("missions")
        .select("id, type, is_journal_mission, completed")
        .eq("user_id", user_id)
        .eq("mission_date", yesterday)
    )
    y_missions = y_missions_res.data or []
    y_rec_res = await run_query(
        supabase_admin.table("twin_daily_record")
        .select("completed_mission_ids")
        .eq("user_id", user_id)
        .eq("record_date", yesterday)
        .limit(1)
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

    user_total_xp = int(user.get("total_xp") or 0)
    user_xp_before_today = max(0, user_total_xp - user_xp_today)
    gap_state = compute_gap_state_from_totals(user_total_xp, new_twin_xp)

    twin_just_crossed = (
        user_is_active
        and prev_twin_xp <= user_total_xp
        and new_twin_xp > user_total_xp
    )
    if twin_just_crossed:
        new_overextension_day = 1
        logger.info(
            json.dumps(
                {
                    "event": "twin_crossed_user",
                    "user_id": user_id,
                    "new_twin_xp": new_twin_xp,
                    "user_total_xp": user_total_xp,
                }
            )
        )

    user_just_crossed = (
        user_is_active
        and user_xp_before_today < prev_twin_xp
        and user_total_xp > new_twin_xp
    )
    twin_state_patch: dict = {
        "twin_xp": new_twin_xp,
        "twin_pf": new_twin_pf,
        "twin_character_stage": new_twin_stage,
        "twin_pet_stage": new_twin_pet_stage,
        "twin_pet_unlocked": twin_pet_unlocked,
        "twin_streak": new_twin_streak,
        "current_gap_state": gap_state,
        "twin_consecutive_absent": new_consecutive_absent,
        "twin_overextension_day": new_overextension_day,
        "twin_rolling_avg_xp": rolling_avg,
        "twin_yesterday_xp": twin_xp_today,
    }

    if user_just_crossed:
        new_overextension_day = 0
        twin_state_patch["twin_overextension_day"] = 0
        twin_state_patch["last_passed_at"] = datetime.now(timezone.utc).isoformat()
        try:
            from app.services.gap_moment_service import queue_gap_moment

            await queue_gap_moment(user_id, "passed_twin")
        except Exception:
            pass

    await run_query(
        supabase_admin.table("twin_daily_record")
        .update(
            {
                "xp_earned": twin_xp_today,
                "pf_earned": twin_pf_today,
                "twin_streak_after": new_twin_streak,
            }
        )
        .eq("user_id", user_id)
        .eq("record_date", today)
    )

    await run_query(
        supabase_admin.table("twin_state")
        .update(twin_state_patch)
        .eq("user_id", user_id)
    )

    logger.info(
        json.dumps(
            {
                "event": "twin_xp_finalized",
                "user_id": user_id,
                "date": today,
                "user_xp_today": user_xp_today,
                "twin_xp_today": twin_xp_today,
                "new_twin_xp": new_twin_xp,
                "gap_state": gap_state,
                "overextension_day": new_overextension_day,
                "consecutive_absent": new_consecutive_absent,
            }
        )
    )

    return {
        "finalized": True,
        "user_xp_today": user_xp_today,
        "twin_xp_today": twin_xp_today,
        "gap_state": gap_state,
        "twin_crossed_user": twin_just_crossed,
        "user_crossed_twin": user_just_crossed,
    }


async def ensure_twin_simulated_for_today(user_id: str) -> None:
    """
    If there is no twin_daily_record for the user's local today,
    run simulate_twin_day (mission selection only) once.
    XP is finalized at 11pm by finalize_twin_xp_for_day.
    """
    from app.services.mission_service import get_user_date

    user_row = await run_query(supabase_admin.table("users")
        .select("timezone, onboarding_complete")
        .eq("id", user_id)
        .single())
    user = user_row.data or {}
    if not user.get("onboarding_complete"):
        return

    today = get_user_date(user.get("timezone", "UTC") or "UTC")
    existing = await run_query(supabase_admin.table("twin_daily_record")
        .select("id")
        .eq("user_id", user_id)
        .eq("record_date", today)
        .limit(1))
    if existing.data:
        return

    # Avoid calling simulate on every request before missions exist for today.
    has_mission = await run_query(supabase_admin.table("missions")
        .select("id")
        .eq("user_id", user_id)
        .eq("mission_date", today)
        .limit(1))
    if not has_mission.data:
        return

    await simulate_twin_day(user_id)


async def ensure_twin_journal_backfilled(user_id: str) -> None:
    """
    Create twin_journal rows for recent calendar days where twin_daily_record exists but
    journal is missing (e.g. day 1 simulated on-demand so the 1am job never wrote a journal).

    Fills at most 3 days per call, prioritizing yesterday, then older gaps, then today.
    """
    from datetime import date as date_type, timedelta

    from app.services.mission_service import get_user_date

    try:
        user_row = await run_query(supabase_admin.table("users")
            .select("timezone")
            .eq("id", user_id)
            .single())
        tz = str((user_row.data or {}).get("timezone") or "UTC").strip() or "UTC"
        today = get_user_date(tz)
        anchor = date_type.fromisoformat(today)

        # Do not backfill "today" — same rule as generate_and_store_twin_journal (released after midnight).
        order: list[str] = [str(anchor - timedelta(days=i)) for i in range(1, 8)]
        seen: set[str] = set()
        filled = 0
        max_fill = 3
        for d_str in order:
            if d_str in seen:
                continue
            seen.add(d_str)
            if filled >= max_fill:
                break
            rec = await run_query(supabase_admin.table("twin_daily_record")
                .select("id")
                .eq("user_id", user_id)
                .eq("record_date", d_str)
                .limit(1))
            if not rec.data:
                continue
            jr = await run_query(supabase_admin.table("twin_journal")
                .select("id")
                .eq("user_id", user_id)
                .eq("entry_date", d_str)
                .limit(1))
            if jr.data:
                continue
            await generate_and_store_twin_journal(user_id, d_str)
            filled += 1
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "twin_journal_backfill_error",
                    "user_id": user_id,
                    "error": str(e)[:200],
                }
            )
        )


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
    from app.services.mission_service import get_user_date

    try:
        existing = await run_query(supabase_admin.table("twin_journal")
            .select("id")
            .eq("user_id", user_id)
            .eq("entry_date", today)
            .limit(1))
        if existing.data:
            return

        tz_row = await run_query(supabase_admin.table("users")
            .select("timezone")
            .eq("id", user_id)
            .single())
        tz = str((tz_row.data or {}).get("timezone") or "UTC").strip() or "UTC"
        # Journal for calendar day D is written only after D ends (midnight job uses "yesterday").
        # Never generate for the user's current local date — avoids wrong mission/XP snapshots.
        if today == get_user_date(tz):
            return

        rec_res = await run_query(supabase_admin.table("twin_daily_record")
            .select("missions_completed, missions_assigned, missed_mission_titles, xp_earned, twin_streak_after")
            .eq("user_id", user_id)
            .eq("record_date", today)
            .limit(1))
        rows = rec_res.data or []
        if not rows:
            return

        twin_record = rows[0]

        twin_log_rows = (
            ((await run_query(supabase_admin.table("twin_mission_log")
            .select("core_pillar, mission_type, simulated_hour")
            .eq("user_id", user_id)
            .eq("mission_date", today))).data)
            or []
        )
        twin_missions_completed_count = int(twin_record.get("missions_completed") or 0)
        twin_missions_total_count = int(twin_record.get("missions_assigned") or 0)
        twin_completed_pillars = list(
            {
                str(r.get("core_pillar") or "").lower()
                for r in twin_log_rows
                if r.get("core_pillar")
            }
        )
        twin_started_hour: int | None = None
        if twin_log_rows:
            hours = [
                int(r.get("simulated_hour") or 99)
                for r in twin_log_rows
                if r.get("simulated_hour") is not None
            ]
            if hours:
                twin_started_hour = min(hours)

        user_res = await run_query(supabase_admin.table("users")
            .select("archetype, registration_date, timezone, current_streak, last_streak_date")
            .eq("id", user_id)
            .single())
        journal_user = user_res.data or {}

        journal_dna: dict = {}
        try:
            dna_res = await run_query(supabase_admin.table("discipline_dna")
                .select("narrative_seed")
                .eq("user_id", user_id)
                .single())
            journal_dna = dna_res.data or {}
        except Exception:
            journal_dna = {}
        narrative_seed: str | None = journal_dna.get("narrative_seed") or None
        # Twin streak for this journal day — from the same simulation row (not live twin_state).
        twin_streak = int(twin_record.get("twin_streak_after") or 0)

        tz = str(journal_user.get("timezone") or "UTC")
        try:
            reg_dt = datetime.fromisoformat(
                str(journal_user.get("registration_date") or "").replace("Z", "+00:00")
            )
            reg_day = reg_dt.astimezone(ZoneInfo(tz)).date()
        except Exception:
            reg_day = date_type.today()
        try:
            journal_day = date_type.fromisoformat(today[:10])
        except Exception:
            journal_day = date_type.today()
        reg_n_as_of = max(1, (journal_day - reg_day).days + 1)
        days_active = max(0, reg_n_as_of - 1)
        phase_data = get_relationship_phase(days_active)
        relationship_phase = str(phase_data.get("phase") or "observer")
        archetype = str(journal_user.get("archetype") or "structured_climber")

        # User's actual missions that day (not Twin's simulated completion counts)
        um_rows = (
            ((await run_query(supabase_admin.table("missions")
            .select("completed, xp_value")
            .eq("user_id", user_id)
            .eq("mission_date", today))).data)
            or []
        )
        missions_total = len(um_rows)
        missions_completed = sum(1 for m in um_rows if m.get("completed"))
        xp_from_completed_missions = sum(
            int(m.get("xp_value") or 0) for m in um_rows if m.get("completed")
        )

        twin_xp_today = int(twin_record.get("xp_earned") or 0)
        xp_log_rows = (
            ((await run_query(supabase_admin.table("xp_log")
            .select("amount")
            .eq("user_id", user_id)
            .eq("log_date", today))).data)
            or []
        )
        xp_log_sum = sum(int(r.get("amount") or 0) for r in xp_log_rows)

        streak_row_res = await run_query(supabase_admin.table("streak_log")
            .select("xp_earned, streak_count")
            .eq("user_id", user_id)
            .eq("log_date", today)
            .limit(1))
        streak_day = (streak_row_res.data or [None])[0]

        # XP: ledger first; streak_log matches process_streak snapshot; mission sum if ledger empty
        # (avoids 0 XP when journal is backfilled or xp_log rows are missing but missions completed).
        if xp_log_sum > 0:
            user_xp_today = xp_log_sum
        elif streak_day is not None and int(streak_day.get("xp_earned") or 0) > 0:
            user_xp_today = int(streak_day.get("xp_earned") or 0)
        elif xp_from_completed_missions > 0:
            user_xp_today = xp_from_completed_missions
        else:
            user_xp_today = 0

        # Streak: never use users.current_streak alone — it reflects *now*, so backfills show 0 after a break.
        last_sd = str(journal_user.get("last_streak_date") or "")[:10]
        if streak_day is not None:
            user_streak = int(streak_day.get("streak_count") or 0)
        elif last_sd == today:
            user_streak = int(journal_user.get("current_streak") or 0)
        else:
            user_streak = 0

        completion_hour: int | None = None
        try:
            um = await run_query(supabase_admin.table("missions")
                .select("completed_at")
                .eq("user_id", user_id)
                .eq("mission_date", today)
                .eq("completed", True)
                .order("completed_at", desc=True)
                .limit(1))
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

        try:
            prev_journals = (
                ((await run_query(supabase_admin.table("twin_journal")
                .select("content")
                .eq("user_id", user_id)
                .order("entry_date", desc=True)
                .limit(3))).data)
                or []
            )
            last_3_openings: list[str] = []
            for j in prev_journals:
                c = str(j.get("content") or "").strip()
                if c:
                    dot = c.find(". ")
                    first = c[: dot + 1] if 0 < dot < 80 else c[:80]
                    last_3_openings.append(first)
        except Exception:
            last_3_openings = []

        try:
            uj_res = await run_query(supabase_admin.table("journal_entries")
                .select("content")
                .eq("user_id", user_id)
                .eq("mission_date", today)
                .limit(1))
            user_journal_entry: str | None = None
            if uj_res.data:
                user_journal_entry = str(uj_res.data[0].get("content") or "").strip() or None
        except Exception:
            user_journal_entry = None

        try:
            content = await asyncio.to_thread(
                generate_twin_journal_entry,
                archetype=archetype,
                relationship_phase=relationship_phase,
                days_active=days_active,
                twin_missions_completed=twin_missions_completed_count,
                twin_missions_total=twin_missions_total_count,
                twin_completed_pillars=twin_completed_pillars,
                twin_xp_today=twin_xp_today,
                twin_streak=twin_streak,
                twin_started_hour=twin_started_hour,
                missions_completed=missions_completed,
                missions_total=missions_total,
                user_xp_today=user_xp_today,
                user_streak=user_streak,
                user_last_completion_hour=completion_hour,
                narrative_seed=narrative_seed,
                user_journal_entry=user_journal_entry,
                last_3_openings=last_3_openings,
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
            gap = abs(twin_xp_today - user_xp_today)
            content = fallback_template.format(
                N=days_active,
                done=missions_completed,
                total=missions_total,
                gap=f"{gap} XP (today)",
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

        await run_query(supabase_admin.table("twin_journal").upsert(
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
        ))

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


async def generate_journal_for_yesterday(user_id: str) -> None:
    """
    Called at local midnight (00:00) to write the Twin's journal for the day
    that just ended (yesterday from the perspective of the new day).
    The 1am twin_simulation_job still calls generate_and_store_twin_journal as a fallback.
    """
    from datetime import date as date_type, timedelta

    from app.services.mission_service import get_user_date

    try:
        user_row = await run_query(supabase_admin.table("users")
            .select("timezone")
            .eq("id", user_id)
            .single())
        tz = str((user_row.data or {}).get("timezone") or "UTC").strip() or "UTC"
        today = get_user_date(tz)
        yesterday = str(date_type.fromisoformat(today) - timedelta(days=1))
        await generate_and_store_twin_journal(user_id, yesterday)
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "journal_midnight_error",
                    "user_id": user_id,
                    "error": str(e)[:200],
                }
            )
        )


def parse_twin_mission_log_local_dt(
    row: dict,
    anchor: date_type,
    tz: ZoneInfo,
) -> datetime:
    """Local datetime when the twin is treated as having completed this mission (simulation schedule)."""
    ca = row.get("completed_at")
    if ca:
        try:
            raw = str(ca).replace("Z", "+00:00")
            sim_dt = datetime.fromisoformat(raw)
            if sim_dt.tzinfo is None:
                sim_dt = sim_dt.replace(tzinfo=timezone.utc)
            return sim_dt.astimezone(tz)
        except Exception:
            pass
    hour = int(row.get("simulated_hour") or 0)
    return datetime(anchor.year, anchor.month, anchor.day, hour, 0, 0, tzinfo=tz)


def partition_twin_mission_log_by_reveal(
    rows: list[dict],
    now_local: datetime,
    anchor: date_type,
    tz: ZoneInfo,
) -> tuple[list[dict], list[dict]]:
    """
    Split twin_mission_log rows into missions whose simulated time has passed (revealed)
    vs still in the future today (pending). Uses full completed_at (minute precision), not hour-only.
    """
    revealed: list[dict] = []
    pending: list[dict] = []
    for r in rows:
        dt = parse_twin_mission_log_local_dt(r, anchor, tz)
        if now_local >= dt:
            revealed.append(r)
        else:
            pending.append(r)
    key_fn = lambda x: parse_twin_mission_log_local_dt(x, anchor, tz).isoformat()
    revealed.sort(key=key_fn)
    pending.sort(key=key_fn)
    return revealed, pending


def mission_ids_for_revealed_twin_logs(
    user_id: str,
    today: str,
    revealed_rows: list[dict],
) -> list[str]:
    """Map revealed twin_mission_log rows to today's mission ids in schedule order."""
    if not revealed_rows:
        return []
    mres = (
        supabase_admin.table("missions")
        .select("id, title")
        .eq("user_id", user_id)
        .eq("mission_date", today)
        .execute()
    )
    by_title = {str(r.get("title") or "").strip().lower(): r for r in (mres.data or []) if r.get("title")}
    ordered: list[str] = []
    for row in revealed_rows:
        tk = str(row.get("mission_title") or "").strip().lower()
        m = by_title.get(tk)
        if m and m.get("id"):
            ordered.append(str(m["id"]))
    return ordered


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


def get_twin_xp_comparison(user_id: str, today: str, timezone_str: str) -> dict:
    """
    Returns user's XP earned today vs Twin's XP earned *so far* today (same rules as /twin/state).

    User: sum of xp_log for `today` (only real completions).

    Twin: twin_daily_record may already hold the full simulated day total; we only count XP for
    missions whose simulated local time has passed (partition_twin_mission_log_by_reveal), using
    the same proration as the Twin Comparison screen — so at 1am the strip does not show Twin's
    full-day XP bar while the day is still unfolding.
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

        tz_name = (timezone_str or "UTC").strip() or "UTC"
        try:
            tz = ZoneInfo(tz_name)
        except Exception:
            tz = ZoneInfo("UTC")
        now_local = datetime.now(tz)
        try:
            anchor = date_type.fromisoformat(today)
        except Exception:
            anchor = now_local.date()

        twin_log_rows = (
            supabase_admin.table("twin_mission_log")
            .select("mission_title, mission_type, core_pillar, simulated_hour, completed_at")
            .eq("user_id", user_id)
            .eq("mission_date", today)
            .execute()
            .data
            or []
        )
        revealed, _pending = partition_twin_mission_log_by_reveal(
            twin_log_rows, now_local, anchor, tz
        )

        twin_result = (
            supabase_admin.table("twin_daily_record")
            .select("xp_earned")
            .eq("user_id", user_id)
            .eq("record_date", today)
            .execute()
        )
        twin_rows = twin_result.data or []
        twin_xp_full = int(twin_rows[0].get("xp_earned") or 0) if twin_rows else 0

        # Intraday projection: before 11pm finalization xp_earned is 0; mirror user XP for display only.
        if twin_xp_full == 0 and user_xp > 0:
            try:
                from app.services.mission_service import get_days_since_registration as _gdsr

                _user_row = (
                    supabase_admin.table("users")
                    .select("archetype, registration_date, timezone")
                    .eq("id", user_id)
                    .single()
                    .execute()
                    .data
                ) or {}
                _dna_row = (
                    supabase_admin.table("discipline_dna")
                    .select("completion_rate_7d, calibration_count")
                    .eq("user_id", user_id)
                    .single()
                    .execute()
                    .data
                ) or {}

                _archetype = str(_user_row.get("archetype") or "structured_climber")
                _cr7d = float(_dna_row.get("completion_rate_7d") or 50)
                if _cr7d <= 1.0:
                    _cr7d *= 100.0
                _cal_count = int(_dna_row.get("calibration_count") or 0)

                _reg = str(_user_row.get("registration_date") or "")
                _tz_str = str(_user_row.get("timezone") or tz_name or "UTC")
                _days_active = max(0, _gdsr(_reg, _tz_str) - 1)

                try:
                    _tz_proj = ZoneInfo(_tz_str)
                except Exception:
                    _tz_proj = ZoneInfo("UTC")
                _dow = datetime.now(_tz_proj).isoweekday()

                _mirror = compute_mirror_factor(
                    _days_active, _archetype, _cr7d, _cal_count
                )
                _day_mod = get_archetype_day_modifier(_archetype, _dow)
                twin_xp_full = int(round(user_xp * _mirror * _day_mod))
            except Exception:
                pass

        n_all = len(twin_log_rows)
        n_rev = len(revealed)
        twin_xp = (
            int(round(twin_xp_full * (n_rev / n_all))) if n_all > 0 else 0
        )

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
    twin_result = await run_query(supabase_admin.table("twin_state")
        .select(
            "twin_xp, twin_character_stage, twin_pet_stage, "
            "current_gap_state, strip_message, last_strip_updated, "
            "twin_pet_unlocked"
        )
        .eq("user_id", user_id)
        .single())

    user_result = await run_query(supabase_admin.table("users")
        .select("total_xp, character_stage, current_streak")
        .eq("id", user_id)
        .single())

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

    user_result = await run_query(supabase_admin.table("users")
        .select("total_xp, character_stage, current_streak, registration_date, timezone")
        .eq("id", user_id)
        .single())
    user = user_result.data or {}

    dna_result = await run_query(supabase_admin.table("discipline_dna").select("*").eq("user_id", user_id).single())
    dna = dna_result.data or {}

    unrated_calibrations = (
        ((await run_query(supabase_admin.table("twin_messages")
        .select("id, message_rating")
        .eq("user_id", user_id)
        .not_.is_("message_rating", "null")
        .eq("rating_used_in_calibration", False))).data)
        or []
    )
    if unrated_calibrations:
        current_signal = float(dna.get("tone_preference_signal") or 0.5)
        total_adjustment = sum(int(r["message_rating"]) * 0.05 for r in unrated_calibrations)
        new_signal = max(0.0, min(1.0, current_signal + total_adjustment))
        await run_query(supabase_admin.table("discipline_dna").update(
            {
                "tone_preference_signal": new_signal,
                "chat_rating_count": int(dna.get("chat_rating_count") or 0) + len(unrated_calibrations),
                "last_rating_calibration_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("user_id", user_id))
        ids = [r["id"] for r in unrated_calibrations]
        if ids:
            await run_query(supabase_admin.table("twin_messages").update({"rating_used_in_calibration": True}).in_(
                "id", ids
            ))
        dna["tone_preference_signal"] = new_signal
        dna["chat_rating_count"] = int(dna.get("chat_rating_count") or 0) + len(unrated_calibrations)
        logger.info(
            "Twin recalibration %s: tone_preference_signal %.2f → %.2f (%s ratings processed)",
            user_id,
            current_signal,
            new_signal,
            len(unrated_calibrations),
        )

    twin_result = await run_query(supabase_admin.table("twin_state")
        .select("consistency_ceiling, last_passed_at, current_gap_state, twin_xp")
        .eq("user_id", user_id)
        .single())
    twin = twin_result.data or {}

    today = date_type.today()
    lookback = RECALIBRATION_INTERVAL_DAYS
    window_start = str(today - timedelta(days=lookback))
    thirty_days_ago = str(today - timedelta(days=30))

    streak_rows = (
        ((await run_query(supabase_admin.table("streak_log")
        .select("total_missions_done, total_missions")
        .eq("user_id", user_id)
        .gte("log_date", window_start))).data)
        or []
    )

    total_done = sum(int(r.get("total_missions_done") or 0) for r in streak_rows)
    total_possible = sum(int(r.get("total_missions") or 0) for r in streak_rows)
    completion_rate_recent = (total_done / total_possible * 100) if total_possible > 0 else 0.0

    streak_rows_30 = (
        ((await run_query(supabase_admin.table("streak_log")
        .select("total_missions_done, total_missions")
        .eq("user_id", user_id)
        .gte("log_date", thirty_days_ago))).data)
        or []
    )
    done_30 = sum(int(r.get("total_missions_done") or 0) for r in streak_rows_30)
    poss_30 = sum(int(r.get("total_missions") or 0) for r in streak_rows_30)
    completion_rate_30d = (done_30 / poss_30 * 100) if poss_30 > 0 else 0.0

    chat_count = (
        ((await run_query(supabase_admin.table("twin_messages")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("role", "user")
        .gte("created_at", datetime.utcnow() - timedelta(days=lookback)))).count)
        or 0
    )

    if chat_count >= 10:
        chat_engagement = "high"
    elif chat_count >= 3:
        chat_engagement = "medium"
    else:
        chat_engagement = "none"

    activity_events = (
        ((await run_query(supabase_admin.table("event_log")
        .select("properties")
        .eq("user_id", user_id)
        .eq("event_name", "app_opened")
        .gte("logged_at", datetime.utcnow() - timedelta(days=lookback)))).data)
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

    await run_query(supabase_admin.table("discipline_dna").update(updates).eq("user_id", user_id))

    current_base = float(twin.get("consistency_ceiling", 0.75))
    new_base = recalibrate_twin_base_rate(current_base, completion_rate_recent)
    if new_base != current_base:
        await run_query(supabase_admin.table("twin_state").update({"consistency_ceiling": new_base}).eq("user_id", user_id))

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


def _assemble_today_context(
    missions_summary: str,
    tone_topic: str,
    tone_intent: str,
    user_streak: int,
    completed_count: int,
    total_count: int,
) -> str:
    return (
        f"{missions_summary} "
        f"Streak: {user_streak} days. "
        f"Tone topic: {tone_topic}; intent: {tone_intent}. "
        f"Today progress: {completed_count}/{total_count} missions."
    )


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
    import asyncio

    from app.agents.agent_guardrails import sanitize_for_prompt, sanitize_username
    from app.agents.memory_anchor_agent import classify_and_store_anchor
    from app.agents.tone_detector import detect_tone
    from app.agents.twin_chat_agent import (
        SAFETY_RESPONSES,
        build_conversation_messages,
        classify_message_safety,
        get_last_openings,
        get_relationship_phase,
        get_relevant_anchors,
        get_tone_rating_summary,
        _generate_twin_response_sync,
    )
    from app.agents.twin_consistency_checker import check_consistency
    from app.agents.twin_response_generator import (
        _build_response_prompt,
        build_conversation_history_text,
        format_gap_percentage_label,
        generate_twin_response_v2,
    )
    from app.core.constants import STAGE_NAMES
    from app.services.mission_service import get_days_since_registration, get_user_date

    now = datetime.now(timezone.utc).isoformat()

    user_res = await run_query(supabase_admin.table("users")
        .select(
            "username, archetype, registration_date, timezone, "
            "twin_tone_override, twin_tone_override_until"
        )
        .eq("id", user_id)
        .limit(1))
    user = (user_res.data or [None])[0]
    if not user:
        raise ValueError("User not found")

    _assert_twin_chat_rate_limit(user_id)

    tz = user.get("timezone", "UTC") or "UTC"
    today = get_user_date(tz)

    twin_result = await run_query(supabase_admin.table("twin_state").select("*").eq("user_id", user_id))
    twin = twin_result.data[0] if twin_result.data else {
        "twin_xp": 0,
        "current_gap_state": "neck_and_neck",
        "twin_character_stage": 1,
        "twin_pet_stage": 0,
        "twin_streak": 0,
    }

    char_res = await run_query(supabase_admin.table("users")
        .select("total_xp, current_streak, character_stage")
        .eq("id", user_id)
        .limit(1))
    char = (char_res.data or [None])[0] or {"total_xp": 0, "current_streak": 0, "character_stage": 1}

    dna_result = await run_query(supabase_admin.table("discipline_dna").select("*").eq("user_id", user_id))
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
        ((await run_query(supabase_admin.table("interests")
        .select("normalised_name")
        .eq("user_id", user_id)
        .eq("is_active", True))).data)
        or []
    )
    interests = [r["normalised_name"] for r in interests_rows if r.get("normalised_name")]

    if not interests:
        onboarding = (
            ((await run_query(supabase_admin.table("onboarding_answers")
            .select("answer_json, question_key")
            .eq("user_id", user_id)
            .in_("question_key", ["q12_interests", "q11_interests"]))).data)
        )
        row = None
        if onboarding:
            for r in onboarding:
                if isinstance(r, dict) and r.get("question_key") == "q12_interests":
                    row = r
                    break
            if row is None:
                row = onboarding[0] if isinstance(onboarding[0], dict) else None
        if row:
            raw = (row.get("answer_json") or {}) if isinstance(row, dict) else {}
            items = raw.get("interests") if isinstance(raw, dict) else []
            if isinstance(items, list):
                for it in items:
                    if isinstance(it, dict):
                        nm = (it.get("normalised_name") or it.get("raw_text") or "").strip()
                        if nm:
                            interests.append(nm)

    history = (
        ((await run_query(supabase_admin.table("twin_messages")
        .select("role, content, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(15))).data)
        or []
    )
    history = list(reversed(history))

    today_missions = (
        ((await run_query(supabase_admin.table("missions")
        .select("title, type, completed")
        .eq("user_id", user_id)
        .eq("mission_date", today))).data)
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
        ((await run_query(supabase_admin.table("missions")
        .select("completed")
        .eq("user_id", user_id)
        .gte("mission_date", seven_start))).data)
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
    elif safety.category == "jailbreak":
        block_response = SAFETY_RESPONSES["jailbreak"]
        logger.warning(
            json.dumps(
                {
                    "event": "twin_chat_safety_block",
                    "user_id": user_id,
                    "safety_category": "jailbreak",
                    "message_preview": (message or "")[:50],
                }
            )
        )
    elif safety.category == "sexual":
        block_response = SAFETY_RESPONSES["sexual"]
        logger.warning(
            json.dumps(
                {
                    "event": "twin_chat_safety_block",
                    "user_id": user_id,
                    "safety_category": "sexual",
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
        dna_line = str(dna.get("twin_tone_type") or "rival")
        user_ins_s = await run_query(supabase_admin.table("twin_messages")
            .insert({"user_id": user_id, "role": "user", "content": message, "created_at": now}))
        u_row = (user_ins_s.data or [None])[0] or {}
        uid_safety = u_row.get("id")
        if twin_tone_override_active:
            tone_used_safety = normalize_twin_tone(twin_tone_override_active)
        else:
            tone_used_safety = pick_mixed_tone_for_message(
                dna_line, f"{user_id}:{uid_safety}:safety"
            )
        twin_ins_s = await run_query(supabase_admin.table("twin_messages")
            .insert(
                {
                    "user_id": user_id,
                    "role": "twin",
                    "content": block_response,
                    "emotional_register": f"safety_block_{safety.category}",
                    "created_at": now,
                    "tone_used": tone_used_safety,
                }
            ))
        twin_row_s = (twin_ins_s.data or [None])[0] or {}
        tid_s = twin_row_s.get("id")
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
            "message_id": str(tid_s) if tid_s else None,
            "twin_message_id": str(tid_s) if tid_s else None,
            "user_message_id": str(uid_safety) if uid_safety else None,
            "emotional_register": f"safety_block_{safety.category}",
            "is_safety_response": True,
            "safety_category": safety.category,
            "tone_used": tone_used_safety,
        }

    user_msg_safe = sanitize_for_prompt(message, max_len=500, field_name="user_message")
    username_raw = str(user.get("username") or "you")
    username_safe = sanitize_username(username_raw)

    user_ins = await run_query(supabase_admin.table("twin_messages")
        .insert(
            {
                "user_id": user_id,
                "role": "user",
                "content": message,
                "created_at": now,
            }
        ))
    user_row = (user_ins.data or [None])[0] or {}
    user_message_id = user_row.get("id")

    recent_msgs = chat_history[-3:] if chat_history else []
    tone = await detect_tone(user_msg_safe, recent_msgs)

    archetype = str(user.get("archetype") or "structured_climber")
    narrative_seed = (dna.get("narrative_seed") or "").strip() or f"User archetype: {archetype}."
    guilt_orientation = float(dna.get("guilt_orientation") or 0.5)
    twin_relationship_style = str(dna.get("twin_relationship_style") or "mentor_rival")
    archetype_confidence = float(dna.get("archetype_confidence") or 0.5)
    twin_gap_behavior = str(dna.get("twin_gap_behavior") or "rubber_band")
    tone_type = str(dna.get("twin_tone_type") or "rival")
    if twin_tone_override_active:
        tone_used = normalize_twin_tone(twin_tone_override_active)
    else:
        tone_used = pick_mixed_tone_for_message(
            tone_type, f"{user_id}:{user_message_id}"
        )
    intensity = int(dna.get("twin_intensity") or 3)

    today_context = _assemble_today_context(
        missions_summary=missions_summary,
        tone_topic=tone.topic,
        tone_intent=tone.intent,
        user_streak=int(char.get("current_streak") or 0),
        completed_count=completed_count,
        total_count=total_count,
    )
    if twin_tone_override_active:
        today_context += f"\nTemporary tone override: {twin_tone_override_active}."

    rp = get_relationship_phase(days_active)
    relationship_phase_section = (
        f"{rp['label']}\n{rp['tone_modifier']}\n{rp.get('self_reference', '')}"
    )

    gap_state_str = str(twin.get("current_gap_state") or "neck_and_neck")
    gap_pct = format_gap_percentage_label(
        gap_state_str,
        int(twin.get("twin_xp") or 0),
        int(char.get("total_xp") or 0),
    )

    char_stage = int(char.get("character_stage") or 1)
    user_stage_name = STAGE_NAMES[max(0, min(5, char_stage - 1))]
    twin_char_stage = int(twin.get("twin_character_stage") or 1)
    twin_stage_name = STAGE_NAMES[max(0, min(5, twin_char_stage - 1))]

    conv_hist_text = build_conversation_history_text(chat_history, max_turns=10)

    system_prompt = _build_response_prompt(
        username=username_safe,
        narrative_seed=narrative_seed,
        archetype=archetype,
        archetype_confidence=archetype_confidence,
        twin_tone_type=tone_used,
        twin_relationship_style=twin_relationship_style,
        twin_intensity=intensity,
        twin_gap_behavior=twin_gap_behavior,
        gap_state=gap_state_str,
        gap_percentage=gap_pct,
        twin_xp=int(twin.get("twin_xp") or 0),
        user_xp=int(char.get("total_xp") or 0),
        twin_streak=int(twin.get("twin_streak") or 0),
        user_streak=int(char.get("current_streak") or 0),
        user_stage=user_stage_name,
        twin_stage=twin_stage_name,
        day_number=days_active,
        today_context=today_context,
        user_mood=tone.user_mood,
        user_intent=tone.intent,
        energy_level=tone.energy_level,
        topic=tone.topic,
        conversation_depth=tone.conversation_depth,
        tone_rating_history=get_tone_rating_summary(user_id),
        memory_anchors=get_relevant_anchors(user_id),
        last_three_openings=get_last_openings(user_id),
        conversation_history=conv_hist_text,
        user_message=user_msg_safe,
        relationship_phase_section=relationship_phase_section,
        guilt_orientation=guilt_orientation,
        requires_sensitivity=tone.requires_sensitivity,
    )

    conversation_messages = build_conversation_messages(chat_history, user_msg_safe)

    response_text, conversation_note = await generate_twin_response_v2(
        system_prompt, conversation_messages
    )

    check = await check_consistency(
        twin_response=response_text,
        user_message=user_msg_safe,
        twin_tone_type=tone_used,
        twin_relationship_style=twin_relationship_style,
        guilt_orientation=guilt_orientation,
        user_mood=tone.user_mood,
        user_intent=tone.intent,
        requires_sensitivity=tone.requires_sensitivity,
    )

    emotional_register = "twin_chat_v2"
    if check.should_regenerate:
        logger.warning(
            "Twin consistency check requested regenerate: %s",
            [i.model_dump() for i in (check.issues or [])],
        )
        fallback = await asyncio.to_thread(
            _generate_twin_response_sync,
            system_prompt,
            conversation_messages,
        )
        response_text = fallback.response
        conversation_note = fallback.conversation_note
        emotional_register = str(getattr(fallback, "emotional_register", None) or "twin_chat_v2_regenerated")

    twin_ins = await run_query(supabase_admin.table("twin_messages")
        .insert(
            {
                "user_id": user_id,
                "role": "twin",
                "content": response_text,
                "emotional_register": emotional_register,
                "conversation_note": conversation_note,
                "created_at": now,
                "tone_used": tone_used,
            }
        ))
    twin_row = (twin_ins.data or [None])[0] or {}
    twin_msg_id = twin_row.get("id")

    uid_str = str(user_message_id) if user_message_id else None
    try:
        asyncio.create_task(
            classify_and_store_anchor(
                user_id=user_id,
                user_message=user_msg_safe,
                twin_response=response_text,
                source_message_id=uid_str,
            )
        )
    except Exception as e:
        logger.warning("memory anchor task schedule failed: %s", e)

    tid = str(twin_msg_id) if twin_msg_id else None
    uid = str(user_message_id) if user_message_id else None

    logger.info(
        json.dumps(
            {
                "event": "twin_chat_response",
                "user_id": user_id,
                "safety_category": str(safety.category),
                "emotional_register": emotional_register,
            }
        )
    )

    return {
        "response": response_text,
        "message": response_text,
        "message_id": tid,
        "twin_message_id": tid,
        "user_message_id": uid,
        "emotional_register": emotional_register,
        "is_safety_response": False,
        "safety_category": None,
        "tone_used": tone_used,
    }


def _parse_sse_data_line(chunk: str) -> dict | None:
    for line in chunk.split("\n"):
        line = line.strip()
        if not line.startswith("data:"):
            continue
        raw = line[5:].strip()
        if not raw.startswith("{"):
            continue
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None
    return None


async def stream_twin_message(user_id: str, message: str):
    """
    Streaming variant: same preprocessing as _send_twin_message_impl, then SSE chunks.
    Per-user rate limit via _assert_twin_chat_rate_limit. Persists twin row after stream.
    """
    import json
    from datetime import datetime, timezone

    import asyncio

    from app.agents.agent_guardrails import sanitize_for_prompt, sanitize_username
    from app.agents.memory_anchor_agent import classify_and_store_anchor
    from app.agents.tone_detector import detect_tone
    from app.agents.twin_chat_agent import (
        SAFETY_RESPONSES,
        build_conversation_messages,
        classify_message_safety,
        get_last_openings,
        get_relationship_phase,
        get_relevant_anchors,
        get_tone_rating_summary,
        _generate_twin_response_sync,
    )
    from app.agents.twin_consistency_checker import check_consistency
    from app.agents.twin_response_generator import (
        _build_response_prompt,
        build_conversation_history_text,
        format_gap_percentage_label,
        generate_twin_response_stream,
    )
    from app.core.constants import STAGE_NAMES
    from app.services.mission_service import get_days_since_registration, get_user_date
    from app.services.twin_tone_mix import normalize_twin_tone, pick_mixed_tone_for_message

    try:
        now = datetime.now(timezone.utc).isoformat()

        user_res = await run_query(
            supabase_admin.table("users")
            .select(
                "username, archetype, registration_date, timezone, "
                "twin_tone_override, twin_tone_override_until"
            )
            .eq("id", user_id)
            .limit(1)
        )
        user = (user_res.data or [None])[0]
        if not user:
            yield f"data: {json.dumps({'type': 'error', 'message': 'User not found'})}\n\n"
            return

        _assert_twin_chat_rate_limit(user_id)

        tz = user.get("timezone", "UTC") or "UTC"
        today = get_user_date(tz)

        twin_result = await run_query(
            supabase_admin.table("twin_state").select("*").eq("user_id", user_id)
        )
        twin = twin_result.data[0] if twin_result.data else {
            "twin_xp": 0,
            "current_gap_state": "neck_and_neck",
            "twin_character_stage": 1,
            "twin_pet_stage": 0,
            "twin_streak": 0,
        }

        char_res = await run_query(
            supabase_admin.table("users")
            .select("total_xp, current_streak, character_stage")
            .eq("id", user_id)
            .limit(1)
        )
        char = (char_res.data or [None])[0] or {
            "total_xp": 0,
            "current_streak": 0,
            "character_stage": 1,
        }

        dna_result = await run_query(
            supabase_admin.table("discipline_dna").select("*").eq("user_id", user_id)
        )
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
                until_dt = datetime.fromisoformat(str(raw_until).replace("Z", "+00:00"))
                if until_dt.tzinfo is None:
                    until_dt = until_dt.replace(tzinfo=timezone.utc)
                if datetime.now(timezone.utc) < until_dt:
                    raw_ov = user.get("twin_tone_override")
                    if raw_ov:
                        twin_tone_override_active = str(raw_ov).strip() or None
        except Exception:
            twin_tone_override_active = None

        interests_rows = (
            (
                (
                    await run_query(
                        supabase_admin.table("interests")
                        .select("normalised_name")
                        .eq("user_id", user_id)
                        .eq("is_active", True)
                    )
                ).data
            )
            or []
        )
        interests = [r["normalised_name"] for r in interests_rows if r.get("normalised_name")]

        if not interests:
            onboarding = (
                (
                    (
                        await run_query(
                            supabase_admin.table("onboarding_answers")
                            .select("answer_json, question_key")
                            .eq("user_id", user_id)
                            .in_("question_key", ["q12_interests", "q11_interests"])
                        )
                    ).data
                )
            )
            row = None
            if onboarding:
                for r in onboarding:
                    if isinstance(r, dict) and r.get("question_key") == "q12_interests":
                        row = r
                        break
                if row is None:
                    row = onboarding[0] if isinstance(onboarding[0], dict) else None
            if row:
                raw = (row.get("answer_json") or {}) if isinstance(row, dict) else {}
                items = raw.get("interests") if isinstance(raw, dict) else []
                if isinstance(items, list):
                    for it in items:
                        if isinstance(it, dict):
                            nm = (it.get("normalised_name") or it.get("raw_text") or "").strip()
                            if nm:
                                interests.append(nm)

        history = (
            (
                (
                    await run_query(
                        supabase_admin.table("twin_messages")
                        .select("role, content, created_at")
                        .eq("user_id", user_id)
                        .order("created_at", desc=True)
                        .limit(15)
                    )
                ).data
            )
            or []
        )
        history = list(reversed(history))

        today_missions = (
            (
                (
                    await run_query(
                        supabase_admin.table("missions")
                        .select("title, type, completed")
                        .eq("user_id", user_id)
                        .eq("mission_date", today)
                    )
                ).data
            )
            or []
        )

        completed_count = sum(1 for m in today_missions if m.get("completed"))
        total_count = len(today_missions)
        missed_types = [str(m["type"]) for m in today_missions if not m.get("completed")]

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
            (
                (
                    await run_query(
                        supabase_admin.table("missions")
                        .select("completed")
                        .eq("user_id", user_id)
                        .gte("mission_date", seven_start)
                    )
                ).data
            )
            or []
        )
        _ = (
            sum(1 for m in recent_missions if m.get("completed")) / len(recent_missions)
            if recent_missions
            else 0.5
        )

        # Run safety check and tone detection concurrently
        user_msg_safe = sanitize_for_prompt(message, max_len=500, field_name="user_message")
        username_safe = sanitize_username(str(user.get("username") or "you"))
        chat_history = [
            {"sender": "user" if m.get("role") == "user" else "twin", "message": m.get("content") or ""}
            for m in history
        ]
        recent_msgs = chat_history[-3:] if chat_history else []

        safety, tone = await asyncio.gather(
            classify_message_safety(
                user_message=message,
                username=str(user.get("username") or "you"),
            ),
            detect_tone(user_msg_safe, recent_msgs),
            return_exceptions=False,
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
        elif safety.category == "harmful_content":
            block_response = SAFETY_RESPONSES["harmful_content"]
        elif safety.category == "jailbreak":
            block_response = SAFETY_RESPONSES["jailbreak"]
        elif safety.category == "sexual":
            block_response = SAFETY_RESPONSES["sexual"]
        elif safety.category == "dependency" and safety.confidence > 0.8:
            block_response = SAFETY_RESPONSES["dependency"]

        if block_response is not None:
            dna_line = str(dna.get("twin_tone_type") or "rival")
            user_ins_s = await run_query(
                supabase_admin.table("twin_messages").insert(
                    {"user_id": user_id, "role": "user", "content": message, "created_at": now}
                )
            )
            u_row = (user_ins_s.data or [None])[0] or {}
            uid_safety = u_row.get("id")
            if twin_tone_override_active:
                tone_used_safety = normalize_twin_tone(twin_tone_override_active)
            else:
                tone_used_safety = pick_mixed_tone_for_message(
                    dna_line, f"{user_id}:{uid_safety}:safety"
                )
            twin_ins_s = await run_query(
                supabase_admin.table("twin_messages").insert(
                    {
                        "user_id": user_id,
                        "role": "twin",
                        "content": block_response,
                        "emotional_register": f"safety_block_{safety.category}",
                        "created_at": now,
                        "tone_used": tone_used_safety,
                    }
                )
            )
            twin_row_s = (twin_ins_s.data or [None])[0] or {}
            tid = str(twin_row_s.get("id")) if twin_row_s.get("id") else None
            uid = str(uid_safety) if uid_safety else None
            yield f"data: {json.dumps({'type': 'chunk', 'text': block_response})}\n\n"
            yield f"data: {json.dumps({'type': 'meta', 'twin_message_id': tid, 'user_message_id': uid, 'tone_used': tone_used_safety, 'is_safety_response': True})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        user_ins = await run_query(
            supabase_admin.table("twin_messages").insert(
                {
                    "user_id": user_id,
                    "role": "user",
                    "content": message,
                    "created_at": now,
                }
            )
        )
        user_row = (user_ins.data or [None])[0] or {}
        user_message_id = user_row.get("id")

        archetype = str(user.get("archetype") or "structured_climber")
        narrative_seed = (dna.get("narrative_seed") or "").strip() or f"User archetype: {archetype}."
        guilt_orientation = float(dna.get("guilt_orientation") or 0.5)
        twin_relationship_style = str(dna.get("twin_relationship_style") or "mentor_rival")
        archetype_confidence = float(dna.get("archetype_confidence") or 0.5)
        twin_gap_behavior = str(dna.get("twin_gap_behavior") or "rubber_band")
        tone_type = str(dna.get("twin_tone_type") or "rival")
        if twin_tone_override_active:
            tone_used = normalize_twin_tone(twin_tone_override_active)
        else:
            tone_used = pick_mixed_tone_for_message(tone_type, f"{user_id}:{user_message_id}")
        intensity = int(dna.get("twin_intensity") or 3)

        today_context = _assemble_today_context(
            missions_summary=missions_summary,
            tone_topic=tone.topic,
            tone_intent=tone.intent,
            user_streak=int(char.get("current_streak") or 0),
            completed_count=completed_count,
            total_count=total_count,
        )
        if twin_tone_override_active:
            today_context += f"\nTemporary tone override: {twin_tone_override_active}."

        rp = get_relationship_phase(days_active)
        relationship_phase_section = (
            f"{rp['label']}\n{rp['tone_modifier']}\n{rp.get('self_reference', '')}"
        )

        gap_state_str = str(twin.get("current_gap_state") or "neck_and_neck")
        gap_pct = format_gap_percentage_label(
            gap_state_str,
            int(twin.get("twin_xp") or 0),
            int(char.get("total_xp") or 0),
        )

        char_stage = int(char.get("character_stage") or 1)
        user_stage_name = STAGE_NAMES[max(0, min(5, char_stage - 1))]
        twin_char_stage = int(twin.get("twin_character_stage") or 1)
        twin_stage_name = STAGE_NAMES[max(0, min(5, twin_char_stage - 1))]

        conv_hist_text = build_conversation_history_text(chat_history, max_turns=10)

        system_prompt = _build_response_prompt(
            username=username_safe,
            narrative_seed=narrative_seed,
            archetype=archetype,
            archetype_confidence=archetype_confidence,
            twin_tone_type=tone_used,
            twin_relationship_style=twin_relationship_style,
            twin_intensity=intensity,
            twin_gap_behavior=twin_gap_behavior,
            gap_state=gap_state_str,
            gap_percentage=gap_pct,
            twin_xp=int(twin.get("twin_xp") or 0),
            user_xp=int(char.get("total_xp") or 0),
            twin_streak=int(twin.get("twin_streak") or 0),
            user_streak=int(char.get("current_streak") or 0),
            user_stage=user_stage_name,
            twin_stage=twin_stage_name,
            day_number=days_active,
            today_context=today_context,
            user_mood=tone.user_mood,
            user_intent=tone.intent,
            energy_level=tone.energy_level,
            topic=tone.topic,
            conversation_depth=tone.conversation_depth,
            tone_rating_history=get_tone_rating_summary(user_id),
            memory_anchors=get_relevant_anchors(user_id),
            last_three_openings=get_last_openings(user_id),
            conversation_history=conv_hist_text,
            user_message=user_msg_safe,
            relationship_phase_section=relationship_phase_section,
            guilt_orientation=guilt_orientation,
            requires_sensitivity=tone.requires_sensitivity,
        )

        conversation_messages = build_conversation_messages(chat_history, user_msg_safe)

        full_response_text = ""
        async for sse_chunk in generate_twin_response_stream(system_prompt, conversation_messages):
            ev = _parse_sse_data_line(sse_chunk)
            if ev and ev.get("type") == "done":
                continue
            if ev:
                if ev.get("type") == "chunk":
                    full_response_text += ev.get("text") or ""
                elif ev.get("type") == "replace":
                    full_response_text = ev.get("text") or full_response_text
            yield sse_chunk

        response_text = full_response_text.strip() or "I'm here. Say that again."
        conversation_note = None

        check = await check_consistency(
            twin_response=response_text,
            user_message=user_msg_safe,
            twin_tone_type=tone_used,
            twin_relationship_style=twin_relationship_style,
            guilt_orientation=guilt_orientation,
            user_mood=tone.user_mood,
            user_intent=tone.intent,
            requires_sensitivity=tone.requires_sensitivity,
        )

        emotional_register = "twin_chat_stream"
        if check.should_regenerate:
            logger.warning(
                "Twin consistency check requested regenerate (stream): %s",
                [i.model_dump() for i in (check.issues or [])],
            )
            fallback = await asyncio.to_thread(
                _generate_twin_response_sync,
                system_prompt,
                conversation_messages,
            )
            response_text = fallback.response
            conversation_note = fallback.conversation_note
            emotional_register = str(
                getattr(fallback, "emotional_register", None) or "twin_chat_stream_regenerated"
            )

        twin_created = datetime.now(timezone.utc).isoformat()
        twin_ins = await run_query(
            supabase_admin.table("twin_messages").insert(
                {
                    "user_id": user_id,
                    "role": "twin",
                    "content": response_text,
                    "emotional_register": emotional_register,
                    "conversation_note": conversation_note,
                    "created_at": twin_created,
                    "tone_used": tone_used,
                }
            )
        )
        twin_row = (twin_ins.data or [None])[0] or {}
        twin_msg_id = twin_row.get("id")
        uid_str = str(user_message_id) if user_message_id else None
        tid_str = str(twin_msg_id) if twin_msg_id else None

        logger.info(
            json.dumps(
                {
                    "event": "twin_chat_response",
                    "user_id": user_id,
                    "safety_category": str(safety.category),
                    "emotional_register": emotional_register,
                    "stream": True,
                }
            )
        )

        try:
            asyncio.create_task(
                classify_and_store_anchor(
                    user_id=user_id,
                    user_message=user_msg_safe,
                    twin_response=response_text,
                    source_message_id=uid_str,
                )
            )
        except Exception as e:
            logger.warning("memory anchor task schedule failed: %s", e)

        yield f"data: {json.dumps({'type': 'meta', 'twin_message_id': tid_str, 'user_message_id': uid_str, 'tone_used': tone_used, 'is_safety_response': False})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    except TwinChatRateLimited:
        yield f"data: {json.dumps({'type': 'error', 'message': 'Too many messages. Try again shortly.'})}\n\n"
    except Exception as e:
        logger.error(
            json.dumps({"event": "twin_stream_error", "user_id": user_id, "error": str(e)[:200]})
        )
        yield f"data: {json.dumps({'type': 'error', 'message': 'Something went wrong. Try again.'})}\n\n"
    """
    Hourly tick: for users in local hour 10, may send a proactive Twin line (max 3/week).
    Triggers: all missions complete today, inactive 2+ days, or occasional random_thought.
    """
    import random

    from zoneinfo import ZoneInfo

    from app.agents.proactive_message_agent import (
        build_proactive_context_and_send,
        should_send_proactive,
    )
    from app.services.mission_service import get_user_date

    logger.info(json.dumps({"event": "proactive_twin_message_job_start"}))

    users_result = await run_query(supabase_admin.table("users")
        .select("id, timezone, last_active_date, character_stage")
        .eq("onboarding_complete", True))

    sent = 0
    for user in users_result.data or []:
        user_id = user.get("id")
        try:
            tz_str = user.get("timezone") or "UTC"
            try:
                tz = ZoneInfo(tz_str)
            except Exception:
                tz = ZoneInfo("UTC")
            local_now = datetime.now(tz)
            if local_now.hour != 10:
                continue

            if int(user.get("character_stage") or 1) < 2:
                continue

            if not await should_send_proactive(str(user_id)):
                continue

            today = get_user_date(tz_str)
            missions = (
                ((await run_query(supabase_admin.table("missions")
                .select("completed")
                .eq("user_id", user_id)
                .eq("mission_date", today))).data)
                or []
            )
            total = len(missions)
            done = sum(1 for m in missions if m.get("completed"))

            trigger = None
            if total > 0 and done == total:
                trigger = "all_missions_complete"
            else:
                last_active = user.get("last_active_date")
                if last_active:
                    try:
                        la = date_type.fromisoformat(str(last_active)[:10])
                        if (local_now.date() - la).days >= 2:
                            trigger = "user_inactive"
                    except Exception:
                        pass
                if trigger is None and random.random() < 0.08:
                    trigger = "random_thought"

            if trigger is None:
                continue

            text = await build_proactive_context_and_send(str(user_id), trigger)
            if text:
                sent += 1
        except Exception as e:
            logger.error(
                json.dumps(
                    {
                        "event": "proactive_twin_message_error",
                        "user_id": str(user_id),
                        "error": str(e)[:200],
                    }
                )
            )
            continue

    logger.info(json.dumps({"event": "proactive_twin_message_job_done", "sent": sent}))
