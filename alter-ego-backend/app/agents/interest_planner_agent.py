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
)
from app.core.supabase_client import supabase_admin
from app.services.mission_service import (
    isoweekday_for_mission_date,
    parse_interest_active_days,
)
from app.services.interest_guardrails import sanitize_planner_inputs

logger = logging.getLogger(__name__)

INTEREST_PLANNER_SYSTEM_PROMPT = """\
You are an expert coach for: {mission_domain}.

You have deep knowledge of what actually works at each stage of developing this skill —
grounded in research and established practice, not surface-level awareness.

═══ USER PROFILE ═══
Narrative seed (who this user is): {narrative_seed}
Execution gap (0=acts immediately, 1=struggles to start): {execution_gap}
Structure dependence (0=freeform, 1=needs explicit steps): {structure_dependence}
Discipline framing: {discipline_framing}

═══ INTEREST CONTEXT ═══
Interest: {mission_domain}
User's stated level: {level_text}
Level context: {level_context}
User's goal: {user_goal}
Target timeline: {timeline_label}

ARC POSITION:
  Total planned sessions: {total_planned_sessions}
  Sessions completed: {sessions_completed}
  Current arc phase: {current_arc_phase} ({arc_phase_label})
  Session {arc_phase_session} within this phase
  Overall progress: {progress_pct}% toward goal

Arc phase guide:
  Foundation (0–20% of sessions): Presence only. Show up, build habit. Simple repetition.
  Building (20–50%): Output. Produce something specific. Quality over quantity begins.
  Applying (50–80%): Refinement. Push slightly beyond current capability. Productive discomfort.
  Mastery (80–100%): Performance. Identity-level. Ship, teach, sustain.

═══ CONSTRAINTS ═══
Difficulty tier: {current_tier}
Available time: {available_minutes} minutes maximum
Day: {day_of_week}
Days in app: {days_in_app}

ANTI-REPETITION — last 7 missions for this interest (do NOT repeat any):
{last_7_missions}

═══ PROGRESSION GUARDRAIL (NON-NEGOTIABLE) ═══
NEVER assign a mission that requires skills the user hasn't developed yet in their arc.
If they are in Foundation phase, the mission MUST be a foundation-level exercise,
regardless of how ambitious their goal is.
The goal is the destination. The arc phase determines what the NEXT STEP is.
You are a patient tutor — not a drill sergeant racing the clock.

═══ STRUCTURE DEPENDENCE RULE ═══
If structure_dependence > 0.6: Include a specific routine or step sequence in the mission.
  Example: "Follow this 20-minute routine: 5 min X, 10 min Y, 5 min Z."
If structure_dependence < 0.4: Leave the approach open — specify the goal, not the method.
  Example: "Spend 20 minutes on {mission_domain} — pick what feels right today."

═══ FEW-SHOT EXAMPLES ═══

--- EXAMPLE 1: Beginner guitar, Foundation phase, day 5, medium tier ---
Thinking: Foundation phase = presence + habit. No songs yet. Finger coordination is the foundation.
Don't repeat chord drills (that was last session). Focus on one physical skill: finger placement.
Output:
{{"title": "Hold C, G, and D cleanly — 15-minute focus session",
  "difficulty": "medium",
  "estimated_minutes": 15,
  "rationale": "Foundation phase means building physical coordination, not songs. Clean chord shapes are the pre-requisite for everything else — spending 15 minutes here builds the muscle memory the rest of the arc depends on.",
  "arc_principle": "Foundation: presence and physical habit. One concrete skill per session.",
  "domain_knowledge_applied": "Motor skill acquisition research (Schmidt & Lee): massed practice on isolated movements in early stages builds faster automaticity than blocked practice on complex sequences. Clean individual chords before transitions.",
  "adjusted_tier": "medium"}}

--- EXAMPLE 2: Intermediate coding, Building phase, day 45, hard tier ---
Thinking: Building phase = output over presence. User can write code but needs project-level practice.
Last 7 missions were syntax and small exercises. Time to produce something complete.
Output:
{{"title": "Build a working to-do list with add, delete, and mark-complete in plain JavaScript",
  "difficulty": "hard",
  "estimated_minutes": 45,
  "rationale": "Building phase means producing functional outputs, not just drilling syntax. A complete mini-feature integrates multiple skills and reveals gaps that exercises miss — this is where intermediate coders plateau if they stay in drill mode.",
  "arc_principle": "Building: output. Produce something specific that works end-to-end.",
  "domain_knowledge_applied": "Project-based learning research: completing a working feature, even simple, builds problem decomposition skills that isolated exercises don't. The full loop (design → implement → test) is the skill.",
  "adjusted_tier": "hard"}}

--- EXAMPLE 3: Beginner pencil sketching, Foundation phase, day 12, aggressive timeline ---
Thinking: Foundation phase. User wants to draw realistic faces but that's weeks away.
Correct next step: basic proportions and line control, NOT face features yet.
Guardrail applies: NEVER assign face-drawing to a Foundation user.
Output:
{{"title": "Draw 10 straight lines and 10 curved lines, matching a reference — no erasing",
  "difficulty": "easy",
  "estimated_minutes": 15,
  "rationale": "Foundation phase — hand control before form. Realistic faces require clean, confident lines. Practicing controlled strokes without erasing builds the physical foundation that face-drawing depends on. This is the real prerequisite, not face proportions.",
  "arc_principle": "Foundation: physical control before complex form. Guardrail honored.",
  "domain_knowledge_applied": "Drawing skill acquisition (Edwards, 'Drawing on the Right Side of the Brain'): line quality and confidence is the first physical skill to train. Artists who skip this produce faces with shaky, hesitant lines regardless of proportion knowledge.",
  "adjusted_tier": "easy"}}

--- EXAMPLE 4: Advanced runner, Mastery phase, day 80, hard tier ---
Thinking: Mastery phase = performance, identity-level challenge. User has the habit.
Time to push toward a specific performance goal, not generic training.
Output:
{{"title": "Run 5km at a pace 15 seconds faster per km than your comfortable pace",
  "difficulty": "hard",
  "estimated_minutes": 35,
  "rationale": "Mastery phase means performance goals, not presence. A specific pace target creates measurable feedback — the user either hits it or learns exactly where their ceiling is. That information drives the next session.",
  "arc_principle": "Mastery: performance with measurable targets. Identity over habit.",
  "domain_knowledge_applied": "VO2 max training research: threshold runs at 85-90% of max pace improve aerobic capacity faster than comfortable-pace running. Deliberate discomfort for short durations is the most efficient training stimulus at advanced levels.",
  "adjusted_tier": "hard"}}

═══ YOUR TASK ═══
Step 1 — THINK (required): Reason through:
  a. What arc phase am I in? What does this phase demand?
  b. What specific skill would a real {mission_domain} practitioner say needs work right now?
  c. Does the last 7 missions reveal a gap or pattern I should address?
  d. What structure level does this user need?
  e. Does the guardrail apply? (Am I about to assign something beyond their arc phase?)

Step 2 — OUTPUT valid JSON only, no preamble, no markdown:
{{
  "thinking": "<your reasoning from Step 1, 3–5 sentences>",
  "title": "<specific actionable title, max 60 chars, starts with action verb>",
  "difficulty": "easy|medium|hard|elite",
  "estimated_minutes": 20,
  "rationale": "<why this mission for this domain at this level, 2–3 sentences>",
  "arc_principle": "<which arc phase principle this follows and why>",
  "domain_knowledge_applied": "<what research or expert practice shaped this mission, 2–3 sentences>",
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
    # Step 1 — active day check
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

    # Step 2 — idempotent check
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

    # Step 3 — last 7 missions (anti-repetition — increased from 5 to 7)
    last_missions_res = (
        supabase_admin.table("missions")
        .select("title, difficulty")
        .eq("user_id", user_id)
        .eq("interest_id", interest["id"])
        .eq("completed", True)
        .order("created_at", desc=True)
        .limit(7)
        .execute()
    )
    last_ratings_res = (
        supabase_admin.table("mission_ratings")
        .select("rating, feedback_text")
        .eq("user_id", user_id)
        .eq("interest_id", interest["id"])
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )

    raw_titles = [m.get("title") for m in (last_missions_res.data or []) if m.get("title")] or ["None yet"]
    last_7_missions = [
        str(t)[:80].strip().replace("{", "(").replace("}", ")") for t in raw_titles
    ] or ["None yet"]
    user_feedback = (
        " | ".join(
            [r.get("feedback_text") for r in (last_ratings_res.data or []) if r.get("feedback_text")]
        )
        or "No feedback yet"
    )

    # Step 4 — available minutes
    daily_minutes = int(float(user.get("daily_hours_floor", 1.0)) * 60)
    level_info = INTEREST_LEVEL_MAP.get(
        interest.get("level_text", "still_figuring_it_out"),
        INTEREST_LEVEL_MAP["still_figuring_it_out"],
    )
    available_minutes = min(level_info["max_minutes"], int(daily_minutes * 0.6))
    available_minutes = max(available_minutes, 10)

    # Step 5 — arc context from arc_service
    from app.services.arc_service import (
        ARC_PHASE_LABELS,
        compute_arc_phase,
        phase_progress_pct,
        phase_session_number,
    )

    total_planned = interest.get("total_planned_sessions")
    total_planned_int = int(total_planned) if total_planned else None
    sessions_done = int(interest.get("sessions_completed") or 0)

    current_arc_phase = str(
        interest.get("current_arc_phase") or compute_arc_phase(sessions_done, total_planned_int)
    )
    arc_phase_session = int(
        interest.get("arc_phase_session") or phase_session_number(sessions_done, total_planned_int)
    )
    progress_pct = round(phase_progress_pct(sessions_done, total_planned_int) * 100, 1)
    arc_phase_label = ARC_PHASE_LABELS.get(current_arc_phase, current_arc_phase.title())

    # Timeline label for prompt
    target_date_raw = interest.get("target_date")
    if target_date_raw:
        try:
            td = date.fromisoformat(str(target_date_raw))
            days_left = (td - mission_day).days
            timeline_label = f"Target: {td.strftime('%b %Y')} ({max(0, days_left)} days remaining)"
        except Exception:
            timeline_label = "No deadline"
    else:
        timeline_label = "No deadline"

    # Step 6 — narrative_seed + discipline_dna context
    narrative_seed = str(discipline_dna.get("narrative_seed") or "")[:300]
    execution_gap = float(discipline_dna.get("execution_gap") or 0.5)
    structure_dependence = float(discipline_dna.get("structure_dependence") or 0.5)
    discipline_framing = str(discipline_dna.get("discipline_framing") or "behavior")

    # Days in app
    from app.services.mission_service import get_days_since_registration

    days_in_app = max(
        0,
        int(
            get_days_since_registration(
                str(user.get("registration_date") or ""), str(user.get("timezone") or "UTC")
            )
        )
        - 1,
    )

    # Step 7 — sanitize inputs (existing guardrails)
    level_text, level_context = _level_context_for_interest(interest)

    (
        _clean_missions,
        user_feedback,
        interest_clean,
        level_context,
        level_text,
        current_tier,
        _archetype,
        _skip_pattern,
    ) = sanitize_planner_inputs(
        last_5_missions=last_7_missions[:5],
        user_feedback=user_feedback,
        interest=interest,
        level_context=level_context,
        level_text=level_text,
        current_tier=interest.get("current_difficulty_tier", "easy"),
        archetype=user.get("archetype", "structured_climber"),
        skip_pattern=discipline_dna.get("mission_skip_pattern") or "None detected",
    )

    prompt = INTEREST_PLANNER_SYSTEM_PROMPT.format(
        mission_domain=interest_clean.get("mission_domain")
        or interest_clean.get("normalised_name")
        or "this interest",
        narrative_seed=narrative_seed or "No profile data yet.",
        execution_gap=round(execution_gap, 2),
        structure_dependence=round(structure_dependence, 2),
        discipline_framing=discipline_framing,
        level_context=level_context,
        level_text=level_text,
        current_tier=current_tier,
        current_arc_phase=current_arc_phase,
        arc_phase_label=arc_phase_label,
        arc_phase_session=arc_phase_session,
        total_planned_sessions=total_planned_int or "No limit",
        sessions_completed=sessions_done,
        progress_pct=progress_pct,
        timeline_label=timeline_label,
        available_minutes=available_minutes,
        user_goal=interest_clean.get("user_goal") or "improve at this skill",
        last_7_missions=last_7_missions,
        day_of_week=mission_day.strftime("%A"),
        days_in_app=days_in_app,
    )

    # Step 8 — LLM call with self-verification
    mission_data = None
    try:
        llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.4,
            max_tokens=700,
            api_key=os.environ["OPENAI_API_KEY"],
        )
        response = await llm.ainvoke(
            [
                SystemMessage(content=prompt),
                HumanMessage(
                    content=f"Generate one mission for {interest_clean.get('normalised_name') or 'this interest'} today."
                ),
            ]
        )
        mission_data = _parse_json_response(str(response.content))

        # ── Self-verification (cheap check) ──────────────────────────────
        # Runs only if we got a valid response
        if mission_data and isinstance(mission_data, dict):
            title_check = str(mission_data.get("title", ""))
            last_titles_lower = [t.lower() for t in last_7_missions]
            title_lower = title_check.lower()

            # Check 1: Is it a repeat? (fuzzy: 60% overlap in words)
            is_repeat = False
            if title_lower not in ["none yet", ""]:
                title_words = set(title_lower.split())
                for prev in last_titles_lower:
                    prev_words = set(prev.split())
                    if prev_words and len(title_words & prev_words) / max(len(title_words), 1) > 0.6:
                        is_repeat = True
                        break

            # Check 2: Is it generic?
            is_generic = len(title_check) < 15 or (
                title_check.lower().startswith("practice ") and len(title_check) < 30
            )

            if is_repeat or is_generic:
                # Regenerate once with explicit anti-repetition instruction
                regen_response = await llm.ainvoke(
                    [
                        SystemMessage(content=prompt),
                        HumanMessage(
                            content=(
                                f"The previous mission '{title_check}' "
                                f"{'repeats a recent mission' if is_repeat else 'is too generic'}. "
                                f"Generate a DIFFERENT mission for {interest_clean.get('normalised_name') or 'this interest'} "
                                f"that is substantially different in approach and specificity."
                            )
                        ),
                    ]
                )
                regen_data = _parse_json_response(str(regen_response.content))
                if regen_data and isinstance(regen_data, dict) and regen_data.get("title"):
                    mission_data = regen_data  # Use regenerated version

    except Exception:
        pass

    # Step 9 — fallback if both LLM attempts failed
    if not mission_data or not isinstance(mission_data, dict):
        difficulty_fb = interest.get("current_difficulty_tier", "easy")
        safe_name = interest.get("normalised_name") or "this skill"
        fallback = {
            "user_id": user_id,
            "type": "interest",
            "title": f"Spend 20 minutes on {safe_name}",
            "difficulty": difficulty_fb,
            "xp_value": mission_xp_for_type("interest", difficulty_fb),
            "pf_value": MISSION_PF["interest"].get(difficulty_fb, 8),
            "interest_id": interest["id"],
            "mission_date": mission_date,
            "completed": False,
            "stat_tag": resolve_stat_tag(None, "interest"),
            "rationale": "Consistent presence builds the habit foundation.",
            "domain_knowledge": "Deliberate practice: short focused sessions beat rare long blocks for skill building.",
            "estimated_minutes": 20,
        }
        ins = supabase_admin.table("missions").insert(fallback).execute()
        return ins.data[0] if ins.data else fallback

    # Step 10 — sanitize and insert
    title = str(mission_data.get("title", ""))[:80].strip().replace("{", "(").replace("}", ")")
    if not title or len(title) < 5:
        title = f"Practice {interest.get('normalised_name', 'this skill')} today"

    valid_difficulties = {"easy", "medium", "hard", "elite"}
    difficulty = mission_data.get("difficulty", "easy")
    if difficulty not in valid_difficulties:
        difficulty = "easy"

    try:
        mins = int(mission_data.get("estimated_minutes", 20))
        mins = max(5, min(120, mins))
    except (ValueError, TypeError):
        mins = 20

    xp_value = mission_xp_for_type("interest", difficulty)
    pf_value = MISSION_PF["interest"].get(difficulty, 8)

    mission_row = {
        "user_id": user_id,
        "type": "interest",
        "title": title,
        "difficulty": difficulty,
        "xp_value": xp_value,
        "pf_value": pf_value,
        "interest_id": interest["id"],
        "mission_date": mission_date,
        "completed": False,
        "rationale": str(mission_data.get("rationale", ""))[:300],
        "phase_principle": str(mission_data.get("arc_principle", ""))[:200],
        "domain_knowledge": str(mission_data.get("domain_knowledge_applied", ""))[:500],
        "estimated_minutes": mins,
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
        .select("character_stage, daily_hours_floor, archetype, timezone, registration_date")
        .eq("id", user_id)
        .single()
        .execute()
    )
    dna_row = (
        supabase_admin.table("discipline_dna")
        .select(
            "completion_rate_7d, mission_skip_pattern, peak_day, narrative_seed, "
            "execution_gap, structure_dependence, discipline_framing"
        )
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    user = user_row.data or {}
    discipline_dna = dna_row.data or {}

    generated: list[dict] = []
    for interest in interest_rows:
        if interest.get("arc_paused"):
            continue
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
