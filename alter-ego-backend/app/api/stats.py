"""Character stats (abilities / SP) — GET full profile."""

from fastapi import APIRouter, Header

from app.api.auth import get_user_id_from_token
from app.services.stat_service import get_stats_for_user

router = APIRouter(prefix="/api/v1/stats", tags=["stats"])


@router.get("")
async def get_character_stats(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    return await get_stats_for_user(user_id)
