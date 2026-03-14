"""Twin routes — comparison + Twin Chat (Twin Design §5.1, §5.2, §6)."""
from datetime import datetime, timezone, date
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from utils.auth import get_user_id
from utils.supabase_client import get_supabase
from models.home import pet_stage_for, STAGE_THRESHOLDS
from models.twin import (
    TwinComparisonOut,
    TwinActivityOut,
    pet_stage_name,
    min_pet_food_for_stage,
    compute_gap_state,
    consistency_ceiling_for,
    daily_twin_xp,
    daily_twin_pet_food,
)
from agents.twin_agent import generate_twin_reply, TONE_OPTIONS

router = APIRouter(prefix="/twin", tags=["twin"])


def _character_stage_from_xp(total_xp: int) -> int:
    """Return 1–6 from total_xp using CLAUDE thresholds."""
    stage = 1
    for i, thresh in enumerate(STAGE_THRESHOLDS):
        if total_xp >= thresh:
            stage = i + 1
    return min(stage, 6)


def _simulate_twin_today_activities(now: datetime) -> list[TwinActivityOut]:
    """Simulate Twin's Day timeline: 4 completed missions + 1 pending (no stored state yet)."""
    today = now.date()
    base_iso = today.isoformat()
    activities = [
        TwinActivityOut(
            mission_title="Get 7+ hours of sleep",
            mission_type="core",
            difficulty="Easy",
            xp_earned=25,
            completed_at=f"{base_iso}T06:30:00Z",
        ),
        TwinActivityOut(
            mission_title="Move for 30 minutes",
            mission_type="core",
            difficulty="Medium",
            xp_earned=25,
            completed_at=f"{base_iso}T07:15:00Z",
        ),
        TwinActivityOut(
            mission_title="Drink 8 glasses of water",
            mission_type="core",
            difficulty="Medium",
            xp_earned=25,
            completed_at=f"{base_iso}T08:00:00Z",
        ),
        TwinActivityOut(
            mission_title="Run 2 miles",
            mission_type="focus",
            difficulty="Medium",
            xp_earned=25,
            completed_at=f"{base_iso}T09:10:00Z",
        ),
        TwinActivityOut(
            mission_title="Read for 20 minutes",
            mission_type="personal",
            difficulty="Easy",
            xp_earned=0,
            completed_at=None,
        ),
    ]
    return activities


class TwinChatRequest(BaseModel):
    """Incoming chat message from user."""

    content: str


class TwinChatResponse(BaseModel):
    """Twin reply + tone rating for instrumentation."""

    reply: str
    tone_rating: str


@router.get("/comparison", response_model=TwinComparisonOut)
async def get_twin_comparison(user_id: str = Depends(get_user_id)):
    supabase = get_supabase()
    now = datetime.now(timezone.utc)
    today = now.date()

    # User: discipline_dna, email (for username), character_state, pet_state, leaderboard (streak, power_score)
    ur = supabase.table("users").select("discipline_dna, email").eq("id", user_id).maybe_single().execute()
    discipline_dna = (ur.data or {}).get("discipline_dna") or {}
    username = _get_username_from_email((ur.data or {}).get("email"))
    gap_behavior = discipline_dna.get("gap_behavior") or "steady"
    intensity = int(discipline_dna.get("intensity", 3))
    intensity = max(1, min(5, intensity))

    cr = supabase.table("character_state").select("total_xp").eq("user_id", user_id).maybe_single().execute()
    user_xp = int((cr.data or {}).get("total_xp", 0))

    pr = supabase.table("pet_state").select("stage, total_pet_food").eq("user_id", user_id).maybe_single().execute()
    user_pet_stage = int((pr.data or {}).get("stage", 0))
    user_pet_food = int((pr.data or {}).get("total_pet_food", 0))
    if user_pet_stage == 0 and user_pet_food > 0:
        user_pet_stage = pet_stage_for(user_pet_food)

    lr = supabase.table("leaderboard_scores").select("streak, power_score").eq("user_id", user_id).maybe_single().execute()
    user_streak = int((lr.data or {}).get("streak", 0))
    user_power_score = (lr.data or {}).get("power_score")
    if user_power_score is not None:
        user_power_score = float(user_power_score)

    # Twin state (twin_pet_food optional for legacy DBs)
    tr = supabase.table("twin_state").select(
        "twin_xp, twin_pet_stage, streak, strip_message, consistency_ceiling, last_updated"
    ).eq("user_id", user_id).maybe_single().execute()
    twin_xp = 0
    twin_pet_food = 0
    twin_pet_stage = 0
    twin_streak = 0
    strip_message = None
    consistency_ceiling = 0.80
    last_updated = now

    if tr.data:
        twin_xp = int(tr.data.get("twin_xp", 0))
        twin_pet_stage = int(tr.data.get("twin_pet_stage", 0))
        twin_pet_food = int(tr.data.get("twin_pet_food", min_pet_food_for_stage(twin_pet_stage)))
        twin_streak = int(tr.data.get("streak", 0))
        strip_message = tr.data.get("strip_message")
        consistency_ceiling = float(tr.data.get("consistency_ceiling", 0.80))
        lu = tr.data.get("last_updated")
        if lu:
            try:
                if isinstance(lu, str):
                    last_updated = datetime.fromisoformat(lu.replace("Z", "+00:00"))
                else:
                    last_updated = lu
            except Exception:
                pass
        if twin_pet_stage == 0 and twin_pet_food > 0:
            twin_pet_stage = pet_stage_for(twin_pet_food)

    # Catch up: simulate each day from last_updated to today (exclusive of today so we don't double-award)
    last_date = last_updated.date() if hasattr(last_updated, "date") else last_updated
    if last_date < today:
        ceiling = consistency_ceiling_for(gap_behavior, user_xp, twin_xp)
        day_count = (today - last_date).days
        for _ in range(day_count):
            twin_xp += daily_twin_xp(intensity, ceiling)
            twin_pet_food += daily_twin_pet_food(intensity, ceiling)
            twin_streak += 1
        twin_pet_stage = pet_stage_for(twin_pet_food)
        twin_character_stage = _character_stage_from_xp(twin_xp)
        # Persist updated twin_state (twin_pet_food if column exists)
        update_payload = {
            "twin_xp": twin_xp,
            "twin_character_stage": twin_character_stage,
            "twin_pet_stage": twin_pet_stage,
            "streak": twin_streak,
            "last_updated": now.isoformat(),
            "consistency_ceiling": ceiling,
        }
        try:
            supabase.table("twin_state").update({
                **update_payload,
                "twin_pet_food": twin_pet_food,
            }).eq("user_id", user_id).execute()
        except Exception:
            supabase.table("twin_state").update(update_payload).eq("user_id", user_id).execute()
    else:
        ceiling = consistency_ceiling_for(gap_behavior, user_xp, twin_xp)
        if abs(consistency_ceiling - ceiling) > 0.01:
            supabase.table("twin_state").update({
                "consistency_ceiling": ceiling,
                "last_updated": now.isoformat(),
            }).eq("user_id", user_id).execute()

    current_gap_state = compute_gap_state(user_xp, twin_xp)
    # Persist gap state
    supabase.table("twin_state").update({
        "current_gap_state": current_gap_state,
    }).eq("user_id", user_id).execute()

    # Gap line (1.34): "Your Twin has [Twin pet] and [Twin XP] XP. You have [User pet] and [User XP] XP."
    twin_pet_name = pet_stage_name(twin_pet_stage)
    user_pet_name = pet_stage_name(user_pet_stage)
    gap_line = (
        f"Your Twin has {twin_pet_name} and {twin_xp:,} XP. "
        f"You have {user_pet_name} and {user_xp:,} XP."
    )

    # Approximate gap in "days" (Twin's lead in simulated days of behavior)
    daily_xp = daily_twin_xp(intensity, ceiling)
    gap_days = None
    if twin_xp > user_xp and daily_xp > 0:
        gap_days = max(0, (twin_xp - user_xp) // daily_xp)
    elif user_xp > twin_xp and daily_xp > 0:
        gap_days = -max(0, (user_xp - twin_xp) // daily_xp)

    # Twin power score: optional; could be computed from twin_xp/twin_streak/twin_pet_stage
    twin_power_score = None

    # Twin's Day: simulated today activities (4 completed, 1 pending)
    twin_today_activities = _simulate_twin_today_activities(now)

    return TwinComparisonOut(
        user_xp=user_xp,
        user_pet_stage=user_pet_stage,
        user_pet_stage_name=user_pet_name,
        user_streak=user_streak,
        user_power_score=user_power_score,
        twin_xp=twin_xp,
        twin_pet_stage=twin_pet_stage,
        twin_pet_stage_name=twin_pet_name,
        twin_streak=twin_streak,
        twin_power_score=twin_power_score,
        current_gap_state=current_gap_state,
        gap_line=gap_line,
        strip_message=strip_message,
        gap_days=gap_days,
        username=username,
        twin_today_activities=twin_today_activities,
    )


def _get_username_from_email(email: Optional[str]) -> str:
    if not email or "@" not in email:
        return "You"
    return email.split("@")[0] or "You"


@router.post("/chat", response_model=TwinChatResponse)
async def post_twin_chat(payload: TwinChatRequest, user_id: str = Depends(get_user_id)):
    """
    Twin Chat endpoint (Twin Design §6).

    - Fetch discipline_dna (tone_type, intensity, gap_behavior, challenge_level)
    - Fetch twin_state (xp, gap_state)
    - Fetch character_state (user xp)
    - Fetch streak from leaderboard_scores
    - Fetch last 20 messages from twin_chat as recent context
    - Compute last missed mission type from missions
    - Call LangGraph Twin agent (GPT-4o-mini) to get reply + tone rating
    - Store both user message and twin reply in twin_chat
    """
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    # User profile + discipline_dna
    ur = supabase.table("users").select("email, archetype, discipline_dna").eq("id", user_id).maybe_single().execute()
    user_email = (ur.data or {}).get("email")
    archetype = (ur.data or {}).get("archetype") or ""
    discipline_dna = (ur.data or {}).get("discipline_dna") or {}
    username = _get_username_from_email(user_email)

    tone_type = discipline_dna.get("tone_type") or discipline_dna.get("tone") or "rival"
    intensity = int(discipline_dna.get("intensity", 3))
    intensity = max(1, min(5, intensity))

    # Twin + user numeric state
    tr = supabase.table("twin_state").select(
        "twin_xp, current_gap_state"
    ).eq("user_id", user_id).maybe_single().execute()
    twin_xp = int((tr.data or {}).get("twin_xp", 0))
    gap_state = (tr.data or {}).get("current_gap_state") or "neck_and_neck"

    cr = supabase.table("character_state").select("total_xp").eq("user_id", user_id).maybe_single().execute()
    user_xp = int((cr.data or {}).get("total_xp", 0))

    lr = supabase.table("leaderboard_scores").select("streak").eq("user_id", user_id).maybe_single().execute()
    streak = int((lr.data or {}).get("streak", 0))

    # Last missed mission type: last expired, not completed mission
    mr = (
        supabase.table("missions")
        .select("type")
        .eq("user_id", user_id)
        .is_("completed_at", None)
        .lt("expires_at", now)
        .order("expires_at", desc=True)
        .limit(1)
        .execute()
    )
    if mr.data:
        last_miss = mr.data[0].get("type") or "none"
    else:
        last_miss = "none"

    # Recent context from twin_chat (last 20 messages)
    chat_rows = (
        supabase.table("twin_chat")
        .select("role, content")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    recent_chunks = []
    last_three_replies: list[str] = []
    if chat_rows.data:
        # Reverse to oldest → newest for context
        for row in reversed(chat_rows.data):
            role = row.get("role", "user")
            content = row.get("content", "")
            recent_chunks.append((role, content))
        # Last 3 Twin replies (most recent first) for anti-repetition
        twin_replies = [row.get("content", "") for row in chat_rows.data if row.get("role") == "twin"]
        last_three_replies = twin_replies[:3]

    # Call Twin agent
    reply, tone_rating = generate_twin_reply(
        username=username,
        archetype=archetype,
        tone_type=tone_type,
        intensity=intensity,
        gap_state=gap_state,
        twin_xp=twin_xp,
        user_xp=user_xp,
        streak=streak,
        last_miss=last_miss,
        recent_chunks=recent_chunks,
        last_three_replies=last_three_replies,
        user_message=payload.content.strip(),
    )

    if tone_rating not in TONE_OPTIONS:
        tone_rating = "balanced"

    # Persist conversation (user message + twin reply)
    supabase.table("twin_chat").insert(
        [
            {"user_id": user_id, "role": "user", "content": payload.content.strip()},
            {"user_id": user_id, "role": "twin", "content": reply},
        ]
    ).execute()

    return TwinChatResponse(reply=reply, tone_rating=tone_rating)

