"""
In-app mail API — list, read, mark read.
"""

from datetime import datetime

from fastapi import APIRouter, Header

from app.api.auth import get_user_id_from_token
from app.core.supabase_client import supabase_admin

router = APIRouter(prefix="/api/v1/mail", tags=["mail"])


@router.get("", response_model=dict)
async def get_mails(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    result = (
        supabase_admin.table("app_mails")
        .select("id, mail_type, subject, body_markdown, sent_at, read_at")
        .eq("user_id", user_id)
        .order("sent_at", desc=True)
        .execute()
        .data
        or []
    )
    unread_count = sum(1 for m in result if m.get("read_at") is None)
    return {"mails": result, "unread_count": unread_count, "total": len(result)}


@router.post("/{mail_id}/read", response_model=dict)
async def mark_mail_read(mail_id: str, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    supabase_admin.table("app_mails").update(
        {"read_at": datetime.utcnow().isoformat()}
    ).eq("id", mail_id).eq("user_id", user_id).execute()
    return {"success": True}


@router.post("/read-all", response_model=dict)
async def mark_all_read(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    supabase_admin.table("app_mails").update(
        {"read_at": datetime.utcnow().isoformat()}
    ).eq("user_id", user_id).is_("read_at", "null").execute()
    return {"success": True}
