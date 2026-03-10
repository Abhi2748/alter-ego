"""
Weekly Report Agent (J5) — §4–6. Monday 03:00 UTC job. Single GPT-4o-mini call per user.
Section 1 = pure data from DB. Sections 2–5 = LLM (wins, slipped, twin, next_week).
Anti-repetition: inject previous 2 weeks' wins/slipped/twin_paragraph opening.
"""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

import httpx
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from utils.supabase_client import get_supabase
from utils.day_of_week import get_day_of_week_completion

STAGE_NAMES = [
    "The Awakened", "The Focused", "The Burning",
    "The Relentless", "The Formidable", "The Sovereign",
]
PET_STAGE_NAMES = {
    1: "Cub", 2: "Cat", 3: "Fox", 4: "Wolf",
    5: "Snow Leopard", 6: "Panther", 7: "Griffin", 8: "Dragon",
}
STREAK_MILESTONES = [3, 7, 10, 14, 30, 60, 100, 180, 365]


def get_report_week(run_date: Optional[date] = None) -> Tuple[date, date]:
    """
    Report covers full Mon–Sun week that ended the previous day.
    When cron runs Monday 03:00 UTC: week_end = Sunday (yesterday), week_start = Monday 6 days ago.
    """
    d = run_date or date.today()
    # week_end = most recent Sunday (yesterday when run_date is Monday)
    days_back_to_sunday = (d.weekday() + 1) if d.weekday() < 6 else 7
    week_end = d - timedelta(days=days_back_to_sunday)
    # week_start = Monday of that week (6 days before Sunday)
    week_start = week_end - timedelta(days=6)
    return week_start, week_end


def _week_dates(week_start: date, week_end: date) -> List[date]:
    out = []
    d = week_start
    while d <= week_end:
        out.append(d)
        d += timedelta(days=1)
    return out


def fetch_week_data(supabase, user_id: str, week_start: date, week_end: date) -> Dict[str, Any]:
    """Gather all data for Section 1 and LLM input."""
    week_dates = _week_dates(week_start, week_end)
    week_start_iso = week_start.isoformat()
    week_end_iso = week_end.isoformat()

    # Streak log for the week: core_completed, xp_earned, pet_food_earned
    sl = (
        supabase.table("streak_log")
        .select("date, core_completed, xp_earned, pet_food_earned")
        .eq("user_id", user_id)
        .gte("date", week_start_iso)
        .lte("date", week_end_iso)
        .execute()
    )
    streak_rows = sl.data or []
    by_date = {r["date"]: r for r in streak_rows}
    core_days_complete = sum(1 for r in streak_rows if int(r.get("core_completed", 0)) >= 5)
    xp_earned = sum(int(r.get("xp_earned", 0)) for r in streak_rows)
    pet_food_earned = sum(int(r.get("pet_food_earned", 0)) for r in streak_rows)

    # Missions expiring in the week
    start_ts = datetime.combine(week_start, datetime.min.time(), tzinfo=timezone.utc).isoformat()
    end_ts = datetime.combine(week_end, datetime.max.time(), tzinfo=timezone.utc).isoformat()
    ms = (
        supabase.table("missions")
        .select("id, type, pillar, completed_at")
        .eq("user_id", user_id)
        .gte("expires_at", start_ts)
        .lte("expires_at", end_ts)
        .execute()
    )
    missions = ms.data or []
    total_missions = len(missions)
    completed_missions = sum(1 for m in missions if m.get("completed_at"))
    # Most skipped type: by type, count uncompleted
    skip_by_type: Dict[str, int] = {}
    for m in missions:
        if not m.get("completed_at"):
            t = m.get("type") or "unknown"
            if t == "core":
                t = f"core_{m.get('pillar') or 'unknown'}"
            skip_by_type[t] = skip_by_type.get(t, 0) + 1
    most_skipped_type = "none"
    most_skipped_days = 0
    if skip_by_type:
        k = max(skip_by_type, key=skip_by_type.get)
        most_skipped_type = k
        most_skipped_days = skip_by_type[k]

    # Leaderboard / streak
    lb = supabase.table("leaderboard_scores").select("streak").eq("user_id", user_id).maybe_single().execute()
    current_streak = int((lb.data or {}).get("streak", 0))

    # Character and pet
    cr = supabase.table("character_state").select("stage, total_xp, last_updated").eq("user_id", user_id).maybe_single().execute()
    char_data = cr.data or {}
    char_stage = int(char_data.get("stage", 1))
    total_xp = int(char_data.get("total_xp", 0))
    character_stage_name = STAGE_NAMES[min(char_stage - 1, len(STAGE_NAMES) - 1)]

    pr = supabase.table("pet_state").select("stage, last_updated").eq("user_id", user_id).maybe_single().execute()
    pet_data = pr.data or {}
    pet_stage = int(pet_data.get("stage", 0))
    pet_name = PET_STAGE_NAMES.get(pet_stage, "companion") if pet_stage else "Cub"

    # Twin gap
    tr = supabase.table("twin_state").select("twin_xp").eq("user_id", user_id).maybe_single().execute()
    twin_xp = int((tr.data or {}).get("twin_xp", 0))
    gap_xp = max(0, twin_xp - total_xp)

    # User discipline_dna
    ur = supabase.table("users").select("discipline_dna").eq("id", user_id).maybe_single().execute()
    dna = (ur.data or {}).get("discipline_dna") or {}
    tone_type = dna.get("tone_type") or dna.get("twin_tone_type") or "rival"

    # Streak status this week: simplified (INTACT / BROKEN_AND_RESET / NEW_RECORD)
    streak_status = "INTACT"
    if not streak_rows and current_streak == 0:
        streak_status = "BROKEN_AND_RESET"
    elif current_streak > 0 and core_days_complete == len(week_dates):
        streak_status = "INTACT"

    # Next milestone
    next_milestone = ""
    days_to_milestone = None
    for m in STREAK_MILESTONES:
        if m > current_streak:
            next_milestone = f"{m}-day streak"
            days_to_milestone = m - current_streak
            break

    # Stage/pet change this week (heuristic: last_updated in week)
    char_updated = char_data.get("last_updated")
    pet_updated = pet_data.get("last_updated")
    stage_change_this_week = "NO"
    if char_updated:
        try:
            if isinstance(char_updated, str):
                u = datetime.fromisoformat(char_updated.replace("Z", "+00:00")).date()
            else:
                u = char_updated.date() if hasattr(char_updated, "date") else week_start
            if week_start <= u <= week_end and char_stage > 1:
                stage_change_this_week = f"YES: upgraded to {character_stage_name}"
        except Exception:
            pass
    pet_change_this_week = "NO"
    if pet_updated and pet_stage > 0:
        try:
            if isinstance(pet_updated, str):
                u = datetime.fromisoformat(pet_updated.replace("Z", "+00:00")).date()
            else:
                u = pet_updated.date() if hasattr(pet_updated, "date") else week_start
            if week_start <= u <= week_end:
                pet_change_this_week = f"YES: evolved to {pet_name}"
        except Exception:
            pass

    # Previous 2 weeks for anti-repetition
    prev_start = week_start - timedelta(days=14)
    prev_reports = (
        supabase.table("weekly_reports")
        .select("week_start, wins, slipped, twin_paragraph")
        .eq("user_id", user_id)
        .gte("week_start", prev_start.isoformat())
        .lt("week_start", week_start.isoformat())
        .order("week_start", desc=False)
        .limit(2)
        .execute()
    )
    prev_rows = (prev_reports.data or [])[-2:]
    wins_w2 = slipped_w2 = twin_open_w2 = ""
    wins_w1 = slipped_w1 = twin_open_w1 = ""
    if len(prev_rows) >= 2:
        w2 = prev_rows[0]
        wins_w2 = json.dumps(w2.get("wins") or [])
        slipped_w2 = json.dumps(w2.get("slipped") or [])
        twin_open_w2 = (w2.get("twin_paragraph") or "")[:200]
    if len(prev_rows) >= 1:
        w1 = prev_rows[-1]
        wins_w1 = json.dumps(w1.get("wins") or [])
        slipped_w1 = json.dumps(w1.get("slipped") or [])
        twin_open_w1 = (w1.get("twin_paragraph") or "")[:200]

    day_of_week_completion = get_day_of_week_completion(supabase, user_id, days=30)

    return {
        "week_start": week_start,
        "week_end": week_end,
        "missions_completed": completed_missions,
        "missions_total": total_missions,
        "core_days_complete": core_days_complete,
        "core_days_total": len(week_dates),
        "xp_earned": xp_earned,
        "pet_food_earned": pet_food_earned,
        "current_streak": current_streak,
        "streak_status": streak_status,
        "most_skipped_type": most_skipped_type,
        "most_skipped_days": most_skipped_days,
        "character_stage": char_stage,
        "character_stage_name": character_stage_name,
        "stage_change_this_week": stage_change_this_week,
        "pet_stage": pet_stage,
        "pet_name": pet_name,
        "pet_change_this_week": pet_change_this_week,
        "gap_xp": gap_xp,
        "tone_type": tone_type,
        "next_milestone": next_milestone,
        "days_to_milestone": days_to_milestone,
        "difficulty_change_next_week": "NO",
        "wins_w2": wins_w2,
        "slipped_w2": slipped_w2,
        "twin_open_w2": twin_open_w2,
        "wins_w1": wins_w1,
        "slipped_w1": slipped_w1,
        "twin_open_w1": twin_open_w1,
        "day_of_week_completion": day_of_week_completion,
    }


def build_this_week_data(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Section 1 data for storage and display."""
    out = {
        "missions_completed": ctx["missions_completed"],
        "missions_total": ctx["missions_total"],
        "core_days_complete": ctx["core_days_complete"],
        "core_days_total": ctx["core_days_total"],
        "xp_earned": ctx["xp_earned"],
        "pet_food_earned": ctx["pet_food_earned"],
        "current_streak": ctx["current_streak"],
        "streak_status": ctx["streak_status"],
        "character_stage_name": ctx["character_stage_name"],
        "character_stage": ctx["character_stage"],
        "stage_change_this_week": ctx["stage_change_this_week"],
        "pet_name": ctx["pet_name"],
        "pet_stage": ctx["pet_stage"],
        "pet_change_this_week": ctx["pet_change_this_week"],
    }
    if "day_of_week_completion" in ctx:
        out["day_of_week_completion"] = ctx["day_of_week_completion"]
    return out


REPORT_SYSTEM_PROMPT = """# REPORT AGENT — Weekly Report Generation

# USER DATA THIS WEEK
→ Missions completed: {missions_completed} of {missions_total}
→ Core completion: {core_days_complete} of {core_days_total} days all-Core complete
→ XP earned: {xp_earned}
→ Pet Food earned: {pet_food_earned}
→ Current streak: {current_streak} days
→ Streak status this week: {streak_status}
→ Most skipped mission type: {most_skipped_type} ({most_skipped_days} of 7 days skipped)
→ Character stage: {character_stage_name} (Stage {character_stage})
→ Stage change this week: {stage_change_this_week}
→ Pet stage: {pet_name} (Stage {pet_stage})
→ Pet change this week: {pet_change_this_week}
→ Twin XP gap: {gap_xp} XP behind Twin
→ Twin tone type: {tone_type}
→ Difficulty change next week: {difficulty_change_next_week}
→ Next milestone: {next_milestone} in {days_to_milestone} days

# PREVIOUS TWO WEEKS — DO NOT REPEAT
→ Two weeks ago wins: {wins_w2}
→ Two weeks ago slipped: {slipped_w2}
→ Two weeks ago twin_paragraph opening: {twin_open_w2}
→ Last week wins: {wins_w1}
→ Last week slipped: {slipped_w1}
→ Last week twin_paragraph opening: {twin_open_w1}

# YOUR JOB
→ Generate four sections in the exact JSON format below.
→ Use ONLY the data provided. Do not invent facts.
→ Sections 1-3 (wins, slipped, keep_watching): NEUTRAL SYSTEM VOICE.
   - Direct, specific, factual. No adjectives of quality (great, poor, impressive).
   - No motivational language. No "the important thing is..."
   - If week was bad: find what is specifically and actually true. 1 real win > 3 hollow ones.
→ Section 4 (twin_response): TWIN VOICE matching tone_type.
   - rival: competitive, cold, declarative. References the gap as a fact.
   - philosopher: reflective, principled. References process and compounding.
   - silent_force: 1-3 sentences maximum. Sparse. Often just facts + one word.
   - Twin does NOT recap the week. Twin RESPONDS to it.
   - closing_line is always shorter and sharper than the paragraph.
→ Section 5 (next_week): TWIN VOICE. One sentence. States a fact about next week.

→ ANTI-REPETITION: Do not open any win or slip with the same first word as
   the previous two weeks. Do not use the same core observation.
   Do not open twin_paragraph with the same word or sentence structure as the previous two openings listed above.

NEVER:
NEVER use guilt language in any section.
NEVER say "you failed", "unfortunately", "you struggled."
NEVER invent a win that is not in the data.
NEVER write more than 3 wins or 2 slipped observations.
NEVER break the Twin's character in the twin_response section.

# OUTPUT FORMAT — JSON only, no preamble, no markdown
{{
  "wins": ["string", "string"],
  "slipped": ["string"],
  "keep_watching": null or "string (only if perfect week, replaces slipped)",
  "twin_paragraph": "string",
  "twin_closing": "string",
  "next_week": "string"
}}"""


def build_report_prompt(ctx: Dict[str, Any]) -> str:
    return REPORT_SYSTEM_PROMPT.format(
        missions_completed=ctx["missions_completed"],
        missions_total=ctx["missions_total"],
        core_days_complete=ctx["core_days_complete"],
        core_days_total=ctx["core_days_total"],
        xp_earned=ctx["xp_earned"],
        pet_food_earned=ctx["pet_food_earned"],
        current_streak=ctx["current_streak"],
        streak_status=ctx["streak_status"],
        most_skipped_type=ctx["most_skipped_type"],
        most_skipped_days=ctx["most_skipped_days"],
        character_stage_name=ctx["character_stage_name"],
        character_stage=ctx["character_stage"],
        stage_change_this_week=ctx["stage_change_this_week"],
        pet_name=ctx["pet_name"],
        pet_stage=ctx["pet_stage"],
        pet_change_this_week=ctx["pet_change_this_week"],
        gap_xp=ctx["gap_xp"],
        tone_type=ctx["tone_type"],
        difficulty_change_next_week=ctx["difficulty_change_next_week"],
        next_milestone=ctx["next_milestone"],
        days_to_milestone=ctx.get("days_to_milestone") or 0,
        wins_w2=ctx["wins_w2"],
        slipped_w2=ctx["slipped_w2"],
        twin_open_w2=ctx["twin_open_w2"],
        wins_w1=ctx["wins_w1"],
        slipped_w1=ctx["slipped_w1"],
        twin_open_w1=ctx["twin_open_w1"],
    )


def _parse_report_json(raw: str) -> Optional[Dict[str, Any]]:
    """Extract JSON from model output (may be wrapped in markdown)."""
    raw = raw.strip()
    # Try to find JSON block
    m = re.search(r"\{[\s\S]*\}", raw)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def generate_report(prompt: str) -> Optional[Dict[str, Any]]:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.4, max_tokens=800)
    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content="Output only the JSON object. No other text."),
    ]
    resp = llm.invoke(messages)
    text = (resp.content or "").strip() if hasattr(resp, "content") else str(resp).strip()
    return _parse_report_json(text)


def _send_report_push(push_token: str, tone_type: str) -> bool:
    """Sunday morning push: one Twin-voiced line teasing the report."""
    bodies = {
        "rival": "Your week is ready. I read it.",
        "philosopher": "The week is done. Come see what it was.",
        "silent_force": "Weekly report.",
    }
    body = bodies.get(tone_type, bodies["rival"])
    if not push_token:
        return False
    url = "https://exp.host/--/api/v2/push/send"
    payload = {"to": push_token, "title": "ALTER EGO", "body": body, "sound": "default"}
    try:
        with httpx.Client(timeout=10.0) as client:
            r = client.post(url, json=payload)
            return r.status_code == 200
    except Exception:
        return False


def run_report_for_user(user_id: str, week_start: date, week_end: date) -> Tuple[bool, Optional[str]]:
    """Generate and store weekly report for one user. Returns (success, error_message)."""
    supabase = get_supabase()
    ctx = fetch_week_data(supabase, user_id, week_start, week_end)
    this_week_data = build_this_week_data(ctx)
    prompt = build_report_prompt(ctx)
    report = generate_report(prompt)
    if not report:
        # Fallback: store data only
        report = {
            "wins": ["Your data for this week is recorded above."],
            "slipped": [],
            "keep_watching": None,
            "twin_paragraph": "Your report is ready. Open the Report tab to see your week.",
            "twin_closing": "Next week.",
            "next_week": "No changes to your plan next week.",
        }
    wins = report.get("wins") or []
    slipped = report.get("slipped") or []
    keep_watching = report.get("keep_watching")
    twin_paragraph = report.get("twin_paragraph") or ""
    twin_closing = report.get("twin_closing") or ""
    next_week = report.get("next_week") or ""

    row = {
        "user_id": user_id,
        "week_start": week_start.isoformat(),
        "this_week_data": this_week_data,
        "wins": wins,
        "slipped": slipped,
        "keep_watching": keep_watching,
        "twin_paragraph": twin_paragraph,
        "twin_closing": twin_closing,
        "next_week": next_week,
    }
    try:
        supabase.table("weekly_reports").delete().eq("user_id", user_id).eq("week_start", week_start.isoformat()).execute()
    except Exception:
        pass
    supabase.table("weekly_reports").insert(row).execute()

    # Optional: send Sunday push (8am local or activity window — here we don't have user timezone in this function; caller can send push)
    return True, None


def run_report_pass() -> Dict[str, Any]:
    """Run report generation for all users. Call Monday 03:00 UTC. Optionally send report tease push."""
    supabase = get_supabase()
    week_start, week_end = get_report_week()
    r = supabase.table("users").select("id, push_token, discipline_dna").execute()
    users = r.data or []
    generated = 0
    errors = []
    for u in users:
        user_id = u.get("id")
        if not user_id:
            continue
        try:
            ok, err = run_report_for_user(user_id, week_start, week_end)
            if ok:
                generated += 1
                dna = u.get("discipline_dna") or {}
                tone = dna.get("tone_type") or dna.get("twin_tone_type") or "rival"
                push_token = u.get("push_token")
                if push_token:
                    _send_report_push(push_token, tone)
            else:
                errors.append(f"{user_id}: {err}")
        except Exception as e:
            errors.append(f"{user_id}: {e!s}")
    return {"generated": generated, "errors": errors, "week_start": week_start.isoformat(), "week_end": week_end.isoformat()}


if __name__ == "__main__":
    # Verify report week when cron runs Monday 03:00 UTC
    monday = date(2025, 3, 10)
    week_start, week_end = get_report_week(monday)
    print(f"When run_date is Monday {monday}: week_start={week_start} (Mon), week_end={week_end} (Sun)")
    assert week_end == date(2025, 3, 9), f"week_end should be Sunday 2025-03-09, got {week_end}"
    assert week_start == date(2025, 3, 3), f"week_start should be Monday 2025-03-03, got {week_start}"
    print("OK: Report week is Mon–Sun (run Monday 03:00 UTC).")
