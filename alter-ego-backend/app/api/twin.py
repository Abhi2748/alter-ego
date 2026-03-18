"""
Twin API endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.api.auth import get_user_id_from_token
from app.core.constants import PET_NAMES, STAGE_NAMES, XP_THRESHOLDS
from app.agents.twin_chat_agent import get_twin_response
from app.core.supabase_client import supabase_admin
from app.services.mission_service import get_user_date
from app.services.twin_service import get_home_strip_context

router = APIRouter(prefix="/api/v1/twin", tags=["twin"])


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    response: str


class TwinMessage(BaseModel):
    id: str
    role: str
    content: str
    created_at: str


class ChatHistoryResponse(BaseModel):
    messages: list[TwinMessage]


class TwinUserState(BaseModel):
    username: str | None = None
    total_xp: int
    character_stage: int
    character_stage_name: str
    pet_stage: int
    pet_name: str | None = None
    pet_unlocked: bool
    current_streak: int
    power_score: int
    missions_today: list[dict]
    missions_completed_today: int
    missions_total_today: int
    xp_earned_today: int


class TwinRivalState(BaseModel):
    twin_xp: int
    character_stage: int
    character_stage_name: str
    pet_stage: int
    pet_name: str | None = None
    pet_unlocked: bool
    streak: int
    power_score: int
    gap_state: str
    missions_completed_today: int
    missions_total_today: int
    missed_mission_titles: list[str]
    xp_earned_today: int


class TwinGapState(BaseModel):
    xp_difference: int
    user_is_ahead: bool
    gap_state: str
    days_user_ahead: int


class TwinStateResponse(BaseModel):
    user: TwinUserState
    twin: TwinRivalState
    gap: TwinGapState


@router.post("/chat", response_model=ChatResponse)
async def chat_with_twin(body: ChatRequest, authorization: str = Header(None)):
    """
    Send a message to the twin and get a response.
    The twin responds in character based on archetype and current gap state.
    """
    user_id = get_user_id_from_token(authorization)

    if not body.message or not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    message = body.message.strip()[:500]

    response = await get_twin_response(user_id, message)
    return {"response": response}


@router.get("/chat/history", response_model=ChatHistoryResponse)
async def get_chat_history(authorization: str = Header(None), limit: int = 50):
    """
    Returns the last N messages of the twin chat conversation.
    Used when the chat screen opens to show previous messages.
    """
    user_id = get_user_id_from_token(authorization)

    result = (
        supabase_admin.table("twin_messages")
        .select("id, role, content, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .limit(min(limit, 100))
        .execute()
    )

    return {"messages": result.data or []}


@router.get("/strip", response_model=dict)
async def get_twin_strip(authorization: str = Header(None)):
    """
    Returns the twin strip context for the home screen.
    Includes gap state, strip message, and twin stats.
    """
    user_id = get_user_id_from_token(authorization)
    context = await get_home_strip_context(user_id)

    # If no strip message exists yet, generate one now
    if not context.get("strip_message"):
        from app.services.strip_message_service import update_strip_message

        new_msg = await update_strip_message(user_id)
        if new_msg:
            context["strip_message"] = new_msg

    return context


@router.get("/state", response_model=TwinStateResponse)
async def get_twin_state(authorization: str = Header(None)):
    """
    Returns full twin state for the Twin Comparison screen.
    """
    user_id = get_user_id_from_token(authorization)

    user_result = (
        supabase_admin.table("users")
        .select(
            "total_xp, character_stage, pet_stage, pet_unlocked, "
            "current_streak, timezone, username, power_score"
        )
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = user_result.data or {}

    twin_result = (
        supabase_admin.table("twin_state").select("*").eq("user_id", user_id).single().execute()
    )
    twin = twin_result.data or {}

    today = get_user_date(user.get("timezone", "UTC") or "UTC")

    user_missions = (
        supabase_admin.table("missions")
        .select("id, title, type, difficulty, completed, xp_value")
        .eq("user_id", user_id)
        .eq("mission_date", today)
        .execute()
        .data
        or []
    )

    twin_today = (
        supabase_admin.table("twin_daily_record")
        .select("*")
        .eq("user_id", user_id)
        .eq("record_date", today)
        .execute()
        .data
    )
    twin_record = twin_today[0] if twin_today else None

    # User XP earned today
    xp_today_rows = (
        supabase_admin.table("xp_log")
        .select("amount")
        .eq("user_id", user_id)
        .eq("log_date", today)
        .execute()
        .data
        or []
    )
    xp_today = sum(r.get("amount", 0) for r in xp_today_rows)

    # Days user has been ahead since last_passed_at
    from datetime import date as date_type

    last_passed = twin.get("last_passed_at")
    user_is_ahead = user.get("total_xp", 0) > twin.get("twin_xp", 0)
    days_user_ahead = 0
    if last_passed and user_is_ahead:
        try:
            days_user_ahead = (date_type.today() - date_type.fromisoformat(str(last_passed)[:10])).days
        except Exception:
            days_user_ahead = 0

    twin_xp = int(twin.get("twin_xp", 0) or 0)
    twin_power_score = round(twin_xp / max(int(XP_THRESHOLDS[5]), 1) * 1000)

    return {
        "user": {
            "username": user.get("username"),
            "total_xp": user.get("total_xp", 0),
            "character_stage": user.get("character_stage", 1),
            "character_stage_name": STAGE_NAMES[user.get("character_stage", 1) - 1],
            "pet_stage": user.get("pet_stage", 0),
            "pet_name": PET_NAMES[user.get("pet_stage", 1) - 1] if user.get("pet_unlocked") else None,
            "pet_unlocked": user.get("pet_unlocked", False),
            "current_streak": user.get("current_streak", 0),
            "power_score": int(user.get("power_score", 0) or 0),
            "missions_today": user_missions,
            "missions_completed_today": sum(1 for m in user_missions if m.get("completed")),
            "missions_total_today": len(user_missions),
            "xp_earned_today": xp_today,
        },
        "twin": {
            "twin_xp": twin_xp,
            "character_stage": twin.get("twin_character_stage", 1),
            "character_stage_name": STAGE_NAMES[twin.get("twin_character_stage", 1) - 1],
            "pet_stage": twin.get("twin_pet_stage", 0),
            "pet_name": PET_NAMES[twin.get("twin_pet_stage", 1) - 1] if twin.get("twin_pet_unlocked") else None,
            "pet_unlocked": twin.get("twin_pet_unlocked", False),
            "streak": twin.get("twin_streak", 0),
            "power_score": int(twin_power_score),
            "gap_state": twin.get("current_gap_state", "neck_and_neck"),
            "missions_completed_today": twin_record["missions_completed"] if twin_record else 0,
            "missions_total_today": twin_record["missions_assigned"] if twin_record else 0,
            "missed_mission_titles": twin_record["missed_mission_titles"] if twin_record else [],
            "xp_earned_today": twin_record["xp_earned"] if twin_record else 0,
        },
        "gap": {
            "xp_difference": abs(user.get("total_xp", 0) - twin.get("twin_xp", 0)),
            "user_is_ahead": user_is_ahead,
            "gap_state": twin.get("current_gap_state", "neck_and_neck"),
            "days_user_ahead": days_user_ahead,
        },
    }

