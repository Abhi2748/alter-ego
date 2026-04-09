"""
POST /api/v1/profile/return-reason — after 7+ day absence flow (B3).
GET /api/v1/profile/return-state — interstitial / recovery hints (B3b).
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Header
from pydantic import BaseModel

from app.api.auth import get_user_id_from_token
from app.core.constants import (
    LONG_ABSENCE_RETURN_MESSAGES,
    RETURN_REASON_RESPONSES,
    RETURN_REASON_TONE_OVERRIDE,
)
from app.core.supabase_client import run_query, supabase_admin
from app.services.absence_service import compute_absence_days
from app.services.mission_service import get_user_date

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/profile", tags=["profile"])


class ReturnReasonRequest(BaseModel):
    reason: Literal["life", "motivation", "forgot", "break", "unsure"]


class ReturnReasonResponse(BaseModel):
    twin_response: str
    tone_override: str
    silent_mode: bool
    recovery_active: bool
    recovery_days: int


class ReturnStateResponse(BaseModel):
    absence_days: int
    should_ask_question: bool
    is_long_absence: bool
    long_absence_message: str | None
    already_answered_today: bool
    recovery_active: bool
    recovery_days_remaining: int


def _normalize_archetype_key(archetype: str) -> str:
    t = str(archetype or "").lower().replace(" ", "_").replace("-", "_")
    if t.startswith("the_"):
        t = t[4:]
    return t or "default"


@router.post("/return-reason", response_model=ReturnReasonResponse)
async def post_return_reason(
    body: ReturnReasonRequest,
    authorization: str = Header(None),
):
    user_id = get_user_id_from_token(authorization)
    reason = str(body.reason or "").strip().lower()
    if reason not in RETURN_REASON_RESPONSES:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail="Invalid return reason")

    tone = RETURN_REASON_TONE_OVERRIDE.get(reason, "blunt")
    twin_response = RETURN_REASON_RESPONSES.get(reason, "")

    override_until = datetime.now(timezone.utc) + timedelta(days=7)

    tz_row = (
        await run_query(
        supabase_admin.table("users")
        .select("timezone")
        .eq("id", user_id)
        .single()
        )
        .data
        or {}
    )
    tz_str = str(tz_row.get("timezone") or "UTC").strip() or "UTC"
    today_local = get_user_date(tz_str)
    today_local_date = date.fromisoformat(today_local[:10])
    recovery_until = (today_local_date + timedelta(days=3)).isoformat()

    payload = {
        "return_reason": reason,
        "return_reason_set_at": datetime.now(timezone.utc).isoformat(),
        "twin_tone_override": tone,
        "twin_tone_override_until": override_until.isoformat(),
        "recovery_mode_reason": reason,
        "recovery_mode_until": recovery_until,
        "return_question_shown_at": datetime.now(timezone.utc).isoformat(),
        "absence_days": 0,
        "last_active_date": today_local,
        "last_absence_notif_day": 0,
        "unsure_followup_push_sent": False,
        "final_absence_notif_sent": False,
        "long_absence_shown": False,
    }

    try:
        await run_query(supabase_admin.table("users").update(payload).eq("id", user_id))
        logger.info(
            json.dumps(
                {
                    "event": "return_reason_stored",
                    "user_id": user_id,
                    "reason": reason,
                    "tone_override": tone,
                }
            )
        )
        logger.info(
            json.dumps(
                {
                    "event": "recovery_mode_activated",
                    "user_id": user_id,
                    "reason": reason,
                    "days": 3,
                    "until": recovery_until,
                }
            )
        )
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "return_reason_store_error",
                    "user_id": user_id,
                    "error": str(e),
                }
            )
        )

    return ReturnReasonResponse(
        twin_response=twin_response,
        tone_override=tone,
        silent_mode=(reason == "unsure"),
        recovery_active=True,
        recovery_days=3,
    )


@router.get("/return-state", response_model=ReturnStateResponse)
async def get_return_state(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    user_res = await run_query(
        supabase_admin.table("users")
        .select(
            "absence_days, archetype, return_question_shown_at, "
            "recovery_mode_reason, recovery_mode_until, long_absence_shown, "
            "last_active_date, last_streak_date, timezone"
        )
        .eq("id", user_id)
        .single()
    )
    user = user_res.data or {}
    tz_str = str(user.get("timezone") or "UTC").strip() or "UTC"
    today_local = get_user_date(tz_str)
    today_d = date.fromisoformat(today_local[:10])

    absence_days = compute_absence_days(supabase_admin, user_id, user, today_local)

    shown_at = user.get("return_question_shown_at")
    already_answered = False
    if shown_at:
        try:
            raw = str(shown_at).replace("Z", "+00:00")
            shown_dt = datetime.fromisoformat(raw)
            if shown_dt.tzinfo is None:
                shown_dt = shown_dt.replace(tzinfo=timezone.utc)
            hours_since = (datetime.now(timezone.utc) - shown_dt).total_seconds() / 3600
            already_answered = hours_since < 24
        except Exception:
            pass

    is_long = absence_days >= 14
    should_ask = absence_days >= 7 and not is_long and not already_answered

    long_msg = None
    show_long = is_long and not bool(user.get("long_absence_shown"))
    if show_long:
        akey = _normalize_archetype_key(str(user.get("archetype") or ""))
        template = LONG_ABSENCE_RETURN_MESSAGES.get(
            akey, LONG_ABSENCE_RETURN_MESSAGES["default"]
        )
        long_msg = template.replace("{N}", str(absence_days))

    recovery_remaining = 0
    rm_until = user.get("recovery_mode_until")
    if rm_until and user.get("recovery_mode_reason"):
        try:
            rm_date = date.fromisoformat(str(rm_until)[:10])
            if today_d <= rm_date:
                recovery_remaining = (rm_date - today_d).days + 1
        except Exception:
            pass

    return ReturnStateResponse(
        absence_days=absence_days,
        should_ask_question=should_ask,
        is_long_absence=is_long,
        long_absence_message=long_msg,
        already_answered_today=already_answered,
        recovery_active=recovery_remaining > 0,
        recovery_days_remaining=recovery_remaining,
    )


@router.post("/long-absence-ack")
async def post_long_absence_ack(authorization: str = Header(None)):
    """Mark 14+ day acknowledgment as shown (one per absence cycle; reset on return)."""
    user_id = get_user_id_from_token(authorization)
    try:
        await run_query(
            supabase_admin.table("users").update({"long_absence_shown": True}).eq("id", user_id)
        )
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "long_absence_ack_error",
                    "user_id": user_id,
                    "error": str(e),
                }
            )
        )
    return {"ok": True}
