"""
GET /api/v1/profile/mirror — 7-Day Mirror observations (day 7+, no LLM).
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.api.auth import get_user_id_from_token
from app.core.supabase_client import supabase_admin
from app.services.mission_service import get_user_date
from app.services.mirror_service import compute_mirror_observations

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/profile", tags=["mirror"])

CLOSING_LINE = "I'll know more next week."


class MirrorObservation(BaseModel):
    text: str
    bold_segments: list[str] = Field(default_factory=list)
    violet_segments: list[str] = Field(default_factory=list)


class MirrorResponse(BaseModel):
    eligible: bool
    already_shown: bool
    day_count: int
    observations: list[MirrorObservation]
    closing_line: str


def _parse_registration_date(user: dict) -> date | None:
    reg = user.get("registration_date")
    if reg:
        try:
            raw = str(reg).replace("Z", "+00:00")
            dt = datetime.fromisoformat(raw)
            return dt.date()
        except Exception:
            pass
    created = user.get("created_at")
    if created:
        try:
            return date.fromisoformat(str(created)[:10])
        except Exception:
            pass
    return None


@router.get("/mirror", response_model=MirrorResponse)
async def get_mirror(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    user_result = (
        supabase_admin.table("users")
        .select("registration_date, created_at, archetype, timezone, mirror_shown")
        .eq("id", user_id)
        .single()
        .execute()
    )
    if not user_result.data:
        raise HTTPException(status_code=404, detail="User not found")

    user = user_result.data
    tz = (user.get("timezone") or "UTC").strip() or "UTC"
    today_str = get_user_date(tz)

    reg_d = _parse_registration_date(user)
    try:
        today_d = date.fromisoformat(today_str)
    except Exception:
        today_d = date.today()

    if reg_d is None:
        day_count = 0
    else:
        day_count = (today_d - reg_d).days + 1

    if day_count < 1:
        day_count = 0

    already_shown = bool(user.get("mirror_shown"))

    if day_count < 7:
        return MirrorResponse(
            eligible=False,
            already_shown=already_shown,
            day_count=max(day_count, 0),
            observations=[],
            closing_line=CLOSING_LINE,
        )

    reg_date_str = reg_d.isoformat() if reg_d else today_str
    window_end_d = reg_d + timedelta(days=6) if reg_d else today_d
    window_end_str = min(window_end_d, today_d).isoformat()

    observations_out: list[MirrorObservation] = []
    response_already_shown = already_shown

    if not already_shown:
        try:
            raw_list = await compute_mirror_observations(
                user_id=user_id,
                reg_date=reg_date_str,
                window_end=window_end_str,
            )
            observations_out = [MirrorObservation.model_validate(o) for o in raw_list]
        except Exception as e:
            logger.error(
                json.dumps(
                    {
                        "event": "mirror_compute_error",
                        "user_id": user_id,
                        "error": str(e),
                    }
                )
            )
            observations_out = []

        try:
            supabase_admin.table("users").update({"mirror_shown": True}).eq("id", user_id).execute()
            response_already_shown = True
        except Exception as e:
            logger.error(
                json.dumps(
                    {
                        "event": "mirror_shown_update_error",
                        "user_id": user_id,
                        "error": str(e),
                    }
                )
            )

    logger.info(
        json.dumps(
            {
                "event": "mirror_generated",
                "user_id": user_id,
                "day_count": day_count,
                "observations": len(observations_out),
            }
        )
    )

    return MirrorResponse(
        eligible=True,
        already_shown=response_already_shown,
        day_count=day_count,
        observations=observations_out,
        closing_line=CLOSING_LINE,
    )
