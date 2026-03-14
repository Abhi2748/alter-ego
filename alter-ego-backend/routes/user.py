"""GET /user/me, PATCH /user/me, DELETE /user/account — profile and account deletion."""
from fastapi import APIRouter, Depends
from utils.auth import get_user_id
from utils.supabase_client import get_supabase
from models.user import UserMeOut, UserMeUpdate

router = APIRouter(prefix="/user", tags=["user"])


@router.get("/me", response_model=UserMeOut)
async def get_user_me(user_id: str = Depends(get_user_id)):
    supabase = get_supabase()
    r = (
        supabase.table("users")
        .select("id, email, username, created_at, archetype, trial_start_date, subscription_status, nudge_frequency")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not r.data:
        return UserMeOut(id=user_id)
    row = r.data
    return UserMeOut(
        id=row.get("id", user_id),
        email=row.get("email"),
        username=row.get("username"),
        created_at=row.get("created_at"),
        archetype=row.get("archetype"),
        trial_start_date=row.get("trial_start_date"),
        subscription_status=row.get("subscription_status"),
        nudge_frequency=row.get("nudge_frequency"),
    )


@router.patch("/me")
async def patch_user_me(payload: UserMeUpdate, user_id: str = Depends(get_user_id)):
    supabase = get_supabase()
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return {"success": True}
    supabase.table("users").update(updates).eq("id", user_id).execute()
    return {"success": True}


@router.delete("/account")
async def delete_account(user_id: str = Depends(get_user_id)):
    """Permanently delete the user's auth account. Cascade removes public rows (users, missions, etc.)."""
    supabase = get_supabase()
    try:
        supabase.auth.admin.delete_user(id=user_id)
    except Exception as e:
        raise RuntimeError(f"Could not delete account: {e}") from e
    return {"success": True}
