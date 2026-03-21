"""
Twin API endpoints.
"""

from __future__ import annotations

import uuid
from collections import Counter, defaultdict
from typing import Literal

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.api.auth import get_user_id_from_token
from app.core.constants import PET_NAMES, STAGE_NAMES
from app.agents.twin_chat_agent import get_twin_response
from app.core.supabase_client import supabase_admin
from app.services.mission_service import get_user_date
from app.services.strip_message_service import update_strip_message
from app.services.power_score_service import (
    compute_power_score_value,
    fetch_twin_30d_completion_rate,
)
from app.services.twin_service import (
    build_twin_day_timeline,
    ensure_twin_simulated_for_today,
    get_home_strip_context,
)

router = APIRouter(prefix="/api/v1/twin", tags=["twin"])


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    response: str
    user_message_id: str | None = None
    twin_message_id: str | None = None


class TwinToneRatingBody(BaseModel):
    """Rate a Twin chat line (👍 / — / 👎)."""

    message_id: str = Field(..., description="UUID of the twin_messages row (role=twin)")
    rating: Literal["positive", "neutral", "negative"]


_TONE_META: dict[str, tuple[str, str]] = {
    "rival": ("Rival", "✦"),
    "philosopher": ("Philosopher", "◇"),
    "silent_force": ("Silent Force", "◆"),
}


def _normalize_twin_tone(raw: str | None) -> str:
    t = str(raw or "rival").lower().replace(" ", "_").replace("-", "_")
    if t == "silentforce":
        t = "silent_force"
    if t not in _TONE_META:
        return "rival"
    return t


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


class TwinTimelineEvent(BaseModel):
    mission_title: str
    mission_type: str
    difficulty: str
    xp_earned: int
    completed_at: str


class TwinStateResponse(BaseModel):
    strip_message: str | None = None
    twin_timeline: list[TwinTimelineEvent] = Field(default_factory=list)
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

    result = await get_twin_response(user_id, message)
    return result


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

    rows = list(result.data or [])
    twin_ids = [str(r["id"]) for r in rows if r.get("role") == "twin"]
    ratings_map: dict[str, str] = {}
    if twin_ids:
        r2 = (
            supabase_admin.table("twin_tone_ratings")
            .select("twin_message_id, rating")
            .eq("user_id", user_id)
            .in_("twin_message_id", twin_ids)
            .execute()
        )
        for rr in r2.data or []:
            mid = rr.get("twin_message_id")
            if mid:
                ratings_map[str(mid)] = str(rr.get("rating") or "")

    for m in rows:
        tid = str(m.get("id") or "")
        m["tone_rating"] = ratings_map.get(tid)

    return {"messages": rows}


@router.post("/tone-rating", response_model=dict)
async def post_twin_tone_rating(body: TwinToneRatingBody, authorization: str = Header(None)):
    """
    Save or update the user's rating for one Twin chat message.
    Tone type is taken from current discipline_dna (voice at time of rating).
    """
    user_id = get_user_id_from_token(authorization)
    try:
        uuid.UUID(body.message_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid message_id") from e

    msg_res = (
        supabase_admin.table("twin_messages")
        .select("id, role")
        .eq("id", body.message_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    msg = (msg_res.data or [None])[0]
    if not msg or msg.get("role") != "twin":
        raise HTTPException(status_code=404, detail="Twin message not found")

    dna_res = (
        supabase_admin.table("discipline_dna")
        .select("twin_tone_type")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    dna = (dna_res.data or [None])[0] or {}
    tone_type = _normalize_twin_tone(dna.get("twin_tone_type"))

    existing = (
        supabase_admin.table("twin_tone_ratings")
        .select("id")
        .eq("user_id", user_id)
        .eq("twin_message_id", body.message_id)
        .execute()
    )
    payload = {
        "user_id": user_id,
        "twin_message_id": body.message_id,
        "rating": body.rating,
        "tone_type": tone_type,
    }
    if existing.data:
        rid = existing.data[0].get("id")
        supabase_admin.table("twin_tone_ratings").update(
            {"rating": body.rating, "tone_type": tone_type}
        ).eq("id", rid).execute()
    else:
        supabase_admin.table("twin_tone_ratings").insert(payload).execute()

    return {"ok": True, "tone_type": tone_type}


@router.get("/tone-history", response_model=dict)
async def get_twin_tone_history(authorization: str = Header(None)):
    """
    Aggregated twin tone ratings for Settings → Tone History.
    """
    user_id = get_user_id_from_token(authorization)

    rows = (
        supabase_admin.table("twin_tone_ratings")
        .select("tone_type, rating")
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )

    counts: Counter[tuple[str, str]] = Counter()
    for r in rows:
        tt = _normalize_twin_tone(r.get("tone_type"))
        rt = str(r.get("rating") or "")
        if rt not in ("positive", "neutral", "negative"):
            continue
        counts[(tt, rt)] += 1

    total = sum(counts.values())

    ratings_out: list[dict] = []
    for tone_key in ("rival", "philosopher", "silent_force"):
        for rating_key in ("positive", "neutral", "negative"):
            c = counts[(tone_key, rating_key)]
            if c <= 0:
                continue
            name, emoji = _TONE_META[tone_key]
            pct = round(100.0 * c / total, 1) if total else 0.0
            ratings_out.append(
                {
                    "tone_id": f"{tone_key}_{rating_key}",
                    "tone_name": name,
                    "tone_emoji": emoji,
                    "rating": rating_key,
                    "count": c,
                    "percentage": pct,
                }
            )

    dna_res = (
        supabase_admin.table("discipline_dna")
        .select("twin_tone_type, twin_intensity")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    dna = (dna_res.data or [None])[0] or {}
    intensity = int(dna.get("twin_intensity") or 3)
    intensity = max(1, min(5, intensity))

    positive_by_tone: defaultdict[str, int] = defaultdict(int)
    for (tt, rt), n in counts.items():
        if rt == "positive":
            positive_by_tone[tt] += n
    top_pos = sorted(positive_by_tone.items(), key=lambda x: -x[1])[:2]

    if len(top_pos) >= 2:
        current_blend = [
            _TONE_META[top_pos[0][0]][0],
            _TONE_META[top_pos[1][0]][0],
        ]
    elif len(top_pos) == 1:
        current_blend = [_TONE_META[top_pos[0][0]][0], f"Intensity {intensity}/5"]
    else:
        tt = _normalize_twin_tone(dna.get("twin_tone_type"))
        current_blend = [_TONE_META[tt][0], f"Intensity {intensity}/5"]

    return {
        "ratings": ratings_out,
        "total_ratings": total,
        "current_blend": current_blend,
    }


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

    Ensures today's twin simulation exists (same as 1:00 local job, but on-demand if the user
    opens the app earlier) so timeline + stats are never empty on day 1.
    """
    user_id = get_user_id_from_token(authorization)

    await ensure_twin_simulated_for_today(user_id)

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

    twin_timeline = build_twin_day_timeline(
        user_id,
        today,
        twin_record.get("completed_mission_ids") if twin_record else None,
        user.get("timezone", "UTC") or "UTC",
    )

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
    from datetime import date as date_type, timedelta

    last_passed = twin.get("last_passed_at")
    user_is_ahead = user.get("total_xp", 0) > twin.get("twin_xp", 0)
    days_user_ahead = 0
    if last_passed and user_is_ahead:
        try:
            days_user_ahead = (date_type.today() - date_type.fromisoformat(str(last_passed)[:10])).days
        except Exception:
            days_user_ahead = 0

    twin_xp = int(twin.get("twin_xp", 0) or 0)

    try:
        anchor = date_type.fromisoformat(today)
    except Exception:
        anchor = date_type.today()
    thirty_days_ago = str(anchor - timedelta(days=30))
    twin_completion = fetch_twin_30d_completion_rate(user_id, thirty_days_ago)

    twin_power_score = compute_power_score_value(
        int(twin.get("twin_character_stage") or 1),
        twin_xp,
        int(twin.get("twin_pet_stage") or 0),
        bool(twin.get("twin_pet_unlocked")),
        int(twin.get("twin_streak") or 0),
        twin_completion,
    )

    return {
        "strip_message": twin.get("strip_message"),
        "twin_timeline": twin_timeline,
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

