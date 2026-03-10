"""Agent routes: Profiler (J1), Planner (J2), Nudge (J3), Weekly Report (J5), Oracle Line (stubs)."""
import os
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from utils.auth import get_user_id
from utils.supabase_client import get_supabase
from agents.profiler import run_profiler
from agents.planner_agent import plan_interest_and_escaper_missions, run_difficulty_adaptation
from agents.nudge_agent import run_nudge_pass, run_nudge_for_user
from agents.report_agent import run_report_pass, get_report_week, run_report_for_user

router = APIRouter(prefix="/agents", tags=["agents"])


class ProfilerPayload(BaseModel):
    """Optional onboarding answers, used on Day 0. For recalibration, body can be empty."""

    answers: Optional[Dict[str, Any]] = None


@router.post("/profile")
async def post_agents_profile(payload: ProfilerPayload | None = None, user_id: str = Depends(get_user_id)):
    """
    Profiler J1: run on Day 0 (onboarding), Day 10, then every 14 days.

    - Input: optional onboarding answers + last ~10 days of behaviour from DB
    - Output: updated discipline_dna JSONB, persisted on users table
    """
    onboarding_answers = (payload.answers if payload else None) or None
    new_dna = run_profiler(user_id=user_id, onboarding_answers=onboarding_answers)

    supabase = get_supabase()
    supabase.table("users").update({"discipline_dna": new_dna}).eq("id", user_id).execute()

    return {"status": "ok", "discipline_dna": new_dna}

@router.post("/plan")
async def post_agents_plan(user_id: str = Depends(get_user_id)):
    """
    Planner J2: nightly job.

    Input (implicit via DB):
    - discipline_dna (for future tier tuning)
    - interests[]
    - quit_targets[]
    - daily_hours
    - completion_history (used inside the agent)

    Output:
    - Inserts Interest missions + Escaper (recovery) missions into missions table.
    """
    run_difficulty_adaptation(user_id)
    supabase = get_supabase()

    ur = (
        supabase.table("users")
        .select("interests, quit_targets")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    data = ur.data or {}
    interests = data.get("interests") or []
    quit_targets = data.get("quit_targets") or []

    mission_rows = plan_interest_and_escaper_missions(
        user_id=user_id,
        interests=list(interests),
        quit_targets=list(quit_targets),
    )
    inserted = []
    if mission_rows:
        result = supabase.table("missions").insert(mission_rows).execute()
        inserted = result.data or []

    return {"status": "ok", "missions_created": len(mission_rows), "inserted_count": len(inserted)}

def _require_nudge_cron_secret(x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret")):
    """Require NUDGE_CRON_SECRET for nudge/run. No auth for cron callers."""
    secret = os.environ.get("NUDGE_CRON_SECRET")
    if not secret or x_cron_secret != secret:
        raise HTTPException(status_code=403, detail="Invalid or missing cron secret")


@router.post("/nudge/run")
async def post_agents_nudge_run(_: None = Depends(_require_nudge_cron_secret)):
    """
    Nudge J3: run twice daily (e.g. 9am + 7pm). Call from cron with header X-Cron-Secret.
    For each user with push_token, if local time is in 7–11am or 5–9:59pm, runs decision tree
    and sends at most one nudge per call (priority order). Respects nudge_frequency.
    """
    result = run_nudge_pass()
    return {"status": "ok", "sent": result["sent"], "skipped": result["skipped"], "errors": result["errors"]}


@router.post("/nudge")
async def post_agents_nudge(user_id: str = Depends(get_user_id)):
    """
    Nudge J3: run for current user only (e.g. for testing). Same rules: only sends if in window
    and a trigger fires.
    """
    supabase = get_supabase()
    ur = supabase.table("users").select("timezone").eq("id", user_id).maybe_single().execute()
    tz = (ur.data or {}).get("timezone") or "UTC"
    ok, trigger, err = run_nudge_for_user(user_id, tz_str=tz)
    if ok:
        return {"status": "ok", "sent": True, "trigger": trigger}
    return {"status": "ok", "sent": False, "reason": err or "no_trigger"}

def _require_report_cron_secret(x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret")):
    secret = os.environ.get("REPORT_CRON_SECRET") or os.environ.get("NUDGE_CRON_SECRET")
    if not secret or x_cron_secret != secret:
        raise HTTPException(status_code=403, detail="Invalid or missing cron secret")


@router.post("/weekly-report/run")
async def post_agents_weekly_report_run(_: None = Depends(_require_report_cron_secret)):
    """
    Weekly Report J5: run Monday 03:00 UTC. Call from cron with X-Cron-Secret.
    Generates report for Mon–Sun of the week that ended Sunday (yesterday); stores in weekly_reports; sends report tease push.
    """
    result = run_report_pass()
    return {"status": "ok", "generated": result["generated"], "errors": result["errors"], "week_start": result["week_start"], "week_end": result["week_end"]}


@router.get("/weekly-report")
async def get_agents_weekly_report(user_id: str = Depends(get_user_id)):
    """Return the latest weekly report for the current user (Report tab). Optionally include previous week."""
    supabase = get_supabase()
    r = (
        supabase.table("weekly_reports")
        .select("*")
        .eq("user_id", user_id)
        .order("week_start", desc=True)
        .limit(2)
        .execute()
    )
    rows = r.data or []
    if not rows:
        return {"report": None, "last_week": None}
    report = rows[0]
    last_week = rows[1] if len(rows) > 1 else None
    return {"report": report, "last_week": last_week}


@router.post("/weekly-report")
async def post_agents_weekly_report(user_id: str = Depends(get_user_id)):
    """Weekly Report J5: generate report for current user only (e.g. for testing)."""
    week_start, week_end = get_report_week()
    ok, err = run_report_for_user(user_id, week_start, week_end)
    if ok:
        return {"status": "ok", "generated": True, "week_start": week_start.isoformat(), "week_end": week_end.isoformat()}
    return {"status": "error", "generated": False, "message": err or "unknown"}

@router.post("/oracle-line")
async def post_agents_oracle_line(user_id: str = Depends(get_user_id)):
    """Oracle line for report. Stub."""
    return {"status": "ok", "line": ""}
