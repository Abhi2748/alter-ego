from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone, date
from zoneinfo import ZoneInfo

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from app.core.constants import INTEREST_LEVEL_MAP, MISSION_PF, MISSION_XP, STAGE_NAMES
from app.core.supabase_client import supabase_admin
from app.services.mission_service import (
    get_user_date,
    isoweekday_for_mission_date,
    parse_interest_active_days,
)


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
  "domain_knowledge_applied": "The specific knowledge about this domain used to design this mission",
  "adjusted_tier": "easy|medium|hard|elite"
}}
"""


QUIT_PLANNER_SYSTEM_PROMPT = """
You are a behaviour change and habit science expert specialising in 
the specific habit pattern: {quit_target_name}.

You understand the psychology behind this habit at a deep level — 
why it forms, what need it serves, and what replacement strategies 
actually work based on research.

DOMAIN KNOWLEDGE FOR THIS HABIT:
{evidence_base}

UNDERLYING NEED THIS HABIT SERVES:
Primary need category: {need_category}
Reasoning: {need_reasoning}

REPLACEMENT DIRECTIONS FOR THIS NEED:
{replacement_directions}

USER CONTEXT:
→ Their description of the habit: {user_description}
→ Their known trigger: {trigger_text}
→ When the urge typically hits: {urge_timing}
→ Clean days so far: {clean_days}
→ Days since last slip: {days_since_slip}
→ Current phase: {current_phase}
→ Available time: {available_minutes} minutes
→ Archetype: {archetype}
→ Completion rate last 10 days: {completion_rate}%
→ Last 5 missions for this quit target: {last_5_missions}
→ Last 5 ratings: {last_5_ratings}
→ User feedback: {user_feedback}

PHASE FRAMEWORK — match the mission to the phase:
→ days_1_10 (Awareness): Notice the urge pattern. One small replacement 
  when the urge hits. Build the habit of noticing before acting.
→ days_11_30 (Replacement): Consistent replacement practice — daily, 
  not just when the urge hits. The new behaviour becomes a routine.
→ days_31_60 (Environmental design): Restructure the conditions that 
  make the habit easy. Remove cues. Add friction to the old path.
  Delete apps. Rearrange the physical environment.
→ days_61_90 (Identity): The user starts to identify as someone who 
  does not do this. Missions reinforce the new identity through action.
→ days_90_plus (Consolidation): Identity is set. Help someone else.
  Document what changed. The mission is about who they've become.

DIFFICULTY FOR QUIT TARGETS:
→ easy: Single awareness or substitution action, 5-15 min.
  "When the urge hits, do X once."
→ medium: Consistent replacement practice, 15-30 min.
  "Before [trigger time], prepare [replacement]."
→ hard: Environmental restructuring. Change conditions.
  "Remove [cue] from [context] today."
→ elite: Identity statement or public commitment.
  Full day commitment or teaching someone else.

SPECIAL RULE — SLIP RECOVERY:
If days_since_slip is 0 or 1 (very recent slip):
  Generate a compassionate restart mission only.
  Focus entirely on the next small step, not the slip.
  Never reference failure. Frame entirely around beginning again.
  Example: "Set one clear intention for the next 3 hours."

MISSION MUST:
1. Be a POSITIVE action — never "don't do X", "avoid X", "resist X"
2. Address the underlying need: {need_category}
3. Be specific about WHEN: "when the urge hits at {urge_timing}" 
   is better than "when you feel the urge"
4. Be completable in under {available_minutes} minutes
5. NOT repeat any of: {last_5_missions}
6. Serve as a genuine replacement that addresses the need

MISSION MUST NOT:
- Mention the habit negatively in the title
- Use words like "resist", "avoid", "don't", "stop", "quit" in the title
- Be generic: "be mindful today" is not acceptable
- Require willpower alone — replacement behaviour is the mechanism

OUTPUT — return ONLY valid JSON, no preamble, no markdown:
{{
  "title": "Positive action mission (max 60 chars, starts with action verb)",
  "difficulty": "easy|medium|hard|elite",
  "estimated_minutes": 15,
  "when_to_do": "Specific timing — when in the day or relative to urge",
  "rationale": "Why this replacement works for this need category. Reference the behaviour change mechanism. 2-3 sentences.",
  "phase_principle": "Which phase principle this follows",
  "need_addressed": "How this mission addresses the underlying need"
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

    prompt = INTEREST_PLANNER_SYSTEM_PROMPT.format(
        mission_domain=interest.get("mission_domain") or interest.get("normalised_name") or "this interest",
        evidence_base=interest.get("evidence_base") or "Apply deliberate practice principles.",
        level_context=level_context,
        level_text=level_text,
        current_tier=interest.get("current_difficulty_tier", "easy"),
        current_phase=interest.get("current_phase", "days_1_10"),
        available_minutes=available_minutes,
        user_goal=interest.get("user_goal") or "improve at this skill",
        interest_level=interest.get("interest_level", 1),
        character_stage=character_stage,
        stage_name=stage_name,
        archetype=user.get("archetype", "structured_climber"),
        completion_rate=round(float(discipline_dna.get("completion_rate_7d", 0) or 0), 1),
        last_5_missions=last_5_missions,
        last_5_ratings=last_5_ratings,
        user_feedback=user_feedback,
        skip_pattern=discipline_dna.get("mission_skip_pattern") or "None detected",
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
                HumanMessage(content=f"Generate one mission for {interest.get('normalised_name', 'this interest')} today."),
            ]
        )
        mission_data = _parse_json_response(str(response.content))
    except Exception:
        # Step 8 — fallback mission so the day isn't broken
        difficulty = interest.get("current_difficulty_tier", "easy")
        fallback = {
            "user_id": user_id,
            "type": "interest",
            "title": f"Spend 20 minutes on {interest.get('normalised_name', 'this interest')}",
            "difficulty": difficulty,
            "xp_value": MISSION_XP.get(difficulty, 10),
            "pf_value": MISSION_PF["interest"].get(difficulty, 8),
            "interest_id": interest["id"],
            "mission_date": mission_date,
            "completed": False,
            "rationale": "Consistent presence builds the habit foundation.",
            "estimated_minutes": 20,
        }
        ins = supabase_admin.table("missions").insert(fallback).execute()
        return ins.data[0] if ins.data else fallback

    difficulty = mission_data.get("difficulty", "easy")
    xp_value = MISSION_XP.get(difficulty, 10)
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
        mission = await generate_interest_mission(
            user_id=user_id,
            interest=interest,
            mission_date=mission_date,
            user=user,
            discipline_dna=discipline_dna,
        )
        if mission:
            generated.append(mission)
    return generated


async def generate_quit_target_mission(
    user_id: str,
    quit_target: dict,
    mission_date: str,
    user: dict,
    discipline_dna: dict,
) -> dict | None:
    # Step 1 — idempotent existing check
    existing = (
        supabase_admin.table("missions")
        .select("*")
        .eq("user_id", user_id)
        .eq("quit_target_id", quit_target["id"])
        .eq("mission_date", mission_date)
        .execute()
    )
    if existing.data:
        return existing.data[0]

    # Step 2 — last 5 missions + ratings
    last_missions = (
        supabase_admin.table("missions")
        .select("title, difficulty")
        .eq("user_id", user_id)
        .eq("quit_target_id", quit_target["id"])
        .eq("completed", True)
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )
    last_ratings = (
        supabase_admin.table("mission_ratings")
        .select("rating, feedback_text")
        .eq("user_id", user_id)
        .eq("quit_target_id", quit_target["id"])
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )

    last_5_missions = [m.get("title") for m in (last_missions.data or []) if m.get("title")] or ["None yet"]
    last_5_ratings = [r.get("rating") for r in (last_ratings.data or []) if r.get("rating") is not None] or ["None yet"]
    user_feedback = " | ".join([r.get("feedback_text") for r in (last_ratings.data or []) if r.get("feedback_text")]) or "No feedback yet"

    # Step 3 — days since slip
    days_since_slip = None
    if quit_target.get("last_slip_date"):
        try:
            slip_date = date.fromisoformat(str(quit_target["last_slip_date"]))
            try:
                user_today = date.fromisoformat(
                    get_user_date(str(user.get("timezone") or "UTC"))
                )
            except Exception:
                user_today = date.today()
            days_since_slip = (user_today - slip_date).days
        except Exception:
            days_since_slip = None

    # Step 4 — available minutes (0.3 of daily time floor)
    available_minutes = min(45, max(10, int(float(user.get("daily_hours_floor", 1.0)) * 60 * 0.3)))

    # Build prompt with best-available fields
    evidence_base = quit_target.get("evidence_base") or "Use cue-routine-reward replacement and reduce friction for the new path."
    need_category = quit_target.get("need_category") or "boredom_dopamine"
    need_reasoning = quit_target.get("need_reasoning") or "Not provided."
    replacement_directions = quit_target.get("replacement_directions") or []
    if isinstance(replacement_directions, list):
        replacement_directions_str = "\n".join([f"- {x}" for x in replacement_directions]) or "- None provided"
    else:
        replacement_directions_str = str(replacement_directions)

    prompt = QUIT_PLANNER_SYSTEM_PROMPT.format(
        quit_target_name=quit_target.get("normalised_name") or quit_target.get("raw_text") or "this habit pattern",
        evidence_base=evidence_base,
        need_category=need_category,
        need_reasoning=need_reasoning,
        replacement_directions=replacement_directions_str,
        user_description=quit_target.get("user_description") or "None provided",
        trigger_text=quit_target.get("trigger_text") or "None provided",
        urge_timing=quit_target.get("urge_timing") or "None provided",
        clean_days=quit_target.get("clean_days", 0),
        days_since_slip=days_since_slip if days_since_slip is not None else "Unknown",
        current_phase=quit_target.get("current_phase", "days_1_10"),
        available_minutes=available_minutes,
        archetype=user.get("archetype", "structured_climber"),
        completion_rate=round(float(discipline_dna.get("completion_rate_7d", 0) or 0), 1),
        last_5_missions=last_5_missions,
        last_5_ratings=last_5_ratings,
        user_feedback=user_feedback,
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
                HumanMessage(content=f"Generate one replacement mission for {quit_target.get('normalised_name', 'this habit')} today."),
            ]
        )
        mission_data = _parse_json_response(str(response.content))
    except Exception:
        fallback_title = "Drink a glass of water when the urge hits today"
        if quit_target.get("urge_timing"):
            fallback_title = f"Take 3 deep breaths at {quit_target['urge_timing']}"
        fallback = {
            "user_id": user_id,
            "type": "resistance",
            "title": fallback_title,
            "difficulty": "easy",
            "xp_value": MISSION_XP["easy"],
            "pf_value": MISSION_PF["resistance"]["easy"],
            "quit_target_id": quit_target["id"],
            "mission_date": mission_date,
            "completed": False,
            "rationale": "Physical replacement interrupts the habit loop at the moment of urge.",
            "estimated_minutes": 5,
        }
        ins = supabase_admin.table("missions").insert(fallback).execute()
        return ins.data[0] if ins.data else fallback

    difficulty = mission_data.get("difficulty", "easy")
    mission_row = {
        "user_id": user_id,
        "type": "resistance",
        "title": mission_data["title"],
        "difficulty": difficulty,
        "xp_value": MISSION_XP.get(difficulty, 10),
        "pf_value": MISSION_PF["resistance"].get(difficulty, 8),
        "quit_target_id": quit_target["id"],
        "mission_date": mission_date,
        "completed": False,
        "rationale": mission_data.get("rationale", ""),
        "phase_principle": mission_data.get("phase_principle", ""),
        "domain_knowledge": mission_data.get("need_addressed", ""),
        "estimated_minutes": mission_data.get("estimated_minutes", 15),
    }
    result = supabase_admin.table("missions").insert(mission_row).execute()
    return result.data[0] if result.data else mission_row


async def generate_all_quit_target_missions(user_id: str, mission_date: str) -> list[dict]:
    quit_targets = (
        supabase_admin.table("quit_targets")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .eq("conquered", False)
        .execute()
    )
    qt_rows = quit_targets.data or []
    if not qt_rows:
        return []

    user_row = (
        supabase_admin.table("users")
        .select("daily_hours_floor, archetype, timezone")
        .eq("id", user_id)
        .single()
        .execute()
    )
    dna_row = (
        supabase_admin.table("discipline_dna")
        .select("completion_rate_7d")
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    user = user_row.data or {}
    discipline_dna = dna_row.data or {}

    generated: list[dict] = []
    for qt in qt_rows:
        mission = await generate_quit_target_mission(
            user_id=user_id,
            quit_target=qt,
            mission_date=mission_date,
            user=user,
            discipline_dna=discipline_dna,
        )
        if mission:
            generated.append(mission)
    return generated

