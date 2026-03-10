"""
Archetype scoring — Twin Design §3.1.
Maps 10-question onboarding answers to one of 8 archetypes and initial discipline_dna.
"""

from datetime import datetime, timezone
from typing import Any

# Archetype → (intensity 1-5, tone_type, gap_behavior, message_frequency)
ARCHETYPE_MAP = {
    "The Driven Achiever": {
        "twin_intensity": 4,
        "twin_tone_type": "rival",
        "twin_gap_behavior": "chase",
        "twin_message_frequency": "high",
    },
    "The Restless Creator": {
        "twin_intensity": 3,
        "twin_tone_type": "philosopher",
        "twin_gap_behavior": "rubber_band",
        "twin_message_frequency": "medium",
    },
    "The Lone Wolf": {
        "twin_intensity": 3,
        "twin_tone_type": "silent_force",
        "twin_gap_behavior": "steady",
        "twin_message_frequency": "low",
    },
    "The Disciplined Builder": {
        "twin_intensity": 4,
        "twin_tone_type": "rival",
        "twin_gap_behavior": "chase",
        "twin_message_frequency": "medium",
    },
    "The Recovering Escaper": {
        "twin_intensity": 2,
        "twin_tone_type": "philosopher",
        "twin_gap_behavior": "rubber_band",
        "twin_message_frequency": "medium",
    },
    "The Fresh Starter": {
        "twin_intensity": 2,
        "twin_tone_type": "philosopher",
        "twin_gap_behavior": "rubber_band",
        "twin_message_frequency": "medium",
    },
    "The Burned-Out Expert": {
        "twin_intensity": 2,
        "twin_tone_type": "silent_force",
        "twin_gap_behavior": "rubber_band",
        "twin_message_frequency": "low",
    },
    "The Social Competitor": {
        "twin_intensity": 5,
        "twin_tone_type": "rival",
        "twin_gap_behavior": "chase",
        "twin_message_frequency": "high",
    },
}

# Archetype → description paragraph + Twin first message (Part 3A Screen 14, §2.2).
ARCHETYPE_CONTENT: dict[str, dict[str, str]] = {
    "The Driven Achiever": {
        "description": "You use setbacks as fuel. The gap between you and your best self is the only competition that matters.",
        "twin_first_message": "Good. I'm ahead. You can close the gap — if you actually do the work.",
    },
    "The Restless Creator": {
        "description": "You work in bursts. High energy, then silence. The gap between your potential and your output frustrates you most.",
        "twin_first_message": "You finally showed up. I've been here. Let's see if you stay.",
    },
    "The Lone Wolf": {
        "description": "You don't need external validation. But sometimes you drift without an anchor. You work best when the mission feels personally chosen.",
        "twin_first_message": "You work alone. So do I.",
    },
    "The Disciplined Builder": {
        "description": "You thrive with a plan. Uncertainty is your only real enemy. Given the right system, you execute without hesitation.",
        "twin_first_message": "Good. I'm ahead. You can close the gap — if you actually do the work.",
    },
    "The Recovering Escaper": {
        "description": "You're here to quit something that's holding you back. Small wins matter more than big pressure. We'll meet you where you are.",
        "twin_first_message": "You know what to do. You just keep waiting for the right moment. I don't wait.",
    },
    "The Fresh Starter": {
        "description": "No established patterns yet. You're building from zero. We'll start supportive and adapt as you show up.",
        "twin_first_message": "You showed up. That's the only thing that matters today.",
    },
    "The Burned-Out Expert": {
        "description": "You know what to do. You don't need instruction. You need presence — and a rival who doesn't lecture.",
        "twin_first_message": "You work alone. So do I.",
    },
    "The Social Competitor": {
        "description": "Visibility drives you. You perform best when someone is watching. The leaderboard will be uncomfortable — and motivating.",
        "twin_first_message": "You care what they think. I only care what the data says.",
    },
}


def get_archetype_content(archetype_name: str) -> dict[str, str]:
    """Return archetype, description, twin_first_message for the reveal screen."""
    content = ARCHETYPE_CONTENT.get(
        archetype_name,
        ARCHETYPE_CONTENT["The Fresh Starter"],
    )
    return {
        "archetype": archetype_name,
        "description": content["description"],
        "twin_first_message": content["twin_first_message"],
    }


def score_archetype(answers: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    """
    Map onboarding answers to archetype name and discipline_dna.
    Returns (archetype_name, discipline_dna) where discipline_dna includes
    twin_intensity, twin_tone_type, twin_gap_behavior, twin_message_frequency,
    last_calibration_at, calibration_count.
    """
    situation = (answers.get("situation") or "").strip()
    reason = (answers.get("reason") or "").strip()
    task_approach = (answers.get("taskApproach") or "").strip()
    off_track = (answers.get("offTrack") or "").strip()
    motivation = (answers.get("motivation") or "").strip()
    autonomy = (answers.get("autonomy") or "").strip()
    comparison = (answers.get("comparison") or "").strip()

    # Escaper path: quitting something
    if "quit" in reason.lower() or "Trying to quit" in situation:
        archetype = "The Recovering Escaper"
    # Fresh start, no established patterns
    elif "Starting completely fresh" in situation or "Still figuring" in str(answers.get("interest_levels", "")):
        archetype = "The Fresh Starter"
    # Burned out / knows what to do, doesn't need instruction
    elif "Grinding hard but staying inconsistent" in situation and "Tune it out" in autonomy:
        archetype = "The Burned-Out Expert"
    # Competition-driven
    elif "I love it — competition drives me" in comparison or "Someone was counting on me" in motivation:
        archetype = "The Social Competitor"
    # Loves structure and challenge
    elif "Plan it out properly" in task_approach and "Appreciate the structure" in autonomy:
        archetype = "The Disciplined Builder"
    # Use failure as fuel
    elif "Use it as fuel to come back harder" in off_track:
        archetype = "The Driven Achiever"
    # Run own race, resistant to being told
    elif "I'd rather just run my own race" in comparison or "Tune it out almost automatically" in autonomy:
        archetype = "The Lone Wolf"
    # Dive in, meaning over pressure
    elif "Dive straight in" in task_approach or "genuinely enjoyable" in motivation:
        archetype = "The Restless Creator"
    # Default
    else:
        archetype = "The Fresh Starter"

    params = ARCHETYPE_MAP.get(archetype, ARCHETYPE_MAP["The Fresh Starter"]).copy()
    now = datetime.now(timezone.utc).isoformat()
    params["last_calibration_at"] = now
    params["calibration_count"] = 0
    return archetype, params
