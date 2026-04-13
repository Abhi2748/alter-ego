"""
Seasons API — GET current season, acknowledge completion, begin next season,
and fetch season history.

All routes require a valid JWT (Authorization header).
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Header, HTTPException

from app.api.auth import get_user_id_from_token
from app.core.supabase_client import run_query, supabase_admin
from app.services.season_service import (
    begin_next_season,
    build_season_response,
    close_expired_season,
    ensure_user_has_season,
    get_active_season,
    get_most_recent_season,
    mark_completion_seen,
)

router = APIRouter(prefix="/api/v1/seasons", tags=["seasons"])
logger = logging.getLogger(__name__)


# ── GET /api/v1/seasons/current ───────────────────────────────────────────────

@router.get("/current")
async def get_current_season(authorization: str = Header(None)):
    """
    Returns the user's current season.

    State machine handled here:
      1. If an active season exists and it has expired → close it, return it
         with status='completed' or 'failed' so the frontend shows the result screen.
      2. If a recently completed/failed season exists with completion_seen=False
         → return it (frontend shows completion screen).
      3. If no season exists at all → auto-create Season 1 and return it.
      4. If an active season is still running → return it normally.

    Returns null (HTTP 204) only if season creation fails unexpectedly.
    """
    user_id = get_user_id_from_token(authorization)

    try:
        # Fetch user's timezone and archetype (needed for season creation and date logic)
        user_result = await run_query(
            supabase_admin.table("users")
            .select("timezone, archetype")
            .eq("id", user_id)
            .single()
        )
        user = user_result.data or {}
        timezone_str = user.get("timezone") or "UTC"
        archetype    = user.get("archetype") or ""

        from app.services.mission_service import get_user_date
        today = get_user_date(timezone_str)

        # ── 1. Check for an active season ─────────────────────────────────────
        season = await get_active_season(user_id)

        if season:
            ends_at = str(season.get("ends_at", ""))
            # Season has expired — close it before returning
            if ends_at and today > ends_at:
                season = await close_expired_season(user_id, season, today)
            # Return (active or now-closed)
            return await build_season_response(user_id, season, today)

        # ── 2. Check for an unseen completed/failed season ─────────────────────
        recent = await get_most_recent_season(user_id)
        if recent and recent.get("status") in ("completed", "failed"):
            if not recent.get("completion_seen", False):
                return await build_season_response(user_id, recent, today)

        # ── 3. No season at all — auto-create Season 1 ────────────────────────
        new_season = await ensure_user_has_season(user_id, timezone_str, archetype)
        if not new_season:
            # Creation failed — return 204 so frontend stays on no-season state
            from fastapi.responses import Response
            return Response(status_code=204)

        return await build_season_response(user_id, new_season, today)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_current_season error user=%s: %s", user_id, str(e)[:200])
        raise HTTPException(status_code=500, detail="Failed to load season")


# ── POST /api/v1/seasons/seen ─────────────────────────────────────────────────

@router.post("/seen")
async def mark_season_seen(authorization: str = Header(None)):
    """
    Marks the most recent completed/failed season as seen.
    Called when the user views the SeasonCompletionScreen.
    After this, GET /current will no longer return the completion state —
    it will either show the active next season or create Season 1.
    """
    user_id = get_user_id_from_token(authorization)

    try:
        recent = await get_most_recent_season(user_id)
        if not recent:
            return {"success": False, "reason": "no_season"}

        if recent.get("status") not in ("completed", "failed"):
            return {"success": False, "reason": "season_still_active"}

        await mark_completion_seen(user_id, str(recent["id"]))
        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("mark_season_seen error user=%s: %s", user_id, str(e)[:200])
        raise HTTPException(status_code=500, detail="Failed to mark season seen")


# ── POST /api/v1/seasons/begin-next ──────────────────────────────────────────

@router.post("/begin-next")
async def begin_next(authorization: str = Header(None)):
    """
    Starts the next season after the user acknowledges the completion screen.
    Guards against starting a next season if one is already active.

    Flow:
      1. Verify the most recent season is completed or failed.
      2. Mark it as seen (idempotent — safe if already seen).
      3. Create and return the next season.
    """
    user_id = get_user_id_from_token(authorization)

    try:
        # Guard: must not already have an active season
        active = await get_active_season(user_id)
        if active:
            raise HTTPException(
                status_code=409,
                detail="A season is already active. Cannot begin a new one.",
            )

        recent = await get_most_recent_season(user_id)
        if not recent:
            raise HTTPException(status_code=404, detail="No season found")

        if recent.get("status") not in ("completed", "failed"):
            raise HTTPException(
                status_code=409,
                detail="Current season has not ended yet.",
            )

        # Mark previous season as seen (in case the user skips the completion screen)
        if not recent.get("completion_seen", False):
            await mark_completion_seen(user_id, str(recent["id"]))

        # Fetch timezone for the new season's started_at
        user_result = await run_query(
            supabase_admin.table("users")
            .select("timezone")
            .eq("id", user_id)
            .single()
        )
        timezone_str = (user_result.data or {}).get("timezone") or "UTC"

        current_season_number = int(recent.get("season_number", 1))
        new_season = await begin_next_season(user_id, current_season_number, timezone_str)
        if not new_season:
            raise HTTPException(status_code=500, detail="Failed to create next season")

        from app.services.mission_service import get_user_date
        today = get_user_date(timezone_str)
        return await build_season_response(user_id, new_season, today)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("begin_next error user=%s: %s", user_id, str(e)[:200])
        raise HTTPException(status_code=500, detail="Failed to begin next season")


# ── GET /api/v1/seasons/history ───────────────────────────────────────────────

@router.get("/history")
async def get_season_history(authorization: str = Header(None)):
    """
    Returns all past completed and failed seasons for the Profile Seasons screen.
    Ordered by season_number descending (most recent first).
    Returns a slim response — not the full build_season_response shape.
    """
    user_id = get_user_id_from_token(authorization)

    try:
        result = await run_query(
            supabase_admin.table("user_seasons")
            .select(
                "season_number, season_name, season_color, season_theme, "
                "status, completion_tier, total_days, days_completed, "
                "days_perfect, days_missed, started_at, ends_at, "
                "xp_awarded, title_unlocked"
            )
            .eq("user_id", user_id)
            .in_("status", ["completed", "failed"])
            .order("season_number", desc=True)
        )
        rows = result.data or []
        return {"history": rows, "total": len(rows)}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_season_history error user=%s: %s", user_id, str(e)[:200])
        raise HTTPException(status_code=500, detail="Failed to load season history")
