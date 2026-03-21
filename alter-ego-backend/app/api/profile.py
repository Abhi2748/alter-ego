"""
Profile tab data endpoints — overview, streak, identity, companion, interests, quits.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Header, HTTPException
from postgrest.exceptions import APIError

from app.api.auth import get_user_id_from_token
from app.core.constants import (
    INTEREST_MILESTONE_SESSIONS,
    PET_NAMES,
    PF_THRESHOLDS,
    STAGE_NAMES,
    TOTAL_CHARACTER_STAGES,
    TOTAL_PET_STAGES,
    XP_THRESHOLDS,
)
from app.core.supabase_client import supabase_admin
from app.services.mission_service import get_user_date

router = APIRouter(prefix="/api/v1/profile", tags=["profile"])
logger = logging.getLogger(__name__)


def _milestone_rows_character_stages(user_id: str) -> list:
    """Stage unlock times for identity; empty list on transient DB / gateway errors."""
    types = [f"stage_{i}" for i in range(1, TOTAL_CHARACTER_STAGES + 1)]
    try:
        return (
            supabase_admin.table("milestone_log")
            .select("milestone_type, earned_at")
            .eq("user_id", user_id)
            .in_("milestone_type", types)
            .order("earned_at")
            .execute()
            .data
            or []
        )
    except APIError as e:
        logger.warning(
            "milestone_log fetch failed (profile identity): %s",
            getattr(e, "message", str(e))[:500],
        )
        return []
    except Exception as e:
        logger.warning("milestone_log fetch failed (profile identity, unexpected): %s", e)
        return []


def _milestone_rows_pet_stages(user_id: str) -> list:
    types = [f"pet_stage_{i}" for i in range(1, TOTAL_PET_STAGES + 1)]
    try:
        return (
            supabase_admin.table("milestone_log")
            .select("milestone_type, earned_at")
            .eq("user_id", user_id)
            .in_("milestone_type", types)
            .order("earned_at")
            .execute()
            .data
            or []
        )
    except APIError as e:
        logger.warning(
            "milestone_log fetch failed (profile companion): %s",
            getattr(e, "message", str(e))[:500],
        )
        return []
    except Exception as e:
        logger.warning("milestone_log fetch failed (profile companion, unexpected): %s", e)
        return []


def _first_local_calendar_date_from_registration(iso_ts: str | None, tz_str: str) -> str | None:
    """First calendar day (user TZ) the user existed — streak heatmap must not show earlier days."""
    if not iso_ts:
        return None
    try:
        s = str(iso_ts).replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=ZoneInfo("UTC"))
        z = ZoneInfo((tz_str or "UTC").strip() or "UTC")
        return dt.astimezone(z).date().isoformat()
    except Exception:
        return None


@router.get("/overview", response_model=dict)
async def get_profile_overview(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    user_result = (
        supabase_admin.table("users")
        .select(
            "username, archetype, character_stage, total_xp, "
            "pet_stage, pet_unlocked, total_pf, current_streak, "
            "longest_streak, power_score, registration_date, "
            "leaderboard_unlocked, email_connected, subscription_tier"
        )
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = user_result.data or {}

    dna_results = (
        supabase_admin.table("discipline_dna")
        .select("twin_tone_type, twin_intensity")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    dna_row = (dna_results.data or [None])[0] or {}

    unread_result = (
        supabase_admin.table("app_mails")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .is_("read_at", "null")
        .execute()
    )
    unread = getattr(unread_result, "count", None) or len(unread_result.data or [])

    stage = user.get("character_stage", 1) or 1
    pet_stage = user.get("pet_stage", 0) or 0
    stage_xp = user.get("total_xp", 0) or 0
    stage_start = XP_THRESHOLDS[stage - 1]
    stage_end = (
        XP_THRESHOLDS[stage]
        if stage < len(XP_THRESHOLDS)
        else XP_THRESHOLDS[stage - 1]
    )
    stage_progress_pct = (
        round(
            ((stage_xp - stage_start) / max(stage_end - stage_start, 1)) * 100,
            1,
        )
        if stage < TOTAL_CHARACTER_STAGES
        else 100.0
    )

    pf_total = user.get("total_pf", 0) or 0
    pf_start = PF_THRESHOLDS[pet_stage - 1] if pet_stage > 0 else 0
    pf_end = (
        PF_THRESHOLDS[pet_stage]
        if pet_stage < len(PF_THRESHOLDS) - 1
        else PF_THRESHOLDS[pet_stage - 1] if pet_stage > 0 else PF_THRESHOLDS[0]
    )
    if pet_stage >= TOTAL_PET_STAGES:
        pf_end = PF_THRESHOLDS[pet_stage - 1]
    pf_progress_pct = (
        round(
            ((pf_total - pf_start) / max(pf_end - pf_start, 1)) * 100,
            1,
        )
        if pet_stage < TOTAL_PET_STAGES
        else 100.0
    )

    return {
        "username": user.get("username"),
        "archetype": user.get("archetype"),
        "character_stage": stage,
        "character_stage_name": STAGE_NAMES[stage - 1],
        "total_xp": stage_xp,
        "xp_to_next_stage": (
            max(0, stage_end - stage_xp) if stage < TOTAL_CHARACTER_STAGES else 0
        ),
        "stage_progress_pct": stage_progress_pct,
        "pet_stage": pet_stage,
        "pet_name": PET_NAMES[pet_stage - 1] if pet_stage > 0 else None,
        "pet_unlocked": user.get("pet_unlocked", False),
        "total_pf": pf_total,
        "pf_to_next_pet": (
            max(0, pf_end - pf_total) if pet_stage < TOTAL_PET_STAGES else 0
        ),
        "pf_progress_pct": pf_progress_pct,
        "current_streak": user.get("current_streak", 0),
        "longest_streak": user.get("longest_streak", 0),
        "power_score": user.get("power_score", 0),
        "registration_date": user.get("registration_date"),
        "leaderboard_unlocked": user.get("leaderboard_unlocked", False),
        "email_connected": user.get("email_connected", False),
        "subscription_tier": user.get("subscription_tier"),
        "unread_mail_count": unread,
        "twin_tone_type": str(dna_row.get("twin_tone_type") or "rival"),
        "twin_intensity": int(dna_row.get("twin_intensity") or 3),
    }


@router.get("/streak", response_model=dict)
async def get_profile_streak(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    user_result = (
        supabase_admin.table("users")
        .select(
            "current_streak, longest_streak, streak_requirement_tier, timezone"
        )
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = user_result.data or {}

    tz_str = str(user.get("timezone") or "UTC")
    try:
        anchor = date.fromisoformat(get_user_date(tz_str))
    except Exception:
        anchor = date.today()
    since = str(anchor - timedelta(weeks=52))

    rows = (
        supabase_admin.table("streak_log")
        .select(
            "log_date, streak_maintained, streak_count, "
            "total_missions_done, total_missions, xp_earned, pf_earned"
        )
        .eq("user_id", user_id)
        .gte("log_date", since)
        .order("log_date")
        .execute()
        .data
        or []
    )

    reg_start = _first_local_calendar_date_from_registration(
        user.get("registration_date"), tz_str
    )
    if reg_start:
        rows = [r for r in rows if str(r.get("log_date") or "") >= reg_start]

    return {
        "current_streak": user.get("current_streak", 0),
        "longest_streak": user.get("longest_streak", 0),
        "streak_requirement_tier": user.get("streak_requirement_tier", "tier_1"),
        "heatmap_eligible_since": reg_start,
        "heatmap": [
            {
                "date": r["log_date"],
                "maintained": r.get("streak_maintained", False),
                "streak_count": r.get("streak_count", 0),
                "missions_done": r.get("total_missions_done", 0),
                "missions_total": r.get("total_missions", 0),
                "xp_earned": r.get("xp_earned", 0),
                "pf_earned": r.get("pf_earned", 0),
            }
            for r in rows
        ],
        "hint_text": "Tap any day to see your mission history",
    }


@router.get("/identity", response_model=dict)
async def get_profile_identity(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    try:
        user_result = (
            supabase_admin.table("users")
            .select("character_stage, total_xp")
            .eq("id", user_id)
            .single()
            .execute()
        )
    except Exception as e:
        # PostgREST can raise APIError; empty/HTML responses also surface as JSON errors.
        logger.warning("users fetch failed (profile identity): %s", e)
        raise HTTPException(
            status_code=503,
            detail="Profile data temporarily unavailable. Please try again.",
        ) from e

    user = user_result.data or {}

    milestones = _milestone_rows_character_stages(user_id)

    current_stage = user.get("character_stage", 1) or 1
    total_xp = user.get("total_xp", 0) or 0

    stages = []
    for i in range(1, TOTAL_CHARACTER_STAGES + 1):
        threshold = XP_THRESHOLDS[i - 1]
        next_threshold = (
            XP_THRESHOLDS[i] if i < len(XP_THRESHOLDS) else None
        )
        earned_at = next(
            (
                m["earned_at"]
                for m in milestones
                if m.get("milestone_type") == f"stage_{i}"
            ),
            None,
        )
        stages.append({
            "stage": i,
            "name": STAGE_NAMES[i - 1],
            "xp_required": threshold,
            "xp_next": next_threshold,
            "unlocked": i <= current_stage,
            "current": i == current_stage,
            "earned_at": earned_at,
        })

    stage_start = XP_THRESHOLDS[current_stage - 1]
    stage_end = (
        XP_THRESHOLDS[current_stage]
        if current_stage < len(XP_THRESHOLDS)
        else stage_start
    )
    progress_pct = (
        round(
            ((total_xp - stage_start) / max(stage_end - stage_start, 1)) * 100,
            1,
        )
        if current_stage < TOTAL_CHARACTER_STAGES
        else 100.0
    )

    return {
        "current_stage": current_stage,
        "current_stage_name": STAGE_NAMES[current_stage - 1],
        "total_xp": total_xp,
        "xp_to_next": (
            max(0, stage_end - total_xp) if current_stage < TOTAL_CHARACTER_STAGES else 0
        ),
        "progress_pct": progress_pct,
        "stages": stages,
    }


@router.get("/companion", response_model=dict)
async def get_profile_companion(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    try:
        try:
            user_result = (
                supabase_admin.table("users")
                .select("pet_stage, total_pf, pet_unlocked")
                .eq("id", user_id)
                .single()
                .execute()
            )
        except Exception as e:
            logger.warning("users fetch failed (profile companion): %s", e)
            raise HTTPException(
                status_code=503,
                detail="Profile data temporarily unavailable. Please try again.",
            ) from e

        user = user_result.data or {}

        milestones = _milestone_rows_pet_stages(user_id)

        current_pet = user.get("pet_stage", 0) or 0
        total_pf = user.get("total_pf", 0) or 0
        pet_unlocked = user.get("pet_unlocked", False)

        pets = []
        for i in range(1, TOTAL_PET_STAGES + 1):
            threshold = PF_THRESHOLDS[i - 1]
            next_threshold = (
                PF_THRESHOLDS[i] if i < len(PF_THRESHOLDS) else None
            )
            earned_at = next(
                (
                    m["earned_at"]
                    for m in milestones
                    if m.get("milestone_type") == f"pet_stage_{i}"
                ),
                None,
            )
            pets.append({
                "stage": i,
                "name": PET_NAMES[i - 1],
                "pf_required": threshold,
                "pf_next": next_threshold,
                "unlocked": pet_unlocked and i <= current_pet,
                "current": i == current_pet,
                "earned_at": earned_at,
            })

        pf_start = (
            PF_THRESHOLDS[current_pet - 1]
            if current_pet > 0
            else 0
        )
        pf_end = (
            PF_THRESHOLDS[current_pet]
            if current_pet < len(PF_THRESHOLDS) - 1
            else pf_start
        )
        if current_pet >= TOTAL_PET_STAGES:
            pf_end = PF_THRESHOLDS[current_pet - 1]
        progress_pct = (
            round(
                ((total_pf - pf_start) / max(pf_end - pf_start, 1)) * 100,
                1,
            )
            if current_pet < TOTAL_PET_STAGES
            else 100.0
        )

        return {
            "pet_unlocked": pet_unlocked,
            "current_pet_stage": current_pet,
            "current_pet_name": (
                PET_NAMES[current_pet - 1] if current_pet > 0 else None
            ),
            "total_pf": total_pf,
            "pf_to_next": (
                max(0, pf_end - total_pf) if current_pet < TOTAL_PET_STAGES else 0
            ),
            "progress_pct": progress_pct,
            "companions": pets,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("get_profile_companion failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Companion data temporarily unavailable. Please try again.",
        ) from e


@router.get("/interests", response_model=dict)
async def get_profile_interests(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    interests = (
        supabase_admin.table("interests")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data
        or []
    )

    results = []
    for interest in interests:
        milestones_earned = (
            supabase_admin.table("milestone_log")
            .select("milestone_type, earned_at")
            .eq("user_id", user_id)
            .eq("interest_id", interest["id"])
            .execute()
            .data
            or []
        )

        total_sessions = interest.get("total_sessions", 0) or 0

        milestone_status = []
        for key, required_sessions in INTEREST_MILESTONE_SESSIONS.items():
            earned_at = next(
                (
                    m["earned_at"]
                    for m in milestones_earned
                    if m.get("milestone_type") == f"interest_{key}_{interest['id']}"
                ),
                None,
            )
            milestone_status.append({
                "key": key,
                "sessions_required": required_sessions,
                "earned": total_sessions >= required_sessions,
                "earned_at": earned_at,
            })

        results.append({
            "id": interest["id"],
            "name": interest.get("normalised_name"),
            "category": interest.get("category"),
            "level_text": interest.get("level_text"),
            "user_goal": interest.get("user_goal"),
            "interest_level": interest.get("interest_level", 1),
            "current_difficulty_tier": interest.get("current_difficulty_tier"),
            "current_phase": interest.get("current_phase"),
            "total_sessions": total_sessions,
            "interest_xp": interest.get("interest_xp", 0),
            "active_days": interest.get("active_days", [1, 2, 3, 4, 5, 6, 7]),
            "milestones": milestone_status,
        })

    return {"interests": results}


QUIT_PHASES = [
    {"key": "awareness", "label": "Awareness", "days": (0, 10)},
    {"key": "replacement", "label": "Replacement", "days": (10, 30)},
    {"key": "reflex", "label": "Reflex", "days": (30, 60)},
    {"key": "rewired", "label": "Rewired", "days": (60, 90)},
    {"key": "free", "label": "Free", "days": (90, 9999)},
]


@router.get("/quits", response_model=dict)
async def get_profile_quits(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    quit_targets = (
        supabase_admin.table("quit_targets")
        .select("*")
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )

    results = []
    for qt in quit_targets:
        clean_days = qt.get("clean_days", 0) or 0
        current_phase = next(
            (
                p["key"]
                for p in QUIT_PHASES
                if p["days"][0] <= clean_days < p["days"][1]
            ),
            "awareness",
        )

        results.append({
            "id": qt["id"],
            "name": qt.get("normalised_name"),
            "clean_days": clean_days,
            "current_phase": current_phase,
            "last_slip_date": qt.get("last_slip_date"),
            "is_active": qt.get("is_active", True),
            "conquered": qt.get("conquered", False),
            "phases": [
                {
                    **p,
                    "completed": clean_days >= p["days"][1],
                    "active": p["key"] == current_phase,
                }
                for p in QUIT_PHASES
            ],
        })

    return {"quit_targets": results}
