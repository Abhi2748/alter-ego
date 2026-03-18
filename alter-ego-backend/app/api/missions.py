from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.api.auth import get_user_id_from_token
from app.core.supabase_client import supabase_admin
from app.agents.planner_agent import generate_all_interest_missions, generate_all_quit_target_missions
from app.core.constants import JOURNAL_MIN_WORDS
from app.agents.personal_mission_agent import estimate_personal_mission_tier
from app.services.mission_service import (
    complete_mission,
    generate_core_missions_for_user,
    get_days_since_registration,
    get_today_missions_by_type,
    get_today_missions,
    get_user_date,
)

router = APIRouter(prefix="/api/v1/missions", tags=["missions"])


def _group_missions(rows: list[dict]) -> dict:
    grouped = {"core": [], "interest": [], "resistance": [], "personal": []}
    for r in rows or []:
        t = r.get("type")
        if t in grouped:
            grouped[t].append(
                {
                    "id": r.get("id"),
                    "title": r.get("title"),
                    "difficulty": r.get("difficulty"),
                    "xp_value": r.get("xp_value"),
                    "pf_value": r.get("pf_value"),
                    "completed": r.get("completed", False),
                    "is_journal_mission": r.get("is_journal_mission", False),
                    "core_pillar": r.get("core_pillar"),
                    "rationale": r.get("rationale"),
                }
            )
    return grouped


def _summary(rows: list[dict]) -> dict:
    total = len(rows or [])
    completed = sum(1 for r in (rows or []) if r.get("completed"))
    xp_available = sum(int(r.get("xp_value") or 0) for r in (rows or []))
    pf_available = sum(int(r.get("pf_value") or 0) for r in (rows or []))
    return {"total": total, "completed": completed, "xp_available": xp_available, "pf_available": pf_available}

class RateMissionRequest(BaseModel):
    rating: int
    feedback_text: str | None = None


class JournalSaveRequest(BaseModel):
    content: str
    date: str  # YYYY-MM-DD


class StageEvolved(BaseModel):
    new_stage: int
    new_stage_name: str


class PetEvolved(BaseModel):
    new_stage: int
    new_pet_name: str


class StreakAnimation(BaseModel):
    show: bool
    streak_count: int
    animation_tier: str


class CompleteMissionResponse(BaseModel):
    success: bool
    already_completed: bool | None = None

    xp_earned: int
    pf_earned: int
    new_total_xp: int
    new_total_pf: int

    daily_xp_remaining: int | None = None
    daily_pf_remaining: int | None = None

    stage_evolved: StageEvolved | None = None
    pet_evolved: PetEvolved | None = None

    streak_updated: bool | None = None
    current_streak: int | None = None
    streak_animation: StreakAnimation | None = None
    tier_upgraded: bool | None = None
    new_streak_tier: str | None = None
    milestone_reached: int | None = None
    leaderboard_just_unlocked: bool | None = None


class PersonalMissionEstimateRequest(BaseModel):
    mission_text: str


class PersonalMissionCreateRequest(BaseModel):
    mission_text: str
    tier: str
    xp: int
    pf: int
    estimated_minutes: int
    date: str  # YYYY-MM-DD
    multiday_days: int | None = None


@router.get("/today", response_model=dict)
async def get_missions_today(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    user_row = (
        supabase_admin.table("users")
        .select("timezone, registration_date")
        .eq("id", user_id)
        .single()
        .execute()
    )
    timezone_str = (user_row.data or {}).get("timezone") or "UTC"
    registration_date = (user_row.data or {}).get("registration_date") or ""

    mission_date = get_user_date(timezone_str)

    # Ensure core missions exist (idempotent)
    await generate_core_missions_for_user(user_id, mission_date)

    # Ensure interest missions exist (cron fallback)
    interest_missions = await get_today_missions_by_type(user_id, mission_date, "interest")
    if not interest_missions:
        await generate_all_interest_missions(user_id, mission_date)

    # Ensure resistance missions exist (cron fallback)
    resistance_missions = await get_today_missions_by_type(user_id, mission_date, "resistance")
    if not resistance_missions:
        await generate_all_quit_target_missions(user_id, mission_date)

    rows = await get_today_missions(user_id, mission_date)
    return {
        "date": mission_date,
        "day_number": get_days_since_registration(str(registration_date), str(timezone_str)),
        "missions": _group_missions(rows),
        "summary": _summary(rows),
    }


@router.get("/date/{date_str}", response_model=dict)
async def get_missions_for_date(date_str: str, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    # Fetch missions for that date; do not create if missing
    result = (
        supabase_admin.table("missions")
        .select("*")
        .eq("user_id", user_id)
        .eq("mission_date", date_str)
        .execute()
    )
    rows = result.data or []
    return {
        "date": date_str,
        "missions": _group_missions(rows),
        "summary": _summary(rows),
    }


@router.post("/generate-interest", response_model=dict)
async def generate_interest_missions_today(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    user_row = (
        supabase_admin.table("users")
        .select("timezone")
        .eq("id", user_id)
        .single()
        .execute()
    )
    timezone_str = (user_row.data or {}).get("timezone") or "UTC"
    mission_date = get_user_date(timezone_str)
    missions = await generate_all_interest_missions(user_id, mission_date)
    return {"generated": len(missions), "missions": missions}


@router.post("/generate-resistance", response_model=dict)
async def generate_resistance_missions_today(authorization: str = Header(None)):
    """Manually trigger quit target mission generation for today."""
    user_id = get_user_id_from_token(authorization)
    user_row = (
        supabase_admin.table("users")
        .select("timezone")
        .eq("id", user_id)
        .single()
        .execute()
    )
    timezone_str = (user_row.data or {}).get("timezone") or "UTC"
    mission_date = get_user_date(timezone_str)
    missions = await generate_all_quit_target_missions(user_id, mission_date)
    return {"generated": len(missions), "missions": missions}


@router.post("/{mission_id}/complete", response_model=CompleteMissionResponse)
async def complete_mission_endpoint(mission_id: str, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    result = await complete_mission(user_id, mission_id)
    return result


@router.post("/{mission_id}/rate", response_model=dict)
async def rate_mission(mission_id: str, body: RateMissionRequest, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    if body.rating < 1 or body.rating > 5:
        raise HTTPException(status_code=400, detail="Invalid rating")

    mission_result = (
        supabase_admin.table("missions")
        .select("id, user_id, interest_id, quit_target_id")
        .eq("id", mission_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not mission_result.data:
        raise HTTPException(status_code=404, detail="Mission not found")

    mission = mission_result.data
    existing = (
        supabase_admin.table("mission_ratings")
        .select("id")
        .eq("user_id", user_id)
        .eq("mission_id", mission_id)
        .limit(1)
        .execute()
    )

    payload = {
        "user_id": user_id,
        "mission_id": mission_id,
        "interest_id": mission.get("interest_id"),
        "quit_target_id": mission.get("quit_target_id"),
        "rating": body.rating,
        "feedback_text": body.feedback_text,
    }

    if existing.data:
        rating_id = existing.data[0].get("id")
        supabase_admin.table("mission_ratings").update(payload).eq("id", rating_id).execute()
    else:
        supabase_admin.table("mission_ratings").insert(payload).execute()

    return {"saved": True}


@router.post("/journal/save", response_model=dict)
async def save_journal(body: JournalSaveRequest, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    content = body.content or ""
    mission_date = body.date

    words = [w for w in content.strip().split() if w]
    word_count = len(words)

    supabase_admin.table("journal_entries").upsert(
        {
            "user_id": user_id,
            "mission_date": mission_date,
            "content": content,
            "word_count": word_count,
        },
        on_conflict="user_id,mission_date",
    ).execute()

    if word_count >= JOURNAL_MIN_WORDS:
        journal_mission = (
            supabase_admin.table("missions")
            .select("id, completed")
            .eq("user_id", user_id)
            .eq("mission_date", mission_date)
            .eq("type", "core")
            .eq("core_pillar", "journal")
            .single()
            .execute()
        )
        if journal_mission.data and not journal_mission.data.get("completed"):
            await complete_mission(user_id, str(journal_mission.data["id"]))
        return {"saved": True, "mission_completed": True, "word_count": word_count}

    return {"saved": True, "mission_completed": False, "words_remaining": JOURNAL_MIN_WORDS - word_count}


@router.post("/personal/estimate", response_model=dict)
async def personal_estimate(body: PersonalMissionEstimateRequest, authorization: str = Header(None)):
    get_user_id_from_token(authorization)
    return await estimate_personal_mission_tier(body.mission_text)


@router.post("/personal/create", response_model=dict)
async def personal_create(body: PersonalMissionCreateRequest, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    # max 2 personal missions per day (hardcoded for now per spec)
    existing = (
        supabase_admin.table("missions")
        .select("id")
        .eq("user_id", user_id)
        .eq("mission_date", body.date)
        .eq("type", "personal")
        .execute()
    )
    if existing.data and len(existing.data) >= 2:
        raise HTTPException(status_code=400, detail="personal_mission_limit_reached")

    # Accept tier exactly as sent by client; do not re-estimate or validate it here.
    tier = (body.tier or "medium").lower()

    # XP/PF are derived from tier (not from client-provided xp/pf).
    if tier == "easy":
        xp_value, pf_value, difficulty = 8, 6, "easy"
    elif tier == "hard":
        xp_value, pf_value, difficulty = 32, 17, "hard"
    elif tier == "multiday":
        xp_value, pf_value, difficulty = 8, 5, "medium"  # multiday is represented via flags; difficulty stays enum-safe
    else:
        # default to medium (covers "medium" and any unexpected string without validation)
        xp_value, pf_value, difficulty = 16, 11, "medium"

    row = {
        "user_id": user_id,
        "type": "personal",
        "title": body.mission_text.strip(),
        "difficulty": difficulty,
        "xp_value": xp_value,
        "pf_value": pf_value,
        "mission_date": body.date,
        "completed": False,
        "estimated_minutes": int(body.estimated_minutes),
    }
    if tier == "multiday":
        row["is_multiday"] = True
        row["multiday_total_days"] = int(body.multiday_days or 2)
        row["multiday_day_number"] = 1

    created = supabase_admin.table("missions").insert(row).execute()
    return created.data[0] if created.data else row


@router.delete("/personal/{mission_id}", response_model=dict)
async def personal_delete(mission_id: str, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    mission_result = (
        supabase_admin.table("missions")
        .select("id, completed, type")
        .eq("id", mission_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not mission_result.data:
        raise HTTPException(status_code=404, detail="Mission not found")

    if mission_result.data.get("type") != "personal":
        raise HTTPException(status_code=400, detail="Not a personal mission")
    if mission_result.data.get("completed"):
        raise HTTPException(status_code=400, detail="Cannot delete completed mission")

    supabase_admin.table("missions").delete().eq("id", mission_id).execute()
    return {"deleted": True}

