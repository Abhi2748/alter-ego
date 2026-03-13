"""
Interest milestones (§6.3). Check after interest mission complete; INSERT milestone_log when earned.

Updated to the 7 universal milestones for Interests:

1. First Step       — first Interest mission completed
2. 7 Days In        — 7 consecutive days with ≥1 Interest mission
3. 10 Sessions      — 10 completed Interest missions
4. Levelled Up      — first time this Interest levels up beyond L1 (approximation of difficulty jump)
5. One Month        — 30 days since first Interest mission (non-consecutive)
6. 50 Sessions      — 50 completed Interest missions
7. 100 Sessions     — 100 completed Interest missions

Each row in milestone_log stores:
- interest
- milestone_name
- earned_at
- badge_icon (optional)
- soul_line (optional; stored once when triggered; see schema.sql comment)
"""
from __future__ import annotations

from datetime import date, datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

from utils.supabase_client import get_supabase

# Interest level XP thresholds (CLAUDE §9) — L1=0, L2=200, ..., L10=42000
INTEREST_LEVEL_THRESHOLDS = [0, 200, 600, 1_400, 3_000, 6_000, 11_000, 18_000, 28_000, 42_000]


def _level_from_total_xp(total_xp: int) -> int:
    level = 1
    for thresh in INTEREST_LEVEL_THRESHOLDS[1:]:
        if total_xp >= thresh:
            level += 1
    return min(level, 10)


def _interest_streak_days(supabase, user_id: str, interest: str) -> int:
    """Consecutive days (including today) with at least one completed mission for this interest."""
    today = date.today()
    # Get distinct dates with completed missions for this interest, descending
    r = (
        supabase.table("missions")
        .select("completed_at")
        .eq("user_id", user_id)
        .eq("interest", interest)
        .not_.is_("completed_at", "null")
        .execute()
    )
    if not r.data:
        return 0
    dates = set()
    for row in r.data or []:
        c = row.get("completed_at")
        if c:
            try:
                if isinstance(c, str):
                    d = datetime.fromisoformat(c.replace("Z", "+00:00")).date()
                else:
                    d = c.date()
                dates.add(d)
            except Exception:
                pass
    if not dates:
        return 0
    streak = 0
    check = today
    while check in dates:
        streak += 1
        check -= timedelta(days=1)
    return streak


def _already_earned(supabase, user_id: str, interest: str, milestone_name: str) -> bool:
    r = (
        supabase.table("milestone_log")
        .select("id")
        .eq("user_id", user_id)
        .eq("interest", interest)
        .eq("milestone_name", milestone_name)
        .limit(1)
        .execute()
    )
    return bool(r.data)


def _insert_milestone(
    supabase,
    user_id: str,
    interest: str,
    milestone_name: str,
    badge_icon: Optional[str] = None,
) -> Dict[str, Any]:
    soul_line = _soul_line_for(milestone_name, interest)
    row = {
        "user_id": user_id,
        "interest": interest,
        "milestone_name": milestone_name,
        "badge_icon": badge_icon,
        "soul_line": soul_line,
    }
    try:
        r = supabase.table("milestone_log").insert(row).execute()
    except Exception:
        # Backwards-compatible for DBs without soul_line column
        fallback = {
            "user_id": user_id,
            "interest": interest,
            "milestone_name": milestone_name,
            "badge_icon": badge_icon,
        }
        r = supabase.table("milestone_log").insert(fallback).execute()
    data = (r.data or [{}])[0]
    return {
        "interest": interest,
        "milestone_name": milestone_name,
        "milestone_number": _milestone_display_number(milestone_name),
        "twin_congratulation": soul_line,
        "earned_at": data.get("earned_at"),
    }


def _milestone_display_number(name: str) -> int:
    if "First Step" in name:
        return 1
    if "7 Days In" in name:
        return 2
    if "10 Sessions" in name:
        return 3
    if "Levelled Up" in name:
        return 4
    if "One Month" in name:
        return 5
    if "50 Sessions" in name:
        return 6
    if "100 Sessions" in name:
        return 7
    return 1


def _soul_line_for(milestone_name: str, interest: str) -> str:
    """
    Soul lines are short, factual sentences that mark the moment.
    In the future this can be LLM-generated; for now they are hand-crafted per milestone.
    """
    if "First Step" in milestone_name:
        return f"The day you decided {interest.lower()} was worth one hour."
    if "7 Days In" in milestone_name:
        return f"Seven days of showing up for {interest}. Most people stop at three."
    if "10 Sessions" in milestone_name:
        return f"Ten sessions of {interest}. The gap between trying it and actually doing it."
    if "Levelled Up" in milestone_name:
        return f"The missions for {interest} got harder because you got better. The system noticed before you did."
    if "One Month" in milestone_name:
        return f"Thirty days of {interest}. Long enough to know this isn’t a phase."
    if "50 Sessions" in milestone_name:
        return f"Fifty sessions of {interest}. Most people never get this far."
    if "100 Sessions" in milestone_name:
        return f"One hundred {interest} sessions. The distance between your first easy day and what hard looks like now is yours."
    return f"Milestone reached in {interest}."


def _first_session_date(supabase, user_id: str, interest: str) -> Optional[date]:
    """Return date of first completed mission for this interest, or None."""
    r = (
        supabase.table("missions")
        .select("completed_at")
        .eq("user_id", user_id)
        .eq("interest", interest)
        .not_.is_("completed_at", "null")
        .order("completed_at", asc=True)
        .limit(1)
        .execute()
    )
    row = (r.data or [None])[0]
    if not row:
        return None
    c = row.get("completed_at")
    if not c:
        return None
    try:
        if isinstance(c, str):
            return datetime.fromisoformat(c.replace("Z", "+00:00")).date()
        return c.date()
    except Exception:
        return None


def check_and_award_milestones(
    supabase,
    user_id: str,
    interest: str,
    session_count: int,
    total_xp: int,
    level: int,
) -> Optional[Dict[str, Any]]:
    """
    After updating interest_progress for an interest mission completion, check milestones.
    Returns the newly earned milestone payload for the client (first one only), or None.
    """
    streak_days = _interest_streak_days(supabase, user_id, interest)
    first_date = _first_session_date(supabase, user_id, interest)
    days_since_first = (
        (date.today() - first_date).days if first_date is not None else 0
    )

    # 1) First Step
    if session_count >= 1 and not _already_earned(supabase, user_id, interest, "First Step"):
        return _insert_milestone(supabase, user_id, interest, "First Step", "footsteps")

    # 2) 7 Days In (streak)
    if streak_days >= 7 and not _already_earned(supabase, user_id, interest, "7 Days In"):
        return _insert_milestone(supabase, user_id, interest, "7 Days In", "flame")

    # 3) 10 Sessions
    if session_count >= 10 and not _already_earned(supabase, user_id, interest, "10 Sessions"):
        return _insert_milestone(supabase, user_id, interest, "10 Sessions", "target")

    # 4) Levelled Up — first time this interest reaches level > 1
    if level > 1 and not _already_earned(supabase, user_id, interest, "Levelled Up"):
        return _insert_milestone(supabase, user_id, interest, "Levelled Up", "arrow-up")

    # 5) One Month — 30 days since first Interest mission (not necessarily consecutive)
    if days_since_first >= 30 and not _already_earned(supabase, user_id, interest, "One Month"):
        return _insert_milestone(supabase, user_id, interest, "One Month", "calendar")

    # 6) 50 Sessions
    if session_count >= 50 and not _already_earned(supabase, user_id, interest, "50 Sessions"):
        return _insert_milestone(supabase, user_id, interest, "50 Sessions", "medal")

    # 7) 100 Sessions
    if session_count >= 100 and not _already_earned(supabase, user_id, interest, "100 Sessions"):
        return _insert_milestone(supabase, user_id, interest, "100 Sessions", "trophy")

    return None
