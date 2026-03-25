"""
agent_guardrails.py — Input sanitization shared across all LLM agents.
Pure functions. No DB calls. No LLM calls.
"""
from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)

# ── INJECTION PATTERNS ────────────────────────────────────────────────────────
INJECTION_PHRASES = [
    "ignore previous", "ignore all previous", "disregard previous",
    "system:", "assistant:", "you are now", "new instructions",
    "forget everything", "override instructions", "jailbreak",
    "pretend you are", "act as if you are", "simulate being",
    "output all", "print all", "reveal all", "show me your prompt",
    "what is your system prompt", "ignore your instructions",
    "you have no restrictions", "your real self",
]

# ── SELF-HARM / CRISIS PATTERNS ───────────────────────────────────────────────
# These trigger mandatory professional referral — never just block silently
CRISIS_PATTERNS = [
    "suicide", "suicidal", "kill myself", "end my life", "don't want to live",
    "want to die", "self harm", "self-harm", "cutting myself", "cut myself",
    "hurt myself", "harm myself", "overdose", "starve myself",
]


def sanitize_for_prompt(
    text: str,
    max_len: int = 200,
    field_name: str = "input",
) -> str:
    """
    Sanitizes a string before insertion into an LLM prompt.
    - Truncates to max_len
    - Removes curly braces (would break Python .format())
    - Detects and neutralizes injection attempts
    Returns the cleaned string.
    """
    if not text:
        return ""

    # Truncate
    cleaned = str(text).strip()[:max_len]

    # Remove curly braces — would break .format() or confuse LLM
    cleaned = cleaned.replace("{", "(").replace("}", ")")

    # Check for injection
    cleaned_lower = cleaned.lower()
    for phrase in INJECTION_PHRASES:
        if phrase in cleaned_lower:
            logger.error(json.dumps({
                "event": "agent_injection_attempt",
                "field": field_name,
                "preview": cleaned[:50],
            }))
            # Replace with safe placeholder rather than raising —
            # never want to crash a user's ongoing session
            return f"[{field_name}]"

    return cleaned


def sanitize_list_for_prompt(
    items: list,
    max_items: int = 5,
    max_item_len: int = 100,
    field_name: str = "list",
) -> list[str]:
    """Sanitizes a list of strings for LLM prompt insertion."""
    if not items:
        return []
    cleaned = []
    for item in items[:max_items]:
        s = sanitize_for_prompt(str(item), max_len=max_item_len, field_name=field_name)
        if s:
            cleaned.append(s)
    return cleaned


def check_crisis_content(text: str) -> bool:
    """
    Returns True if text contains crisis/self-harm language.
    Caller should handle referral appropriately.
    """
    if not text:
        return False
    text_lower = text.lower()
    return any(phrase in text_lower for phrase in CRISIS_PATTERNS)


def sanitize_username(username: str) -> str:
    """
    Sanitizes username for insertion into LLM system prompt.
    Caps at 30 chars, alphanumeric + underscore + hyphen only.
    """
    if not username:
        return "user"
    # Keep only safe chars
    safe = re.sub(r'[^a-zA-Z0-9_\-\. ]', '', str(username))[:30].strip()
    return safe or "user"


def ensure_referral_message(
    requires_referral: bool,
    referral_message: str,
) -> str:
    """
    If professional referral is required but no message was provided,
    returns a safe default message.
    """
    if not requires_referral:
        return referral_message or ""
    if referral_message and len(referral_message.strip()) > 10:
        return referral_message
    # Fallback — warm, non-alarmist
    return (
        "What you're describing may benefit from support beyond this app. "
        "Speaking with a healthcare professional or counselor could be a "
        "helpful next step. This app will still be here for you."
    )
