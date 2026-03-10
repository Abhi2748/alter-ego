"""Planner Agent (J2) — Interest + Escaper missions (Twin Design §3.4, §4.3, §7.1).

This agent is called once per interest/quit target per day in a nightly job
via POST /agents/plan. It uses GPT-4o-mini with two distinct system prompts:

- Interest mission generation
- Quit-target (Escaper) replacement mission generation

Difficulty adaptation (§7.1) is evidence-based only; tiers come from
interest_progress.current_tier. run_difficulty_adaptation() runs at the
start of each plan cycle.
"""

from __future__ import annotations

from datetime import date, datetime, timezone, timedelta
from typing import Any, Dict, List, Tuple, Optional

from langchain_openai import ChatOpenAI

from utils.supabase_client import get_supabase

# Tier 1–4 map to prompt tier names
TIER_TO_STR = {1: "easy", 2: "medium", 3: "hard", 4: "elite"}


INTEREST_PROMPT_TEMPLATE = """# PLANNER AGENT — INTEREST MISSION GENERATION

# CONTEXT
→ User name: {username}
→ Interest: {interest}
→ Self-reported level: {level}
→ Current difficulty tier: {tier}
→ Current phase: {phase}
→ Available time today: {available_minutes} minutes
→ Archetype: {archetype}
→ Completion rate last 10 days: {completion_rate_percent}%
→ Last mission for this interest: {last_mission_text}

# YOUR JOB
→ Generate ONE mission for this user for {interest}.
→ The mission must be completable in under {available_minutes} minutes.
→ The mission must match the {tier} difficulty tier.
→ The mission must match the {phase} progression phase.
→ Do NOT repeat {last_mission_text}. Generate something meaningfully different.
{skip_style_line}

# DIFFICULTY RULES
→ Easy: Single specific action, 10-25 min, success guaranteed if attempted.
→ Medium: Specific output produced, 25-45 min, requires genuine focus.
→ Hard: Sustained discomfort or skill, 45-75 min, cannot be done on autopilot.
→ Elite: Public commitment or qualitative leap, 60-90 min, doing it at full commitment.

# PHASE RULES
→ Days 1-10: Show up only. No output required. Presence is the mission.
→ Days 11-30: Produce something specific. Output matters.
→ Days 31-60: Improve quality. Refinement and skill.
→ Days 61-90: Push the edge of capability. Discomfort is intentional.
→ Day 90+: Performance, multi-day, or public commitment.

# MISSION FORMAT RULES
→ Start with an action verb. Never start with "Try to" or "Attempt to."
→ Be specific. "Practice for 20 minutes" is worse than "Run one scale at full speed, slow tempo, three times."
→ Never mention outcomes or results. "Run 5km" is ok. "Run 5km to burn calories" is not.
→ Never use guilt language. Never say "finally" or "you've been avoiding."
→ Maximum 2 sentences. Usually 1 is enough.
→ Tone: direct, clean, no filler words.

# OUTPUT
→ Return ONLY the mission text. No explanation. No preamble. No quotes.
→ Then on a new line: XP: [1/2/3/4] matching the tier.
→ Then on a new line: Duration: [X min]
"""

SKIP_STYLE_LINE = "\n→ The user has skipped the last few missions for this interest. Vary the format and style significantly.\n"


ESCAPER_PROMPT_TEMPLATE = """# PLANNER AGENT — QUIT TARGET MISSION GENERATION

# CONTEXT
→ User name: {username}
→ Quit target: {quit_target}
→ Current difficulty tier: {tier}
→ Current phase: {phase}
→ Available time today: {available_minutes} minutes
→ Archetype: {archetype}
→ Completion rate last 10 days: {completion_rate_percent}%
→ Last mission for this quit target: {last_mission_text}

# STEP 1 — IDENTIFY THE UNDERLYING NEED
→ Before generating a mission, identify what need {quit_target} serves.
→ Choose the primary need from: boredom/dopamine | stress/anxiety | social/ritual |
   impulsivity/gratification | avoidance/procrastination | comfort/oral
→ This determines the replacement behavior direction.

# STEP 2 — GENERATE THE REPLACEMENT MISSION
→ Generate ONE mission that is a positive replacement behavior.
→ The mission must DO something — never "don't do X" or "avoid X."
→ The replacement must genuinely address the underlying need identified in Step 1.
→ The mission must be completable in under {available_minutes} minutes.
→ The mission must match the {tier} difficulty tier and {phase} phase.
→ Do NOT repeat {last_mission_text}.

# PHASE RULES FOR QUIT TARGETS
→ Days 1-10: Awareness and first replacement. Simple, low-stakes substitution.
   The user is building the habit of noticing the urge and doing something else.
→ Days 11-30: Consistent replacement. The new behavior becomes a reflex.
   Missions are slightly more demanding and more specific.
→ Days 31-60: Environmental design. Change the conditions that trigger the habit.
   Remove cues, design the space, build friction into the old behavior.
→ Days 61-90: Identity-level missions. The user starts to identify as someone who
   does not do this. Missions reflect the new identity.
→ Day 90+: Consolidation and teaching. The user helps someone else or documents
   their experience. Sharing is the highest form of commitment.

# MISSION FORMAT RULES
→ Start with an action verb. Always positive. Never "don't", "avoid", "stop."
→ Be specific about WHEN and HOW. "When the urge hits, do X" is better than "do X today."
→ Never guilt. Never mention failure. Frame entirely around the new behavior.
→ Maximum 2 sentences.

# OUTPUT
→ Return ONLY the mission text. No explanation. No preamble.
→ Then: XP: [1/2/3/4]
→ Then: Duration: [X min]
→ Then: Need identified: [need category]
"""


def _llm() -> ChatOpenAI:
    return ChatOpenAI(model="gpt-4o-mini", temperature=0.4)


def _parse_interest_output(text: str) -> Tuple[str, int, int]:
    """Parse interest mission text → (title, xp_tier 1-4, duration_minutes)."""
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if not lines:
        raise ValueError("Empty planner output")
    title = lines[0]
    xp_tier = 2
    duration = 30
    for line in lines[1:]:
        if line.lower().startswith("xp:"):
            try:
                xp_tier = int(line.split(":", 1)[1].strip().split()[0])
            except Exception:
                pass
        elif line.lower().startswith("duration:"):
            try:
                val = line.split(":", 1)[1].strip().split()[0]
                duration = int(val)
            except Exception:
                pass
    xp_tier = max(1, min(4, xp_tier))
    return title, xp_tier, duration


def _parse_escaper_output(text: str) -> Tuple[str, int, int, Optional[str]]:
    """Parse escaper mission text → (title, xp_tier 1-4, duration_minutes, need_category)."""
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if not lines:
        raise ValueError("Empty planner output")
    title = lines[0]
    xp_tier = 2
    duration = 30
    need = None
    for line in lines[1:]:
        low = line.lower()
        if low.startswith("xp:"):
            try:
                xp_tier = int(line.split(":", 1)[1].strip().split()[0])
            except Exception:
                pass
        elif low.startswith("duration:"):
            try:
                val = line.split(":", 1)[1].strip().split()[0]
                duration = int(val)
            except Exception:
                pass
        elif low.startswith("need identified"):
            try:
                need = line.split(":", 1)[1].strip()
            except Exception:
                pass
    xp_tier = max(1, min(4, xp_tier))
    return title, xp_tier, duration, need


def _tier_to_difficulty(tier: int) -> str:
    """Map 1-4 tier → Easy/Medium/Hard/Hard (Elite uses Hard difficulty)."""
    if tier <= 1:
        return "Easy"
    if tier == 2:
        return "Medium"
    return "Hard"


def _phase_for_join_date(join_date: datetime) -> str:
    """Compute phase label from trial start / created_at date."""
    today = datetime.now(timezone.utc).date()
    days = (today - join_date.date()).days
    if days <= 10:
        return "days 1-10"
    if days <= 30:
        return "11-30"
    if days <= 60:
        return "31-60"
    if days <= 90:
        return "61-90"
    return "90+"


def _completion_rate_last_10_days(user_id: str) -> float:
    supabase = get_supabase()
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=10)).isoformat()
    mr = (
        supabase.table("missions")
        .select("completed_at, expires_at")
        .eq("user_id", user_id)
        .gte("expires_at", start)
        .lte("expires_at", now.isoformat())
        .execute()
    )
    rows = mr.data or []
    total = len(rows)
    if total == 0:
        return 0.0
    completed = sum(1 for r in rows if r.get("completed_at"))
    return completed / total


def _last_mission_for_interest(user_id: str, interest: str) -> str:
    supabase = get_supabase()
    r = (
        supabase.table("missions")
        .select("title")
        .eq("user_id", user_id)
        .eq("type", "interest")
        .eq("interest", interest)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if r.data:
        return r.data[0].get("title") or "None"
    return "None"


def _last_mission_for_quit_target(user_id: str, quit_target: str) -> str:
    supabase = get_supabase()
    r = (
        supabase.table("missions")
        .select("title")
        .eq("user_id", user_id)
        .eq("type", "recovery")
        .eq("interest", quit_target)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if r.data:
        return r.data[0].get("title") or "None"
    return "None"


def _available_minutes_from_hours(hours: float) -> int:
    return max(10, int(hours * 60))


def _end_of_today_utc() -> datetime:
    """End of current day UTC (23:59:59.999999). Same as missions route / generate_initial_missions style."""
    d = date.today()
    return datetime.combine(d, datetime.max.time(), tzinfo=timezone.utc)


def _get_tier_for_interest_or_quit(user_id: str, interest_or_quit: str) -> int:
    """Return current_tier (1–4) from interest_progress. Default 1 if row or column missing. Ensures row exists."""
    supabase = get_supabase()
    r = (
        supabase.table("interest_progress")
        .select("current_tier")
        .eq("user_id", user_id)
        .eq("interest", interest_or_quit)
        .maybe_single()
        .execute()
    )
    if r.data is not None:
        tier = r.data.get("current_tier")
        if isinstance(tier, (int, float)):
            return max(1, min(4, int(tier)))
    # Ensure row exists for next time
    try:
        supabase.table("interest_progress").upsert(
            {
                "user_id": user_id,
                "interest": interest_or_quit,
                "level": 1,
                "total_xp": 0,
                "current_tier": 1,
            },
            on_conflict="user_id,interest",
        ).execute()
    except Exception:
        pass
    return 1


def _tier_int_to_str(tier: int) -> str:
    """Map 1–4 to easy/medium/hard/elite."""
    return TIER_TO_STR.get(max(1, min(4, int(tier))), "easy")


def run_difficulty_adaptation(user_id: str) -> None:
    """
    Evidence-based difficulty adaptation (§7.1). Updates interest_progress.current_tier,
    pending_upgrade, skip_flag per interest/quit_target, and discipline_dna.peak_day.
    Never adjusts Personal missions. Tier floor 1, ceiling 4; at most ±1 per cycle.
    """
    supabase = get_supabase()
    now = datetime.now(timezone.utc)
    today = now.date()
    ten_days_ago = (now - timedelta(days=10)).date()
    five_days_ago = (now - timedelta(days=5)).date()

    ur = (
        supabase.table("users")
        .select("interests, quit_targets, discipline_dna")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    data = ur.data or {}
    interests: List[str] = list(data.get("interests") or [])
    quit_targets: List[str] = list(data.get("quit_targets") or [])
    discipline_dna: Dict[str, Any] = dict(data.get("discipline_dna") or {})
    all_keys = [x.strip() for x in interests + quit_targets if (x or "").strip()]

    # Fetch all interest_progress rows for this user (current_tier, pending_upgrade, skip_flag if present)
    ip_rows: Dict[str, Dict[str, Any]] = {}
    if all_keys:
        try:
            sel = supabase.table("interest_progress").select("*").eq("user_id", user_id).execute()
            for row in sel.data or []:
                key = (row.get("interest") or "").strip()
                if key:
                    ip_rows[key] = row
        except Exception:
            pass

    # Missions in last 10 days (for completion rates and skip pattern)
    mr = (
        supabase.table("missions")
        .select("type, interest, completed_at, expires_at")
        .eq("user_id", user_id)
        .gte("expires_at", ten_days_ago.isoformat())
        .lte("expires_at", now.isoformat())
        .order("expires_at", desc=False)
        .execute()
    )
    missions = mr.data or []

    for key in all_keys:
        row = ip_rows.get(key)
        current_tier = 1
        if row is not None:
            t = row.get("current_tier")
            current_tier = max(1, min(4, int(t))) if isinstance(t, (int, float)) else 1

        key_missions = [m for m in missions if (m.get("interest") or "").strip() == key]
        key_missions_5d = [m for m in key_missions if m.get("expires_at") and datetime.fromisoformat((m["expires_at"] or "").replace("Z", "+00:00")).date() >= five_days_ago]

        # Consistent rate: 80%+ over 10 days → +1 tier (at most one per cycle)
        completed_10 = sum(1 for m in key_missions if m.get("completed_at"))
        total_10 = len(key_missions)
        rate_10 = (completed_10 / total_10) if total_10 > 0 else 0.0

        # Low completion: <50% over 5 days → -1 tier, gap_behavior rubber_band
        completed_5 = sum(1 for m in key_missions_5d if m.get("completed_at"))
        total_5 = len(key_missions_5d)
        rate_5 = (completed_5 / total_5) if total_5 > 0 else 0.0

        # Streak: 100% completion 5 days in a row for this interest → pending_upgrade
        by_day: Dict[date, List[Dict]] = {}
        for m in key_missions_5d:
            exp = m.get("expires_at")
            if not exp:
                continue
            try:
                d = datetime.fromisoformat(exp.replace("Z", "+00:00")).date()
                by_day.setdefault(d, []).append(m)
            except Exception:
                pass
        five_full_days = 0
        for d in sorted(by_day.keys(), reverse=True)[:5]:
            ms = by_day[d]
            if ms and all(m.get("completed_at") for m in ms):
                five_full_days += 1
            else:
                break
        pending_upgrade = five_full_days >= 5 and total_5 >= 5

        # Skip pattern: same interest skipped 4+ in a row (expired, not completed)
        key_missions_desc = sorted(key_missions, key=lambda m: m.get("expires_at") or "", reverse=True)
        skip_count = 0
        for m in key_missions_desc:
            if m.get("completed_at"):
                break
            skip_count += 1
        skip_flag = skip_count >= 4

        # Apply at most one tier change per key per cycle; priority: decrement then increment
        new_tier = current_tier
        if total_5 >= 3 and rate_5 < 0.5:
            new_tier = max(1, current_tier - 1)
            discipline_dna["gap_behavior"] = "rubber_band"
        elif total_10 >= 5 and rate_10 >= 0.8 and new_tier == current_tier:
            new_tier = min(4, current_tier + 1)

        payload: Dict[str, Any] = {
            "user_id": user_id,
            "interest": key,
            "level": row.get("level", 1) if row else 1,
            "total_xp": row.get("total_xp", 0) if row else 0,
            "session_count": row.get("session_count", 0) if row else 0,
            "current_tier": new_tier,
            "pending_upgrade": pending_upgrade,
            "skip_flag": skip_flag,
        }
        if row and row.get("last_session_at") is not None:
            payload["last_session_at"] = row["last_session_at"]
        try:
            supabase.table("interest_progress").upsert(payload, on_conflict="user_id,interest").execute()
        except Exception:
            payload_slim = {k: v for k, v in payload.items() if k in ("user_id", "interest", "level", "total_xp", "session_count")}
            payload_slim["current_tier"] = new_tier
            try:
                supabase.table("interest_progress").upsert(payload_slim, on_conflict="user_id,interest").execute()
            except Exception:
                pass

    # Peak day: weekday with highest historical completion rate
    by_weekday: Dict[int, List[bool]] = {i: [] for i in range(7)}
    for m in missions:
        exp = m.get("expires_at")
        if not exp:
            continue
        try:
            dt = datetime.fromisoformat(exp.replace("Z", "+00:00"))
            wd = dt.weekday()
            by_weekday[wd].append(bool(m.get("completed_at")))
        except Exception:
            pass
    best_wd = 0
    best_rate = -1.0
    for wd in range(7):
        arr = by_weekday[wd]
        if not arr:
            continue
        rate = sum(arr) / len(arr)
        if rate > best_rate:
            best_rate = rate
            best_wd = wd
    if best_rate >= 0:
        discipline_dna["peak_day"] = best_wd
    try:
        supabase.table("users").update({"discipline_dna": discipline_dna}).eq("id", user_id).execute()
    except Exception:
        pass


def _user_core_context(user_id: str) -> Tuple[str, str, float, float]:
    """Return (username, archetype, available_hours_per_day, completion_rate_last_10_days)."""
    supabase = get_supabase()
    ur = (
        supabase.table("users")
        .select("email, archetype, available_hours_per_day, trial_start_date")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    data = ur.data or {}
    email = data.get("email") or ""
    username = email.split("@")[0] if "@" in email else "You"
    archetype = data.get("archetype") or "The Fresh Starter"
    hours = float(data.get("available_hours_per_day") or 1.0)
    completion_rate = _completion_rate_last_10_days(user_id)
    return username, archetype, hours, completion_rate


def generate_interest_mission(
    user_id: str,
    interest: str,
    level: str,
    tier: str,
    skip_style_hint: bool = False,
) -> Dict[str, Any]:
    """Generate one Interest mission row (dict ready for Supabase insert)."""
    username, archetype, hours, completion_rate = _user_core_context(user_id)
    available_minutes = _available_minutes_from_hours(hours)

    supabase = get_supabase()
    ur = supabase.table("users").select("trial_start_date").eq("id", user_id).maybe_single().execute()
    trial_start = ur.data.get("trial_start_date") if ur.data else None
    if isinstance(trial_start, str):
        try:
            join_date = datetime.fromisoformat(trial_start.replace("Z", "+00:00"))
        except Exception:
            join_date = datetime.now(timezone.utc)
    else:
        join_date = datetime.now(timezone.utc)

    phase = _phase_for_join_date(join_date)
    last_text = _last_mission_for_interest(user_id, interest)

    prompt = INTEREST_PROMPT_TEMPLATE.format(
        username=username,
        interest=interest,
        level=level,
        tier=tier,
        phase=phase,
        available_minutes=available_minutes,
        archetype=archetype,
        completion_rate_percent=int(completion_rate * 100),
        last_mission_text=last_text,
        skip_style_line=SKIP_STYLE_LINE if skip_style_hint else "",
    )

    llm = _llm()
    resp = llm.invoke(prompt)
    content = resp.content if isinstance(resp.content, str) else str(resp.content)
    title, xp_tier, duration = _parse_interest_output(content)

    difficulty = _tier_to_difficulty(xp_tier)
    from models.missions import xp_and_pf_for

    xp_value, pf_value = xp_and_pf_for("interest", difficulty)

    now = datetime.now(timezone.utc)
    expires = _end_of_today_utc()

    return {
        "user_id": user_id,
        "type": "interest",
        "pillar": None,
        "interest": interest,
        "title": title,
        "difficulty": difficulty,
        "xp_value": xp_value,
        "pet_food_value": pf_value,
        "mission_streak": 0,
        "completed_at": None,
        "expires_at": expires.isoformat(),
        "created_at": now.isoformat(),
    }


def generate_escaper_mission(
    user_id: str,
    quit_target: str,
    tier: str,
) -> Dict[str, Any]:
    """Generate one Escaper (recovery) mission row (dict ready for Supabase insert)."""
    username, archetype, hours, completion_rate = _user_core_context(user_id)
    available_minutes = _available_minutes_from_hours(hours)

    supabase = get_supabase()
    ur = supabase.table("users").select("trial_start_date").eq("id", user_id).maybe_single().execute()
    trial_start = ur.data.get("trial_start_date") if ur.data else None
    if isinstance(trial_start, str):
        try:
            join_date = datetime.fromisoformat(trial_start.replace("Z", "+00:00"))
        except Exception:
            join_date = datetime.now(timezone.utc)
    else:
        join_date = datetime.now(timezone.utc)

    phase = _phase_for_join_date(join_date)
    last_text = _last_mission_for_quit_target(user_id, quit_target)

    prompt = ESCAPER_PROMPT_TEMPLATE.format(
        username=username,
        quit_target=quit_target,
        tier=tier,
        phase=phase,
        available_minutes=available_minutes,
        archetype=archetype,
        completion_rate_percent=int(completion_rate * 100),
        last_mission_text=last_text,
    )

    llm = _llm()
    resp = llm.invoke(prompt)
    content = resp.content if isinstance(resp.content, str) else str(resp.content)
    title, xp_tier, duration, need = _parse_escaper_output(content)

    difficulty = _tier_to_difficulty(xp_tier)
    from models.missions import xp_and_pf_for

    xp_value, pf_value = xp_and_pf_for("recovery", difficulty)

    now = datetime.now(timezone.utc)
    expires = _end_of_today_utc()

    return {
        "user_id": user_id,
        "type": "recovery",
        "pillar": None,
        "interest": quit_target,
        "title": title,
        "difficulty": difficulty,
        "xp_value": xp_value,
        "pet_food_value": pf_value,
        "mission_streak": 0,
        "completed_at": None,
        "expires_at": expires.isoformat(),
        "created_at": now.isoformat(),
    }


def _get_skip_flag(supabase, user_id: str, interest_key: str) -> bool:
    """Return skip_flag for this interest/quit from interest_progress."""
    try:
        r = (
            supabase.table("interest_progress")
            .select("skip_flag")
            .eq("user_id", user_id)
            .eq("interest", interest_key)
            .maybe_single()
            .execute()
        )
        if r.data and r.data.get("skip_flag") is True:
            return True
    except Exception:
        pass
    return False


def _clear_skip_flag(user_id: str, interest_key: str) -> None:
    """Clear skip_flag after generating a new mission for this interest."""
    supabase = get_supabase()
    try:
        supabase.table("interest_progress").update({"skip_flag": False}).eq("user_id", user_id).eq("interest", interest_key).execute()
    except Exception:
        pass


def _recovery_mission_if_needed(user_id: str) -> Optional[Dict[str, Any]]:
    """
    When user has 0 Core completions for 2+ consecutive days: return one Recovery mission row.
    Max 1 Recovery at a time. Difficulty scales with previous streak length. Returns None if not needed.
    """
    supabase = get_supabase()
    today = date.today()
    yesterday = today - timedelta(days=1)
    day_before = today - timedelta(days=2)

    sl = (
        supabase.table("streak_log")
        .select("date, core_completed")
        .eq("user_id", user_id)
        .gte("date", (today - timedelta(days=60)).isoformat())
        .lte("date", yesterday.isoformat())
        .order("date", desc=True)
        .execute()
    )
    streak_rows = {r["date"]: int(r.get("core_completed", 0)) for r in (sl.data or [])}
    if streak_rows.get(yesterday.isoformat(), 0) > 0 or streak_rows.get(day_before.isoformat(), 0) > 0:
        return None

    start_ts = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc).isoformat()
    end_ts = datetime.combine(today, datetime.max.time(), tzinfo=timezone.utc).isoformat()
    existing = (
        supabase.table("missions")
        .select("id")
        .eq("user_id", user_id)
        .eq("type", "recovery")
        .gte("expires_at", start_ts)
        .lte("expires_at", end_ts)
        .limit(1)
        .execute()
    )
    if (existing.data or []):
        return None

    # Previous streak = consecutive days (before the break) with all 5 Core completed
    previous_streak = 0
    d = day_before
    while d.isoformat() in streak_rows and streak_rows[d.isoformat()] >= 5:
        previous_streak += 1
        d -= timedelta(days=1)

    if previous_streak >= 31:
        difficulty = "Hard"
    elif previous_streak >= 8:
        difficulty = "Medium"
    else:
        difficulty = "Easy"

    from models.missions import xp_and_pf_for
    xp_value, pf_value = xp_and_pf_for("recovery", difficulty)
    now = datetime.now(timezone.utc)
    expires = _end_of_today_utc()

    return {
        "user_id": user_id,
        "type": "recovery",
        "pillar": None,
        "interest": None,
        "title": "Complete one Core mission today to restart your streak.",
        "difficulty": difficulty,
        "xp_value": xp_value,
        "pet_food_value": pf_value,
        "mission_streak": 0,
        "completed_at": None,
        "expires_at": expires.isoformat(),
        "created_at": now.isoformat(),
    }


def plan_interest_and_escaper_missions(
    user_id: str,
    interests: List[str],
    quit_targets: List[str],
) -> List[Dict[str, Any]]:
    """
    Top-level Planner J2 entrypoint. Uses current_tier from interest_progress
    per interest/quit_target. Never adjusts Personal missions.
    Adds one Recovery mission when 0 Core for 2+ consecutive days (max 1 at a time).
    """
    supabase = get_supabase()
    rows: List[Dict[str, Any]] = []

    for interest in interests or []:
        interest_name = (interest or "").strip()
        if not interest_name:
            continue
        tier = _get_tier_for_interest_or_quit(user_id, interest_name)
        tier_str = _tier_int_to_str(tier)
        skip_hint = _get_skip_flag(supabase, user_id, interest_name)
        rows.append(
            generate_interest_mission(
                user_id,
                interest_name,
                level="Still figuring it out",
                tier=tier_str,
                skip_style_hint=skip_hint,
            )
        )
        if skip_hint:
            _clear_skip_flag(user_id, interest_name)

    for qt in quit_targets or []:
        qt_text = (qt or "").strip()
        if not qt_text:
            continue
        tier = _get_tier_for_interest_or_quit(user_id, qt_text)
        tier_str = _tier_int_to_str(tier)
        rows.append(generate_escaper_mission(user_id, qt_text, tier=tier_str))

    recovery = _recovery_mission_if_needed(user_id)
    if recovery:
        rows.append(recovery)

    return rows

