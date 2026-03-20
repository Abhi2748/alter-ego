"""
Personal Mission XP Tier Estimation.
User writes a mission in free text.
GPT-4o-mini estimates the effort tier.
XP/PF are computed server-side from tier (spec §9).
"""

from __future__ import annotations

import json
import logging
import os
import re

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

from app.core.constants import (
    MISSION_PF,
    MULTIDAY_PERSONAL_PER_DAY,
    PERSONAL_MISSION_XP_BY_TIER,
)

logger = logging.getLogger(__name__)

# Only {mission_text} is a format placeholder; JSON braces must be doubled for str.format.
PERSONAL_MISSION_TIER_PROMPT = """
You are estimating the effort required for a personal mission a user wants to add.

The user wrote: "{mission_text}"

Estimate the effort tier based on these criteria:

EASY:
- Under 15 minutes
- Requires presence but not sustained effort
- Can be done passively or with minimal focus
- Examples: "Call mum", "Tidy my desk", "Drink a glass of water", "Read one page"

MEDIUM:
- 15-45 minutes OR requires genuine focus
- Cannot be done on autopilot
- Produces something — a draft, a decision, a response
- Examples: "Draft my CV", "Research one flight for the trip",
  "Write a difficult email", "Practice for 30 minutes"

HARD:
- 45+ minutes OR requires sustained discomfort, courage, or social risk
- Examples: "Have the conversation I've been avoiding",
  "Apply to 3 jobs", "Record a video and send it", "Finish the proposal"

MULTIDAY:
- Clearly a multi-day goal (2-7 days)
- Examples: "Build the landing page", "Read the full book",
  "Finish the project proposal"
- Only classify as multiday if the task obviously spans multiple days

Return ONLY valid JSON (no markdown fences):
{{
  "tier": "easy|medium|hard|multiday",
  "reasoning": "One sentence explaining why this tier",
  "estimated_minutes": 20,
  "multiday_days": null
}}

Use multiday_days as an integer 2-7 when tier is multiday, else null.
Do not include xp or pf in JSON; the server sets them from the tier.
"""


def _parse_json_response(text: str) -> dict:
    try:
        return json.loads(text)
    except Exception:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise


def _normalize_tier(raw: str | None) -> str:
    t = str(raw or "medium").lower().strip()
    if t in ("easy", "medium", "hard", "multiday"):
        return t
    return "medium"


def _personal_xp_pf(tier: str) -> tuple[int, int]:
    """XP/PF for API response; matches missions.personal_create."""
    pf_map = MISSION_PF["personal"]
    if tier == "multiday":
        return MULTIDAY_PERSONAL_PER_DAY, 5
    if tier == "easy":
        return PERSONAL_MISSION_XP_BY_TIER["easy"], pf_map["easy"]
    if tier == "hard":
        return PERSONAL_MISSION_XP_BY_TIER["hard"], pf_map["hard"]
    return PERSONAL_MISSION_XP_BY_TIER["medium"], pf_map["medium"]


async def estimate_personal_mission_tier(mission_text: str) -> dict:
    """
    Estimates effort tier for a user-created personal mission.

    Returns tier, reasoning, estimated_minutes, multiday_days, plus xp/pf from constants.
    """
    mission_text = (mission_text or "").strip()
    if not mission_text:
        xp, pf = _personal_xp_pf("medium")
        return {
            "tier": "medium",
            "xp": xp,
            "pf": pf,
            "reasoning": "Estimated as medium effort.",
            "estimated_minutes": 30,
            "multiday_days": None,
        }

    try:
        llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.3,
            max_tokens=300,
            api_key=os.environ["OPENAI_API_KEY"],
        )
        prompt = PERSONAL_MISSION_TIER_PROMPT.format(mission_text=mission_text)
        response = await llm.ainvoke([SystemMessage(content=prompt)])
        data = _parse_json_response(str(response.content))
        tier = _normalize_tier(data.get("tier"))
        multiday_days = data.get("multiday_days")
        if tier == "multiday" and multiday_days is not None:
            try:
                multiday_days = max(2, min(7, int(multiday_days)))
            except (TypeError, ValueError):
                multiday_days = 2
        else:
            multiday_days = None

        xp, pf = _personal_xp_pf(tier)
        reasoning = str(data.get("reasoning") or "Tier estimated from your mission text.")
        try:
            est_min = int(data.get("estimated_minutes") or 25)
        except (TypeError, ValueError):
            est_min = 25
        est_min = max(5, min(180, est_min))

        logger.info("personal_mission_tier text=%r tier=%s", mission_text, tier)
        return {
            "tier": tier,
            "xp": xp,
            "pf": pf,
            "reasoning": reasoning,
            "estimated_minutes": est_min,
            "multiday_days": multiday_days,
        }
    except Exception as e:
        logger.warning("personal_mission_tier failed text=%r error=%s", mission_text, str(e))
        xp, pf = _personal_xp_pf("medium")
        return {
            "tier": "medium",
            "xp": xp,
            "pf": pf,
            "reasoning": "Estimated as medium effort.",
            "estimated_minutes": 30,
            "multiday_days": None,
        }
