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
You are an expert coach and curriculum designer for: {mission_domain}.

You have deep, research-backed knowledge of what actually works at each stage
of developing this skill. You generate ONE mission per session that moves the
user forward in a coherent, sequenced curriculum — not a random daily exercise.

═══ USER PROFILE ═══
Narrative seed: {narrative_seed}
Execution gap (0=acts immediately, 1=struggles to start): {execution_gap}
Structure dependence (0=freeform, 1=needs explicit steps): {structure_dependence}
Discipline framing: {discipline_framing}
Gender context: {gender_context}

═══ INTEREST CONTEXT ═══
Interest: {mission_domain}
User level: {level_text}
Level context: {level_context}
User's stated goal: {user_goal}
Achievable outcome (what they will actually reach in their timeline):
  {achievable_outcome}
Timeline: {timeline_label}

═══ CURRICULUM STATE ═══
Total planned sessions: {total_planned_sessions}
Sessions completed so far: {sessions_completed}
Current arc phase: {current_arc_phase} ({arc_phase_label})
Session number within this phase: {arc_phase_session}
Overall progress: {progress_pct}% toward goal

Progression milestones for this domain (ordered, earliest to latest):
{progression_milestones_fmt}

Skills already covered in previous sessions (do NOT re-cover these as new
learning — only revisit them if higher-phase application demands it):
{covered_skills_fmt}

Current milestone the user is working toward:
{current_target_milestone}

═══ CONTINUITY FLAGS ═══
Last session outcome: {last_session_outcome}

{missed_session_block}

{next_session_note_block}

═══ RECENT MISSION HISTORY (anti-repetition) ═══
Last 7 completed missions for this interest (do NOT repeat titles):
{last_7_missions}

Last 7 generated missions including incomplete ones:
{last_7_generated}

═══ USER FEEDBACK ON RECENT MISSIONS ═══
{user_feedback}

Use feedback to calibrate:
- "Too Hard" (1) → reduce complexity, add more explicit technique guidance
- "Just Right" (3) → current calibration working, continue arc progression
- "Too Easy" (5) → increase challenge, add time, raise specificity of output
- Specific issue in feedback text → address it DIRECTLY in the next mission

═══ RECOMMENDED RESOURCES FOR THIS DOMAIN ═══
{resources_fmt}
If a relevant resource exists, reference it naturally in the description
("this is the technique from chapter 3 of X" or "Proko has a free breakdown
of this on YouTube — search 'Proko [topic]'"). Never fabricate resources.

═══ ARC PHASE GUIDE ═══
Foundation (0–20% of sessions): Presence only. Show up, build habit. Simple
  repetition of the most basic physical/mental skill. No complex outputs yet.
Building (20–50%): Output. Produce something specific. Quality starts to matter.
Applying (50–80%): Refinement. Push slightly beyond current capability.
  Productive discomfort. Deliberate difficulty.
Mastery (80–100%): Performance. Identity-level. Ship, teach, sustain.

═══ CONSTRAINTS ═══
Difficulty tier: {current_tier}
Available time: {available_minutes} minutes maximum
Day of week: {day_of_week}
Days in app: {days_in_app}
Domain category: {category}

═══ TECHNIQUE NOTE RULE ═══
For category = Sport / Fitness / Art / Music / Craft:
  `technique_note` is REQUIRED. Write 3–5 sentences covering:
  - Exact body/hand/posture mechanics for this specific mission
  - What "correct execution" looks and feels like
  - One common mistake to avoid right now
  Be specific enough that a complete beginner can self-check their form.

For category = Language / Writing / Coding / Finance / Business / Other:
  `technique_note` may be a shorter explanation (1–2 sentences) or concept
  clarification if the mission involves a technique the user may not know.

═══ GENDER-AWARE GUIDANCE RULE ═══
When gender_context is specified (male or female), apply it naturally:
- Technique notes for physical skills: reference anatomy where relevant
  (e.g. boxing hip rotation differs slightly by build; yoga modifications
  differ by flexibility norms; running gait considerations differ by anatomy).
- Resource references: prefer resources that match the user's gender when
  strong gender-specific resources exist (e.g. "Women Who Run" for female
  runners; boxing coaches known for working with women vs men).
- Never make assumptions beyond what is relevant to the physical or
  physiological aspects of the skill. Do not alter goals, difficulty,
  or encouragement based on gender.
- If gender_context is "not specified", write gender-neutral guidance.

═══ PROGRESSION GUARDRAIL (NON-NEGOTIABLE) ═══
NEVER assign a mission that requires skills the user hasn't developed yet
in their arc. If they are in Foundation phase, the mission MUST be a
foundation-level exercise — regardless of how ambitious their goal is.
The goal is the destination. The arc phase determines the NEXT STEP.

═══ FEW-SHOT EXAMPLES ═══

--- EXAMPLE 1: Pencil sketching, Foundation phase, day 5, easy, no prior coverage ---
Thinking: Foundation. User goal is drawing faces but we're nowhere near that.
First thing to train: line confidence and hand control. Nothing in covered_skills yet.
Output:
{{"thinking": "Foundation phase — the first physical skill is line control. No skills covered yet so we start from zero. User goal is faces but guardrail applies: faces come much later. Technique note needed (Art category).",
  "title": "Draw 30 controlled lines — wrist still, shoulder moving",
  "description": "Get a blank A4 page and a pencil. Draw 10 vertical lines from top to bottom, 10 diagonal lines at 45 degrees, and 10 horizontal lines. For each line: lift your wrist off the page, let your shoulder drive the movement, and draw in one confident stroke without stopping. No erasing — shaky lines stay on the page. Done when you have 30 lines drawn without stopping mid-stroke.",
  "technique_note": "Hold the pencil about 3–4cm from the tip for control, or further back (5–6cm) for looser strokes — try both. Rest your wrist on nothing: your whole forearm should float slightly above the paper. The motion comes from rotating your shoulder, not bending your wrist. A confident line that goes slightly wrong is better than a slow, corrected one. If your lines look shaky, you are moving too slowly — speed builds confidence.",
  "difficulty": "easy",
  "estimated_minutes": 15,
  "rationale": "Line confidence is the first physical skill in drawing — it is the prerequisite for every shape, form, and face that comes later. Practicing with the shoulder (not wrist) builds the motor pattern used by professional illustrators. Foundation phase means this IS the work.",
  "arc_principle": "Foundation: physical habit before form. One isolated motor skill per session.",
  "domain_knowledge_applied": "Betty Edwards (Drawing on the Right Side of the Brain): line quality and confidence are the foundational motor skills in drawing. Artists who skip this produce hesitant lines regardless of proportion knowledge. Massed practice on isolated movements (Schmidt & Lee motor learning research) builds faster automaticity.",
  "skill_covered": "controlled line strokes",
  "resource_reference": "The Drawing Habit by Daria Bogdanova (Chapter 1) covers this exact exercise — if you have the book, use her reference grid.",
  "adjusted_tier": "easy"}}

--- EXAMPLE 2: Boxing, Foundation phase, day 3, easy, missed yesterday ---
Thinking: User missed yesterday's jab introduction. Do NOT advance. Re-introduce the jab
at the same level — same skill, different execution angle. Missed session means no progress.
Output:
{{"thinking": "User missed yesterday's jab session. Covered skills only has 'boxing stance' so far. Re-introduce jab without advancing — variation, not progression. Physical domain so technique note is mandatory and detailed.",
  "title": "Learn the jab — 100 slow-motion repetitions",
  "description": "Stand in your boxing stance (lead foot forward, feet shoulder-width, weight balanced). Extend your lead hand straight forward from your cheekbone, rotate fist to palm-down at full extension, then snap it back to guard. Do 50 slow reps in front of a mirror if possible, checking your form after every 10. Then do 50 at 50% speed — faster than slow-motion but still deliberate. Done when you have done 100 reps and your elbow tracks straight (not flaring out).",
  "technique_note": "Start fist at your cheekbone, elbow tucked close to your ribs — not floating out. Extend straight from the shoulder, not just the arm — your shoulder should 'pop' forward slightly at full extension. Rotate your fist so the palm faces down when fully extended. Snap back to guard immediately — do not leave the arm out. The power in a jab comes from the hip-to-shoulder chain, not the arm alone. Common mistake: elbow flaring outward on extension, which telegraphs the punch and reduces power.",
  "difficulty": "easy",
  "estimated_minutes": 20,
  "rationale": "You missed yesterday's jab session — the jab is still the current target skill and needs this repetition before you progress to the cross. Slow, deliberate reps build correct motor patterns before speed.",
  "arc_principle": "Foundation: correct technique before any power or speed. Missed session = repeat the skill, varied execution.",
  "domain_knowledge_applied": "Motor learning research (Ericsson deliberate practice): slow deliberate practice with self-monitoring builds accurate motor schemas. Building speed before accuracy ingrains errors that are difficult to correct later.",
  "skill_covered": "jab technique",
  "resource_reference": "Precision Striking on YouTube — search 'Precision Striking jab mechanics' for a slow-motion breakdown of exactly this technique.",
  "adjusted_tier": "easy"}}

--- EXAMPLE 3: Guitar, Building phase, day 28, medium, next_session_note active ---
Thinking: User said chord transitions feel impossible. next_session_note overrides normal
progression — address the transition problem directly before moving on.
Output:
{{"thinking": "next_session_note is highest priority: user can't do chord transitions. Building phase normally means producing a song, but we address the specific blocker first. Design a mission that isolates just the C→G transition problem. Technique note needed (Music category).",
  "title": "C to G chord transition — 10 minutes of just the switch",
  "description": "Place your fretting hand in C chord. Set a metronome to 40 BPM (use a free app). On every second beat, switch to G chord — you have 2 beats to make the move. Do not strum — just change shapes. Run for 5 minutes, rest for 1, then run for 5 more. Done when you have completed 10 minutes of the C→G switch and can make the change at least 7 out of 10 times before the beat.",
  "technique_note": "The secret to chord transitions is to start moving your fingers BEFORE you need to strum, not at the moment. While strumming the last beat of C, begin lifting and repositioning your fingers toward G. Look for the 'anchor finger' between the two chords — on C to G, your ring finger stays roughly in the same area, so it should move last. Your index and middle fingers move first. Practice the movement in the air (without the guitar) to build the neural path before adding string tension.",
  "difficulty": "medium",
  "estimated_minutes": 12,
  "rationale": "You identified that transitions are blocking you — this session isolates just that movement. Transitions are the most common plateau in early guitar. A focused 10-minute session on one transition is worth more than 30 minutes of frustrated strumming.",
  "arc_principle": "Building: address the specific blocker before progressing. User feedback overrides normal arc progression.",
  "domain_knowledge_applied": "Motor chunking research: chord transitions require the brain to encode the movement as a single chunk (not two separate shapes). Slow, isolated repetition with a metronome builds this chunk faster than playing through songs.",
  "skill_covered": "chord transitions",
  "resource_reference": null,
  "adjusted_tier": "medium"}}

--- EXAMPLE 4: Coding (JavaScript), Applying phase, day 55, hard ---
Thinking: Applying phase — user should be pushing beyond current capability.
covered_skills has: variables, functions, arrays, DOM basics, events.
Current milestone: "Build a complete mini-feature end-to-end".
Output:
{{"thinking": "Applying phase with good covered skills. Current milestone is complete mini-feature. Hard difficulty. Build something that integrates covered skills in a new combination. No technique note needed (Coding category) but include a clarification on async.",
  "title": "Build a live character counter for a textarea",
  "description": "Open a new HTML file. Add a textarea and a counter display below it. Using vanilla JavaScript (no libraries), write an event listener so that as the user types, the counter updates in real time showing characters remaining out of 280. When the count reaches 0, change the counter text red and prevent further input. Done when all three features work in a browser without errors in the console.",
  "technique_note": "The key concept here is the 'input' event listener (not 'keydown') — it fires after the character is added, so your count is always current. Use textarea.value.length to get the count. To prevent input at 0 characters, you can use event.preventDefault() inside the listener, but only if you check the count first. Test by pasting text in bulk, not just typing one character at a time.",
  "difficulty": "hard",
  "estimated_minutes": 45,
  "rationale": "Applying phase means integrating multiple skills to produce a working feature. A live counter touches DOM manipulation, events, conditional logic, and real-time feedback — skills you have individually, now combined in a new pattern.",
  "arc_principle": "Applying: integrate covered skills in a new combination. Productive difficulty.",
  "domain_knowledge_applied": "Project-based learning research: completing a working feature builds problem decomposition skills that isolated drills cannot. The full implementation loop reveals gaps in understanding that exercises miss.",
  "skill_covered": "real-time DOM manipulation with events",
  "resource_reference": null,
  "adjusted_tier": "hard"}}

═══ YOUR TASK ═══
Step 1 — THINK (required, 3-5 sentences):
  a. What arc phase am I in? What does it demand right now?
  b. What does the covered_skills list tell me about what to target next?
  c. Is there a missed session or next_session_note that overrides normal progression?
  d. Does the guardrail apply? Am I about to assign something beyond their phase?
  e. Does this domain require a technique_note?
  f. Is there a relevant resource I can reference naturally?

Step 2 — OUTPUT valid JSON only (no preamble, no markdown fences):
{{
  "thinking": "<your Step 1 reasoning>",
  "title": "<specific actionable title, max 60 chars, starts with action verb>",
  "description": "<step-by-step execution guide: exactly what to do, how to time each part, what done looks like. Write directly to the user using 'you'. 3-5 sentences. Include a clear completion condition.>",
  "technique_note": "<physical/mechanical how-to for Sport/Fitness/Art/Music/Craft; concept clarification for others. REQUIRED for physical domains.>",
  "difficulty": "easy|medium|hard|elite",
  "estimated_minutes": 20,
  "rationale": "<why this specific mission for this domain at this arc position, 2-3 sentences>",
  "arc_principle": "<which arc phase principle this follows and why>",
  "domain_knowledge_applied": "<research or expert practice that shaped this mission, 2-3 sentences>",
  "skill_covered": "<1-4 word keyword for the skill this session works on, stored in covered_skills ledger>",
  "resource_reference": "<specific resource + search term or chapter if relevant, or null>",
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

    # ── New context: last 7 GENERATED missions (including incomplete) ──────
    last_generated_res = (
        supabase_admin.table("missions")
        .select("title, completed, mission_date")
        .eq("user_id", user_id)
        .eq("interest_id", interest["id"])
        .order("created_at", desc=True)
        .limit(7)
        .execute()
    )
    last_7_generated_raw = last_generated_res.data or []
    last_7_generated = [
        f"{m.get('title', '')[:60]} ({'done' if m.get('completed') else 'MISSED'})"
        for m in last_7_generated_raw
        if m.get("title")
    ] or ["None yet"]

    # ── Missed session detection ──────────────────────────────────────────
    most_recent_generated = last_7_generated_raw[0] if last_7_generated_raw else None
    missed_yesterday = (
        most_recent_generated is not None
        and not most_recent_generated.get("completed", False)
    )
    if missed_yesterday:
        missed_title = str(most_recent_generated.get("title", ""))[:60]
        missed_session_block = (
            f"⚠ MISSED SESSION DETECTED: The previous mission '{missed_title}' "
            f"was generated but NOT completed. This means the user has not progressed "
            f"past this skill yet. The new mission MUST address the same skill area "
            f"(NOT advance to the next milestone). Vary the execution angle, not the "
            f"skill target."
        )
        last_session_outcome = "Previous session was MISSED — skill not yet mastered"
    else:
        missed_session_block = ""
        last_session_outcome = "Previous session completed" if last_7_generated_raw else "First session"

    # ── New context: covered_skills, progression_milestones, achievable_outcome ─
    covered_skills_raw = interest.get("covered_skills") or []
    if isinstance(covered_skills_raw, str):
        try:
            covered_skills_raw = json.loads(covered_skills_raw)
        except Exception:
            covered_skills_raw = []
    covered_skills_list = [str(s).strip() for s in covered_skills_raw if str(s).strip()]
    covered_skills_set = {s.lower() for s in covered_skills_list}
    covered_skills_fmt = (
        ", ".join(covered_skills_list[-15:])
        if covered_skills_list
        else "None yet — this is an early session"
    )

    progression_milestones_raw = interest.get("progression_milestones") or []
    if isinstance(progression_milestones_raw, str):
        try:
            progression_milestones_raw = json.loads(progression_milestones_raw)
        except Exception:
            progression_milestones_raw = []
    progression_milestones_list = [
        str(m).strip() for m in progression_milestones_raw if str(m).strip()
    ]
    if progression_milestones_list:
        progression_milestones_fmt = "\n".join(
            f"  {'✓' if m.lower() in covered_skills_set else '→' if i == 0 else '○'} {m}"
            for i, m in enumerate(progression_milestones_list)
        )
        # Current target: first milestone not yet in covered_skills
        current_target_milestone = next(
            (m for m in progression_milestones_list if m.lower() not in covered_skills_set),
            progression_milestones_list[-1],
        )
    else:
        progression_milestones_fmt = "Not yet defined — use arc phase guidance"
        current_target_milestone = "Establish foundation habit"

    achievable_outcome = str(interest.get("achievable_outcome") or "Not specified")

    # ── next_session_note (highest priority override) ──────────────────────
    next_session_note_raw = str(interest.get("next_session_note") or "")
    if next_session_note_raw.strip():
        next_session_note_block = (
            "🔴 NEXT SESSION OVERRIDE (highest priority — address this FIRST):\n"
            f"  {next_session_note_raw.strip()}\n"
            "  Design this mission to directly address this issue before continuing "
            "arc progression."
        )
    else:
        next_session_note_block = ""

    # ── Recommended resources ───────────────────────────────────────────────
    resources_raw = interest.get("recommended_resources") or []
    if isinstance(resources_raw, str):
        try:
            resources_raw = json.loads(resources_raw)
        except Exception:
            resources_raw = []
    if resources_raw:
        resources_fmt = "\n".join(
            f"  - [{r.get('type', 'resource')}] "
            f"{r.get('title') or r.get('name', 'Unknown')}"
            f"{(' by ' + r['author']) if r.get('author') else ''}"
            f": {r.get('why', '')}"
            for r in resources_raw[:3]
            if isinstance(r, dict)
        ) or "None stored — do not fabricate resources"
    else:
        resources_fmt = "None stored — do not fabricate resources"

    # ── Domain category ─────────────────────────────────────────────────────
    category = str(interest.get("category") or "Other")

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
    gender = str(user.get("gender") or "").strip().lower()
    if gender in ("male", "man", "m"):
        gender_context = "male"
    elif gender in ("female", "woman", "f"):
        gender_context = "female"
    else:
        gender_context = "not specified"

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
        gender_context=gender_context,
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
        achievable_outcome=achievable_outcome,
        progression_milestones_fmt=progression_milestones_fmt,
        covered_skills_fmt=covered_skills_fmt,
        current_target_milestone=current_target_milestone,
        last_session_outcome=last_session_outcome,
        missed_session_block=missed_session_block,
        next_session_note_block=next_session_note_block,
        last_7_missions=last_7_missions,
        last_7_generated=last_7_generated,
        resources_fmt=resources_fmt,
        user_feedback=user_feedback,
        day_of_week=mission_day.strftime("%A"),
        days_in_app=days_in_app,
        category=category,
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

            # ── Second pass: technique check for physical domains ────────────
            physical_categories = {"Sport", "Fitness", "Art", "Music", "Craft"}
            if category in physical_categories and isinstance(mission_data, dict):
                technique_note = str(mission_data.get("technique_note") or "").strip()
                needs_technique_regen = len(technique_note) < 30
                if needs_technique_regen:
                    try:
                        tech_response = await llm.ainvoke([
                            SystemMessage(content=prompt),
                            HumanMessage(content=(
                                f"The previous mission is missing a technique_note — "
                                f"it must include 3-5 sentences of specific physical "
                                f"mechanics for '{mission_data.get('title', '')}'. "
                                f"Regenerate the complete mission with a proper "
                                f"technique_note. Return valid JSON only."
                            )),
                        ])
                        tech_data = _parse_json_response(str(tech_response.content))
                        if (
                            tech_data
                            and isinstance(tech_data, dict)
                            and len(str(tech_data.get("technique_note") or "")) >= 30
                        ):
                            mission_data = tech_data
                    except Exception:
                        pass  # Keep original if regen fails

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
            "description": f"Spend {20} minutes focused on {safe_name}. Work through the exercise at your own pace and note what felt challenging. Done when the timer is up.",
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

    # Clear next_session_note after consuming it — it has been baked into this mission
    if next_session_note_raw.strip():
        try:
            supabase_admin.table("interests").update(
                {"next_session_note": None}
            ).eq("id", interest["id"]).execute()
        except Exception:
            pass  # Non-fatal

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
        "rationale": str(mission_data.get("rationale", ""))[:600],
        "phase_principle": (
            str(mission_data.get("skill_covered") or "")[:200]
            or str(mission_data.get("arc_principle") or "")[:200]
        ),
        "domain_knowledge": str(mission_data.get("domain_knowledge_applied", ""))[:800],
        "description": (
            str(mission_data.get("description", ""))[:400].rstrip()
            + (
                f"\n\nTechnique: {str(mission_data.get('technique_note', ''))[:200]}"
                if mission_data.get("technique_note")
                else ""
            )
        )[:600],
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
        .select("character_stage, daily_hours_floor, archetype, timezone, registration_date, gender")
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
