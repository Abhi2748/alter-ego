from __future__ import annotations

import json
import logging
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.api.auth import get_user_id_from_token
from app.core.supabase_client import supabase_admin, run_query
from app.core.constants import MISSION_PF, PERSONAL_MISSION_XP_BY_TIER, resolve_stat_tag
from app.core.journal_rules import journal_stored_qualifies_for_mission, word_count as journal_word_count
from app.agents.personal_mission_agent import estimate_personal_mission_tier
from app.services.mission_row_utils import mission_row_completed
from app.services.mission_service import (
    complete_mission,
    compute_core_pillar_streak_bases,
    delete_stale_incomplete_personal_missions,
    generate_core_missions_for_user,
    get_days_since_registration,
    get_today_missions,
    get_user_date,
    sync_today_planner_missions,
    update_pillar_difficulty,
)
from app.services.streak_service import sync_streak_if_lapsed

router = APIRouter(prefix="/api/v1/missions", tags=["missions"])
logger = logging.getLogger(__name__)


async def _inject_twin_completions(user_id: str, today: str, grouped: dict) -> None:
    """
    One batch read of twin_mission_log; match missions by title (case-insensitive).
    Sets twin_completed and twin_completed_at_hour on each mission dict.
    On error, leaves grouped unchanged (no twin fields).
    """
    try:
        result = await run_query(supabase_admin.table("twin_mission_log")
            .select("mission_title, simulated_hour")
            .eq("user_id", user_id)
            .eq("mission_date", today))
        twin_by_title: dict[str, int] = {}
        for row in result.data or []:
            raw = (row.get("mission_title") or "").strip().lower()
            if raw:
                sh = row.get("simulated_hour")
                twin_by_title[raw] = int(sh) if sh is not None else 9

        for missions in grouped.values():
            for mission in missions:
                title_key = (mission.get("title") or "").strip().lower()
                if title_key in twin_by_title:
                    mission["twin_completed"] = True
                    mission["twin_completed_at_hour"] = twin_by_title[title_key]
                else:
                    mission["twin_completed"] = False
                    mission["twin_completed_at_hour"] = None
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "twin_mission_fetch_error",
                    "user_id": user_id,
                    "date": today,
                    "error": str(e),
                }
            )
        )


async def _attach_mission_streak_fields(user_id: str, mission_date: str, rows: list[dict]) -> None:
    """Set mission_streak on core (non-journal) rows for list UIs; 0 for other types."""
    pillar_bases = await compute_core_pillar_streak_bases(user_id, mission_date)
    for r in rows or []:
        if r.get("type") == "core" and not r.get("is_journal_mission"):
            p = str(r.get("core_pillar") or "")
            base = pillar_bases.get(p, 0) if p else 0
            done = mission_row_completed(r)
            r["mission_streak"] = base + (1 if done else 0)
        else:
            r["mission_streak"] = 0


def _enrich_mission_rows(rows: list[dict]) -> None:
    """Attach interest_name and quit habit label for list UIs."""
    if not rows:
        return
    i_ids = list({str(r["interest_id"]) for r in rows if r.get("interest_id")})
    qp_ids = list({str(r["quit_path_id"]) for r in rows if r.get("quit_path_id")})
    i_map: dict[str, str] = {}
    qp_map: dict[str, str] = {}
    if i_ids:
        ir = (
            supabase_admin.table("interests")
            .select("id, normalised_name, raw_text")
            .in_("id", i_ids)
            .execute()
        )
        for x in ir.data or []:
            label = (x.get("normalised_name") or x.get("raw_text") or "").strip() or "Interest"
            i_map[str(x["id"])] = label
    if qp_ids:
        qr = (
            supabase_admin.table("quit_paths")
            .select("id, habit_name")
            .in_("id", qp_ids)
            .execute()
        )
        for x in qr.data or []:
            label = (x.get("habit_name") or "").strip() or "Resistance"
            qp_map[str(x["id"])] = label
    for r in rows:
        iid = r.get("interest_id")
        if iid:
            r["interest_name"] = i_map.get(str(iid))
        qpid = r.get("quit_path_id")
        if qpid:
            r["quit_target_name"] = qp_map.get(str(qpid))
            r["is_quit_mission"] = True
        else:
            r["is_quit_mission"] = False


def _group_missions(rows: list[dict]) -> dict:
    """Shape mission rows for the client (includes rationale + domain_knowledge for detail / research)."""
    grouped = {"core": [], "interest": [], "resistance": [], "personal": []}
    for r in rows or []:
        t = r.get("type")
        if t in grouped:
            grouped[t].append(
                {
                    "id": r.get("id"),
                    "title": r.get("title"),
                    "difficulty": r.get("difficulty"),
                    "xp_value": r.get("xp_value"),
                    "pf_value": r.get("pf_value"),
                    "completed": r.get("completed", False),
                    "completed_at": r.get("completed_at"),
                    "is_journal_mission": r.get("is_journal_mission", False),
                    "core_pillar": r.get("core_pillar"),
                    "rationale": r.get("rationale"),
                    "domain_knowledge": r.get("domain_knowledge"),
                    "phase_principle": r.get("phase_principle"),
                    "interest_id": r.get("interest_id"),
                    "quit_target_id": r.get("quit_target_id"),
                    "quit_path_id": r.get("quit_path_id"),
                    "mission_category": r.get("mission_category"),
                    "underlying_need": r.get("underlying_need"),
                    "description": r.get("description"),
                    "estimated_minutes": r.get("estimated_minutes"),
                    "mission_date": r.get("mission_date"),
                    "stat_tag": r.get("stat_tag"),
                    "interest_name": r.get("interest_name"),
                    "quit_target_name": r.get("quit_target_name"),
                    "is_quit_mission": bool(r.get("quit_path_id")),
                    "mission_streak": int(r.get("mission_streak") or 0),
                }
            )
    return grouped


def _summary(rows: list[dict]) -> dict:
    total = len(rows or [])
    completed = sum(1 for r in (rows or []) if r.get("completed"))
    xp_available = sum(int(r.get("xp_value") or 0) for r in (rows or []))
    pf_available = sum(int(r.get("pf_value") or 0) for r in (rows or []))
    return {"total": total, "completed": completed, "xp_available": xp_available, "pf_available": pf_available}

class RateMissionRequest(BaseModel):
    rating: int
    feedback_text: str | None = None


class JournalSaveRequest(BaseModel):
    content: str
    date: str  # YYYY-MM-DD
    title: str | None = ""
    bookmarked: bool = False


class StageEvolved(BaseModel):
    new_stage: int
    new_stage_name: str


class PetEvolved(BaseModel):
    new_stage: int
    new_pet_name: str


class StreakAnimation(BaseModel):
    show: bool
    streak_count: int
    animation_tier: str


class StatGainsOut(BaseModel):
    primary_stat: str | None = None
    primary_sp: int = 0
    discipline_sp: int = 0
    willpower_bonus_sp: int = 0
    level_ups: list[str] = Field(default_factory=list)


class WillpowerProgressOut(BaseModel):
    missions_completed_today: int = 0
    total_missions_today: int = 0


class SigilCompletionOut(BaseModel):
    aether_awarded: int = 0
    surge_activated: bool = False
    surge_active: bool = False
    level_up: bool = False
    new_level: int | None = None
    new_level_name: str | None = None


class CompleteMissionResponse(BaseModel):
    success: bool
    already_completed: bool | None = None

    xp_earned: int
    pf_earned: int
    new_total_xp: int
    new_total_pf: int

    daily_xp_remaining: int | None = None
    daily_pf_remaining: int | None = None

    stage_evolved: StageEvolved | None = None
    pet_evolved: PetEvolved | None = None

    streak_updated: bool | None = None
    current_streak: int | None = None
    streak_animation: StreakAnimation | None = None
    tier_upgraded: bool | None = None
    new_streak_tier: str | None = None
    milestone_reached: int | None = None
    leaderboard_just_unlocked: bool | None = None
    power_score: int | None = None

    stat_gains: StatGainsOut | None = None
    willpower_progress: WillpowerProgressOut | None = None
    sigil: SigilCompletionOut | None = None

    completion_copy: str | None = None


class PersonalMissionEstimateRequest(BaseModel):
    mission_text: str


class PersonalMissionCreateRequest(BaseModel):
    mission_text: str
    tier: str
    xp: int
    pf: int
    estimated_minutes: int
    date: str | None = None  # YYYY-MM-DD; default = user's local calendar day
    multiday_days: int | None = None


@router.get("/today", response_model=dict)
async def get_missions_today(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    await sync_streak_if_lapsed(user_id)

    user_row = await run_query(supabase_admin.table("users")
        .select("timezone, registration_date")
        .eq("id", user_id)
        .single())
    timezone_str = (user_row.data or {}).get("timezone") or "UTC"
    registration_date = (user_row.data or {}).get("registration_date") or ""

    mission_date = get_user_date(timezone_str)

    # Ensure core missions exist (idempotent)
    await generate_core_missions_for_user(user_id, mission_date)

    # Interest + resistance: sync to current profile (adds missing, removes stale incomplete)
    await sync_today_planner_missions(user_id, mission_date)

    await delete_stale_incomplete_personal_missions(user_id, mission_date)

    rows = await get_today_missions(user_id, mission_date)
    await _attach_mission_streak_fields(user_id, mission_date, rows)
    _enrich_mission_rows(rows)

    from app.services.stat_service import ensure_sp_day_aligned, set_total_missions_for_day

    await ensure_sp_day_aligned(user_id, mission_date)
    await set_total_missions_for_day(user_id, len(rows))

    grouped = _group_missions(rows)
    await _inject_twin_completions(user_id, mission_date, grouped)

    return {
        "date": mission_date,
        "day_number": get_days_since_registration(str(registration_date), str(timezone_str)),
        "missions": grouped,
        "summary": _summary(rows),
    }


@router.get("/date/{date_str}", response_model=dict)
async def get_missions_for_date(date_str: str, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    # Fetch missions for that date; do not create if missing
    result = await run_query(supabase_admin.table("missions")
        .select("*")
        .eq("user_id", user_id)
        .eq("mission_date", date_str))
    rows = result.data or []
    await _attach_mission_streak_fields(user_id, date_str, rows)
    _enrich_mission_rows(rows)
    return {
        "date": date_str,
        "missions": _group_missions(rows),
        "summary": _summary(rows),
    }


@router.post("/generate-interest", response_model=dict)
async def generate_interest_missions_today(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    user_row = await run_query(supabase_admin.table("users")
        .select("timezone")
        .eq("id", user_id)
        .single())
    timezone_str = (user_row.data or {}).get("timezone") or "UTC"
    mission_date = get_user_date(timezone_str)
    sync = await sync_today_planner_missions(user_id, mission_date)
    rows = await get_today_missions(user_id, mission_date)
    interest_only = [r for r in rows if r.get("type") == "interest"]
    return {"sync": sync, "generated": len(interest_only), "missions": interest_only}


@router.post("/generate-resistance", response_model=dict)
async def generate_resistance_missions_today(authorization: str = Header(None)):
    """Manually trigger quit target mission sync for today."""
    user_id = get_user_id_from_token(authorization)
    user_row = await run_query(supabase_admin.table("users")
        .select("timezone")
        .eq("id", user_id)
        .single())
    timezone_str = (user_row.data or {}).get("timezone") or "UTC"
    mission_date = get_user_date(timezone_str)
    sync = await sync_today_planner_missions(user_id, mission_date)
    rows = await get_today_missions(user_id, mission_date)
    res_only = [r for r in rows if r.get("type") == "resistance"]
    return {"sync": sync, "generated": len(res_only), "missions": res_only}


def _attach_quit_path_detail(row: dict) -> None:
    qpid = row.get("quit_path_id")
    if not qpid:
        return
    qr = (
        supabase_admin.table("quit_paths")
        .select("habit_name, current_phase, need_description, competing_response, underlying_need")
        .eq("id", qpid)
        .single()
        .execute()
        .data
    )
    if qr:
        row["quit_habit_name"] = qr.get("habit_name")
        row["quit_phase"] = qr.get("current_phase")
        row["quit_need_description"] = qr.get("need_description")
        row["quit_competing_response"] = qr.get("competing_response")
        row["quit_need_category"] = qr.get("underlying_need")


@router.post("/{mission_id}/complete", response_model=CompleteMissionResponse)
async def complete_mission_endpoint(mission_id: str, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    result = await complete_mission(user_id, mission_id)

    if result.get("success") and not result.get("already_completed"):
        try:
            from app.services.arc_service import increment_sessions_and_check_phase

            mres = await run_query(supabase_admin.table("missions")
                .select("type, interest_id")
                .eq("id", mission_id)
                .eq("user_id", user_id)
                .single())
            m = mres.data or {}
            if str(m.get("type") or "") == "interest" and m.get("interest_id"):
                await increment_sessions_and_check_phase(
                    user_id, str(m["interest_id"]), mission_id
                )
        except Exception:
            pass

    logger.info(
        json.dumps(
            {
                "event": "mission_completed",
                "user_id": user_id,
                "mission_id": mission_id,
                "xp_earned": int(result.get("xp_earned", 0) or 0),
                "stage_evolved": result.get("stage_evolved") is not None,
            }
        )
    )
    return result


@router.post("/{mission_id}/rate", response_model=dict)
async def rate_mission(mission_id: str, body: RateMissionRequest, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    if body.rating < 1 or body.rating > 5:
        raise HTTPException(status_code=400, detail="Invalid rating")

    mission_result = await run_query(supabase_admin.table("missions")
        .select("id, user_id, type, interest_id, quit_path_id")
        .eq("id", mission_id)
        .eq("user_id", user_id)
        .single())
    if not mission_result.data:
        raise HTTPException(status_code=404, detail="Mission not found")

    mission = mission_result.data
    if str(mission.get("type") or "").lower() == "core":
        raise HTTPException(
            status_code=400,
            detail="Core missions do not support difficulty rating.",
        )

    existing = await run_query(supabase_admin.table("mission_ratings")
        .select("id")
        .eq("user_id", user_id)
        .eq("mission_id", mission_id)
        .limit(1))

    payload = {
        "user_id": user_id,
        "mission_id": mission_id,
        "interest_id": mission.get("interest_id"),
        "quit_path_id": mission.get("quit_path_id"),
        "rating": body.rating,
        "feedback_text": body.feedback_text,
    }

    if existing.data:
        rating_id = existing.data[0].get("id")
        await run_query(supabase_admin.table("mission_ratings").update(payload).eq("id", rating_id))
    else:
        await run_query(supabase_admin.table("mission_ratings").insert(payload))

    # ── Write next_session_note if feedback text mentions a specific issue ──
    try:
        feedback_txt = str(body.feedback_text or "").strip()
        rating_val = int(body.rating or 0)
        # Only write for "Too Hard" (1) with substantive feedback
        # or "Too Easy" (5) with substantive feedback
        if feedback_txt and len(feedback_txt) >= 10 and rating_val in (1, 5):
            # Fetch the interest_id for this mission
            m_res = await run_query(
                supabase_admin.table("missions")
                .select("interest_id")
                .eq("id", mission_id)
                .single()
            )
            interest_id = (m_res.data or {}).get("interest_id")
            if interest_id:
                difficulty_label = "too difficult" if rating_val == 1 else "too easy"
                note = (
                    f"User rated last mission as {difficulty_label}. "
                    f"Their feedback: \"{feedback_txt[:200]}\""
                )
                await run_query(
                    supabase_admin.table("interests")
                    .update({"next_session_note": note})
                    .eq("id", interest_id)
                )
    except Exception as e:
        logger.warning("next_session_note write failed: %s", str(e)[:120])
        # Non-fatal

    return {"saved": True}


@router.get("/journal", response_model=dict)
async def list_journal_entries(
    authorization: str = Header(None),
    from_date: str | None = None,
    to_date: str | None = None,
    limit: int = 200,
):
    """All journal entries for the user, newest first."""
    user_id = get_user_id_from_token(authorization)
    lim = max(1, min(int(limit), 500))
    q = (
        supabase_admin.table("journal_entries")
        .select(
            "id, mission_date, title, content, word_count, bookmarked, created_at, updated_at"
        )
        .eq("user_id", user_id)
        .order("mission_date", desc=True)
        .limit(lim)
    )
    if from_date:
        q = q.gte("mission_date", from_date)
    if to_date:
        q = q.lte("mission_date", to_date)
    result = await run_query(q)
    entries = []
    for row in result.data or []:
        entries.append(
            {
                "id": str(row["id"]),
                "date": row["mission_date"],
                "title": row.get("title") or "",
                "content": row.get("content") or "",
                "word_count": int(row.get("word_count") or 0),
                "bookmarked": bool(row.get("bookmarked")),
                "created_at": row.get("created_at"),
                "updated_at": row.get("updated_at"),
            }
        )
    return {"entries": entries}


@router.get("/journal/{entry_id}", response_model=dict)
async def get_journal_entry(entry_id: str, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    result = await run_query(supabase_admin.table("journal_entries")
        .select(
            "id, mission_date, title, content, word_count, bookmarked, created_at, updated_at"
        )
        .eq("id", entry_id)
        .eq("user_id", user_id)
        .single())
    if not result.data:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    row = result.data
    return {
        "id": str(row["id"]),
        "date": row["mission_date"],
        "title": row.get("title") or "",
        "content": row.get("content") or "",
        "word_count": int(row.get("word_count") or 0),
        "bookmarked": bool(row.get("bookmarked")),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


@router.post("/journal/save", response_model=dict)
async def save_journal(body: JournalSaveRequest, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    content = body.content or ""
    title = (body.title or "").strip()
    mission_date = body.date

    full_text = f"{title}\n\n{content}".strip() if title else content.strip()
    wc = journal_word_count(full_text) if full_text else 0

    await run_query(supabase_admin.table("journal_entries").upsert(
        {
            "user_id": user_id,
            "mission_date": mission_date,
            "title": title,
            "content": content,
            "word_count": wc,
            "bookmarked": bool(body.bookmarked),
        },
        on_conflict="user_id,mission_date",
    ))

    qualifies = journal_stored_qualifies_for_mission(title, content)
    mission_row = None
    if qualifies:
        jm = await run_query(supabase_admin.table("missions")
            .select("id, completed")
            .eq("user_id", user_id)
            .eq("mission_date", mission_date)
            .eq("type", "core")
            .eq("core_pillar", "journal")
            .limit(1))
        rows = jm.data or []
        mission_row = rows[0] if rows else None
        completion = None
        if mission_row and not mission_row.get("completed"):
            completion = await complete_mission(user_id, str(mission_row["id"]))
        return {
            "saved": True,
            "mission_completed": bool(mission_row),
            "word_count": wc,
            "completion": completion,
        }

    return {"saved": True, "mission_completed": False, "word_count": wc}


@router.post("/personal/estimate", response_model=dict)
async def personal_estimate(body: PersonalMissionEstimateRequest, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    execution_gap: float = 0.5
    daily_mission_count: int = 0
    core_failure_pattern: str = ""
    try:
        dna_row = (
            ((await run_query(supabase_admin.table("discipline_dna")
            .select("execution_gap, core_failure_pattern")
            .eq("user_id", user_id)
            .single())).data)
            or {}
        )
        execution_gap = float(dna_row.get("execution_gap") or 0.5)
        core_failure_pattern = str(dna_row.get("core_failure_pattern") or "")
    except Exception:
        pass

    try:
        tz_row = (
            ((await run_query(supabase_admin.table("users")
            .select("timezone")
            .eq("id", user_id)
            .single())).data)
            or {}
        )
        _today = get_user_date(str(tz_row.get("timezone") or "UTC"))
        count_res = (
            ((await run_query(supabase_admin.table("missions")
            .select("id")
            .eq("user_id", user_id)
            .eq("mission_date", _today))).data)
            or []
        )
        daily_mission_count = len(count_res)
    except Exception:
        pass

    return await estimate_personal_mission_tier(
        body.mission_text,
        execution_gap=execution_gap,
        daily_mission_count=daily_mission_count,
        core_failure_pattern=core_failure_pattern,
    )


@router.post("/personal/create", response_model=dict)
async def personal_create(body: PersonalMissionCreateRequest, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    user_tz_row = await run_query(supabase_admin.table("users")
        .select("timezone")
        .eq("id", user_id)
        .single())
    tz_str = str((user_tz_row.data or {}).get("timezone") or "UTC").strip() or "UTC"
    # Always anchor to the user's server-side local calendar day (avoids device vs profile TZ drift).
    mission_date = get_user_date(tz_str)

    existing_personal_res = await run_query(
        supabase_admin.table("missions")
        .select("id")
        .eq("user_id", user_id)
        .eq("mission_date", mission_date)
        .eq("type", "personal")
    )
    if len(existing_personal_res.data or []) >= 5:
        raise HTTPException(
            status_code=400,
            detail="Maximum 5 personal missions per day. Complete or remove one before adding more.",
        )

    # Accept tier exactly as sent by client; do not re-estimate or validate it here.
    tier = (body.tier or "medium").lower()

    # XP/PF are derived from tier (not from client-provided xp/pf).
    pf_personal = MISSION_PF["personal"]
    if tier == "easy":
        xp_value = PERSONAL_MISSION_XP_BY_TIER["easy"]
        pf_value = pf_personal["easy"]
        difficulty = "easy"
    elif tier == "hard":
        xp_value = PERSONAL_MISSION_XP_BY_TIER["hard"]
        pf_value = pf_personal["hard"]
        difficulty = "hard"
    elif tier == "multiday":
        xp_value, pf_value, difficulty = 8, 5, "medium"  # multiday is represented via flags; difficulty stays enum-safe
    else:
        xp_value = PERSONAL_MISSION_XP_BY_TIER["medium"]
        pf_value = pf_personal["medium"]
        difficulty = "medium"

    row = {
        "user_id": user_id,
        "type": "personal",
        "title": body.mission_text.strip(),
        "difficulty": difficulty,
        "xp_value": xp_value,
        "pf_value": pf_value,
        "mission_date": mission_date,
        "completed": False,
        "estimated_minutes": int(body.estimated_minutes),
    }
    if tier == "multiday":
        row["is_multiday"] = True
        row["multiday_total_days"] = int(body.multiday_days or 2)
        row["multiday_day_number"] = 1

    created = await run_query(supabase_admin.table("missions").insert(row))
    return created.data[0] if created.data else row


class UpdatePillarDifficultyRequest(BaseModel):
    pillar: str = Field(..., description="sleep | movement | hydration | mindfulness | no_phone")
    direction: str = Field(..., description="up | down")


@router.post("/core/difficulty", response_model=dict)
async def post_core_pillar_difficulty(
    body: UpdatePillarDifficultyRequest,
    authorization: str = Header(None),
):
    user_id = get_user_id_from_token(authorization)
    return await update_pillar_difficulty(
        user_id, body.pillar.strip().lower(), body.direction.strip().lower()
    )


@router.delete("/personal/{mission_id}", response_model=dict)
async def personal_delete(mission_id: str, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    mission_result = await run_query(supabase_admin.table("missions")
        .select("id, completed, type")
        .eq("id", mission_id)
        .eq("user_id", user_id)
        .single())
    if not mission_result.data:
        raise HTTPException(status_code=404, detail="Mission not found")

    if mission_result.data.get("type") != "personal":
        raise HTTPException(status_code=400, detail="Not a personal mission")
    if mission_result.data.get("completed"):
        raise HTTPException(status_code=400, detail="Cannot delete completed mission")

    await run_query(supabase_admin.table("missions").delete().eq("id", mission_id))
    return {"deleted": True}


@router.get("/{mission_id:uuid}", response_model=dict)
async def get_mission_detail(mission_id: UUID, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    mid = str(mission_id)
    result = await run_query(supabase_admin.table("missions")
        .select("*")
        .eq("id", mid)
        .eq("user_id", user_id)
        .single())
    if not result.data:
        raise HTTPException(status_code=404, detail="Mission not found")
    row = dict(result.data)
    _enrich_mission_rows([row])
    _attach_quit_path_detail(row)
    rating_existing = (
        ((await run_query(supabase_admin.table("mission_ratings")
        .select("rating, feedback_text")
        .eq("mission_id", mid)
        .eq("user_id", user_id)
        .limit(1))).data)
        or []
    )
    row["difficulty_rating"] = int(rating_existing[0]["rating"]) if rating_existing else None
    row["feedback_text"] = str(rating_existing[0].get("feedback_text") or "") if rating_existing else None
    return row
