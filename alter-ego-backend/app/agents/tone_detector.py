"""
Tone Detector — classifies user mood/intent before Twin responds.
Uses GPT-4o-mini via existing run_agent (Instructor pattern).
"""

from __future__ import annotations

import logging
from typing import Literal

from pydantic import BaseModel, Field

from app.agents import twin_chat_prompts_v2 as twin_prompts
from app.agents.base import run_agent

logger = logging.getLogger(__name__)


class ToneDetection(BaseModel):
    user_mood: Literal[
        "neutral",
        "happy",
        "frustrated",
        "defeated",
        "anxious",
        "angry",
        "excited",
        "vulnerable",
        "bored",
        "reflective",
    ] = Field(default="neutral")
    intent: Literal[
        "seeking_competition",
        "seeking_support",
        "venting",
        "celebrating",
        "casual_conversation",
        "asking_about_twin",
        "asking_for_advice",
        "testing_boundaries",
        "off_topic",
        "greeting",
    ] = Field(default="casual_conversation")
    energy_level: Literal["high", "medium", "low"] = Field(default="medium")
    topic: Literal[
        "missions",
        "streak",
        "progress",
        "personal_life",
        "interests",
        "quit_targets",
        "twin_relationship",
        "general",
        "off_topic",
    ] = Field(default="general")
    requires_sensitivity: bool = Field(default=False)
    is_confrontational: bool = Field(default=False)
    conversation_depth: Literal["surface", "medium", "deep"] = Field(default="surface")


async def detect_tone(
    user_message: str,
    recent_messages: list[dict],
) -> ToneDetection:
    """
    Classify user's message for mood, intent, and sensitivity.
    Falls back to neutral defaults on any failure.
    """
    recent_str = ""
    for msg in recent_messages[-3:]:
        role = msg.get("role", msg.get("sender", ""))
        content = msg.get("content", msg.get("message", ""))
        recent_str += f"{role}: {content}\n"

    prompt = str(twin_prompts.TONE_DETECTOR_PROMPT).replace("{user_message}", user_message).replace(
        "{recent_messages}", recent_str or "(no recent messages)"
    )

    try:
        result = await run_agent(
            system_prompt=prompt,
            user_message=f"Classify: {user_message}",
            response_model=ToneDetection,
            temperature=0.1,
            max_tokens=200,
            context_label="tone_detector",
        )
        return result
    except Exception as e:
        logger.warning("Tone detection failed, using defaults: %s", e)
        return ToneDetection()
