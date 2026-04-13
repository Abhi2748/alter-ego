"""
achievement_service.py — Achievement catalog + earned-state resolver.

The achievement catalog is defined here as a module-level constant.
The service queries three existing tables to determine which achievements
a user has earned, then merges with the catalog to produce the API response.

Untracked achievements (discipline, quit) always return earned=False until
a future step adds the corresponding milestone_log writes.
"""

from __future__ import annotations

import logging
from typing import Optional

from app.core.supabase_client import run_query, supabase_admin

logger = logging.getLogger(__name__)


# ── Achievement catalog ───────────────────────────────────────────────────────
# Each entry defines one achievement the user can earn.
# Fields:
#   key             — unique string identifier used to match earned state
#   category        — display category: season|streak|discipline|quit|interest|power
#   name            — display name shown in the UI
#   description     — one-line description shown under the badge
#   badge_shape     — shield|hexagon|octagon|circle|diamond
#   badge_color     — primary hex colour (bright end of gradient)
#   badge_secondary — secondary hex colour (dark end of gradient)
#   sort_order      — ascending integer for display order within category
#   tracked         — False means no milestone_log write exists yet;
#                     service always returns earned=False for these entries
#
# Do not add DB calls here. This is a plain Python list.

ACHIEVEMENT_CATALOG: list[dict] = [
    # ── Seasons ──────────────────────────────────────────────────────────────
    {
        "key":             "season_1_complete",
        "category":        "season",
        "name":            "The Sparked",
        "description":     "Completed Season 1: The Spark.",
        "badge_shape":     "shield",
        "badge_color":     "#FFB800",
        "badge_secondary": "#78350F",
        "sort_order":      1,
        "tracked":         True,
    },
    {
        "key":             "season_1_perfect",
        "category":        "season",
        "name":            "The Sparked (Gold)",
        "description":     "Completed Season 1 with a Perfect tier. 95%+ days done.",
        "badge_shape":     "shield",
        "badge_color":     "#FFD700",
        "badge_secondary": "#92400E",
        "sort_order":      2,
        "tracked":         True,
    },
    {
        "key":             "season_2_complete",
        "category":        "season",
        "name":            "The Forged",
        "description":     "Completed Season 2: The Forge.",
        "badge_shape":     "shield",
        "badge_color":     "#FBBF24",
        "badge_secondary": "#78350F",
        "sort_order":      3,
        "tracked":         True,
    },
    {
        "key":             "veteran",
        "category":        "season",
        "name":            "Veteran",
        "description":     "Completed 5 seasons.",
        "badge_shape":     "shield",
        "badge_color":     "#C084FC",
        "badge_secondary": "#4C1D95",
        "sort_order":      4,
        "tracked":         True,
    },
    # ── Streak ───────────────────────────────────────────────────────────────
    {
        "key":             "streak_7",
        "category":        "streak",
        "name":            "First Flame",
        "description":     "Maintained a 7-day streak.",
        "badge_shape":     "hexagon",
        "badge_color":     "#FDE68A",
        "badge_secondary": "#B45309",
        "sort_order":      10,
        "tracked":         True,
    },
    {
        "key":             "streak_30",
        "category":        "streak",
        "name":            "Unbroken",
        "description":     "Maintained a 30-day streak.",
        "badge_shape":     "hexagon",
        "badge_color":     "#FBBF24",
        "badge_secondary": "#92400E",
        "sort_order":      11,
        "tracked":         True,
    },
    {
        "key":             "streak_60",
        "category":        "streak",
        "name":            "The 60",
        "description":     "Maintained a 60-day streak.",
        "badge_shape":     "hexagon",
        "badge_color":     "#F97316",
        "badge_secondary": "#7C2D12",
        "sort_order":      12,
        "tracked":         True,
    },
    {
        "key":             "streak_100",
        "category":        "streak",
        "name":            "The Century",
        "description":     "Maintained a 100-day streak.",
        "badge_shape":     "hexagon",
        "badge_color":     "#FCD34D",
        "badge_secondary": "#78350F",
        "sort_order":      13,
        "tracked":         True,
    },
    {
        "key":             "streak_365",
        "category":        "streak",
        "name":            "Year One",
        "description":     "Maintained a 365-day streak.",
        "badge_shape":     "hexagon",
        "badge_color":     "#FDE68A",
        "badge_secondary": "#D97706",
        "sort_order":      14,
        "tracked":         True,
    },
    # ── Discipline ────────────────────────────────────────────────────────────
    # tracked=False: milestone_log writes for these don't exist yet.
    # They appear in the UI as locked until a future step adds the inserts.
    {
        "key":             "full_day",
        "category":        "discipline",
        "name":            "Full Day",
        "description":     "Completed all 6 core missions in one day.",
        "badge_shape":     "octagon",
        "badge_color":     "#C084FC",
        "badge_secondary": "#5B21B6",
        "sort_order":      20,
        "tracked":         False,
    },
    {
        "key":             "perfect_week",
        "category":        "discipline",
        "name":            "Perfect Week",
        "description":     "7 consecutive days with all 6 core missions done.",
        "badge_shape":     "octagon",
        "badge_color":     "#A78BFA",
        "badge_secondary": "#4C1D95",
        "sort_order":      21,
        "tracked":         False,
    },
    # ── Quit Journey ─────────────────────────────────────────────────────────
    # tracked=False: quit achievements are not written to milestone_log yet.
    {
        "key":             "quit_first",
        "category":        "quit",
        "name":            "First Step",
        "description":     "Started a quit target.",
        "badge_shape":     "circle",
        "badge_color":     "#6EE7B7",
        "badge_secondary": "#065F46",
        "sort_order":      30,
        "tracked":         False,
    },
    {
        "key":             "quit_week",
        "category":        "quit",
        "name":            "One Week",
        "description":     "Stayed clean for 7 days on a quit target.",
        "badge_shape":     "circle",
        "badge_color":     "#34D399",
        "badge_secondary": "#065F46",
        "sort_order":      31,
        "tracked":         False,
    },
    {
        "key":             "quit_free",
        "category":        "quit",
        "name":            "The Freed",
        "description":     "Stayed clean for 66 days on a quit target.",
        "badge_shape":     "circle",
        "badge_color":     "#A7F3D0",
        "badge_secondary": "#064E3B",
        "sort_order":      32,
        "tracked":         False,
    },
    # ── Interest Missions ─────────────────────────────────────────────────────
    # Earned when ANY interest reaches that session milestone.
    # milestone_type prefixes: interest_first_session, interest_sessions_25,
    # interest_sessions_100 (written by arc_service._log_milestone).
    {
        "key":             "interest_first",
        "category":        "interest",
        "name":            "Curious",
        "description":     "Completed your first interest mission.",
        "badge_shape":     "diamond",
        "badge_color":     "#E879F9",
        "badge_secondary": "#7C3AED",
        "sort_order":      40,
        "tracked":         True,
    },
    {
        "key":             "interest_25",
        "category":        "interest",
        "name":            "Devoted",
        "description":     "Completed 25 sessions on an interest.",
        "badge_shape":     "diamond",
        "badge_color":     "#F0ABFC",
        "badge_secondary": "#6D28D9",
        "sort_order":      41,
        "tracked":         True,
    },
    {
        "key":             "interest_100",
        "category":        "interest",
        "name":            "Master",
        "description":     "Completed 100 sessions on an interest.",
        "badge_shape":     "diamond",
        "badge_color":     "#C4B5FD",
        "badge_secondary": "#4C1D95",
        "sort_order":      42,
        "tracked":         True,
    },
    # ── Power Score ───────────────────────────────────────────────────────────
    # Checked against users.power_score at query time (no milestone_log entry).
    {
        "key":             "power_1000",
        "category":        "power",
        "name":            "Rising",
        "description":     "Reached 1,000 Power Score.",
        "badge_shape":     "diamond",
        "badge_color":     "#FBBF24",
        "badge_secondary": "#D97706",
        "sort_order":      50,
        "tracked":         True,
    },
    {
        "key":             "power_5000",
        "category":        "power",
        "name":            "Force",
        "description":     "Reached 5,000 Power Score.",
        "badge_shape":     "diamond",
        "badge_color":     "#F59E0B",
        "badge_secondary": "#92400E",
        "sort_order":      51,
        "tracked":         True,
    },
    {
        "key":             "power_10000",
        "category":        "power",
        "name":            "Apex",
        "description":     "Reached 10,000 Power Score.",
        "badge_shape":     "diamond",
        "badge_color":     "#FDE68A",
        "badge_secondary": "#78350F",
        "sort_order":      52,
        "tracked":         True,
    },
]


# ── Earned-state resolver ─────────────────────────────────────────────────────

async def resolve_earned_achievements(user_id: str) -> dict[str, str | None]:
    """
    Returns a dict mapping achievement key → earned_at ISO string (or empty string
    when there is no timestamp, e.g. power score).

    Keys absent from the dict are not earned.

    Queries three tables:
      1. milestone_log  — streak / stage / pet / interest milestones
      2. user_seasons   — season completion milestones
      3. users          — power_score for power achievements
    """
    earned: dict[str, str | None] = {}

    # ── 1. milestone_log ─────────────────────────────────────────────────────
    try:
        ml_result = await run_query(
            supabase_admin.table("milestone_log")
            .select("milestone_type, earned_at")
            .eq("user_id", user_id)
            .order("earned_at", desc=False)
        )
        for row in (ml_result.data or []):
            mt = str(row.get("milestone_type") or "")
            ea = str(row.get("earned_at") or "")

            # Streak milestones — exact match
            if mt in {"streak_7", "streak_30", "streak_60", "streak_100",
                      "streak_200", "streak_365"}:
                earned.setdefault(mt, ea)

            # Character stage milestones — exact match
            if mt in {"stage_2", "stage_3", "stage_4", "stage_5", "stage_6"}:
                earned.setdefault(mt, ea)

            # Pet milestones — exact match
            if mt in {"pet_unlock", "pet_stage_2", "pet_stage_3", "pet_stage_4"}:
                earned.setdefault(mt, ea)

            # Interest milestones — any matching prefix earns the catalog entry
            if mt == "interest_first_session":
                earned.setdefault("interest_first", ea)
            elif mt == "interest_sessions_25":
                earned.setdefault("interest_25", ea)
            elif mt == "interest_sessions_100":
                earned.setdefault("interest_100", ea)

    except Exception as e:
        logger.error(
            "resolve_earned_achievements milestone_log error user=%s: %s",
            user_id, str(e)[:200],
        )

    # ── 2. user_seasons ───────────────────────────────────────────────────────
    try:
        seasons_result = await run_query(
            supabase_admin.table("user_seasons")
            .select("season_number, completion_tier, status, updated_at")
            .eq("user_id", user_id)
            .in_("status", ["completed", "failed"])
            .order("season_number", desc=False)
        )
        season_rows = seasons_result.data or []
        completed_count = 0

        for row in season_rows:
            sn   = int(row.get("season_number") or 0)
            tier = str(row.get("completion_tier") or "")
            ea   = str(row.get("updated_at") or "")

            # Any non-failed completion
            if tier in ("perfect", "clear", "partial"):
                completed_count += 1
                if sn == 1:
                    earned.setdefault("season_1_complete", ea)
                if sn == 2:
                    earned.setdefault("season_2_complete", ea)

            # Gold (perfect) tier on Season 1
            if sn == 1 and tier == "perfect":
                earned.setdefault("season_1_perfect", ea)

        # Veteran: 5 or more completed seasons
        if completed_count >= 5:
            # Use the most recent season's updated_at as the earned date
            last_ea = str((season_rows[-1] if season_rows else {}).get("updated_at") or "")
            earned.setdefault("veteran", last_ea)

    except Exception as e:
        logger.error(
            "resolve_earned_achievements user_seasons error user=%s: %s",
            user_id, str(e)[:200],
        )

    # ── 3. users (power score) ────────────────────────────────────────────────
    try:
        user_result = await run_query(
            supabase_admin.table("users")
            .select("power_score")
            .eq("id", user_id)
            .single()
        )
        power = int((user_result.data or {}).get("power_score") or 0)
        # No earned_at for power achievements — use empty string; frontend handles null
        if power >= 1_000:
            earned.setdefault("power_1000", "")
        if power >= 5_000:
            earned.setdefault("power_5000", "")
        if power >= 10_000:
            earned.setdefault("power_10000", "")
    except Exception as e:
        logger.error(
            "resolve_earned_achievements users error user=%s: %s",
            user_id, str(e)[:200],
        )

    return earned


async def build_achievements_response(user_id: str) -> dict:
    """
    Builds the full achievements API response dict.
    Merges ACHIEVEMENT_CATALOG with the user's earned state.
    """
    earned = await resolve_earned_achievements(user_id)

    result: list[dict] = []
    featured: dict | None = None
    latest_ea: str = ""

    for entry in ACHIEVEMENT_CATALOG:
        key     = entry["key"]
        tracked = entry.get("tracked", True)

        if tracked and key in earned:
            earned_at = earned[key] or None
            item = {**entry, "earned": True, "earned_at": earned_at}
            # Track the most recently earned item for the featured slot
            if earned_at and earned_at > latest_ea:
                latest_ea = earned_at
                featured  = item
        else:
            item = {**entry, "earned": False, "earned_at": None}

        result.append(item)

    earned_count = sum(1 for r in result if r["earned"])

    return {
        "total":        len(result),
        "earned_count": earned_count,
        "achievements": result,
        "featured":     featured,
    }
