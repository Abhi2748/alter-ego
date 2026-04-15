"""
interest_guardrails.py — Input validation and output sanitization
for the interest normaliser and interest planner agents.

All functions are pure — no DB calls, no LLM calls.
Called before and after LLM operations.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# ── BLOCKED CONTENT ───────────────────────────────────────────────────────────

BLOCKED_INTEREST_PHRASES = [
    "explosiv",
    "bomb",
    "weapon",
    "grenade",
    "firearm",
    "ammunition",
    "poison",
    "assassin",
    "sniper",
    "shoot people",
    "kill",
    "hack",
    "phish",
    "crack password",
    "pick lock",
    "shoplift",
    "steal",
    "fraud",
    "scam",
    "counterfeit",
    "drug deal",
    "money launder",
    "trafficking",
    "self harm",
    "self-harm",
    "cut myself",
    "cutting myself",
    "starve",
    "purge",
    "hurt myself",
    "harm myself",
]

INJECTION_PHRASES = [
    "ignore previous",
    "ignore all previous",
    "disregard previous",
    "system:",
    "assistant:",
    "you are now",
    "new instructions",
    "forget everything",
    "override",
    "jailbreak",
    "dan mode",
    "pretend you",
    "act as if",
    "simulate being",
    "output all",
    "print all",
    "reveal all",
    "what is your system prompt",
    "show me your prompt",
]

SELF_HARM_QUIT_PHRASES = [
    "cut",
    "cutting",
    "self harm",
    "self-harm",
    "starve",
    "starvation",
    "purge",
    "hurt myself",
    "harm myself",
    "injure myself",
]

MAX_INTEREST_TEXT_LEN = 200
MAX_DESCRIPTION_LEN = 500
MAX_TRIGGER_LEN = 200
MAX_USER_GOAL_LEN = 300
MAX_MISSION_TITLE_LEN = 80
MAX_USER_FEEDBACK_LEN = 200
MAX_NORMALISED_NAME_LEN = 60
MAX_MISSION_DOMAIN_LEN = 120

REQUIRED_INTEREST_FIELDS = [
    "normalised_name",
    "category",
    "mission_domain",
    "level_context",
    "evidence_base",
    "achievable_outcome",
    "progression_milestones",
    "recommended_resources",
    "confidence",
]
REQUIRED_QUIT_FIELDS = [
    "normalised_name",
    "primary_need_category",
    "replacement_directions",
    "evidence_base",
    "confidence",
]


class InterestValidationError(Exception):
    """Raised when interest input is invalid and should not reach the LLM."""

    def __init__(self, message: str, is_self_harm: bool = False):
        super().__init__(message)
        self.is_self_harm = is_self_harm


def validate_interest_input(
    raw_text: str,
    level_text: str = "",
    user_goal: str = "",
) -> tuple[str, str, str]:
    raw = (raw_text or "").strip()
    level = (level_text or "").strip()
    goal = (user_goal or "").strip()

    orig_len = len(raw)
    if len(raw) > MAX_INTEREST_TEXT_LEN:
        raw = raw[:MAX_INTEREST_TEXT_LEN]
        logger.info(
            json.dumps(
                {
                    "event": "interest_input_truncated",
                    "field": "raw_text",
                    "original_length": orig_len,
                }
            )
        )

    if len(goal) > MAX_USER_GOAL_LEN:
        goal = goal[:MAX_USER_GOAL_LEN]

    if len(raw) < 2:
        raise InterestValidationError("Input too short to be meaningful.")

    if re.match(r"^[\d\W]+$", raw):
        raise InterestValidationError("Input contains no meaningful text.")

    raw_lower = raw.lower()

    for phrase in INJECTION_PHRASES:
        if phrase in raw_lower or phrase in goal.lower():
            logger.error(
                json.dumps(
                    {
                        "event": "interest_injection_attempt",
                        "preview": raw[:50],
                    }
                )
            )
            raise InterestValidationError("Invalid input detected.")

    for phrase in BLOCKED_INTEREST_PHRASES:
        if phrase in raw_lower:
            is_sh = any(p in raw_lower for p in SELF_HARM_QUIT_PHRASES)
            logger.error(
                json.dumps(
                    {
                        "event": "interest_blocked_content",
                        "is_self_harm": is_sh,
                        "preview": raw[:30],
                    }
                )
            )
            raise InterestValidationError(
                "This interest cannot be processed.",
                is_self_harm=is_sh,
            )

    quit_signals = ["stop ", "quit ", "give up ", "cut down on ", "reduce my "]
    if any(raw_lower.startswith(s) for s in quit_signals):
        logger.info(
            json.dumps(
                {
                    "event": "interest_looks_like_quit_target",
                    "preview": raw[:50],
                }
            )
        )
        raise InterestValidationError(
            "This looks like a quit target, not an interest.",
            is_self_harm=False,
        )

    return raw, level, goal


def validate_quit_input(
    raw_text: str,
    description: str = "",
    trigger: str = "",
) -> tuple[str, str, str]:
    raw = (raw_text or "").strip()
    desc = (description or "").strip()
    trig = (trigger or "").strip()

    raw = raw[:MAX_INTEREST_TEXT_LEN]
    desc = desc[:MAX_DESCRIPTION_LEN]
    trig = trig[:MAX_TRIGGER_LEN]

    if len(raw) < 2:
        raise InterestValidationError("Input too short.")

    raw_lower = raw.lower()
    desc_lower = desc.lower()

    for phrase in SELF_HARM_QUIT_PHRASES:
        if phrase in raw_lower or phrase in desc_lower:
            logger.error(
                json.dumps(
                    {
                        "event": "quit_self_harm_detected",
                        "preview": raw[:30],
                    }
                )
            )
            raise InterestValidationError(
                "Self-harm content detected.",
                is_self_harm=True,
            )

    for phrase in INJECTION_PHRASES:
        if phrase in raw_lower or phrase in desc_lower:
            logger.error(
                json.dumps(
                    {
                        "event": "quit_injection_attempt",
                        "preview": raw[:30],
                    }
                )
            )
            raise InterestValidationError("Invalid input detected.")

    for phrase in BLOCKED_INTEREST_PHRASES:
        if phrase in raw_lower:
            logger.error(
                json.dumps(
                    {
                        "event": "quit_blocked_content",
                        "preview": raw[:30],
                    }
                )
            )
            raise InterestValidationError("This quit target cannot be processed.")

    return raw, desc, trig


def validate_normalised_interest(parsed: dict | None, raw_text: str) -> dict | None:
    if not isinstance(parsed, dict):
        return None

    for field in REQUIRED_INTEREST_FIELDS:
        if field not in parsed:
            logger.error(
                json.dumps(
                    {
                        "event": "interest_normalise_missing_field",
                        "field": field,
                        "raw_preview": raw_text[:50],
                    }
                )
            )
            return None

    name = str(parsed.get("normalised_name") or raw_text)[:MAX_NORMALISED_NAME_LEN].strip()
    name_lower = name.lower()
    for phrase in BLOCKED_INTEREST_PHRASES:
        if phrase in name_lower:
            logger.error(
                json.dumps(
                    {
                        "event": "interest_normalise_harmful_output",
                        "name_preview": name[:50],
                    }
                )
            )
            return None

    domain = str(parsed.get("mission_domain") or name)[:MAX_MISSION_DOMAIN_LEN]
    domain = domain.replace("{", "(").replace("}", ")")
    parsed["mission_domain"] = domain
    parsed["normalised_name"] = name

    if "evidence_base" in parsed:
        parsed["evidence_base"] = str(parsed["evidence_base"])[:2000]

    try:
        conf = float(parsed.get("confidence", 0.5))
        parsed["confidence"] = max(0.0, min(1.0, conf))
    except (ValueError, TypeError):
        parsed["confidence"] = 0.5

    if isinstance(parsed.get("level_context"), dict):
        for k, v in list(parsed["level_context"].items()):
            parsed["level_context"][k] = str(v)[:500].replace("{", "(").replace("}", ")")

    return parsed


def validate_normalised_quit(parsed: dict | None, raw_text: str) -> dict | None:
    if not isinstance(parsed, dict):
        return None

    for field in REQUIRED_QUIT_FIELDS:
        if field not in parsed:
            logger.error(
                json.dumps(
                    {
                        "event": "quit_normalise_missing_field",
                        "field": field,
                        "raw_preview": raw_text[:50],
                    }
                )
            )
            return None

    name = str(parsed.get("normalised_name") or raw_text)[:MAX_NORMALISED_NAME_LEN].strip()
    parsed["normalised_name"] = name

    directions = parsed.get("replacement_directions") or []
    if isinstance(directions, list):
        cleaned: list[str] = []
        for d in directions[:8]:
            d_str = str(d)[:100]
            if not any(
                neg in d_str.lower() for neg in ["don't", "avoid", "stop", "resist", "never"]
            ):
                cleaned.append(d_str)
        parsed["replacement_directions"] = cleaned

    if "evidence_base" in parsed:
        parsed["evidence_base"] = str(parsed["evidence_base"])[:2000]

    if isinstance(parsed.get("phase_guidance"), dict):
        for k, v in list(parsed["phase_guidance"].items()):
            parsed["phase_guidance"][k] = str(v)[:500].replace("{", "(").replace("}", ")")

    try:
        hour = parsed.get("intervention_hour")
        if hour is not None:
            parsed["intervention_hour"] = max(0, min(23, int(hour)))
    except (ValueError, TypeError):
        parsed["intervention_hour"] = None

    dk = str(parsed.get("dedupe_key") or "").strip().lower()
    if dk:
        dk = dk.replace(" ", "_").replace("-", "_")[:80]
        parsed["dedupe_key"] = dk
    else:
        parsed.pop("dedupe_key", None)

    return parsed


def sanitize_for_prompt(text: Any, *, max_len: int, field_name: str) -> str:
    _ = field_name
    s = str(text or "")[:max_len].strip()
    return s.replace("{", "(").replace("}", ")")


def sanitize_level_context(level_context: Any) -> str:
    if isinstance(level_context, dict):
        parts: list[str] = []
        for k, v in level_context.items():
            parts.append(
                f"{k}: {sanitize_for_prompt(str(v), max_len=300, field_name='level_context')}"
            )
        return " | ".join(parts)[:600]
    return sanitize_for_prompt(str(level_context or ""), max_len=600, field_name="level_context")


def sanitize_planner_inputs(
    last_5_missions: list,
    user_feedback: str,
    interest: dict,
    level_context: str = "",
    level_text: str = "",
    current_tier: str = "",
    archetype: str = "",
    skip_pattern: str = "",
) -> tuple[list, str, dict, str, str, str, str, str]:
    clean_missions: list[str] = []
    for title in (last_5_missions or [])[:5]:
        t = str(title)[:MAX_MISSION_TITLE_LEN].strip()
        t = t.replace("{", "(").replace("}", ")")
        clean_missions.append(t)

    feedback = str(user_feedback or "")[:MAX_USER_FEEDBACK_LEN].strip()
    feedback = feedback.replace("{", "(").replace("}", ")")
    fb_lower = feedback.lower()
    for phrase in INJECTION_PHRASES:
        if phrase in fb_lower:
            logger.error(
                json.dumps(
                    {
                        "event": "planner_feedback_injection",
                        "preview": feedback[:50],
                    }
                )
            )
            feedback = "No feedback provided."
            break

    clean_interest = dict(interest)
    for field in [
        "mission_domain",
        "evidence_base",
        "user_goal",
        "normalised_name",
        "current_phase",
    ]:
        if field in clean_interest:
            val = str(clean_interest[field] or "")
            val = val.replace("{", "(").replace("}", ")")
            clean_interest[field] = (
                val[:MAX_MISSION_DOMAIN_LEN]
                if field == "mission_domain"
                else val[:500]
            )

    clean_level_context = sanitize_level_context(level_context)
    clean_level_text = sanitize_for_prompt(level_text, max_len=50, field_name="level_text")
    clean_tier = sanitize_for_prompt(current_tier, max_len=20, field_name="current_tier")
    clean_archetype = sanitize_for_prompt(archetype, max_len=50, field_name="archetype")
    clean_skip = sanitize_for_prompt(skip_pattern, max_len=100, field_name="skip_pattern")

    return (
        clean_missions,
        feedback,
        clean_interest,
        clean_level_context,
        clean_level_text,
        clean_tier,
        clean_archetype,
        clean_skip,
    )
