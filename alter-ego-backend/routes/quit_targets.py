"""
GET /quit-targets, POST /quit-targets, POST /quit-targets/{id}/conquer,
POST /quit-targets/{id}/slip, GET /quit-targets/{id}/milestones.
Quit target tracking: no schedule, replacement missions every day.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from utils.auth import get_user_id
from utils.supabase_client import get_supabase

router = APIRouter(prefix="/quit-targets", tags=["quit-targets"])

# Phase ranges: (start_day, end_day, phase_name)
_PHASE_RANGES = [
    (1, 10, "awareness"),
    (11, 30, "replacement"),
    (31, 60, "reflex"),
    (61, 90, "rewired"),
    (91, 9999, "free"),
]


def _phase_from_total_days(total_days: int) -> tuple:
    for start, end, phase in _PHASE_RANGES:
        if start <= total_days <= end:
            days_in = total_days - start + 1
            return phase, days_in
    return "free", max(0, total_days - 90)


class QuitTargetRow(BaseModel):
    id: str
    quit_name: str
    quit_description: str
    trigger_description: str
    underlying_need: str
    need_category: str
    status: str
    started_at: str
    current_clean_streak: int
    best_clean_streak: int
    total_clean_days: int
    slip_count: int
    cravings_resisted: int
    current_phase: str
    days_in_current_phase: int
    conquered_at: Optional[str]
    last_active_date: Optional[str]
    milestones: List[dict]


class QuitTargetsOut(BaseModel):
    targets: List[QuitTargetRow] = []


class PostQuitBody(BaseModel):
    quit_description: str
    trigger_description: str


class ConquerBody(BaseModel):
    conquered_at: str
    final_clean_days: int
    cravings_resisted: int


@router.get("", response_model=QuitTargetsOut)
async def get_quit_targets(user_id: str = Depends(get_user_id)):
    """Return all quit targets for the user (active + conquered) with milestones."""
    supabase = get_supabase()
    try:
        r = supabase.table("quit_targets").select("*").eq("user_id", user_id).execute()
        rows = r.data or []
    except Exception:
        rows = []
    out = []
    for row in rows:
        target_id = str(row.get("id", ""))
        total_days = int(row.get("total_clean_days", 0))
        current_phase, days_in_phase = _phase_from_total_days(total_days)
        milestones = row.get("milestones") or []
        try:
            m_r = (
                supabase.table("quit_milestones")
                .select("*")
                .eq("quit_target_id", target_id)
                .eq("user_id", user_id)
                .execute()
            )
            if m_r.data:
                milestones = m_r.data
        except Exception:
            pass
        last_active = row.get("last_active_date")
        if last_active:
            last_active = str(last_active)
        out.append(
            QuitTargetRow(
                id=target_id,
                quit_name=str(row.get("quit_name", "")),
                quit_description=str(row.get("quit_description", "")),
                trigger_description=str(row.get("trigger_description", "")),
                underlying_need=str(row.get("underlying_need", "Boredom / Dopamine")),
                need_category=str(row.get("need_category", "boredom_dopamine")),
                status=str(row.get("status", "active")),
                started_at=str(row.get("started_at", "")),
                current_clean_streak=int(row.get("current_clean_streak", 0)),
                best_clean_streak=int(row.get("best_clean_streak", 0)),
                total_clean_days=total_days,
                slip_count=int(row.get("slip_count", 0)),
                cravings_resisted=int(row.get("cravings_resisted", 0)),
                current_phase=current_phase,
                days_in_current_phase=days_in_phase,
                conquered_at=row.get("conquered_at"),
                last_active_date=last_active,
                milestones=milestones,
            )
        )
    return QuitTargetsOut(targets=out)


@router.post("")
async def post_quit_target(payload: PostQuitBody, user_id: str = Depends(get_user_id)):
    """Create a new quit target. Agent derives canonical name + underlying need."""
    from datetime import date
    supabase = get_supabase()
    name = (payload.quit_description or "Quit")[:50].strip() or "Quit"
    today = date.today().isoformat()
    try:
        supabase.table("quit_targets").insert(
            {
                "user_id": user_id,
                "quit_name": name,
                "quit_description": payload.quit_description,
                "trigger_description": payload.trigger_description,
                "underlying_need": "Boredom / Dopamine",
                "need_category": "boredom_dopamine",
                "status": "active",
                "started_at": today,
                "current_clean_streak": 0,
                "best_clean_streak": 0,
                "total_clean_days": 0,
                "slip_count": 0,
                "cravings_resisted": 0,
                "last_active_date": None,
            }
        ).execute()
    except Exception:
        pass
    return {"success": True}


@router.post("/{target_id}/conquer")
async def post_quit_target_conquer(
    target_id: str, payload: ConquerBody, user_id: str = Depends(get_user_id)
):
    """Mark quit target as conquered. Insert conquered milestone in quit_milestones."""
    supabase = get_supabase()
    try:
        supabase.table("quit_targets").update(
            {
                "status": "conquered",
                "conquered_at": payload.conquered_at,
                "total_clean_days": payload.final_clean_days,
                "cravings_resisted": payload.cravings_resisted,
            }
        ).eq("id", target_id).eq("user_id", user_id).execute()
        supabase.table("quit_milestones").insert(
            {
                "quit_target_id": target_id,
                "user_id": user_id,
                "milestone_type": "conquered",
                "clean_days_at_earn": payload.final_clean_days,
                "phase_at_earn": "free",
            }
        ).execute()
    except Exception:
        pass
    return {"success": True}


class SlipOut(BaseModel):
    success: bool
    quit_name: str
    best_clean_streak: int
    total_clean_days: int
    current_clean_streak: int


@router.post("/{target_id}/slip", response_model=SlipOut)
async def post_quit_target_slip(target_id: str, user_id: str = Depends(get_user_id)):
    """Record a slip: increment slip_count, reset current_clean_streak. Returns data for SlipRecoveryModal."""
    supabase = get_supabase()
    try:
        r = (
            supabase.table("quit_targets")
            .select("quit_name, best_clean_streak, total_clean_days, slip_count")
            .eq("id", target_id)
            .eq("user_id", user_id)
            .execute()
        )
        row = (r.data or [{}])[0]
        slip_count = int(row.get("slip_count", 0)) + 1
        supabase.table("quit_targets").update(
            {"slip_count": slip_count, "current_clean_streak": 0}
        ).eq("id", target_id).eq("user_id", user_id).execute()
        return SlipOut(
            success=True,
            quit_name=str(row.get("quit_name", "")),
            best_clean_streak=int(row.get("best_clean_streak", 0)),
            total_clean_days=int(row.get("total_clean_days", 0)),
            current_clean_streak=0,
        )
    except Exception:
        return SlipOut(
            success=False,
            quit_name="",
            best_clean_streak=0,
            total_clean_days=0,
            current_clean_streak=0,
        )


@router.get("/{target_id}/milestones")
async def get_quit_target_milestones(
    target_id: str, user_id: str = Depends(get_user_id)
):
    """Return all milestones for this quit target (with days_away for locked)."""
    supabase = get_supabase()
    try:
        r = (
            supabase.table("quit_milestones")
            .select("*")
            .eq("quit_target_id", target_id)
            .eq("user_id", user_id)
            .order("earned_at", desc=True)
            .execute()
        )
        return {"milestones": r.data or []}
    except Exception:
        return {"milestones": []}
