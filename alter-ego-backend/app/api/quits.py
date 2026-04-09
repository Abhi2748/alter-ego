from __future__ import annotations

from fastapi import APIRouter, Body, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.api.auth import get_user_id_from_token
from app.core.supabase_client import run_query, supabase_admin
from app.services.quit_service import (
    advance_phase,
    create_quit_path,
    delete_quit_path,
    get_quits_for_user,
    log_frequency,
    mark_quit_conquered,
    update_quit_schedule,
)

router = APIRouter(prefix="/api/v1/quits", tags=["quits"])


class LogFrequencyRequest(BaseModel):
    count: int


class ConquerQuitRequest(BaseModel):
    """Self-declared habit conquest. No validation needed — user's own assessment."""

    pass


class UpdateTriggerProfileRequest(BaseModel):
    trigger_contexts: list[str]
    awareness_level: str


class CreateQuitPathRequest(BaseModel):
    habit_name: str = Field(..., min_length=1)
    trigger_contexts: list[str] = Field(default_factory=list)
    awareness_level: str = "semi_conscious"
    quit_goal: str = "stop_completely"


class CheckinBody(BaseModel):
    """Quit path check-in payload. All fields optional; service validates and stores."""

    model_config = ConfigDict(extra="ignore")

    checkin_type: str | None = None
    context_tags: list[str] | None = None
    urge_level: str | None = None
    free_text: str | None = None


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
    except ValueError as e:
        msg = str(e).lower()
        if "duplicate" in msg:
            raise HTTPException(
                status_code=409,
                detail="You already have a path for this habit.",
            ) from e
        if "self_harm" in msg:
            raise HTTPException(
                status_code=400,
                detail="We can't add this habit in the app. Please reach out to someone who can help.",
            ) from e
        if "too short" in msg:
            raise HTTPException(status_code=400, detail="Name is too short.") from e
        if "rejected" in msg or "quit_target" in msg:
            raise HTTPException(
                status_code=400,
                detail="We couldn't add this quit target. Try a clearer description.",
            ) from e
        raise HTTPException(status_code=400, detail=str(e)) from e
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


@router.post("/{path_id}/conquer")
async def conquer_quit(
    path_id: str,
    _body: ConquerQuitRequest = Body(default_factory=ConquerQuitRequest),
    authorization: str = Header(None),
):
    """
    User declares they have conquered this habit.
    Sets status = 'completed', records the date, returns milestone data
    for the frontend to display the Conquered milestone modal.
    Does NOT delete the path — it stays visible as a trophy.
    """
    user_id = get_user_id_from_token(authorization)
    try:
        return await mark_quit_conquered(user_id, path_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


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


@router.post("/{path_id}/checkin")
async def log_checkin(
    path_id: str,
    body: CheckinBody,
    authorization: str = Header(None),
):
    """
    Store a trigger check-in. All fields optional — partial data is stored as-is.
    Never blocks: if checkin_type is invalid or data is empty, store nothing and return ok.
    """
    user_id = get_user_id_from_token(authorization)
    try:
        from app.services.quit_checkin_service import store_checkin

        await store_checkin(
            user_id=user_id,
            quit_path_id=path_id,
            checkin_type=body.checkin_type,
            context_tags=body.context_tags or [],
            urge_level=body.urge_level,
            free_text=body.free_text,
        )
    except Exception:
        pass  # Never block on check-in failure
    return {"ok": True}


@router.get("/{path_id}/trigger-profile")
async def get_trigger_profile(path_id: str, authorization: str = Header(None)):
    """Returns the living trigger profile for a quit path."""
    user_id = get_user_id_from_token(authorization)
    res = await run_query(
        supabase_admin.table("quit_paths")
        .select("trigger_contexts")
        .eq("id", path_id)
        .eq("user_id", user_id)
        .limit(1)
    )
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Not found")
    row = rows[0]
    from app.services.quit_service import _build_living_trigger_profile

    return _build_living_trigger_profile(
        path_id=path_id,
        original_contexts=row.get("trigger_contexts") or [],
    )


@router.get("/{path_id}/urge-trend")
async def get_urge_trend(path_id: str, authorization: str = Header(None)):
    """Returns weekly urge levels over time for charting."""
    user_id = get_user_id_from_token(authorization)
    res = await run_query(
        supabase_admin.table("quit_paths")
        .select("id")
        .eq("id", path_id)
        .eq("user_id", user_id)
        .limit(1)
    )
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Not found")
    from app.services.quit_service import _build_living_trigger_profile

    profile = _build_living_trigger_profile(path_id=path_id, original_contexts=[])
    return {"urge_trend": profile["urge_trend"]}
