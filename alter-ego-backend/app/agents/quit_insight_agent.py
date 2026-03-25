"""
Earned insights when a user completes a quit path phase transition.
"""

from __future__ import annotations

import json
import logging

from pydantic import BaseModel, Field, field_validator

from app.agents.agent_guardrails import sanitize_for_prompt, sanitize_list_for_prompt
from app.agents.base import run_agent

logger = logging.getLogger(__name__)


class QuitInsight(BaseModel):
    title: str = Field(..., description="Insight title, max 60 chars, revelation tone.")
    body: str = Field(..., description="40-100 words, specific to habit and phase.")
    confidence: float = Field(..., ge=0.0, le=1.0)

    @field_validator("body")
    @classmethod
    def body_must_be_substantial(cls, v: str) -> str:
        if len(v.split()) < 30:
            raise ValueError("Insight body too short — must be 30+ words")
        return v


SYSTEM_PROMPT = """You write earned insights for people who completed a phase of breaking a habit.
Reference the specific habit and underlying need. Explain a psychological or neurological truth that fits AFTER this phase. No generic motivation."""


async def generate_quit_insight(
    habit_name: str,
    completed_phase: str,
    underlying_need: str,
    awareness_level: str,
    trigger_contexts: list[str],
    days_in_phase: int,
    frequency_baseline: float | None,
    frequency_at_transition: float | None,
) -> QuitInsight:
    # Sanitize user-sourced inputs
    habit_name = sanitize_for_prompt(habit_name, max_len=100, field_name="habit_name")
    underlying_need = sanitize_for_prompt(underlying_need, max_len=80, field_name="underlying_need")
    awareness_level = sanitize_for_prompt(awareness_level, max_len=50, field_name="awareness_level")
    trigger_contexts = sanitize_list_for_prompt(
        trigger_contexts, max_items=5, max_item_len=100, field_name="trigger_context"
    )
    completed_phase = sanitize_for_prompt(completed_phase, max_len=50, field_name="completed_phase")

    if frequency_baseline is not None and frequency_baseline <= 0:
        logger.info(
            json.dumps(
                {
                    "event": "quit_insight_invalid_frequency",
                    "reason": "frequency_baseline_zero_or_negative",
                    "value": frequency_baseline,
                }
            )
        )
        frequency_baseline = None

    reduction_str = ""
    if frequency_baseline and frequency_at_transition is not None and frequency_baseline > 0:
        pct = round((1 - frequency_at_transition / frequency_baseline) * 100)
        reduction_str = f"Frequency snapshot: baseline ~{frequency_baseline:.0f}, recent avg ~{frequency_at_transition:.0f}/day (~{pct}% vs baseline)."

    user_message = f"""Generate an earned insight for completing this phase.

HABIT: {habit_name}
COMPLETED PHASE: {completed_phase}
UNDERLYING NEED: {underlying_need}
AWARENESS LEVEL: {awareness_level}
TRIGGER CONTEXTS: {', '.join(trigger_contexts) if trigger_contexts else 'not specified'}
DAYS IN PHASE: {days_in_phase}
{reduction_str}
"""

    return await run_agent(
        system_prompt=SYSTEM_PROMPT,
        user_message=user_message,
        response_model=QuitInsight,
        temperature=0.9,
        max_tokens=500,
        context_label=f"QuitInsight:{habit_name}:{completed_phase}",
    )
