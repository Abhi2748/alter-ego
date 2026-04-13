"""
Achievements API — GET /api/v1/achievements
Returns the full achievement catalog with earned state for the requesting user.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Header, HTTPException

from app.api.auth import get_user_id_from_token
from app.services.achievement_service import build_achievements_response

router = APIRouter(prefix="/api/v1/achievements", tags=["achievements"])
logger = logging.getLogger(__name__)


@router.get("")
async def get_achievements(authorization: str = Header(None)):
    """
    Returns the full achievement catalog with earned/locked state per item.
    Featured field contains the most recently earned achievement, or null.
    """
    user_id = get_user_id_from_token(authorization)
    try:
        return await build_achievements_response(user_id)
    except Exception as e:
        logger.error("get_achievements error user=%s: %s", user_id, str(e)[:200])
        raise HTTPException(status_code=500, detail="Failed to load achievements")
