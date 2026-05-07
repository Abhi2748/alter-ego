"""
Auth endpoints.

POST /api/v1/auth/verify-token
  - Receives the Supabase JWT from the mobile app
  - Verifies it is valid
  - Returns the user_id
  - Used by middleware to authenticate every request

POST /api/v1/auth/link-google
  - Called when an anonymous user connects their Google account
  - Supabase handles the actual linking client-side
  - This endpoint updates users.email_connected = true
  - Returns success confirmation

POST /api/v1/auth/link-email
  - Called after a user successfully verifies their email OTP
  - Updates users.email_connected = true and saves email
  - Returns success confirmation

GET /api/v1/auth/me
  - Returns the current user's basic profile
  - Used on app startup to check if onboarding is complete
"""

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.core.supabase_client import run_query, supabase_admin

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# ── Helper: extract and verify JWT from Authorization header ──
def get_user_id_from_token(authorization: str) -> str:
    """
    Verifies a Supabase JWT and returns the user_id.
    Raises HTTPException 401 if invalid.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")

    token = authorization.replace("Bearer ", "")

    try:
        # Use Supabase admin to verify the token
        user_response = supabase_admin.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return str(user_response.user.id)
    except Exception:
        raise HTTPException(status_code=401, detail="Token verification failed")


class VerifyTokenRequest(BaseModel):
    token: str


@router.post("/verify-token", response_model=dict)
async def verify_token(body: VerifyTokenRequest):
    """Verify a Supabase JWT and return the user_id."""
    try:
        user_response = supabase_admin.auth.get_user(body.token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {
            "valid": True,
            "user_id": str(user_response.user.id),
            "is_anonymous": user_response.user.is_anonymous or False,
        }
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/link-google", response_model=dict)
async def link_google(authorization: str = Header(None)):
    """
    Called after an anonymous user successfully links their Google account.
    Updates email_connected = true in the users table.
    """
    user_id = get_user_id_from_token(authorization)

    try:
        # Get user's email from Supabase auth
        user_response = supabase_admin.auth.admin.get_user_by_id(user_id)
        email = user_response.user.email if user_response.user else None

        # Update users table
        update_data = {"email_connected": True}
        if email:
            update_data["email"] = email

        await run_query(supabase_admin.table("users").update(update_data).eq("id", user_id))

        return {"success": True, "email_connected": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/link-email", response_model=dict)
async def link_email(authorization: str = Header(None)):
    """
    Called after a user successfully verifies their email OTP.
    Updates email_connected = true and saves the email in the users table.
    """
    user_id = get_user_id_from_token(authorization)

    try:
        # Get the verified email from Supabase auth
        user_response = supabase_admin.auth.admin.get_user_by_id(user_id)
        email = user_response.user.email if user_response.user else None

        # Update users table
        update_data = {"email_connected": True}
        if email:
            update_data["email"] = email

        await run_query(
            supabase_admin.table("users").update(update_data).eq("id", user_id)
        )

        return {"success": True, "email_connected": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/me", response_model=dict)
async def get_me(authorization: str = Header(None)):
    """
    Returns the current user's basic profile.
    Used on app startup to check session state.
    """
    user_id = get_user_id_from_token(authorization)

    try:
        result = await run_query(
            supabase_admin.table("users")
            .select(
                "id, username, character_stage, onboarding_complete, "
                "subscription_tier, pet_unlocked, leaderboard_unlocked, "
                "email_connected, registration_date"
            )
            .eq("id", user_id)
            .single()
        )

        if not result.data:
            # User exists in auth but not in users table yet
            # This happens right after first sign-in, before onboarding creates the row
            return {
                "exists": False,
                "user_id": user_id,
                "onboarding_complete": False,
            }

        return {"exists": True, "user_id": user_id, **result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

