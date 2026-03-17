"""
Onboarding endpoints.

B6: Save onboarding steps progressively.
B7: Username availability checking (debounced client-side).
"""

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

from app.api.auth import get_user_id_from_token
from app.services.onboarding_service import (
    check_username_availability,
    complete_onboarding,
    create_profile_if_missing,
    get_onboarding_progress,
    save_onboarding_step,
)

router = APIRouter(prefix="/api/v1", tags=["onboarding"])


class OnboardingStepRequest(BaseModel):
    question_key: str
    answer_json: dict


@router.post("/onboarding/step")
async def post_onboarding_step(body: OnboardingStepRequest, authorization: str = Header(None)):
    """
    Saves a single question answer. Called after every question in onboarding.
    """
    user_id = get_user_id_from_token(authorization)
    if not body.question_key:
        raise HTTPException(status_code=400, detail="Missing question_key")
    if body.answer_json is None:
        raise HTTPException(status_code=400, detail="Missing answer_json")

    return await save_onboarding_step(user_id=user_id, question_key=body.question_key, answer_json=body.answer_json)


@router.get("/onboarding/progress")
async def get_progress(authorization: str = Header(None)):
    """
    Returns all saved answers for the current user.
    Used when the app restarts mid-onboarding to resume from where they left off.
    """
    user_id = get_user_id_from_token(authorization)
    return await get_onboarding_progress(user_id)


@router.get("/users/check-username")
async def check_username(username: str = Query(...)):
    """
    Checks if a username is available.
    Called on every keystroke (debounced 300ms client-side).
    """
    return await check_username_availability(username)


@router.post("/users/create-profile")
async def create_profile(authorization: str = Header(None)):
    """
    Called once at the start of onboarding (right after auth).
    Creates the initial users row if missing (idempotent).
    Also creates discipline_dna row with defaults.
    """
    user_id = get_user_id_from_token(authorization)
    return await create_profile_if_missing(user_id)


@router.post("/onboarding/complete")
async def complete(authorization: str = Header(None)):
    """
    Called once after the final onboarding step.
    Runs archetype classification, normalisation, and creates initial twin state + DNA.
    Never returns 500 — always returns success with notes on partial failures.
    """
    user_id = get_user_id_from_token(authorization)
    try:
        return await complete_onboarding(user_id)
    except Exception as e:
        return {
            "success": True,
            "archetype": "structured_climber",
            "archetype_name": "The Structured Climber",
            "archetype_tagline": "You love plans and respond to challenge.",
            "archetype_reveal_message": "You already know how to build systems. Now build the habit of using them daily.",
            "interests_processed": 0,
            "quit_targets_processed": 0,
            "notes": [f"complete_onboarding_failed: {str(e)}"],
        }

