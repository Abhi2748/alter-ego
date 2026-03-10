"""POST /onboarding — receive answers, run archetype scoring, store users + discipline_dna, generate initial missions."""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone

from models.onboarding import OnboardingPayload, OnboardingResponse, MissionInResponse, ArchetypeContent
from utils.auth import get_user_id
from utils.supabase_client import get_supabase
from utils.archetype_scoring import score_archetype, get_archetype_content
from agents.planner import generate_initial_missions

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.post("", response_model=OnboardingResponse)
async def post_onboarding(payload: OnboardingPayload, user_id: str = Depends(get_user_id)):
    supabase = get_supabase()
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1) Archetype scoring from answers (§3.1)
    archetype, discipline_dna = score_archetype(payload.answers or {})

    # 2) Upsert users: archetype, discipline_dna, interests, quit_targets, hours, gender, trial_start_date
    users_payload = {
        "id": user_id,
        "archetype": archetype,
        "discipline_dna": discipline_dna,
        "available_hours_per_day": payload.available_hours_per_day,
        "interests": payload.interests or [],
        "quit_targets": payload.quit_targets or [],
        "gender": payload.gender,
        "trial_start_date": now_iso,
        "subscription_status": "trial",
    }
    supabase.table("users").upsert(users_payload, on_conflict="id").execute()

    # 3) Ensure character_state, pet_state, twin_state exist (upsert = insert or update)
    supabase.table("character_state").upsert(
        {
            "user_id": user_id,
            "stage": 1,
            "total_xp": 0,
            "gender": payload.gender,
            "last_updated": now_iso,
        },
        on_conflict="user_id",
    ).execute()

    supabase.table("pet_state").upsert(
        {
            "user_id": user_id,
            "stage": 0,
            "total_pet_food": 0,
            "last_updated": now_iso,
        },
        on_conflict="user_id",
    ).execute()

    twin_payload = {
        "user_id": user_id,
        "twin_xp": 0,
        "twin_character_stage": 1,
        "twin_pet_stage": 0,
        "streak": 0,
        "last_updated": now_iso,
    }
    try:
        supabase.table("twin_state").upsert(
            {**twin_payload, "twin_pet_food": 0},
            on_conflict="user_id",
        ).execute()
    except Exception:
        supabase.table("twin_state").upsert(twin_payload, on_conflict="user_id").execute()

    # 4) Generate initial missions via Planner and persist
    mission_rows = generate_initial_missions(
        user_id=user_id,
        interests=payload.interests or [],
        available_hours_per_day=payload.available_hours_per_day,
    )
    if mission_rows:
        result = supabase.table("missions").insert(mission_rows).execute()
        inserted = result.data if result.data else []
        if not inserted:
            # Fallback: fetch missions we just created (some configs don't return insert data)
            r = supabase.table("missions").select("*").eq("user_id", user_id).order("created_at", desc=False).execute()
            inserted = r.data or []
    else:
        inserted = []

    # 5) Map to response shape
    initial_missions = [
        MissionInResponse(
            id=m["id"],
            user_id=m["user_id"],
            type=m["type"],
            pillar=m.get("pillar"),
            interest=m.get("interest"),
            title=m["title"],
            difficulty=m["difficulty"],
            xp_value=m["xp_value"],
            pet_food_value=m["pet_food_value"],
            mission_streak=m.get("mission_streak", 0),
            completed_at=m.get("completed_at"),
            expires_at=m.get("expires_at"),
            created_at=m.get("created_at", now_iso),
        )
        for m in inserted
    ]

    archetype_content = get_archetype_content(archetype)

    return OnboardingResponse(
        success=True,
        message="Onboarding complete",
        archetype=archetype,
        archetype_content=ArchetypeContent(**archetype_content),
        initial_missions=initial_missions,
    )
