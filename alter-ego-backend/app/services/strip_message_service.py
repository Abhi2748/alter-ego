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

import logging
import random
from datetime import datetime

from app.core.supabase_client import supabase_admin

logger = logging.getLogger(__name__)


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
    bank = STRIP_MESSAGES.get(gap_state, STRIP_MESSAGES["neck_and_neck"])
    messages = bank.get(tone_type, bank.get("rival", ["Still here."]))
    msg = random.choice(messages)
    return msg.replace("{username}", username)


async def update_strip_message(
    user_id: str,
    event: str | None = None,
) -> str | None:
    """
    Updates the strip message in twin_state based on current conditions.

    Called:
    - After twin simulation (daily, if frequency allows)
    - On significant events (gap change, milestone, all missions complete)

    Returns the new message or None if not updated.
    """
    # Load required data
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

    dna_result = (
        supabase_admin.table("discipline_dna")
        .select("twin_tone_type, twin_message_frequency")
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    dna = dna_result.data
    if not dna:
        return None

    user_result = (
        supabase_admin.table("users")
        .select("username")
        .eq("id", user_id)
        .single()
        .execute()
    )
    username = user_result.data.get("username", "you") if user_result.data else "you"

    tone_type = normalize_strip_tone(dna.get("twin_tone_type", "rival"))
    frequency = dna.get("twin_message_frequency", "medium")
    gap_state = twin.get("current_gap_state", "neck_and_neck")
    last_updated = twin.get("last_strip_updated")
    strip_empty = not (twin.get("strip_message") or "").strip()

    # Check if we should update based on frequency
    # Events always trigger an update regardless of frequency
    # Empty strip always gets a message (frequency only limits rotation when copy exists)
    if event is None and last_updated and not strip_empty:
        try:
            last_dt = datetime.fromisoformat(str(last_updated))
            days_since = (datetime.utcnow() - last_dt).days
        except ValueError:
            days_since = 999

        if frequency == "high" and days_since < 1:
            return None  # Already updated today
        if frequency == "medium" and days_since < 2:
            return None  # Update every 2-3 days
        if frequency == "low" and days_since < 7:
            return None  # Only on significant events for low frequency

    # Generate new message
    new_message = get_strip_message(gap_state, tone_type, event, username)

    # Don't repeat the same message twice in a row (for non-event updates)
    current_message = twin.get("strip_message", "") or ""
    if event is None and new_message == current_message:
        bank = STRIP_MESSAGES.get(gap_state, STRIP_MESSAGES["neck_and_neck"])
        messages = bank.get(tone_type, bank.get("rival", ["Still here."]))
        if len(messages) > 1:
            remaining = [m for m in messages if m != current_message]
            if remaining:
                new_message = random.choice(remaining)

    # Store in twin_state
    supabase_admin.table("twin_state").update(
        {
            "strip_message": new_message,
            "last_strip_updated": datetime.utcnow().isoformat(),
        }
    ).eq("user_id", user_id).execute()

    return new_message

