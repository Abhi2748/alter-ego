"""
Weekly report Section 1 — factual aggregation from Supabase (no LLM).
Schema matches ALTER EGO tables: users, missions, streak_log, xp_log, pf_log, etc.
"""

from __future__ import annotations

import logging
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from typing import Any

from zoneinfo import ZoneInfo

from app.core.constants import PET_NAMES, STAGE_NAMES
from app.core.supabase_client import supabase_admin, run_query

logger = logging.getLogger(__name__)

MILESTONES = [3, 7, 10, 14, 30, 60, 100, 180, 365]


def weekly_report_week_eligible(
    registration_iso: str | None,
    tz_str: str,
    week_start: date,
    week_end: date,
    now_local: datetime | None = None,
) -> bool:
    """
    Weekly report covers a completed Mon–Sun week. Do not generate for weeks that ended
    before the user existed, or before the reporting window (Sunday 03:00 local on week_end).
    """
    try:
        tz = ZoneInfo(tz_str)
    except Exception:
        tz = timezone.utc
    if now_local is None:
        now_local = datetime.now(tz)
    try:
        reg_dt = datetime.fromisoformat(str(registration_iso or "").replace("Z", "+00:00"))
    except Exception:
        reg_dt = datetime.now(timezone.utc)
    reg_local = reg_dt.astimezone(tz).date()
    if week_end < reg_local:
        return False
    today = now_local.date()
    if today < week_end:
        return False
    if today == week_end and now_local.hour < 3:
        return False
    return True


async def assemble_weekly_data(user_id: str, week_start: date, week_end: date) -> dict[str, Any]:
    """
    Build structured facts for weekly report prompts and this_week_data JSON.
    Uses mission_date (calendar week), xp_log / pf_log, users, twin_state, streak_log, milestone_log.
    """
    ws = week_start.isoformat()
    we = week_end.isoformat()

    user_result = (
        await run_query(supabase_admin.table("users")
        .select(
            "username, archetype, character_stage, pet_stage, pet_unlocked, "
            "current_streak, longest_streak, total_xp, timezone, power_score"
        )
        .eq("id", user_id)
        .single())
    )
    user = user_result.data or {}

    twin_result = (
        await run_query(supabase_admin.table("twin_state")
        .select("twin_xp, current_gap_state")
        .eq("user_id", user_id)
        .limit(1))
    )
    twin = (twin_result.data or [None])[0] or {}

    dna_result = (
        await run_query(supabase_admin.table("discipline_dna")
        .select("pending_difficulty_change")
        .eq("user_id", user_id)
        .limit(1))
    )
    dna_row = (dna_result.data or [None])[0] or {}

    missions = (
        ((await run_query(supabase_admin.table("missions")
        .select(
            "id, type, title, completed, xp_value, pf_value, mission_date, "
            "core_pillar, is_journal_mission, interest_id"
        )
        .eq("user_id", user_id)
        .gte("mission_date", ws)
        .lte("mission_date", we))).data)
        or []
    )

    completed = [m for m in missions if m.get("completed")]
    total = len(missions)
    missions_completed = len(completed)

    xp_earned = sum(int(m.get("xp_value") or 0) for m in completed)
    pf_earned = sum(int(m.get("pf_value") or 0) for m in completed)

    xp_log_rows = (
        ((await run_query(supabase_admin.table("xp_log")
        .select("amount")
        .eq("user_id", user_id)
        .gte("log_date", ws)
        .lte("log_date", we))).data)
        or []
    )
    pf_log_rows = (
        ((await run_query(supabase_admin.table("pf_log")
        .select("amount")
        .eq("user_id", user_id)
        .gte("log_date", ws)
        .lte("log_date", we))).data)
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
        ((await run_query(supabase_admin.table("streak_log")
        .select("*")
        .eq("user_id", user_id)
        .gte("log_date", ws)
        .lte("log_date", we))).data)
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
        ((await run_query(supabase_admin.table("milestone_log")
        .select("milestone_type, earned_at")
        .eq("user_id", user_id)
        .gte("earned_at", f"{ws}T00:00:00")
        .lte("earned_at", f"{we}T23:59:59.999"))).data)
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
        ((await run_query(supabase_admin.table("weekly_reports")
        .select("gap_xp_end, this_week_data")
        .eq("user_id", user_id)
        .lt("week_start", ws)
        .order("week_start", desc=True)
        .limit(1))).data)
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
        ((await run_query(supabase_admin.table("quit_paths")
        .select("id")
        .eq("user_id", user_id))).data)
        or []
    )

    ratings_rows = (
        ((await run_query(supabase_admin.table("mission_ratings")
        .select("rating")
        .eq("user_id", user_id)
        .gte("created_at", f"{ws}T00:00:00")
        .lte("created_at", f"{we}T23:59:59.999"))).data)
        or []
    )
    ratings_given = len(ratings_rows)
    avg_rating = (
        round(sum(r["rating"] for r in ratings_rows) / ratings_given, 1)
        if ratings_given
        else 0.0
    )

    # ── Focus sessions this week ──────────────────────────────────────────
    # Uses ended_at (TIMESTAMPTZ) with half-open interval to match focus_service pattern
    focus_total_seconds = 0
    focus_session_count = 0
    focus_avg_seconds = 0
    focus_top_tag_name: str | None = None
    focus_top_tag_seconds = 0
    try:
        from zoneinfo import ZoneInfo as _ZoneInfo

        try:
            _tz = _ZoneInfo(str(user.get("timezone") or "UTC"))
        except Exception:
            _tz = timezone.utc

        # Convert week_start/week_end (date) to UTC timestamps for ended_at filter
        from datetime import datetime as _dt

        _ws_utc = _dt.combine(week_start, _dt.min.time()).replace(tzinfo=_tz).astimezone(timezone.utc)
        _we_utc = _dt.combine(week_end + timedelta(days=1), _dt.min.time()).replace(tzinfo=_tz).astimezone(timezone.utc)

        focus_rows = (
            ((await run_query(supabase_admin.table("focus_sessions")
            .select("focus_seconds, mode, tag_id, was_abandoned")
            .eq("user_id", user_id)
            .eq("was_abandoned", False)
            .gte("ended_at", _ws_utc.isoformat())
            .lt("ended_at", _we_utc.isoformat()))).data)
            or []
        )

        focus_total_seconds = sum(int(r.get("focus_seconds") or 0) for r in focus_rows)
        focus_session_count = len(focus_rows)
        focus_avg_seconds = (focus_total_seconds // focus_session_count) if focus_session_count > 0 else 0

        # Top tag by total focus_seconds
        focus_tag_totals: dict[str, int] = {}
        for r in focus_rows:
            tid = str(r.get("tag_id") or "__none__")
            focus_tag_totals[tid] = focus_tag_totals.get(tid, 0) + int(r.get("focus_seconds") or 0)

        focus_top_tag_id: str | None = None
        if focus_tag_totals:
            top = max(focus_tag_totals.items(), key=lambda x: x[1])
            if top[0] != "__none__":
                focus_top_tag_id = top[0]
                focus_top_tag_seconds = top[1]

        # Resolve tag name if we have a tag_id
        if focus_top_tag_id:
            try:
                tag_res = await run_query(
                    supabase_admin.table("focus_tags")
                    .select("name")
                    .eq("id", focus_top_tag_id)
                    .single()
                )
                focus_top_tag_name = str((tag_res.data or {}).get("name") or "")
            except Exception:
                pass
    except Exception:
        pass

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
        "focus_total_seconds": focus_total_seconds,
        "focus_session_count": focus_session_count,
        "focus_avg_seconds": focus_avg_seconds,
        "focus_top_tag_name": focus_top_tag_name,
        "focus_top_tag_seconds": focus_top_tag_seconds,
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


def _week_contains_ts(
    week_start: date, week_end: date, ts_val: str | None
) -> bool:
    if not ts_val:
        return False
    try:
        ts = datetime.fromisoformat(str(ts_val).replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        d = ts.date()
        return week_start <= d <= week_end
    except Exception:
        return False


async def assemble_enriched_context(
    user_id: str, week_start: date, week_end: date
) -> dict[str, Any]:
    """
    Gathers cross-system context for the Phase 4 report agent upgrade.
    Returns a dict merged into the report prompt. Fails silently on each sub-query.
    """
    ws = week_start.isoformat()
    we = week_end.isoformat()

    narrative_seed: str | None = None
    discipline_framing = "behavior"
    guilt_orientation = 0.0

    try:
        dna_res = (
            await run_query(supabase_admin.table("discipline_dna")
            .select(
                "narrative_seed, discipline_framing, guilt_orientation, "
                "external_validation_need, self_belief, execution_gap, core_failure_pattern"
            )
            .eq("user_id", user_id)
            .limit(1))
        )
        row_a = (dna_res.data or [None])[0] or {}
        narrative_seed = row_a.get("narrative_seed")
        discipline_framing = str(row_a.get("discipline_framing") or "behavior")
        guilt_orientation = float(row_a.get("guilt_orientation") or 0.0)
    except Exception:
        pass

    interest_arcs: list[dict[str, Any]] = []
    try:
        int_res = (
            await run_query(supabase_admin.table("interests")
            .select(
                "id, normalised_name, user_goal, interest_path_state, "
                "current_arc_phase, sessions_completed, total_planned_sessions, is_active"
            )
            .eq("user_id", user_id)
            .eq("is_active", True))
        )
        interests = int_res.data or []
        miss_res = (
            await run_query(supabase_admin.table("missions")
            .select("interest_id, completed, mission_date, type")
            .eq("user_id", user_id)
            .eq("type", "interest")
            .gte("mission_date", ws)
            .lte("mission_date", we))
        )
        missions_i = miss_res.data or []
        counts: dict[str, int] = {}
        for m in missions_i:
            if not m.get("completed"):
                continue
            iid = m.get("interest_id")
            if not iid:
                continue
            key = str(iid)
            counts[key] = counts.get(key, 0) + 1

        for it in interests:
            iid = str(it.get("id") or "")
            if not iid:
                continue
            name = str(it.get("normalised_name") or "Interest")
            sessions_week = counts.get(iid, 0)
            arc_phase = str(it.get("current_arc_phase") or "")
            goal = it.get("user_goal")
            progress_pct: float | None = None
            try:
                tot = int(it.get("total_planned_sessions") or 0)
                sess = int(it.get("sessions_completed") or 0)
                if tot > 0:
                    progress_pct = round(100.0 * sess / tot, 1)
            except Exception:
                progress_pct = None
            interest_arcs.append(
                {
                    "interest_name": name,
                    "sessions_completed_this_week": sessions_week,
                    "arc_phase": arc_phase,
                    "goal": goal,
                    "progress_pct": progress_pct,
                }
            )
    except Exception:
        interest_arcs = []

    quit_progress: list[dict[str, Any]] = []
    try:
        qp_res = (
            await run_query(supabase_admin.table("quit_paths")
            .select(
                "habit_name, current_phase, phase_started_at, status"
            )
            .eq("user_id", user_id)
            .in_("status", ["active", "paused", "maintenance"]))
        )
        now_utc = datetime.now(timezone.utc)
        for q in qp_res.data or []:
            habit_name = str(q.get("habit_name") or "")
            phase = str(q.get("current_phase") or "")
            started = q.get("phase_started_at")
            days_in_phase: int | None = None
            if started:
                try:
                    pst = datetime.fromisoformat(str(started).replace("Z", "+00:00"))
                    if pst.tzinfo is None:
                        pst = pst.replace(tzinfo=timezone.utc)
                    days_in_phase = max(0, (now_utc - pst).days)
                except Exception:
                    days_in_phase = None
            quit_progress.append(
                {
                    "habit_name": habit_name,
                    "current_phase": phase,
                    "days_in_phase": days_in_phase,
                    "phase": phase,
                }
            )
    except Exception:
        quit_progress = []

    twin_challenge: dict[str, Any] = {"challenge_exists": False}
    try:
        ch_res = (
            await run_query(supabase_admin.table("twin_challenges")
            .select(
                "challenge_text, status, issued_at, current_value, target_value"
            )
            .eq("user_id", user_id))
        )
        for ch in ch_res.data or []:
            issued_at = ch.get("issued_at")
            if not _week_contains_ts(week_start, week_end, issued_at):
                continue
            twin_challenge = {
                "challenge_exists": True,
                "challenge_description": ch.get("challenge_text"),
                "status": ch.get("status"),
                "progress_made": (
                    f"{ch.get('current_value', 0)}/{ch.get('target_value', 0)}"
                    if ch.get("target_value") is not None
                    else None
                ),
            }
            break
    except Exception:
        twin_challenge = {"challenge_exists": False}

    memory_anchors: list[dict[str, Any]] = []
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        ma_res = (
            await run_query(supabase_admin.table("memory_anchors")
            .select("reference_phrase, summary, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(10))
        )
        for a in ma_res.data or []:
            ca = a.get("created_at")
            if not ca:
                continue
            try:
                cat = datetime.fromisoformat(str(ca).replace("Z", "+00:00"))
                if cat.tzinfo is None:
                    cat = cat.replace(tzinfo=timezone.utc)
                if cat < cutoff:
                    continue
            except Exception:
                continue
            memory_anchors.append(
                {
                    "reference_phrase": str(a.get("reference_phrase") or ""),
                    "summary": str(a.get("summary") or ""),
                    "created_at_iso": str(ca),
                }
            )
            if len(memory_anchors) >= 3:
                break
    except Exception:
        memory_anchors = []

    prev_wins_openings: list[str] = []
    prev_twin_openings: list[str] = []
    try:
        wr_res = (
            await run_query(supabase_admin.table("weekly_reports")
            .select("wins_opening, twin_opening")
            .eq("user_id", user_id)
            .lt("week_start", ws)
            .order("week_start", desc=True)
            .limit(2))
        )
        for r in wr_res.data or []:
            wo = r.get("wins_opening")
            if wo:
                prev_wins_openings.append(str(wo).strip())
            to = r.get("twin_opening")
            if to:
                prev_twin_openings.append(str(to).strip())
    except Exception:
        pass

    return {
        "narrative_seed": narrative_seed,
        "discipline_framing": discipline_framing,
        "guilt_orientation": guilt_orientation,
        "interest_arcs": interest_arcs,
        "quit_progress": quit_progress,
        "twin_challenge": twin_challenge,
        "memory_anchors": memory_anchors,
        "prev_wins_openings": prev_wins_openings,
        "prev_twin_openings": prev_twin_openings,
    }
