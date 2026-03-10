"""Leaderboard: Power Score ranking (Gamification §7.1). GET /leaderboard, GET /leaderboard/refresh."""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends

from utils.auth import get_user_id, get_optional_user_id
from utils.supabase_client import get_supabase
from utils.power_score import refresh_leaderboard_scores

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


def _username_from_email(email: Optional[str]) -> str:
    if not email or "@" not in email:
        return "—"
    return email.split("@")[0].strip() or "—"


@router.get("")
async def get_leaderboard(user_id: Optional[str] = Depends(get_optional_user_id)):
    """
    Returns top 100 by power_score (desc), plus the requesting user's row if not in top 100.
    Each entry: rank, user_id, username, power_score, streak, pet_stage, character_stage, is_own.
    """
    supabase = get_supabase()

    # Top 100: leaderboard_scores joined with users for email
    scores = (
        supabase.table("leaderboard_scores")
        .select("user_id, power_score, streak, pet_stage, character_stage")
        .order("power_score", desc=True)
        .limit(100)
        .execute()
    )
    rows = scores.data or []
    user_ids = [r["user_id"] for r in rows]

    # Batch-fetch emails for these users
    emails: Dict[str, str] = {}
    if user_ids:
        ur = supabase.table("users").select("id, email").in_("id", user_ids).execute()
        for u in ur.data or []:
            emails[u["id"]] = u.get("email") or ""

    entries: List[Dict[str, Any]] = []
    for i, r in enumerate(rows):
        uid = r.get("user_id")
        entries.append({
            "rank": i + 1,
            "user_id": uid,
            "username": _username_from_email(emails.get(uid)),
            "power_score": float(r.get("power_score", 0)),
            "streak": int(r.get("streak", 0)),
            "pet_stage": int(r.get("pet_stage", 0)),
            "character_stage": int(r.get("character_stage", 1)),
            "is_own": uid == user_id if user_id else False,
        })

    # If authenticated and not in top 100, fetch requesting user's row and rank
    my_entry = None
    my_rank = None
    if user_id:
        in_top = any(e["user_id"] == user_id for e in entries)
        for e in entries:
            if e["user_id"] == user_id:
                my_rank = e["rank"]
                my_entry = e
                break
        if not in_top:
            me = (
                supabase.table("leaderboard_scores")
                .select("user_id, power_score, streak, pet_stage, character_stage")
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )
            if me.data:
                score_val = float(me.data.get("power_score", 0))
                try:
                    rank_r = (
                        supabase.table("leaderboard_scores")
                        .select("user_id", count="exact")
                        .gt("power_score", score_val)
                        .limit(0)
                        .execute()
                    )
                    total_above = getattr(rank_r, "count", None)
                    if total_above is not None:
                        my_rank = int(total_above) + 1
                    else:
                        my_rank = None
                except Exception:
                    my_rank = None
                ur_me = supabase.table("users").select("email").eq("id", user_id).maybe_single().execute()
                my_entry = {
                    "rank": my_rank,
                    "user_id": user_id,
                    "username": _username_from_email((ur_me.data or {}).get("email")),
                    "power_score": score_val,
                    "streak": int(me.data.get("streak", 0)),
                    "pet_stage": int(me.data.get("pet_stage", 0)),
                    "character_stage": int(me.data.get("character_stage", 1)),
                    "is_own": True,
                }

    return {
        "entries": entries,
        "my_rank": my_rank,
        "my_entry": my_entry,
    }


@router.get("/refresh")
async def refresh_leaderboard():
    """
    Recalculate Power Score for all users with activity in last 7 days and UPSERT leaderboard_scores.
    Intended to be called hourly (e.g. by cron). No auth required so cron can hit it.
    """
    updated = refresh_leaderboard_scores()
    return {"status": "ok", "updated": updated}
