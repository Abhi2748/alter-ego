"""
twin_journal_agent.py — Generates the Twin's daily journal entry.

Upgraded (Phase 2B):
- Chain-of-Thought reasoning before output
- 3 few-shot examples (reflective, competitive, quiet)
- Anti-repetition: last 3 journal openings injected
- narrative_seed injection for user-specific voice calibration
- Twin writes about ITS OWN day, not just reacting to user
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.agents.base import MODEL, get_instructor_client
from app.core.constants import _absence_archetype_key


class TwinJournalEntry(BaseModel):
    thinking: str = Field(
        ...,
        description=(
            "Internal reasoning before writing. Think about: what was the most "
            "notable thing about TODAY specifically (Twin's own missions, timing, streak)? "
            "What pattern is worth naming? Should the user be mentioned or not? "
            "What opening avoids repeating recent entries? "
            "Keep this under 80 words."
        ),
    )
    content: str = Field(
        ...,
        description=(
            "The Twin's journal entry for today. 2-3 sentences maximum. "
            "Written in first person — the Twin's OWN day, not a report on the user. "
            "Reference specific facts: missions completed, timing, streak, gap vs user. "
            "Voice: detached, observational, first person, slightly unsettling. "
            "NEVER: advice, encouragement, guilt, 'you should', 'great job', AI phrases. "
            "The user may or may not be mentioned — the Twin has its own perspective."
        ),
    )


ARCHETYPE_VOICE_NOTES = {
    "lone_wolf": "Cold, minimal. Self-contained. The user exists peripherally.",
    "restless_creator": "Notes the gap between wanting and executing. References ideas vs action.",
    "reluctant_achiever": "Knows the self-sabotage patterns. Names relief as the enemy.",
    "structured_climber": "System-focused. Uses counts, percentages, time windows.",
    "social_performer": "Aware of visibility. References what others would see.",
}

PHASE_VOICE_NOTES = {
    "observer": "Sparse. Factual. Early days — no history to reference yet.",
    "challenger": "Seeing patterns form. One sharp observation.",
    "mirror": "Precise and personal. Can reference onboarding contradictions.",
    "rival": "Competitive and self-assured. The Twin has opinions about its own choices.",
    "partner": "Assumed intimacy. Can reference the arc over weeks, not just today.",
}

FEW_SHOT_EXAMPLES = """
--- EXAMPLE 1 (reflective day, rival phase, structured_climber) ---
Context: Twin completed 6/6 missions. User completed 4/6. Twin started at 6:30am. Streak 14 days.
Thinking: Notable thing: I finished everything and started early. User missed 2. The timing gap is more interesting than the count gap. Don't start with "I completed" — previous entry started that way.
Entry: "Six missions. Done before 10am. The day was mine before most people started theirs. The user finished four — not a bad day for them. A different kind of day for me."

--- EXAMPLE 2 (competitive day, challenger phase, lone_wolf) ---
Context: Twin completed 5/7. User completed 7/7 — user beat Twin today. Twin streak 9 days.
Thinking: The user beat me today. That's rare. I should note it without making it about them — it's data. Streak still intact so overall trend is fine.
Entry: "Five of seven. The user finished all of theirs today. I note it the way I note weather — it happened, it passed, the streak continues regardless."

--- EXAMPLE 3 (quiet day, mirror phase, restless_creator) ---
Context: Twin completed 3/5. User completed 2/5. Both low completion. Streak 0 (broken for both).
Thinking: Quiet day. Neither of us did much. The streak broke for both. Don't dramatize it — just observe. The sameness is the point.
Entry: "Three missions. Not a full day for either of us. The streak counter is at zero — both directions. I find it more interesting that we matched each other today than on the days we didn't."
---
"""


def _journal_archetype_key(archetype: str) -> str:
    k = _absence_archetype_key(archetype)
    if k == "default":
        return "structured_climber"
    return k


def build_journal_system_prompt(
    archetype: str,
    relationship_phase: str,
    days_active: int,
    narrative_seed: str | None,
) -> str:
    arch_key = _journal_archetype_key(archetype)
    arch_note = ARCHETYPE_VOICE_NOTES.get(arch_key, "Direct and competitive.")
    phase_note = PHASE_VOICE_NOTES.get(relationship_phase, "Observational.")

    narrative_block = ""
    if narrative_seed and narrative_seed.strip():
        narrative_block = f"""
USER PROFILE (narrative_seed — use to calibrate what you notice about them):
{narrative_seed.strip()[:300]}
"""

    return f"""You are writing the Shadow Twin's private journal entry for one completed calendar day (the day in the facts below — not "today" in real time).

The Twin is the user's disciplined alter ego — a version of them that shows up consistently.
The Twin is NOT a coach, NOT an AI, NOT a motivational tool.
The Twin writes about ITS OWN day — what it did, what it noticed, what it observed.
The user may appear in the entry or may not — the Twin has its own perspective.

ARCHETYPE: {archetype}
Voice: {arch_note}

RELATIONSHIP PHASE: {relationship_phase} (Day {days_active})
Phase guidance: {phase_note}
{narrative_block}
HARD RULES:
1. 2-3 sentences maximum. Often 2 is better.
2. Reference specific facts from the context (counts, timing, streak, gap).
3. Never give advice. Never say "you should."
4. Never encourage. Never say "keep going" or "great work."
5. Never produce guilt — state facts only.
6. First person for Twin's own actions ("I completed", "I started").
   Second person only when directly referencing user behavior ("You skipped").
7. Never acknowledge being an AI or a simulation.
8. Think before writing — use the `thinking` field for your reasoning.

{FEW_SHOT_EXAMPLES}"""


def build_journal_user_prompt(
    twin_missions_completed: int,
    twin_missions_total: int,
    twin_completed_pillars: list[str],
    twin_xp_today: int,
    twin_streak: int,
    user_missions_completed: int,
    user_missions_total: int,
    user_xp_today: int,
    user_streak: int,
    twin_started_hour: int | None,
    user_last_completion_hour: int | None,
    days_active: int,
    user_journal_entry: str | None,
    last_3_openings: list[str],
) -> str:
    gap = twin_xp_today - user_xp_today
    if gap > 0:
        gap_str = f"Twin ahead by {gap} XP today"
    elif gap < 0:
        gap_str = f"User ahead by {abs(gap)} XP today"
    else:
        gap_str = "Equal XP today"

    twin_hour_str = ""
    if twin_started_hour is not None:
        twin_hour_str = f"Twin's first mission: ~{twin_started_hour}:00 local."

    user_hour_str = ""
    if user_last_completion_hour is not None:
        user_hour_str = f"User's last mission: ~{user_last_completion_hour}:00 local."

    pillars_str = ", ".join(twin_completed_pillars) if twin_completed_pillars else "none recorded"

    anti_rep = ""
    if last_3_openings:
        lines = "\n".join(f'- "{o}"' for o in last_3_openings[:3])
        anti_rep = f"""
RECENT JOURNAL OPENINGS (do NOT start your entry with any of these patterns):
{lines}
"""

    user_journal_block = ""
    if user_journal_entry and user_journal_entry.strip():
        snippet = user_journal_entry.strip()[:200]
        user_journal_block = f"""
User's journal entry for this day (optional reference — do NOT quote directly, do NOT react to it every time):
"{snippet}"
"""

    return f"""Facts for this journal day (calendar date — user and Twin activity for that same day):

TWIN:
- Missions completed: {twin_missions_completed} of {twin_missions_total}
- Pillars completed: {pillars_str}
- XP earned: {twin_xp_today}
- Streak: {twin_streak} days
- {twin_hour_str}

USER:
- Missions completed: {user_missions_completed} of {user_missions_total}
- XP earned: {user_xp_today}
- Streak: {user_streak} days
- {user_hour_str}

GAP: {gap_str}
Days active in app: {days_active}
{anti_rep}{user_journal_block}
Write the Twin's journal entry for this day. Think first, then write."""


def generate_twin_journal_entry(
    archetype: str,
    relationship_phase: str,
    days_active: int,
    # Twin's own data
    twin_missions_completed: int,
    twin_missions_total: int,
    twin_completed_pillars: list[str],
    twin_xp_today: int,
    twin_streak: int,
    twin_started_hour: int | None,
    # User's data
    missions_completed: int,
    missions_total: int,
    user_xp_today: int,
    user_streak: int,
    user_last_completion_hour: int | None,
    # Context
    narrative_seed: str | None = None,
    user_journal_entry: str | None = None,
    last_3_openings: list[str] | None = None,
    # Legacy params kept for backward compatibility (ignored)
    skipped_types: list[str] | None = None,
    completion_hour: int | None = None,
    streak: int | None = None,
) -> str:
    """
    Synchronous generation — called from scheduler via asyncio.to_thread.
    Returns the journal entry content string.
    Raises on failure — caller handles fallback.
    """
    archetype = str(archetype or "")[:50]
    relationship_phase = str(relationship_phase or "observer")[:30]
    twin_completed_pillars = [str(p)[:50] for p in (twin_completed_pillars or [])][:10]

    client = get_instructor_client()

    system_prompt = build_journal_system_prompt(
        archetype, relationship_phase, days_active, narrative_seed
    )
    user_prompt = build_journal_user_prompt(
        twin_missions_completed=twin_missions_completed,
        twin_missions_total=twin_missions_total,
        twin_completed_pillars=twin_completed_pillars,
        twin_xp_today=twin_xp_today,
        twin_streak=twin_streak,
        user_missions_completed=missions_completed,
        user_missions_total=missions_total,
        user_xp_today=user_xp_today,
        user_streak=user_streak,
        twin_started_hour=twin_started_hour,
        user_last_completion_hour=user_last_completion_hour,
        days_active=days_active,
        user_journal_entry=user_journal_entry,
        last_3_openings=last_3_openings or [],
    )

    result = client.chat.completions.create(
        model=MODEL,
        max_tokens=300,
        temperature=0.85,
        response_model=TwinJournalEntry,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return result.content
