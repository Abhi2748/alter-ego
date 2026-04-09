"""
Reports API — weekly report and day summary.
B29: Weekly report generated Sunday 03:00 in the user's timezone.
B30: Day summary generated ~01:00 local or on demand.
"""

import logging

from fastapi import APIRouter, Header, Request

from datetime import datetime, timezone as dt_timezone

from zoneinfo import ZoneInfo

from app.api.auth import get_user_id_from_token
from app.agents.report_agent import generate_day_summary, generate_weekly_report
from app.core.rate_limit import limiter
from app.core.supabase_client import run_query, supabase_admin
from app.services.mission_service import local_completed_week_bounds
from app.services.report_service import weekly_report_week_eligible

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


@router.get("/weekly", response_model=dict)
@limiter.limit("5/minute")
async def get_weekly_report(request: Request, authorization: str = Header(None)):
    """
    Returns the current week's report.
    Generated Sunday morning — available all day.
    If no report exists yet, returns a 'not_yet_available' response.
    """
    user_id = get_user_id_from_token(authorization)

    user_row = (
        ((await run_query(
        supabase_admin.table("users")
        .select("timezone, registration_date")
        .eq("id", user_id)
        .single()
        )).data)
        or {}
    )
    tz_str = str(user_row.get("timezone") or "UTC")
    week_start, week_end = local_completed_week_bounds(tz_str)
    try:
        tz = ZoneInfo(tz_str)
    except Exception:
        tz = dt_timezone.utc
    now_local = datetime.now(tz)

    can_generate = weekly_report_week_eligible(
        user_row.get("registration_date"),
        tz_str,
        week_start,
        week_end,
        now_local=now_local,
    )

    result = (
        ((await run_query(
        supabase_admin.table("weekly_reports")
        .select("*")
        .eq("user_id", user_id)
        .eq("week_start", str(week_start))
        )).data)
    )

    if not result and can_generate:
        try:
            await generate_weekly_report(user_id)
            result = (
                ((await run_query(
                supabase_admin.table("weekly_reports")
                .select("*")
                .eq("user_id", user_id)
                .eq("week_start", str(week_start))
                )).data)
            )
        except Exception as e:
            logger.warning(
                "weekly report on-demand generate failed user=%s: %s",
                user_id,
                str(e)[:200],
            )

    if not result:
        return {
            "available": False,
            "message": "Your first weekly report arrives Sunday evening after your first full week.",
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


@router.get("/weekly/detail/{report_id}", response_model=dict)
async def get_weekly_report_by_id(
    report_id: str,
    authorization: str = Header(None),
):
    """Returns one weekly report row by primary key (for Past Report detail)."""
    user_id = get_user_id_from_token(authorization)
    result = (
        ((await run_query(
        supabase_admin.table("weekly_reports")
        .select("*")
        .eq("id", report_id)
        .eq("user_id", user_id)
        .limit(1)
        )).data)
    )
    if not result:
        return {"available": False, "message": "Report not found."}
    report = result[0]
    return {
        "available": True,
        "id": report.get("id"),
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
        ((await run_query(
        supabase_admin.table("weekly_reports")
        .select("*")
        .eq("user_id", user_id)
        .order("week_start", desc=True)
        .limit(2)
        )).data)
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
