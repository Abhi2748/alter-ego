"""
Settings — FAQ, username, notifications, feedback, delete account.
"""

from __future__ import annotations

import os
from datetime import datetime

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.api.auth import get_user_id_from_token
from app.core.supabase_client import supabase_admin

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

# ── FAQ ────────────────────────────────────────────────────────────────────

FAQ_ITEMS = [
    {
        "q": "How does the streak work?",
        "a": "Your streak counts if you complete your daily requirement. Right now that's any 2 core missions or 1 interest mission. The requirement grows as you progress — reaching Stage 2 requires 4 core + 1 interest, and so on. Check your streak tier in the Streak tab.",
    },
    {
        "q": "What is the Shadow Twin?",
        "a": "Your Twin is another version of you — built from your archetype — that runs in parallel. It starts at the same XP, same level, same pet. The gap between you is built by daily choices. Tap the Twin tab to see where you stand.",
    },
    {
        "q": "How are my missions chosen?",
        "a": "Core missions are fixed — the 6 biological foundations every day. Interest missions are generated fresh each day by an AI that knows your domain, your level, your goals, and your completion history. Tap any mission to see the research behind it.",
    },
    {
        "q": "What is Pet Food?",
        "a": "Pet Food is earned every time you complete a mission. It feeds your companion's growth — from Cub to Dragon across 8 stages. Your companion unlocks on Day 6.",
    },
    {
        "q": "How do I change my interests?",
        "a": "Go to Profile → Interests → tap any interest to edit it. Schedule and active-interest changes update today's missions when you open Home (incomplete missions that no longer apply are removed; missing ones are added). Completed missions stay in your history.",
    },
    {
        "q": "What happens if I miss a day?",
        "a": "For the first 29 days of absence, your XP is frozen and your streak resets — but full recovery is possible. After 30 days, a dynamic penalty applies. Your companion goes to Sad state when you miss days.",
    },
    {
        "q": "How do I change my username?",
        "a": "Go to Profile → Settings → tap your username to edit it. Usernames must be 3-20 characters, letters, numbers, and underscores only.",
    },
    {
        "q": "What is my Power Score?",
        "a": "Power Score is your leaderboard ranking metric. It combines: XP stage progress (35%), pet stage (20%), current streak (25%), and 30-day completion rate (20%). It recalculates around 1:00 in your timezone (with other nightly jobs).",
    },
    {
        "q": "How do I connect my Google account?",
        "a": "Go to Settings → Connect Google Account. This links your anonymous session to a real account so you never lose your data.",
    },
    {
        "q": "What are the daily XP and Pet Food caps?",
        "a": "Your daily caps increase with your character stage. Stage 1: 200 XP / 160 PF. Stage 2: 300 / 240. Stage 3: 450 / 360. Stage 4: 600 / 480. Stage 5: 800 / 640. Stage 6: 1000 / 800.",
    },
    {
        "q": "Can the Twin ever be wrong about my archetype?",
        "a": "The Twin recalibrates every 7 days based on your actual behaviour — completion rate, how you respond to the gap, how often you chat. The first full behaviour calibration runs after your first week. Over time it becomes more accurately tuned to you regardless of your initial archetype.",
    },
    {
        "q": "Why does my Twin sometimes pull ahead after I cross it?",
        "a": "When you cross your Twin, it enters a 6-day push period where it performs slightly better. If you stay consistent through those 6 days, you hold the lead. After 14 days ahead, the Twin calibrates its performance to match your own level + a small offset — so consistent effort keeps you ahead.",
    },
]


@router.get("/faq", response_model=dict)
async def get_faq():
    """Returns all FAQ items. No auth required."""
    return {"faq": FAQ_ITEMS}


# ── UPDATE USERNAME ────────────────────────────────────────────────────────


class UpdateUsernameRequest(BaseModel):
    username: str


@router.post("/username", response_model=dict)
async def update_username(
    body: UpdateUsernameRequest,
    authorization: str = Header(None),
):
    user_id = get_user_id_from_token(authorization)

    current = (
        supabase_admin.table("users")
        .select("username")
        .eq("id", user_id)
        .single()
        .execute()
        .data
    )
    new_username = (body.username or "").strip().lower()
    if new_username == (current or {}).get("username"):
        return {"success": True, "username": new_username}

    from app.services.onboarding_service import (
        check_username_availability,
        validate_username,
    )

    is_valid, reason = validate_username(body.username)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Invalid username: {reason}")

    availability = await check_username_availability(body.username)
    if not availability.get("available"):
        raise HTTPException(status_code=409, detail="Username already taken")

    supabase_admin.table("users").update({"username": new_username}).eq(
        "id", user_id
    ).execute()

    return {"success": True, "username": new_username}


# ── UPDATE NOTIFICATION SETTINGS ──────────────────────────────────────────


class UpdateNotificationsRequest(BaseModel):
    push_token: str | None = None
    notifications_enabled: bool | None = None
    timezone: str | None = None


@router.post("/notifications", response_model=dict)
async def update_notifications(
    body: UpdateNotificationsRequest,
    authorization: str = Header(None),
):
    user_id = get_user_id_from_token(authorization)
    update_data = {}
    if body.push_token is not None:
        update_data["push_token"] = body.push_token
    if body.notifications_enabled is not None:
        update_data["notifications_enabled"] = body.notifications_enabled
    if body.timezone is not None and str(body.timezone).strip():
        update_data["timezone"] = str(body.timezone).strip()

    if update_data:
        supabase_admin.table("users").update(update_data).eq("id", user_id).execute()

    return {"success": True}


# ── CONTACT / FEEDBACK ─────────────────────────────────────────────────────


class FeedbackRequest(BaseModel):
    type: str  # bug | concern | suggestion | other
    content: str
    app_version: str | None = None


@router.post("/feedback", response_model=dict)
async def submit_feedback(
    body: FeedbackRequest,
    authorization: str = Header(None),
):
    """
    Stores feedback in feedback_submissions table.
    Optionally triggers Zapier webhook if ZAPIER_WEBHOOK_URL is set.
    """
    user_id = get_user_id_from_token(authorization)

    if body.type not in ("bug", "concern", "suggestion", "other"):
        raise HTTPException(
            status_code=400,
            detail="type must be one of: bug, concern, suggestion, other",
        )

    supabase_admin.table("feedback_submissions").insert(
        {
            "user_id": user_id,
            "type": body.type,
            "content": (body.content or "").strip(),
            "app_version": body.app_version,
        }
    ).execute()

    zapier_url = os.environ.get("ZAPIER_WEBHOOK_URL")
    if zapier_url:
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    zapier_url,
                    json={
                        "user_id": user_id,
                        "type": body.type,
                        "content": (body.content or "").strip(),
                        "app_version": body.app_version,
                        "submitted_at": datetime.utcnow().isoformat(),
                    },
                    timeout=5.0,
                )
        except Exception:
            pass

    return {"success": True, "message": "Feedback received. Thank you."}


# ── DELETE ACCOUNT ─────────────────────────────────────────────────────────


@router.delete("/account", response_model=dict)
async def delete_account(authorization: str = Header(None)):
    """
    Deletes all user data. Irreversible.
    Cascades via FK constraints. Then deletes the auth user.
    """
    user_id = get_user_id_from_token(authorization)

    supabase_admin.table("users").delete().eq("id", user_id).execute()
    try:
        supabase_admin.auth.admin.delete_user(user_id)
    except Exception:
        pass

    return {"success": True, "message": "Account deleted."}
