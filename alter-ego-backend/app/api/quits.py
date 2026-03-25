from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.api.auth import get_user_id_from_token
from app.services.quit_service import (
    advance_phase,
    create_quit_path,
    delete_quit_path,
    get_quits_for_user,
    log_frequency,
    update_quit_schedule,
)

router = APIRouter(prefix="/api/v1/quits", tags=["quits"])


class LogFrequencyRequest(BaseModel):
    count: int


class UpdateTriggerProfileRequest(BaseModel):
    trigger_contexts: list[str]
    awareness_level: str


class CreateQuitPathRequest(BaseModel):
    habit_name: str = Field(..., min_length=1)
    trigger_contexts: list[str] = Field(default_factory=list)
    awareness_level: str = "semi_conscious"
    quit_goal: str = "stop_completely"


@router.get("")
async def list_quits(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    return await get_quits_for_user(user_id)


@router.post("")
async def create_quit_path_route(body: CreateQuitPathRequest, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    try:
        return await create_quit_path(
            user_id=user_id,
            habit_name=body.habit_name.strip(),
            trigger_contexts=body.trigger_contexts,
            awareness_level=body.awareness_level,
            quit_goal=body.quit_goal,
        )
    except Exception as e:
        if "quit_paths_user_habit_unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(status_code=409, detail="You already have a path for this habit.") from e
        raise


@router.post("/{path_id}/frequency")
async def log_freq(
    path_id: str, body: LogFrequencyRequest, authorization: str = Header(None)
):
    user_id = get_user_id_from_token(authorization)
    try:
        return await log_frequency(user_id, path_id, body.count)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/{path_id}/advance-phase")
async def advance(path_id: str, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    try:
        return await advance_phase(user_id, path_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.delete("/{path_id}")
async def delete_quit(path_id: str, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    return await delete_quit_path(user_id, path_id)


@router.patch("/{path_id}/trigger-profile")
async def update_trigger(
    path_id: str, body: UpdateTriggerProfileRequest, authorization: str = Header(None)
):
    user_id = get_user_id_from_token(authorization)
    try:
        return await update_quit_schedule(
            user_id, path_id, body.trigger_contexts, body.awareness_level
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
