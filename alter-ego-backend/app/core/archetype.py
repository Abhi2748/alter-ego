"""
ALTER EGO — Archetype classification (deterministic)
Pure Python, no LLM. Used during onboarding.
"""

from __future__ import annotations

from typing import Dict


ARCHETYPE_KEYS = (
    "restless_creator",
    "reluctant_achiever",
    "structured_climber",
    "lone_wolf",
    "social_performer",
)

# Tiebreak priority (highest wins ties)
TIEBREAK_PRIORITY = (
    "structured_climber",
    "lone_wolf",
    "restless_creator",
    "reluctant_achiever",
    "social_performer",
)


SCORING_TABLE: dict[str, dict[str, dict[str, int]]] = {
    "q4_situation": {
        "overwhelmed": {"reluctant_achiever": 2, "restless_creator": 1},
        "ambitious": {"structured_climber": 2, "social_performer": 1},
        "stuck": {"reluctant_achiever": 2, "lone_wolf": 1},
        "rebuilding": {"lone_wolf": 2, "reluctant_achiever": 1},
        "competitive": {"social_performer": 2, "structured_climber": 1},
    },
    "q5_reason": {
        "prove_to_self": {"lone_wolf": 2, "structured_climber": 1},
        "prove_to_others": {"social_performer": 2, "structured_climber": 1},
        "build_something": {"restless_creator": 2, "structured_climber": 1},
        "escape_habit": {"reluctant_achiever": 2, "lone_wolf": 1},
        "level_up": {"structured_climber": 2, "social_performer": 1},
    },
    "q6_approach": {
        "systems_first": {"structured_climber": 2, "lone_wolf": 1},
        "jump_in": {"restless_creator": 2, "social_performer": 1},
        "research_first": {"lone_wolf": 2, "structured_climber": 1},
        "need_accountability": {"social_performer": 2, "reluctant_achiever": 1},
        "depends_on_mood": {"restless_creator": 2, "reluctant_achiever": 1},
    },
    "q7_recovery": {
        "restart_immediately": {"structured_climber": 2, "lone_wolf": 1},
        "need_time": {"reluctant_achiever": 2, "restless_creator": 1},
        "guilt_spiral": {"reluctant_achiever": 2, "social_performer": 1},
        "dont_miss": {"lone_wolf": 2, "structured_climber": 1},
        "public_commitment": {"social_performer": 2, "structured_climber": 1},
    },
    "q8_motivation": {
        "internal_standards": {"lone_wolf": 2, "structured_climber": 1},
        "external_validation": {"social_performer": 2, "restless_creator": 1},
        "fear_of_regret": {"reluctant_achiever": 2, "lone_wolf": 1},
        "curiosity": {"restless_creator": 2, "lone_wolf": 1},
        "competition": {"social_performer": 2, "structured_climber": 1},
    },
    "q9_autonomy": {
        "full_control": {"lone_wolf": 2, "structured_climber": 1},
        "guidance_welcome": {"structured_climber": 2, "reluctant_achiever": 1},
        "accountability_partner": {"social_performer": 2, "reluctant_achiever": 1},
        "flexible": {"restless_creator": 2, "reluctant_achiever": 1},
        "structured_plan": {"structured_climber": 2, "lone_wolf": 1},
    },
    "q10_comparison": {
        "drives_me": {"social_performer": 2, "structured_climber": 1},
        "dont_care": {"lone_wolf": 2, "restless_creator": 1},
        "motivates_briefly": {"restless_creator": 2, "reluctant_achiever": 1},
        "uncomfortable": {"lone_wolf": 2, "reluctant_achiever": 1},
        "use_as_benchmark": {"structured_climber": 2, "social_performer": 1},
    },
}


def classify_archetype(answers: dict[str, str]) -> str:
    """
    Classify user into one of 5 archetypes based on Q4-Q10 answers.

    Args:
        answers: dict mapping question_key to answer_value
                 e.g. {"q4_situation": "ambitious", "q5_reason": "level_up", ...}

    Returns:
        archetype key string, one of:
        "restless_creator", "reluctant_achiever", "structured_climber",
        "lone_wolf", "social_performer"
    """
    scores: Dict[str, int] = {k: 0 for k in ARCHETYPE_KEYS}

    for question_key, answer_value in answers.items():
        per_question = SCORING_TABLE.get(question_key)
        if not per_question:
            continue
        per_answer = per_question.get(answer_value)
        if not per_answer:
            continue
        for archetype_key, points in per_answer.items():
            if archetype_key in scores:
                scores[archetype_key] += points

    best_score = max(scores.values()) if scores else 0
    tied = [k for k, v in scores.items() if v == best_score]

    for preferred in TIEBREAK_PRIORITY:
        if preferred in tied:
            return preferred

    return "structured_climber"


def get_archetype_data(archetype_key: str) -> dict:
    """
    Returns the full archetype definition from constants.
    Used by onboarding complete endpoint to return reveal data to frontend.
    """
    from app.core.constants import ARCHETYPES

    return ARCHETYPES.get(archetype_key, ARCHETYPES["structured_climber"])


def get_initial_dna(archetype_key: str) -> dict:
    """
    Returns the initial discipline_dna values for this archetype.
    Used when creating a new user's discipline_dna row after onboarding.
    """
    archetype = get_archetype_data(archetype_key)
    return {
        "twin_intensity": archetype["twin_intensity"],
        "twin_tone_type": archetype["twin_tone_type"],
        "twin_gap_behavior": archetype["twin_gap_behavior"],
        "twin_message_frequency": archetype["twin_message_frequency"],
        "calibration_count": 0,
    }


if __name__ == "__main__":
    # Test 1: structured_climber profile
    test1 = {
        "q4_situation": "ambitious",
        "q5_reason": "level_up",
        "q6_approach": "systems_first",
        "q7_recovery": "restart_immediately",
        "q8_motivation": "internal_standards",
        "q9_autonomy": "full_control",
        "q10_comparison": "use_as_benchmark",
    }
    result1 = classify_archetype(test1)
    assert result1 == "structured_climber", f"Expected structured_climber, got {result1}"
    print(f"Test 1 passed: {result1}")

    # Test 2: lone_wolf profile
    test2 = {
        "q4_situation": "rebuilding",
        "q5_reason": "prove_to_self",
        "q6_approach": "research_first",
        "q7_recovery": "dont_miss",
        "q8_motivation": "internal_standards",
        "q9_autonomy": "full_control",
        "q10_comparison": "dont_care",
    }
    result2 = classify_archetype(test2)
    assert result2 == "lone_wolf", f"Expected lone_wolf, got {result2}"
    print(f"Test 2 passed: {result2}")

    # Test 3: social_performer profile
    test3 = {
        "q4_situation": "competitive",
        "q5_reason": "prove_to_others",
        "q6_approach": "need_accountability",
        "q7_recovery": "public_commitment",
        "q8_motivation": "competition",
        "q9_autonomy": "accountability_partner",
        "q10_comparison": "drives_me",
    }
    result3 = classify_archetype(test3)
    assert result3 == "social_performer", f"Expected social_performer, got {result3}"
    print(f"Test 3 passed: {result3}")

    # Test 4: handles unknown answer values gracefully
    test4 = {
        "q4_situation": "unknown_value",
        "q5_reason": "level_up",
    }
    result4 = classify_archetype(test4)
    print(f"Test 4 passed (graceful unknown): {result4}")

    # Test 5: empty answers returns tiebreak default
    result5 = classify_archetype({})
    assert result5 == "structured_climber", f"Expected structured_climber on empty, got {result5}"
    print(f"Test 5 passed (empty = default): {result5}")

    print("\nAll archetype tests passed.")

