"""
core_mission_agent.py

Tier-anchored core mission text: LLM varies phrasing; pillars and difficulties are rule-driven.
Journal is added separately in mission_service (always one per day).
"""

from __future__ import annotations

import logging
from typing import List, Literal

from pydantic import BaseModel, Field, field_validator

from app.agents.base import run_agent

logger = logging.getLogger(__name__)

CORE_TIER_SPECS = {
    "sleep": {
        "easy": "In bed by midnight tonight.",
        "medium": "In bed by 11pm, phone off 30 minutes before.",
        "hard": "7+ hours sleep, consistent wake time within ±30 minutes.",
        "elite": "7-day consistent sleep window — same bedtime and wake time.",
    },
    "movement": {
        "easy": "10 minutes of any physical movement today.",
        "medium": "20 minutes of movement, any kind.",
        "hard": "30 minutes with elevated heart rate.",
        "elite": "45-minute workout plus 10-minute stretch.",
    },
    "hydration": {
        "easy": "4 glasses of water today.",
        "medium": "6 glasses of water, first one before coffee.",
        "hard": "8 glasses today, no sugary drinks.",
        "elite": "8 glasses plus no caffeine after 2pm, for 3 consecutive days.",
    },
    "mindfulness": {
        "easy": "5 minutes of breathing or quiet reflection.",
        "medium": "10 minutes of meditation or focused journaling.",
        "hard": "15 minutes of practice plus one gratitude note.",
        "elite": "20 minutes of deep practice plus evening reflection.",
    },
    "no_phone": {
        "easy": "No phone for the first 15 minutes of your day.",
        "medium": "No phone for the first 30 minutes and last 30 minutes of day.",
        "hard": "A 2-hour phone-free window today.",
        "elite": "3-hour phone-free window plus no social media all day.",
    },
}

ARCHETYPE_PILLAR_ORDER = {
    "structured_climber": ["movement", "no_phone", "mindfulness", "sleep", "hydration"],
    "lone_wolf": ["no_phone", "movement", "mindfulness", "sleep", "hydration"],
    "restless_creator": ["mindfulness", "no_phone", "movement", "sleep", "hydration"],
    "reluctant_achiever": ["sleep", "hydration", "mindfulness", "movement", "no_phone"],
    "social_performer": ["movement", "no_phone", "mindfulness", "sleep", "hydration"],
}

ESTIMATED_MINUTES_BY_TIER = {
    "sleep": {"easy": 1, "medium": 1, "hard": 1, "elite": 1},
    "movement": {"easy": 10, "medium": 20, "hard": 30, "elite": 55},
    "hydration": {"easy": 1, "medium": 1, "hard": 1, "elite": 1},
    "mindfulness": {"easy": 5, "medium": 10, "hard": 15, "elite": 20},
    "no_phone": {"easy": 15, "medium": 30, "hard": 120, "elite": 180},
}


class CoreMission(BaseModel):
    pillar: Literal["sleep", "movement", "hydration", "mindfulness", "no_phone"]
    title: str = Field(
        ...,
        description=(
            "Mission text. Max 65 chars. Action verb first. "
            "Anchored to tier spec — no extra constraints. No parentheses or slashes."
        ),
    )
    difficulty: Literal["easy", "medium", "hard", "elite"]

    @field_validator("title")
    @classmethod
    def title_rules(cls, v: str) -> str:
        t = (v or "").strip()
        if len(t) > 65:
            raise ValueError("title exceeds 65 characters")
        if "(" in t or ")" in t or "/" in t:
            raise ValueError("no parentheses or slashes in title")
        return t


class CoreMissionBatch(BaseModel):
    missions: List[CoreMission] = Field(default_factory=list)


SYSTEM_PROMPT = """You generate daily Core missions for a discipline app.
Pillars: Sleep, Movement, Hydration, Mindfulness, No-Phone.

Write natural mission text inside the tier constraints given in the user message.
Do not invent difficulty. Do not add constraints beyond the tier spec.
Clear, direct sentences — human, not robotic.

Rules:
- Start every mission with an action verb (Get, Drink, Walk, Sit, Keep, Put, Take, Block, etc.)
- Max 65 characters per mission title
- No parentheses, slashes, or notes in the title
- Do not copy previous titles verbatim
- difficulty must match the tier named for that pillar in the user message
"""


def pillars_for_day(archetype: str, days_active: int) -> list[str]:
    order = ARCHETYPE_PILLAR_ORDER.get(
        (archetype or "structured_climber").lower().replace("-", "_"),
        list(CORE_TIER_SPECS.keys()),
    )
    if days_active < 3:
        return order[:3]
    if days_active < 7:
        return order[:4]
    return list(order)


def build_fallback_batch(
    pillars_today: list[str],
    pillar_difficulties: dict,
) -> CoreMissionBatch:
    out: list[CoreMission] = []
    for pillar in pillars_today:
        diff = str(pillar_difficulties.get(pillar, "easy") or "easy").lower()
        if diff not in ("easy", "medium", "hard", "elite"):
            diff = "easy"
        spec = CORE_TIER_SPECS[pillar][diff]
        title = spec if len(spec) <= 65 else spec[:62] + "..."
        out.append(CoreMission(pillar=pillar, title=title, difficulty=diff))  # type: ignore[arg-type]
    return CoreMissionBatch(missions=out)


def _normalize_batch(
    batch: CoreMissionBatch,
    pillars_today: list[str],
    pillar_difficulties: dict,
) -> CoreMissionBatch:
    by_pillar: dict[str, CoreMission] = {}
    for m in batch.missions:
        if m.pillar in pillars_today:
            by_pillar[m.pillar] = m
    merged: list[CoreMission] = []
    for p in pillars_today:
        if p in by_pillar:
            merged.append(by_pillar[p])
        else:
            diff = str(pillar_difficulties.get(p, "easy") or "easy").lower()
            if diff not in ("easy", "medium", "hard", "elite"):
                diff = "easy"
            spec = CORE_TIER_SPECS[p][diff]
            title = spec if len(spec) <= 65 else spec[:62] + "..."
            merged.append(CoreMission(pillar=p, title=title, difficulty=diff))  # type: ignore[arg-type]
    return CoreMissionBatch(missions=merged)


async def generate_core_missions(
    archetype: str,
    days_active: int,
    pillar_difficulties: dict,
    recent_pillar_completions: dict,
    last_core_missions: list[str],
    *,
    recovery_pillars_today: list[str] | None = None,
    pillar_streaks: dict | None = None,
    pillar_completion_hour: dict | None = None,
) -> CoreMissionBatch:
    pillars_today = (
        list(recovery_pillars_today)
        if recovery_pillars_today is not None
        else pillars_for_day(archetype, days_active)
    )

    pillar_specs: list[str] = []
    for pillar in pillars_today:
        difficulty = str(pillar_difficulties.get(pillar, "easy") or "easy").lower()
        if difficulty not in CORE_TIER_SPECS[pillar]:
            difficulty = "easy"
        spec = CORE_TIER_SPECS[pillar][difficulty]
        completion_rate = float(recent_pillar_completions.get(pillar, 0.7) or 0.7)
        pillar_specs.append(
            f"- {pillar.upper()} (difficulty MUST be {difficulty}): {spec} "
            f"[7-day completion: {int(completion_rate * 100)}%]"
        )

    anti_lines = [f"  - {m}" for m in (last_core_missions or [])[-6:]]
    anti_repeat = "\n".join(anti_lines) if anti_lines else "  None"

    # ── Per-pillar context (streak + break + time pattern) ─────────────────
    context_lines: list[str] = []
    streaks = pillar_streaks or {}
    hours = pillar_completion_hour or {}

    for pillar in pillars_today:
        streak = int(streaks.get(pillar, 0) or 0)
        hour_pattern = str(hours.get(pillar, "") or "")
        parts: list[str] = []

        if streak > 1:
            parts.append(f"{streak}-day streak")
        elif streak == 0:
            parts.append("streak reset yesterday")

        if hour_pattern:
            parts.append(f"usually completes in the {hour_pattern}")

        if parts:
            context_lines.append(f"  - {pillar.upper()}: {', '.join(parts)}")

    pillar_context_str = (
        "PILLAR CONTEXT (use to vary phrasing — reference streak or time naturally):\n"
        + "\n".join(context_lines)
        if context_lines
        else ""
    )

    user_message = f"""Generate today's core missions for this user.

ARCHETYPE: {archetype}
DAY (0 = first calendar day since signup): {days_active}
PILLARS TO INCLUDE (exactly {len(pillars_today)} missions, one per pillar, same order):
{", ".join(pillars_today)}

TIER SPECS (follow difficulty per line):
{chr(10).join(pillar_specs)}

{pillar_context_str}

PREVIOUS MISSION TITLES (vary phrasing; do not copy):
{anti_repeat}

PHRASING GUIDE:
- If a pillar has a streak > 1: reference it naturally. e.g. "Movement. Day 23. You know the drill — 20 minutes."
- If streak == 0 (reset yesterday): acknowledge briefly, forward-only. e.g. "The streak reset. Today is day 1. 10 minutes."
- If pillar has a time pattern: reference it. e.g. "Your afternoon phone break. 15 minutes."
- Day 1-3: keep phrasing simple and encouraging. No streak references.
- Never guilt. Never "you missed" or "you failed".

Return exactly {len(pillars_today)} missions with pillars: {", ".join(pillars_today)}."""

    try:
        result = await run_agent(
            system_prompt=SYSTEM_PROMPT,
            user_message=user_message,
            response_model=CoreMissionBatch,
            temperature=0.6,
            max_tokens=400,
            context_label=f"CoreMissions:day{days_active}",
        )
        normalized = _normalize_batch(result, pillars_today, pillar_difficulties)
        return normalized
    except Exception:
        logger.exception("generate_core_missions failed; using tier-table fallback")
        return build_fallback_batch(pillars_today, pillar_difficulties)


def estimated_minutes_for(pillar: str, difficulty: str) -> int:
    d = difficulty if difficulty in ESTIMATED_MINUTES_BY_TIER.get(pillar, {}) else "easy"
    return int(ESTIMATED_MINUTES_BY_TIER.get(pillar, {}).get(d, 1))
