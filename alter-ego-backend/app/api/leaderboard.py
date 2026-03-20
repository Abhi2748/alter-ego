"""
Leaderboard endpoints.
Unlocks when user hits their first 3-day streak.
For beta: all beta_free users are unlocked automatically.
"""

from fastapi import APIRouter, Header, HTTPException

from app.api.auth import get_user_id_from_token
from app.core.constants import STAGE_NAMES, PET_NAMES
from app.core.supabase_client import supabase_admin

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])


@router.get("", response_model=dict)
async def get_leaderboard(authorization: str = Header(None)):
    """
    Returns the leaderboard — top 100 users by Power Score.
    Also returns the current user's rank even if outside top 100.

    Requires: leaderboard_unlocked = true OR subscription_tier = 'beta_free'
    """
    user_id = get_user_id_from_token(authorization)

    # Check access
    user_result = (
        supabase_admin.table("users")
        .select(
            "leaderboard_unlocked, subscription_tier, power_score, "
            "username, character_stage, pet_stage, pet_unlocked, current_streak"
        )
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = user_result.data or {}

    # Beta users bypass the unlock requirement
    is_beta = user.get("subscription_tier") == "beta_free"
    is_unlocked = user.get("leaderboard_unlocked", False)

    if not is_beta and not is_unlocked:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "leaderboard_locked",
                "message": "Complete a 3-day streak to unlock the leaderboard.",
                "current_streak": user.get("current_streak", 0),
                "streak_needed": 3,
            },
        )

    # Get top 100 users
    top_100 = (
        supabase_admin.table("users")
        .select(
            "id, username, power_score, character_stage, "
            "pet_stage, pet_unlocked, current_streak"
        )
        .eq("onboarding_complete", True)
        .eq("leaderboard_unlocked", True)
        .order("power_score", desc=True)
        .limit(100)
        .execute()
        .data
        or []
    )

    # Find current user's rank — count how many users have a higher power score
    user_power_score = user.get("power_score", 0)
    rank_result = (
        supabase_admin.table("users")
        .select("id", count="exact")
        .eq("onboarding_complete", True)
        .gt("power_score", user_power_score)
        .execute()
    )
    higher_count = getattr(rank_result, "count", None)
    user_rank = (higher_count or 0) + 1

    # Format leaderboard entries
    entries = []
    for i, u in enumerate(top_100):
        stage = u.get("character_stage", 1) or 1
        pet_stage = u.get("pet_stage", 0) or 0
        entries.append(
            {
                "rank": i + 1,
                "user_id": u["id"],
                "username": u.get("username", "unknown"),
                "power_score": u.get("power_score", 0),
                "character_stage": stage,
                "character_stage_name": STAGE_NAMES[stage - 1],
                "pet_stage": pet_stage,
                "pet_name": PET_NAMES[pet_stage - 1]
                if pet_stage > 0 and u.get("pet_unlocked")
                else None,
                "current_streak": u.get("current_streak", 0),
                "is_current_user": u["id"] == user_id,
            }
        )

    pool_count_res = (
        supabase_admin.table("users")
        .select("id", count="exact")
        .eq("onboarding_complete", True)
        .eq("leaderboard_unlocked", True)
        .execute()
    )
    total_on_leaderboard = getattr(pool_count_res, "count", None) or len(top_100)

    return {
        "entries": entries,
        "current_user": {
            "rank": user_rank,
            "power_score": user_power_score,
            "username": user.get("username"),
            "character_stage": user.get("character_stage", 1) or 1,
            "in_top_100": user_rank <= 100,
        },
        "total_users": total_on_leaderboard,
        "last_updated": "nightly",
    }


@router.get("/rank", response_model=dict)
async def get_my_rank(authorization: str = Header(None)):
    """
    Returns only the current user's rank and score.
    Lightweight — used for the home screen power score display.
    """
    user_id = get_user_id_from_token(authorization)

    user_result = (
        supabase_admin.table("users")
        .select("power_score, username, leaderboard_unlocked, subscription_tier")
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = user_result.data or {}

    user_power_score = user.get("power_score", 0)
    rank_result = (
        supabase_admin.table("users")
        .select("id", count="exact")
        .eq("onboarding_complete", True)
        .gt("power_score", user_power_score)
        .execute()
    )
    higher_count = getattr(rank_result, "count", None)
    rank = (higher_count or 0) + 1

    return {
        "rank": rank,
        "power_score": user_power_score,
        "leaderboard_unlocked": user.get("leaderboard_unlocked", False)
        or user.get("subscription_tier") == "beta_free",
    }

