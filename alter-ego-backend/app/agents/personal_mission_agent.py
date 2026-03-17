"""
Personal Mission XP Tier Estimation.
User writes a mission in free text.
GPT-4o-mini estimates the effort tier.
User sees the tier before confirming — they can rewrite but not override.
"""

from __future__ import annotations

import json
import logging
import os
import re

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

logger = logging.getLogger(__name__)


PERSONAL_MISSION_TIER_PROMPT = """
You are estimating the effort required for a personal mission a user wants to add.

The user wrote: "{mission_text}"

Estimate the effort tier based on these criteria:

EASY (10 XP):
- Under 15 minutes
- Requires presence but not sustained effort
- Can be done passively or with minimal focus
- Examples: "Call mum", "Tidy my desk", "Drink a glass of water", "Read one page"

MEDIUM (20 XP):
- 15-45 minutes OR requires genuine focus
- Cannot be done on autopilot
- Produces something — a draft, a decision, a response
- Examples: "Draft my CV", "Research one flight for the trip", 
  "Write a difficult email", "Practice for 30 minutes"

HARD (40 XP):
- 45+ minutes OR requires sustained discomfort, courage, or social risk
- Examples: "Have the conversation I've been avoiding", 
  "Apply to 3 jobs", "Record a video and send it", "Finish the proposal"

MULTIDAY (varies):
- Clearly a multi-day goal (2-7 days)
- Examples: "Build the landing page", "Read the full book", 
  "Finish the project proposal"
- Only classify as multiday if the task obviously spans multiple days

Return ONLY valid JSON:
{
  "tier": "easy|medium|hard|multiday",
  "xp": 10,
  "pf": 8,
  "reasoning": "One sentence explaining why this tier",
  "estimated_minutes": 20,
  "multiday_days": null
}

XP values: easy=10, medium=20, hard=40
Apply 0.8x multiplier for personal missions:
  easy=8, medium=16, hard=32
PF values: easy=6, medium=11, hard=17

For multiday: xp=8 per day + 24 completion bonus. pf=5 per day.
multiday_days: estimated number of days (2-7).
"""


def _parse_json_response(text: str) -> dict:
    try:
        return json.loads(text)
    except Exception:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise


async def estimate_personal_mission_tier(mission_text: str) -> dict:
    """
    Estimates XP tier for a user-created personal mission.

    Returns:
        {
            "tier": "easy|medium|hard|multiday",
            "xp": 16,
            "pf": 11,
            "reasoning": "This requires genuine focus and produces a specific output.",
            "estimated_minutes": 30,
            "multiday_days": null
        }
    """
    mission_text = (mission_text or "").strip()
    if not mission_text:
        return {
            "tier": "medium",
            "xp": 16,
            "pf": 11,
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
        tier = str(data.get("tier") or "medium")
        logger.info("personal_mission_tier text=%r tier=%s", mission_text, tier)
        return data
    except Exception as e:
        logger.warning("personal_mission_tier failed text=%r error=%s", mission_text, str(e))
        return {
            "tier": "medium",
            "xp": 16,
            "pf": 11,
            "reasoning": "Estimated as medium effort.",
            "estimated_minutes": 30,
            "multiday_days": None,
        }

