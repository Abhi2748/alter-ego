"""
Consistency Checker — validates Twin response before sending.
Uses GPT-4o-mini via existing run_agent.
"""

from __future__ import annotations

import logging
from typing import Optional

from pydantic import BaseModel, Field

from app.agents import twin_chat_prompts_v2 as twin_prompts
from app.agents.base import run_agent

logger = logging.getLogger(__name__)


class ConsistencyIssue(BaseModel):
    type: str = ""
    description: str = ""
    severity: str = "minor"


class ConsistencyResult(BaseModel):
    is_valid: bool = True
    issues: list[ConsistencyIssue] = Field(default_factory=list)
    should_regenerate: bool = False


async def check_consistency(
    twin_response: str,
    user_message: str,
    twin_tone_type: str,
    twin_relationship_style: str,
    guilt_orientation: float,
    user_mood: str,
    user_intent: str,
    requires_sensitivity: bool,
) -> ConsistencyResult:
    """
    Verify Twin's response for character breaks, guilt violations, etc.
    On failure of the checker itself, returns valid=True (don't block the response).
    """
    prompt = str(twin_prompts.CONSISTENCY_CHECKER_PROMPT)
    prompt = (
        prompt.replace("{twin_tone_type}", twin_tone_type)
        .replace("{twin_relationship_style}", twin_relationship_style)
        .replace("{guilt_orientation}", str(guilt_orientation))
        .replace("{user_message}", user_message)
        .replace("{user_mood}", user_mood)
        .replace("{user_intent}", user_intent)
        .replace("{requires_sensitivity}", str(requires_sensitivity).lower())
        .replace("{twin_response}", twin_response)
    )

    try:
        result = await run_agent(
            system_prompt=prompt,
            user_message=f"Check this Twin response: {twin_response}",
            response_model=ConsistencyResult,
            temperature=0.1,
            max_tokens=300,
            context_label="twin_consistency_checker",
        )
        return result
    except Exception as e:
        logger.warning("Consistency check failed: %s", e)
        return ConsistencyResult(is_valid=True)
