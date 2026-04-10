"""
Twin Response Generator — premium model call for Twin chat.
Uses Claude Sonnet 4 via Anthropic SDK. Falls back to run_agent.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Optional

from app.agents import twin_chat_prompts_v2 as twin_prompts

logger = logging.getLogger(__name__)


def format_gap_percentage_label(gap_state: str, twin_xp: int, user_xp: int) -> str:
    tx, ux = int(twin_xp), int(user_xp)
    diff = abs(tx - ux)
    if gap_state == "user_ahead":
        return f"user ahead by ~{diff} XP"
    if ux <= 0:
        return f"~{diff} XP separation"
    pct = min(999, int((diff / max(ux, 1)) * 100))
    return f"~{pct}% XP gap ({diff} XP)"


def build_conversation_history_text(chat_history: list[dict], max_turns: int = 10) -> str:
    lines: list[str] = []
    for msg in chat_history[-max_turns:]:
        sender = msg.get("sender") or msg.get("role")
        text = msg.get("message") if "message" in msg else msg.get("content")
        if not text:
            continue
        who = "User" if sender == "user" else "Twin"
        lines.append(f"{who}: {text}")
    return "\n".join(lines) if lines else "(no prior messages)"


def _build_response_prompt(
    *,
    username: str,
    narrative_seed: str,
    archetype: str,
    archetype_confidence: float,
    twin_tone_type: str,
    twin_relationship_style: str,
    twin_intensity: int,
    twin_gap_behavior: str,
    gap_state: str,
    gap_percentage: str,
    twin_xp: int,
    user_xp: int,
    twin_streak: int,
    user_streak: int,
    user_stage: str,
    twin_stage: str,
    day_number: int,
    today_context: str,
    user_mood: str,
    user_intent: str,
    energy_level: str,
    topic: str,
    conversation_depth: str,
    tone_rating_history: str,
    memory_anchors: str,
    last_three_openings: str,
    conversation_history: str,
    user_message: str,
    relationship_phase_section: str,
    guilt_orientation: float,
    requires_sensitivity: bool,
) -> str:
    base = str(twin_prompts.TWIN_RESPONSE_PROMPT)
    filled = (
        base.replace("{username}", username)
        .replace("{narrative_seed}", narrative_seed)
        .replace("{archetype}", archetype)
        .replace("{archetype_confidence}", str(archetype_confidence))
        .replace("{twin_tone_type}", twin_tone_type)
        .replace("{twin_relationship_style}", twin_relationship_style)
        .replace("{twin_intensity}", str(twin_intensity))
        .replace("{twin_gap_behavior}", twin_gap_behavior)
        .replace("{gap_state}", gap_state)
        .replace("{gap_percentage}", gap_percentage)
        .replace("{twin_xp}", str(twin_xp))
        .replace("{user_xp}", str(user_xp))
        .replace("{twin_streak}", str(twin_streak))
        .replace("{user_streak}", str(user_streak))
        .replace("{user_stage}", user_stage)
        .replace("{twin_stage}", twin_stage)
        .replace("{day_number}", str(day_number))
        .replace("{today_context}", today_context)
        .replace("{user_mood}", user_mood)
        .replace("{user_intent}", user_intent)
        .replace("{energy_level}", energy_level)
        .replace("{topic}", topic)
        .replace("{conversation_depth}", conversation_depth)
        .replace("{tone_rating_history}", tone_rating_history)
        .replace("{memory_anchors}", memory_anchors)
        .replace("{last_three_openings}", last_three_openings)
        .replace("{conversation_history}", conversation_history)
        .replace("{user_message}", user_message)
    )
    extra = f"""

## GUILT ORIENTATION (internal)
Score: {guilt_orientation:.2f}. If > 0.7, never use guilt, shame, or "you let yourself down" language.

## SENSITIVITY
requires_sensitivity={str(requires_sensitivity).lower()}. If true, crisis/support rules override rivalry.

## RELATIONSHIP PHASE (Twin arc)
{relationship_phase_section}
"""
    return filled + extra


def _parse_response(raw_text: str) -> str:
    """Extract content from <response> tags."""
    match = re.search(r"<response>(.*?)</response>", raw_text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return raw_text.strip()


async def generate_twin_response_v2(
    system_prompt: str,
    conversation_messages: list[dict],
) -> tuple[str, Optional[str]]:
    """
    Generate Twin's response using Claude Sonnet 4.
    Returns (response_text, conversation_note_or_none).
    Falls back to GPT-4o-mini sync path if Anthropic fails.
    """
    try:
        import anthropic

        client = anthropic.AsyncAnthropic()
        messages = [{"role": m["role"], "content": m["content"]} for m in conversation_messages]

        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=500,
            system=system_prompt,
            messages=messages,
        )
        raw = response.content[0].text
        response_text = _parse_response(raw)
        logger.info("Twin response generated via Anthropic")
        return response_text, None

    except Exception as e:
        logger.warning("Anthropic twin response failed: %s", e)

    try:
        from app.agents.twin_chat_agent import TwinResponse, _generate_twin_response_sync
        import asyncio

        result: TwinResponse = await asyncio.to_thread(
            _generate_twin_response_sync,
            system_prompt,
            conversation_messages,
        )
        return result.response, result.conversation_note

    except Exception as e:
        logger.error("Both twin response attempts failed: %s", e)
        return "I'm here. Say that again.", None


async def generate_twin_response_stream(
    system_prompt: str,
    conversation_messages: list[dict],
):
    """
    Stream the Twin's response token by token using Claude Sonnet 4.
    Yields SSE-formatted strings. The final event contains metadata.

    Yield format:
      data: {"type": "chunk", "text": "..."}\\n\\n
      data: {"type": "done"}\\n\\n
      data: {"type": "error", "message": "..."}\\n\\n  ← on failure
    """
    try:
        import anthropic

        client = anthropic.AsyncAnthropic()
        messages = [{"role": m["role"], "content": m["content"]} for m in conversation_messages]

        full_text = ""
        async with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=500,
            system=system_prompt,
            messages=messages,
        ) as stream:
            async for text_chunk in stream.text_stream:
                full_text += text_chunk
                yield f"data: {json.dumps({'type': 'chunk', 'text': text_chunk})}\n\n"

        parsed = _parse_response(full_text)
        if parsed != full_text:
            yield f"data: {json.dumps({'type': 'replace', 'text': parsed})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        logger.info("Twin response streamed via Anthropic")

    except Exception as e:
        logger.warning("Anthropic streaming failed, falling back: %s", e)
        try:
            response_text, _ = await generate_twin_response_v2(
                system_prompt, conversation_messages
            )
            yield f"data: {json.dumps({'type': 'chunk', 'text': response_text})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e2:
            logger.error("Streaming fallback also failed: %s", e2)
            fallback_text = "I'm here. Say that again."
            yield f"data: {json.dumps({'type': 'chunk', 'text': fallback_text})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
