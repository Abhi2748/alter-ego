"""
Subscription gate.

For beta: all users with subscription_tier = 'beta_free' bypass all gates.
For post-beta: free users after 7-day trial are paywalled.

Features gated post-beta:
- leaderboard (unlocked via streak, not subscription — but viewing requires active sub)
- twin chat (free: 5 messages/day. premium: unlimited)
- interest missions beyond 1 per day (free: 1 interest mission. premium: up to 3)
- weekly report (premium only)
- pet system (premium only — viewing pet is free, earning PF requires premium)

For beta: ALL features unlocked for ALL users. No gates active.
"""

from datetime import datetime, timezone

from app.core.constants import FREE_TRIAL_DAYS
from app.core.supabase_client import supabase_admin


async def check_feature_access(user_id: str, feature: str) -> dict:
    """
    Checks if a user has access to a premium feature.

    Returns:
    {
        "allowed": bool,
        "reason": "beta" | "trial" | "subscriber" | "trial_expired",
        "days_remaining": int | None,
    }

    Features: "leaderboard", "twin_chat", "extra_missions",
              "weekly_report", "pet_system"
    """
    user_result = (
        supabase_admin.table("users")
        .select("subscription_tier, trial_start_date, registration_date")
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = user_result.data or {}

    tier = user.get("subscription_tier", "free")

    # Beta bypass — all features unlocked
    if tier == "beta_free":
        return {"allowed": True, "reason": "beta", "days_remaining": None}

    # Premium/Pro — all features unlocked
    if tier in ("premium", "pro"):
        return {"allowed": True, "reason": "subscriber", "days_remaining": None}

    # Free tier — check trial period
    trial_start = user.get("trial_start_date") or user.get("registration_date")
    if trial_start:
        try:
            trial_start_dt = datetime.fromisoformat(str(trial_start)).replace(
                tzinfo=timezone.utc
            )
        except ValueError:
            trial_start_dt = datetime.now(timezone.utc)

        days_on_trial = (datetime.now(timezone.utc) - trial_start_dt).days
        days_remaining = max(0, FREE_TRIAL_DAYS - days_on_trial)

        if days_remaining > 0:
            return {
                "allowed": True,
                "reason": "trial",
                "days_remaining": days_remaining,
            }

    # Trial expired and not subscribed
    return {
        "allowed": False,
        "reason": "trial_expired",
        "days_remaining": 0,
    }


def is_beta_user(subscription_tier: str) -> bool:
    """Quick check — use when full async check is overkill."""
    return subscription_tier == "beta_free"

