"""Auth callback (e.g. Supabase webhook or token exchange)."""
from fastapi import APIRouter, Request, Depends
from utils.auth import get_optional_user_id

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/callback")
async def auth_callback(request: Request):
    """Supabase auth webhook or post-login callback. Body depends on Supabase config."""
    body = await request.json()
    # Typically: create or update user profile in public.users
    return {"status": "ok"}
