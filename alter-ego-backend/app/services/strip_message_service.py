"""
Home strip message service.

The strip message is the twin's voice on the home screen.
It appears below the XP bar and navigates to TwinChatScreen when tapped.

Messages are pre-written — zero LLM cost.
Indexed by: gap_state × tone_type
Selected randomly from the matching bank to ensure variety.

Update frequency (controlled by twin_message_frequency in discipline_dna):
  high:   new message every day
  medium: new message every 2-3 days
  low:    new message only on significant events (gap change, milestone)
"""

from __future__ import annotations

import json
import logging
import random
import re
from collections import defaultdict
from datetime import datetime, timezone

from app.core.supabase_client import supabase_admin

logger = logging.getLogger(__name__)


def _strip_core_pillar_key(m: dict) -> str:
    """Stable pillar id for core rows: journal mission uses pillar 'journal'."""
    if m.get("is_journal_mission"):
        return "journal"
    return str(m.get("core_pillar") or "").lower()


def _strip_hour_label(h: int | None) -> str:
    """12h label for strip copy (e.g. 7am, 3pm)."""
    if h is None:
        return "—"
    h = int(h) % 24
    if h == 0:
        return "12am"
    if 1 <= h <= 11:
        return f"{h}am"
    if h == 12:
        return "12pm"
    return f"{h - 12}pm"


def normalize_strip_gap_state(gap_state: str | None) -> str:
    """Map DB gap_state to STRIP_MESSAGES keys."""
    g = (gap_state or "neck_and_neck").strip().lower().replace("-", "_")
    allowed = frozenset(
        {"user_ahead", "neck_and_neck", "slightly_behind", "significantly_behind"}
    )
    if g in allowed:
        return g
    aliases = {
        "userahead": "user_ahead",
        "neckandneck": "neck_and_neck",
        "slightlybehind": "slightly_behind",
        "significantlybehind": "significantly_behind",
        "behind": "slightly_behind",
        "twin_ahead": "slightly_behind",
    }
    return aliases.get(g, "neck_and_neck")


def normalize_strip_tone(tone_type: str | None) -> str:
    """Map DB / API tone values to STRIP_MESSAGES keys (rival | philosopher | silent_force)."""
    t = (tone_type or "rival").strip().lower()
    if t in ("philosopher", "philosophical"):
        return "philosopher"
    if t in ("silent_force", "silent"):
        return "silent_force"
    if t == "rival":
        return "rival"
    return "rival"


# ── MESSAGE BANKS ────────────────────────────────────────────────────────
# Structure: STRIP_MESSAGES[gap_state][tone_type] = [list of messages]
# Each message uses {username} as a placeholder (replaced at render time)

STRIP_MESSAGES = {
    "user_ahead": {
        "rival": [
            "You got ahead. Don't get comfortable.",
            "The lead is yours. For now.",
            "I'm closing it. Enjoy the gap while it lasts.",
            "You crossed me. Now let's see if you can hold it.",
            "Ahead means nothing without tomorrow.",
        ],
        "philosopher": [
            "Ahead means nothing without tomorrow's decision.",
            "You earned this position. Earn it again tomorrow.",
            "The lead is real. So is the work that created it.",
            "Being ahead is not arrival. It is a new starting point.",
            "You built this gap. The question is what you build next.",
        ],
        "silent_force": [
            "Good.",
            "I'm close.",
            "Still moving.",
            "Not done.",
            "Closing.",
        ],
    },
    "neck_and_neck": {
        "rival": [
            "Same level. One decision breaks this either way.",
            "Still here. Still close. Don't think that's an accident.",
            "Even. One day tips this.",
            "You want to match me. Prove it tomorrow.",
            "This is where it gets decided.",
        ],
        "philosopher": [
            "Same ground. Different pressure. You feel it.",
            "This is where character actually forms. Right here.",
            "Equal ground. Not for long.",
            "Same position. Different intentions.",
            "The gap is zero. The difference is not.",
        ],
        "silent_force": [
            "Even.",
            "Tomorrow decides.",
            "Same.",
            "Watch.",
            "Now.",
        ],
    },
    "slightly_behind": {
        "rival": [
            "You hesitated. I didn't.",
            "The gap is yours. You made it.",
            "I'm not waiting.",
            "Three missions. I completed five.",
            "The gap is real. So is closing it.",
        ],
        "philosopher": [
            "The gap isn't the problem. The decision that created it is.",
            "Work is your right. The outcome isn't promised. Show up anyway.",
            "Distance between us is not the issue. Today's choice is.",
            "A gap this size closes in a week of showing up.",
            "What you did yesterday created this. Today can change it.",
        ],
        "silent_force": [
            "The gap speaks.",
            "Still moving.",
            "Behind.",
            "Close it.",
            "Show up.",
        ],
    },
    "significantly_behind": {
        "rival": [
            "I'm not going anywhere. Come back when you're ready.",
            "The gap doesn't close itself.",
            "I kept going. That's all that happened.",
            "You know what to do. The gap is just proof you haven't done it.",
            "It's still possible. Not automatic.",
        ],
        "philosopher": [
            "The distance between us is not the problem. The next decision is all that exists.",
            "Start. That's the only instruction.",
            "A long gap was built one day at a time. It closes the same way.",
            "What exists between us is simply time and choices. Both can change.",
            "The size of the gap is irrelevant. The direction you move is not.",
        ],
        "silent_force": [
            "...",
            "Start.",
            "Still here.",
            "One day.",
            "Begin.",
        ],
    },
}

# Special messages for significant events (override normal rotation)
EVENT_MESSAGES = {
    "user_just_passed_twin": {
        "rival": "You crossed me. Now let's see if you can hold it.",
        "philosopher": "You overtook me. The real question is what you do with that.",
        "silent_force": "You passed me.",
    },
    "twin_just_passed_user": {
        "rival": "I took it back. Expected.",
        "philosopher": "The lead changed hands. This is how it works.",
        "silent_force": "Back.",
    },
    "streak_milestone": {
        "rival": "A milestone. Good. The gap still exists.",
        "philosopher": "A streak milestone. The number is real. So is what built it.",
        "silent_force": "Milestone reached.",
    },
    "user_completed_all_today": {
        "rival": "All of them today. Good. The gap narrowed.",
        "philosopher": "A clean day. That is what building looks like.",
        "silent_force": "Done.",
    },
}

# ── CONTEXT-AWARE TEMPLATES ──────────────────────────────────────────────
# Used when today's data produces a specific observation.
# Variables: {pillar} = skipped pillar name, {count} = distinct local days skipped
#            (Mon–Sun week through today); {user_time}/{twin_time} = 12h labels;
#            {done}/{total}/{remaining} = mission counts.
# guilt_orientation > 0.7: use _safe variants (no blame language)

CONTEXT_MESSAGES = {
    # User skipped a specific pillar (and Twin completed it)
    "twin_done_user_skipped": {
        "rival": [
            "You skipped {pillar} again. {count} day(s) so far this week.",
            "{pillar} — you passed on it. I didn't.",
            "I did {pillar} around {twin_time}. It took under 15 minutes.",
            "{pillar} keeps getting skipped. The pattern is yours.",
        ],
        "rival_safe": [  # guilt_orientation > 0.7
            "{pillar} didn't happen today. I completed it.",
            "I finished {pillar}. You didn't today.",
            "{pillar} — I got to it. You didn't.",
        ],
        "philosopher": [
            "Skipping {pillar} on {count} day(s) so far this week. That's a pattern worth noticing.",
            "The mission you keep skipping is the one that matters most.",
            "{pillar} keeps getting moved to tomorrow.",
        ],
        "silent_force": [
            "{pillar}. Again.",
            "Skipped.",
            "I did it.",
        ],
    },
    # User completed everything today
    "user_completed_all": {
        "rival": [
            "All of them today. Even the one you usually skip.",
            "Clean day. The gap moved.",
            "You finished everything. So did I. Earlier.",
        ],
        "philosopher": [
            "Every mission today. That's what the data looks like when you show up.",
            "Full completion. That's the version of you the rest of the week needs.",
            "Everything done. Not a small thing.",
        ],
        "silent_force": [
            "Done.",
            "All of them.",
            "Full day.",
        ],
    },
    # User finished late, Twin finished early (uses 12h labels, not raw 0–23)
    "timing_gap": {
        "rival": [
            "You finished at {user_time}. I was done by {twin_time}.",
            "Same missions. You wrapped at {user_time}. I was done by {twin_time}.",
            "We both finished. I started where your day ended.",
        ],
        "philosopher": [
            "Same missions completed. You at {user_time}, me by {twin_time}. Worth noticing.",
            "The work got done. The timing tells a different story.",
        ],
        "silent_force": [
            "Done late.",
            "I was earlier.",
            "Timing noted.",
        ],
    },
    # User partially done, day still in progress
    "partial_progress": {
        "rival": [
            "{done} of {total} so far. {remaining} still open.",
            "You're at {done}/{total}. I finished mine.",
            "{remaining} left. The day isn't over.",
        ],
        "philosopher": [
            "{done} of {total} today. The remaining ones are still possible.",
            "Partway through. That's further than zero.",
        ],
        "silent_force": [
            "{done} done.",
            "Still open.",
            "Not finished.",
        ],
    },
}


def get_strip_message(
    gap_state: str,
    tone_type: str,
    event: str | None = None,
    username: str = "you",
) -> str:
    """
    Returns a strip message for the given context.
    If event is provided, returns the event-specific message.
    Otherwise picks randomly from the gap_state × tone_type bank.
    """
    tone_key = normalize_strip_tone(tone_type)
    if event and event in EVENT_MESSAGES:
        msg = EVENT_MESSAGES[event].get(
            tone_key, EVENT_MESSAGES[event].get("rival", "")
        )
        return msg.replace("{username}", username)

    tone_type = tone_key
    gap_state = normalize_strip_gap_state(gap_state)
    bank = STRIP_MESSAGES.get(gap_state, STRIP_MESSAGES["neck_and_neck"])
    messages = bank.get(tone_type, bank.get("rival", ["Still here."]))
    msg = random.choice(messages)
    return msg.replace("{username}", username)


def _format_context_message(msg: str, **kwargs: object) -> str:
    """Format `{name}` placeholders; missing keys become empty string (no KeyError)."""
    keys = set(re.findall(r"\{(\w+)\}", msg))
    if not keys:
        return msg
    base: dict[str, object] = {
        "done": 0,
        "total": 0,
        "remaining": 0,
        "hour": 0,
        "twin_hour": 0,
        "user_time": "",
        "twin_time": "",
        "pillar": "",
        "count": 0,
    }
    merged = {**base, **kwargs}
    return msg.format(**{k: merged.get(k, "") for k in keys})


def _pool_without_clock_time(pool: list[str]) -> list[str]:
    """Strip lines that claim a specific time — simulated_hour is for sim order, not lifelike copy."""
    return [m for m in pool if "{twin_time}" not in m and "{twin_hour}" not in m]


def _build_context_message(
    gap_state: str,
    tone_type: str,
    guilt_orientation: float,
    missions_completed_today: int,
    missions_total_today: int,
    skipped_pillars_today: list[str],
    twin_pillar_done: set[str],
    user_finish_hour: int | None,
    twin_start_hour: int | None,
    pillar_skip_counts: dict[str, int],
) -> str | None:
    """
    Returns a context-specific strip message if today's data warrants one.
    Returns None if no specific context applies — caller falls back to bank.
    """
    gap_state = normalize_strip_gap_state(gap_state)
    tone_key = normalize_strip_tone(tone_type)
    high_guilt = guilt_orientation > 0.7

    fmt_kwargs: dict[str, object] = {
        "done": 0,
        "total": 0,
        "remaining": 0,
        "hour": 0,
        "twin_hour": 0,
        "user_time": "",
        "twin_time": "",
        "pillar": "",
        "count": 0,
    }

    # Context 1 — User completed everything today
    if missions_total_today > 0 and missions_completed_today >= missions_total_today:
        bank_key = "user_completed_all"
        pool = CONTEXT_MESSAGES[bank_key].get(
            tone_key, CONTEXT_MESSAGES[bank_key].get("rival", [])
        )
        if pool:
            msg = random.choice(pool)
            # Timing variant: if user finished late AND twin started early
            if (
                user_finish_hour is not None
                and twin_start_hour is not None
                and user_finish_hour >= 18
                and twin_start_hour <= 9
                and tone_key in ("rival", "philosopher")
            ):
                timing_pool = CONTEXT_MESSAGES["timing_gap"].get(
                    tone_key, CONTEXT_MESSAGES["timing_gap"].get("rival", [])
                )
                if timing_pool:
                    msg = random.choice(timing_pool)
                    fmt_kwargs.update(
                        {
                            "hour": user_finish_hour,
                            "twin_hour": twin_start_hour,
                            "done": missions_completed_today,
                            "total": missions_total_today,
                            "remaining": 0,
                            "pillar": "",
                            "count": 0,
                        }
                    )
                    return _format_context_message(msg, **fmt_kwargs)
            fmt_kwargs.update(
                {
                    "done": missions_completed_today,
                    "total": missions_total_today,
                    "remaining": 0,
                    "hour": user_finish_hour or 0,
                    "twin_hour": twin_start_hour or 0,
                    "pillar": "",
                    "count": 0,
                }
            )
            return _format_context_message(msg, **fmt_kwargs)

    # Context 2 — Twin did a mission that user skipped (specific pillar callout)
    if skipped_pillars_today and twin_pillar_done:
        skipped_and_twin_did = [
            p for p in skipped_pillars_today if p in twin_pillar_done
        ]
        if skipped_and_twin_did:
            target_pillar = max(
                skipped_and_twin_did,
                key=lambda p: pillar_skip_counts.get(p, 1),
            )
            skip_count = pillar_skip_counts.get(target_pillar, 1)
            pillar_display = target_pillar.replace("_", " ").title()

            if high_guilt:
                pool = CONTEXT_MESSAGES["twin_done_user_skipped"].get(
                    f"{tone_key}_safe",
                    CONTEXT_MESSAGES["twin_done_user_skipped"].get("rival_safe", []),
                )
            else:
                pool = CONTEXT_MESSAGES["twin_done_user_skipped"].get(
                    tone_key,
                    CONTEXT_MESSAGES["twin_done_user_skipped"].get("rival", []),
                )

            if pool:
                # Journal: never claim a simulated “7am” style time — users often journal at night;
                # twin_mission_log uses simulated_hour for ordering, not a literal clock story.
                use_clock_in_copy = target_pillar != "journal" and twin_start_hour is not None
                if not use_clock_in_copy:
                    filtered = _pool_without_clock_time(pool)
                    if filtered:
                        pool = filtered
                msg = random.choice(pool)
                th = twin_start_hour if twin_start_hour is not None else 0
                fmt_kwargs.update(
                    {
                        "pillar": pillar_display,
                        "count": skip_count,
                        "twin_hour": th,
                        "twin_time": _strip_hour_label(twin_start_hour) if twin_start_hour is not None else "",
                        "done": missions_completed_today,
                        "total": missions_total_today,
                        "remaining": max(0, missions_total_today - missions_completed_today),
                        "hour": user_finish_hour or 0,
                        "user_time": _strip_hour_label(user_finish_hour),
                    }
                )
                return _format_context_message(msg, **fmt_kwargs)

    # Context 3 — Partial progress (user has done some but not all, day still open)
    if (
        missions_total_today > 0
        and 0 < missions_completed_today < missions_total_today
        and gap_state in ("slightly_behind", "significantly_behind", "neck_and_neck")
    ):
        remaining = missions_total_today - missions_completed_today
        if remaining >= 1:
            pool = CONTEXT_MESSAGES["partial_progress"].get(
                tone_key,
                CONTEXT_MESSAGES["partial_progress"].get("rival", []),
            )
            if pool:
                msg = random.choice(pool)
                fmt_kwargs.update(
                    {
                        "done": missions_completed_today,
                        "total": missions_total_today,
                        "remaining": remaining,
                        "pillar": "",
                        "count": 0,
                        "hour": user_finish_hour or 0,
                        "twin_hour": twin_start_hour or 0,
                    }
                )
                return _format_context_message(msg, **fmt_kwargs)

    return None


async def update_strip_message(
    user_id: str,
    event: str | None = None,
    force: bool = False,
) -> str | None:
    """
    Updates the strip message in twin_state based on current conditions.
    Context-aware: checks today's mission data before falling back to banks.
    """
    from datetime import date as date_cls
    from datetime import timedelta
    from zoneinfo import ZoneInfo

    from app.services.mission_service import get_user_date

    # ── Load twin state ──────────────────────────────────────────────────
    twin_result = (
        supabase_admin.table("twin_state")
        .select("current_gap_state, strip_message, last_strip_updated")
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    twin = twin_result.data
    if not twin:
        return None

    # ── Load DNA (tone, frequency, guilt_orientation) ────────────────────
    dna_result = (
        supabase_admin.table("discipline_dna")
        .select("twin_tone_type, twin_message_frequency, guilt_orientation")
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    dna = dna_result.data
    if not dna:
        return None

    # ── Load user (username, timezone) ──────────────────────────────────
    user_result = (
        supabase_admin.table("users")
        .select("username, timezone")
        .eq("id", user_id)
        .single()
        .execute()
    )
    user_row = user_result.data or {}
    username = user_row.get("username") or "you"
    tz_str = str(user_row.get("timezone") or "UTC").strip() or "UTC"

    tone_type = normalize_strip_tone(dna.get("twin_tone_type", "rival"))
    frequency = dna.get("twin_message_frequency", "medium")
    gap_state = normalize_strip_gap_state(twin.get("current_gap_state", "neck_and_neck"))
    last_updated = twin.get("last_strip_updated")
    strip_empty = not (twin.get("strip_message") or "").strip()
    guilt_orientation = float(dna.get("guilt_orientation") or 0.0)

    # ── Frequency gate (events and empty strip always pass through) ──────
    if event is None and last_updated and not strip_empty and not force:
        try:
            raw = str(last_updated).replace("Z", "+00:00")
            last_dt = datetime.fromisoformat(raw)
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            tz_info = ZoneInfo(tz_str)
            now_u = datetime.now(tz_info)
            last_u = last_dt.astimezone(tz_info)
            days_since = (now_u.date() - last_u.date()).days
        except (ValueError, TypeError, OSError):
            days_since = 999

        if frequency == "high" and days_since < 1:
            return None
        if frequency == "medium" and days_since < 2:
            return None
        if frequency == "low" and days_since < 7:
            return None

    # ── Event override (unchanged) ────────────────────────────────────────
    if event and event in EVENT_MESSAGES:
        new_message = get_strip_message(gap_state, tone_type, event, username)
        supabase_admin.table("twin_state").update(
            {
                "strip_message": new_message,
                "last_strip_updated": datetime.utcnow().isoformat(),
            }
        ).eq("user_id", user_id).execute()
        return new_message

    # ── Fetch today's context data ────────────────────────────────────────
    new_message: str | None = None

    try:
        today = get_user_date(tz_str)

        user_missions = (
            supabase_admin.table("missions")
            .select("completed, core_pillar, completed_at, type, is_journal_mission")
            .eq("user_id", user_id)
            .eq("mission_date", today)
            .execute()
            .data
            or []
        )

        missions_total_today = len(user_missions)
        missions_completed_today = sum(1 for m in user_missions if m.get("completed"))

        user_finish_hour: int | None = None
        completed_missions = [m for m in user_missions if m.get("completed") and m.get("completed_at")]
        if completed_missions:
            try:
                completed_missions.sort(key=lambda m: str(m.get("completed_at") or ""), reverse=True)
                raw_ts = completed_missions[0]["completed_at"]
                dt = datetime.fromisoformat(str(raw_ts).replace("Z", "+00:00"))
                try:
                    local_dt = dt.astimezone(ZoneInfo(tz_str))
                    user_finish_hour = local_dt.hour
                except Exception:
                    user_finish_hour = dt.hour
            except Exception:
                pass

        user_skipped_pillars = set()
        for m in user_missions:
            if m.get("type") != "core" or m.get("completed"):
                continue
            pk = _strip_core_pillar_key(m)
            if pk:
                user_skipped_pillars.add(pk)

        twin_log = (
            supabase_admin.table("twin_mission_log")
            .select("core_pillar, simulated_hour")
            .eq("user_id", user_id)
            .eq("mission_date", today)
            .execute()
            .data
            or []
        )
        twin_pillar_done = {
            str(r.get("core_pillar") or "").lower()
            for r in twin_log
            if r.get("core_pillar")
        }

        twin_start_hour: int | None = None
        if twin_log:
            hours = [int(r.get("simulated_hour") or 99) for r in twin_log if r.get("simulated_hour") is not None]
            if hours:
                twin_start_hour = min(hours)

        skipped_pillars_today = [p for p in user_skipped_pillars if p in twin_pillar_done and p]

        pillar_skip_counts: dict[str, int] = {}
        if skipped_pillars_today:
            try:
                td = date_cls.fromisoformat(today)
                week_start = td - timedelta(days=td.weekday())
                week_start_iso = week_start.isoformat()
                week_missions = (
                    supabase_admin.table("missions")
                    .select("mission_date, completed, core_pillar, is_journal_mission")
                    .eq("user_id", user_id)
                    .eq("type", "core")
                    .gte("mission_date", week_start_iso)
                    .lte("mission_date", today)
                    .execute()
                    .data
                    or []
                )
                skip_days_by_pillar: dict[str, set[str]] = defaultdict(set)
                for m in week_missions:
                    if m.get("completed"):
                        continue
                    p = _strip_core_pillar_key(m)
                    if not p:
                        continue
                    d = str(m.get("mission_date") or "")[:10]
                    if d:
                        skip_days_by_pillar[p].add(d)
                pillar_skip_counts = {p: len(days) for p, days in skip_days_by_pillar.items()}
            except Exception:
                pass
            # Today is always at least one skip day for pillars still incomplete (covers query edge cases).
            for p in skipped_pillars_today:
                pillar_skip_counts[p] = max(int(pillar_skip_counts.get(p, 0)), 1)

        new_message = _build_context_message(
            gap_state=gap_state,
            tone_type=tone_type,
            guilt_orientation=guilt_orientation,
            missions_completed_today=missions_completed_today,
            missions_total_today=missions_total_today,
            skipped_pillars_today=skipped_pillars_today,
            twin_pillar_done=twin_pillar_done,
            user_finish_hour=user_finish_hour,
            twin_start_hour=twin_start_hour,
            pillar_skip_counts=pillar_skip_counts,
        )

    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "strip_context_fetch_error",
                    "user_id": user_id,
                    "error": str(e)[:200],
                }
            )
        )

    # ── Fallback to existing bank if no context message ──────────────────
    if not new_message:
        new_message = get_strip_message(gap_state, tone_type, None, username)

        current_message = twin.get("strip_message", "") or ""
        if new_message == current_message:
            bank = STRIP_MESSAGES.get(gap_state, STRIP_MESSAGES["neck_and_neck"])
            messages = bank.get(tone_type, bank.get("rival", ["Still here."]))
            if len(messages) > 1:
                remaining = [m for m in messages if m != current_message]
                if remaining:
                    new_message = random.choice(remaining)
    else:
        new_message = new_message.replace("{username}", username)

    # ── Store ─────────────────────────────────────────────────────────────
    supabase_admin.table("twin_state").update(
        {
            "strip_message": new_message,
            "last_strip_updated": datetime.utcnow().isoformat(),
        }
    ).eq("user_id", user_id).execute()

    return new_message

