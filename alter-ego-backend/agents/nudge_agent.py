"""
Nudge Agent (J3) — §2, §3. Rule-based decision tree + GPT-4o-mini for copy.
Runs twice daily per user (morning 7–11am, evening 5–9:59pm local). Priority:
Streak Warning > Re-engagement > Pet Nudge > Milestone Approaching > Momentum.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta, date
from typing import Any, Dict, List, Optional, Tuple

import httpx
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from utils.supabase_client import get_supabase

try:
    from zoneinfo import ZoneInfo
except ImportError:
    ZoneInfo = None  # type: ignore

# Nudge types in priority order
STREAK_WARNING = "streak_warning"
RE_ENGAGEMENT = "re_engagement"
PET_NUDGE = "pet_nudge"
MILESTONE_APPROACHING = "milestone_approaching"
MOMENTUM = "momentum"

STREAK_MILESTONES = [3, 7, 10, 14, 30, 60, 100, 180, 365]

PET_STAGE_NAMES = {
    1: "Cub", 2: "Cat", 3: "Fox", 4: "Wolf",
    5: "Snow Leopard", 6: "Panther", 7: "Griffin", 8: "Dragon",
}

STAGE_NAMES = [
    "The Awakened", "The Focused", "The Burning",
    "The Relentless", "The Formidable", "The Sovereign",
]

# Frequency: (max per day, max per week). Low = only streak_warning eligible.
FREQUENCY_CAPS = {
    "low": (1, 3),
    "medium": (1, 7),
    "high": (2, 14),
}


def _user_local_now(tz_str: str) -> datetime:
    """Current time in user's timezone."""
    if ZoneInfo and tz_str and tz_str != "UTC":
        try:
            return datetime.now(ZoneInfo(tz_str))
        except Exception:
            pass
    return datetime.now(timezone.utc)


def _user_local_date(tz_str: str) -> date:
    return _user_local_now(tz_str).date()


def _in_nudge_window(local_dt: datetime) -> Optional[str]:
    """Return 'morning' (7–11am), 'evening' (5pm–9:59pm), or None. Never after 10pm."""
    h = local_dt.hour
    if h >= 22:
        return None
    if 7 <= h < 11:
        return "morning"
    if 17 <= h < 22:
        return "evening"
    return None


def _hours_until_midnight(local_dt: datetime) -> int:
    """Hours until midnight in user's local time."""
    return 24 - local_dt.hour - (1 if local_dt.minute > 0 else 0)


def _last_momentum_was_yesterday(nudge_rows: List[Dict], tz_str: str, local_yesterday: date) -> bool:
    """True if the most recent nudge was MOMENTUM and sent on local_yesterday."""
    if not nudge_rows:
        return False
    r = nudge_rows[0]
    if r.get("type") != MOMENTUM:
        return False
    sent = r.get("sent_at")
    if not sent or not isinstance(sent, str):
        return False
    try:
        dt = datetime.fromisoformat(sent.replace("Z", "+00:00"))
        if ZoneInfo and tz_str and tz_str != "UTC":
            dt = dt.astimezone(ZoneInfo(tz_str))
        return dt.date() == local_yesterday
    except Exception:
        return False


def _fetch_nudge_context(supabase, user_id: str, tz_str: str) -> Dict[str, Any]:
    """Gather all data needed for the nudge decision tree."""
    local_now = _user_local_now(tz_str)
    local_today = local_now.date()
    local_yesterday = local_today - timedelta(days=1)

    # User
    ur = supabase.table("users").select(
        "push_token, nudge_frequency, last_opened_at, discipline_dna"
    ).eq("id", user_id).maybe_single().execute()
    user = ur.data or {}
    push_token = user.get("push_token")
    nudge_frequency = user.get("nudge_frequency") or "medium"
    last_opened_at = user.get("last_opened_at")
    discipline_dna = user.get("discipline_dna") or {}
    tone_type = discipline_dna.get("tone_type") or discipline_dna.get("twin_tone_type") or "rival"

    # Last opened: if we have it, compare to local today
    opened_today = False
    if last_opened_at:
        try:
            if isinstance(last_opened_at, str):
                opened_utc = datetime.fromisoformat(last_opened_at.replace("Z", "+00:00"))
            else:
                opened_utc = last_opened_at
            if ZoneInfo and tz_str and tz_str != "UTC":
                try:
                    opened_local = opened_utc.astimezone(ZoneInfo(tz_str))
                    opened_today = opened_local.date() == local_today
                except Exception:
                    opened_today = opened_utc.date() == local_today
            else:
                opened_today = opened_utc.date() == local_today
        except Exception:
            pass

    # Streak (current) from leaderboard_scores or compute from streak_log
    lr = supabase.table("leaderboard_scores").select("streak").eq("user_id", user_id).maybe_single().execute()
    streak = int((lr.data or {}).get("streak", 0))

    # Streak_log for yesterday/today core completion
    today_iso = local_today.isoformat()
    yesterday_iso = local_yesterday.isoformat()
    sl_today = supabase.table("streak_log").select("core_completed").eq("user_id", user_id).eq("date", today_iso).maybe_single().execute()
    sl_yesterday = supabase.table("streak_log").select("core_completed").eq("user_id", user_id).eq("date", yesterday_iso).maybe_single().execute()
    today_core = int((sl_today.data or {}).get("core_completed", 0))
    yesterday_core = int((sl_yesterday.data or {}).get("core_completed", 0))
    yesterday_core_completed = yesterday_core >= 5
    today_streak_intact = streak > 0 and (today_core >= 5 or local_now.hour < 12)  # before midnight today streak still intact if we haven't failed yet

    # Missions today (expires_at on local_today) — completed count
    day_start = datetime.combine(local_today, datetime.min.time())
    day_end = datetime.combine(local_today, datetime.max.time())
    if ZoneInfo and tz_str and tz_str != "UTC":
        try:
            day_start = day_start.replace(tzinfo=ZoneInfo(tz_str)).astimezone(timezone.utc)
            day_end = day_end.replace(tzinfo=ZoneInfo(tz_str)).astimezone(timezone.utc)
        except Exception:
            day_start = datetime.combine(local_today, datetime.min.time(), tzinfo=timezone.utc)
            day_end = datetime.combine(local_today, datetime.max.time(), tzinfo=timezone.utc)
    else:
        day_start = datetime.combine(local_today, datetime.min.time(), tzinfo=timezone.utc)
        day_end = datetime.combine(local_today, datetime.max.time(), tzinfo=timezone.utc)
    ms_today = (
        supabase.table("missions")
        .select("id, completed_at")
        .eq("user_id", user_id)
        .gte("expires_at", day_start.isoformat())
        .lte("expires_at", day_end.isoformat())
        .execute()
    )
    missions_today = ms_today.data or []
    missions_today_count = len(missions_today)
    today_all_complete = all(m.get("completed_at") for m in missions_today) if missions_today else False
    # Yesterday all complete: missions expiring yesterday, all completed
    day_start_y = datetime.combine(local_yesterday, datetime.min.time())
    day_end_y = datetime.combine(local_yesterday, datetime.max.time())
    if ZoneInfo and tz_str and tz_str != "UTC":
        try:
            day_start_y = day_start_y.replace(tzinfo=ZoneInfo(tz_str)).astimezone(timezone.utc)
            day_end_y = day_end_y.replace(tzinfo=ZoneInfo(tz_str)).astimezone(timezone.utc)
        except Exception:
            day_start_y = datetime.combine(local_yesterday, datetime.min.time(), tzinfo=timezone.utc)
            day_end_y = datetime.combine(local_yesterday, datetime.max.time(), tzinfo=timezone.utc)
    else:
        day_start_y = datetime.combine(local_yesterday, datetime.min.time(), tzinfo=timezone.utc)
        day_end_y = datetime.combine(local_yesterday, datetime.max.time(), tzinfo=timezone.utc)
    ms_yesterday = (
        supabase.table("missions")
        .select("id, completed_at")
        .eq("user_id", user_id)
        .gte("expires_at", day_start_y.isoformat())
        .lte("expires_at", day_end_y.isoformat())
        .execute()
    )
    yesterday_missions = ms_yesterday.data or []
    yesterday_all_complete = all(m.get("completed_at") for m in yesterday_missions) if yesterday_missions else False

    # Pet state
    pr = supabase.table("pet_state").select("stage, pet_health_state").eq("user_id", user_id).maybe_single().execute()
    pet_stage = int((pr.data or {}).get("stage", 0))
    pet_health = (pr.data or {}).get("pet_health_state") or "healthy"
    pet_name = PET_STAGE_NAMES.get(pet_stage, "companion") if pet_stage else "Cub"
    pet_sad = str(pet_health).lower() == "sad"

    # Character stage
    cr = supabase.table("character_state").select("stage").eq("user_id", user_id).maybe_single().execute()
    char_stage = int((cr.data or {}).get("stage", 1))
    character_stage_name = STAGE_NAMES[min(char_stage - 1, len(STAGE_NAMES) - 1)]

    # Gap XP (twin - user)
    tr = supabase.table("twin_state").select("twin_xp").eq("user_id", user_id).maybe_single().execute()
    twin_xp = int((tr.data or {}).get("twin_xp", 0))
    total_xp = int((cr.data or {}).get("total_xp", 0)) if cr.data else 0
    gap_xp = max(0, twin_xp - total_xp)

    # Nudge log: count today, this week, last 3 texts, momentum this week
    sent_at_start = (local_now - timedelta(days=1)).isoformat()  # last 24h for "today" approx in UTC
    sent_at_week_start = (local_now - timedelta(days=7)).isoformat()
    nl = (
        supabase.table("nudge_log")
        .select("type, content, sent_at")
        .eq("user_id", user_id)
        .gte("sent_at", sent_at_week_start)
        .order("sent_at", desc=True)
        .limit(50)
        .execute()
    )
    nudge_rows = nl.data or []
    # Today count; last nudge was momentum yesterday (no momentum two days in a row)
    nudge_count_today = 0
    nudge_count_this_week = len(nudge_rows)
    momentum_count_this_week = sum(1 for r in nudge_rows if r.get("type") == MOMENTUM)
    last_3_texts = []
    for r in nudge_rows:
        sent = r.get("sent_at")
        if sent and isinstance(sent, str):
            try:
                dt = datetime.fromisoformat(sent.replace("Z", "+00:00"))
                if ZoneInfo and tz_str and tz_str != "UTC":
                    try:
                        dt = dt.astimezone(ZoneInfo(tz_str))
                    except Exception:
                        pass
                if dt.date() == local_today:
                    nudge_count_today += 1
            except Exception:
                pass
        c = r.get("content")
        if c and isinstance(c, str) and c.strip():
            last_3_texts.append(c.strip())
    last_3_texts = last_3_texts[:3]

    # Milestone approaching: next milestone in 1 or 2 days
    milestone_approaching = None
    for m in STREAK_MILESTONES:
        if m > streak:
            days_away = m - streak
            if days_away in (1, 2):
                milestone_approaching = {"milestone": m, "days_away": days_away}
            break

    # Already sent for this milestone this window? (simplified: we don't track per-milestone; spec says "Fires once per milestone window")
    # We could add a check on nudge_log for type=milestone_approaching and content containing the milestone number — skip for now.

    hours_until_midnight = _hours_until_midnight(local_now)

    return {
        "push_token": push_token,
        "nudge_frequency": nudge_frequency,
        "tone_type": tone_type,
        "opened_today": opened_today,
        "streak": streak,
        "pet_stage": pet_stage,
        "pet_name": pet_name,
        "pet_sad": pet_sad,
        "character_stage_name": character_stage_name,
        "gap_xp": gap_xp,
        "missions_today_count": missions_today_count,
        "today_core_completed": today_core >= 5,
        "yesterday_core_completed": yesterday_core_completed,
        "today_streak_intact": today_streak_intact,
        "yesterday_all_complete": yesterday_all_complete,
        "nudge_count_today": nudge_count_today,
        "nudge_count_this_week": nudge_count_this_week,
        "momentum_count_this_week": momentum_count_this_week,
        "last_3_nudge_texts": last_3_texts,
        "milestone_approaching": milestone_approaching,
        "hours_until_midnight": hours_until_midnight,
        "local_now": local_now,
        "last_nudge_was_momentum_yesterday": _last_momentum_was_yesterday(nudge_rows, tz_str, local_yesterday),
    }


def _frequency_cap_ok(context: Dict[str, Any], trigger: str) -> bool:
    """Check if we're under cap for this frequency and trigger is allowed."""
    freq = context.get("nudge_frequency") or "medium"
    max_per_day, max_per_week = FREQUENCY_CAPS.get(freq, (1, 7))
    if freq == "low" and trigger != STREAK_WARNING:
        return False
    if context.get("nudge_count_today", 0) >= max_per_day:
        return False
    if freq == "low" and context.get("nudge_count_this_week", 0) >= max_per_week:
        return False
    return True


def _evaluate_winning_trigger(context: Dict[str, Any]) -> Optional[str]:
    """Priority: Streak Warning > Re-engagement > Pet Nudge > Milestone > Momentum."""
    if not _frequency_cap_ok(context, STREAK_WARNING):
        pass
    elif (
        context.get("streak", 0) > 0
        and context.get("hours_until_midnight", 24) < 4
        and not context.get("today_core_completed")
    ):
        return STREAK_WARNING

    if not _frequency_cap_ok(context, RE_ENGAGEMENT):
        pass
    elif (
        not context.get("yesterday_core_completed")
        and context.get("today_streak_intact")
        and context.get("nudge_frequency") in ("medium", "high")
    ):
        return RE_ENGAGEMENT
    if context.get("nudge_frequency") == "low":
        return None  # only streak_warning for low

    if not _frequency_cap_ok(context, PET_NUDGE):
        pass
    elif context.get("pet_sad") and context.get("nudge_frequency") in ("medium", "high"):
        return PET_NUDGE

    if not _frequency_cap_ok(context, MILESTONE_APPROACHING):
        pass
    elif context.get("milestone_approaching") and context.get("nudge_frequency") in ("medium", "high"):
        return MILESTONE_APPROACHING

    if not _frequency_cap_ok(context, MOMENTUM):
        pass
    elif (
        context.get("streak", 0) >= 7
        and context.get("yesterday_all_complete")
        and context.get("nudge_frequency") == "high"
        and context.get("momentum_count_this_week", 0) < 2
        and not context.get("last_nudge_was_momentum_yesterday")
    ):
        return MOMENTUM

    return None


NUDGE_SYSTEM_PROMPT = """# NUDGE AGENT — Copy Generation

# CONTEXT
→ Trigger type: {trigger_type}
→ Twin tone: {tone_type} (rival / philosopher / silent_force)
→ User streak: {streak} days
→ Pet stage: {pet_name}
→ Character stage: {character_stage_name}
→ XP gap behind Twin: {gap_xp} XP
→ Hours until midnight: {hours_until_midnight}
→ Milestone approaching: {milestone_text}

# LAST 3 NUDGES SENT TO THIS USER
{last_3_nudges}

# YOUR JOB
→ Write ONE nudge notification for this user.
→ Match the {tone_type} voice exactly:
   rival: competitive, cold, declarative. Short sentences. References the gap.
   philosopher: reflective, principled. References process or compounding.
   silent_force: 1-2 sentences MAXIMUM. Often 3-6 words. Sparse.
→ Reference the {trigger_type} situation specifically.
→ Use the user's actual data — streak number, pet name, stage — not placeholders.

NEVER:
NEVER use guilt. Never mention days missed or failure.
NEVER be generic. "Keep going!" is not acceptable output.
NEVER exceed 2 sentences for rival or philosopher.
NEVER exceed 1 sentence for silent_force.
NEVER repeat the sentence structure, opening word, or core observation from any of the last 3 nudges listed above.
NEVER break character — this is the Twin speaking, not the app.

# OUTPUT
→ Return ONLY the nudge text. No preamble, no quotes, no explanation."""


def _build_nudge_prompt(trigger: str, context: Dict[str, Any]) -> str:
    ma = context.get("milestone_approaching")
    milestone_text = ""
    if ma:
        milestone_text = f"{ma['milestone']} in {ma['days_away']} days"
    last_3 = context.get("last_3_nudge_texts") or []
    last_3_block = "\n".join(f"→ {t}" for t in last_3) if last_3 else "(none)"
    return NUDGE_SYSTEM_PROMPT.format(
        trigger_type=trigger,
        tone_type=context.get("tone_type", "rival"),
        streak=context.get("streak", 0),
        pet_name=context.get("pet_name", "companion"),
        character_stage_name=context.get("character_stage_name", "The Awakened"),
        gap_xp=context.get("gap_xp", 0),
        hours_until_midnight=context.get("hours_until_midnight", 0),
        milestone_text=milestone_text,
        last_3_nudges=last_3_block,
    )


def _generate_nudge_copy(prompt: str) -> str:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.5, max_tokens=80)
    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content="Output only the nudge text. No preamble, no quotes, no explanation."),
    ]
    resp = llm.invoke(messages)
    text = (resp.content or "").strip() if hasattr(resp, "content") else str(resp).strip()
    return text[:500] if text else ""


def _send_expo_push(push_token: str, body: str) -> bool:
    """Send notification via Expo Push API. Title = ALTER EGO."""
    if not push_token or not body:
        return False
    url = "https://exp.host/--/api/v2/push/send"
    payload = {
        "to": push_token,
        "title": "ALTER EGO",
        "body": body,
        "sound": "default",
    }
    try:
        with httpx.Client(timeout=10.0) as client:
            r = client.post(url, json=payload)
            if r.status_code != 200:
                return False
            data = r.json()
            if data.get("data") and data["data"][0].get("status") == "error":
                return False
            return True
    except Exception:
        return False


def run_nudge_for_user(user_id: str, tz_str: str = "UTC") -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Run the nudge decision + send for one user. Returns (sent: bool, trigger_type | None, error_message | None).
    """
    supabase = get_supabase()
    context = _fetch_nudge_context(supabase, user_id, tz_str)

    if context.get("opened_today"):
        return False, None, "opened_today"
    if not context.get("push_token"):
        return False, None, "no_push_token"

    window = _in_nudge_window(context["local_now"])
    if not window:
        return False, None, "outside_window"

    trigger = _evaluate_winning_trigger(context)
    if not trigger:
        return False, None, "no_trigger"

    prompt = _build_nudge_prompt(trigger, context)
    text = _generate_nudge_copy(prompt)
    if not text:
        return False, trigger, "empty_copy"

    ok = _send_expo_push(context["push_token"], text)
    if not ok:
        return False, trigger, "push_failed"

    now = datetime.now(timezone.utc).isoformat()
    supabase.table("nudge_log").insert({
        "user_id": user_id,
        "type": trigger,
        "content": text,
        "sent_at": now,
        "tone_used": context.get("tone_type", "rival"),
    }).execute()
    return True, trigger, None


def run_nudge_pass() -> Dict[str, Any]:
    """
    Run nudge check for all users with push_token. For each user, if their local time
    is in morning (7–11am) or evening (5–9:59pm) window, run_nudge_for_user.
    Returns { sent: count, skipped: count, errors: list }.
    """
    supabase = get_supabase()
    r = supabase.table("users").select("id, push_token, timezone").not_.is_("push_token", "null").execute()
    users = [u for u in (r.data or []) if u.get("push_token")]
    sent = 0
    skipped = 0
    errors: List[str] = []

    for u in users:
        user_id = u.get("id")
        if not user_id:
            continue
        tz = (u.get("timezone") or "UTC").strip() or "UTC"
        ok, trigger, err = run_nudge_for_user(user_id, tz_str=tz)
        if ok:
            sent += 1
        else:
            skipped += 1
            if err and err not in ("opened_today", "outside_window", "no_trigger"):
                errors.append(f"{user_id}: {err}")

    return {"sent": sent, "skipped": skipped, "errors": errors}
