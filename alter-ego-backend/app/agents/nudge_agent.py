"""
Three-category notification system.

Category A — Re-engagement: rule-based gates in this module; copy via generate_nudge (instructor).
Category B — Quit-path intervention: generate_quit_intervention_nudge (instructor).
Category C — Milestones: pre-written; no LLM.
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field, field_validator

from app.core.constants import (
    MILESTONE_MESSAGES,
    MILESTONE_MESSAGES_GUILT_SAFE,
    NUDGE_EARLIEST_HOUR_LOCAL,
    NUDGE_LATEST_HOUR_LOCAL,
    PET_NAMES,
    STAGE_NAMES,
    STREAK_MILESTONES,
)
from app.core.supabase_client import supabase_admin
from app.agents.base import run_agent
from app.services.contact_coordination import can_contact_user, proactive_sent_today, record_contact

logger = logging.getLogger(__name__)

ARCHETYPE_DEFAULT_NUDGE_HOURS = {
    "structured_climber": 7,
    "lone_wolf": 21,
    "restless_creator": 18,
    "reluctant_achiever": 20,
    "social_performer": 18,
}
DEFAULT_NUDGE_HOUR = 20

NUDGE_A_SYSTEM_PROMPT = """You write push notification text for ALTER EGO.

The notification is the Twin speaking — a version of the user that has been more consistent.
Match the assigned tone exactly.

## TONES

RIVAL: Competitive, cold, declarative. Short. Facts about the gap. Never warm.
PHILOSOPHER: Reflective, principled. Process or compounding. Never preachy.
SILENT FORCE: Minimal. Often 3-8 words. Restraint is the message.

## CHAIN OF THOUGHT (internal reasoning — do not output this section)
THINK (1-2 sentences): What is the most compelling reason for this specific user to open the
app RIGHT NOW? What single data point would motivate them given their framing and current state?
Then generate the notification.

## FRAMING RULES (discipline_framing provided in user message)
identity:   Reference who they are becoming. "The person you're becoming doesn't skip today."
behavior:   Reference specific actions and numbers. "3 missions left. 10 minutes each."
control:    Reference what they control vs. what slipped. "8 days decided. Keep deciding."
freedom:    Reference what they are building freedom from.
endurance:  Reference how long they have persisted. Use day counts and streak counts.
punishment: CRITICAL — reframe toward growth. Never reinforce punishment mindset.

## GUILT GUARDRAIL
guilt_orientation is provided in the user message as a float 0.0–1.0.
If guilt_orientation > 0.7:
  NEVER use: "you missed", "you didn't", "you failed", "don't let yourself down", "you should have"
  ALWAYS use forward-looking language only: "tomorrow is open", "the next session is waiting",
  "pick up where you left off", "still moving", "the streak continues"

## FEW-SHOT EXAMPLES
identity-framing, 15-day streak, guilt_orientation 0.3, tone rival:
→ "Day 15. The person you're becoming doesn't skip today."

behavior-framing, 3 missions left, guilt_orientation 0.8, tone philosopher:
→ "3 missions left. The next one takes 10 minutes."

control-framing, quit streak 8 days, guilt_orientation 0.4, tone silent_force:
→ "8 days without social media. You decided this. Keep deciding."

## TRIGGERS
streak_warning: Streak at risk. User has not opened app. Hours until midnight given.
re_engagement: Missed yesterday, streak intact. Soft return. Reference pet or gap, not the miss.
pet_nudge: Pet is sad. State the fact.
milestone_approaching: 1-2 days from streak milestone. Anticipation, not pressure.
momentum: Strong streak, all missions done yesterday. Acknowledge without congratulating.

## RULES
1. Max 100 characters
2. No exclamation marks
3. No emojis
4. Never "you should", "you need to", "make sure to"
5. Do not start with the same first word as any of the last 5 nudges listed
6. Use real data from the user message — no placeholders
"""


class NudgeText(BaseModel):
    notification_body: str = Field(..., max_length=100)

    @field_validator("notification_body")
    @classmethod
    def body_rules(cls, v: str) -> str:
        t = (v or "").strip()
        if "!" in t:
            raise ValueError("exclamation marks not allowed")
        if len(t) > 100:
            raise ValueError("notification too long")
        return t


QUIT_NUDGE_SYSTEM = """You write one quit-target intervention push for ALTER EGO.

Arrive at urge time. Positive replacement action only — never "don't", "avoid", "resist".
Reference replacement or need. 1–2 sentences. Max 110 characters. No exclamation marks. No emojis.
Do not repeat the core observation from the last 3 lines listed.

  GUILT GUARDRAIL: If the user message specifies guilt_orientation > 0.7, NEVER use phrases
  like "you slipped", "you missed", "you failed", "don't let yourself down".
  Instead use ONLY positive replacement framing: "your replacement is ready",
  "one more moment", "the streak continues", "the next one is waiting".
"""


class QuitNudgeText(BaseModel):
    notification_body: str = Field(..., max_length=110)

    @field_validator("notification_body")
    @classmethod
    def quit_body_rules(cls, v: str) -> str:
        t = (v or "").strip()
        if "!" in t:
            raise ValueError("exclamation marks not allowed")
        if len(t) > 110:
            raise ValueError("notification too long")
        return t


def _days_since_ts(ts: str | None) -> int:
    if not ts:
        return 0
    try:
        dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=dt_timezone.utc)
        return max(0, (datetime.now(dt_timezone.utc) - dt).days)
    except Exception:
        return 0


def _normalize_tone(raw: str | None) -> str:
    t = str(raw or "rival").lower().replace(" ", "_").replace("-", "_")
    if t == "silentforce":
        t = "silent_force"
    if t not in ("rival", "philosopher", "silent_force"):
        return "rival"
    return t


def _get_fallback_nudge(trigger: str, tone: str, streak: int, pet_name: str) -> str:
    tone = _normalize_tone(tone)
    pet_short = pet_name or "Companion"
    fallbacks: dict[tuple[str, str], str] = {
        ("streak_warning", "rival"): f"{streak} days. Tonight.",
        ("streak_warning", "philosopher"): f"{streak} days of showing up. Tonight decides.",
        ("streak_warning", "silent_force"): f"{streak} days. Now.",
        ("re_engagement", "rival"): "The gap grew. Close it today.",
        ("re_engagement", "philosopher"): "Come back. The streak holds.",
        ("re_engagement", "silent_force"): "Today.",
        ("pet_nudge", "rival"): f"Your {pet_short} is sad. Mine is not.",
        ("pet_nudge", "philosopher"): f"Your {pet_short} reflects what you've given.",
        ("pet_nudge", "silent_force"): f"{pet_short}. Sad.",
        ("milestone_approaching", "rival"): f"{streak} days. Almost there.",
        ("milestone_approaching", "philosopher"): "The next number is close. Show up.",
        ("milestone_approaching", "silent_force"): "Almost.",
        ("momentum", "rival"): f"{streak} days. Keep it.",
        ("momentum", "philosopher"): f"{streak} days. The work is compounding.",
        ("momentum", "silent_force"): f"{streak} days. Still moving.",
    }
    body = fallbacks.get((trigger, tone), f"{streak} days. Show up.")
    return body[:100] if len(body) > 100 else body


async def generate_nudge(
    *,
    user_id: str,
    trigger: str,
    tone_type: str,
    streak: int,
    pet_name: str,
    character_stage_name: str,
    gap_xp: int,
    hours_until_midnight: int | None,
    milestone_days: int | None,
    milestone_name: str | None,
    last_3_nudges: list[str] | None = None,
    discipline_framing: str = "behavior",
    guilt_orientation: float = 0.0,
    interest_context: str = "",
    quit_context: str = "",
    challenge_context: str = "",
    last_5_nudges: list[str] | None = None,
) -> NudgeText:
    tone = _normalize_tone(tone_type)
    anti = last_5_nudges if last_5_nudges is not None else (last_3_nudges or [])
    last_nudges_str = (
        "\n".join(f'  - "{n}"' for n in anti) if anti else "  None"
    )

    trigger_context = {
        "streak_warning": (
            f"Streak: {streak} days. Hours until midnight (streak end): {hours_until_midnight}h. "
            f"User has NOT opened app today."
        ),
        "re_engagement": (
            f"Streak: {streak} days (still intact). User missed yesterday. "
            f"Pet: {pet_name}. Twin gap: {gap_xp} XP."
        ),
        "pet_nudge": (f"Pet '{pet_name}' is in Sad state. User has not opened app today."),
        "milestone_approaching": (
            f"Current streak: {streak} days. Milestone: {milestone_name or 'streak milestone'} "
            f"in {milestone_days if milestone_days is not None else '?'} day(s)."
        ),
        "momentum": (
            f"Streak: {streak} days. User completed ALL missions yesterday. Twin gap: {gap_xp} XP."
        ),
    }.get(trigger, f"Trigger: {trigger}. Streak: {streak}.")

    additional_lines = "\n".join(
        [
            f"- {interest_context}" if interest_context else "- No active interests",
            f"- {quit_context}" if quit_context else "- No active quit paths",
            f"- {challenge_context}" if challenge_context else "- No active challenge",
        ]
    )

    user_message = f"""Write ONE push notification for this user.

TRIGGER: {trigger}
TONE: {tone}
CHARACTER STAGE: {character_stage_name}

USER DATA: {trigger_context}

DISCIPLINE FRAMING: {discipline_framing}
GUILT ORIENTATION: {guilt_orientation} (above 0.7 = forward-looking language only, no guilt phrases)

ADDITIONAL CONTEXT:
{additional_lines}

LAST 5 NUDGES SENT (do not repeat structure or opening word):
{last_nudges_str}

Max 100 characters. No exclamation marks."""

    result = await run_agent(
        system_prompt=NUDGE_A_SYSTEM_PROMPT,
        user_message=user_message,
        response_model=NudgeText,
        temperature=0.85,
        max_tokens=120,
        context_label=f"Nudge:{trigger}:{tone}",
    )
    logger.info(
        json.dumps(
            {
                "event": "nudge_generated",
                "user_id": user_id,
                "trigger": trigger,
                "tone": tone,
                "body_length": len(result.notification_body),
            }
        )
    )
    return result


async def send_category_c_notification(user_id: str, milestone_type: str) -> None:
    content = MILESTONE_MESSAGES.get(milestone_type)
    if not content:
        return

    try:
        dna_r = (
            supabase_admin.table("discipline_dna")
            .select("guilt_orientation")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        guilt_orientation = float(((dna_r.data or [{}])[0]).get("guilt_orientation") or 0.0)
    except Exception:
        guilt_orientation = 0.0

    if guilt_orientation > 0.7:
        guilt_safe = MILESTONE_MESSAGES_GUILT_SAFE.get(milestone_type)
        if guilt_safe:
            content = guilt_safe

    user_result = (
        supabase_admin.table("users")
        .select("push_token, notifications_enabled")
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = user_result.data or {}

    if not user.get("push_token") or not user.get("notifications_enabled"):
        return

    await _send_push_notification(
        user["push_token"],
        content["title"],
        content["body"],
        push_context=f"milestone_{milestone_type}",
    )

    supabase_admin.table("nudge_log").insert(
        {
            "user_id": user_id,
            "nudge_type": milestone_type,
            "tone_used": "rival",
            "nudge_text": content["body"],
            "nudge_category": "C",
        }
    ).execute()


async def check_category_a(users: list) -> int:
    sent = 0
    for user in users:
        try:
            sent += await _process_category_a_user(user)
        except Exception as e:
            logger.error("Category A failed for %s: %s", user.get("id"), e)
    return sent


async def _process_category_a_user(user: dict) -> int:
    user_id = user["id"]
    timezone_str = user.get("timezone", "UTC")
    try:
        tz = ZoneInfo(timezone_str)
    except Exception:
        tz = ZoneInfo("UTC")
    local_now = datetime.now(tz)
    local_hour = local_now.hour
    today = str(local_now.date())

    if local_hour < NUDGE_EARLIEST_HOUR_LOCAL or local_hour >= NUDGE_LATEST_HOUR_LOCAL:
        return 0

    missions_result = (
        supabase_admin.table("missions")
        .select("completed")
        .eq("user_id", user_id)
        .eq("mission_date", today)
        .execute()
        .data
        or []
    )
    if missions_result and all(m.get("completed") for m in missions_result):
        return 0

    dna_result = (
        supabase_admin.table("discipline_dna")
        .select("twin_tone_type, twin_message_frequency, activity_time_of_day")
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    dna = dna_result.data or {}
    frequency = dna.get("twin_message_frequency", "medium")

    if await proactive_sent_today(user_id, timezone_str):
        return 0
    if not await can_contact_user(user_id, timezone_str):
        return 0

    days_since_reg = _days_since(str(user.get("registration_date", today)))
    activity_hour = dna.get("activity_time_of_day")

    if days_since_reg <= 7 or activity_hour is None:
        archetype = user.get("archetype", "structured_climber")
        expected_hour = ARCHETYPE_DEFAULT_NUDGE_HOURS.get(archetype, DEFAULT_NUDGE_HOUR)
    else:
        expected_hour = activity_hour or DEFAULT_NUDGE_HOUR

    if abs(local_hour - int(expected_hour)) > 2:
        return 0

    trigger = await _determine_category_a_trigger(user_id, user, today, local_hour, frequency)
    if trigger is None:
        return 0

    nudge_text = await _generate_category_a_nudge(user_id, user, dna, trigger, today, local_hour)
    if not nudge_text or not user.get("push_token"):
        return 0

    await _send_push_notification(
        user["push_token"],
        "Your Twin",
        nudge_text,
        push_context=f"nudge_a_{trigger}",
    )
    supabase_admin.table("nudge_log").insert(
        {
            "user_id": user_id,
            "nudge_type": trigger,
            "tone_used": _normalize_tone(dna.get("twin_tone_type")),
            "nudge_text": nudge_text,
            "nudge_category": "A",
        }
    ).execute()
    await record_contact(user_id, "nudge", timezone_str)
    return 1


async def _determine_category_a_trigger(
    user_id: str, user: dict, today: str, local_hour: int, frequency: str
) -> str | None:
    streak = user.get("current_streak", 0) or 0

    if local_hour >= 20:
        missions_done = await _count_completed(user_id, today)
        if missions_done == 0 and streak > 0:
            return "streak_warning"

    if frequency in ("medium", "high"):
        try:
            yesterday = (date.fromisoformat(today) - timedelta(days=1)).strftime("%Y-%m-%d")
        except Exception:
            yesterday = today
        yesterday_done = await _count_completed(user_id, yesterday)
        today_done = await _count_completed(user_id, today)
        if yesterday_done == 0 and today_done == 0 and streak > 0:
            return "re_engagement"

    if frequency in ("medium", "high"):
        if user.get("pet_state") == "sad" and user.get("pet_unlocked"):
            return "pet_nudge"

    if frequency in ("medium", "high"):
        for milestone in STREAK_MILESTONES:
            if streak in (milestone - 1, milestone - 2):
                return "milestone_approaching"

    if frequency == "high" and streak >= 7:
        try:
            yesterday = (date.fromisoformat(today) - timedelta(days=1)).strftime("%Y-%m-%d")
        except Exception:
            yesterday = today
        yesterday_done = await _count_completed(user_id, yesterday)
        if yesterday_done > 0:
            return "momentum"

    return None


async def _generate_category_a_nudge(
    user_id: str, user: dict, dna: dict, trigger: str, today: str, local_hour: int
) -> str:
    try:
        profiler_result = (
            supabase_admin.table("discipline_dna")
            .select("discipline_framing, guilt_orientation, narrative_seed")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        profiler = (profiler_result.data or [None])[0] or {}
        discipline_framing = str(profiler.get("discipline_framing") or "behavior")
        guilt_orientation = float(profiler.get("guilt_orientation") or 0.0)
    except Exception:
        discipline_framing = "behavior"
        guilt_orientation = 0.0

    try:
        interests_result = (
            supabase_admin.table("interests")
            .select("normalised_name, current_arc_phase, sessions_completed")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .order("sessions_completed", desc=True)
            .limit(1)
            .execute()
        )
        top_interest = (interests_result.data or [None])[0] or {}
        nm = top_interest.get("normalised_name") or ""
        interest_context = (
            f"Interest: {nm} (phase: {top_interest.get('current_arc_phase', '')}, "
            f"{int(top_interest.get('sessions_completed') or 0)} sessions)"
            if nm
            else ""
        )
    except Exception:
        interest_context = ""

    try:
        quit_result = (
            supabase_admin.table("quit_paths")
            .select("habit_name, current_phase, phase_started_at")
            .eq("user_id", user_id)
            .in_("status", ["active", "paused", "referral_only"])
            .limit(1)
            .execute()
        )
        top_quit = (quit_result.data or [None])[0] or {}
        hn = top_quit.get("habit_name")
        qdays = _days_since_ts(top_quit.get("phase_started_at"))
        quit_context = (
            f"Quit: {qdays} days in phase on {hn} (phase: {top_quit.get('current_phase', '')})"
            if hn
            else ""
        )
    except Exception:
        quit_context = ""

    try:
        challenge_result = (
            supabase_admin.table("twin_challenges")
            .select("challenge_text, status, expires_at, issued_at")
            .eq("user_id", user_id)
            .in_("status", ["accepted", "pending"])
            .order("issued_at", desc=True)
            .limit(1)
            .execute()
        )
        challenge_row = (challenge_result.data or [None])[0] or {}
        ct = challenge_row.get("challenge_text")
        dr = "?"
        ex = challenge_row.get("expires_at")
        if ex:
            try:
                exdt = datetime.fromisoformat(str(ex).replace("Z", "+00:00"))
                if exdt.tzinfo is None:
                    exdt = exdt.replace(tzinfo=dt_timezone.utc)
                dr = str(max(0, (exdt - datetime.now(dt_timezone.utc)).days))
            except Exception:
                dr = "?"
        challenge_context = (
            f"Twin Challenge: {ct} ({dr} days left)"
            if ct
            else ""
        )
    except Exception:
        challenge_context = ""

    try:
        last_nudges_5 = (
            supabase_admin.table("nudge_log")
            .select("nudge_text")
            .eq("user_id", user_id)
            .order("sent_at", desc=True)
            .limit(5)
            .execute()
            .data
            or []
        )
        last_texts_5 = [str(n.get("nudge_text") or "") for n in last_nudges_5 if n.get("nudge_text")]
    except Exception:
        last_texts_5 = []

    try:
        twin_result = (
            supabase_admin.table("twin_state")
            .select("twin_xp")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        twin = (twin_result.data or [None])[0] or {}
    except Exception:
        twin = {}
    stage = user.get("character_stage", 1) or 1
    pet_stage = user.get("pet_stage", 0) or 0
    streak = user.get("current_streak", 0) or 0
    gap_xp = abs((twin.get("twin_xp") or 0) - (user.get("total_xp") or 0))

    milestone_days: int | None = None
    milestone_name: str | None = None
    for m in STREAK_MILESTONES:
        if streak in (m - 1, m - 2):
            milestone_days = m - streak
            milestone_name = f"{m}-day streak"
            break

    hours_left = max(0, 23 - local_hour)
    pet_name = PET_NAMES[pet_stage - 1] if pet_stage > 0 else "Cub"
    tone = dna.get("twin_tone_type", "rival")

    try:
        nudge = await generate_nudge(
            user_id=user_id,
            trigger=trigger,
            tone_type=str(tone),
            streak=int(streak),
            pet_name=pet_name,
            character_stage_name=STAGE_NAMES[int(stage) - 1]
            if 1 <= stage <= len(STAGE_NAMES)
            else "The Awakened",
            gap_xp=int(gap_xp),
            hours_until_midnight=hours_left if trigger == "streak_warning" else None,
            milestone_days=milestone_days if trigger == "milestone_approaching" else None,
            milestone_name=milestone_name if trigger == "milestone_approaching" else None,
            last_3_nudges=[],
            discipline_framing=discipline_framing,
            guilt_orientation=guilt_orientation,
            interest_context=interest_context,
            quit_context=quit_context,
            challenge_context=challenge_context,
            last_5_nudges=last_texts_5[:5],
        )
        return nudge.notification_body
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "nudge_generation_error",
                    "user_id": user_id,
                    "trigger": trigger,
                    "error": str(e)[:200],
                }
            )
        )
        return _get_fallback_nudge(trigger, str(tone), int(streak), pet_name)


async def generate_quit_intervention_nudge(
    *,
    user_id: str,
    tone_type: str,
    quit_target: dict,
    last_texts: list[str],
    guilt_orientation: float = 0.0,
) -> str:
    ctx = quit_target.get("trigger_contexts") or []
    if isinstance(ctx, list):
        replacement_str = quit_target.get("competing_response") or ", ".join(str(x) for x in ctx[:4])
    else:
        replacement_str = str(quit_target.get("competing_response") or ctx)

    ih = quit_target.get("intervention_hour")
    urge_timing = f"around {ih}:00" if ih is not None else "your usual window"

    safe_quit_last = [str(t)[:110] for t in (last_texts or [])][:3]
    anti = "\n".join(f'  - "{t}"' for t in safe_quit_last) if safe_quit_last else "  None"

    user_message = f"""Write one intervention notification.

Quit habit label: {quit_target.get("habit_name", "habit")}
Trigger cues: {", ".join(str(x) for x in ctx[:3]) if isinstance(ctx, list) and ctx else "your trigger"}
Urge timing: {urge_timing}
Underlying need: {quit_target.get("underlying_need", "unknown")}
Replacement: {replacement_str or "Take a walk, drink water, one slow breath"}
Frequency today: {quit_target.get("frequency_today", 0)}
Phase: {quit_target.get("current_phase", "mapping")}
Tone: {_normalize_tone(tone_type)}
guilt_orientation: {guilt_orientation}

Last 3 for this target (vary):
{anti}
"""

    try:
        out = await run_agent(
            system_prompt=QUIT_NUDGE_SYSTEM,
            user_message=user_message,
            response_model=QuitNudgeText,
            temperature=0.65,
            max_tokens=100,
            context_label="Nudge:quit",
        )
        return out.notification_body
    except Exception:
        logger.exception("generate_quit_intervention_nudge failed user=%s", user_id)
        return "Right now — your replacement is ready. One action."


async def check_category_b(users: list) -> int:
    sent = 0
    for user in users:
        try:
            sent += await _process_category_b_user(user)
        except Exception as e:
            logger.error("Category B failed for %s: %s", user.get("id"), e)
    return sent


async def _process_category_b_user(user: dict) -> int:
    user_id = user["id"]
    timezone_str = user.get("timezone", "UTC")
    try:
        tz = ZoneInfo(timezone_str)
    except Exception:
        tz = ZoneInfo("UTC")
    local_now = datetime.now(tz)
    local_hour = local_now.hour
    local_minute = local_now.minute
    today = str(local_now.date())

    if local_hour >= 23 and local_minute >= 30:
        return 0

    quit_result = (
        supabase_admin.table("quit_paths")
        .select("*")
        .eq("user_id", user_id)
        .in_("status", ["active", "referral_only"])
        .execute()
    )
    quit_targets = quit_result.data or []
    quit_targets = [q for q in quit_targets if q.get("intervention_hour") is not None]

    if not quit_targets:
        return 0

    dna_result = (
        supabase_admin.table("discipline_dna")
        .select("twin_tone_type")
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    dna = dna_result.data or {}

    try:
        dna_profiler = (
            supabase_admin.table("discipline_dna")
            .select("guilt_orientation")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        guilt_orientation = float(((dna_profiler.data or [{}])[0]).get("guilt_orientation") or 0.0)
    except Exception:
        guilt_orientation = 0.0

    sent = 0
    for qt in quit_targets:
        intervention_hour = qt.get("intervention_hour")
        if intervention_hour is None or local_hour != int(intervention_hour):
            continue

        qt_mission_done = (
            supabase_admin.table("missions")
            .select("id")
            .eq("user_id", user_id)
            .eq("quit_path_id", qt["id"])
            .eq("mission_date", today)
            .eq("completed", True)
            .limit(1)
            .execute()
            .data
        )
        if qt_mission_done:
            continue

        already_result = (
            supabase_admin.table("nudge_log")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("nudge_category", "B")
            .eq("nudge_type", f"quit_{qt['id']}")
            .gte("sent_at", f"{today}T00:00:00")
            .execute()
        )
        already_sent = getattr(already_result, "count", None)
        if already_sent is None:
            already_sent = len(already_result.data or [])
        if already_sent > 0:
            continue

        last_nudges = (
            supabase_admin.table("nudge_log")
            .select("nudge_text")
            .eq("user_id", user_id)
            .eq("nudge_category", "B")
            .eq("nudge_type", f"quit_{qt['id']}")
            .order("sent_at", desc=True)
            .limit(3)
            .execute()
            .data
            or []
        )
        last_texts = [str(n.get("nudge_text") or "") for n in last_nudges if n.get("nudge_text")]
        while len(last_texts) < 3:
            last_texts.append("None")

        nudge_text = await generate_quit_intervention_nudge(
            user_id=user_id,
            tone_type=str(dna.get("twin_tone_type", "rival")),
            quit_target=qt,
            last_texts=last_texts[:3],
            guilt_orientation=guilt_orientation,
        )
        if nudge_text and user.get("push_token"):
            await _send_push_notification(
                user["push_token"],
                "Your Twin",
                nudge_text,
                push_context="nudge_category_b",
            )
            supabase_admin.table("nudge_log").insert(
                {
                    "user_id": user_id,
                    "nudge_type": f"quit_{qt['id']}",
                    "tone_used": _normalize_tone(dna.get("twin_tone_type")),
                    "nudge_text": nudge_text,
                    "nudge_category": "B",
                }
            ).execute()
            sent += 1

    return sent


async def check_and_send_nudges() -> dict:
    users_result = (
        supabase_admin.table("users")
        .select(
            "id, timezone, current_streak, pet_state, pet_stage, "
            "pet_unlocked, push_token, notifications_enabled, "
            "character_stage, total_xp, archetype, registration_date"
        )
        .eq("onboarding_complete", True)
        .eq("notifications_enabled", True)
        .execute()
    )
    users = users_result.data or []

    a_sent = await check_category_a(users)
    b_sent = await check_category_b(users)

    return {"category_a": a_sent, "category_b": b_sent, "category_c": 0}


async def _send_push_notification(
    push_token: str,
    title: str,
    body: str,
    *,
    push_context: str = "notification",
) -> None:
    try:
        import httpx

        async with httpx.AsyncClient() as client:
            await client.post(
                "https://exp.host/--/api/v2/push/send",
                json={
                    "to": push_token,
                    "title": title,
                    "body": body,
                    "sound": "default",
                    "priority": "high",
                },
                headers={"Content-Type": "application/json"},
                timeout=10.0,
            )
        logger.info(
            json.dumps(
                {
                    "event": "push_sent",
                    "trigger": push_context,
                }
            )
        )
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "push_send_error",
                    "trigger": push_context,
                    "error": str(e)[:200],
                }
            )
        )


async def _count_completed(user_id: str, mission_date: str) -> int:
    result = (
        supabase_admin.table("missions")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("mission_date", mission_date)
        .eq("completed", True)
        .execute()
    )
    c = getattr(result, "count", None)
    return c if c is not None else len(result.data or [])


def _days_since(date_str: str) -> int:
    try:
        return (date.today() - date.fromisoformat(str(date_str)[:10])).days
    except Exception:
        return 0
