"""
ALTER EGO — Profile Verifier Agent
Cheap self-check on profiler output. Uses Claude Haiku or GPT-4o-mini.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger("alter_ego.profile_verifier")


class VerificationResult(BaseModel):
    is_valid: bool = True
    issues: list[Any] = Field(default_factory=list)
    narrative_accurate: bool = True
    narrative_feedback: Optional[str] = None


VERIFIER_PROMPT = """
# ALTER EGO — Profile Verifier

You are reviewing a psychological profile generated from onboarding answers.
Check for internal consistency.

## RAW ANSWERS
{answers_json}

## GENERATED PROFILE
{profile_json}

## CHECK FOR:
1. Score contradictions (e.g. user said they "get up no question" but execution_gap > 0.6)
2. Tone mismatches (e.g. high guilt_orientation but rival tone recommended)
3. Hard rule violations:
   - guilt_orientation > 0.7 MUST NOT have recommended_twin_tone = "rival"
   - self_belief < 0.3 MUST have recommended_intensity <= 2
   - competitive_drive < 0.2 MUST NOT have recommended_twin_tone = "rival"
4. Narrative seed accuracy (does it reference real answers or hallucinate?)

## OUTPUT FORMAT
Return ONLY valid JSON. No markdown, no backticks.
{{
  "is_valid": true/false,
  "issues": [
    {{
      "field": "field_name",
      "issue": "description of the problem",
      "suggested_value": "corrected value or null"
    }}
  ],
  "narrative_accurate": true/false,
  "narrative_feedback": "string or null"
}}
"""


def _strip_json_fences(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\n?", "", t)
        t = re.sub(r"\n?```\s*$", "", t)
    return t.strip()


async def verify_profile(answers: dict, profile_dict: dict) -> VerificationResult:
    """
    Verify profiler output for consistency. Returns VerificationResult.
    If verification call itself fails, returns valid=True (don't block onboarding).
    """
    prompt = VERIFIER_PROMPT.format(
        answers_json=json.dumps(answers, indent=2, default=str),
        profile_json=json.dumps(profile_dict, indent=2, default=str),
    )

    for attempt_fn in (_try_anthropic, _try_openai):
        try:
            raw = await attempt_fn(prompt)
            if raw:
                cleaned = _strip_json_fences(raw)
                return VerificationResult.model_validate_json(cleaned)
        except Exception as e:
            logger.warning("Verifier attempt failed: %s", e)

    logger.warning("All verifier attempts failed, assuming valid")
    return VerificationResult(is_valid=True)


async def _try_anthropic(prompt: str) -> Optional[str]:
    import anthropic

    client = anthropic.AsyncAnthropic()
    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text


async def _try_openai(prompt: str) -> Optional[str]:
    from openai import AsyncOpenAI

    client = AsyncOpenAI()
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content
