"""Focus tab API — tags, sessions, stats, settings."""

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.api.auth import get_user_id_from_token
from app.services.focus_service import (
    create_tag,
    delete_tag,
    get_focus_settings,
    get_focus_stats,
    get_tags,
    log_session,
    update_focus_settings,
)

router = APIRouter(prefix="/api/v1/focus", tags=["focus"])


# ── Tags ─────────────────────────────────────────────────────────────────────


@router.get("/tags")
async def list_tags(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    return await get_tags(user_id)


class CreateTagRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=32)
    color: str = Field(default="#8B5CF6")


@router.post("/tags")
async def create_tag_route(body: CreateTagRequest, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    try:
        return await create_tag(user_id, body.name, body.color)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.delete("/tags/{tag_id}")
async def delete_tag_route(tag_id: str, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    return await delete_tag(user_id, tag_id)


# ── Sessions ─────────────────────────────────────────────────────────────────


class LogSessionRequest(BaseModel):
    mode: str  # 'pomodoro' | 'deep_work' | 'stopwatch'
    tag_id: str | None = None
    started_at: str  # ISO 8601
    ended_at: str  # ISO 8601
    focus_seconds: int = Field(default=0, ge=0)
    break_seconds: int = Field(default=0, ge=0)
    rounds_completed: int = Field(default=0, ge=0)
    was_abandoned: bool = False


@router.post("/sessions")
async def log_session_route(body: LogSessionRequest, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    try:
        return await log_session(
            user_id=user_id,
            mode=body.mode,
            tag_id=body.tag_id,
            started_at=body.started_at,
            ended_at=body.ended_at,
            focus_seconds=body.focus_seconds,
            break_seconds=body.break_seconds,
            rounds_completed=body.rounds_completed,
            was_abandoned=body.was_abandoned,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


# ── Stats ─────────────────────────────────────────────────────────────────────


@router.get("/stats")
async def get_stats(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    return await get_focus_stats(user_id)


# ── Settings ──────────────────────────────────────────────────────────────────


@router.get("/settings")
async def get_settings(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    return await get_focus_settings(user_id)


class UpdateSettingsRequest(BaseModel):
    pomodoro_work_minutes: int | None = None
    pomodoro_short_break_minutes: int | None = None
    pomodoro_long_break_minutes: int | None = None
    pomodoro_rounds: int | None = None
    auto_start_breaks: bool | None = None
    auto_start_work: bool | None = None
    sound_enabled: bool | None = None
    vibration_enabled: bool | None = None


@router.patch("/settings")
async def update_settings(body: UpdateSettingsRequest, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    return await update_focus_settings(user_id, updates)
