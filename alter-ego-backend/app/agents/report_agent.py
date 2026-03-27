"""
Weekly report and day summary agents.

B29: Weekly report — Sunday 03:00 in the user's timezone (scheduler), GPT-4o-mini,
    weekly_reports. Two instructor-backed calls: system voice (wins/slipped) and
    twin voice (twin paragraph / next week). Section 1 from report_service only.

B30: Day summary — ~01:00 local with other nightly maintenance, daily_summaries.
"""

from __future__ import annotations

import logging
import os
from datetime import date, datetime, timezone
from typing import List, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field, field_validator, model_validator

from app.agents.base import run_agent
from app.core.supabase_client import supabase_admin
from app.services.mission_service import local_completed_week_bounds
from app.services.report_service import assemble_weekly_data

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


SYSTEM_VOICE_PROMPT = """You write the 'Your Wins' and 'Where You Slipped' sections of a weekly discipline report.

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


async def generate_system_voice_sections(
    weekly_data: dict,
    previous_wins_w1: list[str],
    previous_wins_w2: list[str],
    previous_slipped_w1: list[str],
    previous_slipped_w2: list[str],
) -> SystemVoiceReport:
    prev = ""
    if previous_wins_w1:
        prev += "\nLast week wins:\n" + "\n".join(f"  - {w}" for w in previous_wins_w1)
    if previous_wins_w2:
        prev += "\nTwo weeks ago wins:\n" + "\n".join(f"  - {w}" for w in previous_wins_w2)
    if previous_slipped_w1:
        prev += "\nLast week slipped:\n" + "\n".join(f"  - {s}" for s in previous_slipped_w1)
    if previous_slipped_w2:
        prev += "\nTwo weeks ago slipped:\n" + "\n".join(f"  - {s}" for s in previous_slipped_w2)

    d = weekly_data
    skipped_detail = (
        f"title '{d['most_skipped_mission_title']}' ({d['most_skipped_mission_count']} incomplete)"
        if d.get("most_skipped_mission_title")
        else f"type {d['most_skipped_type'] or 'none'} ({d['most_skipped_count']} incomplete)"
    )

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

Find what is specifically and actually true. 1 real win beats 3 hollow ones."""

    return await run_agent(
        system_prompt=SYSTEM_VOICE_PROMPT,
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
) -> TwinVoiceReport:
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

PREVIOUS TWIN PARAGRAPH OPENINGS (do not start twin_paragraph with the same first word):
{prev_openings}

The Twin responds to what this week means for the rivalry. It does not recap the data."""
    )

    return await run_agent(
        system_prompt=TWIN_VOICE_PROMPT,
        user_message=user_message,
        response_model=TwinVoiceReport,
        temperature=0.75,
        max_tokens=400,
        context_label=f"Report:TwinVoice:{tone_key}",
    )


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

    dna_result = (
        supabase_admin.table("discipline_dna")
        .select("twin_tone_type, twin_intensity, pending_difficulty_change")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    dna_row = (dna_result.data or [None])[0] or {}
    tone_type = str(dna_row.get("twin_tone_type") or "rival")
    intensity = int(dna_row.get("twin_intensity") or 3)
    pending_note = dna_row.get("pending_difficulty_change")

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
        )
    except Exception as e:
        logger.error("Report TwinVoiceAgent failed for %s: %s", user_id, e)
        twin_sections = None

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

RULES:
- Factual, not motivational. Never say "great job" or "well done".
- Reference a specific mission if notable (e.g. "All core missions done.")
- If streak broke: "The {{N}}-day streak ended here." — no shame, just fact.
- If all missions complete: "Every mission complete. {{streak_count}}-day streak."
- If notable event (evolved, pet unlocked, milestone): mention it.
- Maximum 2 sentences.
- Plain text only — no JSON, no markdown, no quotes.
- Write in second person past tense: "You completed..." not "The user..."
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
    stats_fingerprint = (
        f"{completed}|{total}|{core_done}|{xp_earned}|{streak_count}|{notable_str}"
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
