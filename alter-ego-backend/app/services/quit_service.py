"""
Quit path creation, phase transitions, mission generation, frequency logging.
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from app.agents.interest_normaliser import normalise_quit_target
from app.agents.quit_insight_agent import generate_quit_insight
from app.agents.quit_mission_agent import generate_quit_missions
from app.agents.quit_profile_agent import analyse_quit_profile
from app.core.constants import (
    MAX_QUIT_RESISTANCE_MISSIONS_PER_USER_DAY,
    MISSION_PF,
    mission_xp_for_type,
)
from app.core.supabase_client import supabase_admin, run_query
from app.services.arc_service import ARC_PHASE_LABELS
from app.services.mission_service import get_user_date

logger = logging.getLogger(__name__)


def _build_living_trigger_profile(
    path_id: str,
    original_contexts: list[str],
) -> dict:
    """
    Aggregates quit_checkins data into a living trigger profile.
    Falls back to original trigger_contexts if no check-in data exists.
    Returns:
    {
        "top_triggers": [{"tag": str, "count": int}],  # sorted by count desc, max 6
        "urge_trend": [{"week_label": str, "level": int}],  # last 5 weeks, level 1-5
        "last_slip_context": [str] | None,
        "has_checkin_data": bool,
        "weekly_urge_pending": bool,  # True if no weekly_urge in last 7 days
    }
    """
    try:
        from datetime import date as date_cls, timedelta

        today = date_cls.today()

        # ── Aggregate context_tags from slip_context checkins ──────────────
        slip_rows = (
            supabase_admin.table("quit_checkins")
            .select("context_tags, free_text, created_at")
            .eq("quit_path_id", path_id)
            .eq("checkin_type", "slip_context")
            .order("created_at", desc=True)
            .limit(30)
            .execute()
            .data
            or []
        )

        tag_counts: dict[str, int] = {}
        last_slip_context: list[str] | None = None
        user_context_notes: list[str] = []
        for row in slip_rows:
            tags = row.get("context_tags") or []
            note = str(row.get("free_text") or "").strip()
            if note and len(user_context_notes) < 5:
                user_context_notes.append(note[:200])
            if isinstance(tags, list):
                if last_slip_context is None and tags:
                    last_slip_context = tags
                for tag in tags:
                    t = str(tag).strip().lower()
                    if t:
                        tag_counts[t] = tag_counts.get(t, 0) + 1

        has_checkin_data = bool(tag_counts)

        # Fall back to original contexts if no check-in data
        if not has_checkin_data and original_contexts:
            top_triggers = [{"tag": c, "count": 0} for c in original_contexts[:6]]
        else:
            top_triggers = sorted(
                [{"tag": k, "count": v} for k, v in tag_counts.items()],
                key=lambda x: -x["count"],
            )[:6]

        # ── Urge trend from weekly_urge checkins ───────────────────────────
        # Map urge_level text → int (1=barely_noticed, 5=slipped)
        URGE_LEVEL_MAP = {
            "barely_noticed": 1,
            "manageable": 2,
            "hard": 3,
            "nearly_gave_in": 4,
            "slipped": 5,
        }

        urge_rows = (
            supabase_admin.table("quit_checkins")
            .select("urge_level, created_at")
            .eq("quit_path_id", path_id)
            .eq("checkin_type", "weekly_urge")
            .order("created_at", desc=False)
            .limit(5)
            .execute()
            .data
            or []
        )

        urge_trend: list[dict] = []
        for i, row in enumerate(urge_rows):
            level_text = str(row.get("urge_level") or "manageable").lower()
            level_int = URGE_LEVEL_MAP.get(level_text, 2)
            # Label as W1, W2... relative to first check-in
            urge_trend.append({"week_label": f"W{i+1}", "level": level_int})

        # Pad to show at least current "now" point
        if not urge_trend:
            urge_trend = []  # no data yet — frontend handles empty state

        # ── Weekly urge pending check ──────────────────────────────────────
        seven_days_ago = (today - timedelta(days=7)).isoformat()
        recent_weekly = (
            supabase_admin.table("quit_checkins")
            .select("id")
            .eq("quit_path_id", path_id)
            .eq("checkin_type", "weekly_urge")
            .gte("created_at", seven_days_ago)
            .limit(1)
            .execute()
            .data
            or []
        )
        weekly_urge_pending = len(recent_weekly) == 0

        # ── Competing response adherence pattern ────────────────────────────
        response_rows = (
            supabase_admin.table("quit_checkins")
            .select("free_text, urge_level, context_tags, created_at")
            .eq("quit_path_id", path_id)
            .eq("checkin_type", "response_used")
            .order("created_at", desc=True)
            .limit(10)
            .execute()
            .data
            or []
        )
        helped = 0
        not_helped = 0
        unclear = 0
        for row in response_rows:
            text = str(row.get("free_text") or "").strip().lower()
            urge = str(row.get("urge_level") or "").strip().lower()
            tags = [
                str(t).strip().lower()
                for t in (row.get("context_tags") or [])
                if isinstance(t, str)
            ]
            blob = " ".join([text, urge, " ".join(tags)])
            if any(k in blob for k in ("helped", "worked", "effective", "yes")):
                helped += 1
            elif any(k in blob for k in ("not_helped", "did_not_help", "didn't help", "no")):
                not_helped += 1
            else:
                unclear += 1
        total = helped + not_helped + unclear
        response_used_pattern = {
            "total_logs": total,
            "helped_count": helped,
            "not_helped_count": not_helped,
            "unclear_count": unclear,
            "help_rate": round((helped / total), 2) if total else None,
        }

        return {
            "top_triggers": top_triggers,
            "urge_trend": urge_trend,
            "last_slip_context": last_slip_context,
            "user_context_notes": user_context_notes,
            "has_checkin_data": has_checkin_data,
            "weekly_urge_pending": weekly_urge_pending,
            "response_used_pattern": response_used_pattern,
        }
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "living_trigger_profile_error",
                    "path_id": str(path_id),
                    "error": str(e)[:200],
                }
            )
        )
        return {
            "top_triggers": [{"tag": c, "count": 0} for c in (original_contexts or [])[:6]],
            "urge_trend": [],
            "last_slip_context": None,
            "user_context_notes": [],
            "has_checkin_data": False,
            "weekly_urge_pending": False,
            "response_used_pattern": {
                "total_logs": 0,
                "helped_count": 0,
                "not_helped_count": 0,
                "unclear_count": 0,
                "help_rate": None,
            },
        }


def _get_initials(name: str) -> str:
    words = name.strip().split()
    if len(words) >= 2:
        return (words[0][0] + words[1][0]).upper()
    return (name.strip()[:2] or "??").upper()


def _normalize_habit(name: str) -> str:
    return name.strip().lower().replace(" ", "_").replace("-", "_")


# Map slang / morphological variants to one stable slug so duplicate paths are not created.
_QUIT_SLUG_ALIASES: dict[str, str] = {
    "masturbating": "masturbation",
    "masturbation": "masturbation",
    "fapping": "masturbation",
    "fap": "masturbation",
    "jerking_off": "masturbation",
}


def canonical_quit_slug(nq: dict[str, Any], canonical_display: str) -> str:
    """Stable habit key for quit_paths.habit_normalized (LLM dedupe_key + synonym merge)."""
    dk = str(nq.get("dedupe_key") or "").strip().lower()
    if dk:
        dk = dk.replace(" ", "_").replace("-", "_")
        dk = _QUIT_SLUG_ALIASES.get(dk, dk)
        return dk[:120]
    slug = _normalize_habit(canonical_display)
    return _QUIT_SLUG_ALIASES.get(slug, slug)[:120]


def _dedupe_incomplete_quit_resistance_missions(user_id: str, mission_date: str) -> None:
    """
    Keep a single incomplete resistance mission per quit_path per day; delete extras.
    Repairs duplicate rows from race conditions or older multi-mission batches.
    """
    res = (
        supabase_admin.table("missions")
        .select("id, quit_path_id, completed, created_at")
        .eq("user_id", user_id)
        .eq("mission_date", mission_date)
        .eq("type", "resistance")
        .execute()
    )
    rows = res.data or []
    by_path: dict[str, list[dict]] = {}
    for m in rows:
        if m.get("completed"):
            continue
        qpid = m.get("quit_path_id")
        if not qpid:
            continue
        by_path.setdefault(str(qpid), []).append(m)
    for ms in by_path.values():
        if len(ms) <= 1:
            continue
        ms.sort(key=lambda x: str(x.get("created_at") or ""))
        for extra in ms[1:]:
            try:
                supabase_admin.table("missions").delete().eq("id", extra["id"]).execute()
            except Exception:
                logger.exception(
                    "dedupe quit resistance: failed to delete mission %s",
                    extra.get("id"),
                )


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


def _created_at_to_user_calendar_day(created_at: Any, timezone_str: str) -> str:
    """
    Convert a UTC-ish created_at value into the user's local YYYY-MM-DD.
    Falls back to naive date slicing if parsing fails.
    """
    raw = str(created_at or "")
    if not raw:
        return ""
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        try:
            tz = ZoneInfo(timezone_str or "UTC")
        except Exception:
            tz = ZoneInfo("UTC")
        return dt.astimezone(tz).date().isoformat()
    except Exception:
        return raw[:10]


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
    raw_label = (habit_name or "").strip()
    if len(raw_label) < 2:
        raise ValueError("Habit name is too short")

    nq = await normalise_quit_target(raw_label, "", "")
    if nq.get("rejected"):
        reason = str(nq.get("rejection_reason") or "")
        if reason == "self_harm":
            raise ValueError("self_harm_quit")
        raise ValueError("quit_target_rejected")

    canonical_display = str(nq.get("normalised_name") or raw_label).strip() or raw_label.title()
    canonical_key = canonical_quit_slug(nq, canonical_display)

    dup = (
        await run_query(supabase_admin.table("quit_paths")
        .select("id")
        .eq("user_id", user_id)
        .eq("habit_normalized", canonical_key)
        .limit(1))
    )
    if dup.data:
        raise ValueError("duplicate quit habit")

    profile = await analyse_quit_profile(
        habit_name=canonical_display,
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
            canonical_display,
        )

    row = {
        "user_id": user_id,
        "habit_name": canonical_display,
        "habit_normalized": canonical_key,
        "initials": _get_initials(canonical_display),
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

    result = await run_query(supabase_admin.table("quit_paths").insert(row))
    if not result.data:
        raise RuntimeError("Failed to insert quit_paths row")
    path_id = result.data[0]["id"]
    try:
        from app.services.mail_service import check_and_send_quit_path_started_mail

        await check_and_send_quit_path_started_mail(user_id)
    except Exception:
        pass
    return {"path_id": path_id, "starting_phase": starting_phase, "status": status}


async def generate_quit_missions_for_today(
    user_id: str,
    path_id: str,
    mission_date: str | None = None,
) -> list[dict]:
    tz = _user_timezone(user_id)
    md = mission_date or get_user_date(tz)

    path_res = (
        await run_query(supabase_admin.table("quit_paths")
        .select("*")
        .eq("id", path_id)
        .eq("user_id", user_id)
        .single())
    )
    path = path_res.data
    if not path or path.get("status") != "active":
        return []

    existing = (
        ((await run_query(supabase_admin.table("missions")
        .select("id")
        .eq("user_id", user_id)
        .eq("quit_path_id", path_id)
        .eq("mission_date", md)
        .limit(1))).data)
        or []
    )
    if existing:
        return []

    user_row = (
        ((await run_query(supabase_admin.table("users")
        .select("archetype")
        .eq("id", user_id)
        .single())).data)
        or {}
    )
    archetype = str(user_row.get("archetype") or "structured_climber")

    recent = _recent_quit_missions_with_ratings(user_id, path_id)

    # Fetch user feedback on recent quit missions (last 5 ratings for this quit path)
    try:
        quit_ratings_res = (
            await run_query(supabase_admin.table("mission_ratings")
            .select("rating, feedback_text")
            .eq("user_id", user_id)
            .eq("quit_path_id", path_id)
            .order("created_at", desc=True)
            .limit(5))
        )
        quit_feedback_parts = []
        for r in quit_ratings_res.data or []:
            rating_label = {1: "Too Hard", 3: "Just Right", 5: "Too Easy"}.get(
                int(r.get("rating") or 3), "Rated"
            )
            fb = str(r.get("feedback_text") or "").strip()
            if fb:
                quit_feedback_parts.append(f'{rating_label}: "{fb}"')
            else:
                quit_feedback_parts.append(rating_label)
        quit_user_feedback = " | ".join(quit_feedback_parts) if quit_feedback_parts else "No feedback yet"
    except Exception:
        quit_user_feedback = "No feedback yet"

    freq_log = (
        ((await run_query(supabase_admin.table("quit_frequency_log")
        .select("count")
        .eq("quit_path_id", path_id)
        .eq("log_date", md)
        .limit(1))).data)
        or []
    )
    frequency_today = int(freq_log[0]["count"]) if freq_log else 0

    phase_started = path.get("phase_started_at") or path["created_at"]
    phase_started_dt = datetime.fromisoformat(str(phase_started).replace("Z", "+00:00"))
    days_in_phase = (datetime.now(timezone.utc) - phase_started_dt).days

    # Fetch living trigger profile for richer mission generation
    living_profile = _build_living_trigger_profile(
        path_id=path_id,
        original_contexts=path.get("trigger_contexts") or [],
    )
    # Use check-in derived top triggers if available, else fall back to path contexts
    effective_trigger_contexts = (
        [t["tag"] for t in living_profile["top_triggers"]]
        if living_profile["has_checkin_data"]
        else (path.get("trigger_contexts") or [])
    )
    user_context_notes = living_profile.get("user_context_notes") or []
    response_used_pattern = living_profile.get("response_used_pattern") or {
        "total_logs": 0,
        "helped_count": 0,
        "not_helped_count": 0,
        "unclear_count": 0,
        "help_rate": None,
    }

    # Fetch user's active interests for cross-reference
    user_interests: list[dict] = []
    try:
        interests_res = (
            ((await run_query(supabase_admin.table("interests")
            .select("normalised_name, current_arc_phase, sessions_completed, arc_paused, is_active")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .eq("arc_paused", False)
            .limit(4))).data)
            or []
        )
        for row in interests_res:
            r = dict(row)
            cap = str(r.get("current_arc_phase") or "")
            r["arc_phase_label"] = ARC_PHASE_LABELS.get(cap, cap.replace("_", " ").title() if cap else "")
            user_interests.append(r)
    except Exception:
        pass

    # Fetch guilt_orientation from discipline_dna
    guilt_orientation: float = 0.0
    try:
        dna_row = (
            ((await run_query(supabase_admin.table("discipline_dna")
            .select("guilt_orientation")
            .eq("user_id", user_id)
            .single())).data)
            or {}
        )
        guilt_orientation = float(dna_row.get("guilt_orientation") or 0.0)
    except Exception:
        pass

    batch = await generate_quit_missions(
        habit_name=path["habit_name"],
        underlying_need=path["underlying_need"],
        current_phase=path["current_phase"],
        trigger_contexts=effective_trigger_contexts,
        awareness_level=path["awareness_level"],
        competing_response=path.get("competing_response") or "",
        phase_1_focus=path.get("phase_1_focus") or "",
        recent_missions=recent,
        frequency_today=frequency_today,
        frequency_baseline=path.get("frequency_baseline"),
        days_in_phase=days_in_phase,
        archetype=archetype,
        living_trigger_profile=living_profile,
        user_interests=user_interests,
        guilt_orientation=guilt_orientation,
        user_feedback=quit_user_feedback,
        user_context_notes=user_context_notes,
        response_used_pattern=response_used_pattern,
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
        await run_query(supabase_admin.table("quit_paths")
        .select("frequency_unit,frequency_baseline,current_phase,created_at")
        .eq("id", path_id)
        .eq("user_id", user_id)
        .single())
    )
    path = path_res.data
    if not path:
        raise ValueError("Quit path not found")

    unit = path.get("frequency_unit") or "times"
    await run_query(supabase_admin.table("quit_frequency_log").upsert(
        {
            "user_id": user_id,
            "quit_path_id": path_id,
            "log_date": today,
            "count": count,
            "unit": unit,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="quit_path_id,log_date",
    ))

    await run_query(supabase_admin.table("quit_paths").update(
        {
            "frequency_today": count,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", path_id))

    baseline = path.get("frequency_baseline")
    if baseline and float(baseline) > 0:
        seven_ago = (date.fromisoformat(today) - timedelta(days=7)).isoformat()
        logs = (
            ((await run_query(supabase_admin.table("quit_frequency_log")
            .select("count")
            .eq("quit_path_id", path_id)
            .gte("log_date", seven_ago))).data)
            or []
        )
        if logs:
            avg = sum(int(l["count"]) for l in logs) / len(logs)
            reduction_pct = max(0, round((1 - avg / float(baseline)) * 100))
            await run_query(supabase_admin.table("quit_paths").update({"frequency_reduction_pct": reduction_pct}).eq(
                "id", path_id
            ))

    try:
        created_day = str(path.get("created_at") or "")[:10]
        if created_day:
            days_since = (date.fromisoformat(today) - date.fromisoformat(created_day)).days
            from app.services.mail_service import maybe_send_quit_clean_mails

            await maybe_send_quit_clean_mails(user_id, days_since)
    except Exception:
        pass

    return {"logged": True, "count": count, "date": today}


async def advance_phase(user_id: str, path_id: str) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()

    path_res = (
        await run_query(supabase_admin.table("quit_paths")
        .select("*")
        .eq("id", path_id)
        .eq("user_id", user_id)
        .single())
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
        ((await run_query(supabase_admin.table("quit_frequency_log")
        .select("count")
        .eq("quit_path_id", path_id)
        .gte("log_date", seven_ago))).data)
        or []
    )
    freq_at_transition = sum(int(l["count"]) for l in logs) / len(logs) if logs else None

    if current == "mapping" and not path.get("frequency_baseline") and freq_at_transition is not None:
        await run_query(supabase_admin.table("quit_paths").update({"frequency_baseline": freq_at_transition}).eq(
            "id", path_id
        ))
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

    await run_query(supabase_admin.table("quit_insights").insert(
        {
            "quit_path_id": path_id,
            "user_id": user_id,
            "phase": current,
            "title": insight.title,
            "body": insight.body,
        }
    ))

    update_payload: dict[str, Any] = {
        "current_phase": next_phase,
        "phase_started_at": now,
        "updated_at": now,
    }
    if current == "mapping":
        update_payload["mapping_complete"] = True
    elif current == "disruption":
        update_payload["disruption_complete"] = True

    await run_query(supabase_admin.table("quit_paths").update(update_payload).eq("id", path_id))

    return {
        "advanced": True,
        "new_phase": next_phase,
        "insight": {"title": insight.title, "body": insight.body},
    }


def _compute_phase_readiness_sync(path: dict, path_id: str) -> dict:
    """
    Synchronous readiness check for display purposes only.
    Returns structured criteria info for the frontend.
    """
    try:
        current = path.get("current_phase", "mapping")
        if current == "consolidation":
            return {"phase": current, "ready": False, "criteria": []}

        phase_started = path.get("phase_started_at") or path.get("created_at", "")
        phase_started_dt = datetime.fromisoformat(
            str(phase_started).replace("Z", "+00:00")
        )
        days_in_phase = (datetime.now(timezone.utc) - phase_started_dt).days

        if current == "mapping":
            checkin_count = (
                supabase_admin.table("quit_checkins")
                .select("id", count="exact")
                .eq("quit_path_id", path_id)
                .eq("checkin_type", "slip_context")
                .execute()
                .count
                or 0
            )
            criteria = [
                {
                    "label": f"{days_in_phase} of 7 days in Mapping phase",
                    "met": days_in_phase >= 7,
                    "required": 7,
                    "actual": days_in_phase,
                    "unit": "days",
                },
                {
                    "label": f"{checkin_count} of 3 trigger logs needed",
                    "met": checkin_count >= 3,
                    "required": 3,
                    "actual": checkin_count,
                    "unit": "checkins",
                },
            ]
            ready = days_in_phase >= 7 and checkin_count >= 3

        else:  # disruption
            fourteen_ago = (
                datetime.now(timezone.utc) - timedelta(days=14)
            ).isoformat()
            urge_rows = (
                supabase_admin.table("quit_checkins")
                .select("urge_level")
                .eq("quit_path_id", path_id)
                .eq("checkin_type", "weekly_urge")
                .gte("created_at", fourteen_ago)
                .execute()
                .data
                or []
            )
            easy = [
                r for r in urge_rows
                if r.get("urge_level") in ("barely_noticed", "manageable")
            ]
            criteria = [
                {
                    "label": f"{days_in_phase} of 14 days in Disruption phase",
                    "met": days_in_phase >= 14,
                    "required": 14,
                    "actual": days_in_phase,
                    "unit": "days",
                },
                {
                    "label": "At least 1 manageable week in last 14 days",
                    "met": len(easy) >= 1,
                    "required": 1,
                    "actual": len(easy),
                    "unit": "weeks",
                },
            ]
            ready = days_in_phase >= 14 and len(easy) >= 1

        return {"phase": current, "ready": ready, "criteria": criteria}

    except Exception:
        return {"phase": path.get("current_phase", "mapping"), "ready": False, "criteria": []}


async def check_and_maybe_advance_phase(user_id: str, path_id: str) -> dict:
    """
    Checks readiness criteria and automatically advances phase if met.
    Called after checkin stored or frequency logged. Never raises.

    Gates:
      mapping → disruption : ≥7 days in phase AND ≥3 slip_context checkins
      disruption → consolidation: ≥14 days AND ≥1 weekly_urge ≤ "manageable"
                                   in last 14 days
    Returns:
      {"advanced": bool, "new_phase": str | None, "criteria_met": dict}
    """
    try:
        path_res = await run_query(
            supabase_admin.table("quit_paths")
            .select("current_phase, phase_started_at, created_at, status, "
                    "habit_name, underlying_need, awareness_level, "
                    "trigger_contexts, frequency_baseline")
            .eq("id", path_id)
            .eq("user_id", user_id)
            .single()
        )
        path = path_res.data
        if not path or path.get("status") != "active":
            return {"advanced": False, "new_phase": None, "criteria_met": {}}

        current = path["current_phase"]
        if current == "consolidation":
            return {"advanced": False, "new_phase": None, "criteria_met": {}}

        phase_started = path.get("phase_started_at") or path["created_at"]
        phase_started_dt = datetime.fromisoformat(
            str(phase_started).replace("Z", "+00:00")
        )
        days_in_phase = (datetime.now(timezone.utc) - phase_started_dt).days

        criteria_met: dict = {}

        if current == "mapping":
            min_days = 7
            min_checkins = 3

            criteria_met["days"] = {
                "required": min_days,
                "actual": days_in_phase,
                "met": days_in_phase >= min_days,
            }

            checkin_count_res = await run_query(
                supabase_admin.table("quit_checkins")
                .select("id", count="exact")
                .eq("quit_path_id", path_id)
                .eq("checkin_type", "slip_context")
            )
            checkin_count = (
                checkin_count_res.count
                if checkin_count_res.count is not None
                else len(checkin_count_res.data or [])
            )
            criteria_met["checkins"] = {
                "required": min_checkins,
                "actual": checkin_count,
                "met": checkin_count >= min_checkins,
            }

            ready = criteria_met["days"]["met"] and criteria_met["checkins"]["met"]

        else:  # disruption → consolidation
            min_days = 14

            criteria_met["days"] = {
                "required": min_days,
                "actual": days_in_phase,
                "met": days_in_phase >= min_days,
            }

            fourteen_ago = (
                datetime.now(timezone.utc) - timedelta(days=14)
            ).isoformat()
            urge_rows_res = await run_query(
                supabase_admin.table("quit_checkins")
                .select("urge_level")
                .eq("quit_path_id", path_id)
                .eq("checkin_type", "weekly_urge")
                .gte("created_at", fourteen_ago)
            )
            urge_rows = urge_rows_res.data or []
            easy_urges = [
                r for r in urge_rows
                if r.get("urge_level") in ("barely_noticed", "manageable")
            ]
            criteria_met["urge_trend"] = {
                "required": "≥1 manageable week in last 14 days",
                "actual": len(easy_urges),
                "met": len(easy_urges) >= 1,
            }

            ready = criteria_met["days"]["met"] and criteria_met["urge_trend"]["met"]

        if not ready:
            return {
                "advanced": False,
                "new_phase": None,
                "criteria_met": criteria_met,
            }

        result = await advance_phase(user_id, path_id)
        if result.get("advanced"):
            logger.info(
                json.dumps({
                    "event": "auto_phase_advanced",
                    "user_id": user_id,
                    "path_id": path_id,
                    "new_phase": result.get("new_phase"),
                    "days_in_phase": days_in_phase,
                })
            )
        return {
            "advanced": result.get("advanced", False),
            "new_phase": result.get("new_phase"),
            "criteria_met": criteria_met,
            "insight": result.get("insight"),
        }

    except Exception as e:
        logger.warning(
            "check_and_maybe_advance_phase failed path=%s: %s",
            path_id,
            str(e)[:120],
        )
        return {"advanced": False, "new_phase": None, "criteria_met": {}}


async def get_quits_for_user(user_id: str) -> list[dict[str, Any]]:
    tz = _user_timezone(user_id)
    today = get_user_date(tz)

    paths = (
        ((await run_query(supabase_admin.table("quit_paths")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at"))).data)
        or []
    )

    result: list[dict[str, Any]] = []
    for path in paths:
        pid = path["id"]
        seven_ago = (date.fromisoformat(today) - timedelta(days=7)).isoformat()
        freq_history = (
            ((await run_query(supabase_admin.table("quit_frequency_log")
            .select("log_date,count,unit")
            .eq("quit_path_id", pid)
            .gte("log_date", seven_ago)
            .order("log_date"))).data)
            or []
        )

        today_missions = (
            ((await run_query(supabase_admin.table("missions")
            .select("id,title,description,completed_at,mission_category")
            .eq("user_id", user_id)
            .eq("quit_path_id", pid)
            .eq("mission_date", today))).data)
            or []
        )

        insights = (
            ((await run_query(supabase_admin.table("quit_insights")
            .select("id,phase,title,body,unlocked_at,created_at")
            .eq("quit_path_id", pid)
            .order("created_at"))).data)
            or []
        )

        today_log = (
            ((await run_query(supabase_admin.table("quit_frequency_log")
            .select("count")
            .eq("quit_path_id", pid)
            .eq("log_date", today)
            .limit(1))).data)
            or []
        )
        # Always use today's log entry — never the denormalized column (may be stale from yesterday)
        freq_today = int(today_log[0]["count"]) if today_log else 0

        # Living trigger profile (aggregated check-in data)
        living_profile = _build_living_trigger_profile(
            path_id=pid,
            original_contexts=path.get("trigger_contexts") or [],
        )

        created_day = _created_at_to_user_calendar_day(path.get("created_at"), tz)
        try:
            days_active = max(
                0,
                (date.fromisoformat(today) - date.fromisoformat(created_day)).days,
            )
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
                "need_description": path.get("need_description") or "",
                "competing_response": path.get("competing_response") or "",
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
                "top_triggers": living_profile["top_triggers"],
                "urge_trend": living_profile["urge_trend"],
                "last_slip_context": living_profile["last_slip_context"],
                "has_checkin_data": living_profile["has_checkin_data"],
                "weekly_urge_pending": living_profile["weekly_urge_pending"],
                "phase_readiness": _compute_phase_readiness_sync(path, pid),
            }
        )

    return result


async def delete_quit_path(user_id: str, path_id: str) -> dict[str, bool]:
    await run_query(supabase_admin.table("quit_paths").delete().eq("id", path_id).eq("user_id", user_id))
    return {"deleted": True}


async def mark_quit_conquered(user_id: str, path_id: str) -> dict[str, Any]:
    """
    Self-declared habit conquest.
    Sets quit_paths.status = 'completed', records conquered_at.
    Does not delete the path — it remains visible as a trophy.
    """
    path_res = (
        await run_query(supabase_admin.table("quit_paths")
        .select("id, user_id, habit_name, current_phase, created_at")
        .eq("id", path_id)
        .eq("user_id", user_id)
        .limit(1))
    )
    rows = path_res.data or []
    if not rows:
        raise ValueError("Quit path not found")
    path = rows[0]

    tz = _user_timezone(user_id)
    today = get_user_date(tz)
    created_day = _created_at_to_user_calendar_day(path.get("created_at"), tz)
    try:
        days_active = max(
            0,
            (date.fromisoformat(today) - date.fromisoformat(created_day)).days,
        )
    except Exception:
        days_active = 0

    try:
        freq_rows = (
            ((await run_query(supabase_admin.table("quit_frequency_log")
            .select("count")
            .eq("quit_path_id", path_id))).data)
            or []
        )
        total_cravings = sum(int(r.get("count") or 0) for r in freq_rows)
    except Exception:
        total_cravings = 0

    now_iso = datetime.now(timezone.utc).isoformat()

    await run_query(supabase_admin.table("quit_paths").update(
        {
            "status": "completed",
            "conquered_at": now_iso,
            "updated_at": now_iso,
        }
    ).eq("id", path_id).eq("user_id", user_id))

    return {
        "conquered": True,
        "milestone": {
            "milestone_type": "conquered",
            "earned_at": now_iso,
            "clean_days_at_earn": days_active,
            "cravings_at_earn": total_cravings,
            "phase_at_earn": path.get("current_phase") or "consolidation",
            "quote": "The habit no longer controls you. You decided — and you followed through.",
            "slip_duration_hours": None,
            "return_speed": None,
        },
        "quit_name": path.get("habit_name") or "this habit",
    }


async def update_quit_schedule(
    user_id: str,
    path_id: str,
    trigger_contexts: list[str],
    awareness_level: str,
) -> dict[str, bool]:
    path_res = (
        await run_query(supabase_admin.table("quit_paths")
        .select("*")
        .eq("id", path_id)
        .eq("user_id", user_id)
        .single())
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

    await run_query(supabase_admin.table("quit_paths").update(update_payload).eq("id", path_id))

    return {"updated": True}


async def sync_quit_path_missions_for_date(user_id: str, mission_date: str) -> None:
    _dedupe_incomplete_quit_resistance_missions(user_id, mission_date)

    async def _count_incomplete_resistance_today() -> int:
        r = (
            await run_query(supabase_admin.table("missions")
            .select("id")
            .eq("user_id", user_id)
            .eq("mission_date", mission_date)
            .eq("type", "resistance")
            .eq("completed", False))
        )
        return len(r.data or [])

    paths_raw = (
        ((await run_query(supabase_admin.table("quit_paths")
        .select("id, created_at")
        .eq("user_id", user_id)
        .eq("status", "active"))).data)
        or []
    )
    paths = sorted(paths_raw, key=lambda p: str(p.get("created_at") or ""))
    for p in paths:
        try:
            if await _count_incomplete_resistance_today() >= MAX_QUIT_RESISTANCE_MISSIONS_PER_USER_DAY:
                logger.info(
                    "sync_quit_path_missions: user=%s at cap=%s for %s",
                    user_id,
                    MAX_QUIT_RESISTANCE_MISSIONS_PER_USER_DAY,
                    mission_date,
                )
                break
            rows = await generate_quit_missions_for_today(user_id, p["id"], mission_date)
            if rows:
                await run_query(supabase_admin.table("missions").insert(rows))
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
