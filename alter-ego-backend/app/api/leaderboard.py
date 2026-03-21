"""
Leaderboard endpoints.

Production: visible entries are users with `leaderboard_unlocked = true` (e.g. 3-day streak).

Beta: requesters with `subscription_tier = beta_free` OR env `ALTER_EGO_BETA_LEADERBOARD_POOL=1`
see a wider pool: `leaderboard_unlocked` OR `beta_free`, so solo beta testers still appear.
"""

import os

from fastapi import APIRouter, Header, HTTPException

from app.api.auth import get_user_id_from_token
from app.core.constants import STAGE_NAMES, PET_NAMES
from app.core.supabase_client import supabase_admin

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])

_BETA_POOL_ENV = os.environ.get("ALTER_EGO_BETA_LEADERBOARD_POOL", "").strip().lower() in (
    "1",
    "true",
    "yes",
)


def _requester_beta_leaderboard_pool(user: dict) -> bool:
    """Widen leaderboard membership query (beta / staging only)."""
    return user.get("subscription_tier") == "beta_free" or _BETA_POOL_ENV


def _beta_leaderboard_access_granted(user: dict) -> bool:
    """Who may open the leaderboard at all (beta / staging)."""
    return bool(user.get("leaderboard_unlocked")) or user.get("subscription_tier") == "beta_free" or _BETA_POOL_ENV


def _apply_leaderboard_pool_filter(q, use_beta_pool: bool):
    """Restrict to users who should appear on the leaderboard."""
    q = q.eq("onboarding_complete", True)
    if use_beta_pool:
        return q.or_("leaderboard_unlocked.eq.true,subscription_tier.eq.beta_free")
    return q.eq("leaderboard_unlocked", True)


@router.get("", response_model=dict)
async def get_leaderboard(authorization: str = Header(None)):
    """
    Returns the leaderboard — top 100 users by Power Score.
    Also returns the current user's rank even if outside top 100.

    Access: `leaderboard_unlocked` OR `subscription_tier = beta_free`.

    Beta pool (who appears in the list): same as access when using beta pool mode;
    otherwise only `leaderboard_unlocked` users.
    """
    user_id = get_user_id_from_token(authorization)

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

    use_beta_pool = _requester_beta_leaderboard_pool(user)

    if not _beta_leaderboard_access_granted(user):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "leaderboard_locked",
                "message": "Complete a 3-day streak to unlock the leaderboard.",
                "current_streak": user.get("current_streak", 0),
                "streak_needed": 3,
            },
        )

    top_100 = (
        _apply_leaderboard_pool_filter(
            supabase_admin.table("users").select(
                "id, username, power_score, character_stage, "
                "pet_stage, pet_unlocked, current_streak, subscription_tier"
            ),
            use_beta_pool,
        )
        .order("power_score", desc=True)
        .limit(100)
        .execute()
        .data
        or []
    )

    user_power_score = user.get("power_score", 0)
    rank_result = (
        _apply_leaderboard_pool_filter(
            supabase_admin.table("users").select("id", count="exact"),
            use_beta_pool,
        )
        .gt("power_score", user_power_score)
        .execute()
    )
    higher_count = getattr(rank_result, "count", None)
    user_rank = (higher_count or 0) + 1

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
        _apply_leaderboard_pool_filter(
            supabase_admin.table("users").select("id", count="exact"),
            use_beta_pool,
        )
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
        "beta_leaderboard_pool": use_beta_pool,
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
    use_beta_pool = _requester_beta_leaderboard_pool(user)

    rank_result = (
        _apply_leaderboard_pool_filter(
            supabase_admin.table("users").select("id", count="exact"),
            use_beta_pool,
        )
        .gt("power_score", user_power_score)
        .execute()
    )
    higher_count = getattr(rank_result, "count", None)
    rank = (higher_count or 0) + 1

    return {
        "rank": rank,
        "power_score": user_power_score,
        "leaderboard_unlocked": _beta_leaderboard_access_granted(user),
        "beta_leaderboard_pool": use_beta_pool,
    }
