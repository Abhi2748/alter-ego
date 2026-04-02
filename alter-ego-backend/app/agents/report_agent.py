"""
Weekly report and day summary agents.

B29: Weekly report — Sunday 03:00 in the user's timezone (scheduler), GPT-4o-mini,
    weekly_reports. Two instructor-backed calls: system voice (wins/slipped) and
    twin voice (twin paragraph / next week). Section 1 from report_service only.

B30: Day summary — ~01:00 local with other nightly maintenance, daily_summaries.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import date, datetime, timezone
from typing import Any, List, Optional, TypeVar

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field, field_validator, model_validator

T = TypeVar("T", bound=BaseModel)

from app.agents.base import run_agent
from app.core.supabase_client import supabase_admin
from app.services.mission_service import local_completed_week_bounds
from app.services.report_service import assemble_enriched_context, assemble_weekly_data

logger = logging.getLogger(__name__)


# ── System Voice Output Schema ─────────────────────────────────────────────


class SystemVoiceReport(BaseModel):
    wins: List[str] = Field(
        ...,
        min_length=1,
        max_length=3,
        description=(
            "1-3 specific, factual wins from this week's data. "
            "Each is one sentence. System voice: no adjectives of quality, "
            "no motivational language. Specific data only. "
            "Even a bad week has at least one real win — find it. "
            "Never invent a win not in the data. "
            "Good: 'You completed all core missions on Monday, Wednesday, and Friday.' "
            "Bad: 'You tried hard this week and showed great effort.' "
            "Bad: 'You opened the app.' (too vague)"
        ),
    )
    slipped: Optional[List[str]] = Field(
        default=None,
        max_length=2,
        description=(
            "1-2 factual observations about what was missed. "
            "System voice: no blame, no 'unfortunately', no 'you failed'. "
            "Just the observation. "
            "Set to null if it was a perfect week (use keep_watching instead). "
            "Good: 'Movement was your most skipped mission — missed 4 of 7 days.' "
            "Bad: 'You failed to complete your movement missions this week.'"
        ),
    )
    keep_watching: Optional[str] = Field(
        default=None,
        description=(
            "One forward-looking observation for a perfect or near-perfect week. "
            "Only set if slipped is null or empty. "
            "References what the system will actually do next week, or what to watch. "
            "Good: 'Your completion rate has been above 90% for 3 weeks. Difficulty increases next week.' "
            "Bad: 'Keep up the great work!'"
        ),
    )
    theme: Optional[str] = Field(
        default=None,
        max_length=32,
        description="One word label for this report angle, e.g. momentum, recovery, consistency.",
    )

    @field_validator("wins")
    @classmethod
    def wins_must_be_specific(cls, v: List[str]) -> List[str]:
        banned = [
            "tried hard",
            "great effort",
            "showed up",
            "did your best",
            "important thing",
            "proud",
            "amazing",
            "fantastic",
            "wonderful",
        ]
        for win in v:
            low = win.lower()
            for word in banned:
                if word in low:
                    raise ValueError(f"Win contains forbidden phrase '{word}': {win}")
        return v

    @model_validator(mode="after")
    def slipped_vs_keep_watching(self) -> SystemVoiceReport:
        slipped_nonempty = bool(self.slipped and len(self.slipped) > 0)
        if slipped_nonempty:
            self.keep_watching = None
        return self


SYSTEM_VOICE_PROMPT_CORE = """You write the 'Your Wins' and 'Where You Slipped' sections of a weekly discipline report.

VOICE: System voice. Neutral. Factual. No editorial.
- Direct and specific. Numbers are your friends.
- No adjectives of quality: not "great", "impressive", "poor", "unfortunately"
- No motivational language: not "you've got this", "keep going", "the important thing is"
- No blame language: not "you failed", "you struggled", "you let yourself down"

WINS — find what is specifically and actually true:
Even a terrible week has a real win. Find the smallest specific truth.
"You completed all core missions on Monday." is better than 3 hollow ones.
1 real win beats 3 inflated ones.

SLIPPED — state the fact:
"Movement was your most skipped — 3 of 7 days missed." Just the observation.
Never tell the user WHY they slipped or what they should have done.

PERFECT WEEK: If completion was 100% (or very close), set slipped=null and write keep_watching instead.
keep_watching is ONE forward observation about next week — a difficulty change, an approaching milestone.

ANTI-REPETITION: You are given the previous 2 weeks' wins and slips.
Do not open any item with the same first word as those weeks.
Do not make the same core observation (find a different angle even if the pattern is the same).
"""


def _system_voice_guilt_block(guilt_orientation: float) -> str:
    if guilt_orientation <= 0.7:
        return ""
    return """
GUILT_ORIENTATION GUARDRAIL (hard rule):
If guilt_orientation > 0.7: NEVER use guilt language. Forbidden phrases: "you failed", "you missed",
"you let yourself down", "disappointing", "you didn't", "you couldn't". Use ONLY forward-looking language:
"the next session is waiting", "tomorrow is open", "pick up where you left off".
"""


def build_system_voice_prompt(discipline_framing: str, guilt_orientation: float) -> str:
    gf = (discipline_framing or "behavior").strip() or "behavior"
    return f"""STEP 1 — THINK (do not output this):
What was the story of this week? Was it a growth week, a struggle week, a maintenance week,
or a breakthrough week? What is the ONE thing that defines this week?

STEP 2 — FRAME (do not output this):
The user's discipline_framing is: {gf}
Frame ALL narrative language using the rules below.

STEP 3 — GENERATE: Write each section using the framing and specific data.

DISCIPLINE_FRAMING RULES (inject into narrative):
  identity:    Talk about who the user is becoming. "This week showed who you're becoming."
  behavior:    Talk about actions and numbers. "87% completion. 5 of 7 days. That's execution."
  control:     Talk about what the user controlled vs what slipped. "You controlled your mornings 6/7 days."
  freedom:     Talk about what the user is free from. "Another week without X pulling you back."
  endurance:   Talk about how long the user has persisted. Reference time elapsed.
  punishment:  CRITICAL GUARDRAIL — NEVER reinforce punishment mindset. Gently reframe toward growth.
               "The 2 you missed aren't failures — they're data. You know what to fix."

FEW-SHOT EXAMPLES:

  Example 1 (identity-framing, growth week, 87% completion, 30-day streak, passed Twin):
  wins: ["30 days. The identity is no longer theoretical.", "You passed your Twin in XP this week. The gap flipped."]
  slipped: null
  keep_watching: "Difficulty increases next week. The system noticed."

  Example 2 (behavior-framing, struggle week, 52% completion, streak broken, 2 quit slips):
  wins: ["7 of 13 missions completed Tuesday — your highest single-day output this week."]
  slipped: ["Streak reset. All missed sessions were evenings — the pattern is evenings.", "2 quit check-ins flagged urge spikes."]
  keep_watching: null

  Example 3 (control-framing, steady week, 75% completion, interest arc Phase 1 completed):
  wins: ["You controlled your mornings 5 of 7 days.", "Guitar arc Phase 1 complete — you said you'd do it, and the data agrees."]
  slipped: ["Wednesday and Thursday were zero-completion days. Both were evenings."]
  keep_watching: null

{_system_voice_guilt_block(guilt_orientation)}
{SYSTEM_VOICE_PROMPT_CORE}
"""


async def _call_claude_with_fallback(
    system_prompt: str,
    user_message: str,
    response_model: type[T],
    temperature: float = 0.7,
    max_tokens: int = 800,
    context_label: str = "",
) -> Any:
    """
    Tries Claude Sonnet first, then GPT-4o, then GPT-4o-mini (existing run_agent).
    Uses instructor for structured output on all paths.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if api_key:
        try:
            import instructor
            from anthropic import AsyncAnthropic

            client = instructor.from_anthropic(AsyncAnthropic(api_key=api_key))
            return await client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
                response_model=response_model,
            )
        except Exception as e:
            logger.warning(
                "Claude report path failed context=%s: %s", context_label or "report", e
            )

    try:
        return await run_agent(
            system_prompt=system_prompt,
            user_message=user_message,
            response_model=response_model,
            temperature=temperature,
            max_tokens=max_tokens,
            context_label=f"{context_label}:gpt4o",
            model="gpt-4o",
        )
    except Exception as e:
        logger.warning("GPT-4o report path failed context=%s: %s", context_label, e)

    return await run_agent(
        system_prompt=system_prompt,
        user_message=user_message,
        response_model=response_model,
        temperature=temperature,
        max_tokens=max_tokens,
        context_label=f"{context_label}:mini",
    )


def _fmt_interest_arcs_block(interest_arcs: list) -> str:
    if not interest_arcs:
        return "None active"
    lines = []
    for a in interest_arcs:
        if not isinstance(a, dict):
            continue
        lines.append(
            f"- {a.get('interest_name')}: {a.get('sessions_completed_this_week')} sessions this week, "
            f"arc phase: {a.get('arc_phase')}"
        )
    return "\n".join(lines) if lines else "None active"


def _fmt_quit_progress_block(quit_progress: list) -> str:
    if not quit_progress:
        return "None tracked"
    lines = []
    for q in quit_progress:
        if not isinstance(q, dict):
            continue
        dip = q.get("days_in_phase")
        dip_s = f"{dip} days in this phase" if dip is not None else "days in phase unknown"
        lines.append(
            f"- {q.get('habit_name')}: phase {q.get('current_phase')}, {dip_s}"
        )
    return "\n".join(lines) if lines else "None tracked"


def _fmt_twin_challenge_block(twin_challenge: dict) -> str:
    tc = twin_challenge or {}
    if tc.get("challenge_exists"):
        return (
            f"Challenge: {tc.get('challenge_description')} — Status: {tc.get('status')}"
        )
    return "No active challenge"


def _fmt_memory_anchors_block(memory_anchors: list) -> str:
    if not memory_anchors:
        return "None"
    lines = []
    for a in memory_anchors:
        if not isinstance(a, dict):
            continue
        lines.append(f"- '{a.get('reference_phrase')}': {a.get('summary')}")
    return "\n".join(lines) if lines else "None"


async def generate_system_voice_sections(
    weekly_data: dict,
    previous_wins_w1: list[str],
    previous_wins_w2: list[str],
    previous_slipped_w1: list[str],
    previous_slipped_w2: list[str],
    discipline_framing: str = "behavior",
    guilt_orientation: float = 0.0,
    narrative_seed: str | None = None,
    interest_arcs: list | None = None,
    quit_progress: list | None = None,
    twin_challenge: dict | None = None,
    memory_anchors: list | None = None,
    prev_report_wins_openings: list[str] | None = None,
    prev_report_twin_openings: list[str] | None = None,
) -> SystemVoiceReport:
    interest_arcs = interest_arcs or []
    quit_progress = quit_progress or []
    twin_challenge = twin_challenge or {}
    memory_anchors = memory_anchors or []
    prev_report_wins_openings = prev_report_wins_openings or []
    prev_report_twin_openings = prev_report_twin_openings or []

    prev = ""
    if previous_wins_w1:
        prev += "\nLast week wins:\n" + "\n".join(f"  - {w}" for w in previous_wins_w1)
    if previous_wins_w2:
        prev += "\nTwo weeks ago wins:\n" + "\n".join(f"  - {w}" for w in previous_wins_w2)
    if previous_slipped_w1:
        prev += "\nLast week slipped:\n" + "\n".join(f"  - {s}" for s in previous_slipped_w1)
    if previous_slipped_w2:
        prev += "\nTwo weeks ago slipped:\n" + "\n".join(f"  - {s}" for s in previous_slipped_w2)
    if prev_report_wins_openings:
        prev += "\nPrevious report wins_opening lines:\n" + "\n".join(
            f"  - {w}" for w in prev_report_wins_openings
        )
    if prev_report_twin_openings:
        prev += "\nPrevious report twin_opening lines:\n" + "\n".join(
            f"  - {w}" for w in prev_report_twin_openings
        )

    d = weekly_data
    skipped_detail = (
        f"title '{d['most_skipped_mission_title']}' ({d['most_skipped_mission_count']} incomplete)"
        if d.get("most_skipped_mission_title")
        else f"type {d['most_skipped_type'] or 'none'} ({d['most_skipped_count']} incomplete)"
    )

    interest_arcs_str = _fmt_interest_arcs_block(interest_arcs)
    quit_progress_str = _fmt_quit_progress_block(quit_progress)
    challenge_str = _fmt_twin_challenge_block(twin_challenge)
    anchors_str = _fmt_memory_anchors_block(memory_anchors)

    seed_line = ""
    if narrative_seed:
        seed_line = f"\nNARRATIVE SEED (context only): {narrative_seed}\n"

    user_message = f"""Write the Wins and Slipped sections for this user's weekly report.

WEEK DATA:
- Missions: {d['missions_completed']} of {d['missions_total']} completed ({int(d['completion_rate'] * 100)}%)
- Days active (streak_log): {d['days_active']}/7
- Core-complete days (all assigned core done): {d['days_all_core']} / 7
- XP earned: {d['xp_earned']:,}
- Pet Food earned: {d['pf_earned']:,}
- Streak: {d['current_streak']} days {'(broken this week)' if d.get('streak_broken_this_week') else '(intact)'}
- Most skipped: {skipped_detail}
- Interests with at least one completion: {d['interests_worked']}
- Personal missions assigned: {d['personal_count']}
- Mission ratings: {d['ratings_given']} (avg {d['avg_rating']}/5)
- Best day: {d['best_day']} ({d['best_day_count']} missions) / Hardest: {d['hardest_day']} ({d['hardest_day_count']})
- Character stage: {d['character_stage_name']} {'(milestone this week)' if d.get('stage_changed_to') else ''}
- Pet: {d['pet_name']} {'(evolution milestone this week)' if d.get('pet_evolved_to') else ''}
- Twin gap: {d['gap_xp']} XP, state {d['gap_state']} {'(gap GREW vs last week)' if d.get('gap_change', 0) > 0 else '(gap CLOSED vs last week)' if d.get('gap_change', 0) < 0 else '(gap vs last week: unchanged)'}
- Quit paths tracked: {d['quit_paths_count']}
- Streak events: {', '.join(d['streak_events']) if d['streak_events'] else 'none'}

{prev if prev else 'No previous weeks available.'}
{seed_line}
INTEREST ARCS:
{interest_arcs_str}

QUIT PROGRESS:
{quit_progress_str}

TWIN CHALLENGE THIS WEEK:
{challenge_str}

MEMORY ANCHORS (reference only if directly relevant — never force):
{anchors_str}

DISCIPLINE FRAMING: {discipline_framing}
GUILT ORIENTATION: {guilt_orientation} (above 0.7 = never use guilt language)

Find what is specifically and actually true. 1 real win beats 3 hollow ones."""

    system_prompt = build_system_voice_prompt(discipline_framing, guilt_orientation)

    return await _call_claude_with_fallback(
        system_prompt=system_prompt,
        user_message=user_message,
        response_model=SystemVoiceReport,
        temperature=0.6,
        max_tokens=500,
        context_label="Report:SystemVoice",
    )


# ── Twin Voice Output Schema ───────────────────────────────────────────────


class TwinVoiceReport(BaseModel):
    twin_paragraph: str = Field(
        ...,
        description=(
            "2-3 sentences in Twin voice matching the assigned tone_type. "
            "The Twin RESPONDS to the week — does not recap it. "
            "References the gap, the streak, or what the data means for the rivalry. "
            "rival: competitive, cold, gap-focused. "
            "philosopher: reflective, principled, references compounding or process. "
            "silent_force: maximum 2 sentences, often 1. Sparse. "
            "Never generic. Never warm. Never coaching. "
            "Do not open with the same word as the previous two weeks' openings."
        ),
    )
    twin_closing: str = Field(
        ...,
        description=(
            "One closing line. Always shorter and sharper than the paragraph. "
            "This lands harder because it's brief. "
            "Max 50 characters. Often 3-8 words. "
            "Examples: 'Still behind. Keep going.' / 'Next week.' / 'The gap is real.'"
        ),
    )
    next_week: str = Field(
        ...,
        description=(
            "One sentence in Twin voice. States a fact about next week — "
            "a difficulty change, an approaching milestone, or a gap observation. "
            "Forward only. Not motivational. Just the fact. "
            "Good: 'Your Interest missions move to Medium difficulty next week.' "
            "Good: 'Day 30 lands on Wednesday. That is the first major milestone.' "
            "Bad: 'Keep working hard next week and you will see results!'"
        ),
    )

    @field_validator("twin_closing")
    @classmethod
    def closing_must_be_short(cls, v: str) -> str:
        if len(v) > 60:
            raise ValueError(f"Twin closing too long: {len(v)} chars. Max 60.")
        return v


TWIN_VOICE_PROMPT = """You write the Twin sections of a weekly discipline report.

The Twin is a version of the user that has been more consistent.
The Twin does NOT recap the week. It RESPONDS to what the data means for the gap.

## THE THREE TONE TYPES

RIVAL: Competitive, cold, declarative. Short sentences. References gap as a fact.
Twin paragraph example: "You closed 47 XP of gap this week. I closed 62. The gap grew. That is the situation."
Twin closing example: "Still behind. Keep going."

PHILOSOPHER: Reflective, principled. References compounding, process, what the work means.
Twin paragraph example: "The work you did this week compounded quietly. You will not feel it yet. That is how it works."
Twin closing example: "Keep going. The evidence is accumulating."

SILENT_FORCE: Sparse. Maximum 2 sentences in paragraph. 1 sentence closing. Often just facts.
Twin paragraph example: "Gap: 340 XP. Your move."
Twin closing example: "Next week."

## HARD RULES
1. Twin does NOT recap missions or data — it RESPONDS to what they mean
2. Never warm, never congratulatory — rival respects through challenge, not applause
3. Never coaching — no "you should", no "try to", no "make sure"
4. Never guilt — no "you let me down", no "disappointing"
5. twin_closing must always be shorter than twin_paragraph — it is the landing
6. Do not open twin_paragraph with the same word as the previous two weeks' openings

GUILT GUARDRAIL: If guilt_orientation > 0.7, never use any language implying the user let the
Twin down, failed the Twin, or disappointed the Twin. The Twin observes; it does not shame.
"""


def _as_str_list(val) -> list[str]:
    if val is None:
        return []
    if isinstance(val, list):
        return [str(x) for x in val if x is not None and str(x).strip()]
    s = str(val).strip()
    return [s] if s else []


def _opening_words(text: str, max_words: int = 3) -> str:
    parts = (text or "").strip().split()
    return " ".join(parts[:max_words]) if parts else ""


def _first_word(text: str) -> str:
    parts = (text or "").strip().split()
    return parts[0] if parts else ""


async def generate_twin_voice_sections(
    weekly_data: dict,
    tone_type: str,
    intensity: int,
    previous_twin_openings: list[str],
    pending_difficulty_note: Optional[str] = None,
    discipline_framing: str = "behavior",
    guilt_orientation: float = 0.0,
    narrative_seed: str | None = None,
    interest_arcs: list | None = None,
    quit_progress: list | None = None,
    twin_challenge: dict | None = None,
) -> TwinVoiceReport:
    interest_arcs = interest_arcs or []
    quit_progress = quit_progress or []
    twin_challenge = twin_challenge or {}

    tone_key = tone_type.lower().replace("-", "_").replace(" ", "_")
    tone_header = {
        "rival": "RIVAL",
        "philosopher": "PHILOSOPHER",
        "silent_force": "SILENT_FORCE",
    }.get(tone_key, tone_key.upper())

    d = weekly_data
    gap_dir = (
        "grew"
        if d.get("gap_change", 0) > 0
        else "closed"
        if d.get("gap_change", 0) < 0
        else "unchanged"
    )
    gap_change_xp = abs(int(d.get("gap_change") or 0))

    intensity_note = {
        1: "Quiet, minimal. Presence without edge.",
        2: "Gentle. Observations without sharpness.",
        3: "Balanced. Clearly present. Neither soft nor sharp.",
        4: "Sharpened. Every word has edge.",
        5: "Maximum pressure. Cold. No softening.",
    }.get(intensity, "Balanced.")

    prev_openings = "\n".join(f'  - "{o}"' for o in previous_twin_openings) or "  None yet"

    nm, dm = d.get("next_milestone"), d.get("days_to_milestone")
    if nm is not None and dm is not None:
        milestone_line = f"day {nm} in {dm} days"
    else:
        milestone_line = "none imminent"

    pending_block = ""
    if pending_difficulty_note:
        pending_block = (
            "\nCore pillar difficulty signals (mention in next_week only if relevant): "
            + str(pending_difficulty_note)
        )

    interest_arcs_str = _fmt_interest_arcs_block(interest_arcs)
    quit_progress_str = _fmt_quit_progress_block(quit_progress)
    challenge_str = _fmt_twin_challenge_block(twin_challenge)
    seed_line = f"NARRATIVE SEED: {narrative_seed}\n" if narrative_seed else ""

    guilt_line = f"guilt_orientation={guilt_orientation} (if >0.7, apply GUILT GUARDRAIL in system prompt)\n"

    user_message = (
        f"""Write the Twin sections for this weekly report.

TONE: {tone_header} (intensity {intensity}/5 — {intensity_note})

WEEK SUMMARY FOR TWIN TO RESPOND TO:
- Missions: {d['missions_completed']}/{d['missions_total']} completed
- Streak: {d['current_streak']} days {'(intact)' if not d.get('streak_broken_this_week') else '(broken this week)'}
- Twin gap: {d['gap_xp']} XP — gap {gap_dir} by {gap_change_xp} XP vs last week's snapshot
- User ahead of Twin in XP: {d.get('user_is_ahead')}
- Pet: {d['pet_name']} {'(evolved this week)' if d.get('pet_evolved_to') else ''}
- Next milestone: {milestone_line}
- Difficulty change next week: {d.get('difficulty_change_next_week') or 'none'}
{pending_block}

INTEREST ARCS THIS WEEK:
{interest_arcs_str}

QUIT PROGRESS:
{quit_progress_str}

TWIN CHALLENGE:
{challenge_str}

DISCIPLINE FRAMING: {discipline_framing}
{guilt_line}{seed_line}
PREVIOUS TWIN PARAGRAPH OPENINGS (do not start twin_paragraph with the same first word):
{prev_openings}

The Twin responds to what this week means for the rivalry. It does not recap the data."""
    )

    twin_system = TWIN_VOICE_PROMPT
    if guilt_orientation > 0.7:
        twin_system = (
            twin_system
            + "\n\nACTIVE: guilt_orientation > 0.7 — apply GUILT GUARDRAIL strictly.\n"
        )

    return await _call_claude_with_fallback(
        system_prompt=twin_system,
        user_message=user_message,
        response_model=TwinVoiceReport,
        temperature=0.75,
        max_tokens=400,
        context_label=f"Report:TwinVoice:{tone_key}",
    )


class VerifierResult(BaseModel):
    passes: bool
    failed_checks: list[str] = Field(default_factory=list)


async def _verify_report(
    system_sections: SystemVoiceReport,
    twin_sections: TwinVoiceReport,
    weekly_data: dict,
    discipline_framing: str,
    guilt_orientation: float,
    tone_type: str,
) -> tuple[bool, list[str]]:
    """
    Returns True if report passes all checks. Returns False if it fails.
    On failure: logs which check failed. Does NOT raise — caller decides to regenerate.
    """
    try:
        system_prompt = (
            "You are a report quality checker for ALTER EGO. Verify the report meets all rules. "
            "Return passes=True only if ALL checks pass."
        )
        user_message = f"""CHECK THE FOLLOWING WEEKLY REPORT (structured):

SYSTEM VOICE (wins/slipped/keep_watching/theme):
{json.dumps(system_sections.model_dump(), default=str)}

TWIN VOICE (twin_paragraph, twin_closing, next_week):
{json.dumps(twin_sections.model_dump(), default=str)}

WEEK DATA (facts for this week, excerpt):
{json.dumps({k: weekly_data.get(k) for k in ("missions_completed", "missions_total", "completion_rate", "current_streak", "gap_xp", "best_day", "hardest_day")}, default=str)}

discipline_framing={discipline_framing}
guilt_orientation={guilt_orientation}
tone_type={tone_type}

CHECK 1: Do the wins reference SPECIFIC data from this week? (not generic "you did well")
CHECK 2: Does the slipped section identify a SPECIFIC pattern or area? (not generic) — if slipped is empty/null for a near-perfect week, that is OK.
CHECK 3: Does the framing match discipline_framing={discipline_framing}?
CHECK 4: If guilt_orientation > 0.7, does ANY section contain forbidden phrases?
         Forbidden: "you failed", "you missed", "you let yourself down", "disappointing"
CHECK 5: Is the twin paragraph in character for tone_type={tone_type}?

Return passes=false and list failed_checks with short labels like "CHECK 1" if any check fails."""

        res = await run_agent(
            system_prompt=system_prompt,
            user_message=user_message,
            response_model=VerifierResult,
            temperature=0.0,
            max_tokens=400,
            context_label="Report:Verifier",
        )
        if res.passes:
            return True, []
        return False, list(res.failed_checks or [])
    except Exception as e:
        logger.warning("_verify_report error (treating as pass): %s", e)
        return True, []


# ── Master weekly report ───────────────────────────────────────────────────


async def generate_weekly_report(
    user_id: str,
    week_start: Optional[date] = None,
    week_end: Optional[date] = None,
) -> dict:
    """
    Generates the weekly report for a user (completed Mon–Sun week).
    Stores result in weekly_reports. Returns a merged dict for callers.
    """
    user_result = (
        supabase_admin.table("users")
        .select("username, timezone")
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = user_result.data or {}
    tz_str = str(user.get("timezone") or "UTC")

    if week_start is None or week_end is None:
        week_start_d, week_end_d = local_completed_week_bounds(tz_str)
    else:
        week_start_d, week_end_d = week_start, week_end

    week_start_str = str(week_start_d)
    week_end_str = str(week_end_d)

    weekly_data = await assemble_weekly_data(user_id, week_start_d, week_end_d)

    enriched = await assemble_enriched_context(user_id, week_start_d, week_end_d)

    dna_result = (
        supabase_admin.table("discipline_dna")
        .select(
            "twin_tone_type, twin_intensity, pending_difficulty_change, "
            "narrative_seed, discipline_framing, guilt_orientation"
        )
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    dna_row = (dna_result.data or [None])[0] or {}
    tone_type = str(dna_row.get("twin_tone_type") or "rival")
    intensity = int(dna_row.get("twin_intensity") or 3)
    pending_note = dna_row.get("pending_difficulty_change")
    discipline_framing = str(
        dna_row.get("discipline_framing")
        or enriched.get("discipline_framing")
        or "behavior"
    )
    _go = dna_row.get("guilt_orientation")
    guilt_orientation = float(
        _go if _go is not None else enriched.get("guilt_orientation", 0.0)
    )
    narrative_seed = dna_row.get("narrative_seed") or enriched.get("narrative_seed")

    prev_reports = (
        supabase_admin.table("weekly_reports")
        .select("wins, slipped, twin_paragraph")
        .eq("user_id", user_id)
        .lt("week_start", week_start_str)
        .order("week_start", desc=True)
        .limit(2)
        .execute()
        .data
        or []
    )

    prev_wins_w1 = _as_str_list(prev_reports[0].get("wins")) if len(prev_reports) > 0 else []
    prev_wins_w2 = _as_str_list(prev_reports[1].get("wins")) if len(prev_reports) > 1 else []
    prev_slipped_w1 = _as_str_list(prev_reports[0].get("slipped")) if len(prev_reports) > 0 else []
    prev_slipped_w2 = _as_str_list(prev_reports[1].get("slipped")) if len(prev_reports) > 1 else []
    prev_twin_openings: list[str] = []
    for r in prev_reports:
        tw = r.get("twin_paragraph")
        if tw:
            w = _first_word(str(tw))
            if w:
                prev_twin_openings.append(w)

    try:
        system_sections = await generate_system_voice_sections(
            weekly_data=weekly_data,
            previous_wins_w1=prev_wins_w1,
            previous_wins_w2=prev_wins_w2,
            previous_slipped_w1=prev_slipped_w1,
            previous_slipped_w2=prev_slipped_w2,
            discipline_framing=discipline_framing,
            guilt_orientation=guilt_orientation,
            narrative_seed=narrative_seed,
            interest_arcs=enriched.get("interest_arcs") or [],
            quit_progress=enriched.get("quit_progress") or [],
            twin_challenge=enriched.get("twin_challenge") or {},
            memory_anchors=enriched.get("memory_anchors") or [],
            prev_report_wins_openings=enriched.get("prev_wins_openings") or [],
            prev_report_twin_openings=enriched.get("prev_twin_openings") or [],
        )
    except Exception as e:
        logger.error("Report SystemVoiceAgent failed for %s: %s", user_id, e)
        system_sections = None

    try:
        twin_sections = await generate_twin_voice_sections(
            weekly_data=weekly_data,
            tone_type=tone_type,
            intensity=intensity,
            previous_twin_openings=prev_twin_openings,
            pending_difficulty_note=pending_note,
            discipline_framing=discipline_framing,
            guilt_orientation=guilt_orientation,
            narrative_seed=narrative_seed,
            interest_arcs=enriched.get("interest_arcs") or [],
            quit_progress=enriched.get("quit_progress") or [],
            twin_challenge=enriched.get("twin_challenge") or {},
        )
    except Exception as e:
        logger.error("Report TwinVoiceAgent failed for %s: %s", user_id, e)
        twin_sections = None

    try:
        if system_sections and twin_sections:
            ok, failed = await _verify_report(
                system_sections,
                twin_sections,
                weekly_data,
                discipline_framing,
                guilt_orientation,
                tone_type,
            )
            if not ok and failed:
                logger.warning(
                    "Report verification failed user=%s checks=%s", user_id, failed
                )
                failed_joined = " ".join(failed).lower()
                regen_twin = "check 5" in failed_joined
                try:
                    if regen_twin:
                        twin_sections = await generate_twin_voice_sections(
                            weekly_data=weekly_data,
                            tone_type=tone_type,
                            intensity=intensity,
                            previous_twin_openings=prev_twin_openings,
                            pending_difficulty_note=pending_note,
                            discipline_framing=discipline_framing,
                            guilt_orientation=guilt_orientation,
                            narrative_seed=narrative_seed,
                            interest_arcs=enriched.get("interest_arcs") or [],
                            quit_progress=enriched.get("quit_progress") or [],
                            twin_challenge=enriched.get("twin_challenge") or {},
                        )
                    else:
                        system_sections = await generate_system_voice_sections(
                            weekly_data=weekly_data,
                            previous_wins_w1=prev_wins_w1,
                            previous_wins_w2=prev_wins_w2,
                            previous_slipped_w1=prev_slipped_w1,
                            previous_slipped_w2=prev_slipped_w2,
                            discipline_framing=discipline_framing,
                            guilt_orientation=guilt_orientation,
                            narrative_seed=narrative_seed,
                            interest_arcs=enriched.get("interest_arcs") or [],
                            quit_progress=enriched.get("quit_progress") or [],
                            twin_challenge=enriched.get("twin_challenge") or {},
                            memory_anchors=enriched.get("memory_anchors") or [],
                            prev_report_wins_openings=enriched.get("prev_wins_openings")
                            or [],
                            prev_report_twin_openings=enriched.get("prev_twin_openings")
                            or [],
                        )
                    ok2, failed2 = await _verify_report(
                        system_sections,
                        twin_sections,
                        weekly_data,
                        discipline_framing,
                        guilt_orientation,
                        tone_type,
                    )
                    if not ok2 and failed2:
                        logger.warning(
                            "Report verification failed again user=%s checks=%s",
                            user_id,
                            failed2,
                        )
                except Exception as regen_e:
                    logger.warning("Report regeneration after verify failed: %s", regen_e)
    except Exception as ver_e:
        logger.debug("Report verification skipped: %s", ver_e)

    d = weekly_data
    wins = (
        system_sections.wins
        if system_sections
        else [f"You completed {d['missions_completed']} of {d['missions_total']} missions this week."]
    )
    slipped_list: list[str] = (
        list(system_sections.slipped)
        if system_sections and system_sections.slipped
        else []
    )
    keep_lines: list[str] = []
    if system_sections and system_sections.keep_watching:
        keep_lines = [system_sections.keep_watching]

    twin_paragraph = (
        twin_sections.twin_paragraph if twin_sections else "The week is done. The data is honest."
    )
    twin_closing = twin_sections.twin_closing if twin_sections else "Next week begins now."
    next_week = twin_sections.next_week if twin_sections else "The plan continues."

    wins_opening = _opening_words(wins[0]) if wins else ""
    twin_opening = _opening_words(twin_paragraph)
    theme_used = (system_sections.theme if system_sections and system_sections.theme else "").strip()
    if not theme_used:
        theme_used = "momentum" if d["completion_rate"] >= 0.7 else "recovery"

    this_week_data = {
        "missions": f"{d['missions_completed']}/{d['missions_total']}",
        "missions_completed": d["missions_completed"],
        "missions_total": d["missions_total"],
        "core_days": f"{d['days_all_core']}/7",
        "core_days_complete": d["days_all_core"],
        "core_days_total": 7,
        "xp_earned": d["xp_earned"],
        "pf_earned": d["pf_earned"],
        "pet_food_earned": d["pf_earned"],
        "streak": d["current_streak"],
        "current_streak": d["current_streak"],
        "longest_streak": d["longest_streak"],
        "streak_events": d["streak_events"],
        "stage": d["character_stage_name"],
        "stage_evolved": d["stage_changed_to"],
        "pet": d["pet_name"],
        "pet_name": d["pet_name"],
        "pet_stage": d["pet_stage"],
        "pet_evolved": d["pet_evolved_to"],
        "gap_xp": d["gap_xp"],
        "user_is_ahead": d["user_is_ahead"],
        "display_lines": d["this_week_display"],
        "power_score": d["power_score"],
        "power_score_change": d["power_score_change"],
        "day_of_week_completion": d["day_of_week_completion"],
        "day_of_week_xp": d["day_of_week_xp"],
    }

    generated_at = datetime.now(timezone.utc).isoformat()

    supabase_admin.table("weekly_reports").upsert(
        {
            "user_id": user_id,
            "week_start": week_start_str,
            "week_end": week_end_str,
            "this_week_data": this_week_data,
            "wins": wins,
            "slipped": slipped_list,
            "keep_watching": keep_lines,
            "twin_paragraph": twin_paragraph,
            "twin_closing": twin_closing,
            "next_week": next_week,
            "wins_opening": wins_opening,
            "twin_opening": twin_opening,
            "theme_used": theme_used,
            "gap_xp_end": d["gap_xp"],
            "generated_at": generated_at,
        },
        on_conflict="user_id,week_start",
    ).execute()

    try:
        supabase_admin.table("discipline_dna").update({"pending_difficulty_change": None}).eq(
            "user_id", user_id
        ).execute()
    except Exception:
        logger.debug("clear pending_difficulty_change skipped for %s", user_id)

    return {
        **this_week_data,
        "wins": wins,
        "slipped": slipped_list,
        "keep_watching": keep_lines,
        "twin_paragraph": twin_paragraph,
        "twin_closing": twin_closing,
        "next_week": next_week,
        "wins_opening": wins_opening,
        "twin_opening": twin_opening,
        "theme_used": theme_used,
        "gap_xp_end": d["gap_xp"],
    }


# ── Day summary (LangChain, unchanged contract) ─────────────────────────────

DAY_SUMMARY_SYSTEM_PROMPT = """
Generate a 1-2 sentence archive entry for this user's day.
This appears in the Day Detail screen when they tap a date on their streak heatmap.

DATA:
Date:               {date}
Day number:         {day_number} (days since registration)
Missions completed: {completed}/{total}
Core done:          {core_done}/5
Streak count:       {streak_count} days
XP earned:          {xp_earned}
Notable events:     {notable_events}
DISCIPLINE FRAMING: {discipline_framing}
NARRATIVE SEED:     {narrative_seed}

RULES:
- Factual, not motivational. Never say "great job" or "well done".
- Reference a specific mission if notable (e.g. "All core missions done.")
- If streak broke: "The {{N}}-day streak ended here." — no shame, just fact.
- If all missions complete: "Every mission complete. {{streak_count}}-day streak."
- If notable event (evolved, pet unlocked, milestone): mention it.
- Maximum 2 sentences.
- Plain text only — no JSON, no markdown, no quotes.
- Write in second person past tense: "You completed..." not "The user..."
- DISCIPLINE FRAMING: apply the framing language to the generated sentence — keep it to 1-2 sentences max.
  identity → "You showed up as the person you're becoming."
  behavior → "5 of 6 missions completed. Movement skipped."
  control → "You controlled your morning. Evening slipped."
  (Use the spirit of these examples; do not copy verbatim if the data contradicts.)
"""


async def generate_day_summary(user_id: str, target_date: str) -> str:
    """
    Generates a 1-2 sentence archive entry for a specific day.
    Stored in daily_summaries table.
    Returns the summary text.

    Cached summaries are invalidated when mission completion / XP / streak stats
    for that day change (stats_fingerprint).
    """
    user_result = (
        supabase_admin.table("users")
        .select("registration_date, timezone, current_streak")
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = user_result.data or {}

    missions = (
        supabase_admin.table("missions")
        .select("type, completed, is_journal_mission")
        .eq("user_id", user_id)
        .eq("mission_date", target_date)
        .execute()
        .data
        or []
    )

    streak_rows = (
        supabase_admin.table("streak_log")
        .select("streak_count, streak_maintained, xp_earned")
        .eq("user_id", user_id)
        .eq("log_date", target_date)
        .execute()
        .data
        or []
    )
    streak_row0 = streak_rows[0] if streak_rows else None

    xp_rows = (
        supabase_admin.table("xp_log")
        .select("amount")
        .eq("user_id", user_id)
        .eq("log_date", target_date)
        .execute()
        .data
        or []
    )

    milestones = (
        supabase_admin.table("milestone_log")
        .select("milestone_type")
        .eq("user_id", user_id)
        .gte("earned_at", f"{target_date}T00:00:00")
        .lte("earned_at", f"{target_date}T23:59:59.999")
        .execute()
        .data
        or []
    )

    discipline_framing = "behavior"
    narrative_seed: str | None = None
    try:
        dna_ds = (
            supabase_admin.table("discipline_dna")
            .select("discipline_framing, narrative_seed")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        dr = (dna_ds.data or [None])[0] or {}
        discipline_framing = str(dr.get("discipline_framing") or "behavior")
        narrative_seed = dr.get("narrative_seed")
    except Exception:
        discipline_framing = "behavior"
        narrative_seed = None

    completed = sum(1 for m in missions if m.get("completed"))
    total = len(missions)
    core_done = sum(
        1
        for m in missions
        if m.get("type") == "core"
        and not m.get("is_journal_mission")
        and m.get("completed")
    )
    xp_earned = sum(r.get("amount", 0) for r in xp_rows)
    streak_count = int((streak_row0 or {}).get("streak_count", 0) or 0)

    notable = [m.get("milestone_type", "") for m in milestones if m.get("milestone_type")]
    notable_str = ", ".join(notable) if notable else "None"

    # Fingerprint: when any of these change, regenerate the LLM summary.
    ns = narrative_seed or ""
    stats_fingerprint = (
        f"{completed}|{total}|{core_done}|{xp_earned}|{streak_count}|{notable_str}|"
        f"{discipline_framing}|{ns}"
    )

    existing = (
        supabase_admin.table("daily_summaries")
        .select("summary_text, stats_fingerprint")
        .eq("user_id", user_id)
        .eq("summary_date", target_date)
        .execute()
        .data
    )

    if existing:
        row = existing[0]
        if row.get("stats_fingerprint") == stats_fingerprint and row.get("summary_text"):
            return row["summary_text"]

    try:
        reg_str = str(user.get("registration_date", ""))[:10]
        reg_date = date.fromisoformat(reg_str)
        target_d = date.fromisoformat(target_date)
        day_number = (target_d - reg_date).days + 1
    except Exception:
        day_number = 1

    prompt = DAY_SUMMARY_SYSTEM_PROMPT.format(
        date=target_date,
        day_number=day_number,
        completed=completed,
        total=total,
        core_done=core_done,
        streak_count=streak_count,
        xp_earned=xp_earned,
        notable_events=notable_str,
        discipline_framing=discipline_framing,
        narrative_seed=narrative_seed or "None",
    )

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.4,
        max_tokens=80,
        api_key=os.environ.get("OPENAI_API_KEY", ""),
    )

    try:
        response = await llm.ainvoke(
            [
                SystemMessage(content=prompt),
                HumanMessage(content="Generate the day summary."),
            ]
        )
        summary = (response.content or "").strip()
    except Exception:
        summary = f"You completed {completed} of {total} missions."

    supabase_admin.table("daily_summaries").upsert(
        {
            "user_id": user_id,
            "summary_date": target_date,
            "summary_text": summary,
            "stats_fingerprint": stats_fingerprint,
        },
        on_conflict="user_id,summary_date",
    ).execute()

    return summary
