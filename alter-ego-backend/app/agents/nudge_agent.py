"""
Three-category notification system.

Category A — Re-engagement: brings user back when absent.
  Gates: outside 7am-10pm local → skip.
         missions already complete today → skip.
         outside ±2 hour activity window (day 8+) → skip.
         daily cap reached → skip.

Category B — Quit target intervention: fires at urge time.
  Gates: local hour doesn't match quit_target.intervention_hour → skip.
         today's quit target mission already completed → skip.
         after 11:30pm local → skip.
         category B already sent for this quit target today → skip.

Category C — Milestone: immediate event-driven reward.
  Gates: none. Called directly from complete_mission().
  Pre-written content. No LLM.
"""

from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.core.constants import (
    NUDGE_DAILY_CAPS,
    NUDGE_EARLIEST_HOUR_LOCAL,
    NUDGE_LATEST_HOUR_LOCAL,
    PET_NAMES,
    STAGE_NAMES,
    STREAK_MILESTONES,
)
from app.core.supabase_client import supabase_admin

logger = logging.getLogger(__name__)

# Used when activity_time_of_day is not yet established (first 7 days)
ARCHETYPE_DEFAULT_NUDGE_HOURS = {
    "structured_climber": 7,
    "lone_wolf": 21,
    "restless_creator": 18,
    "reluctant_achiever": 20,
    "social_performer": 18,
}
DEFAULT_NUDGE_HOUR = 20

# ── PROMPTS ──────────────────────────────────────────────────────────────

NUDGE_CATEGORY_A_PROMPT = """
You are writing a push notification for ALTER EGO.
This notification is sent by the Shadow Twin — another version of the user.

CONTEXT:
→ Trigger type:          {trigger_type}
→ Twin tone:             {tone_type}
→ User streak:           {streak} days
→ Pet stage name:        {pet_name}
→ Character stage:       {stage_name}
→ XP gap behind twin:    {gap_xp} XP
→ Hours until midnight:  {hours_until_midnight}
→ Milestone approaching: {milestone_approaching}

LAST 3 NUDGES SENT:
→ {nudge_1}
→ {nudge_2}
→ {nudge_3}

TRIGGER RULES:
streak_warning:        User hasn't opened app. Streak ends at midnight. Factual urgency.
re_engagement:         Missed exactly 1 day. Streak still intact. Soft. References pet or gap.
pet_nudge:             Pet is in Sad state. States the fact. No manipulation.
milestone_approaching: 1-2 days from a streak milestone. Creates anticipation.
momentum:              7+ day streak, all missions done yesterday. Acknowledge quietly.

TONE RULES:
rival:        Competitive. Cold. Short declarative sentences. Max 2 sentences.
philosopher:  Reflective. Principled. References process. Max 2 sentences.
silent_force: 1 sentence MAXIMUM. Often 3-7 words.

HARD RULES:
- NEVER use guilt. Never mention days missed or failure.
- NEVER be generic. "Keep going!" is not acceptable.
- NEVER repeat the opening word or core observation from the last 3 nudges.
- NEVER break character — this is the Twin speaking.
- Use actual data — streak number, pet name, stage name.

OUTPUT: Return ONLY the nudge text. No preamble. No quotes.
"""

NUDGE_CATEGORY_B_PROMPT = """
You are writing a push notification for ALTER EGO.
This is a quit target intervention — sent at the exact moment the user
typically experiences their urge.

CONTEXT:
→ Quit target:        {quit_target_name}
→ User's trigger:     {trigger_text}
→ Urge timing:        {urge_timing}
→ Underlying need:    {need_category}
→ Replacement direction: {replacement_directions}
→ Clean days:         {clean_days}
→ Current phase:      {current_phase}
→ Twin tone:          {tone_type}

LAST 3 CATEGORY B NUDGES FOR THIS QUIT TARGET:
→ {nudge_1}
→ {nudge_2}
→ {nudge_3}

YOUR JOB:
Write one push notification that arrives exactly when the urge is likely to hit.
It should feel like the system anticipated the moment — not like a generic reminder.

PHASE RULES:
days_1_10:   Awareness. "Notice the urge. You know what to do instead."
days_11_30:  Replacement. Reference the specific replacement behavior.
days_31_60:  Environmental. Reference a friction strategy already in place.
days_61_90:  Identity. "You are someone who doesn't do this."
days_90_plus: Consolidation. Quiet acknowledgment of the identity formed.

CONTENT RULES:
- ALWAYS positive action — never "don't", "avoid", "resist"
- Reference the urge timing specifically if possible ("Right now..." / "It's that time...")
- Reference the replacement behavior or underlying need
- 1-2 sentences maximum
- NEVER mention the quit target habit negatively in the title or body
- NEVER repeat the core observation from the last 3 nudges for this target

OUTPUT: Return ONLY the notification text. No preamble. No quotes.
"""

# ── CATEGORY C — PRE-WRITTEN MILESTONE MESSAGES ──────────────────────────

MILESTONE_MESSAGES = {
    "stage_2": {"title": "ALTER EGO", "body": "The Focused. You reached Stage 2."},
    "stage_3": {"title": "ALTER EGO", "body": "The Burning. Stage 3. The identity is forming."},
    "stage_4": {"title": "ALTER EGO", "body": "The Relentless. Stage 4. This is uncommon."},
    "stage_5": {"title": "ALTER EGO", "body": "The Formidable. Stage 5. Very few get here."},
    "stage_6": {"title": "ALTER EGO", "body": "The Sovereign. You made it."},
    "pet_stage_2": {"title": "ALTER EGO", "body": "Your companion evolved. Cat."},
    "pet_stage_3": {"title": "ALTER EGO", "body": "Your companion evolved. Fox."},
    "pet_stage_4": {"title": "ALTER EGO", "body": "Your companion evolved. Wolf."},
    "pet_stage_5": {"title": "ALTER EGO", "body": "Your companion evolved. Snow Leopard."},
    "pet_stage_6": {"title": "ALTER EGO", "body": "Your companion evolved. Panther."},
    "pet_stage_7": {"title": "ALTER EGO", "body": "Your companion evolved. Griffin."},
    "pet_stage_8": {"title": "ALTER EGO", "body": "Dragon. A full year of showing up."},
    "pet_unlock": {"title": "ALTER EGO", "body": "Your companion arrived. Take care of it."},
    "streak_3": {"title": "ALTER EGO", "body": "3-day streak. The leaderboard is open."},
    "streak_7": {"title": "ALTER EGO", "body": "7 days. One full week."},
    "streak_14": {"title": "ALTER EGO", "body": "14 days. Two weeks of showing up."},
    "streak_30": {"title": "ALTER EGO", "body": "30 days. One month. This is real."},
    "streak_60": {"title": "ALTER EGO", "body": "60 days. Two months. Uncommon."},
    "streak_100": {"title": "ALTER EGO", "body": "100 days. The identity is set."},
    "streak_200": {"title": "ALTER EGO", "body": "200 days. This is who you are."},
    "streak_365": {"title": "ALTER EGO", "body": "A full year. Every day you could have stopped. You didn't."},
}


async def send_category_c_notification(user_id: str, milestone_type: str) -> None:
    """
    Sends an immediate milestone notification.
    Called directly from complete_mission() and progression.
    No gates. No LLM. Pre-written content.
    """
    content = MILESTONE_MESSAGES.get(milestone_type)
    if not content:
        return

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

    await _send_push_notification(user["push_token"], content["title"], content["body"])

    supabase_admin.table("nudge_log").insert(
        {
            "user_id": user_id,
            "nudge_type": milestone_type,
            "tone_used": "rival",
            "nudge_text": content["body"],
            "nudge_category": "C",
        }
    ).execute()


# ── CATEGORY A — RE-ENGAGEMENT ────────────────────────────────────────────

async def check_category_a(users: list) -> int:
    """Checks and sends Category A (re-engagement) nudges. Returns count sent."""
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
    daily_cap = NUDGE_DAILY_CAPS.get(frequency, 2)

    nudge_result = (
        supabase_admin.table("nudge_log")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .gte("sent_at", f"{today}T00:00:00")
        .execute()
    )
    nudges_today = getattr(nudge_result, "count", None)
    if nudges_today is None:
        nudges_today = len(nudge_result.data or [])
    if nudges_today >= daily_cap:
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

    await _send_push_notification(user["push_token"], "ALTER EGO", nudge_text)
    supabase_admin.table("nudge_log").insert(
        {
            "user_id": user_id,
            "nudge_type": trigger,
            "tone_used": dna.get("twin_tone_type", "rival"),
            "nudge_text": nudge_text,
            "nudge_category": "A",
        }
    ).execute()
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
    last_nudges = (
        supabase_admin.table("nudge_log")
        .select("nudge_text")
        .eq("user_id", user_id)
        .order("sent_at", desc=True)
        .limit(3)
        .execute()
        .data
        or []
    )
    last_texts = [n.get("nudge_text", "None") for n in last_nudges]
    while len(last_texts) < 3:
        last_texts.append("None")

    twin_result = (
        supabase_admin.table("twin_state")
        .select("twin_xp")
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    twin = twin_result.data or {}
    stage = user.get("character_stage", 1) or 1
    pet_stage = user.get("pet_stage", 0) or 0
    streak = user.get("current_streak", 0) or 0
    gap_xp = abs((twin.get("twin_xp") or 0) - (user.get("total_xp") or 0))

    milestone_approaching = "None"
    for m in STREAK_MILESTONES:
        if streak in (m - 1, m - 2):
            milestone_approaching = f"{m}-day streak in {m - streak} day(s)"
            break

    prompt = NUDGE_CATEGORY_A_PROMPT.format(
        trigger_type=trigger,
        tone_type=dna.get("twin_tone_type", "rival"),
        streak=streak,
        pet_name=PET_NAMES[pet_stage - 1] if pet_stage > 0 else "your companion",
        stage_name=STAGE_NAMES[stage - 1],
        gap_xp=gap_xp,
        hours_until_midnight=24 - local_hour if local_hour < 24 else 0,
        milestone_approaching=milestone_approaching,
        nudge_1=last_texts[0],
        nudge_2=last_texts[1],
        nudge_3=last_texts[2],
    )

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.7,
        max_tokens=60,
        api_key=os.environ.get("OPENAI_API_KEY", ""),
    )
    try:
        response = await llm.ainvoke([
            SystemMessage(content=prompt),
            HumanMessage(content="Write the nudge notification."),
        ])
        return (response.content or "").strip()
    except Exception:
        fallbacks = {
            "streak_warning": f"{streak}-day streak. Tonight.",
            "re_engagement": f"Your {PET_NAMES[pet_stage - 1] if pet_stage > 0 else 'companion'} is waiting.",
            "pet_nudge": "Your companion needs you today.",
            "milestone_approaching": f"Almost at {streak + 1} days.",
            "momentum": f"{streak} days straight.",
        }
        return fallbacks.get(trigger, "Your missions are waiting.")


# ── CATEGORY B — QUIT TARGET INTERVENTION ────────────────────────────────

async def check_category_b(users: list) -> int:
    """Checks and sends Category B (quit target intervention) nudges. Returns count sent."""
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
        supabase_admin.table("quit_targets")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .eq("conquered", False)
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

    sent = 0
    for qt in quit_targets:
        intervention_hour = qt.get("intervention_hour")
        if intervention_hour is None or local_hour != int(intervention_hour):
            continue

        qt_mission_done = (
            supabase_admin.table("missions")
            .select("id")
            .eq("user_id", user_id)
            .eq("quit_target_id", qt["id"])
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

        nudge_text = await _generate_category_b_nudge(user_id, user, dna, qt)
        if nudge_text and user.get("push_token"):
            await _send_push_notification(user["push_token"], "ALTER EGO", nudge_text)
            supabase_admin.table("nudge_log").insert(
                {
                    "user_id": user_id,
                    "nudge_type": f"quit_{qt['id']}",
                    "tone_used": dna.get("twin_tone_type", "rival"),
                    "nudge_text": nudge_text,
                    "nudge_category": "B",
                }
            ).execute()
            sent += 1

    return sent


async def _generate_category_b_nudge(
    user_id: str, user: dict, dna: dict, quit_target: dict
) -> str:
    last_nudges = (
        supabase_admin.table("nudge_log")
        .select("nudge_text")
        .eq("user_id", user_id)
        .eq("nudge_category", "B")
        .eq("nudge_type", f"quit_{quit_target['id']}")
        .order("sent_at", desc=True)
        .limit(3)
        .execute()
        .data
        or []
    )
    last_texts = [n.get("nudge_text", "None") for n in last_nudges]
    while len(last_texts) < 3:
        last_texts.append("None")

    replacement = quit_target.get("replacement_directions") or []
    if isinstance(replacement, list):
        replacement_str = ", ".join(str(x) for x in replacement[:3])
    else:
        replacement_str = str(replacement)

    prompt = NUDGE_CATEGORY_B_PROMPT.format(
        quit_target_name=quit_target.get("normalised_name", "your habit"),
        trigger_text=quit_target.get("trigger_text", "your trigger"),
        urge_timing=quit_target.get("urge_timing", "now"),
        need_category=quit_target.get("need_category", "unknown"),
        replacement_directions=replacement_str or "Take a walk, drink water, do one breath exercise",
        clean_days=quit_target.get("clean_days", 0),
        current_phase=quit_target.get("current_phase", "days_1_10"),
        tone_type=dna.get("twin_tone_type", "rival"),
        nudge_1=last_texts[0],
        nudge_2=last_texts[1],
        nudge_3=last_texts[2],
    )

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.65,
        max_tokens=60,
        api_key=os.environ.get("OPENAI_API_KEY", ""),
    )
    try:
        response = await llm.ainvoke([
            SystemMessage(content=prompt),
            HumanMessage(content="Write the quit target intervention notification."),
        ])
        return (response.content or "").strip()
    except Exception:
        return "Right now — your replacement is ready. One action."


# ── MAIN ENTRY POINT ──────────────────────────────────────────────────────

async def check_and_send_nudges() -> dict:
    """
    Runs every hour via cron.
    Returns counts per category (Category C is event-driven, not run here).
    """
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


# ── SHARED HELPERS ────────────────────────────────────────────────────────

async def _send_push_notification(push_token: str, title: str, body: str) -> None:
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
    except Exception as e:
        logger.error("Push notification failed: %s", e)


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
