"""
Twin API endpoints.
"""

from __future__ import annotations

import json
import logging
import random
import uuid
from collections import Counter, defaultdict
from datetime import date as date_cls
from datetime import datetime, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.auth import get_user_id_from_token
from app.core.constants import (
    ABSENCE_INTERSTITIAL_MESSAGES,
    PET_NAMES,
    STAGE_NAMES,
    get_absence_strip_message,
    get_twin_status_line,
)
from app.core.supabase_client import supabase_admin
from app.agents.twin_chat_agent import get_relationship_phase
from app.services.mission_service import get_days_since_registration, get_user_date
from app.services.strip_message_service import update_strip_message
from app.services.power_score_service import (
    compute_power_score_value,
    fetch_twin_30d_completion_rate,
)
from app.services.twin_comparison_copy import (
    build_comparison_line,
    build_rank_card_oracle,
)
from app.services.absence_service import compute_absence_days, get_twin_accomplishments
from app.services.twin_service import (
    build_twin_day_timeline,
    ensure_twin_journal_backfilled,
    ensure_twin_simulated_for_today,
    get_home_strip_context,
    get_twin_xp_comparison,
    refresh_twin_gap_state,
    send_twin_message,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/twin", tags=["twin"])


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    response: str
    message: str | None = None
    message_id: str | None = None
    user_message_id: str | None = None
    twin_message_id: str | None = None
    emotional_register: str | None = None
    is_safety_response: bool = False
    safety_category: str | None = None


class TwinToneRatingBody(BaseModel):
    """Rate a Twin chat line (👍 / — / 👎)."""

    message_id: str = Field(..., description="UUID of the twin_messages row (role=twin)")
    rating: Literal["positive", "neutral", "negative"]


_TONE_META: dict[str, tuple[str, str]] = {
    "rival": ("Rival", "✦"),
    "philosopher": ("Philosopher", "◇"),
    "silent_force": ("Silent Force", "◆"),
}


def _normalize_twin_tone(raw: str | None) -> str:
    t = str(raw or "rival").lower().replace(" ", "_").replace("-", "_")
    if t == "silentforce":
        t = "silent_force"
    if t not in _TONE_META:
        return "rival"
    return t


class RateTwinMessageBody(BaseModel):
    rating: int = Field(..., description="Thumbs: -1 down, 0 neutral, 1 up")


class TwinMessage(BaseModel):
    id: str
    role: str
    content: str
    created_at: str
    message_rating: int | None = None
    tone_rating: str | None = None


class ChatHistoryResponse(BaseModel):
    messages: list[TwinMessage]


class TwinJournalEntryOut(BaseModel):
    id: str
    entry_date: str
    content: str
    relationship_phase: str
    missions_completed: int
    missions_total: int
    archetype: str | None = None
    created_at: str


class FeedEntry(BaseModel):
    entry_type: str
    timestamp_iso: str
    display_time: str
    entry_date: str
    mission_title: str | None = None
    mission_type: str | None = None
    core_pillar: str | None = None
    xp_earned: int | None = None
    twin_note: str | None = None
    is_twin: bool = False
    is_user: bool = False
    observation_text: str | None = None
    summary_date_label: str | None = None
    summary_missions_done: int | None = None
    summary_missions_total: int | None = None
    summary_xp: int | None = None
    summary_twin_quote: str | None = None


class ShadowFeedResponse(BaseModel):
    entries: list[FeedEntry]
    today_twin_xp: int
    today_user_xp: int
    today_twin_done: int
    today_user_done: int
    has_more_today: bool
    pending_count: int


def _shadow_feed_ampm(dt: datetime) -> str:
    """12-hour time like 7:12am (cross-platform; no platform-specific strftime)."""
    h12 = dt.hour % 12 or 12
    m = dt.minute
    suf = "am" if dt.hour < 12 else "pm"
    return f"{h12}:{m:02d}{suf}"


def _shadow_feed_summary_label(rec_d: date_cls, anchor: date_cls) -> str:
    day_labels = {0: "Today", 1: "Yesterday"}
    days_ago = (anchor - rec_d).days
    if days_ago in day_labels:
        return day_labels[days_ago]
    return rec_d.strftime("%a %b ") + str(rec_d.day)


class TwinUserState(BaseModel):
    username: str | None = None
    total_xp: int
    character_stage: int
    character_stage_name: str
    pet_stage: int
    pet_name: str | None = None
    pet_unlocked: bool
    current_streak: int
    power_score: int
    missions_today: list[dict]
    missions_completed_today: int
    missions_total_today: int
    xp_earned_today: int


class TwinRivalState(BaseModel):
    twin_xp: int
    character_stage: int
    character_stage_name: str
    pet_stage: int
    pet_name: str | None = None
    pet_unlocked: bool
    streak: int
    power_score: int
    gap_state: str
    missions_completed_today: int
    missions_total_today: int
    missed_mission_titles: list[str]
    xp_earned_today: int


class TwinGapState(BaseModel):
    xp_difference: int
    user_is_ahead: bool
    gap_state: str
    days_user_ahead: int


class TwinTimelineEvent(BaseModel):
    mission_title: str
    mission_type: str
    difficulty: str
    xp_earned: int
    completed_at: str


class DayComparison(BaseModel):
    """One day in the 7-day heatmap."""

    date: str
    day_label: str
    is_today: bool
    user_completion_rate: float
    twin_completion_rate: float
    user_missions_done: int
    user_missions_total: int
    twin_missions_done: int
    twin_missions_total: int


class PillarDNA(BaseModel):
    """7-day completion rate for one core pillar."""

    pillar: str
    pillar_label: str
    user_rate: float
    twin_rate: float
    user_count: int
    twin_count: int
    total_possible: int


class TwinStateResponse(BaseModel):
    strip_message: str | None = None
    twin_timeline: list[TwinTimelineEvent] = Field(default_factory=list)
    user: TwinUserState
    twin: TwinRivalState
    gap: TwinGapState
    week_heatmap: list[DayComparison] = Field(default_factory=list)
    pillar_dna: list[PillarDNA] = Field(default_factory=list)


@router.post("/chat", response_model=ChatResponse)
async def chat_with_twin(body: ChatRequest, authorization: str = Header(None)):
    """
    Send a message to the twin and get a response.
    The twin responds in character based on archetype and current gap state.
    """
    user_id = get_user_id_from_token(authorization)

    if not body.message or not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    message = body.message.strip()[:500]

    try:
        result = await send_twin_message(user_id, message)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    return ChatResponse(
        response=result["response"],
        message=result.get("message"),
        message_id=result.get("message_id"),
        user_message_id=result.get("user_message_id"),
        twin_message_id=result.get("twin_message_id"),
        emotional_register=result.get("emotional_register"),
        is_safety_response=bool(result.get("is_safety_response")),
        safety_category=result.get("safety_category"),
    )


@router.get("/chat/history", response_model=ChatHistoryResponse)
async def get_chat_history(authorization: str = Header(None), limit: int = 50):
    """
    Returns the last N messages of the twin chat conversation.
    Used when the chat screen opens to show previous messages.
    """
    user_id = get_user_id_from_token(authorization)

    result = (
        supabase_admin.table("twin_messages")
        .select("id, role, content, created_at, message_rating")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .limit(min(limit, 100))
        .execute()
    )

    rows = list(result.data or [])
    twin_ids = [str(r["id"]) for r in rows if r.get("role") == "twin"]
    ratings_map: dict[str, str] = {}
    if twin_ids:
        r2 = (
            supabase_admin.table("twin_tone_ratings")
            .select("twin_message_id, rating")
            .eq("user_id", user_id)
            .in_("twin_message_id", twin_ids)
            .execute()
        )
        for rr in r2.data or []:
            mid = rr.get("twin_message_id")
            if mid:
                ratings_map[str(mid)] = str(rr.get("rating") or "")

    for m in rows:
        tid = str(m.get("id") or "")
        m["tone_rating"] = ratings_map.get(tid)
        if m.get("message_rating") is None and m.get("tone_rating"):
            tr = m["tone_rating"]
            if tr == "positive":
                m["message_rating"] = 1
            elif tr == "negative":
                m["message_rating"] = -1
            elif tr == "neutral":
                m["message_rating"] = 0

    return {"messages": rows}


@router.post("/chat/{message_id}/rate")
async def rate_twin_message_endpoint(
    message_id: str,
    body: RateTwinMessageBody,
    authorization: str = Header(None),
):
    """
    Store thumbs up (+1) / neutral (0) / thumbs down (-1) on a twin message.
    Also mirrors into twin_tone_ratings for Settings → Tone History.
    """
    user_id = get_user_id_from_token(authorization)
    if body.rating not in (-1, 0, 1):
        raise HTTPException(status_code=400, detail="Rating must be -1, 0, or 1")

    try:
        uuid.UUID(message_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid message_id") from e

    msg_res = (
        supabase_admin.table("twin_messages")
        .select("id, role")
        .eq("id", message_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    msg = (msg_res.data or [None])[0]
    if not msg or msg.get("role") != "twin":
        raise HTTPException(status_code=404, detail="Twin message not found")

    supabase_admin.table("twin_messages").update({"message_rating": body.rating}).eq(
        "id", message_id
    ).eq("user_id", user_id).execute()

    tone_word = "positive" if body.rating == 1 else "negative" if body.rating == -1 else "neutral"

    dna_res = (
        supabase_admin.table("discipline_dna")
        .select("twin_tone_type")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    dna = (dna_res.data or [None])[0] or {}
    tone_type = _normalize_twin_tone(dna.get("twin_tone_type"))

    existing = (
        supabase_admin.table("twin_tone_ratings")
        .select("id")
        .eq("user_id", user_id)
        .eq("twin_message_id", message_id)
        .execute()
    )
    payload = {
        "user_id": user_id,
        "twin_message_id": message_id,
        "rating": tone_word,
        "tone_type": tone_type,
    }
    if existing.data:
        rid = existing.data[0].get("id")
        supabase_admin.table("twin_tone_ratings").update(
            {"rating": tone_word, "tone_type": tone_type}
        ).eq("id", rid).execute()
    else:
        supabase_admin.table("twin_tone_ratings").insert(payload).execute()

    return {"rated": True}


@router.post("/tone-rating", response_model=dict)
async def post_twin_tone_rating(body: TwinToneRatingBody, authorization: str = Header(None)):
    """
    Save or update the user's rating for one Twin chat message.
    Tone type is taken from current discipline_dna (voice at time of rating).
    """
    user_id = get_user_id_from_token(authorization)
    try:
        uuid.UUID(body.message_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid message_id") from e

    msg_res = (
        supabase_admin.table("twin_messages")
        .select("id, role")
        .eq("id", body.message_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    msg = (msg_res.data or [None])[0]
    if not msg or msg.get("role") != "twin":
        raise HTTPException(status_code=404, detail="Twin message not found")

    dna_res = (
        supabase_admin.table("discipline_dna")
        .select("twin_tone_type")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    dna = (dna_res.data or [None])[0] or {}
    tone_type = _normalize_twin_tone(dna.get("twin_tone_type"))

    existing = (
        supabase_admin.table("twin_tone_ratings")
        .select("id")
        .eq("user_id", user_id)
        .eq("twin_message_id", body.message_id)
        .execute()
    )
    payload = {
        "user_id": user_id,
        "twin_message_id": body.message_id,
        "rating": body.rating,
        "tone_type": tone_type,
    }
    if existing.data:
        rid = existing.data[0].get("id")
        supabase_admin.table("twin_tone_ratings").update(
            {"rating": body.rating, "tone_type": tone_type}
        ).eq("id", rid).execute()
    else:
        supabase_admin.table("twin_tone_ratings").insert(payload).execute()

    return {"ok": True, "tone_type": tone_type}


@router.get("/tone-history", response_model=dict)
async def get_twin_tone_history(authorization: str = Header(None)):
    """
    Aggregated twin tone ratings for Settings → Tone History.
    """
    user_id = get_user_id_from_token(authorization)

    rows = (
        supabase_admin.table("twin_tone_ratings")
        .select("tone_type, rating")
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )

    counts: Counter[tuple[str, str]] = Counter()
    for r in rows:
        tt = _normalize_twin_tone(r.get("tone_type"))
        rt = str(r.get("rating") or "")
        if rt not in ("positive", "neutral", "negative"):
            continue
        counts[(tt, rt)] += 1

    total = sum(counts.values())

    ratings_out: list[dict] = []
    for tone_key in ("rival", "philosopher", "silent_force"):
        for rating_key in ("positive", "neutral", "negative"):
            c = counts[(tone_key, rating_key)]
            if c <= 0:
                continue
            name, emoji = _TONE_META[tone_key]
            pct = round(100.0 * c / total, 1) if total else 0.0
            ratings_out.append(
                {
                    "tone_id": f"{tone_key}_{rating_key}",
                    "tone_name": name,
                    "tone_emoji": emoji,
                    "rating": rating_key,
                    "count": c,
                    "percentage": pct,
                }
            )

    dna_res = (
        supabase_admin.table("discipline_dna")
        .select("twin_tone_type, twin_intensity")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    dna = (dna_res.data or [None])[0] or {}
    intensity = int(dna.get("twin_intensity") or 3)
    intensity = max(1, min(5, intensity))

    positive_by_tone: defaultdict[str, int] = defaultdict(int)
    for (tt, rt), n in counts.items():
        if rt == "positive":
            positive_by_tone[tt] += n
    top_pos = sorted(positive_by_tone.items(), key=lambda x: -x[1])[:2]

    if len(top_pos) >= 2:
        current_blend = [
            _TONE_META[top_pos[0][0]][0],
            _TONE_META[top_pos[1][0]][0],
        ]
    elif len(top_pos) == 1:
        current_blend = [_TONE_META[top_pos[0][0]][0], f"Intensity {intensity}/5"]
    else:
        tt = _normalize_twin_tone(dna.get("twin_tone_type"))
        current_blend = [_TONE_META[tt][0], f"Intensity {intensity}/5"]

    return {
        "ratings": ratings_out,
        "total_ratings": total,
        "current_blend": current_blend,
    }


@router.get("/strip", response_model=dict)
async def get_twin_strip(authorization: str = Header(None)):
    """
    Returns the twin strip context for the home screen.
    Includes gap state, strip message, and twin stats.
    """
    user_id = get_user_id_from_token(authorization)
    prev_gap, new_gap = await refresh_twin_gap_state(user_id)
    # Match /twin/state: ensure today's twin_daily_record exists before reading XP,
    # so Home strip user/twin today bars stay aligned with Twin Comparison.
    await ensure_twin_simulated_for_today(user_id)
    context = await get_home_strip_context(user_id)

    # If no strip message exists yet, generate one now
    if not context.get("strip_message"):
        new_msg = await update_strip_message(user_id)
        if new_msg:
            context["strip_message"] = new_msg
    elif prev_gap is not None and prev_gap != new_gap:
        new_msg = await update_strip_message(user_id, force=True)
        if new_msg:
            context["strip_message"] = new_msg

    tz_row = (
        supabase_admin.table("users")
        .select("timezone, registration_date")
        .eq("id", user_id)
        .single()
        .execute()
        .data
        or {}
    )
    tz_str = str(tz_row.get("timezone") or "UTC").strip() or "UTC"
    today = get_user_date(tz_str)
    try:
        reg_n = get_days_since_registration(str(tz_row.get("registration_date") or ""), tz_str)
        days_active_strip = max(0, int(reg_n) - 1)
        context["relationship_phase"] = get_relationship_phase(days_active_strip)["phase"]
    except Exception:
        context["relationship_phase"] = None

    try:
        user_local_hour = datetime.now(ZoneInfo(tz_str)).hour
    except Exception:
        user_local_hour = datetime.now(timezone.utc).hour

    try:
        activity_check = (
            supabase_admin.table("xp_log")
            .select("id")
            .eq("user_id", user_id)
            .eq("log_date", today)
            .limit(1)
            .execute()
        )
        user_active_today = bool(activity_check.data)
    except Exception:
        user_active_today = False

    context["status_line"] = get_twin_status_line(user_local_hour, user_active_today)
    xp_data = get_twin_xp_comparison(user_id, today)
    context["user_xp_today"] = xp_data["user_xp_today"]
    context["twin_xp_today"] = xp_data["twin_xp_today"]

    try:
        user_abs = (
            supabase_admin.table("users")
            .select(
                "absence_days, last_active_date, archetype, last_streak_date, "
                "timezone, twin_tone_override, twin_tone_override_until"
            )
            .eq("id", user_id)
            .single()
            .execute()
            .data
            or {}
        )
        absence_today = get_user_date(str(user_abs.get("timezone") or tz_str or "UTC"))
        absence_days = compute_absence_days(supabase_admin, user_id, user_abs, absence_today)
        context["absence_days"] = absence_days
        context["absence_strip_message"] = get_absence_strip_message(
            absence_days, str(user_abs.get("archetype") or "")
        )
        context["absence_interstitial_message"] = ABSENCE_INTERSTITIAL_MESSAGES.get(absence_days)
        context["twin_accomplishments"] = []
        if absence_days >= 5:
            context["twin_accomplishments"] = get_twin_accomplishments(
                supabase_admin, user_id, 14, absence_today
            )
    except Exception:
        context["absence_days"] = None
        context["absence_strip_message"] = None
        context["absence_interstitial_message"] = None
        context["twin_accomplishments"] = []

    return context


@router.get("/journal", response_model=list[TwinJournalEntryOut])
async def get_twin_journal(
    authorization: str = Header(None),
    limit: int = Query(14, ge=1, le=30, description="Max entries to return (newest first)"),
):
    """
    Twin's daily journal — last N entries, newest first.
    Used by the Journal tab on Twin Comparison. JWT required; scoped to the authenticated user.
    """
    user_id = get_user_id_from_token(authorization)

    await ensure_twin_journal_backfilled(user_id)

    result = (
        supabase_admin.table("twin_journal")
        .select(
            "id, entry_date, content, relationship_phase, missions_completed, "
            "missions_total, archetype, created_at"
        )
        .eq("user_id", user_id)
        .order("entry_date", desc=True)
        .limit(limit)
        .execute()
    )

    rows = result.data or []
    dates = sorted({str(r.get("entry_date", ""))[:10] for r in rows if r.get("entry_date")})
    counts_by_date: dict[str, tuple[int, int]] = {}
    if dates:
        try:
            all_m = (
                supabase_admin.table("missions")
                .select("mission_date, completed")
                .eq("user_id", user_id)
                .in_("mission_date", dates)
                .execute()
                .data
                or []
            )
            by_d: dict[str, list] = {}
            for m in all_m:
                d = str(m.get("mission_date", ""))[:10]
                if not d:
                    continue
                by_d.setdefault(d, []).append(m)
            for d, lst in by_d.items():
                counts_by_date[d] = (
                    sum(1 for x in lst if x.get("completed")),
                    len(lst),
                )
        except Exception:
            counts_by_date = {}

    out: list[TwinJournalEntryOut] = []
    for r in rows:
        ca = r.get("created_at")
        if ca is None:
            created_at_s = ""
        elif hasattr(ca, "isoformat"):
            created_at_s = ca.isoformat()
        else:
            created_at_s = str(ca)
        ed = str(r.get("entry_date", ""))[:10]
        mc = int(r.get("missions_completed") or 0)
        mt = int(r.get("missions_total") or 0)
        if ed in counts_by_date:
            mc, mt = counts_by_date[ed]
        out.append(
            TwinJournalEntryOut(
                id=str(r.get("id", "")),
                entry_date=str(r.get("entry_date", "")),
                content=str(r.get("content") or ""),
                relationship_phase=str(r.get("relationship_phase") or "observer"),
                missions_completed=mc,
                missions_total=mt,
                archetype=r.get("archetype"),
                created_at=created_at_s,
            )
        )
    return out


def _empty_shadow_feed() -> ShadowFeedResponse:
    return ShadowFeedResponse(
        entries=[],
        today_twin_xp=0,
        today_user_xp=0,
        today_twin_done=0,
        today_user_done=0,
        has_more_today=False,
        pending_count=0,
    )


@router.get("/feed", response_model=ShadowFeedResponse)
async def get_shadow_feed(
    authorization: str = Header(None),
    days_back: int = Query(3, ge=1, le=14, description="How many past calendar days before today to summarize"),
):
    """
    Shadow Feed — merged timeline of Twin (progressive reveal by simulated hour) and user completions,
    plus optional observations and prior-day summary cards. No LLM. At most five DB round-trips.
    """
    user_id = get_user_id_from_token(authorization)

    try:
        from app.core.constants import (
            TWIN_FEED_OBSERVATIONS,
            TWIN_FEED_REACTION_USER_BEATS,
            TWIN_FEED_REACTION_USER_MATCHES,
            get_twin_feed_note,
        )

        await ensure_twin_simulated_for_today(user_id)

        user_row = (
            supabase_admin.table("users")
            .select("timezone, registration_date")
            .eq("id", user_id)
            .single()
            .execute()
            .data
            or {}
        )

        tz_str = str(user_row.get("timezone") or "UTC").strip() or "UTC"
        try:
            tz = ZoneInfo(tz_str)
        except Exception:
            tz = ZoneInfo("UTC")

        now_local = datetime.now(tz)
        current_hour = now_local.hour
        today = get_user_date(tz_str)
        anchor = date_cls.fromisoformat(today)
        past_start = str(anchor - timedelta(days=days_back))
        past_end = str(anchor - timedelta(days=1))

        twin_today = (
            supabase_admin.table("twin_mission_log")
            .select("mission_title, mission_type, core_pillar, simulated_hour, completed_at")
            .eq("user_id", user_id)
            .eq("mission_date", today)
            .order("simulated_hour", desc=False)
            .execute()
            .data
            or []
        )

        revealed_twin = [r for r in twin_today if int(r.get("simulated_hour") or 0) <= current_hour]
        pending_twin = [r for r in twin_today if int(r.get("simulated_hour") or 0) > current_hour]
        if not revealed_twin and twin_today:
            revealed_twin = list(twin_today)
            pending_twin = []

        user_today = (
            supabase_admin.table("missions")
            .select("title, type, core_pillar, xp_value, completed, completed_at")
            .eq("user_id", user_id)
            .eq("mission_date", today)
            .eq("completed", True)
            .order("completed_at", desc=False)
            .execute()
            .data
            or []
        )

        xp_today_rows = (
            supabase_admin.table("xp_log")
            .select("amount")
            .eq("user_id", user_id)
            .eq("log_date", today)
            .execute()
            .data
            or []
        )
        user_xp_today = sum(int(r.get("amount") or 0) for r in xp_today_rows)

        twin_daily_rows = (
            supabase_admin.table("twin_daily_record")
            .select("record_date, missions_completed, missions_assigned, xp_earned")
            .eq("user_id", user_id)
            .gte("record_date", past_start)
            .lte("record_date", today)
            .execute()
            .data
            or []
        )

        def _rec_date_key(r: dict) -> str:
            rd = r.get("record_date")
            return str(rd)[:10] if rd is not None else ""

        today_twin_rec: dict = {}
        twin_past: list[dict] = []
        for r in twin_daily_rows:
            dk = _rec_date_key(r)
            if dk == today:
                today_twin_rec = r
            elif dk and dk < today:
                twin_past.append(r)
        twin_past.sort(key=_rec_date_key, reverse=True)

        twin_journals = (
            supabase_admin.table("twin_journal")
            .select("entry_date, content")
            .eq("user_id", user_id)
            .gte("entry_date", past_start)
            .lte("entry_date", past_end)
            .execute()
            .data
            or []
        )
        journal_by_date = {str(j.get("entry_date", ""))[:10]: (j.get("content") or "") for j in twin_journals}

        twin_xp_today = int(today_twin_rec.get("xp_earned") or 0)
        twin_done_today = int(today_twin_rec.get("missions_completed") or 0)
        user_done_today = len(user_today)

        twin_titles_done = {str(r.get("mission_title") or "").lower() for r in revealed_twin}

        entries: list[FeedEntry] = []

        for r in revealed_twin:
            hour = int(r.get("simulated_hour") or 9)
            ca = r.get("completed_at")
            sim_dt: datetime
            if ca:
                try:
                    raw = str(ca).replace("Z", "+00:00")
                    sim_dt = datetime.fromisoformat(raw)
                    if sim_dt.tzinfo is None:
                        sim_dt = sim_dt.replace(tzinfo=timezone.utc)
                    sim_dt = sim_dt.astimezone(tz)
                except Exception:
                    sim_dt = datetime(anchor.year, anchor.month, anchor.day, hour, 0, 0, tzinfo=tz)
            else:
                sim_dt = datetime(anchor.year, anchor.month, anchor.day, hour, 0, 0, tzinfo=tz)
            pillar_raw = r.get("core_pillar")
            pillar_s = str(pillar_raw).lower() if pillar_raw else None
            note = get_twin_feed_note(
                pillar=pillar_s,
                simulated_hour=sim_dt.hour,
                mission_type=str(r.get("mission_type") or "core"),
            )
            entries.append(
                FeedEntry(
                    entry_type="twin_completion",
                    timestamp_iso=sim_dt.isoformat(),
                    display_time=_shadow_feed_ampm(sim_dt),
                    entry_date=today,
                    mission_title=r.get("mission_title"),
                    mission_type=r.get("mission_type"),
                    core_pillar=r.get("core_pillar"),
                    xp_earned=None,
                    twin_note=note,
                    is_twin=True,
                    is_user=False,
                )
            )

        for m in user_today:
            completed_at = str(m.get("completed_at") or "")
            try:
                user_dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00")).astimezone(tz)
                display = _shadow_feed_ampm(user_dt)
                ts_iso = user_dt.isoformat()
            except Exception:
                display = "today"
                ts_iso = now_local.isoformat()

            title_key = str(m.get("title") or "").lower()
            reaction = (
                random.choice(TWIN_FEED_REACTION_USER_MATCHES)
                if title_key in twin_titles_done
                else random.choice(TWIN_FEED_REACTION_USER_BEATS)
            )

            entries.append(
                FeedEntry(
                    entry_type="user_completion",
                    timestamp_iso=ts_iso,
                    display_time=display,
                    entry_date=today,
                    mission_title=m.get("title"),
                    mission_type=m.get("type"),
                    core_pillar=m.get("core_pillar"),
                    xp_earned=int(m.get("xp_value") or 0),
                    twin_note=reaction,
                    is_twin=False,
                    is_user=True,
                )
            )

        entries.sort(key=lambda e: e.timestamp_iso, reverse=True)

        obs_text: str | None = None
        gap_xp = twin_xp_today - user_xp_today

        if user_done_today == 0 and twin_done_today >= 2:
            tpl = random.choice(TWIN_FEED_OBSERVATIONS["opened_without_completing"])
            try:
                obs_text = tpl.format(N="several", twin_done=twin_done_today)
            except Exception:
                obs_text = tpl
        elif gap_xp > 50:
            tpl = random.choice(TWIN_FEED_OBSERVATIONS["gap_growing"])
            try:
                obs_text = tpl.format(gap=gap_xp)
            except Exception:
                obs_text = tpl
        elif user_xp_today > twin_xp_today and user_xp_today > 0:
            obs_text = random.choice(TWIN_FEED_OBSERVATIONS["user_taking_lead"])

        if obs_text:
            entries.insert(
                0,
                FeedEntry(
                    entry_type="observation",
                    timestamp_iso=now_local.isoformat(),
                    display_time="now",
                    entry_date=today,
                    observation_text=obs_text,
                ),
            )

        for rec in twin_past:
            rec_date = _rec_date_key(rec)
            if not rec_date:
                continue
            try:
                rec_d = date_cls.fromisoformat(rec_date)
                label = _shadow_feed_summary_label(rec_d, anchor)
                summary_dt = datetime(rec_d.year, rec_d.month, rec_d.day, 23, 59, 59, tzinfo=tz)
                summary_ts = summary_dt.isoformat()
            except Exception:
                label = rec_date
                summary_ts = f"{rec_date}T23:59:59"

            quote = journal_by_date.get(rec_date, "")
            if quote and len(quote) > 120:
                quote = quote[:117] + "..."

            entries.append(
                FeedEntry(
                    entry_type="day_summary",
                    timestamp_iso=summary_ts,
                    display_time=label,
                    entry_date=rec_date,
                    summary_date_label=label,
                    summary_missions_done=int(rec.get("missions_completed") or 0),
                    summary_missions_total=int(rec.get("missions_assigned") or 0),
                    summary_xp=int(rec.get("xp_earned") or 0),
                    summary_twin_quote=quote or None,
                )
            )

        return ShadowFeedResponse(
            entries=entries,
            today_twin_xp=twin_xp_today,
            today_user_xp=user_xp_today,
            today_twin_done=twin_done_today,
            today_user_done=user_done_today,
            has_more_today=len(pending_twin) > 0,
            pending_count=len(pending_twin),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "shadow_feed_error",
                    "user_id": user_id,
                    "error": str(e)[:200],
                }
            )
        )
        return _empty_shadow_feed()


@router.get("/state", response_model=TwinStateResponse)
async def get_twin_state(authorization: str = Header(None)):
    """
    Returns full twin state for the Twin Comparison screen.

    Ensures today's twin simulation exists (same as 1:00 local job, but on-demand if the user
    opens the app earlier) so timeline + stats are never empty on day 1.
    """
    user_id = get_user_id_from_token(authorization)
    try:
        return await _build_twin_state_response(user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "twin_state_error",
                    "user_id": user_id,
                    "error": str(e)[:200],
                }
            )
        )
        raise HTTPException(status_code=500, detail="Unable to load twin state") from e


async def _build_twin_state_response(user_id: str) -> dict:
    await ensure_twin_simulated_for_today(user_id)
    await refresh_twin_gap_state(user_id)

    user_result = (
        supabase_admin.table("users")
        .select(
            "total_xp, character_stage, pet_stage, pet_unlocked, "
            "current_streak, timezone, username, power_score, archetype"
        )
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = user_result.data or {}

    twin_result = (
        supabase_admin.table("twin_state").select("*").eq("user_id", user_id).single().execute()
    )
    twin = twin_result.data or {}

    if not (twin.get("strip_message") or "").strip():
        new_strip = await update_strip_message(user_id)
        if new_strip:
            twin["strip_message"] = new_strip
        else:
            twin_refresh = (
                supabase_admin.table("twin_state")
                .select("strip_message")
                .eq("user_id", user_id)
                .single()
                .execute()
            )
            if twin_refresh.data:
                twin["strip_message"] = twin_refresh.data.get("strip_message")

    today = get_user_date(user.get("timezone", "UTC") or "UTC")

    user_missions = (
        supabase_admin.table("missions")
        .select("id, title, type, difficulty, completed, xp_value")
        .eq("user_id", user_id)
        .eq("mission_date", today)
        .execute()
        .data
        or []
    )

    twin_today = (
        supabase_admin.table("twin_daily_record")
        .select("*")
        .eq("user_id", user_id)
        .eq("record_date", today)
        .execute()
        .data
    )
    twin_record = twin_today[0] if twin_today else None

    week_heatmap: list[dict] = []
    pillar_dna: list[dict] = []
    try:
        anchor = date_cls.fromisoformat(today)
    except Exception:
        anchor = date_cls.today()
    week_dates = [anchor - timedelta(days=i) for i in range(6, -1, -1)]
    week_start = str(week_dates[0])

    # ── 7-day heatmap ─────────────────────────────────────────────────────
    try:
        user_week_missions = (
            supabase_admin.table("missions")
            .select("mission_date, completed, core_pillar")
            .eq("user_id", user_id)
            .in_("type", ["core", "interest", "resistance", "personal"])
            .gte("mission_date", week_start)
            .lte("mission_date", today)
            .execute()
            .data
            or []
        )
        user_by_date: dict[str, list] = {}
        for m in user_week_missions:
            d = str(m.get("mission_date", ""))[:10]
            user_by_date.setdefault(d, []).append(m)

        twin_week_records = (
            supabase_admin.table("twin_daily_record")
            .select("record_date, missions_completed, missions_assigned")
            .eq("user_id", user_id)
            .gte("record_date", week_start)
            .lte("record_date", today)
            .execute()
            .data
            or []
        )
        twin_by_date: dict[str, dict] = {
            str(r.get("record_date", ""))[:10]: r for r in twin_week_records
        }

        day_labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

        for d in week_dates:
            d_str = str(d)
            user_missions_day = user_by_date.get(d_str, [])
            user_total = len(user_missions_day)
            user_done = sum(1 for m in user_missions_day if m.get("completed"))
            user_rate = (user_done / user_total) if user_total > 0 else 0.0

            twin_rec = twin_by_date.get(d_str, {})
            twin_total = int(twin_rec.get("missions_assigned") or 0)
            twin_done = int(twin_rec.get("missions_completed") or 0)
            twin_rate = (twin_done / twin_total) if twin_total > 0 else 0.0

            if d_str == today and twin_total == 0 and twin_record:
                twin_total = int(twin_record.get("missions_assigned") or 0)
                twin_done = int(twin_record.get("missions_completed") or 0)
                twin_rate = (twin_done / twin_total) if twin_total > 0 else 0.0

            week_heatmap.append(
                {
                    "date": d_str,
                    "day_label": day_labels[d.weekday()],
                    "is_today": d_str == today,
                    "user_completion_rate": round(user_rate, 3),
                    "twin_completion_rate": round(twin_rate, 3),
                    "user_missions_done": user_done,
                    "user_missions_total": user_total,
                    "twin_missions_done": twin_done,
                    "twin_missions_total": twin_total,
                }
            )

    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "twin_state_heatmap_error",
                    "user_id": user_id,
                    "error": str(e)[:200],
                }
            )
        )
        week_heatmap = []

    # ── Pillar DNA ───────────────────────────────────────────────────────────
    try:
        pillar_labels_map = {
            "sleep": "Sleep",
            "movement": "Movement",
            "hydration": "Hydration",
            "mindfulness": "Stillness",
            "no_phone": "Focus",
        }
        pillar_order = ["sleep", "movement", "hydration", "mindfulness", "no_phone"]

        user_pillar_missions = (
            supabase_admin.table("missions")
            .select("core_pillar, completed")
            .eq("user_id", user_id)
            .eq("type", "core")
            .eq("is_journal_mission", False)
            .gte("mission_date", week_start)
            .lte("mission_date", today)
            .execute()
            .data
            or []
        )

        twin_pillar_missions = (
            supabase_admin.table("twin_mission_log")
            .select("core_pillar, mission_date")
            .eq("user_id", user_id)
            .gte("mission_date", week_start)
            .lte("mission_date", today)
            .not_.is_("core_pillar", "null")
            .in_("core_pillar", pillar_order)
            .execute()
            .data
            or []
        )

        user_pillar_done: dict[str, int] = {}
        user_pillar_total: dict[str, int] = {}
        for m in user_pillar_missions:
            p = str(m.get("core_pillar") or "").lower()
            if p not in pillar_order:
                continue
            user_pillar_total[p] = user_pillar_total.get(p, 0) + 1
            if m.get("completed"):
                user_pillar_done[p] = user_pillar_done.get(p, 0) + 1

        twin_pillar_done: dict[str, int] = {}
        for m in twin_pillar_missions:
            p = str(m.get("core_pillar") or "").lower()
            if p not in pillar_order:
                continue
            twin_pillar_done[p] = twin_pillar_done.get(p, 0) + 1

        for pillar in pillar_order:
            u_total = user_pillar_total.get(pillar, 0)
            u_done = user_pillar_done.get(pillar, 0)
            t_done = twin_pillar_done.get(pillar, 0)
            t_total = u_total

            if u_total == 0 and t_total == 0:
                continue

            u_rate = round(u_done / u_total, 3) if u_total > 0 else 0.0
            t_raw = (t_done / t_total) if t_total > 0 else 0.0
            t_rate = round(min(1.0, t_raw), 3)

            pillar_dna.append(
                {
                    "pillar": pillar,
                    "pillar_label": pillar_labels_map.get(pillar, pillar.capitalize()),
                    "user_rate": u_rate,
                    "twin_rate": t_rate,
                    "user_count": u_done,
                    "twin_count": t_done,
                    "total_possible": u_total,
                }
            )

    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "twin_state_dna_error",
                    "user_id": user_id,
                    "error": str(e)[:200],
                }
            )
        )
        pillar_dna = []

    twin_timeline = build_twin_day_timeline(
        user_id,
        today,
        twin_record.get("completed_mission_ids") if twin_record else None,
        user.get("timezone", "UTC") or "UTC",
    )

    # User XP earned today
    xp_today_rows = (
        supabase_admin.table("xp_log")
        .select("amount")
        .eq("user_id", user_id)
        .eq("log_date", today)
        .execute()
        .data
        or []
    )
    xp_today = sum(r.get("amount", 0) for r in xp_today_rows)

    # Days user has been ahead since last_passed_at
    last_passed = twin.get("last_passed_at")
    user_is_ahead = user.get("total_xp", 0) > twin.get("twin_xp", 0)
    days_user_ahead = 0
    if last_passed and user_is_ahead:
        try:
            days_user_ahead = (date_cls.today() - date_cls.fromisoformat(str(last_passed)[:10])).days
        except Exception:
            days_user_ahead = 0

    twin_xp = int(twin.get("twin_xp", 0) or 0)

    try:
        anchor_30 = date_cls.fromisoformat(today)
    except Exception:
        anchor_30 = date_cls.today()
    thirty_days_ago = str(anchor_30 - timedelta(days=30))
    twin_completion = fetch_twin_30d_completion_rate(user_id, thirty_days_ago)

    twin_power_score = compute_power_score_value(
        int(twin.get("twin_character_stage") or 1),
        twin_xp,
        int(twin.get("twin_pet_stage") or 0),
        bool(twin.get("twin_pet_unlocked")),
        int(twin.get("twin_streak") or 0),
        twin_completion,
    )

    gs = str(twin.get("current_gap_state") or "neck_and_neck")
    xp_diff_abs = abs(int(user.get("total_xp", 0) or 0) - twin_xp)
    comparison_line = build_comparison_line(
        user_id,
        today,
        gap_state=gs,
        xp_difference=xp_diff_abs,
        user_is_ahead=bool(user_is_ahead),
        user_streak=int(user.get("current_streak", 0) or 0),
        twin_streak=int(twin.get("twin_streak", 0) or 0),
        user_xp=int(user.get("total_xp", 0) or 0),
        twin_xp=twin_xp,
        user_power_score=int(user.get("power_score", 0) or 0),
        twin_power_score=int(twin_power_score),
        user_done_today=sum(1 for m in user_missions if m.get("completed")),
        user_total_today=len(user_missions),
        twin_done_today=int(twin_record["missions_completed"]) if twin_record else 0,
        twin_total_today=int(twin_record["missions_assigned"]) if twin_record else 0,
        week_heatmap=week_heatmap,
    )
    rank_card_oracle = build_rank_card_oracle(
        user_id,
        today,
        username=str(user.get("username") or ""),
        archetype=user.get("archetype"),
        character_stage_name=STAGE_NAMES[user.get("character_stage", 1) - 1],
        streak=int(user.get("current_streak", 0) or 0),
        power_score=int(user.get("power_score", 0) or 0),
        total_xp=int(user.get("total_xp", 0) or 0),
    )

    return {
        "strip_message": twin.get("strip_message"),
        "comparison_line": comparison_line,
        "rank_card_oracle": rank_card_oracle,
        "twin_timeline": twin_timeline,
        "user": {
            "username": user.get("username"),
            "total_xp": user.get("total_xp", 0),
            "character_stage": user.get("character_stage", 1),
            "character_stage_name": STAGE_NAMES[user.get("character_stage", 1) - 1],
            "pet_stage": user.get("pet_stage", 0),
            "pet_name": PET_NAMES[user.get("pet_stage", 1) - 1] if user.get("pet_unlocked") else None,
            "pet_unlocked": user.get("pet_unlocked", False),
            "current_streak": user.get("current_streak", 0),
            "power_score": int(user.get("power_score", 0) or 0),
            "missions_today": user_missions,
            "missions_completed_today": sum(1 for m in user_missions if m.get("completed")),
            "missions_total_today": len(user_missions),
            "xp_earned_today": xp_today,
        },
        "twin": {
            "twin_xp": twin_xp,
            "character_stage": twin.get("twin_character_stage", 1),
            "character_stage_name": STAGE_NAMES[twin.get("twin_character_stage", 1) - 1],
            "pet_stage": twin.get("twin_pet_stage", 0),
            "pet_name": PET_NAMES[twin.get("twin_pet_stage", 1) - 1] if twin.get("twin_pet_unlocked") else None,
            "pet_unlocked": twin.get("twin_pet_unlocked", False),
            "streak": twin.get("twin_streak", 0),
            "power_score": int(twin_power_score),
            "gap_state": twin.get("current_gap_state", "neck_and_neck"),
            "missions_completed_today": twin_record["missions_completed"] if twin_record else 0,
            "missions_total_today": twin_record["missions_assigned"] if twin_record else 0,
            "missed_mission_titles": twin_record["missed_mission_titles"] if twin_record else [],
            "xp_earned_today": twin_record["xp_earned"] if twin_record else 0,
        },
        "gap": {
            "xp_difference": abs(user.get("total_xp", 0) - twin.get("twin_xp", 0)),
            "user_is_ahead": user_is_ahead,
            "gap_state": twin.get("current_gap_state", "neck_and_neck"),
            "days_user_ahead": days_user_ahead,
        },
        "week_heatmap": week_heatmap,
        "pillar_dna": pillar_dna,
    }

