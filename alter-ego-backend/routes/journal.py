"""POST /journal (save entry), GET /journal (list). Journal is standalone — no Core mission."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from utils.auth import get_user_id
from utils.supabase_client import get_supabase

router = APIRouter(prefix="/journal", tags=["journal"])


class JournalSavePayload(BaseModel):
    date: Optional[str] = None  # YYYY-MM-DD, default today
    content: str


@router.post("")
async def save_journal(payload: JournalSavePayload, user_id: str = Depends(get_user_id)):
    """Save journal entry. Returns saved, date, word_count only."""
    supabase = get_supabase()
    entry_date = date.today()
    if payload.date:
        try:
            entry_date = date.fromisoformat(payload.date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format (use YYYY-MM-DD)")
    content = (payload.content or "").strip()
    word_count = len(content.split()) if content else 0

    supabase.table("journal_entries").upsert(
        {
            "user_id": user_id,
            "date": entry_date.isoformat(),
            "content": content,
            "word_count": word_count,
        },
        on_conflict="user_id,date",
    ).execute()

    return {
        "saved": True,
        "date": entry_date.isoformat(),
        "word_count": word_count,
    }


@router.get("")
async def list_journal(
    user_id: str = Depends(get_user_id),
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 50,
):
    """List journal entries. Optional from_date/to_date (YYYY-MM-DD). Most recent first."""
    supabase = get_supabase()
    q = supabase.table("journal_entries").select("date, content, word_count, created_at").eq("user_id", user_id).order("date", desc=True).limit(limit)
    if from_date:
        q = q.gte("date", from_date)
    if to_date:
        q = q.lte("date", to_date)
    r = q.execute()
    entries = [{"date": e["date"], "content": e["content"], "word_count": e.get("word_count", 0), "created_at": e.get("created_at")} for e in (r.data or [])]
    return {"entries": entries}
