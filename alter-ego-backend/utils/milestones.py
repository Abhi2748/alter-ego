"""
Interest milestones (§6.3). Check after interest mission complete; INSERT milestone_log when earned.
First Step, 7-Day Streak, 30/60/100 Sessions, Level Up L2–L10, Committed (60), Serious (L5), Mastery (L10).
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


def _insert_milestone(supabase, user_id: str, interest: str, milestone_name: str, badge_icon: Optional[str] = None) -> Dict[str, Any]:
    row = {
        "user_id": user_id,
        "interest": interest,
        "milestone_name": milestone_name,
        "badge_icon": badge_icon,
    }
    r = supabase.table("milestone_log").insert(row).execute()
    data = (r.data or [{}])[0]
    return {
        "interest": interest,
        "milestone_name": milestone_name,
        "milestone_number": _milestone_display_number(milestone_name),
        "twin_congratulation": _twin_line_for(milestone_name, interest),
        "earned_at": data.get("earned_at"),
    }


def _milestone_display_number(name: str) -> int:
    if "First Step" in name:
        return 1
    if "7-Day" in name or "7 Day" in name:
        return 7
    if "30 Sessions" in name:
        return 30
    if "60" in name or "Committed" in name:
        return 60
    if "100" in name:
        return 100
    if "Level Up" in name:
        for i in range(2, 11):
            if f"L{i}" in name:
                return i
    if "Serious" in name:
        return 5
    if "Mastery" in name:
        return 10
    return 1


def _twin_line_for(milestone_name: str, interest: str) -> str:
    if "First Step" in milestone_name:
        return "First step. The only one that matters is the next."
    if "7-Day" in milestone_name or "7 Day" in milestone_name:
        return "One week of showing up. That's how it starts."
    if "30 Sessions" in milestone_name:
        return "Thirty reps. You're no longer just trying."
    if "Committed" in milestone_name:
        return "Sixty in. This is a practice now."
    if "100 Sessions" in milestone_name:
        return "Triple digits. You're someone who does this."
    if "Serious" in milestone_name:
        return "Three months of consistency. You're not a beginner anymore."
    if "Mastery" in milestone_name:
        return "Level 10. The highest milestone. You earned it."
    if "Level Up" in milestone_name or "L" in milestone_name:
        return "Level up. Keep going."
    return "Milestone unlocked."


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
    earned = None
    streak_days = _interest_streak_days(supabase, user_id, interest)

    if session_count >= 1 and _already_earned(supabase, user_id, interest, "First Step") is False:
        earned = _insert_milestone(supabase, user_id, interest, "First Step", "footsteps")
        return earned

    if streak_days >= 7 and _already_earned(supabase, user_id, interest, "7-Day Streak") is False:
        earned = _insert_milestone(supabase, user_id, interest, "7-Day Streak", "flame")
        return earned

    if session_count >= 30 and _already_earned(supabase, user_id, interest, "30 Sessions") is False:
        earned = _insert_milestone(supabase, user_id, interest, "30 Sessions", "target")
        return earned

    for lvl in range(2, 11):
        if level >= lvl and _already_earned(supabase, user_id, interest, f"Level Up L{lvl}") is False:
            earned = _insert_milestone(supabase, user_id, interest, f"Level Up L{lvl}", "arrow-up")
            return earned

    if session_count >= 60 and _already_earned(supabase, user_id, interest, "Committed") is False:
        earned = _insert_milestone(supabase, user_id, interest, "Committed", "heart")
        return earned

    if level >= 5 and _already_earned(supabase, user_id, interest, "Serious") is False:
        earned = _insert_milestone(supabase, user_id, interest, "Serious", "star")
        return earned

    if session_count >= 100 and _already_earned(supabase, user_id, interest, "100 Sessions") is False:
        earned = _insert_milestone(supabase, user_id, interest, "100 Sessions", "trophy")
        return earned

    if level >= 10 and _already_earned(supabase, user_id, interest, "Mastery") is False:
        earned = _insert_milestone(supabase, user_id, interest, "Mastery", "crown")
        return earned

    return earned
