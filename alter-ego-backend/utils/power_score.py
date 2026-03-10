"""
Power Score calculation (Gamification §7.1).

Formula: (xp_stage_pct × 0.35) + (pet_stage_norm × 0.20) + (streak_norm_to_30 × 0.25) + (weekly_completion_pct × 0.20).
Score is scaled 0–100. Hourly refresh updates leaderboard_scores for users who have ever reached a streak of 7+
consecutive qualifying days (core_completed >= 3 in streak_log). Once a user qualifies they are always included.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta, date
from typing import Any, Dict, List, Tuple

from utils.supabase_client import get_supabase

# Character stage thresholds (CLAUDE §9) — S1=0, S2=800, ...
STAGE_THRESHOLDS = [0, 800, 5_000, 20_000, 60_000, 200_000]


def _xp_stage_pct(total_xp: int) -> float:
    """Progress within current stage, 0–1. At max stage returns 1.0."""
    if total_xp <= 0:
        return 0.0
    for i in range(len(STAGE_THRESHOLDS) - 1):
        start = STAGE_THRESHOLDS[i]
        end = STAGE_THRESHOLDS[i + 1]
        if total_xp < end:
            if end == start:
                return 1.0
            return (total_xp - start) / (end - start)
    return 1.0


def _pet_stage_norm(pet_stage: int) -> float:
    """Pet stage 0–8 normalized to 0–1."""
    return min(1.0, max(0.0, pet_stage / 8.0))


def _streak_norm_to_30(streak_days: int) -> float:
    """Streak length normalized to 30-day cap, 0–1."""
    return min(1.0, max(0.0, min(streak_days, 30) / 30.0))


def compute_power_score(
    xp_stage_pct: float,
    pet_stage_norm: float,
    streak_norm: float,
    weekly_completion_pct: float,
) -> float:
    """Return Power Score 0–100."""
    raw = (
        xp_stage_pct * 0.35
        + pet_stage_norm * 0.20
        + streak_norm * 0.25
        + weekly_completion_pct * 0.20
    )
    return round(min(100.0, max(0.0, raw * 100.0)), 2)


def _current_streak_days(supabase, user_id: str) -> int:
    """Consecutive days up to today where core_completed >= 5 (all 5 Core done)."""
    today = date.today()
    streak = 0
    for d in range(0, 400):
        check_date = today - timedelta(days=d)
        r = (
            supabase.table("streak_log")
            .select("core_completed")
            .eq("user_id", user_id)
            .eq("date", check_date.isoformat())
            .maybe_single()
            .execute()
        )
        if not r.data:
            break
        if (r.data.get("core_completed") or 0) >= 5:
            streak += 1
        else:
            break
    return streak


def _weekly_completion_pct(supabase, user_id: str, now: datetime) -> float:
    """Missions completed vs assigned in last 7 days (by expires_at)."""
    start = (now - timedelta(days=7)).isoformat()
    end = now.isoformat()
    r = (
        supabase.table("missions")
        .select("completed_at, expires_at")
        .eq("user_id", user_id)
        .gte("expires_at", start)
        .lte("expires_at", end)
        .execute()
    )
    rows = r.data or []
    total = len(rows)
    if total == 0:
        return 0.0
    completed = sum(1 for row in rows if row.get("completed_at"))
    return completed / total


def get_power_score_components(supabase, user_id: str) -> Tuple[float, int, int, int, float]:
    """
    Return (power_score, streak, pet_stage, character_stage, weekly_pct) for one user.
    """
    now = datetime.now(timezone.utc)

    cr = supabase.table("character_state").select("stage, total_xp").eq("user_id", user_id).maybe_single().execute()
    total_xp = int((cr.data or {}).get("total_xp", 0))
    character_stage = int((cr.data or {}).get("stage", 1))

    pr = supabase.table("pet_state").select("stage").eq("user_id", user_id).maybe_single().execute()
    pet_stage = int((pr.data or {}).get("stage", 0))

    streak = _current_streak_days(supabase, user_id)
    weekly_pct = _weekly_completion_pct(supabase, user_id, now)

    xp_pct = _xp_stage_pct(total_xp)
    pet_norm = _pet_stage_norm(pet_stage)
    streak_norm = _streak_norm_to_30(streak)

    score = compute_power_score(xp_pct, pet_norm, streak_norm, weekly_pct)
    return score, streak, pet_stage, character_stage, weekly_pct


def _max_consecutive_days(dates: List[date]) -> int:
    """Given sorted list of dates, return length of longest run of consecutive calendar days."""
    if not dates:
        return 0
    dates = sorted(set(dates))
    max_run = 1
    run = 1
    for i in range(1, len(dates)):
        if (dates[i] - dates[i - 1]).days == 1:
            run += 1
        else:
            max_run = max(max_run, run)
            run = 1
    return max(max_run, run)


def _user_ids_ever_streak_7_plus(supabase) -> List[str]:
    """
    Return user_ids that have ever had 7+ consecutive qualifying days in streak_log.
    Qualifying day = core_completed >= 5 (all 5 Core missions done).
    """
    page_size = 1000
    rows: List[Dict[str, Any]] = []
    offset = 0
    while True:
        page = (
            supabase.table("streak_log")
            .select("user_id, date, core_completed")
            .gte("core_completed", 5)
            .order("user_id")
            .order("date")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        chunk = page.data or []
        rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size

    by_user: Dict[str, List[date]] = {}
    for row in rows:
        uid = row.get("user_id")
        d = row.get("date")
        if not uid or not d:
            continue
        try:
            if isinstance(d, str):
                d = date.fromisoformat(d[:10])
            by_user.setdefault(uid, []).append(d)
        except (ValueError, TypeError):
            continue

    qualified: List[str] = []
    for uid, dates in by_user.items():
        if _max_consecutive_days(dates) >= 7:
            qualified.append(uid)
    return qualified


def refresh_leaderboard_scores() -> int:
    """
    Recalculate Power Score for all users who have ever reached a streak of 7+ consecutive qualifying days.
    Qualifying = core_completed >= 5 in streak_log (all 5 Core). Once a user qualifies they are always included.
    UPSERT leaderboard_scores. Returns number of rows upserted.
    """
    supabase = get_supabase()
    now = datetime.now(timezone.utc)

    user_ids = _user_ids_ever_streak_7_plus(supabase)

    updated = 0
    for user_id in user_ids:
        try:
            score, streak, pet_stage, character_stage, _ = get_power_score_components(supabase, user_id)
            payload = {
                "user_id": user_id,
                "power_score": score,
                "streak": streak,
                "pet_stage": pet_stage,
                "character_stage": character_stage,
                "updated_at": now.isoformat(),
            }
            supabase.table("leaderboard_scores").upsert(payload, on_conflict="user_id").execute()
            updated += 1
        except Exception:
            continue

    return updated
