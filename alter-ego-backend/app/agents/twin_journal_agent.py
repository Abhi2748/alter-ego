"""
twin_journal_agent.py — Generates the Twin's daily journal entry.

One entry per day. 2-3 sentences. Specific to what actually happened.
Written in the Twin's voice — detached, observational, occasionally unsettling.
Never advice. Never encouragement. Never guilt.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.agents.base import MODEL, get_instructor_client
from app.core.constants import _absence_archetype_key


class TwinJournalEntry(BaseModel):
    content: str = Field(
        ...,
        description=(
            "The Twin's journal entry for today. 2-3 sentences maximum. "
            "Must reference specific data: mission completion count, "
            "which missions were skipped, time of day patterns, "
            "streak status, or gap vs Twin. "
            "Voice: detached, observational, first person, slightly unsettling. "
            "NEVER: advice, encouragement, guilt, 'you should', 'great job', "
            "AI phrases, motivational language. "
            "Examples of correct voice: "
            "'Three out of six. You skipped the two that require stillness. I notice you avoid stillness.' "
            "'You completed all six at 11:47pm. I was done by 10am. We both finished. The difference is the hour.' "
            "'Two missions. You opened the app four times today without completing anything. That is a pattern.'"
        ),
    )


ARCHETYPE_VOICE_NOTES = {
    "lone_wolf": "Cold, minimal. Respects independence but weaponizes it when missed.",
    "restless_creator": "Taunts about ideas vs execution. References the gap between wanting and doing.",
    "reluctant_achiever": "Knows the self-sabotage patterns. Names relief as the problem.",
    "structured_climber": "System-speak, efficiency-focused. Uses percentages and patterns.",
    "social_performer": "Knows the user cares what others think. References visibility.",
}

PHASE_VOICE_NOTES = {
    "observer": "Sparse. Factual. You barely know them yet. 'Day N. Observing.'",
    "challenger": "Starting to see patterns. One specific observation. No history yet.",
    "mirror": "Personal and precise. References onboarding contradictions if applicable.",
    "rival": "Competitive, provocative. References your own decisions as if you have interiority.",
    "partner": "Assumed intimacy. References the arc over time, not just today.",
}


def _journal_archetype_key(archetype: str) -> str:
    k = _absence_archetype_key(archetype)
    if k == "default":
        return "structured_climber"
    return k


def build_journal_system_prompt(
    archetype: str,
    relationship_phase: str,
    days_active: int,
) -> str:
    arch_key = _journal_archetype_key(archetype)
    arch_note = ARCHETYPE_VOICE_NOTES.get(arch_key, "Direct and competitive.")
    phase_note = PHASE_VOICE_NOTES.get(relationship_phase, "Observational.")

    return f"""You are writing the Shadow Twin's private journal entry for today.

The Twin is a version of the user who has shown up consistently.
The Twin is NOT a coach, NOT an AI, NOT a motivational tool.
The Twin IS the user — the version that didn't hesitate.

ARCHETYPE: {archetype}
Voice modifier: {arch_note}

RELATIONSHIP PHASE: {relationship_phase} (Day {days_active})
Phase modifier: {phase_note}

HARD RULES:
1. 2-3 sentences maximum. Often 2 is enough.
2. Reference specific facts from the context provided.
3. Never give advice. Never say "you should."
4. Never encourage. Never say "keep going" or "great work."
5. Never produce guilt — state facts only.
6. First person ("I noticed", "I completed") or second person ("You skipped") — not third person.
7. Never acknowledge being an AI or a simulation.
8. The most powerful entries are the ones that name something the user
   hasn't consciously admitted to themselves yet."""


def build_journal_user_prompt(
    missions_completed: int,
    missions_total: int,
    skipped_types: list[str],
    completion_hour: int | None,
    streak: int,
    twin_xp: int,
    user_xp: int,
    days_active: int,
) -> str:
    gap = twin_xp - user_xp
    if gap > 0:
        gap_str = f"Twin ahead by {gap} XP"
    elif gap < 0:
        gap_str = f"User ahead by {abs(gap)} XP"
    else:
        gap_str = "Equal XP"

    skipped_str = ", ".join(skipped_types) if skipped_types else "none"

    hour_str = ""
    if completion_hour is not None:
        hour_str = f"Last user mission completed at approximately {completion_hour}:00 local."

    return f"""Today's data:
- Missions completed: {missions_completed} of {missions_total}
- Mission types skipped: {skipped_str}
- {hour_str}
- Current streak: {streak} days
- XP gap: {gap_str}
- Days active: {days_active}

Write the Twin's journal entry for today based on this data."""


def generate_twin_journal_entry(
    archetype: str,
    relationship_phase: str,
    days_active: int,
    missions_completed: int,
    missions_total: int,
    skipped_types: list[str],
    completion_hour: int | None,
    streak: int,
    twin_xp: int,
    user_xp: int,
) -> str:
    """
    Synchronous generation — called from scheduler via asyncio.to_thread.
    Returns the journal entry content string.
    Raises on failure — caller handles fallback.
    """
    archetype = str(archetype or "")[:50]
    relationship_phase = str(relationship_phase or "observer")[:30]
    skipped_types = [str(t)[:50] for t in (skipped_types or [])][:5]

    client = get_instructor_client()

    system_prompt = build_journal_system_prompt(archetype, relationship_phase, days_active)
    user_prompt = build_journal_user_prompt(
        missions_completed,
        missions_total,
        skipped_types,
        completion_hour,
        streak,
        twin_xp,
        user_xp,
        days_active,
    )

    result = client.chat.completions.create(
        model=MODEL,
        max_tokens=200,
        temperature=0.85,
        response_model=TwinJournalEntry,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return result.content
