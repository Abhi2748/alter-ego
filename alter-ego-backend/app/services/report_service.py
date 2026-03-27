"""
Weekly report Section 1 — factual aggregation from Supabase (no LLM).
Schema matches ALTER EGO tables: users, missions, streak_log, xp_log, pf_log, etc.
"""

from __future__ import annotations

import logging
from collections import Counter
from datetime import date, timedelta
from typing import Any

from app.core.constants import PET_NAMES, STAGE_NAMES
from app.core.supabase_client import supabase_admin

logger = logging.getLogger(__name__)

MILESTONES = [3, 7, 10, 14, 30, 60, 100, 180, 365]


async def assemble_weekly_data(user_id: str, week_start: date, week_end: date) -> dict[str, Any]:
    """
    Build structured facts for weekly report prompts and this_week_data JSON.
    Uses mission_date (calendar week), xp_log / pf_log, users, twin_state, streak_log, milestone_log.
    """
    ws = week_start.isoformat()
    we = week_end.isoformat()

    user_result = (
        supabase_admin.table("users")
        .select(
            "username, archetype, character_stage, pet_stage, pet_unlocked, "
            "current_streak, longest_streak, total_xp, timezone, power_score"
        )
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = user_result.data or {}

    twin_result = (
        supabase_admin.table("twin_state")
        .select("twin_xp, current_gap_state")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    twin = (twin_result.data or [None])[0] or {}

    dna_result = (
        supabase_admin.table("discipline_dna")
        .select("pending_difficulty_change")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    dna_row = (dna_result.data or [None])[0] or {}

    missions = (
        supabase_admin.table("missions")
        .select(
            "id, type, title, completed, xp_value, pf_value, mission_date, "
            "core_pillar, is_journal_mission, interest_id"
        )
        .eq("user_id", user_id)
        .gte("mission_date", ws)
        .lte("mission_date", we)
        .execute()
        .data
        or []
    )

    completed = [m for m in missions if m.get("completed")]
    total = len(missions)
    missions_completed = len(completed)

    xp_earned = sum(int(m.get("xp_value") or 0) for m in completed)
    pf_earned = sum(int(m.get("pf_value") or 0) for m in completed)

    xp_log_rows = (
        supabase_admin.table("xp_log")
        .select("amount")
        .eq("user_id", user_id)
        .gte("log_date", ws)
        .lte("log_date", we)
        .execute()
        .data
        or []
    )
    pf_log_rows = (
        supabase_admin.table("pf_log")
        .select("amount")
        .eq("user_id", user_id)
        .gte("log_date", ws)
        .lte("log_date", we)
        .execute()
        .data
        or []
    )
    xp_from_log = sum(int(r.get("amount") or 0) for r in xp_log_rows)
    pf_from_log = sum(int(r.get("amount") or 0) for r in pf_log_rows)
    if xp_from_log > 0:
        xp_earned = xp_from_log
    if pf_from_log > 0:
        pf_earned = pf_from_log

    xp_by_day: dict[str, int] = {}
    for r in xp_log_rows:
        ld = str(r.get("log_date") or "")[:10]
        if len(ld) < 10:
            continue
        xp_by_day[ld] = xp_by_day.get(ld, 0) + int(r.get("amount") or 0)

    streak_rows = (
        supabase_admin.table("streak_log")
        .select("*")
        .eq("user_id", user_id)
        .gte("log_date", ws)
        .lte("log_date", we)
        .execute()
        .data
        or []
    )

    core_by_day: dict[str, dict[str, int]] = {}
    for m in missions:
        if m.get("type") != "core" or m.get("is_journal_mission"):
            continue
        dkey = str(m.get("mission_date") or "")[:10]
        if not dkey:
            continue
        core_by_day.setdefault(dkey, {"total": 0, "done": 0})
        core_by_day[dkey]["total"] += 1
        if m.get("completed"):
            core_by_day[dkey]["done"] += 1

    if core_by_day:
        days_all_core = sum(
            1 for v in core_by_day.values() if v["total"] > 0 and v["done"] >= v["total"]
        )
    else:
        days_all_core = sum(
            1 for r in streak_rows if (r.get("core_completed_count") or 0) >= 3
        )

    streak_broken_this_week = any(
        (not r.get("streak_maintained")) and (r.get("streak_count") or 0) == 0
        for r in streak_rows
    )

    skipped = [m for m in missions if not m.get("completed")]
    type_counts: Counter[str] = Counter()
    for m in skipped:
        t = str(m.get("type") or "unknown")
        type_counts[t] += 1
    most_skipped_type = type_counts.most_common(1)[0][0] if type_counts else None
    most_skipped_count = type_counts[most_skipped_type] if most_skipped_type else 0

    skipped_core_titles = [
        m.get("title") or ""
        for m in skipped
        if m.get("type") == "core" and not m.get("is_journal_mission")
    ]
    title_counts = Counter(skipped_core_titles)
    most_skipped_title, skip_title_count = (
        title_counts.most_common(1)[0] if title_counts else ("", 0)
    )

    char_stage = int(user.get("character_stage") or 1)
    stage_name = STAGE_NAMES[min(max(char_stage, 1), len(STAGE_NAMES)) - 1]

    milestones_week = (
        supabase_admin.table("milestone_log")
        .select("milestone_type, earned_at")
        .eq("user_id", user_id)
        .gte("earned_at", f"{ws}T00:00:00")
        .lte("earned_at", f"{we}T23:59:59.999")
        .execute()
        .data
        or []
    )

    stage_changed = next(
        (
            m["milestone_type"]
            for m in milestones_week
            if str(m.get("milestone_type") or "").startswith("stage_")
        ),
        None,
    )
    pet_evolved = next(
        (
            m["milestone_type"]
            for m in milestones_week
            if str(m.get("milestone_type") or "").startswith("pet_stage_")
        ),
        None,
    )

    pet_stage = int(user.get("pet_stage") or 0)
    pet_name = (
        PET_NAMES[pet_stage - 1]
        if pet_stage > 0 and user.get("pet_unlocked")
        else "No pet yet"
    )

    user_xp = int(user.get("total_xp") or 0)
    twin_xp = int(twin.get("twin_xp") or 0)
    gap_xp = abs(twin_xp - user_xp)
    gap_state = str(twin.get("current_gap_state") or "neck_and_neck")

    prev_rep = (
        supabase_admin.table("weekly_reports")
        .select("gap_xp_end, this_week_data")
        .eq("user_id", user_id)
        .lt("week_start", ws)
        .order("week_start", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    last_gap = gap_xp
    if prev_rep:
        row0 = prev_rep[0]
        if row0.get("gap_xp_end") is not None:
            last_gap = int(row0["gap_xp_end"])
        else:
            tw = row0.get("this_week_data") or {}
            if isinstance(tw, dict) and tw.get("gap_xp") is not None:
                try:
                    last_gap = int(tw["gap_xp"])
                except (TypeError, ValueError):
                    pass

    gap_change = gap_xp - last_gap

    current_streak = int(user.get("current_streak") or 0)
    next_milestone = next((m for m in MILESTONES if m > current_streak), None)
    days_to_milestone = (next_milestone - current_streak) if next_milestone else None

    difficulty_change_next_week = dna_row.get("pending_difficulty_change")

    completion_rate = (missions_completed / total) if total else 0.0

    quit_rows = (
        supabase_admin.table("quit_paths")
        .select("id")
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )

    ratings_rows = (
        supabase_admin.table("mission_ratings")
        .select("rating")
        .eq("user_id", user_id)
        .gte("created_at", f"{ws}T00:00:00")
        .lte("created_at", f"{we}T23:59:59.999")
        .execute()
        .data
        or []
    )
    ratings_given = len(ratings_rows)
    avg_rating = (
        round(sum(r["rating"] for r in ratings_rows) / ratings_given, 1)
        if ratings_given
        else 0.0
    )

    personal_count = sum(1 for m in missions if m.get("type") == "personal")
    interests_worked = len(
        {
            str(m["interest_id"])
            for m in missions
            if m.get("type") == "interest" and m.get("completed") and m.get("interest_id")
        }
    )

    day_counts: dict[str, dict[str, int]] = {}
    for m in missions:
        d = str(m.get("mission_date") or "")[:10]
        if not d:
            continue
        day_counts.setdefault(d, {"done": 0, "total": 0})
        day_counts[d]["total"] += 1
        if m.get("completed"):
            day_counts[d]["done"] += 1
    if day_counts:
        best_day = max(day_counts.items(), key=lambda x: x[1]["done"])[0]
        hardest_day = min(day_counts.items(), key=lambda x: x[1]["done"])[0]
        best_day_count = day_counts[best_day]["done"]
        hardest_day_count = day_counts[hardest_day]["done"]
    else:
        best_day = hardest_day = "N/A"
        best_day_count = hardest_day_count = 0

    days_active = len(set(r["log_date"] for r in streak_rows)) if streak_rows else 0
    streak_events: list[str] = []
    for r in streak_rows:
        if not r.get("streak_maintained") and (r.get("streak_count") or 0) == 0:
            streak_events.append(f"Streak reset on {r['log_date']}")
        for milestone in (30, 60, 100, 200, 365):
            if r.get("streak_count") == milestone:
                streak_events.append(
                    f"Streak milestone: {r['streak_count']} days on {r['log_date']}"
                )
                break

    user_is_ahead = user_xp > twin_xp

    prev_power: int | None = None
    if prev_rep:
        row_ps = prev_rep[0]
        tw_ps = row_ps.get("this_week_data") or {}
        if isinstance(tw_ps, dict) and tw_ps.get("power_score") is not None:
            try:
                prev_power = int(tw_ps["power_score"])
            except (TypeError, ValueError):
                pass

    power_score_snap = int(user.get("power_score") or 0)
    power_score_change = (power_score_snap - prev_power) if prev_power is not None else 0
    longest_streak_val = int(user.get("longest_streak") or 0)

    day_of_week_completion: list[int] = []
    day_of_week_xp: list[int] = []
    cursor_d = week_start
    for _ in range(7):
        d_key = cursor_d.isoformat()
        dc = day_counts.get(d_key, {"done": 0, "total": 0})
        tot_d = dc["total"]
        dn_d = dc["done"]
        pct_d = round((dn_d / tot_d) * 100) if tot_d > 0 else 0
        day_of_week_completion.append(pct_d)
        day_of_week_xp.append(int(xp_by_day.get(d_key, 0)))
        cursor_d += timedelta(days=1)

    return {
        "username": user.get("username") or "you",
        "archetype": str(user.get("archetype") or "structured_climber"),
        "week_start": ws,
        "week_end": we,
        "missions_completed": missions_completed,
        "missions_total": total,
        "completion_rate": completion_rate,
        "days_all_core": days_all_core,
        "xp_earned": xp_earned,
        "pf_earned": pf_earned,
        "current_streak": current_streak,
        "streak_broken_this_week": streak_broken_this_week,
        "most_skipped_type": most_skipped_type,
        "most_skipped_count": most_skipped_count,
        "most_skipped_mission_title": most_skipped_title or None,
        "most_skipped_mission_count": skip_title_count,
        "character_stage": char_stage,
        "character_stage_name": stage_name,
        "stage_changed_to": stage_changed,
        "pet_name": pet_name,
        "pet_stage": pet_stage,
        "pet_evolved_to": pet_evolved,
        "gap_xp": gap_xp,
        "gap_change": gap_change,
        "gap_state": gap_state,
        "user_is_ahead": user_is_ahead,
        "power_score": power_score_snap,
        "power_score_change": power_score_change,
        "longest_streak": longest_streak_val,
        "day_of_week_completion": day_of_week_completion,
        "day_of_week_xp": day_of_week_xp,
        "difficulty_change_next_week": difficulty_change_next_week,
        "next_milestone": next_milestone,
        "days_to_milestone": days_to_milestone,
        "days_active": days_active,
        "streak_events": streak_events,
        "best_day": best_day,
        "best_day_count": best_day_count,
        "hardest_day": hardest_day,
        "hardest_day_count": hardest_day_count,
        "ratings_given": ratings_given,
        "avg_rating": avg_rating,
        "personal_count": personal_count,
        "interests_worked": interests_worked,
        "quit_paths_count": len(quit_rows),
        "this_week_display": {
            "missions": f"{missions_completed} / {total} missions completed",
            "core": f"Core-strong days: {days_all_core} / 7",
            "xp": f"{xp_earned:,} XP earned",
            "pet_food": f"{pf_earned:,} Pet Food earned",
            "streak": f"Current streak: {current_streak} days",
            "character": f"Stage: {stage_name} (Stage {char_stage})"
            + (" — stage milestone this week" if stage_changed else ""),
            "pet": f"Pet: {pet_name}"
            + (f" — evolution milestone this week ({pet_evolved})" if pet_evolved else ""),
            "gap": f"Twin gap: {gap_xp} XP ({gap_state})",
        },
    }
