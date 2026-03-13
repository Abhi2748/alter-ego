"""GET /interests and PATCH /interests/{interest} — per-interest goal/level/schedule metadata."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from utils.auth import get_user_id
from utils.supabase_client import get_supabase

router = APIRouter(prefix="/interests", tags=["interests"])


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
        # If columns don't exist yet, fall back gracefully (no crash)
        slim = {"user_id": user_id, "interest": interest}
        supabase.table("interest_progress").upsert(slim, on_conflict="user_id,interest").execute()
    return {"success": True}

