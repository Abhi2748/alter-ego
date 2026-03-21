from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.api.auth import get_user_id_from_token
from app.core.supabase_client import supabase_admin
from app.core.constants import MISSION_PF, PERSONAL_MISSION_XP_BY_TIER, resolve_stat_tag
from app.core.journal_rules import journal_stored_qualifies_for_mission, word_count as journal_word_count
from app.agents.personal_mission_agent import estimate_personal_mission_tier
from app.services.mission_service import (
    complete_mission,
    generate_core_missions_for_user,
    get_days_since_registration,
    get_today_missions,
    get_user_date,
    sync_today_planner_missions,
)

router = APIRouter(prefix="/api/v1/missions", tags=["missions"])


def _enrich_mission_rows(rows: list[dict]) -> None:
    """
    Attach interest_name / quit_target_name for list UIs (Home chips).
    Missions only store interest_id / quit_target_id.
    """
    if not rows:
        return
    i_ids = list({str(r["interest_id"]) for r in rows if r.get("interest_id")})
    q_ids = list({str(r["quit_target_id"]) for r in rows if r.get("quit_target_id")})
    i_map: dict[str, str] = {}
    q_map: dict[str, str] = {}
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
    if q_ids:
        qr = (
            supabase_admin.table("quit_targets")
            .select("id, normalised_name, raw_text")
            .in_("id", q_ids)
            .execute()
        )
        for x in qr.data or []:
            label = (x.get("normalised_name") or x.get("raw_text") or "").strip() or "Resistance"
            q_map[str(x["id"])] = label
    for r in rows:
        iid = r.get("interest_id")
        if iid:
            r["interest_name"] = i_map.get(str(iid))
        qid = r.get("quit_target_id")
        if qid:
            r["quit_target_name"] = q_map.get(str(qid))


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
                    "is_journal_mission": r.get("is_journal_mission", False),
                    "core_pillar": r.get("core_pillar"),
                    "rationale": r.get("rationale"),
                    "domain_knowledge": r.get("domain_knowledge"),
                    "phase_principle": r.get("phase_principle"),
                    "interest_id": r.get("interest_id"),
                    "quit_target_id": r.get("quit_target_id"),
                    "estimated_minutes": r.get("estimated_minutes"),
                    "mission_date": r.get("mission_date"),
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


class PersonalMissionEstimateRequest(BaseModel):
    mission_text: str


class PersonalMissionCreateRequest(BaseModel):
    mission_text: str
    tier: str
    xp: int
    pf: int
    estimated_minutes: int
    date: str  # YYYY-MM-DD
    multiday_days: int | None = None


@router.get("/today", response_model=dict)
async def get_missions_today(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    user_row = (
        supabase_admin.table("users")
        .select("timezone, registration_date")
        .eq("id", user_id)
        .single()
        .execute()
    )
    timezone_str = (user_row.data or {}).get("timezone") or "UTC"
    registration_date = (user_row.data or {}).get("registration_date") or ""

    mission_date = get_user_date(timezone_str)

    # Ensure core missions exist (idempotent)
    await generate_core_missions_for_user(user_id, mission_date)

    # Interest + resistance: sync to current profile (adds missing, removes stale incomplete)
    await sync_today_planner_missions(user_id, mission_date)

    rows = await get_today_missions(user_id, mission_date)
    _enrich_mission_rows(rows)

    from app.services.stat_service import ensure_sp_day_aligned, set_total_missions_for_day

    await ensure_sp_day_aligned(user_id, mission_date)
    await set_total_missions_for_day(user_id, len(rows))

    return {
        "date": mission_date,
        "day_number": get_days_since_registration(str(registration_date), str(timezone_str)),
        "missions": _group_missions(rows),
        "summary": _summary(rows),
    }


@router.get("/date/{date_str}", response_model=dict)
async def get_missions_for_date(date_str: str, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    # Fetch missions for that date; do not create if missing
    result = (
        supabase_admin.table("missions")
        .select("*")
        .eq("user_id", user_id)
        .eq("mission_date", date_str)
        .execute()
    )
    rows = result.data or []
    _enrich_mission_rows(rows)
    return {
        "date": date_str,
        "missions": _group_missions(rows),
        "summary": _summary(rows),
    }


@router.post("/generate-interest", response_model=dict)
async def generate_interest_missions_today(authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    user_row = (
        supabase_admin.table("users")
        .select("timezone")
        .eq("id", user_id)
        .single()
        .execute()
    )
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
    user_row = (
        supabase_admin.table("users")
        .select("timezone")
        .eq("id", user_id)
        .single()
        .execute()
    )
    timezone_str = (user_row.data or {}).get("timezone") or "UTC"
    mission_date = get_user_date(timezone_str)
    sync = await sync_today_planner_missions(user_id, mission_date)
    rows = await get_today_missions(user_id, mission_date)
    res_only = [r for r in rows if r.get("type") == "resistance"]
    return {"sync": sync, "generated": len(res_only), "missions": res_only}


@router.post("/{mission_id}/complete", response_model=CompleteMissionResponse)
async def complete_mission_endpoint(mission_id: str, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    result = await complete_mission(user_id, mission_id)
    return result


@router.post("/{mission_id}/rate", response_model=dict)
async def rate_mission(mission_id: str, body: RateMissionRequest, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)
    if body.rating < 1 or body.rating > 5:
        raise HTTPException(status_code=400, detail="Invalid rating")

    mission_result = (
        supabase_admin.table("missions")
        .select("id, user_id, interest_id, quit_target_id")
        .eq("id", mission_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not mission_result.data:
        raise HTTPException(status_code=404, detail="Mission not found")

    mission = mission_result.data
    existing = (
        supabase_admin.table("mission_ratings")
        .select("id")
        .eq("user_id", user_id)
        .eq("mission_id", mission_id)
        .limit(1)
        .execute()
    )

    payload = {
        "user_id": user_id,
        "mission_id": mission_id,
        "interest_id": mission.get("interest_id"),
        "quit_target_id": mission.get("quit_target_id"),
        "rating": body.rating,
        "feedback_text": body.feedback_text,
    }

    if existing.data:
        rating_id = existing.data[0].get("id")
        supabase_admin.table("mission_ratings").update(payload).eq("id", rating_id).execute()
    else:
        supabase_admin.table("mission_ratings").insert(payload).execute()

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
    result = q.execute()
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
    result = (
        supabase_admin.table("journal_entries")
        .select(
            "id, mission_date, title, content, word_count, bookmarked, created_at, updated_at"
        )
        .eq("id", entry_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
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

    supabase_admin.table("journal_entries").upsert(
        {
            "user_id": user_id,
            "mission_date": mission_date,
            "title": title,
            "content": content,
            "word_count": wc,
            "bookmarked": bool(body.bookmarked),
        },
        on_conflict="user_id,mission_date",
    ).execute()

    qualifies = journal_stored_qualifies_for_mission(title, content)
    mission_row = None
    if qualifies:
        jm = (
            supabase_admin.table("missions")
            .select("id, completed")
            .eq("user_id", user_id)
            .eq("mission_date", mission_date)
            .eq("type", "core")
            .eq("core_pillar", "journal")
            .limit(1)
            .execute()
        )
        rows = jm.data or []
        mission_row = rows[0] if rows else None
        if mission_row and not mission_row.get("completed"):
            await complete_mission(user_id, str(mission_row["id"]))
        return {
            "saved": True,
            "mission_completed": bool(mission_row),
            "word_count": wc,
        }

    return {"saved": True, "mission_completed": False, "word_count": wc}


@router.post("/personal/estimate", response_model=dict)
async def personal_estimate(body: PersonalMissionEstimateRequest, authorization: str = Header(None)):
    get_user_id_from_token(authorization)
    return await estimate_personal_mission_tier(body.mission_text)


@router.post("/personal/create", response_model=dict)
async def personal_create(body: PersonalMissionCreateRequest, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

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
        "mission_date": body.date,
        "completed": False,
        "estimated_minutes": int(body.estimated_minutes),
    }
    if tier == "multiday":
        row["is_multiday"] = True
        row["multiday_total_days"] = int(body.multiday_days or 2)
        row["multiday_day_number"] = 1

    created = supabase_admin.table("missions").insert(row).execute()
    return created.data[0] if created.data else row


@router.delete("/personal/{mission_id}", response_model=dict)
async def personal_delete(mission_id: str, authorization: str = Header(None)):
    user_id = get_user_id_from_token(authorization)

    mission_result = (
        supabase_admin.table("missions")
        .select("id, completed, type")
        .eq("id", mission_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not mission_result.data:
        raise HTTPException(status_code=404, detail="Mission not found")

    if mission_result.data.get("type") != "personal":
        raise HTTPException(status_code=400, detail="Not a personal mission")
    if mission_result.data.get("completed"):
        raise HTTPException(status_code=400, detail="Cannot delete completed mission")

    supabase_admin.table("missions").delete().eq("id", mission_id).execute()
    return {"deleted": True}

