"""GET /interests, POST /interests, PATCH /interests/{interest}, PUT goal/difficulty/schedule."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from utils.auth import get_user_id
from utils.supabase_client import get_supabase

router = APIRouter(prefix="/interests", tags=["interests"])

DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


class InterestRowOut(BaseModel):
    interest: str
    total_xp: int = 0
    level: int = 1
    self_level: Optional[str] = None
    learning_goal: Optional[str] = None
    schedule: Optional[List[int]] = None


class InterestsOut(BaseModel):
    interests: List[InterestRowOut] = []


class InterestUpdate(BaseModel):
    self_level: Optional[str] = None
    learning_goal: Optional[str] = None
    schedule: Optional[List[int]] = None


class PostInterestBody(BaseModel):
    interest_description: str
    interest_level: str
    goal_description: str
    schedule_days: List[int]  # 0-6 Mon-Sun


class PutGoalBody(BaseModel):
    new_goal: str
    progress_level: str  # just_started | part_way | almost_there
    progress_detail: Optional[str] = None


class PutDifficultyBody(BaseModel):
    tier: str  # easy | medium | hard


class PutScheduleBody(BaseModel):
    days: List[str]  # ["mon","wed","fri"]


def _slug_from_description(description: str) -> str:
    """Derive a short canonical interest name for DB (e.g. 'Fitness', 'Running')."""
    text = (description or "").strip()[:200]
    if not text:
        return "Interest"
    # Use first meaningful phrase (e.g. "I love running outdoors" -> "Running outdoors")
    words = re.sub(r"[^\w\s]", "", text).split()
    if not words:
        return "Interest"
    first = words[0].capitalize()
    if len(words) == 1:
        return first
    return first + " " + " ".join(w.lower() for w in words[1:4])[:30].rstrip()


def _tier_to_current_tier(tier: str) -> int:
    """Map app tier to backend current_tier 1-4."""
    t = (tier or "").lower()
    if t == "easy":
        return 1
    if t == "hard":
        return 3
    return 2  # medium


@router.get("", response_model=InterestsOut)
async def get_interests(user_id: str = Depends(get_user_id)):
    supabase = get_supabase()
    r = supabase.table("interest_progress").select("*").eq("user_id", user_id).execute()
    rows = r.data or []
    out: List[InterestRowOut] = []
    for row in rows:
        out.append(
            InterestRowOut(
                interest=str(row.get("interest") or ""),
                total_xp=int(row.get("total_xp") or 0),
                level=int(row.get("level") or 1),
                self_level=row.get("self_level"),
                learning_goal=row.get("learning_goal"),
                schedule=row.get("schedule"),
            )
        )
    return InterestsOut(interests=out)


@router.post("")
async def post_interest(payload: PostInterestBody, user_id: str = Depends(get_user_id)):
    """Create a new interest. Canonical name derived from description; full text stored in learning_goal."""
    supabase = get_supabase()
    interest_name = _slug_from_description(payload.interest_description)
    row = {
        "user_id": user_id,
        "interest": interest_name,
        "learning_goal": payload.goal_description or payload.interest_description,
        "schedule": payload.schedule_days,
        "self_level": payload.interest_level,
        "total_xp": 0,
        "level": 1,
        "session_count": 0,
    }
    try:
        supabase.table("interest_progress").upsert(row, on_conflict="user_id,interest").execute()
    except Exception:
        slim = {"user_id": user_id, "interest": interest_name}
        supabase.table("interest_progress").upsert(slim, on_conflict="user_id,interest").execute()
    return {"success": True, "interest": interest_name}


@router.patch("/{interest}")
async def patch_interest(interest: str, payload: InterestUpdate, user_id: str = Depends(get_user_id)):
    """Upsert per-interest metadata into interest_progress. Tolerates older DBs missing columns."""
    supabase = get_supabase()
    updates: Dict[str, Any] = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not updates:
        return {"success": True}

    row = {"user_id": user_id, "interest": interest, **updates}

    try:
        supabase.table("interest_progress").upsert(row, on_conflict="user_id,interest").execute()
    except Exception:
        slim = {"user_id": user_id, "interest": interest}
        supabase.table("interest_progress").upsert(slim, on_conflict="user_id,interest").execute()
    return {"success": True}


@router.put("/{interest}/goal")
async def put_interest_goal(
    interest: str, payload: PutGoalBody, user_id: str = Depends(get_user_id)
):
    supabase = get_supabase()
    updates = {"learning_goal": payload.new_goal}
    try:
        supabase.table("interest_progress").update(updates).eq(
            "user_id", user_id
        ).eq("interest", interest).execute()
    except Exception:
        pass
    return {"success": True}


@router.put("/{interest}/difficulty")
async def put_interest_difficulty(
    interest: str, payload: PutDifficultyBody, user_id: str = Depends(get_user_id)
):
    supabase = get_supabase()
    current_tier = _tier_to_current_tier(payload.tier)
    try:
        supabase.table("interest_progress").update({"current_tier": current_tier}).eq(
            "user_id", user_id
        ).eq("interest", interest).execute()
    except Exception:
        pass
    return {"success": True}


@router.put("/{interest}/schedule")
async def put_interest_schedule(
    interest: str, payload: PutScheduleBody, user_id: str = Depends(get_user_id)
):
    supabase = get_supabase()
    days = payload.days or []
    schedule = [DAY_KEYS.index(d.lower()) for d in days if d.lower() in DAY_KEYS]
    try:
        supabase.table("interest_progress").update({"schedule": schedule}).eq(
            "user_id", user_id
        ).eq("interest", interest).execute()
    except Exception:
        pass
    return {"success": True}


@router.delete("/{interest}")
async def delete_interest(interest: str, user_id: str = Depends(get_user_id)):
    """Remove this interest from the user's list."""
    supabase = get_supabase()
    try:
        supabase.table("interest_progress").delete().eq(
            "user_id", user_id
        ).eq("interest", interest).execute()
    except Exception:
        pass
    return {"success": True}

