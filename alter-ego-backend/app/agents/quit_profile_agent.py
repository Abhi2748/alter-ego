"""
Quit profile analysis at path creation (onboarding Q12 + add-quit flow).
"""

from __future__ import annotations

import logging
from typing import Literal

from pydantic import BaseModel, Field

from app.agents.base import run_agent

logger = logging.getLogger(__name__)


class QuitProfile(BaseModel):
    reasoning: str = Field(
        ...,
        description=(
            "Your clinical analysis (100-200 words): "
            "(1) What underlying need does this habit primarily serve? "
            "(2) What are the specific triggers based on the contexts provided? "
            "(3) What does the awareness level tell us about intervention strategy? "
            "(4) What phase should the user start in — and why? "
            "(5) What competing response or replacement behavior is most likely to work?"
        ),
    )
    underlying_need: Literal[
        "boredom_dopamine",
        "stress_anxiety",
        "social_ritual",
        "impulsivity_gratification",
        "avoidance_procrastination",
        "comfort_oral_stimulation",
        "physical_addiction",
    ] = Field(
        ...,
        description=(
            "The PRIMARY need this habit serves. Choose only one. "
            "physical_addiction = physiological or neurological dependency factors. "
            "KEY TEST: stopping causes physical symptoms or intense craving/withdrawal distress? "
            "If yes → physical_addiction."
        ),
    )
    need_description: str = Field(
        ...,
        description="1 sentence, empathetic, to the user, max 200 chars.",
        max_length=200,
    )
    frequency_unit: Literal["times", "minutes"] = Field(
        ...,
        description="'times' for discrete occurrences; 'minutes' for time-spent habits.",
    )
    skip_mapping_phase: bool = Field(
        ...,
        description=(
            "True only if awareness=conscious AND clear contexts AND not physical_addiction."
        ),
    )
    phase_1_focus: str = Field(
        ...,
        description="Concrete Phase 1 observation focus, or 'N/A' if skip_mapping_phase.",
        max_length=250,
    )
    competing_response: str = Field(
        ...,
        description="Specific competing or replacement strategy for Phase 2.",
        max_length=300,
    )
    intervention_hour: int = Field(
        ...,
        ge=0,
        le=23,
        description="Best local hour (0-23) for Category B nudge.",
    )
    confidence: float = Field(..., ge=0.0, le=1.0)
    requires_professional_referral: bool = Field(...)
    referral_message: str = Field(
        ...,
        description="Warm message if referral; else empty string.",
    )


SYSTEM_PROMPT = """You are a clinical habit change specialist applying Habit Reversal Training (HRT) principles.

## Your Task
Given a user's bad habit and their self-reported trigger profile, produce a clinical analysis that will power all future mission generation for this habit.

## The Three HRT Phases
1. **Mapping (Awareness Training)**: User logs when, where, and in what state the habit occurs. No behavior change attempted.
2. **Disruption (Competing Response Training)**: User practices a specific response incompatible with the habit or that meets the same need.
3. **Consolidation**: Practice in all high-risk contexts.

## Safety Rules
Set requires_professional_referral = True for opioids, benzos, severe alcohol dependence, hard drugs, sedative misuse, self-harm, suicidal ideation, eating disorder behaviours, or inability to function without substance. Then referral_message must be non-alarmist; competing_response and phase_1_focus should still be filled but the app may not surface actions for referral-only paths.

## Critical Rules
1. physical_addiction: skip_mapping_phase ALWAYS False.
2. subconscious awareness: skip_mapping_phase ALWAYS False.
3. need_description: empathetic, not diagnostic language.

Classify physical_addiction when withdrawal, craving, or compulsive dependency patterns apply (substances or behavioural addictions as described in field description).
"""


async def analyse_quit_profile(
    habit_name: str,
    trigger_contexts: list[str],
    awareness_level: str,
    quit_goal: str,
) -> QuitProfile:
    contexts_str = ", ".join(trigger_contexts) if trigger_contexts else "not specified"

    user_message = f"""Analyse this quit target and produce a clinical profile.

HABIT: {habit_name}
TRIGGER CONTEXTS: {contexts_str}
AWARENESS LEVEL: {awareness_level}
QUIT GOAL: {quit_goal}

Apply HRT principles. Identify the primary underlying need and design the appropriate intervention strategy."""

    return await run_agent(
        system_prompt=SYSTEM_PROMPT,
        user_message=user_message,
        response_model=QuitProfile,
        temperature=0.5,
        max_tokens=1500,
        context_label=f"QuitProfile:{habit_name}",
    )
