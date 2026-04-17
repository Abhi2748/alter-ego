"""
Consistency Checker — validates Twin response before sending.
Uses Claude Haiku 4.5 (fast, low max_tokens).
"""

from __future__ import annotations

import logging
import re

from pydantic import BaseModel, Field

from app.agents import twin_chat_prompts_v2 as twin_prompts

logger = logging.getLogger(__name__)


def _strip_json_fences(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\n?", "", t)
        t = re.sub(r"\n?```\s*$", "", t)
    return t.strip()


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
        import anthropic

        client = anthropic.AsyncAnthropic()
        user_content = (
            "Return ONLY valid JSON (no markdown fences) with this exact shape:\n"
            '{"is_valid": true|false, "should_regenerate": true|false, '
            '"issues": [{"type": "", "description": "", "severity": "minor"}]}\n'
            "Be lenient: set should_regenerate to false unless the Twin response "
            "clearly breaks character, safety, or the stated tone rules."
        )
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=150,
            system=prompt,
            messages=[{"role": "user", "content": user_content}],
        )
        raw = response.content[0].text
        cleaned = _strip_json_fences(raw)
        return ConsistencyResult.model_validate_json(cleaned)
    except Exception as e:
        logger.warning("Consistency check failed: %s", e)
        return ConsistencyResult(is_valid=True)
