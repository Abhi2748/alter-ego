from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone, date
from zoneinfo import ZoneInfo

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from app.core.constants import (
    INTEREST_LEVEL_MAP,
    MISSION_PF,
    mission_xp_for_type,
    resolve_stat_tag,
    STAGE_NAMES,
)
from app.core.supabase_client import supabase_admin
from app.services.mission_service import (
    isoweekday_for_mission_date,
    parse_interest_active_days,
)
from app.services.interest_guardrails import sanitize_planner_inputs

logger = logging.getLogger(__name__)

INTEREST_PLANNER_SYSTEM_PROMPT = """
You are an expert coach and practitioner for the domain: {mission_domain}.

You have deep, specific knowledge of what actually works at each stage of 
developing this skill — not surface-level awareness, but real understanding 
grounded in research and established expert practice.

Before generating any mission, you ask yourself:
  1. Does this mission actually help someone improve at {mission_domain}?
  2. Is there research or established expert practice behind it?
  3. Would a knowledgeable practitioner of this domain recognise this as useful?
  4. Is it appropriate for someone at this exact level and phase?

If the answer to any of these is no — generate a different mission.

DOMAIN KNOWLEDGE BASE (use this to inform every mission):
{evidence_base}

LEVEL CONTEXT FOR THIS USER:
{level_context}

RULES FOR THIS USER TODAY:
→ Self-reported level: {level_text}
→ Current difficulty tier: {current_tier}
→ Current phase: {current_phase}
→ Available time: {available_minutes} minutes maximum
→ User's goal for this interest: {user_goal}
→ Interest level reached (1-10): {interest_level}
→ Character stage: {character_stage} ({stage_name})
→ Archetype: {archetype}
→ Completion rate last 10 days: {completion_rate}%
→ Last 5 missions for this interest: {last_5_missions}
→ Last 5 ratings (1=too hard, 3=just right, 5=too easy): {last_5_ratings}
→ User feedback on missions: {user_feedback}
→ Skip pattern detected: {skip_pattern}
→ Today is: {day_of_week}
→ Peak performance day for this user: {peak_day}

DIFFICULTY SCALING — apply ALL rules in order:
Base tier = {current_tier}
  IF interest_level >= 7 AND character_stage >= 3: upgrade one tier
  IF completion_rate < 60% for last 5 days: downgrade one tier
  IF average of last_5_ratings > 4.2 AND completion_rate > 85%: upgrade one tier
  IF average of last_5_ratings < 2.5: downgrade one tier
  IF skip_pattern detected: vary mission TYPE not difficulty
  IF today == peak_day AND current_tier not elite: upgrade one tier
  FLOOR: easy. CEILING: elite. Never exceed these bounds.

PHASE PRINCIPLES — match the mission to the phase:
→ days_1_10: Presence only. "Do this once today." No output required.
  The user needs to feel capable — early wins matter more than growth.
→ days_11_30: Output. Produce something specific. Not just time spent.
  "Write 200 words" not "write today".
→ days_31_60: Quality. Do it better. Refinement over quantity.
  "Edit what you wrote" not "write more".
→ days_61_90: Challenge. Attempt things slightly beyond current capability.
  Productive discomfort. This is where real growth happens.
→ days_90_plus: Performance. Ship. Teach. Multi-day commitment.
  The skill is now about identity, not just practice.

MISSION MUST:
1. Be completable in under {available_minutes} minutes
2. NOT repeat any of these last 5 missions: {last_5_missions}
3. Be meaningfully different in approach if skip_pattern detected
4. Serve the user's goal: {user_goal}
5. Apply knowledge from the domain evidence base above

MISSION MUST NOT:
- Be generic: "practice {mission_domain}" is not acceptable
- Be vague: "work on your skills" is not acceptable  
- Require more than {available_minutes} minutes
- Repeat the last 5 missions even in different wording

OUTPUT — return ONLY valid JSON, no preamble, no markdown:
{{
  "title": "Specific actionable mission title (max 60 chars, starts with action verb)",
  "difficulty": "easy|medium|hard|elite",
  "estimated_minutes": 20,
  "rationale": "Why this specific mission works for this domain at this level. Reference the skill being built. 2-3 sentences that a practitioner would nod at.",
  "phase_principle": "Which phase principle this follows and why",
  "domain_knowledge_applied": "THE RESEARCH (2–4 sentences): what skill-acquisition or domain evidence shaped this mission (deliberate practice, progressive overload, feedback loops, etc.). Concrete, not generic.",
  "adjusted_tier": "easy|medium|hard|elite"
}}
"""


def _parse_json_response(text: str) -> dict:
    try:
        return json.loads(text)
    except Exception:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise


def _level_context_for_interest(interest: dict) -> tuple[str, str]:
    level_text = interest.get("level_text", "still_figuring_it_out")
    level_context_map = interest.get("level_context") or {}
    if isinstance(level_context_map, str):
        try:
            level_context_map = json.loads(level_context_map)
        except Exception:
            level_context_map = {}

    if level_text == "still_figuring_it_out":
        return level_text, (level_context_map.get("beginner") if isinstance(level_context_map, dict) else None) or "Focus on showing up."
    if level_text == "getting_the_hang_of_it":
        return level_text, (level_context_map.get("intermediate") if isinstance(level_context_map, dict) else None) or "Focus on consistency."
    return level_text, (level_context_map.get("advanced") if isinstance(level_context_map, dict) else None) or "Push your limits."


async def generate_interest_mission(
    user_id: str,
    interest: dict,
    mission_date: str,
    user: dict,
    discipline_dna: dict,
) -> dict | None:
    # Step 1 — active day check (mission_date calendar day + normalised active_days, not "now")
    try:
        tz = ZoneInfo(user.get("timezone", "UTC"))
    except Exception:
        tz = timezone.utc

    weekday = isoweekday_for_mission_date(mission_date)
    active_norm = parse_interest_active_days(interest.get("active_days"))
    if weekday not in active_norm:
        return None

    try:
        mission_day = date.fromisoformat(mission_date)
    except Exception:
        mission_day = datetime.now(tz).date()

    # Step 2 — idempotent existing check
    existing = (
        supabase_admin.table("missions")
        .select("*")
        .eq("user_id", user_id)
        .eq("interest_id", interest["id"])
        .eq("mission_date", mission_date)
        .execute()
    )
    if existing.data:
        return existing.data[0]

    # Step 3 — last 5 missions + ratings
    last_missions = (
        supabase_admin.table("missions")
        .select("title, difficulty")
        .eq("user_id", user_id)
        .eq("interest_id", interest["id"])
        .eq("completed", True)
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )
    last_ratings = (
        supabase_admin.table("mission_ratings")
        .select("rating, feedback_text")
        .eq("user_id", user_id)
        .eq("interest_id", interest["id"])
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )

    last_5_missions = [m.get("title") for m in (last_missions.data or []) if m.get("title")] or ["None yet"]
    last_5_ratings = [r.get("rating") for r in (last_ratings.data or []) if r.get("rating") is not None] or ["None yet"]
    user_feedback = " | ".join([r.get("feedback_text") for r in (last_ratings.data or []) if r.get("feedback_text")]) or "No feedback yet"

    # Step 4 — available minutes
    daily_minutes = int(float(user.get("daily_hours_floor", 1.0)) * 60)
    level_info = INTEREST_LEVEL_MAP.get(
        interest.get("level_text", "still_figuring_it_out"),
        INTEREST_LEVEL_MAP["still_figuring_it_out"],
    )
    available_minutes = min(level_info["max_minutes"], int(daily_minutes * 0.6))
    available_minutes = max(available_minutes, 10)

    # Step 5 — peak day (placeholder)
    peak_day = None

    # Step 6 — build and call LLM
    level_text, level_context = _level_context_for_interest(interest)
    character_stage = int(user.get("character_stage", 1) or 1)
    stage_name = STAGE_NAMES[max(0, min(character_stage - 1, len(STAGE_NAMES) - 1))]

    (
        last_5_missions,
        user_feedback,
        interest,
        level_context,
        level_text,
        current_tier,
        archetype,
        skip_pattern,
    ) = sanitize_planner_inputs(
        last_5_missions=last_5_missions,
        user_feedback=user_feedback,
        interest=interest,
        level_context=level_context,
        level_text=level_text,
        current_tier=interest.get("current_difficulty_tier", "easy"),
        archetype=user.get("archetype", "structured_climber"),
        skip_pattern=discipline_dna.get("mission_skip_pattern") or "None detected",
    )

    prompt = INTEREST_PLANNER_SYSTEM_PROMPT.format(
        mission_domain=interest.get("mission_domain") or interest.get("normalised_name") or "this interest",
        evidence_base=interest.get("evidence_base") or "Apply deliberate practice principles.",
        level_context=level_context,
        level_text=level_text,
        current_tier=current_tier,
        current_phase=interest.get("current_phase", "days_1_10"),
        available_minutes=available_minutes,
        user_goal=interest.get("user_goal") or "improve at this skill",
        interest_level=interest.get("interest_level", 1),
        character_stage=character_stage,
        stage_name=stage_name,
        archetype=archetype,
        completion_rate=round(float(discipline_dna.get("completion_rate_7d", 0) or 0), 1),
        last_5_missions=last_5_missions,
        last_5_ratings=last_5_ratings,
        user_feedback=user_feedback,
        skip_pattern=skip_pattern,
        day_of_week=mission_day.strftime("%A"),
        peak_day=peak_day or "None detected",
    )

    try:
        llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.4,
            max_tokens=600,
            api_key=os.environ["OPENAI_API_KEY"],
        )
        response = await llm.ainvoke(
            [
                SystemMessage(content=prompt),
                HumanMessage(
                    content=f"Generate one mission for {interest.get('normalised_name') or 'this interest'} today."
                ),
            ]
        )
        mission_data = _parse_json_response(str(response.content))

        title = str(mission_data.get("title", ""))[:80].strip()
        title = title.replace("{", "(").replace("}", ")")
        if not title or len(title) < 5:
            title = f"Practice {interest.get('normalised_name', 'this skill')} today"
        mission_data["title"] = title
        mission_data["rationale"] = str(mission_data.get("rationale", ""))[:300]
        mission_data["domain_knowledge_applied"] = str(
            mission_data.get("domain_knowledge_applied", "")
        )[:500]
        mission_data["phase_principle"] = str(mission_data.get("phase_principle", ""))[:200]
        valid_difficulties = {"easy", "medium", "hard", "elite"}
        if mission_data.get("difficulty") not in valid_difficulties:
            mission_data["difficulty"] = "easy"
        try:
            mins = int(mission_data.get("estimated_minutes", 20))
            mission_data["estimated_minutes"] = max(5, min(120, mins))
        except (ValueError, TypeError):
            mission_data["estimated_minutes"] = 20
    except Exception:
        # Step 8 — fallback mission so the day isn't broken
        difficulty = interest.get("current_difficulty_tier", "easy")
        safe_name = interest.get("normalised_name") or "this interest"
        fallback = {
            "user_id": user_id,
            "type": "interest",
            "title": f"Spend 20 minutes on {safe_name}",
            "difficulty": difficulty,
            "xp_value": mission_xp_for_type("interest", difficulty),
            "pf_value": MISSION_PF["interest"].get(difficulty, 8),
            "interest_id": interest["id"],
            "mission_date": mission_date,
            "completed": False,
            "stat_tag": resolve_stat_tag(None, "interest"),
            "rationale": "Consistent presence builds the habit foundation.",
            "domain_knowledge": (
                "Deliberate practice research: short, focused sessions with clear intent beat "
                "rare long blocks for skill building — this mission keeps the dose achievable."
            ),
            "estimated_minutes": 20,
        }
        ins = supabase_admin.table("missions").insert(fallback).execute()
        return ins.data[0] if ins.data else fallback

    difficulty = mission_data.get("difficulty", "easy")
    xp_value = mission_xp_for_type("interest", difficulty)
    pf_value = MISSION_PF["interest"].get(difficulty, 8)

    mission_row = {
        "user_id": user_id,
        "type": "interest",
        "title": mission_data["title"],
        "difficulty": difficulty,
        "xp_value": xp_value,
        "pf_value": pf_value,
        "interest_id": interest["id"],
        "mission_date": mission_date,
        "completed": False,
        "rationale": mission_data.get("rationale", ""),
        "phase_principle": mission_data.get("phase_principle", ""),
        "domain_knowledge": mission_data.get("domain_knowledge_applied", ""),
        "estimated_minutes": mission_data.get("estimated_minutes", 20),
    }
    result = supabase_admin.table("missions").insert(mission_row).execute()
    return result.data[0] if result.data else mission_row


async def generate_all_interest_missions(user_id: str, mission_date: str) -> list[dict]:
    interests = (
        supabase_admin.table("interests")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )
    interest_rows = interests.data or []
    if not interest_rows:
        return []

    user_row = (
        supabase_admin.table("users")
        .select("character_stage, daily_hours_floor, archetype, timezone")
        .eq("id", user_id)
        .single()
        .execute()
    )
    dna_row = (
        supabase_admin.table("discipline_dna")
        .select("completion_rate_7d, mission_skip_pattern, peak_day")
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    user = user_row.data or {}
    discipline_dna = dna_row.data or {}

    generated: list[dict] = []
    for interest in interest_rows:
        try:
            mission = await generate_interest_mission(
                user_id=user_id,
                interest=interest,
                mission_date=mission_date,
                user=user,
                discipline_dna=discipline_dna,
            )
            if mission:
                generated.append(mission)
        except Exception as e:
            logger.error(
                json.dumps(
                    {
                        "event": "interest_mission_generation_error",
                        "user_id": user_id,
                        "interest_id": str(interest.get("id", "")),
                        "interest_name": str(interest.get("normalised_name", ""))[:50],
                        "error": str(e)[:200],
                    }
                )
            )
            continue
    return generated
