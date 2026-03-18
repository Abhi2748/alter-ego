"""
Weekly report and day summary agents.
B29: Weekly report — runs Sunday 03:00 UTC, GPT-4o-mini, stores in weekly_reports.
B30: Day summary — runs nightly 01:30 UTC, 1–2 sentence archive, stores in daily_summaries.
"""

from __future__ import annotations

import json
import logging
import os
import re
from collections import Counter
from datetime import date, timedelta
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.core.constants import PET_NAMES, STAGE_NAMES
from app.core.supabase_client import supabase_admin

logger = logging.getLogger(__name__)

# ── Weekly report system prompt ────────────────────────────────────────────

WEEKLY_REPORT_SYSTEM_PROMPT = """
You are generating a personal weekly discipline report for {username}.

This report is the only moment in the app that steps back and looks at
the whole week. It is not a dashboard refresh. It is a mirror — showing
the user exactly what happened, without softening and without guilt.

─────────────────────────────────────────────────────────
THIS WEEK'S DATA
─────────────────────────────────────────────────────────
Period:                  {week_start} to {week_end}
Days active:             {days_active}/7
Missions completed:      {missions_completed}/{missions_total}
Core complete days:      {core_complete_days}/7
XP earned:               {weekly_xp}
Pet Food earned:         {weekly_pf}
Current streak:          {current_streak} days
Streak events:           {streak_events}
Character stage:         {stage_name} (Stage {character_stage})
Stage evolved this week: {stage_evolved}
Pet stage:               {pet_name}
Pet evolved this week:   {pet_evolved}
Twin gap (start→end):    {gap_start_xp} XP → {gap_end_xp} XP ({gap_direction})
Most skipped mission:    {most_skipped} (skipped {skip_count}/7 days)
Interests worked:        {interests_worked}
Quit targets maintained: {quit_clean_days} clean days
Best day:                {best_day} ({best_day_count} missions)
Hardest day:             {hardest_day} ({hardest_day_count} missions)
Mission ratings given:   {ratings_given} (avg: {avg_rating}/5)
Personal missions:       {personal_count} created

─────────────────────────────────────────────────────────
ANTI-REPETITION (do NOT use these angles or openings)
─────────────────────────────────────────────────────────
Previous week wins opening:   {prev_wins_opening}
Previous week twin opening:   {prev_twin_opening}
Theme used 2 weeks ago:       {prev2_theme}

─────────────────────────────────────────────────────────
USER CONTEXT
─────────────────────────────────────────────────────────
Archetype:    {archetype}
Tone type:    {tone_type}
Intensity:    {intensity}/5

─────────────────────────────────────────────────────────
YOUR JOB
─────────────────────────────────────────────────────────
Generate 4 sections. Each must feel written specifically for THIS user
in THIS week — not a template with numbers filled in.

A user who reads 10 consecutive reports should feel each one noticed
something genuinely different about them.

SECTION 2 — YOUR WINS
Rules:
- 2-3 wins maximum. Factual. Never invented. Never inflated.
- Find what is specifically and actually true — even in a bad week.
- 1 real win is better than 3 hollow ones.
- NEVER: "you tried hard", "the important thing is showing up"
- ALWAYS: specific data. "You completed core missions on 5 of 7 days."
- In a genuinely bad week, wins may be small but they must be real.

SECTION 3 — WHERE YOU SLIPPED
Rules:
- 1-2 factual observations. No blame language.
- Perfect week: replace with "Keep Watching" — one forward observation.
- NEVER: "Unfortunately" / "You failed to" / "You should have"
- ALWAYS: "Movement was your most skipped mission — 3 of 7 days."
- key: "slipped" or "keep_watching" in JSON depending on which applies

SECTION 4 — YOUR TWIN THIS WEEK
Rules:
- Match {tone_type} exactly.
- The twin responds to what the gap data MEANS — not a summary.
- 1 paragraph (2-3 sentences) + 1 closing line (shorter and sharper).
- The closing line must hit harder than the paragraph.
- Reference specific gap numbers. Never generic.
- Occasionally (not every week) when genuinely relevant to THIS user's
  data: reference the Bhagavad Gita principle of action without attachment
  to outcome (§2.47). Never preachy. Only when the data calls for it.

SECTION 5 — NEXT WEEK
Rules:
- Twin voice. 1 sentence only.
- State an actual fact about next week: difficulty change, approaching
  milestone, gap situation, system adjustment.
- NOTHING motivational. Just what is actually true.
- Example: "Your guitar missions shift to Medium difficulty next week."
- Example: "Day 30 lands on Wednesday — your streak bonus fires then."
- Example: "No changes to your plan next week. The pattern is stable."

─────────────────────────────────────────────────────────
NOVELTY RULES
─────────────────────────────────────────────────────────
Your output must NOT:
- Start Section 2 with the same word or phrase as prev_wins_opening
- Use the same angle as the previous 2 weeks
- Open Section 4 the same way as prev_twin_opening
- Use "impressive", "amazing", "great" if used in previous reports

─────────────────────────────────────────────────────────
OUTPUT — return ONLY valid JSON, no preamble, no markdown fences
─────────────────────────────────────────────────────────
{{
  "wins": ["Win statement 1", "Win statement 2"],
  "slipped": ["Observation 1"] OR omit if perfect week,
  "keep_watching": ["Forward observation"] OR omit if not perfect week,
  "twin_paragraph": "2-3 sentence twin response in correct tone",
  "twin_closing": "Shorter, sharper closing line",
  "next_week": "One sentence forward-looking fact",
  "wins_opening": "First 3 words of wins[0] — for anti-repetition next week",
  "twin_opening": "First 3 words of twin_paragraph — for anti-repetition",
  "theme": "One word describing the angle of this report e.g. consistency/recovery/momentum"
}}
"""

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


def _safe_parse_report_json(raw: str) -> dict:
    """Strip markdown fences and parse JSON from LLM output."""
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


async def generate_weekly_report(user_id: str) -> dict:
    """
    Generates the weekly report for a user.
    Stores result in weekly_reports table.
    Returns the full report dict.
    """
    today = date.today()
    week_end = today - timedelta(days=(today.weekday() + 1))  # Last Sunday
    week_start = week_end - timedelta(days=6)  # Last Monday
    week_start_str = str(week_start)
    week_end_str = str(week_end)

    user_result = (
        supabase_admin.table("users")
        .select(
            "username, archetype, character_stage, pet_stage, "
            "pet_unlocked, current_streak, total_xp"
        )
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = user_result.data or {}

    dna_result = (
        supabase_admin.table("discipline_dna")
        .select("twin_tone_type, twin_intensity")
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    dna = dna_result.data or {}

    twin_result = (
        supabase_admin.table("twin_state")
        .select("twin_xp, current_gap_state")
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    twin = twin_result.data or {}

    streak_rows = (
        supabase_admin.table("streak_log")
        .select("*")
        .eq("user_id", user_id)
        .gte("log_date", week_start_str)
        .lte("log_date", week_end_str)
        .execute()
        .data
        or []
    )

    missions_rows = (
        supabase_admin.table("missions")
        .select("title, type, completed, difficulty, mission_date")
        .eq("user_id", user_id)
        .gte("mission_date", week_start_str)
        .lte("mission_date", week_end_str)
        .execute()
        .data
        or []
    )

    xp_rows = (
        supabase_admin.table("xp_log")
        .select("amount")
        .eq("user_id", user_id)
        .gte("log_date", week_start_str)
        .lte("log_date", week_end_str)
        .execute()
        .data
        or []
    )

    pf_rows = (
        supabase_admin.table("pf_log")
        .select("amount")
        .eq("user_id", user_id)
        .gte("log_date", week_start_str)
        .lte("log_date", week_end_str)
        .execute()
        .data
        or []
    )

    ratings_rows = (
        supabase_admin.table("mission_ratings")
        .select("rating")
        .eq("user_id", user_id)
        .gte("created_at", f"{week_start_str}T00:00:00")
        .lte("created_at", f"{week_end_str}T23:59:59.999")
        .execute()
        .data
        or []
    )

    days_active = len(set(r["log_date"] for r in streak_rows)) if streak_rows else 0
    missions_completed = sum(1 for m in missions_rows if m.get("completed"))
    missions_total = len(missions_rows)
    core_complete_days = sum(
        1 for r in streak_rows if (r.get("core_completed_count") or 0) >= 5
    )
    weekly_xp = sum(r.get("amount", 0) for r in xp_rows)
    weekly_pf = sum(r.get("amount", 0) for r in pf_rows)
    ratings_given = len(ratings_rows)
    avg_rating = (
        round(sum(r["rating"] for r in ratings_rows) / ratings_given, 1)
        if ratings_given > 0
        else 0
    )

    skipped = [
        m["title"]
        for m in missions_rows
        if not m.get("completed") and m.get("type") == "core"
    ]
    most_skipped_data = Counter(skipped).most_common(1)
    most_skipped = most_skipped_data[0][0] if most_skipped_data else "None"
    skip_count = most_skipped_data[0][1] if most_skipped_data else 0

    day_counts = {}
    for m in missions_rows:
        d = m["mission_date"]
        if d not in day_counts:
            day_counts[d] = {"done": 0, "total": 0}
        day_counts[d]["total"] += 1
        if m.get("completed"):
            day_counts[d]["done"] += 1

    if day_counts:
        best_day_entry = max(
            day_counts.items(), key=lambda x: x[1]["done"]
        )
        hardest_day_entry = min(
            day_counts.items(), key=lambda x: x[1]["done"]
        )
    else:
        best_day_entry = (None, {"done": 0, "total": 0})
        hardest_day_entry = (None, {"done": 0, "total": 0})

    best_day = best_day_entry[0] or "N/A"
    best_day_count = best_day_entry[1]["done"]
    hardest_day = hardest_day_entry[0] or "N/A"
    hardest_day_count = hardest_day_entry[1]["done"]

    interests_worked = list(
        set(
            str(m.get("interest_id", ""))
            for m in missions_rows
            if m.get("type") == "interest"
            and m.get("completed")
            and m.get("interest_id")
        )
    )

    streak_events = []
    for r in streak_rows:
        if not r.get("streak_maintained") and (r.get("streak_count") or 0) == 0:
            streak_events.append(f"Streak reset on {r['log_date']}")
        for milestone in (30, 60, 100, 200, 365):
            if r.get("streak_count") == milestone:
                streak_events.append(
                    f"Streak milestone: {r['streak_count']} days on {r['log_date']}"
                )
                break

    milestones_week = (
        supabase_admin.table("milestone_log")
        .select("milestone_type, earned_at")
        .eq("user_id", user_id)
        .gte("earned_at", f"{week_start_str}T00:00:00")
        .lte("earned_at", f"{week_end_str}T23:59:59.999")
        .execute()
        .data
        or []
    )

    stage_evolved = next(
        (m["milestone_type"] for m in milestones_week if (m.get("milestone_type") or "").startswith("stage_")),
        None,
    )
    pet_evolved = next(
        (m["milestone_type"] for m in milestones_week if (m.get("milestone_type") or "").startswith("pet_stage_")),
        None,
    )

    personal_count = sum(1 for m in missions_rows if m.get("type") == "personal")

    quit_rows = (
        supabase_admin.table("quit_targets")
        .select("clean_days")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data
        or []
    )
    quit_clean_days = sum(q.get("clean_days", 0) for q in quit_rows)

    user_xp_now = user.get("total_xp", 0) or 0
    twin_xp_now = twin.get("twin_xp", 0) or 0
    gap_end_xp = abs(user_xp_now - twin_xp_now)
    user_is_ahead = user_xp_now > twin_xp_now
    gap_direction = "user ahead" if user_is_ahead else "twin ahead"

    prev_reports = (
        supabase_admin.table("weekly_reports")
        .select("wins_opening, twin_opening, theme_used")
        .eq("user_id", user_id)
        .order("week_start", desc=True)
        .limit(2)
        .execute()
        .data
        or []
    )

    prev_wins_opening = prev_reports[0].get("wins_opening", "None") if prev_reports else "None"
    prev_twin_opening = prev_reports[0].get("twin_opening", "None") if prev_reports else "None"
    prev2_theme = prev_reports[1].get("theme_used", "None") if len(prev_reports) > 1 else "None"

    stage_name = STAGE_NAMES[(user.get("character_stage") or 1) - 1]
    pet_stage = user.get("pet_stage") or 0
    pet_name = (
        PET_NAMES[pet_stage - 1]
        if pet_stage > 0 and user.get("pet_unlocked")
        else "No pet yet"
    )

    prompt = WEEKLY_REPORT_SYSTEM_PROMPT.format(
        username=user.get("username", "you"),
        week_start=week_start_str,
        week_end=week_end_str,
        days_active=days_active,
        missions_completed=missions_completed,
        missions_total=missions_total,
        core_complete_days=core_complete_days,
        weekly_xp=weekly_xp,
        weekly_pf=weekly_pf,
        current_streak=user.get("current_streak", 0),
        streak_events=", ".join(streak_events) if streak_events else "None",
        character_stage=user.get("character_stage", 1),
        stage_name=stage_name,
        stage_evolved=stage_evolved or "No",
        pet_name=pet_name,
        pet_evolved=pet_evolved or "No",
        gap_start_xp="N/A",
        gap_end_xp=gap_end_xp,
        gap_direction=gap_direction,
        most_skipped=most_skipped,
        skip_count=skip_count,
        interests_worked=len(interests_worked),
        quit_clean_days=quit_clean_days,
        best_day=best_day,
        best_day_count=best_day_count,
        hardest_day=hardest_day,
        hardest_day_count=hardest_day_count,
        ratings_given=ratings_given,
        avg_rating=avg_rating,
        personal_count=personal_count,
        prev_wins_opening=prev_wins_opening,
        prev_twin_opening=prev_twin_opening,
        prev2_theme=prev2_theme,
        archetype=user.get("archetype", "structured_climber"),
        tone_type=dna.get("twin_tone_type", "rival"),
        intensity=dna.get("twin_intensity", 3),
    )

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.6,
        max_tokens=800,
        api_key=os.environ.get("OPENAI_API_KEY", ""),
    )

    try:
        response = await llm.ainvoke([
            SystemMessage(content=prompt),
            HumanMessage(content="Generate this user's weekly report."),
        ])
        report_data = _safe_parse_report_json(response.content)
    except Exception as e:
        logger.warning("Weekly report LLM failed for user %s: %s", user_id, e)
        report_data = {
            "wins": [f"You completed {missions_completed} of {missions_total} missions this week."],
            "slipped": [],
            "keep_watching": [],
            "twin_paragraph": "The week is done. The data is honest.",
            "twin_closing": "Next week begins now.",
            "next_week": "Keep going.",
            "wins_opening": "You completed",
            "twin_opening": "The week",
            "theme": "recovery",
        }

    this_week_data = {
        "missions": f"{missions_completed}/{missions_total}",
        "core_days": f"{core_complete_days}/7",
        "xp_earned": weekly_xp,
        "pf_earned": weekly_pf,
        "streak": user.get("current_streak", 0),
        "streak_events": streak_events,
        "stage": stage_name,
        "stage_evolved": stage_evolved,
        "pet": pet_name,
        "pet_evolved": pet_evolved,
        "gap_xp": gap_end_xp,
        "user_is_ahead": user_is_ahead,
    }

    supabase_admin.table("weekly_reports").upsert(
        {
            "user_id": user_id,
            "week_start": week_start_str,
            "week_end": week_end_str,
            "this_week_data": this_week_data,
            "wins": report_data.get("wins", []),
            "slipped": report_data.get("slipped", []),
            "keep_watching": report_data.get("keep_watching", []),
            "twin_paragraph": report_data.get("twin_paragraph", ""),
            "twin_closing": report_data.get("twin_closing", ""),
            "next_week": report_data.get("next_week", ""),
            "wins_opening": report_data.get("wins_opening", ""),
            "twin_opening": report_data.get("twin_opening", ""),
            "theme_used": report_data.get("theme", ""),
        },
        on_conflict="user_id,week_start",
    ).execute()

    return {**this_week_data, **report_data}


async def generate_day_summary(user_id: str, target_date: str) -> str:
    """
    Generates a 1-2 sentence archive entry for a specific day.
    Stored in daily_summaries table.
    Returns the summary text.
    """
    existing = (
        supabase_admin.table("daily_summaries")
        .select("summary_text")
        .eq("user_id", user_id)
        .eq("summary_date", target_date)
        .execute()
        .data
    )

    if existing:
        return existing[0]["summary_text"]

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

    streak_row = (
        supabase_admin.table("streak_log")
        .select("streak_count, streak_maintained, xp_earned")
        .eq("user_id", user_id)
        .eq("log_date", target_date)
        .execute()
        .data
    )

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
    streak_count = streak_row[0].get("streak_count", 0) if streak_row else 0

    notable = [m.get("milestone_type", "") for m in milestones if m.get("milestone_type")]
    notable_str = ", ".join(notable) if notable else "None"

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
        response = await llm.ainvoke([
            SystemMessage(content=prompt),
            HumanMessage(content="Generate the day summary."),
        ])
        summary = (response.content or "").strip()
    except Exception:
        summary = f"You completed {completed} of {total} missions."

    supabase_admin.table("daily_summaries").upsert(
        {
            "user_id": user_id,
            "summary_date": target_date,
            "summary_text": summary,
        },
        on_conflict="user_id,summary_date",
    ).execute()

    return summary
