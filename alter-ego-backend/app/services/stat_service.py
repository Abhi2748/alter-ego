"""
Character stat system — SP awards, levels, daily caps, willpower milestones.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.core.constants import (
    STAT_LEVEL_THRESHOLDS,
    STAT_LEVEL_NAMES,
    STAT_SP_BY_DIFFICULTY,
    STAT_DAILY_CAPS,
    WILLPOWER_BONUS,
    resolve_stat_tag,
)
from app.core.supabase_client import supabase_admin

logger = logging.getLogger(__name__)

# Mirrors constants.py — duplicated here so GET /stats meta is self-contained for clients
_STAT_LEVEL_THRESHOLDS = [0, 150, 450, 1_000, 2_200, 4_500, 8_500, 15_000, 25_000, 40_000]
_STAT_LEVEL_NAMES = [
    "Dormant",
    "Stirring",
    "Forming",
    "Grounded",
    "Rising",
    "Forged",
    "Honed",
    "Sovereign",
    "Transcendent",
    "Eternal",
]
_STAT_DAILY_CAPS = {
    "vitality": 80,
    "focus": 80,
    "craft": 50,
    "discipline": 40,
    "willpower": 80,
}
_STAT_CONTRIBUTING = {
    "vitality": ["sleep", "movement", "hydration"],
    "focus": ["mindfulness", "no_phone", "journal"],
    "craft": ["interest"],
    "discipline": ["core", "resistance", "recovery"],
    "willpower": ["personal"],
}
_WILLPOWER_BONUS = {4: 20, 6: 45, "all": 80}

_STATS_META = {
    "level_thresholds": _STAT_LEVEL_THRESHOLDS,
    "level_names": _STAT_LEVEL_NAMES,
    "daily_caps": _STAT_DAILY_CAPS,
    "contributing": _STAT_CONTRIBUTING,
    "willpower_bonus": _WILLPOWER_BONUS,
}

STAT_KEYS = ("vitality", "focus", "craft", "discipline", "willpower")


def get_stat_level(sp: int) -> int:
    level = 1
    for i, threshold in enumerate(STAT_LEVEL_THRESHOLDS):
        if sp >= threshold:
            level = i + 1
        else:
            break
    return min(level, 10)


def get_stat_level_name(level: int) -> str:
    idx = max(0, min(level - 1, 9))
    return STAT_LEVEL_NAMES[idx]


def get_stat_progress(sp: int) -> dict:
    level = get_stat_level(sp)
    level_name = get_stat_level_name(level)
    if level >= 10:
        return {
            "level": 10,
            "level_name": "Eternal",
            "sp_current": sp,
            "sp_for_next": 0,
            "sp_in_level": 0,
            "sp_needed": 0,
            "progress_percent": 100.0,
        }
    current_threshold = STAT_LEVEL_THRESHOLDS[level - 1]
    next_threshold = STAT_LEVEL_THRESHOLDS[level]
    sp_in_level = sp - current_threshold
    sp_for_next = next_threshold - current_threshold
    progress_percent = (
        round((sp_in_level / sp_for_next) * 100, 1) if sp_for_next else 100.0
    )
    return {
        "level": level,
        "level_name": level_name,
        "sp_current": sp,
        "sp_for_next": next_threshold,
        "sp_in_level": sp_in_level,
        "sp_needed": max(0, sp_for_next - sp_in_level),
        "progress_percent": progress_percent,
    }


def resolve_stat_for_mission(mission: dict) -> str:
    raw = mission.get("stat_tag")
    if raw:
        return str(raw).lower()
    return resolve_stat_tag(mission.get("core_pillar"), mission.get("type") or "core")


def _difficulty_key(difficulty: str) -> str:
    d = (difficulty or "easy").lower()
    if d == "elite":
        d = "hard"
    return d if d in STAT_SP_BY_DIFFICULTY else "easy"


def compute_aura_level(levels: list[int]) -> int:
    if not levels:
        return 1
    avg = sum(levels) / len(levels)
    floor_avg = int(avg)
    cap = min(levels)
    return max(1, min(min(floor_avg, cap), 10))


def target_willpower_bonus(missions_done: int, total_missions: int) -> int:
    if total_missions > 0 and missions_done >= total_missions:
        return int(WILLPOWER_BONUS["all"])
    if missions_done >= 6:
        return int(WILLPOWER_BONUS[6])
    if missions_done >= 4:
        return int(WILLPOWER_BONUS[4])
    return 0


def _fetch_stats_row(user_id: str) -> dict | None:
    result = (
        supabase_admin.table("character_stats")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )
    rows = result.data or []
    return rows[0] if rows else None


def _ensure_row(user_id: str) -> dict:
    row = _fetch_stats_row(user_id)
    if row:
        return dict(row)
    supabase_admin.table("character_stats").insert({"user_id": user_id}).execute()
    row2 = _fetch_stats_row(user_id)
    if row2:
        return dict(row2)
    return {"user_id": user_id}


async def ensure_sp_day_aligned(user_id: str, today: str) -> None:
    """Reset daily counters when the user's calendar day advances."""
    _ensure_row(user_id)
    stats = _fetch_stats_row(user_id)
    if not stats:
        return
    last = stats.get("last_sp_date")
    if last is not None and str(last) == str(today):
        return
    now = datetime.now(timezone.utc).isoformat()
    supabase_admin.table("character_stats").update(
        {
            "vitality_sp_today": 0,
            "focus_sp_today": 0,
            "craft_sp_today": 0,
            "discipline_sp_today": 0,
            "willpower_sp_today": 0,
            "missions_completed_today": 0,
            "willpower_milestone_sp_awarded": 0,
            "last_sp_date": today,
            "updated_at": now,
        }
    ).eq("user_id", user_id).execute()


async def set_total_missions_for_day(user_id: str, total: int) -> None:
    now = datetime.now(timezone.utc).isoformat()
    _ensure_row(user_id)
    supabase_admin.table("character_stats").update(
        {"total_missions_today": max(0, int(total)), "updated_at": now}
    ).eq("user_id", user_id).execute()


async def award_sp_for_mission(
    user_id: str,
    mission: dict,
    difficulty: str,
    today: str,
) -> dict:
    await ensure_sp_day_aligned(user_id, today)
    stats = dict(_ensure_row(user_id))

    primary_stat = resolve_stat_for_mission(mission)
    dkey = _difficulty_key(difficulty)
    sp_config = STAT_SP_BY_DIFFICULTY[dkey]
    primary_sp_raw = sp_config["primary"]
    discipline_sp_raw = sp_config["discipline"]

    discipline_cap = STAT_DAILY_CAPS["discipline"]
    discipline_today = int(stats.get("discipline_sp_today") or 0)
    primary_sp_awarded = 0
    discipline_sp_awarded = 0

    if primary_stat == "discipline":
        room = max(0, discipline_cap - discipline_today)
        primary_sp_awarded = min(primary_sp_raw, room)
        room2 = max(0, room - primary_sp_awarded)
        discipline_sp_awarded = min(discipline_sp_raw, room2)
    else:
        primary_cap = STAT_DAILY_CAPS.get(primary_stat, 80)
        primary_today_key = f"{primary_stat}_sp_today"
        primary_today = int(stats.get(primary_today_key) or 0)
        room_p = max(0, primary_cap - primary_today)
        primary_sp_awarded = min(primary_sp_raw, room_p)
        room_d = max(0, discipline_cap - discipline_today)
        discipline_sp_awarded = min(discipline_sp_raw, room_d)

    levels_before = {k: get_stat_level(int(stats.get(f"{k}_sp") or 0)) for k in STAT_KEYS}
    aura_before = compute_aura_level(list(levels_before.values()))

    if primary_sp_awarded > 0:
        if primary_stat == "discipline":
            stats["discipline_sp"] = int(stats.get("discipline_sp") or 0) + primary_sp_awarded
            stats["discipline_sp_today"] = discipline_today + primary_sp_awarded
            discipline_today = int(stats["discipline_sp_today"])
        else:
            stats[f"{primary_stat}_sp"] = int(stats.get(f"{primary_stat}_sp") or 0) + primary_sp_awarded
            stats[f"{primary_stat}_sp_today"] = (
                int(stats.get(f"{primary_stat}_sp_today") or 0) + primary_sp_awarded
            )

    if discipline_sp_awarded > 0:
        stats["discipline_sp"] = int(stats.get("discipline_sp") or 0) + discipline_sp_awarded
        stats["discipline_sp_today"] = int(stats.get("discipline_sp_today") or 0) + discipline_sp_awarded

    stats["missions_completed_today"] = int(stats.get("missions_completed_today") or 0) + 1
    missions_done = int(stats["missions_completed_today"])
    total_missions = max(0, int(stats.get("total_missions_today") or 0))

    willpower_bonus_sp = 0
    milestone_prev = int(stats.get("willpower_milestone_sp_awarded") or 0)
    target = target_willpower_bonus(missions_done, total_missions)
    delta_bonus = max(0, target - milestone_prev)
    if delta_bonus > 0:
        willpower_today = int(stats.get("willpower_sp_today") or 0)
        willpower_cap = STAT_DAILY_CAPS["willpower"]
        room_w = max(0, willpower_cap - willpower_today)
        willpower_bonus_sp = min(delta_bonus, room_w)
        if willpower_bonus_sp > 0:
            stats["willpower_sp"] = int(stats.get("willpower_sp") or 0) + willpower_bonus_sp
            stats["willpower_sp_today"] = willpower_today + willpower_bonus_sp
            stats["willpower_milestone_sp_awarded"] = milestone_prev + willpower_bonus_sp

    new_levels = {f"{k}_level": get_stat_level(int(stats.get(f"{k}_sp") or 0)) for k in STAT_KEYS}
    aura_lvl = compute_aura_level([new_levels[f"{k}_level"] for k in STAT_KEYS])
    stats["aura_level"] = aura_lvl
    for k, v in new_levels.items():
        stats[k] = v

    now = datetime.now(timezone.utc).isoformat()
    stats["last_sp_date"] = today
    stats["updated_at"] = now

    levels_after_plain = {k.replace("_level", ""): new_levels[k] for k in new_levels}
    level_ups = [s for s in STAT_KEYS if levels_after_plain[s] > levels_before[s]]
    if aura_lvl > aura_before:
        level_ups.append("aura")

    update_payload = {
        "vitality_sp": stats.get("vitality_sp"),
        "focus_sp": stats.get("focus_sp"),
        "craft_sp": stats.get("craft_sp"),
        "discipline_sp": stats.get("discipline_sp"),
        "willpower_sp": stats.get("willpower_sp"),
        "vitality_level": stats.get("vitality_level"),
        "focus_level": stats.get("focus_level"),
        "craft_level": stats.get("craft_level"),
        "discipline_level": stats.get("discipline_level"),
        "willpower_level": stats.get("willpower_level"),
        "aura_level": stats.get("aura_level"),
        "vitality_sp_today": stats.get("vitality_sp_today"),
        "focus_sp_today": stats.get("focus_sp_today"),
        "craft_sp_today": stats.get("craft_sp_today"),
        "discipline_sp_today": stats.get("discipline_sp_today"),
        "willpower_sp_today": stats.get("willpower_sp_today"),
        "missions_completed_today": stats.get("missions_completed_today"),
        "willpower_milestone_sp_awarded": stats.get("willpower_milestone_sp_awarded"),
        "last_sp_date": stats.get("last_sp_date"),
        "updated_at": now,
    }

    supabase_admin.table("character_stats").update(update_payload).eq("user_id", user_id).execute()

    try:
        from app.services.mail_service import check_and_send_ability_levelup_mail

        for s in STAT_KEYS:
            if (
                levels_after_plain[s] > levels_before[s]
                and levels_after_plain[s] >= 2
            ):
                await check_and_send_ability_levelup_mail(user_id)
                break
    except Exception:
        pass

    return {
        "primary_stat": primary_stat,
        "primary_sp_awarded": primary_sp_awarded,
        "discipline_sp_awarded": discipline_sp_awarded,
        "willpower_bonus_sp": willpower_bonus_sp,
        "level_ups": level_ups,
        "missions_completed_today": missions_done,
        "total_missions_today": total_missions,
    }


def _build_empty_stats_response() -> dict:
    empty_base = {
        "sp": 0,
        "sp_today": 0,
        "level": 1,
        "level_name": "Dormant",
        "sp_current": 0,
        "sp_for_next": 150,
        "sp_in_level": 0,
        "sp_needed": 150,
        "progress_percent": 0.0,
    }

    def empty_for(key: str) -> dict:
        return {
            "key": key,
            **empty_base,
            "daily_cap": _STAT_DAILY_CAPS.get(key, 0),
            "contributing": list(_STAT_CONTRIBUTING.get(key, [])),
        }

    return {
        "aura": {"level": 1, "level_name": "Dormant", "progress_percent": 0.0},
        "vitality": empty_for("vitality"),
        "focus": empty_for("focus"),
        "craft": empty_for("craft"),
        "discipline": empty_for("discipline"),
        "willpower": empty_for("willpower"),
        "missions_completed_today": 0,
        "total_missions_today": 0,
        "willpower_milestone_sp_awarded": 0,
        "meta": dict(_STATS_META),
    }


async def get_stats_for_user(user_id: str, timezone_str: str | None = None) -> dict:
    from app.services.mission_service import get_user_date

    tz = timezone_str
    if not tz:
        ur = (
            supabase_admin.table("users")
            .select("timezone")
            .eq("id", user_id)
            .single()
            .execute()
        )
        tz = (ur.data or {}).get("timezone") or "UTC"
    today = get_user_date(str(tz))
    await ensure_sp_day_aligned(user_id, today)

    result = (
        supabase_admin.table("character_stats")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return _build_empty_stats_response()

    stats = rows[0]

    def build_stat(key: str) -> dict:
        sp = int(stats.get(f"{key}_sp") or 0)
        progress = get_stat_progress(sp)
        return {
            "key": key,
            "sp": sp,
            "sp_today": int(stats.get(f"{key}_sp_today") or 0),
            **progress,
            "daily_cap": _STAT_DAILY_CAPS.get(key, 0),
            "contributing": list(_STAT_CONTRIBUTING.get(key, [])),
        }

    vitality = build_stat("vitality")
    focus = build_stat("focus")
    craft = build_stat("craft")
    discipline = build_stat("discipline")
    willpower = build_stat("willpower")

    levels = [
        vitality["level"],
        focus["level"],
        craft["level"],
        discipline["level"],
        willpower["level"],
    ]
    aura_level = compute_aura_level(levels)
    aura_level_name = get_stat_level_name(aura_level)
    aura_progress_percent = round(
        (
            vitality["progress_percent"]
            + focus["progress_percent"]
            + craft["progress_percent"]
            + discipline["progress_percent"]
            + willpower["progress_percent"]
        )
        / 5.0,
        1,
    )

    return {
        "aura": {
            "level": aura_level,
            "level_name": aura_level_name,
            "progress_percent": aura_progress_percent,
        },
        "vitality": vitality,
        "focus": focus,
        "craft": craft,
        "discipline": discipline,
        "willpower": willpower,
        "missions_completed_today": int(stats.get("missions_completed_today") or 0),
        "total_missions_today": int(stats.get("total_missions_today") or 0),
        "willpower_milestone_sp_awarded": int(stats.get("willpower_milestone_sp_awarded") or 0),
        "meta": dict(_STATS_META),
    }
