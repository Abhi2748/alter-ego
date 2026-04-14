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

from app.core.constants import STREAK_MILESTONES
from app.core.supabase_client import run_query, supabase_admin

logger = logging.getLogger(__name__)

# Season completion badges we surface (season N complete + perfect tier for S1 only).
_SEASON_COMPLETE_BADGE_MAX = 5


# ── Achievement catalog ───────────────────────────────────────────────────────
# Each entry defines one achievement the user can earn.
# Fields:
#   key             — unique string identifier used to match earned state
#   category        — display category (see mobile AchievementsScreen)
#   name            — display name shown in the UI
#   description     — one-line description shown under the badge
#   badge_shape     — shield|hexagon|octagon|circle|diamond
#   badge_color     — primary hex colour (bright end of gradient)
#   badge_secondary — secondary hex colour (dark end of gradient)
#   sort_order      — ascending integer for display order within category
#   tracked         — False means no data source yet; earned=False always
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
        "name":            "The Sparked (Perfect)",
        "description":     "Completed Season 1 with a Perfect tier. 95%+ days done.",
        "badge_shape":     "shield",
        "badge_color":     "#A78BFA",
        "badge_secondary": "#6D28D9",
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
        "key":             "season_3_complete",
        "category":        "season",
        "name":            "Third Arc",
        "description":     "Completed Season 3.",
        "badge_shape":     "shield",
        "badge_color":     "#22D3EE",
        "badge_secondary": "#164E63",
        "sort_order":      4,
        "tracked":         True,
    },
    {
        "key":             "season_4_complete",
        "category":        "season",
        "name":            "Fourth Arc",
        "description":     "Completed Season 4.",
        "badge_shape":     "shield",
        "badge_color":     "#A78BFA",
        "badge_secondary": "#4C1D95",
        "sort_order":      5,
        "tracked":         True,
    },
    {
        "key":             "season_5_complete",
        "category":        "season",
        "name":            "Fifth Arc",
        "description":     "Completed Season 5.",
        "badge_shape":     "shield",
        "badge_color":     "#60A5FA",
        "badge_secondary": "#1E3A8A",
        "sort_order":      6,
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
        "sort_order":      7,
        "tracked":         True,
    },
    # ── Streak (milestone_log streak_N for N in STREAK_MILESTONES) ───────────
    {
        "key":             "streak_3",
        "category":        "streak",
        "name":            "On the Board",
        "description":     "Maintained a 3-day streak.",
        "badge_shape":     "hexagon",
        "badge_color":     "#FDE68A",
        "badge_secondary": "#92400E",
        "sort_order":      10,
        "tracked":         True,
    },
    {
        "key":             "streak_7",
        "category":        "streak",
        "name":            "First Flame",
        "description":     "Maintained a 7-day streak.",
        "badge_shape":     "hexagon",
        "badge_color":     "#FDE68A",
        "badge_secondary": "#B45309",
        "sort_order":      11,
        "tracked":         True,
    },
    {
        "key":             "streak_10",
        "category":        "streak",
        "name":            "Double Digits",
        "description":     "Maintained a 10-day streak.",
        "badge_shape":     "hexagon",
        "badge_color":     "#FBBF24",
        "badge_secondary": "#B45309",
        "sort_order":      12,
        "tracked":         True,
    },
    {
        "key":             "streak_14",
        "category":        "streak",
        "name":            "Fortnight",
        "description":     "Maintained a 14-day streak.",
        "badge_shape":     "hexagon",
        "badge_color":     "#FCD34D",
        "badge_secondary": "#92400E",
        "sort_order":      13,
        "tracked":         True,
    },
    {
        "key":             "streak_21",
        "category":        "streak",
        "name":            "Three Weeks",
        "description":     "Maintained a 21-day streak.",
        "badge_shape":     "hexagon",
        "badge_color":     "#FBBF24",
        "badge_secondary": "#78350F",
        "sort_order":      14,
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
        "sort_order":      15,
        "tracked":         True,
    },
    {
        "key":             "streak_60",
        "category":        "streak",
        "name":            "The 60",
        "description":     "Maintained a 60-day streak.",
        "badge_shape":     "hexagon",
        "badge_color":     "#FBBF24",
        "badge_secondary": "#78350F",
        "sort_order":      16,
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
        "sort_order":      17,
        "tracked":         True,
    },
    {
        "key":             "streak_180",
        "category":        "streak",
        "name":            "Half-Year Chain",
        "description":     "Maintained a 180-day streak.",
        "badge_shape":     "hexagon",
        "badge_color":     "#FCD34D",
        "badge_secondary": "#92400E",
        "sort_order":      18,
        "tracked":         True,
    },
    {
        "key":             "streak_200",
        "category":        "streak",
        "name":            "Two Hundred",
        "description":     "Maintained a 200-day streak.",
        "badge_shape":     "hexagon",
        "badge_color":     "#FDE047",
        "badge_secondary": "#854D0E",
        "sort_order":      19,
        "tracked":         True,
    },
    {
        "key":             "streak_365",
        "category":        "streak",
        "name":            "Year One",
        "description":     "Maintained a 365-day streak.",
        "badge_shape":     "hexagon",
        "badge_color":     "#F59E0B",
        "badge_secondary": "#78350F",
        "sort_order":      20,
        "tracked":         True,
    },
    # ── Discipline (not wired to milestone_log yet) ───────────────────────────
    {
        "key":             "full_day",
        "category":        "discipline",
        "name":            "Full Day",
        "description":     "Completed all 6 core missions in one day.",
        "badge_shape":     "octagon",
        "badge_color":     "#C084FC",
        "badge_secondary": "#5B21B6",
        "sort_order":      30,
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
        "sort_order":      31,
        "tracked":         False,
    },
    # ── Character (milestone_log stage_2 … stage_6) ─────────────────────────
    {
        "key":             "stage_2",
        "category":        "character",
        "name":            "The Focused",
        "description":     "Reached character stage 2 — The Focused.",
        "badge_shape":     "shield",
        "badge_color":     "#8B5CF6",
        "badge_secondary": "#4C1D95",
        "sort_order":      40,
        "tracked":         True,
    },
    {
        "key":             "stage_3",
        "category":        "character",
        "name":            "The Burning",
        "description":     "Reached character stage 3 — The Burning.",
        "badge_shape":     "shield",
        "badge_color":     "#6D28D9",
        "badge_secondary": "#312E81",
        "sort_order":      41,
        "tracked":         True,
    },
    {
        "key":             "stage_4",
        "category":        "character",
        "name":            "The Relentless",
        "description":     "Reached character stage 4 — The Relentless.",
        "badge_shape":     "shield",
        "badge_color":     "#A78BFA",
        "badge_secondary": "#3730A3",
        "sort_order":      42,
        "tracked":         True,
    },
    {
        "key":             "stage_5",
        "category":        "character",
        "name":            "The Formidable",
        "description":     "Reached character stage 5 — The Formidable.",
        "badge_shape":     "shield",
        "badge_color":     "#C4B5FD",
        "badge_secondary": "#4C1D95",
        "sort_order":      43,
        "tracked":         True,
    },
    {
        "key":             "stage_6",
        "category":        "character",
        "name":            "The Sovereign",
        "description":     "Reached character stage 6 — The Sovereign.",
        "badge_shape":     "shield",
        "badge_color":     "#DDD6FE",
        "badge_secondary": "#5B21B6",
        "sort_order":      44,
        "tracked":         True,
    },
    # ── Companion (pet_unlock + pet_stage_2 … pet_stage_8) ───────────────────
    {
        "key":             "pet_unlock",
        "category":        "companion",
        "name":            "First Friend",
        "description":     "Your companion arrived — Cat (Day 6).",
        "badge_shape":     "circle",
        "badge_color":     "#A78BFA",
        "badge_secondary": "#4C1D95",
        "sort_order":      50,
        "tracked":         True,
    },
    {
        "key":             "pet_stage_2",
        "category":        "companion",
        "name":            "Fox",
        "description":     "Companion evolved to Fox.",
        "badge_shape":     "circle",
        "badge_color":     "#8B5CF6",
        "badge_secondary": "#312E81",
        "sort_order":      51,
        "tracked":         True,
    },
    {
        "key":             "pet_stage_3",
        "category":        "companion",
        "name":            "Wolf",
        "description":     "Companion evolved to Wolf.",
        "badge_shape":     "circle",
        "badge_color":     "#C084FC",
        "badge_secondary": "#5B21B6",
        "sort_order":      52,
        "tracked":         True,
    },
    {
        "key":             "pet_stage_4",
        "category":        "companion",
        "name":            "Panther",
        "description":     "Companion evolved to Panther.",
        "badge_shape":     "circle",
        "badge_color":     "#6D28D9",
        "badge_secondary": "#1E1B4B",
        "sort_order":      53,
        "tracked":         True,
    },
    {
        "key":             "pet_stage_5",
        "category":        "companion",
        "name":            "Snow Leopard",
        "description":     "Companion evolved to Snow Leopard.",
        "badge_shape":     "circle",
        "badge_color":     "#DDD6FE",
        "badge_secondary": "#4C1D95",
        "sort_order":      54,
        "tracked":         True,
    },
    {
        "key":             "pet_stage_6",
        "category":        "companion",
        "name":            "Tiger",
        "description":     "Companion evolved to Tiger.",
        "badge_shape":     "circle",
        "badge_color":     "#A78BFA",
        "badge_secondary": "#3730A3",
        "sort_order":      55,
        "tracked":         True,
    },
    {
        "key":             "pet_stage_7",
        "category":        "companion",
        "name":            "Phoenix",
        "description":     "Companion evolved to Phoenix.",
        "badge_shape":     "circle",
        "badge_color":     "#FBBF24",
        "badge_secondary": "#92400E",
        "sort_order":      56,
        "tracked":         True,
    },
    {
        "key":             "pet_stage_8",
        "category":        "companion",
        "name":            "Dragon",
        "description":     "Companion evolved to Dragon.",
        "badge_shape":     "circle",
        "badge_color":     "#FDE68A",
        "badge_secondary": "#B45309",
        "sort_order":      57,
        "tracked":         True,
    },
    # ── Quit Journey (not wired yet) ──────────────────────────────────────────
    {
        "key":             "quit_first",
        "category":        "quit",
        "name":            "First Step",
        "description":     "Started a quit target.",
        "badge_shape":     "circle",
        "badge_color":     "#22D3EE",
        "badge_secondary": "#164E63",
        "sort_order":      60,
        "tracked":         False,
    },
    {
        "key":             "quit_week",
        "category":        "quit",
        "name":            "One Week",
        "description":     "Stayed clean for 7 days on a quit target.",
        "badge_shape":     "circle",
        "badge_color":     "#67E8F9",
        "badge_secondary": "#155E75",
        "sort_order":      61,
        "tracked":         False,
    },
    {
        "key":             "quit_free",
        "category":        "quit",
        "name":            "The Freed",
        "description":     "Stayed clean for 66 days on a quit target.",
        "badge_shape":     "circle",
        "badge_color":     "#A5F3FC",
        "badge_secondary": "#0E7490",
        "sort_order":      62,
        "tracked":         False,
    },
    # ── Interest (arc_service milestone_log interest_*) ───────────────────────
    {
        "key":             "interest_first",
        "category":        "interest",
        "name":            "Curious",
        "description":     "Completed your first interest mission.",
        "badge_shape":     "diamond",
        "badge_color":     "#E879F9",
        "badge_secondary": "#6D28D9",
        "sort_order":      70,
        "tracked":         True,
    },
    {
        "key":             "interest_7",
        "category":        "interest",
        "name":            "Week of Practice",
        "description":     "Completed 7 sessions on an interest.",
        "badge_shape":     "diamond",
        "badge_color":     "#F0ABFC",
        "badge_secondary": "#86198F",
        "sort_order":      71,
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
        "sort_order":      72,
        "tracked":         True,
    },
    {
        "key":             "interest_50",
        "category":        "interest",
        "name":            "Deep Roots",
        "description":     "Completed 50 sessions on an interest.",
        "badge_shape":     "diamond",
        "badge_color":     "#E9D5FF",
        "badge_secondary": "#5B21B6",
        "sort_order":      73,
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
        "sort_order":      74,
        "tracked":         True,
    },
    # ── Power Score (users.power_score) ───────────────────────────────────────
    {
        "key":             "power_1000",
        "category":        "power",
        "name":            "Rising",
        "description":     "Reached 1,000 Power Score.",
        "badge_shape":     "diamond",
        "badge_color":     "#FBBF24",
        "badge_secondary": "#D97706",
        "sort_order":      80,
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
        "sort_order":      81,
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
        "sort_order":      82,
        "tracked":         True,
    },
]


def _streak_milestone_from_type(mt: str) -> Optional[int]:
    if not mt.startswith("streak_"):
        return None
    try:
        return int(mt.replace("streak_", "", 1))
    except ValueError:
        return None


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
        streak_set = frozenset(STREAK_MILESTONES)
        for row in (ml_result.data or []):
            mt = str(row.get("milestone_type") or "")
            ea = str(row.get("earned_at") or "")

            snum = _streak_milestone_from_type(mt)
            if snum is not None and snum in streak_set:
                earned.setdefault(mt, ea)

            if mt.startswith("stage_"):
                try:
                    st = int(mt.replace("stage_", "", 1))
                    if 2 <= st <= 6:
                        earned.setdefault(mt, ea)
                except ValueError:
                    pass

            if mt == "pet_unlock":
                earned.setdefault(mt, ea)
            elif mt.startswith("pet_stage_"):
                try:
                    ps = int(mt.replace("pet_stage_", "", 1))
                    if 2 <= ps <= 8:
                        earned.setdefault(mt, ea)
                except ValueError:
                    pass

            if mt == "interest_first_session":
                earned.setdefault("interest_first", ea)
            elif mt == "interest_sessions_7":
                earned.setdefault("interest_7", ea)
            elif mt == "interest_sessions_25":
                earned.setdefault("interest_25", ea)
            elif mt == "interest_sessions_50":
                earned.setdefault("interest_50", ea)
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
            .eq("status", "completed")
            .order("season_number", desc=False)
        )
        season_rows = seasons_result.data or []
        completed_count = len(season_rows)

        for row in season_rows:
            sn = int(row.get("season_number") or 0)
            tier = str(row.get("completion_tier") or "")
            ea = str(row.get("updated_at") or "")

            if tier in ("perfect", "clear", "partial") and 1 <= sn <= _SEASON_COMPLETE_BADGE_MAX:
                earned.setdefault(f"season_{sn}_complete", ea)

            if sn == 1 and tier == "perfect":
                earned.setdefault("season_1_perfect", ea)

        if completed_count >= 5:
            fifth = season_rows[4]
            earned.setdefault(
                "veteran",
                str(fifth.get("updated_at") or ""),
            )

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
        key = entry["key"]
        tracked = entry.get("tracked", True)

        if tracked and key in earned:
            earned_at = earned[key] or None
            item = {**entry, "earned": True, "earned_at": earned_at}
            if earned_at and earned_at > latest_ea:
                latest_ea = earned_at
                featured = item
        else:
            item = {**entry, "earned": False, "earned_at": None}

        result.append(item)

    earned_count = sum(1 for r in result if r["earned"])

    if featured is None:
        undated = [r for r in result if r["earned"] and not r.get("earned_at")]
        if undated:
            featured = max(undated, key=lambda r: int(r.get("sort_order") or 0))

    return {
        "total":        len(result),
        "earned_count": earned_count,
        "achievements": result,
        "featured":     featured,
    }
