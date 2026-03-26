"""
Daily quit-path missions (HRT phase-aware).
"""

from __future__ import annotations

import logging
from typing import List, Literal

from pydantic import BaseModel, Field, field_validator

from app.agents.agent_guardrails import sanitize_for_prompt, sanitize_list_for_prompt
from app.agents.base import run_agent

logger = logging.getLogger(__name__)


class QuitMission(BaseModel):
    title: str = Field(
        ...,
        description=(
            "Mission title max 60 chars. Positive action verb. "
            "Phase 1: Log/Notice/Track/Record/Observe. "
            "Phase 2: Practice/Use/Place/Set/Build. "
            "Phase 3: Apply/Maintain/Test/Commit."
        ),
    )
    description: str = Field(
        ...,
        description="2-3 sentences. Positive framing only; no don't/avoid/stop/resist.",
    )
    difficulty: Literal["easy", "medium", "hard"] = Field(...)
    estimated_minutes: int = Field(..., ge=2, le=30)
    mission_category: Literal["observation", "competing_response", "consolidation"] = Field(...)
    rationale: str = Field(..., max_length=150)

    @field_validator("title")
    @classmethod
    def title_must_be_positive(cls, v: str) -> str:
        forbidden = ["don't", "avoid", "stop", "resist", "try to", "attempt"]
        v_lower = v.lower()
        for word in forbidden:
            if word in v_lower:
                raise ValueError(f"Mission title cannot contain '{word}'")
        return v

    @field_validator("description")
    @classmethod
    def description_must_be_positive(cls, v: str) -> str:
        forbidden = ["don't", "avoid", "stop", "resist", "try to", "attempt", "never do"]
        v_lower = v.lower()
        for word in forbidden:
            if word in v_lower:
                raise ValueError(f"Mission description cannot contain '{word}'")
        return v


class QuitMissionBatch(BaseModel):
    reasoning: str = Field(..., description="50-100 words on why these missions today.")
    # One mission per path per day — beginners are overwhelmed by multiple resistance tasks.
    missions: List[QuitMission] = Field(..., min_length=1, max_length=1)
    confidence: float = Field(..., ge=0.0, le=1.0)


SYSTEM_PROMPT = """You are a Habit Reversal Training (HRT) specialist generating daily missions.

Phase 1 — Mapping: observation only. No behaviour change. No resisting the habit.
Phase 2 — Disruption: use the competing response from the user profile consistently.
Phase 3 — Consolidation: hardest contexts, edge cases.

Mission safety: no cold-turkey for dependency habits, no fasting/extreme diet, no pain-based techniques (no rubber bands to hurt, ice punishment), no substituting one substance for another, no diagnostic language, no shame on relapse.

Difficulty: easy 5-10m, medium 10-20m, hard 20-30m.

For physical_addiction: acknowledge craving/withdrawal as data in descriptions; still positive actions only.
"""


async def generate_quit_missions(
    habit_name: str,
    underlying_need: str,
    current_phase: str,
    trigger_contexts: list[str],
    awareness_level: str,
    competing_response: str,
    phase_1_focus: str,
    recent_missions: list[dict],
    frequency_today: int,
    frequency_baseline: float | None,
    days_in_phase: int,
    archetype: str,
) -> QuitMissionBatch:
    # Sanitize all user-sourced inputs before LLM call
    habit_name = sanitize_for_prompt(habit_name, max_len=100, field_name="habit_name")
    underlying_need = sanitize_for_prompt(underlying_need, max_len=80, field_name="underlying_need")
    trigger_contexts = sanitize_list_for_prompt(
        trigger_contexts, max_items=5, max_item_len=100, field_name="trigger_context"
    )
    awareness_level = sanitize_for_prompt(awareness_level, max_len=50, field_name="awareness_level")
    current_phase = sanitize_for_prompt(current_phase, max_len=50, field_name="current_phase")
    competing_response = sanitize_for_prompt(
        competing_response, max_len=200, field_name="competing_response"
    )
    phase_1_focus = sanitize_for_prompt(phase_1_focus, max_len=200, field_name="phase_1_focus")
    archetype = sanitize_for_prompt(archetype, max_len=50, field_name="archetype")

    if recent_missions:
        for m in recent_missions[:5]:
            if "title" in m:
                m["title"] = sanitize_for_prompt(
                    str(m["title"]), max_len=60, field_name="mission_title"
                )

    contexts_str = ", ".join(trigger_contexts) if trigger_contexts else "general/any time"

    history_str = "No recent missions yet"
    if recent_missions:
        lines = [
            f"  - '{m.get('title')}' → rated: {m.get('difficulty_rating') or 'not rated'}"
            for m in recent_missions[-5:]
        ]
        history_str = "Recent missions:\n" + "\n".join(lines)

    freq_str = f"{frequency_today} (unit) today"
    if frequency_baseline and frequency_baseline > 0:
        reduction = max(0, round((1 - frequency_today / max(frequency_baseline, 0.001)) * 100))
        freq_str += f" (baseline ~{frequency_baseline:.0f}/day, ~{reduction}% vs baseline snapshot)"

    user_message = f"""Generate today's quit missions for this user.

HABIT: {habit_name}
UNDERLYING NEED: {underlying_need}
CURRENT PHASE: {current_phase}
TRIGGER CONTEXTS: {contexts_str}
AWARENESS LEVEL: {awareness_level}
DAYS IN CURRENT PHASE: {days_in_phase}
ARCHETYPE: {archetype}

COMPETING RESPONSE (Phase 2+): {competing_response}
PHASE 1 FOCUS: {phase_1_focus}

FREQUENCY: {freq_str}

{history_str}

Generate exactly ONE phase-appropriate mission for today (one mission per day per habit path)."""

    return await run_agent(
        system_prompt=SYSTEM_PROMPT,
        user_message=user_message,
        response_model=QuitMissionBatch,
        temperature=0.8,
        max_tokens=1200,
        context_label=f"QuitMissions:{habit_name}:{current_phase}",
    )
