"""
ALTER EGO — LLM Profiler Agent
Replaces deterministic scoring table with psychological profiling.
Runs ONCE per user at onboarding completion.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.agents.profiler_prompt_v2 import PROFILER_SYSTEM_PROMPT

logger = logging.getLogger("alter_ego.profiler")


class UserProfile(BaseModel):
    """Structured output from the profiler agent."""

    archetype: str
    archetype_confidence: float = Field(ge=0, le=1)
    secondary_archetype: Optional[str] = None
    execution_gap: float = Field(ge=0, le=1, default=0.5)
    failure_resilience: float = Field(ge=0, le=1, default=0.5)
    external_validation_need: float = Field(ge=0, le=1, default=0.5)
    self_belief: float = Field(ge=0, le=1, default=0.5)
    structure_dependence: float = Field(ge=0, le=1, default=0.5)
    guilt_orientation: float = Field(ge=0, le=1, default=0.5)
    competitive_drive: float = Field(ge=0, le=1, default=0.5)
    intrinsic_motivation: float = Field(ge=0, le=1, default=0.5)
    self_talk_pattern: str = "pragmatic"
    discipline_framing: str = "behavior"
    emotional_starting_state: str = "fresh_start"
    core_failure_pattern: Optional[str] = None
    success_pattern: Optional[str] = None
    recommended_twin_tone: str = "philosopher"
    recommended_intensity: int = Field(ge=1, le=5, default=3)
    recommended_gap_behavior: str = "rubber_band"
    twin_relationship_style: str = "mentor_rival"
    narrative_seed: str = ""


def _answer_value(answers: dict[str, Any], question_key: str, default: Any = None) -> Any:
    row = answers.get(question_key)
    if isinstance(row, dict) and "value" in row:
        return row.get("value", default)
    if row is None:
        return default
    return row


def _build_profiler_input(answers: dict[str, Any]) -> str:
    """
    Build the profiler prompt with all user answers injected.
    `answers` is keyed by question_key; each value is answer_json dict.
    """
    age = _answer_value(answers, "q3_age", 24)
    try:
        age = int(age)
    except (TypeError, ValueError):
        age = 24

    gender = _answer_value(answers, "q2_gender", "other")
    if not isinstance(gender, str):
        gender = "other"

    q4 = str(_answer_value(answers, "q4_situation", "") or "")
    q5 = str(_answer_value(answers, "q5_reason", "") or "")
    q6 = str(_answer_value(answers, "q6_alarm", "") or "")
    q7 = str(_answer_value(answers, "q7_missed_day", "") or "")
    q8 = str(_answer_value(answers, "q8_doubt", "") or "")
    q9 = str(_answer_value(answers, "q9_success", "") or "")
    q10 = str(_answer_value(answers, "q10_failure", "") or "")
    q11 = str(_answer_value(answers, "q11_discipline", "") or "")

    interests_data: list = []
    for key in ("q12_interests", "q11_interests"):
        block = answers.get(key)
        if isinstance(block, dict):
            interests_data = block.get("interests") or []
            break
    interests_str = (
        ", ".join(str(i.get("raw_text", "") or "") for i in interests_data if isinstance(i, dict))
        if interests_data
        else "None specified"
    )

    quit_data: list = []
    for key in ("q13_quits", "q12_quits"):
        block = answers.get(key)
        if isinstance(block, dict):
            quit_data = block.get("quit_targets") or []
            break
    quits_str = (
        ", ".join(
            str(q.get("raw_text") or q.get("name") or "")
            for q in quit_data
            if isinstance(q, dict)
        )
        if quit_data
        else "None specified"
    )

    hours = _answer_value(answers, "q14_hours", _answer_value(answers, "q13_hours", 1.0))
    try:
        hours = float(hours)
    except (TypeError, ValueError):
        hours = 1.0

    horizon = _answer_value(
        answers, "q15_commitment", _answer_value(answers, "q14_commitment", "however_long")
    )
    if not isinstance(horizon, str):
        horizon = "however_long"

    tmpl = PROFILER_SYSTEM_PROMPT
    replacements: dict[str, str] = {
        "{age}": str(age),
        "{gender}": gender,
        "{q4_answer}": q4,
        "{q5_answer}": q5,
        "{q6_answer}": q6,
        "{q7_answer}": q7,
        "{q8_answer}": q8,
        "{q9_answer}": q9,
        "{q10_answer}": q10,
        "{q11_answer}": q11,
        "{interests}": interests_str,
        "{quit_targets}": quits_str,
        "{daily_hours}": str(hours),
        "{commitment_horizon}": horizon,
    }
    out = tmpl
    for k, v in replacements.items():
        out = out.replace(k, v)
    return out


def _parse_profiler_response(raw_text: str) -> UserProfile:
    profile_match = re.search(r"<profile>(.*?)</profile>", raw_text, re.DOTALL)
    if not profile_match:
        raise ValueError("Profiler response missing <profile> tags")

    profile_json = profile_match.group(1).strip()
    return UserProfile.model_validate_json(profile_json)


async def profile_user(answers: dict[str, Any]) -> Optional[UserProfile]:
    """
    Main entry point. Calls LLM profiler with all onboarding answers.
    Returns UserProfile or None on failure.

    Tries Anthropic (Claude Sonnet) first, falls back to OpenAI (GPT-4o).
    """
    prompt = _build_profiler_input(answers)

    try:
        import anthropic

        client = anthropic.AsyncAnthropic()
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text
        profile = _parse_profiler_response(raw)
        logger.info("Profiler succeeded via Anthropic")
        return profile
    except Exception as e:
        logger.warning("Anthropic profiler failed: %s", e)

    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI()
        response = await client.chat.completions.create(
            model="gpt-4o",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.choices[0].message.content or ""
        profile = _parse_profiler_response(raw)
        logger.info("Profiler succeeded via OpenAI fallback")
        return profile
    except Exception as e:
        logger.warning("OpenAI profiler fallback also failed: %s", e)

    return None
