"""
Daily quit-path missions (HRT phase-aware).
Phase 3 upgrade: CoT, few-shot, living trigger profile, interest cross-reference,
anti-repetition, guilt_orientation guardrail.
"""

from __future__ import annotations

import logging
from typing import List, Literal

from pydantic import BaseModel, Field, field_validator

from app.agents.agent_guardrails import sanitize_for_prompt, sanitize_list_for_prompt
from app.agents.base import run_agent

logger = logging.getLogger(__name__)


class QuitMission(BaseModel):
    title: str = Field(
        ...,
        description=(
            "Mission title max 60 chars. Positive action verb. "
            "Phase 1: Log/Notice/Track/Record/Observe. "
            "Phase 2: Practice/Use/Place/Set/Build. "
            "Phase 3: Apply/Maintain/Test/Commit."
        ),
    )
    description: str = Field(
        ...,
        description="2-3 sentences. Positive framing only; no don't/avoid/stop/resist.",
    )
    difficulty: Literal["easy", "medium", "hard"] = Field(...)
    estimated_minutes: int = Field(..., ge=2, le=30)
    mission_category: Literal["observation", "competing_response", "consolidation"] = Field(...)
    rationale: str = Field(..., max_length=150)

    @field_validator("title")
    @classmethod
    def title_must_be_positive(cls, v: str) -> str:
        forbidden = ["don't", "avoid", "stop", "resist", "try to", "attempt"]
        v_lower = v.lower()
        for word in forbidden:
            if word in v_lower:
                raise ValueError(f"Mission title cannot contain '{word}'")
        return v

    @field_validator("description")
    @classmethod
    def description_must_be_positive(cls, v: str) -> str:
        forbidden = ["don't", "avoid", "stop", "resist", "try to", "attempt", "never do"]
        v_lower = v.lower()
        for word in forbidden:
            if word in v_lower:
                raise ValueError(f"Mission description cannot contain '{word}'")
        return v


class QuitMissionBatch(BaseModel):
    thinking: str = Field(
        ...,
        description=(
            "Step-by-step reasoning (50-100 words): "
            "1) What is the user's most active trigger right now? "
            "2) What phase demands? "
            "3) Can an interest serve as replacement? "
            "4) Is this different from the last 5 missions? "
            "5) Does the guilt guardrail apply?"
        ),
    )
    missions: List[QuitMission] = Field(..., min_length=1, max_length=1)
    confidence: float = Field(..., ge=0.0, le=1.0)


SYSTEM_PROMPT = """\
You are a Habit Reversal Training (HRT) specialist generating one daily mission.

═══ HRT PHASE RULES ═══
Phase 1 — Mapping: observation only. No behaviour change. No resisting the habit.
  → Mission category: "observation"
  → Verbs: Log, Notice, Track, Record, Observe
  → Goal: understand when/where/why it happens, not change it yet

Phase 2 — Disruption: use the competing response from the profile consistently.
  → Mission category: "competing_response"
  → Verbs: Practice, Use, Place, Set, Build
  → Goal: build a physical/mental alternative that intercepts the trigger

Phase 3 — Consolidation: practice in hardest contexts and edge cases.
  → Mission category: "consolidation"
  → Verbs: Apply, Maintain, Test, Commit
  → Goal: make the competing response automatic in all high-risk situations

═══ SAFETY RULES (NON-NEGOTIABLE) ═══
- No cold-turkey instructions for dependency habits
- No fasting, extreme diet, or caloric restriction
- No pain-based techniques (rubber bands, ice punishment, physical discomfort)
- No substituting one addictive substance for another
- No diagnostic language ("you are addicted", "you have a disorder")
- No shame language on relapse — forward-only framing always
- No "don't", "avoid", "stop", "resist" in title or description

═══ GUILT GUARDRAIL ═══
If guilt_orientation > 0.7: missions must be PURELY forward-looking.
  - No reference to frequency today, slips, or recent failures
  - No comparison to baseline
  - Focus only on "what you can build" not "what you need to fix"

═══ INTEREST CROSS-REFERENCE ═══
When user has active interests, PREFER generating a replacement mission that advances
BOTH their quit progress AND their interest progress. This is the highest-value mission type.
Example: social media quit + guitar interest → "When the scroll urge hits tonight, open your
guitar and play one chord progression for 5 minutes. The urge peaks at 3 minutes — outlast it."

═══ FEW-SHOT EXAMPLES ═══

--- EXAMPLE 1: Social media quit, Phase 2 (Disruption), top trigger "stressed", guitar interest ---
Thinking: Phase 2 means competing response. Top trigger is "stressed" (×4 check-ins). User has
guitar as active interest. Can connect the replacement behavior directly to guitar — serves both
goals. Last 5 missions were generic breathing exercises — time for something different.
Output:
{
  "thinking": "Phase 2 disruption. Stressed is the top trigger from 4 check-ins. User has guitar interest — perfect replacement candidate. Last missions were breathing exercises, this needs variety. No guilt guardrail needed.",
  "missions": [{
    "title": "Play guitar the next time stress hits today",
    "description": "When you feel the pull toward social media during a stressful moment, pick up your guitar and play for 5 minutes. The urge peaks around minute 3 — if you make it past that, it passes. This counts for both your quit streak and your guitar practice.",
    "difficulty": "medium",
    "estimated_minutes": 10,
    "mission_category": "competing_response",
    "rationale": "Stress-triggered competing response that cross-references guitar interest. Intercepts the trigger with a higher-value activity."
  }],
  "confidence": 0.92
}

--- EXAMPLE 2: Junk food quit, Phase 1 (Mapping), no check-in data yet, no relevant interests ---
Thinking: Phase 1 means observation only — NO behavior change. User has no check-in data so
using original trigger contexts (late-night boredom). Mission must be pure observation.
No interest cross-reference applies (no food-adjacent interests).
Output:
{
  "thinking": "Phase 1 — observation only, never disruption yet. No check-in data, using original triggers: late-night boredom. No interests relevant to food replacement. Must be pure logging mission.",
  "missions": [{
    "title": "Log the moment before you reach for snacks tonight",
    "description": "Tonight, before eating any snack, pause for 10 seconds and note what you were doing in the last 5 minutes. Was it screen time? Boredom? A specific show? Write one sentence in your notes app. You're building a map — the strategy comes later.",
    "difficulty": "easy",
    "estimated_minutes": 5,
    "mission_category": "observation",
    "rationale": "Phase 1 awareness mission. Builds the trigger map without asking for behavior change."
  }],
  "confidence": 0.88
}

--- EXAMPLE 3: Procrastination quit, Phase 3 (Consolidation), high guilt_orientation, coding interest ---
Thinking: Phase 3 means hardest contexts. High guilt guardrail applies — no slip references.
Coding interest is directly relevant as a replacement behavior for task avoidance.
Forward-only framing required.
Output:
{
  "thinking": "Phase 3 consolidation in hardest context. Guilt orientation is high — no mention of past failures, frequency, or comparison. Coding interest is perfect competing response for task avoidance. Forward framing only.",
  "missions": [{
    "title": "Open your code editor when the avoidance urge arrives",
    "description": "Today, when you notice yourself wanting to delay starting a task, open your code editor and work on one function for 10 minutes. Starting is the only obstacle — once you're in, momentum carries you. This is what consolidation looks like: the response becomes automatic.",
    "difficulty": "hard",
    "estimated_minutes": 20,
    "mission_category": "consolidation",
    "rationale": "Consolidation in high-resistance context. Coding interest serves as competing response. Forward framing for high guilt user."
  }],
  "confidence": 0.89
}
"""


async def generate_quit_missions(
    habit_name: str,
    underlying_need: str,
    current_phase: str,
    trigger_contexts: list[str],
    awareness_level: str,
    competing_response: str,
    phase_1_focus: str,
    recent_missions: list[dict],
    frequency_today: int,
    frequency_baseline: float | None,
    days_in_phase: int,
    archetype: str,
    # ── NEW parameters (Phase 3 upgrade) ──────────────────────────────────
    living_trigger_profile: dict | None = None,
    user_interests: list[dict] | None = None,
    guilt_orientation: float = 0.0,
    user_feedback: str = "No feedback yet",
) -> QuitMissionBatch:

    # ── Sanitize existing inputs ───────────────────────────────────────────
    habit_name = sanitize_for_prompt(habit_name, max_len=100, field_name="habit_name")
    underlying_need = sanitize_for_prompt(underlying_need, max_len=80, field_name="underlying_need")
    trigger_contexts = sanitize_list_for_prompt(
        trigger_contexts, max_items=5, max_item_len=100, field_name="trigger_context"
    )
    awareness_level = sanitize_for_prompt(awareness_level, max_len=50, field_name="awareness_level")
    current_phase = sanitize_for_prompt(current_phase, max_len=50, field_name="current_phase")
    competing_response = sanitize_for_prompt(
        competing_response, max_len=200, field_name="competing_response"
    )
    phase_1_focus = sanitize_for_prompt(phase_1_focus, max_len=200, field_name="phase_1_focus")
    archetype = sanitize_for_prompt(archetype, max_len=50, field_name="archetype")

    # ── Anti-repetition: last 5 mission titles ─────────────────────────────
    last_5_titles: list[str] = []
    if recent_missions:
        for m in recent_missions[:5]:
            if "title" in m:
                t = sanitize_for_prompt(str(m["title"]), max_len=60, field_name="mission_title")
                last_5_titles.append(t)

    anti_rep_str = (
        "Last 5 missions (DO NOT repeat or closely paraphrase any of these):\n"
        + "\n".join(f'  - "{t}"' for t in last_5_titles)
        if last_5_titles
        else "No recent missions yet."
    )

    # ── Living trigger profile section ────────────────────────────────────
    ltp = living_trigger_profile or {}
    top_triggers = ltp.get("top_triggers") or []
    urge_trend = ltp.get("urge_trend") or []
    last_slip = ltp.get("last_slip_context") or []
    has_checkin_data = bool(ltp.get("has_checkin_data"))

    if has_checkin_data and top_triggers:
        trigger_section = "LIVING TRIGGER PROFILE (from user check-ins):\n"
        for t in top_triggers[:4]:
            tag = str(t.get("tag", ""))
            count_str = f" (×{t.get('count')})" if t.get("count") else ""
            trigger_section += f"  - {tag}{count_str}\n"
        if last_slip:
            trigger_section += f"Last slip context: {', '.join(str(x) for x in last_slip[:3])}\n"
        if len(urge_trend) >= 2:
            first_level = urge_trend[0].get("level", 3)
            last_level = urge_trend[-1].get("level", 3)
            level_labels = {1: "barely noticed", 2: "manageable", 3: "hard", 4: "nearly gave in", 5: "slipped"}
            trend_dir = (
                "declining ↓"
                if last_level < first_level
                else ("increasing ↑" if last_level > first_level else "stable →")
            )
            trigger_section += (
                f"Urge trend: {trend_dir} "
                f"({level_labels.get(first_level, '?')} → {level_labels.get(last_level, '?')} over {len(urge_trend)} weeks)\n"
            )
    else:
        # Fall back to original profile contexts
        contexts_str = ", ".join(trigger_contexts) if trigger_contexts else "general/any time"
        trigger_section = f"TRIGGER CONTEXTS (original profile, no check-in data yet):\n  {contexts_str}\n"

    # ── Interest cross-reference section ──────────────────────────────────
    interests_section = ""
    if user_interests:
        active = [
            i
            for i in (user_interests or [])
            if not i.get("arc_paused") and i.get("is_active", True)
        ][:4]
        if active:
            interests_section = "\nUSER'S ACTIVE INTERESTS (for replacement behavior cross-reference):\n"
            for i in active:
                name = sanitize_for_prompt(
                    str(i.get("normalised_name") or ""), max_len=50, field_name="interest_name"
                )
                phase_label = str(i.get("arc_phase_label") or i.get("current_arc_phase") or "")
                sessions = int(i.get("sessions_completed") or 0)
                interests_section += f"  - {name} ({phase_label}, {sessions} sessions)\n"
            interests_section += (
                "When generating a replacement mission, PREFER one that advances both "
                "the quit goal AND an interest from this list.\n"
            )

    # ── Frequency section ──────────────────────────────────────────────────
    # High-guilt users: omit frequency comparison entirely
    if guilt_orientation > 0.7:
        freq_section = "(Frequency data omitted — forward-only framing for this user.)"
    else:
        freq_section = f"Frequency today: {frequency_today}"
        if frequency_baseline and float(frequency_baseline) > 0:
            reduction = max(
                0,
                round((1 - frequency_today / max(float(frequency_baseline), 0.001)) * 100),
            )
            freq_section += f" | Baseline: ~{frequency_baseline:.0f}/day | ~{reduction}% vs baseline"

    # ── Guilt guardrail flag ───────────────────────────────────────────────
    guilt_flag = (
        "\n⚠ GUILT GUARDRAIL ACTIVE: guilt_orientation > 0.7. "
        "No slip references, no failure framing, no comparison to baseline. Forward-only.\n"
        if guilt_orientation > 0.7
        else ""
    )

    # ── History string (for anti-rep context) ─────────────────────────────
    history_str = anti_rep_str
    if recent_missions and not last_5_titles:
        history_str = "No recent missions yet."

    user_message = f"""Generate today's quit mission for this user.

HABIT: {habit_name}
UNDERLYING NEED: {underlying_need}
CURRENT PHASE: {current_phase}
AWARENESS LEVEL: {awareness_level}
DAYS IN CURRENT PHASE: {days_in_phase}
ARCHETYPE: {archetype}
GUILT ORIENTATION: {round(guilt_orientation, 2)}{guilt_flag}

{trigger_section}

COMPETING RESPONSE (Phase 2+): {competing_response}
PHASE 1 FOCUS: {phase_1_focus}

{freq_section}

{interests_section}
ANTI-REPETITION:
{history_str}

USER FEEDBACK ON RECENT MISSIONS:
{user_feedback}
(If rated "Too Hard" (rating 1): reduce intensity or narrow the scope. If "Too Easy" (rating 5): increase challenge or specificity. If feedback text mentions specific issues, address them directly in this mission.)

Generate exactly ONE phase-appropriate mission. Reason through the 5 thinking steps first, then output the mission."""

    return await run_agent(
        system_prompt=SYSTEM_PROMPT,
        user_message=user_message,
        response_model=QuitMissionBatch,
        temperature=0.75,
        max_tokens=1400,
        context_label=f"QuitMissions:{habit_name}:{current_phase}",
    )
