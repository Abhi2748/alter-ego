"""
Quit path creation, phase transitions, mission generation, frequency logging.
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.agents.quit_insight_agent import generate_quit_insight
from app.agents.quit_mission_agent import generate_quit_missions
from app.agents.quit_profile_agent import analyse_quit_profile
from app.core.constants import MISSION_PF, mission_xp_for_type
from app.core.supabase_client import supabase_admin
from app.services.mission_service import get_user_date

logger = logging.getLogger(__name__)


def _get_initials(name: str) -> str:
    words = name.strip().split()
    if len(words) >= 2:
        return (words[0][0] + words[1][0]).upper()
    return (name.strip()[:2] or "??").upper()


def _normalize_habit(name: str) -> str:
    return name.strip().lower().replace(" ", "_").replace("-", "_")


def _user_timezone(user_id: str) -> str:
    row = (
        supabase_admin.table("users")
        .select("timezone")
        .eq("id", user_id)
        .single()
        .execute()
        .data
        or {}
    )
    return str(row.get("timezone") or "UTC")


def _recent_quit_missions_with_ratings(user_id: str, path_id: str) -> list[dict]:
    missions = (
        supabase_admin.table("missions")
        .select("id,title")
        .eq("user_id", user_id)
        .eq("quit_path_id", path_id)
        .order("created_at", desc=True)
        .limit(5)
        .execute()
        .data
        or []
    )
    out: list[dict] = []
    for m in missions:
        mid = m["id"]
        rr = (
            supabase_admin.table("mission_ratings")
            .select("rating")
            .eq("mission_id", mid)
            .limit(1)
            .execute()
            .data
            or []
        )
        out.append(
            {
                "title": m.get("title"),
                "difficulty_rating": rr[0].get("rating") if rr else None,
            }
        )
    return out


async def create_quit_path(
    user_id: str,
    habit_name: str,
    trigger_contexts: list[str],
    awareness_level: str,
    quit_goal: str,
) -> dict[str, Any]:
    profile = await analyse_quit_profile(
        habit_name=habit_name,
        trigger_contexts=trigger_contexts,
        awareness_level=awareness_level,
        quit_goal=quit_goal,
    )

    starting_phase = "disruption" if profile.skip_mapping_phase else "mapping"

    status = "referral_only" if profile.requires_professional_referral else "active"
    if profile.requires_professional_referral:
        logger.warning(
            "QuitPath user=%s habit=%s flagged referral_only",
            user_id,
            habit_name,
        )

    row = {
        "user_id": user_id,
        "habit_name": habit_name,
        "habit_normalized": _normalize_habit(habit_name),
        "initials": _get_initials(habit_name),
        "trigger_contexts": trigger_contexts,
        "awareness_level": awareness_level,
        "quit_goal": quit_goal,
        "underlying_need": profile.underlying_need,
        "need_description": profile.need_description,
        "current_phase": starting_phase,
        "phase_started_at": datetime.now(timezone.utc).isoformat(),
        "mapping_complete": bool(profile.skip_mapping_phase),
        "disruption_complete": False,
        "frequency_unit": profile.frequency_unit,
        "intervention_hour": profile.intervention_hour,
        "phase_1_focus": profile.phase_1_focus,
        "competing_response": profile.competing_response,
        "requires_professional_referral": profile.requires_professional_referral,
        "referral_message": profile.referral_message or "",
        "status": status,
    }

    result = supabase_admin.table("quit_paths").insert(row).execute()
    if not result.data:
        raise RuntimeError("Failed to insert quit_paths row")
    path_id = result.data[0]["id"]
    return {"path_id": path_id, "starting_phase": starting_phase, "status": status}


async def generate_quit_missions_for_today(
    user_id: str,
    path_id: str,
    mission_date: str | None = None,
) -> list[dict]:
    tz = _user_timezone(user_id)
    md = mission_date or get_user_date(tz)

    path_res = (
        supabase_admin.table("quit_paths")
        .select("*")
        .eq("id", path_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    path = path_res.data
    if not path or path.get("status") != "active":
        return []

    existing = (
        supabase_admin.table("missions")
        .select("id")
        .eq("user_id", user_id)
        .eq("quit_path_id", path_id)
        .eq("mission_date", md)
        .limit(1)
        .execute()
        .data
        or []
    )
    if existing:
        return []

    user_row = (
        supabase_admin.table("users")
        .select("archetype")
        .eq("id", user_id)
        .single()
        .execute()
        .data
        or {}
    )
    archetype = str(user_row.get("archetype") or "structured_climber")

    recent = _recent_quit_missions_with_ratings(user_id, path_id)

    freq_log = (
        supabase_admin.table("quit_frequency_log")
        .select("count")
        .eq("quit_path_id", path_id)
        .eq("log_date", md)
        .limit(1)
        .execute()
        .data
        or []
    )
    frequency_today = int(freq_log[0]["count"]) if freq_log else 0

    phase_started = path.get("phase_started_at") or path["created_at"]
    phase_started_dt = datetime.fromisoformat(str(phase_started).replace("Z", "+00:00"))
    days_in_phase = (datetime.now(timezone.utc) - phase_started_dt).days

    batch = await generate_quit_missions(
        habit_name=path["habit_name"],
        underlying_need=path["underlying_need"],
        current_phase=path["current_phase"],
        trigger_contexts=path.get("trigger_contexts") or [],
        awareness_level=path["awareness_level"],
        competing_response=path.get("competing_response") or "",
        phase_1_focus=path.get("phase_1_focus") or "",
        recent_missions=recent,
        frequency_today=frequency_today,
        frequency_baseline=path.get("frequency_baseline"),
        days_in_phase=days_in_phase,
        archetype=archetype,
    )

    missions: list[dict] = []
    for m in batch.missions:
        diff = str(m.difficulty).lower()
        if diff not in ("easy", "medium", "hard"):
            diff = "easy"
        missions.append(
            {
                "user_id": user_id,
                "type": "resistance",
                "title": m.title,
                "description": m.description,
                "difficulty": diff,
                "xp_value": mission_xp_for_type("resistance", diff),
                "pf_value": MISSION_PF["resistance"].get(diff, 8),
                "mission_date": md,
                "completed": False,
                "stat_tag": "willpower",
                "quit_path_id": path_id,
                "mission_category": m.mission_category,
                "underlying_need": path["underlying_need"],
                "rationale": m.rationale,
                "estimated_minutes": m.estimated_minutes,
                "domain_knowledge": m.description,
            }
        )
    return missions


async def log_frequency(user_id: str, path_id: str, count: int) -> dict[str, Any]:
    tz = _user_timezone(user_id)
    today = get_user_date(tz)

    path_res = (
        supabase_admin.table("quit_paths")
        .select("frequency_unit,frequency_baseline,current_phase")
        .eq("id", path_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    path = path_res.data
    if not path:
        raise ValueError("Quit path not found")

    unit = path.get("frequency_unit") or "times"
    supabase_admin.table("quit_frequency_log").upsert(
        {
            "user_id": user_id,
            "quit_path_id": path_id,
            "log_date": today,
            "count": count,
            "unit": unit,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="quit_path_id,log_date",
    ).execute()

    supabase_admin.table("quit_paths").update(
        {
            "frequency_today": count,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", path_id).execute()

    baseline = path.get("frequency_baseline")
    if baseline and float(baseline) > 0:
        seven_ago = (date.fromisoformat(today) - timedelta(days=7)).isoformat()
        logs = (
            supabase_admin.table("quit_frequency_log")
            .select("count")
            .eq("quit_path_id", path_id)
            .gte("log_date", seven_ago)
            .execute()
            .data
            or []
        )
        if logs:
            avg = sum(int(l["count"]) for l in logs) / len(logs)
            reduction_pct = max(0, round((1 - avg / float(baseline)) * 100))
            supabase_admin.table("quit_paths").update({"frequency_reduction_pct": reduction_pct}).eq(
                "id", path_id
            ).execute()

    return {"logged": True, "count": count, "date": today}


async def advance_phase(user_id: str, path_id: str) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()

    path_res = (
        supabase_admin.table("quit_paths")
        .select("*")
        .eq("id", path_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    path = path_res.data
    if not path:
        raise ValueError("Quit path not found")

    current = path["current_phase"]
    phase_map = {"mapping": "disruption", "disruption": "consolidation"}

    if current not in phase_map:
        return {"advanced": False, "message": "Already in consolidation phase"}

    next_phase = phase_map[current]

    seven_ago = (date.today() - timedelta(days=7)).isoformat()
    logs = (
        supabase_admin.table("quit_frequency_log")
        .select("count")
        .eq("quit_path_id", path_id)
        .gte("log_date", seven_ago)
        .execute()
        .data
        or []
    )
    freq_at_transition = sum(int(l["count"]) for l in logs) / len(logs) if logs else None

    if current == "mapping" and not path.get("frequency_baseline") and freq_at_transition is not None:
        supabase_admin.table("quit_paths").update({"frequency_baseline": freq_at_transition}).eq(
            "id", path_id
        ).execute()
        path["frequency_baseline"] = freq_at_transition

    phase_started = path.get("phase_started_at") or path["created_at"]
    phase_started_dt = datetime.fromisoformat(str(phase_started).replace("Z", "+00:00"))
    days_in_phase = (datetime.now(timezone.utc) - phase_started_dt).days

    insight = await generate_quit_insight(
        habit_name=path["habit_name"],
        completed_phase=current,
        underlying_need=path["underlying_need"],
        awareness_level=path["awareness_level"],
        trigger_contexts=path.get("trigger_contexts") or [],
        days_in_phase=days_in_phase,
        frequency_baseline=path.get("frequency_baseline"),
        frequency_at_transition=freq_at_transition,
    )

    supabase_admin.table("quit_insights").insert(
        {
            "quit_path_id": path_id,
            "user_id": user_id,
            "phase": current,
            "title": insight.title,
            "body": insight.body,
        }
    ).execute()

    update_payload: dict[str, Any] = {
        "current_phase": next_phase,
        "phase_started_at": now,
        "updated_at": now,
    }
    if current == "mapping":
        update_payload["mapping_complete"] = True
    elif current == "disruption":
        update_payload["disruption_complete"] = True

    supabase_admin.table("quit_paths").update(update_payload).eq("id", path_id).execute()

    return {
        "advanced": True,
        "new_phase": next_phase,
        "insight": {"title": insight.title, "body": insight.body},
    }


async def get_quits_for_user(user_id: str) -> list[dict[str, Any]]:
    tz = _user_timezone(user_id)
    today = get_user_date(tz)

    paths = (
        supabase_admin.table("quit_paths")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
        .data
        or []
    )

    result: list[dict[str, Any]] = []
    for path in paths:
        pid = path["id"]
        seven_ago = (date.fromisoformat(today) - timedelta(days=7)).isoformat()
        freq_history = (
            supabase_admin.table("quit_frequency_log")
            .select("log_date,count,unit")
            .eq("quit_path_id", pid)
            .gte("log_date", seven_ago)
            .order("log_date")
            .execute()
            .data
            or []
        )

        today_missions = (
            supabase_admin.table("missions")
            .select("id,title,description,completed_at,mission_category")
            .eq("user_id", user_id)
            .eq("quit_path_id", pid)
            .eq("mission_date", today)
            .execute()
            .data
            or []
        )

        insights = (
            supabase_admin.table("quit_insights")
            .select("id,phase,title,body,unlocked_at,created_at")
            .eq("quit_path_id", pid)
            .order("created_at")
            .execute()
            .data
            or []
        )

        today_log = (
            supabase_admin.table("quit_frequency_log")
            .select("count")
            .eq("quit_path_id", pid)
            .eq("log_date", today)
            .limit(1)
            .execute()
            .data
            or []
        )
        freq_today = int(today_log[0]["count"]) if today_log else int(path.get("frequency_today") or 0)

        created_day = str(path["created_at"])[:10]
        try:
            days_active = (date.fromisoformat(today) - date.fromisoformat(created_day)).days
        except Exception:
            days_active = 0

        phase_done = sum(1 for m in today_missions if m.get("completed_at"))
        result.append(
            {
                "path_id": pid,
                "habit_name": path["habit_name"],
                "habit_normalized": path["habit_normalized"],
                "initials": path["initials"],
                "trigger_profile": {
                    "contexts": path.get("trigger_contexts") or [],
                    "awareness": path["awareness_level"],
                    "quit_goal": path["quit_goal"],
                },
                "underlying_need": path["underlying_need"],
                "need_description": path.get("need_description"),
                "current_phase": path["current_phase"],
                "frequency_unit": path["frequency_unit"],
                "frequency_today": freq_today,
                "frequency_history": freq_history,
                "frequency_baseline": path.get("frequency_baseline"),
                "frequency_reduction_pct": int(path.get("frequency_reduction_pct") or 0),
                "days_active": days_active,
                "missions": [
                    {
                        "id": m["id"],
                        "title": m["title"],
                        "description": m.get("description") or "",
                        "completed": bool(m.get("completed_at")),
                        "mission_category": m.get("mission_category") or "observation",
                    }
                    for m in today_missions
                ],
                "insights": [
                    {
                        "id": i["id"],
                        "phase": i.get("phase"),
                        "title": i["title"],
                        "body": i["body"],
                        "unlocked_at": i.get("unlocked_at"),
                    }
                    for i in insights
                ],
                "status": path["status"],
                "requires_professional_referral": bool(path.get("requires_professional_referral")),
                "referral_message": path.get("referral_message") or "",
                "phase_missions_completed": phase_done,
                "total_phase_days": 14,
            }
        )

    return result


async def delete_quit_path(user_id: str, path_id: str) -> dict[str, bool]:
    supabase_admin.table("quit_paths").delete().eq("id", path_id).eq("user_id", user_id).execute()
    return {"deleted": True}


async def update_quit_schedule(
    user_id: str,
    path_id: str,
    trigger_contexts: list[str],
    awareness_level: str,
) -> dict[str, bool]:
    path_res = (
        supabase_admin.table("quit_paths")
        .select("*")
        .eq("id", path_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    path = path_res.data
    if not path:
        raise ValueError("Quit path not found")

    profile = await analyse_quit_profile(
        habit_name=path["habit_name"],
        trigger_contexts=trigger_contexts,
        awareness_level=awareness_level,
        quit_goal=path["quit_goal"],
    )

    if profile.requires_professional_referral:
        logger.info(
            json.dumps(
                {
                    "event": "quit_profile_referral_required",
                    "user_id": user_id,
                    "habit_preview": (str(path.get("habit_name") or ""))[:30],
                }
            )
        )

    update_payload: dict[str, Any] = {
        "trigger_contexts": trigger_contexts,
        "awareness_level": awareness_level,
        "underlying_need": profile.underlying_need,
        "need_description": profile.need_description,
        "competing_response": profile.competing_response,
        "phase_1_focus": profile.phase_1_focus,
        "intervention_hour": profile.intervention_hour,
        "requires_professional_referral": profile.requires_professional_referral,
        "referral_message": profile.referral_message or "",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if profile.requires_professional_referral:
        update_payload["status"] = "referral_only"
    elif path.get("status") == "referral_only":
        update_payload["status"] = "active"

    supabase_admin.table("quit_paths").update(update_payload).eq("id", path_id).execute()

    return {"updated": True}


async def sync_quit_path_missions_for_date(user_id: str, mission_date: str) -> None:
    paths = (
        supabase_admin.table("quit_paths")
        .select("id")
        .eq("user_id", user_id)
        .eq("status", "active")
        .execute()
        .data
        or []
    )
    for p in paths:
        try:
            rows = await generate_quit_missions_for_today(user_id, p["id"], mission_date)
            if rows:
                supabase_admin.table("missions").insert(rows).execute()
                logger.info(
                    "sync_quit_path_missions: user=%s path=%s inserted=%s",
                    user_id,
                    p["id"],
                    len(rows),
                )
        except Exception:
            logger.exception(
                "sync_quit_path_missions failed user=%s path=%s",
                user_id,
                p.get("id"),
            )
