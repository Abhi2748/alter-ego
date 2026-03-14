"""GET /missions, POST /missions, PATCH /missions/{id}, POST /missions/{id}/complete, POST /missions/estimate-personal-tier."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from models.missions import MissionCreate, MissionUpdate, MissionOut, MissionList, EstimatePersonalTierOut, xp_and_pf_for
from utils.personal_tier import estimate_personal_tier
from models.home import (
    CharacterStateOut,
    PetStateOut,
    MissionCompleteOut,
    EarnedMilestoneOut,
    next_stage_for,
    pet_stage_for,
    STAGE_THRESHOLDS,
)
from utils.milestones import check_and_award_milestones, _level_from_total_xp
from utils.auth import get_user_id
from utils.supabase_client import get_supabase
from datetime import datetime, timezone, date
import uuid

router = APIRouter(prefix="/missions", tags=["missions"])

def _mission_to_out(row: dict) -> MissionOut:
    return MissionOut(
        id=str(row["id"]),
        user_id=str(row["user_id"]),
        type=row["type"],
        pillar=row.get("pillar"),
        interest=row.get("interest"),
        title=row["title"],
        difficulty=row["difficulty"],
        xp_value=row["xp_value"],
        pet_food_value=row["pet_food_value"],
        mission_streak=row.get("mission_streak", 0),
        completed_at=row.get("completed_at"),
        expires_at=row.get("expires_at"),
        created_at=row["created_at"],
    )

@router.get("", response_model=MissionList)
async def get_missions(user_id: str = Depends(get_user_id)):
    supabase = get_supabase()
    r = supabase.table("missions").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    missions = [_mission_to_out(m) for m in (r.data or [])]
    return MissionList(missions=missions)

class EstimatePersonalTierPayload(BaseModel):
    title: str


@router.post("/estimate-personal-tier", response_model=EstimatePersonalTierOut)
async def estimate_personal_tier_endpoint(
    payload: EstimatePersonalTierPayload, user_id: str = Depends(get_user_id)
):
    """Estimate XP tier (Easy/Medium/Hard) from mission title using GPT-4o-mini. User sees tier before saving."""
    difficulty = await estimate_personal_tier(payload.title)
    xp, pf = xp_and_pf_for("personal", difficulty)
    return EstimatePersonalTierOut(
        suggested_difficulty=difficulty,
        xp_value=xp,
        pet_food_value=pf,
    )


def _end_of_today_utc() -> datetime:
    d = date.today()
    return datetime.combine(d, datetime.max.time(), tzinfo=timezone.utc)


@router.post("", response_model=MissionOut)
async def post_mission(payload: MissionCreate, user_id: str = Depends(get_user_id)):
    supabase = get_supabase()
    xp, pf = xp_and_pf_for(payload.type, payload.difficulty)
    now = datetime.now(timezone.utc).isoformat()
    expires_at = payload.expires_at
    if payload.type == "personal" and expires_at is None:
        expires_at = _end_of_today_utc()
    row = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": payload.type,
        "title": payload.title,
        "difficulty": payload.difficulty,
        "xp_value": xp,
        "pet_food_value": pf,
        "completed_at": None,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "created_at": now,
    }
    supabase.table("missions").insert(row).execute()
    return _mission_to_out(row)

@router.patch("/{mission_id}", response_model=MissionOut)
async def patch_mission(mission_id: str, payload: MissionUpdate, user_id: str = Depends(get_user_id)):
    supabase = get_supabase()
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("completed_at") and hasattr(updates["completed_at"], "isoformat"):
        updates["completed_at"] = updates["completed_at"].isoformat()
    if not updates:
        r = supabase.table("missions").select("*").eq("id", mission_id).eq("user_id", user_id).single().execute()
        if not r.data:
            raise HTTPException(status_code=404, detail="Mission not found")
        return _mission_to_out(r.data)
    supabase.table("missions").update(updates).eq("id", mission_id).eq("user_id", user_id).execute()
    r = supabase.table("missions").select("*").eq("id", mission_id).eq("user_id", user_id).single().execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Mission not found")
    return _mission_to_out(r.data)


@router.post("/{mission_id}/complete", response_model=MissionCompleteOut)
async def complete_mission(mission_id: str, user_id: str = Depends(get_user_id)):
    """
    Mark mission complete, apply XP/PF, update character_state, pet_state, streak_log.
    Returns updated state and stage_up / pet_stage_up for overlays.
    """
    supabase = get_supabase()
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    today = date.today()

    r = supabase.table("missions").select("*").eq("id", mission_id).eq("user_id", user_id).single().execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Mission not found")
    mission_row = r.data
    if mission_row.get("completed_at"):
        raise HTTPException(status_code=400, detail="Mission already completed")

    mission_type = mission_row.get("type", "personal")
    difficulty = mission_row.get("difficulty", "Medium")
    xp_earned, pet_food_earned = xp_and_pf_for(mission_type, difficulty)

    supabase.table("missions").update({"completed_at": now_iso}).eq("id", mission_id).eq("user_id", user_id).execute()

    cr = supabase.table("character_state").select("stage, total_xp").eq("user_id", user_id).maybe_single().execute()
    old_stage = int((cr.data or {}).get("stage", 1))
    total_xp_prev = int((cr.data or {}).get("total_xp", 0))
    total_xp_new = total_xp_prev + xp_earned
    new_stage = 1
    for i, thresh in enumerate(STAGE_THRESHOLDS):
        if total_xp_new >= thresh:
            new_stage = i + 1
    new_stage = min(new_stage, 6)
    stage_up = new_stage > old_stage

    supabase.table("character_state").upsert(
        {
            "user_id": user_id,
            "stage": new_stage,
            "total_xp": total_xp_new,
            "last_updated": now_iso,
        },
        on_conflict="user_id",
    ).execute()

    cr2 = supabase.table("character_state").select("gender").eq("user_id", user_id).maybe_single().execute()
    gender_val = (cr2.data or {}).get("gender")
    gender_str = (gender_val.strip().lower() if isinstance(gender_val, str) and gender_val.strip() else None) or "male"

    next_stage_xp, next_stage_name = next_stage_for(total_xp_new)
    character_state = CharacterStateOut(
        stage=new_stage,
        total_xp=total_xp_new,
        next_stage_xp=next_stage_xp,
        next_stage_name=next_stage_name,
        gender=gender_str,
    )

    pr = supabase.table("pet_state").select("stage, pet_health_state, total_pet_food").eq("user_id", user_id).maybe_single().execute()
    old_pet_stage = int((pr.data or {}).get("stage", 0))
    total_pf_prev = int((pr.data or {}).get("total_pet_food", 0))
    total_pf_new = total_pf_prev + pet_food_earned
    new_pet_stage = pet_stage_for(total_pf_new)
    pet_stage_up = new_pet_stage > old_pet_stage and new_pet_stage >= 1

    supabase.table("pet_state").upsert(
        {
            "user_id": user_id,
            "stage": new_pet_stage,
            "total_pet_food": total_pf_new,
            "last_updated": now_iso,
        },
        on_conflict="user_id",
    ).execute()

    pet_state = PetStateOut(
        stage=new_pet_stage,
        pet_health_state=(pr.data or {}).get("pet_health_state") or "healthy",
        total_pet_food=total_pf_new,
    )

    today_iso = today.isoformat()
    sr = supabase.table("streak_log").select("*").eq("user_id", user_id).eq("date", today_iso).maybe_single().execute()
    row = (sr.data or {})
    core_done = int(row.get("core_completed", 0))
    if mission_type == "core":
        core_done = min(core_done + 1, 5)
    xp_log = int(row.get("xp_earned", 0)) + xp_earned
    pf_log = int(row.get("pet_food_earned", 0)) + pet_food_earned
    completion_level = min(4, core_done)
    supabase.table("streak_log").upsert(
        {
            "user_id": user_id,
            "date": today_iso,
            "core_completed": core_done,
            "completion_level": completion_level,
            "xp_earned": xp_log,
            "pet_food_earned": pf_log,
        },
        on_conflict="user_id,date",
    ).execute()

    mr_updated = supabase.table("missions").select("*").eq("id", mission_id).eq("user_id", user_id).single().execute()
    if not mr_updated.data:
        raise HTTPException(status_code=404, detail="Mission not found")
    mission_out = _mission_to_out(mr_updated.data)

    twin_strip_message = None
    all_today = supabase.table("missions").select("id, completed_at").eq("user_id", user_id).gte("expires_at", today.isoformat() + "T00:00:00").lte("expires_at", today.isoformat() + "T23:59:59").execute()
    if all_today.data:
        total_today = len(all_today.data)
        completed_today = sum(1 for m in all_today.data if m.get("completed_at"))
        if total_today > 0 and completed_today >= total_today:
            twin_strip_message = "All of them today. Good."
            supabase.table("twin_state").update({"strip_message": twin_strip_message, "last_updated": now_iso}).eq("user_id", user_id).execute()

    earned_milestone = None
    if mission_type == "interest" and mission_row.get("interest"):
        interest_name = (mission_row.get("interest") or "").strip()
        if interest_name:
            ip = supabase.table("interest_progress").select("session_count, total_xp").eq("user_id", user_id).eq("interest", interest_name).maybe_single().execute()
            row = ip.data or {}
            session_count = int(row.get("session_count", 0)) + 1
            total_xp_interest = int(row.get("total_xp", 0)) + xp_earned
            level = _level_from_total_xp(total_xp_interest)
            supabase.table("interest_progress").upsert(
                {
                    "user_id": user_id,
                    "interest": interest_name,
                    "session_count": session_count,
                    "total_xp": total_xp_interest,
                    "level": level,
                    "last_session_at": now_iso,
                },
                on_conflict="user_id,interest",
            ).execute()
            earned = check_and_award_milestones(supabase, user_id, interest_name, session_count, total_xp_interest, level)
            if earned:
                earned_milestone = EarnedMilestoneOut(
                    interest=earned["interest"],
                    milestone_name=earned["milestone_name"],
                    milestone_number=earned.get("milestone_number", 1),
                    twin_congratulation=earned.get("twin_congratulation", "Milestone unlocked."),
                    earned_at=str(earned["earned_at"]) if earned.get("earned_at") else None,
                )

    return MissionCompleteOut(
        mission=mission_out,
        character_state=character_state,
        pet_state=pet_state,
        stage_up=stage_up,
        pet_stage_up=pet_stage_up,
        xp_earned=xp_earned,
        pet_food_earned=pet_food_earned,
        twin_strip_message=twin_strip_message,
        earned_milestone=earned_milestone,
    )
