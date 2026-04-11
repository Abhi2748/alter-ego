"""
Profile tab data endpoints — overview, streak, identity, companion, interests, quits.
"""

from __future__ import annotations

import logging
from difflib import SequenceMatcher
from datetime import date, datetime, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Header, HTTPException
from postgrest.exceptions import APIError
from typing import Literal

from pydantic import BaseModel, Field

from app.api.auth import get_user_id_from_token
from app.core.constants import (
    INTEREST_LEVEL_MAP,
    INTEREST_MILESTONE_SESSIONS,
    PET_NAMES,
    PF_THRESHOLDS,
    STAGE_NAMES,
    TOTAL_CHARACTER_STAGES,
    TOTAL_PET_STAGES,
    XP_THRESHOLDS,
)
from app.core.supabase_client import supabase_admin, run_query
from app.services.interest_path_service import (
    build_ui_path,
    complete_quest_insight,
    difficulty_label,
    experience_from_level_choice,
    normalize_path_state,
    schedule_abbrev,
)
from app.agents.interest_normaliser import normalise_interest
from app.services.arc_service import ARC_PHASE_LABELS
from app.services.mission_service import (
    ensure_pet_unlocked_if_eligible,
    get_user_date,
    sync_today_planner_missions,
)
from app.services.streak_service import sync_streak_if_lapsed

router = APIRouter(prefix="/api/v1/profile", tags=["profile"])
logger = logging.getLogger(__name__)


# Rotates on new interest creation (must match mobile INTEREST_COLORS primary + migration 027)
INTEREST_COLOR_PALETTE = [
    "#14B8A6",
    "#F59E0B",
    "#38BDF8",
    "#84CC16",
    "#EC4899",
]


def _norm_interest_key(name: str) -> str:
    return name.strip().lower().replace(" ", "_").replace("-", "_")


def _interest_names_match(a: str, b: str) -> bool:
    na, nb = _norm_interest_key(a), _norm_interest_key(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    if SequenceMatcher(None, na, nb).ratio() >= 0.88:
        return True
    if len(na) >= 5 and len(nb) >= 5 and (na in nb or nb in na):
        return True
    return False


def _goals_differ_meaningfully(g_new: str, g_old: str) -> bool:
    a = (g_new or "").strip().lower()
    b = (g_old or "").strip().lower()
    if not a or not b:
        return False
    if a == b:
        return False
    return SequenceMatcher(None, a, b).ratio() < 0.82


def _interest_owned_row(user_id: str, interest_id: str) -> dict:
    res = (
        supabase_admin.table("interests")
        .select("*")
        .eq("id", interest_id)
        .eq("user_id", user_id)
        .execute()
    )
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Interest not found")
    return rows[0]


def _parse_iso_to_local_date(iso_ts: str | None, tz_str: str) -> date | None:
    if not iso_ts:
        return None
    try:
        s = str(iso_ts).replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=dt_timezone.utc)
        z = ZoneInfo((tz_str or "UTC").strip() or "UTC")
        return dt.astimezone(z).date()
    except Exception:
        return None


def _parse_log_date(val) -> date | None:
    if val is None:
        return None
    if isinstance(val, date):
        return val
    if isinstance(val, str):
        return date.fromisoformat(val[:10])
    return None


def _max_streak_between(
    streak_rows: list[dict], start_d: date | None, end_d: date | None
) -> int | None:
    if not start_d or not end_d or start_d > end_d:
        return None
    m = 0
    for r in streak_rows:
        ld = _parse_log_date(r.get("log_date"))
        if not ld:
            continue
        if start_d <= ld <= end_d:
            m = max(m, int(r.get("streak_count") or 0))
    return m if m > 0 else None


def _streak_log_rows_for_user(user_id: str) -> list[dict]:
    try:
        return (
            supabase_admin.table("streak_log")
            .select("log_date, streak_count")
            .eq("user_id", user_id)
            .order("log_date")
            .execute()
            .data
            or []
        )
    except Exception as e:
        logger.warning("streak_log fetch failed (profile identity): %s", e)
        return []


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


class AvatarUrlBody(BaseModel):
    avatar_url: str = Field(..., max_length=600)


@router.get("/overview", response_model=dict)
async def get_profile_overview(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    await ensure_pet_unlocked_if_eligible(user_id)

    user_result = (
        await run_query(supabase_admin.table("users")
        .select(
            "username, archetype, character_stage, total_xp, "
            "pet_stage, pet_unlocked, total_pf, current_streak, "
            "longest_streak, power_score, registration_date, "
            "leaderboard_unlocked, email_connected, subscription_tier, "
            "return_reason, avatar_url, streak_freeze_count"
        )
        .eq("id", user_id)
        .single())
    )
    user = user_result.data or {}

    dna_results = (
        await run_query(supabase_admin.table("discipline_dna")
        .select("twin_tone_type, twin_intensity")
        .eq("user_id", user_id)
        .limit(1))
    )
    dna_row = (dna_results.data or [None])[0] or {}

    unread_result = (
        await run_query(supabase_admin.table("app_mails")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .is_("read_at", "null"))
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
        "return_reason": user.get("return_reason"),
        "profile_photo_url": user.get("avatar_url"),
        "streak_freeze_count": int(user.get("streak_freeze_count") or 0),
    }


@router.patch("/avatar", response_model=dict)
async def update_avatar_url(body: AvatarUrlBody, authorization: str = Header(None)):
    """
    Stores the public Supabase Storage URL for the user's avatar.
    The frontend uploads directly to Storage; this endpoint just records the URL.
    """
    user_id = get_user_id_from_token(authorization)
    await run_query(supabase_admin.table("users").update({"avatar_url": body.avatar_url}).eq(
        "id", user_id
    ))
    return {"success": True, "avatar_url": body.avatar_url}


@router.delete("/avatar", response_model=dict)
async def delete_avatar_url(authorization: str = Header(None)):
    """Clears the user's avatar URL (resets to initials placeholder)."""
    user_id = get_user_id_from_token(authorization)
    await run_query(supabase_admin.table("users").update({"avatar_url": None}).eq(
        "id", user_id
    ))
    return {"success": True}


@router.get("/streak", response_model=dict)
async def get_profile_streak(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    await sync_streak_if_lapsed(user_id)

    user_result = (
        await run_query(supabase_admin.table("users")
        .select(
            "current_streak, longest_streak, streak_requirement_tier, timezone, "
            "registration_date, streak_freeze_count"
        )
        .eq("id", user_id)
        .single())
    )
    user = user_result.data or {}

    tz_str = str(user.get("timezone") or "UTC")
    try:
        anchor = date.fromisoformat(get_user_date(tz_str))
    except Exception:
        anchor = date.today()
    since = str(anchor - timedelta(weeks=52))

    rows = (
        ((await run_query(supabase_admin.table("streak_log")
        .select(
            "log_date, streak_maintained, streak_count, "
            "total_missions_done, total_missions, xp_earned, pf_earned"
        )
        .eq("user_id", user_id)
        .gte("log_date", since)
        .order("log_date"))).data)
        or []
    )

    reg_start = _first_local_calendar_date_from_registration(
        user.get("registration_date"), tz_str
    )
    if reg_start:
        rows = [r for r in rows if str(r.get("log_date") or "") >= reg_start]

    # All-time days with at least one mission done (since registration); not limited to 52 weeks.
    overall_q = (
        supabase_admin.table("streak_log")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .gt("total_missions_done", 0)
    )
    if reg_start:
        overall_q = overall_q.gte("log_date", reg_start)
    overall_res = await run_query(overall_q)
    overall_active_days = int(getattr(overall_res, "count", None) or 0)

    return {
        "current_streak": user.get("current_streak", 0),
        "longest_streak": user.get("longest_streak", 0),
        "streak_requirement_tier": user.get("streak_requirement_tier", "tier_1"),
        # User's logical calendar date (timezone-aware). Heatmap last row can lag before streak_log exists for "today".
        "calendar_date": str(anchor),
        "heatmap_eligible_since": reg_start,
        "overall_active_days": overall_active_days,
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
        "streak_freeze_count": int(user.get("streak_freeze_count") or 0),
    }


@router.get("/identity", response_model=dict)
async def get_profile_identity(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    try:
        user_result = (
            await run_query(supabase_admin.table("users")
            .select("character_stage, total_xp, registration_date, timezone")
            .eq("id", user_id)
            .single())
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
    streak_rows = _streak_log_rows_for_user(user_id)

    tz_str = str(user.get("timezone") or "UTC")
    reg_date = _parse_iso_to_local_date(
        user.get("registration_date") if isinstance(user.get("registration_date"), str) else None,
        tz_str,
    )
    today_local = date.fromisoformat(get_user_date(tz_str))

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

        entry_date = _parse_iso_to_local_date(
            earned_at if isinstance(earned_at, str) else None,
            tz_str,
        )
        if entry_date is None and i == 1 and reg_date is not None:
            entry_date = reg_date

        next_earned_iso = next(
            (
                m["earned_at"]
                for m in milestones
                if m.get("milestone_type") == f"stage_{i + 1}"
            ),
            None,
        )
        exit_date = _parse_iso_to_local_date(
            next_earned_iso if isinstance(next_earned_iso, str) else None,
            tz_str,
        )

        reached_day: int | None = None
        if reg_date is not None and entry_date is not None:
            reached_day = max(1, (entry_date - reg_date).days + 1)

        days_at_stage: int | None = None
        peak_streak: int | None = None
        xp_earned_in_stage: int | None = None

        is_current = i == current_stage
        is_past = i < current_stage
        is_future = i > current_stage

        if not is_future and entry_date is not None:
            if is_current:
                span_end = today_local
                days_at_stage = max(1, (span_end - entry_date).days + 1)
                peak_streak = _max_streak_between(streak_rows, entry_date, span_end)
                xp_earned_in_stage = max(0, total_xp - threshold)
            elif is_past and exit_date is not None:
                last_day_in_stage = exit_date - timedelta(days=1)
                if last_day_in_stage < entry_date:
                    last_day_in_stage = entry_date
                days_at_stage = max(1, (last_day_in_stage - entry_date).days + 1)
                peak_streak = _max_streak_between(streak_rows, entry_date, last_day_in_stage)
                if next_threshold is not None:
                    xp_earned_in_stage = max(0, next_threshold - threshold)
            elif is_past and exit_date is None:
                if next_threshold is not None:
                    xp_earned_in_stage = max(0, next_threshold - threshold)

        stages.append({
            "stage": i,
            "name": STAGE_NAMES[i - 1],
            "xp_required": threshold,
            "xp_next": next_threshold,
            "unlocked": i <= current_stage,
            "current": is_current,
            "earned_at": earned_at,
            "reached_day": reached_day,
            "days_at_stage": days_at_stage,
            "peak_streak_at_stage": peak_streak,
            "xp_earned_in_stage": xp_earned_in_stage,
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
                await run_query(supabase_admin.table("users")
                .select("pet_stage, total_pf, pet_unlocked")
                .eq("id", user_id)
                .single())
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
        ((await run_query(supabase_admin.table("interests")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_active", True))).data)
        or []
    )

    results = []
    for interest in interests:
        milestones_earned = (
            ((await run_query(supabase_admin.table("milestone_log")
            .select("milestone_type, earned_at")
            .eq("user_id", user_id)
            .eq("interest_id", interest["id"]))).data)
            or []
        )

        total_sessions = interest.get("total_sessions", 0) or 0
        sc = int(interest.get("sessions_completed") or 0)

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
                "earned": sc >= required_sessions,
                "earned_at": earned_at,
            })

        path_raw = interest.get("interest_path_state")
        if not isinstance(path_raw, dict):
            path_raw = {}

        ui_path = build_ui_path(interest, milestone_status, path_raw)
        tier = interest.get("current_difficulty_tier") or "easy"
        if tier not in ("easy", "medium", "hard"):
            tier = "easy"
        active_days = interest.get("active_days", [1, 2, 3, 4, 5, 6, 7])
        if not isinstance(active_days, list):
            active_days = [1, 2, 3, 4, 5, 6, 7]

        tp = interest.get("total_planned_sessions")
        progress_pct = None
        if tp:
            try:
                progress_pct = round((sc / max(int(tp), 1)) * 100, 1)
            except Exception:
                progress_pct = None

        # ── last_7_days_activity ───────────────────────────────────────────
        try:
            today_d = date.today()
            last_7 = [(today_d - timedelta(days=i)).isoformat() for i in range(6, -1, -1)]
            activity_rows = (
                ((await run_query(supabase_admin.table("missions")
                .select("mission_date")
                .eq("user_id", user_id)
                .eq("interest_id", interest["id"])
                .eq("completed", True)
                .in_("mission_date", last_7))).data)
                or []
            )
            completed_dates = {str(r.get("mission_date") or "")[:10] for r in activity_rows}
            last_7_days_activity = [d in completed_dates for d in last_7]
        except Exception:
            last_7_days_activity = [False] * 7

        # ── interest_streak (single query, 60-day lookback) ──────────────────
        try:
            today_d = date.today()
            cutoff = (today_d - timedelta(days=60)).isoformat()
            all_dates_rows = (
                ((await run_query(supabase_admin.table("missions")
                .select("mission_date")
                .eq("user_id", user_id)
                .eq("interest_id", interest["id"])
                .eq("completed", True)
                .gte("mission_date", cutoff))).data)
                or []
            )
            completed_set = {str(r.get("mission_date") or "")[:10] for r in all_dates_rows}
            streak = 0
            check_date = today_d
            for _ in range(60):
                if check_date.isoformat() in completed_set:
                    streak += 1
                    check_date -= timedelta(days=1)
                else:
                    if streak == 0 and check_date == today_d:
                        check_date -= timedelta(days=1)
                        continue
                    break
            interest_streak = streak
        except Exception:
            interest_streak = 0

        # ── days_since_created ───────────────────────────────────────────────
        try:
            created_raw = interest.get("created_at") or ""
            if created_raw:
                created_dt = datetime.fromisoformat(str(created_raw).replace("Z", "+00:00"))
                if created_dt.tzinfo is None:
                    created_dt = created_dt.replace(tzinfo=dt_timezone.utc)
                days_since_created = max(1, (date.today() - created_dt.date()).days + 1)
            else:
                days_since_created = 1
        except Exception:
            days_since_created = 1

        cap = str(interest.get("current_arc_phase") or "no_deadline")
        results.append({
            "id": interest["id"],
            "name": interest.get("normalised_name"),
            "category": interest.get("category"),
            "level_text": interest.get("level_text"),
            "user_goal": interest.get("user_goal"),
            "interest_level": interest.get("interest_level", 1),
            "current_difficulty_tier": tier,
            "current_phase": interest.get("current_phase"),
            "total_sessions": total_sessions,
            "interest_xp": interest.get("interest_xp", 0),
            "active_days": active_days,
            "milestones": milestone_status,
            "ui_path": ui_path,
            "schedule_abbrev": schedule_abbrev([int(d) for d in active_days if isinstance(d, (int, float))]),
            "difficulty_label": difficulty_label(tier),
            "sessions_completed": sc,
            "total_planned_sessions": interest.get("total_planned_sessions"),
            "current_arc_phase": cap,
            "arc_phase_label": ARC_PHASE_LABELS.get(cap, "Open Practice"),
            "target_date": interest.get("target_date"),
            "arc_paused": bool(interest.get("arc_paused")),
            "progress_pct": progress_pct,
            "last_7_days_activity": last_7_days_activity,
            "interest_streak": interest_streak,
            "days_since_created": days_since_created,
        })

    return {"interests": results}


def _map_interest_level_from_client(level: str) -> str:
    """Map Add Interest sheet labels to DB `level_text` keys."""
    s = (level or "").strip().lower()
    m = {
        "still figuring it out": "still_figuring_it_out",
        "getting the hang of it": "getting_the_hang_of_it",
        "pretty solid": "pretty_solid",
        "still_figuring_it_out": "still_figuring_it_out",
        "getting_the_hang_of_it": "getting_the_hang_of_it",
        "pretty_solid": "pretty_solid",
    }
    return m.get(s, "still_figuring_it_out")


def _schedule_client_indices_to_db(days: list[int]) -> list[int]:
    """App sends 0=Mon … 6=Sun; DB uses 1–7 (Mon–Sun)."""
    out = sorted({int(d) + 1 for d in days if 0 <= int(d) <= 6})
    if len(out) < 1:
        raise HTTPException(status_code=400, detail="Pick at least one practice day")
    return out


class InterestCreateBody(BaseModel):
    interest_description: str = Field(..., min_length=2, max_length=4000)
    interest_level: str = ""
    goal_description: str = Field(..., min_length=10, max_length=4000)
    schedule_days: list[int] = Field(..., min_length=1)
    target_timeline: str | None = None  # "1_month" | "3_months" | "6_months" | "1_year" | "no_deadline" | None


@router.post("/interests", response_model=dict)
async def post_profile_interest(body: InterestCreateBody, authorization: str = Header(None)):
    """Create a new interest + path (same pipeline as onboarding interest rows)."""
    user_id = get_user_id_from_token(authorization)
    level_key = _map_interest_level_from_client(body.interest_level)
    if level_key not in INTEREST_LEVEL_MAP:
        level_key = "still_figuring_it_out"
    active_days = _schedule_client_indices_to_db(body.schedule_days)
    raw_text = body.interest_description.strip()
    user_goal = body.goal_description.strip()

    normalised = await normalise_interest(raw_text, level_key, user_goal)
    if normalised.get("rejected"):
        reason = str(normalised.get("rejection_reason") or "")
        if reason == "self_harm":
            raise HTTPException(
                status_code=400,
                detail="Please reach out to someone who can help.",
            )
        if "quit target" in reason.lower():
            raise HTTPException(
                status_code=400,
                detail="This sounds like something to quit — add it under Quits instead.",
            )
        raise HTTPException(
            status_code=400,
            detail="This interest could not be added. Try different wording.",
        )

    level_context = normalised.get("level_context") or {}
    level_meta = INTEREST_LEVEL_MAP[level_key]

    existing_rows = (
        await run_query(supabase_admin.table("interests")
        .select("id, normalised_name, user_goal")
        .eq("user_id", user_id)
        .eq("is_active", True))
    ).data or []
    new_nm = str(normalised.get("normalised_name") or raw_text).strip()
    for ex in existing_rows:
        ex_nm = str(ex.get("normalised_name") or "").strip()
        if not _interest_names_match(new_nm, ex_nm):
            continue
        if _goals_differ_meaningfully(user_goal, str(ex.get("user_goal") or "")):
            raise HTTPException(
                status_code=409,
                detail="You already have an interest for this topic. Update the goal on that interest instead of adding a new one.",
            )
        raise HTTPException(status_code=409, detail="You already have this interest.")

    palette_index = len(existing_rows) % len(INTEREST_COLOR_PALETTE)
    interest_color = INTEREST_COLOR_PALETTE[palette_index]

    row = {
        "user_id": user_id,
        "raw_text": raw_text,
        "normalised_name": normalised.get("normalised_name") or raw_text.title(),
        "color": interest_color,
        "category": normalised.get("category") or "Other",
        "mission_domain": normalised.get("mission_domain") or raw_text.lower(),
        "level_context_beginner": (
            level_context.get("beginner") if isinstance(level_context, dict) else None
        ),
        "level_context_intermediate": (
            level_context.get("intermediate") if isinstance(level_context, dict) else None
        ),
        "level_context_advanced": (
            level_context.get("advanced") if isinstance(level_context, dict) else None
        ),
        "evidence_base": normalised.get("evidence_base"),
        "common_obstacles": normalised.get("common_obstacles") or [],
        "level_text": level_key,
        "user_goal": user_goal,
        "active_days": active_days,
        "interest_level": 1,
        "interest_xp": 0,
        "current_difficulty_tier": level_meta["starting_tier"],
        "current_phase": level_meta["phase"],
        "total_sessions": 0,
        "is_active": True,
    }
    ins = await run_query(supabase_admin.table("interests").insert(row))
    new_id = None
    if ins.data and isinstance(ins.data, list) and ins.data[0].get("id"):
        new_id = str(ins.data[0]["id"])

    # Arc initialization — compute total_planned_sessions and initial arc phase
    from app.services.arc_service import compute_arc_phase, compute_total_sessions

    try:
        timeline_key = str(body.target_timeline or "no_deadline")
        valid_timelines = {"1_month", "3_months", "6_months", "1_year", "no_deadline"}
        if timeline_key not in valid_timelines:
            timeline_key = "no_deadline"

        days_per_week = len(set(active_days)) if isinstance(active_days, list) else 5

        total_sessions_plan = compute_total_sessions(timeline_key, days_per_week)
        initial_arc_phase = compute_arc_phase(0, total_sessions_plan)

        arc_update: dict = {
            "current_arc_phase": initial_arc_phase,
            "sessions_completed": 0,
            "arc_phase_session": 1,
        }
        if total_sessions_plan is not None:
            weeks_map = {"1_month": 4, "3_months": 13, "6_months": 26, "1_year": 52}
            weeks = weeks_map.get(timeline_key)
            if weeks:
                target_date = date.today() + timedelta(weeks=weeks)
                arc_update["target_date"] = target_date.isoformat()
                arc_update["original_target_date"] = target_date.isoformat()
            arc_update["total_planned_sessions"] = total_sessions_plan

        if new_id:
            await run_query(supabase_admin.table("interests").update(arc_update).eq("id", new_id).eq(
                "user_id", user_id
            ))
    except Exception:
        pass  # Arc init failure never breaks interest creation

    try:
        tz_res = (
            await run_query(supabase_admin.table("users")
            .select("timezone")
            .eq("id", user_id)
            .single())
        )
        tz_str = (tz_res.data or {}).get("timezone") or "UTC"
        today = get_user_date(tz_str)
        await sync_today_planner_missions(user_id, today)
    except Exception as e:
        logger.warning("post_profile_interest: planner sync failed: %s", e)

    return {"success": True, "interest_id": new_id}


class InterestPauseBody(BaseModel):
    reason: str | None = None  # "user_requested" or None


class InterestTimelineBody(BaseModel):
    target_timeline: str  # "1_month" | "3_months" | "6_months" | "1_year" | "no_deadline"


@router.post("/interests/{interest_id}/pause", response_model=dict)
async def pause_interest_arc(
    interest_id: str,
    body: InterestPauseBody,
    authorization: str = Header(None),
):
    """Pause arc generation for this interest. No missions generated while paused."""
    user_id = get_user_id_from_token(authorization)
    _interest_owned_row(user_id, interest_id)

    await run_query(supabase_admin.table("interests").update(
        {
            "arc_paused": True,
            "arc_paused_at": datetime.now(dt_timezone.utc).isoformat(),
            "arc_paused_reason": body.reason or "user_requested",
        }
    ).eq("id", interest_id).eq("user_id", user_id))
    return {"ok": True, "arc_paused": True}


@router.post("/interests/{interest_id}/resume", response_model=dict)
async def resume_interest_arc(
    interest_id: str,
    authorization: str = Header(None),
):
    """Resume a paused interest arc."""
    user_id = get_user_id_from_token(authorization)
    _interest_owned_row(user_id, interest_id)
    await run_query(supabase_admin.table("interests").update(
        {
            "arc_paused": False,
            "arc_paused_at": None,
            "arc_paused_reason": None,
        }
    ).eq("id", interest_id).eq("user_id", user_id))
    return {"ok": True, "arc_paused": False}


@router.put("/interests/{interest_id}/timeline", response_model=dict)
async def update_interest_timeline(
    interest_id: str,
    body: InterestTimelineBody,
    authorization: str = Header(None),
):
    """Update the target timeline for an interest and recalculate arc sessions."""
    user_id = get_user_id_from_token(authorization)
    row = _interest_owned_row(user_id, interest_id)

    from app.services.arc_service import compute_arc_phase, compute_total_sessions

    valid_timelines = {"1_month", "3_months", "6_months", "1_year", "no_deadline"}
    timeline_key = body.target_timeline
    if timeline_key not in valid_timelines:
        raise HTTPException(status_code=400, detail="Invalid timeline value")

    active_days = row.get("active_days") or [1, 2, 3, 4, 5, 6, 7]
    days_per_week = len(set(active_days)) if isinstance(active_days, list) else 5
    total_sessions = compute_total_sessions(timeline_key, days_per_week)
    sessions_done = int(row.get("sessions_completed") or 0)
    new_arc_phase = compute_arc_phase(sessions_done, total_sessions)

    update: dict = {
        "current_arc_phase": new_arc_phase,
        "total_planned_sessions": total_sessions,
        "timeline_adjusted_count": int(row.get("timeline_adjusted_count") or 0) + 1,
    }

    weeks_map = {"1_month": 4, "3_months": 13, "6_months": 26, "1_year": 52}
    weeks = weeks_map.get(timeline_key)
    if weeks:
        target_date = date.today() + timedelta(weeks=weeks)
        update["target_date"] = target_date.isoformat()
    else:
        update["target_date"] = None

    await run_query(supabase_admin.table("interests").update(update).eq("id", interest_id).eq(
        "user_id", user_id
    ))
    return {"ok": True, "new_arc_phase": new_arc_phase, "total_planned_sessions": total_sessions}


class InterestCriterionPatch(BaseModel):
    quest_id: str
    index: int = Field(ge=0, le=1)
    done: bool


class InterestDifficultyPut(BaseModel):
    tier: str


class InterestSchedulePut(BaseModel):
    active_days: list[int] = Field(..., min_length=2)


class InterestGoalPut(BaseModel):
    new_goal: str = Field(..., min_length=4, max_length=500)
    experience_level: Literal["beginner", "intermediate", "advanced"]


@router.patch("/interests/{interest_id}/quest/criterion", response_model=dict)
async def patch_interest_quest_criterion(
    interest_id: str,
    body: InterestCriterionPatch,
    authorization: str = Header(None),
):
    user_id = get_user_id_from_token(authorization)
    row = _interest_owned_row(user_id, interest_id)
    st = normalize_path_state(row.get("interest_path_state") or {})
    cur = st["current"]
    if body.quest_id != str(cur):
        raise HTTPException(
            status_code=400,
            detail="You can only update criteria for the active quest.",
        )
    qkey = str(cur)
    crit = list(st["criteria"].get(qkey, [False, False]))
    if body.index >= len(crit):
        raise HTTPException(status_code=400, detail="Invalid criterion index")
    crit[body.index] = body.done
    st["criteria"][qkey] = crit
    await run_query(supabase_admin.table("interests").update({"interest_path_state": st}).eq(
        "id", interest_id
    ))
    return {"success": True}


@router.post("/interests/{interest_id}/quests/{quest_id}/complete", response_model=dict)
async def post_interest_quest_complete(
    interest_id: str,
    quest_id: str,
    authorization: str = Header(None),
):
    user_id = get_user_id_from_token(authorization)
    row = _interest_owned_row(user_id, interest_id)
    st = normalize_path_state(row.get("interest_path_state") or {})
    cur = st["current"]
    if cur >= 3:
        raise HTTPException(status_code=400, detail="All quests on this path are complete.")
    if quest_id != str(cur):
        raise HTTPException(status_code=400, detail="This quest is not active.")
    crit = st["criteria"].get(str(cur), [False, False])
    if len(crit) < 2 or not (crit[0] and crit[1]):
        raise HTTPException(
            status_code=400,
            detail="Complete all success criteria before finishing the quest.",
        )
    name = row.get("normalised_name") or "this skill"
    insight = complete_quest_insight(cur, name)
    st["current"] = min(3, cur + 1)
    await run_query(supabase_admin.table("interests").update({"interest_path_state": st}).eq(
        "id", interest_id
    ))
    return {"success": True, "insight": insight}


@router.put("/interests/{interest_id}/difficulty", response_model=dict)
async def put_profile_interest_difficulty(
    interest_id: str,
    body: InterestDifficultyPut,
    authorization: str = Header(None),
):
    user_id = get_user_id_from_token(authorization)
    row = _interest_owned_row(user_id, interest_id)
    old_tier = str(row.get("current_difficulty_tier") or "easy").lower()
    tier = body.tier.lower()
    if tier not in ("easy", "medium", "hard"):
        raise HTTPException(status_code=400, detail="Invalid difficulty tier")
    await run_query(supabase_admin.table("interests").update({"current_difficulty_tier": tier}).eq(
        "id", interest_id
    ))
    rank = {"easy": 0, "medium": 1, "hard": 2}
    if rank.get(tier, 0) > rank.get(old_tier, 0):
        try:
            from app.services.mail_service import send_app_mail

            existing = (
                ((await run_query(supabase_admin.table("app_mails")
                .select("id")
                .eq("user_id", user_id)
                .eq("mail_type", "first_difficulty_upgrade")
                .limit(1))).data)
                or []
            )
            if not existing:
                await send_app_mail(user_id, "first_difficulty_upgrade")
        except Exception:
            pass
    return {"success": True}


@router.put("/interests/{interest_id}/schedule", response_model=dict)
async def put_profile_interest_schedule(
    interest_id: str,
    body: InterestSchedulePut,
    authorization: str = Header(None),
):
    user_id = get_user_id_from_token(authorization)
    _interest_owned_row(user_id, interest_id)
    days = sorted({int(d) for d in body.active_days})
    if len(days) < 2:
        raise HTTPException(status_code=400, detail="Pick at least two days")
    for d in days:
        if d < 1 or d > 7:
            raise HTTPException(status_code=400, detail="Invalid weekday (use 1–7)")
    await run_query(supabase_admin.table("interests").update({"active_days": days}).eq(
        "id", interest_id
    ))
    return {"success": True}


@router.put("/interests/{interest_id}/goal", response_model=dict)
async def put_profile_interest_goal(
    interest_id: str,
    body: InterestGoalPut,
    authorization: str = Header(None),
):
    user_id = get_user_id_from_token(authorization)
    _interest_owned_row(user_id, interest_id)
    lt = experience_from_level_choice(body.experience_level)
    await run_query(supabase_admin.table("interests").update({
        "user_goal": body.new_goal.strip(),
        "level_text": lt,
        "interest_path_state": {},
    }).eq("id", interest_id))
    return {"success": True}


@router.delete("/interests/{interest_id}", response_model=dict)
async def delete_profile_interest(
    interest_id: str,
    authorization: str = Header(None),
):
    user_id = get_user_id_from_token(authorization)
    _interest_owned_row(user_id, interest_id)
    await run_query(supabase_admin.table("interests").delete().eq("id", interest_id).eq(
        "user_id", user_id
    ))
    return {"success": True}


@router.get("/quits", response_model=dict)
async def get_profile_quits(authorization: str = Header(None)):
    """Legacy alias — use GET /api/v1/quits for the full quit path payload."""
    user_id = get_user_id_from_token(authorization)
    from app.services.quit_service import get_quits_for_user

    paths = await get_quits_for_user(user_id)
    return {"quit_paths": paths}
