"""GET /api/v1/sigil — authenticated user's sigil / aether state."""

from fastapi import APIRouter, Header

from app.api.auth import get_user_id_from_token
from app.services.sigil_service import get_sigil_data

router = APIRouter(prefix="/api/v1/sigil", tags=["sigil"])


@router.get("")
async def get_sigil(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    return get_sigil_data(user_id)
