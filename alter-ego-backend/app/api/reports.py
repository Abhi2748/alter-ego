"""
Reports API — weekly report and day summary.
B29: Weekly report available after Sunday 03:00 UTC.
B30: Day summary generated nightly or on demand.
"""

from datetime import date, timedelta

from fastapi import APIRouter, Header

from app.api.auth import get_user_id_from_token
from app.agents.report_agent import generate_day_summary
from app.core.supabase_client import supabase_admin

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


@router.get("/weekly", response_model=dict)
async def get_weekly_report(authorization: str = Header(None)):
    """
    Returns the current week's report.
    Generated Sunday morning — available all day.
    If no report exists yet, returns a 'not_yet_available' response.
    """
    user_id = get_user_id_from_token(authorization)

    today = date.today()
    week_end = today - timedelta(days=(today.weekday() + 1))
    week_start = week_end - timedelta(days=6)

    result = (
        supabase_admin.table("weekly_reports")
        .select("*")
        .eq("user_id", user_id)
        .eq("week_start", str(week_start))
        .execute()
        .data
    )

    if not result:
        return {
            "available": False,
            "message": "Your weekly report will be ready this Sunday.",
        }

    report = result[0]
    return {
        "available": True,
        "week_start": report["week_start"],
        "week_end": report["week_end"],
        "this_week_data": report["this_week_data"],
        "wins": report["wins"],
        "slipped": report.get("slipped", []),
        "keep_watching": report.get("keep_watching", []),
        "twin_paragraph": report["twin_paragraph"],
        "twin_closing": report["twin_closing"],
        "next_week": report["next_week"],
        "generated_at": report.get("generated_at"),
    }


@router.get("/weekly/previous", response_model=dict)
async def get_previous_weekly_report(authorization: str = Header(None)):
    """Returns the previous week's report."""
    user_id = get_user_id_from_token(authorization)

    result = (
        supabase_admin.table("weekly_reports")
        .select("*")
        .eq("user_id", user_id)
        .order("week_start", desc=True)
        .limit(2)
        .execute()
        .data
        or []
    )

    if len(result) < 2:
        return {"available": False}

    report = result[1]
    return {"available": True, **report}


@router.get("/day/{date_str}", response_model=dict)
async def get_day_summary_endpoint(
    date_str: str,
    authorization: str = Header(None),
):
    """
    Returns the archive summary for a specific day.
    If not yet generated, generates it on demand.
    date_str format: YYYY-MM-DD
    """
    user_id = get_user_id_from_token(authorization)
    summary = await generate_day_summary(user_id, date_str)
    return {"date": date_str, "summary": summary}
