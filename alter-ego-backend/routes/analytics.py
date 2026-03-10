"""GET /analytics/day-of-week — completion % per weekday (Mon–Sun) over last 30 days."""
from fastapi import APIRouter, Depends
from utils.auth import get_user_id
from utils.supabase_client import get_supabase
from utils.day_of_week import get_day_of_week_completion

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/day-of-week")
async def get_analytics_day_of_week(user_id: str = Depends(get_user_id)):
    """
    Aggregate streak_log + missions for the requesting user: completion % per day-of-week
    (Mon–Sun) over the last 30 days. Returns [mon_pct, tue_pct, ..., sun_pct] (0–100).
    Used by Weekly Report bar chart and Profile Stats tab.
    """
    supabase = get_supabase()
    values = get_day_of_week_completion(supabase, user_id, days=30)
    return {"day_of_week_completion": values}
