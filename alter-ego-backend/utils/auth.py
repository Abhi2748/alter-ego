"""Auth helpers: get current user from Supabase JWT (Bearer token)."""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os

security = HTTPBearer(auto_error=False)

def get_optional_user_id(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[str]:
    """Return user id (sub) from Bearer JWT if present and valid; else None."""
    if not credentials:
        return None
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        return None
    try:
        import jwt
        payload = jwt.decode(
            credentials.credentials,
            secret,
            algorithms=["HS256"],
            options={"verify_aud": False, "verify_exp": True},
        )
        return payload.get("sub")
    except Exception:
        return None

def get_user_id(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> str:
    """Require authenticated user; raise 401 if missing."""
    user_id = get_optional_user_id(credentials)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user_id
