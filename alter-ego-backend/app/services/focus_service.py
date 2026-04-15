"""Focus session service — tags, sessions, stats, settings."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta, date
from typing import Any

from app.core.supabase_client import supabase_admin, run_query
from app.services.mail_service import check_and_send_focus_first_session_mail


# ── Default settings ──────────────────────────────────────────────────────────

DEFAULT_SETTINGS: dict[str, Any] = {
    "pomodoro_work_minutes": 25,
    "pomodoro_short_break_minutes": 5,
    "pomodoro_long_break_minutes": 15,
    "pomodoro_rounds": 4,
    "auto_start_breaks": True,
    "auto_start_work": False,
    "sound_enabled": True,
    "vibration_enabled": True,
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _user_tz_str(user_id: str) -> str:
    row = (
        supabase_admin.table("users")
        .select("timezone")
        .eq("id", user_id)
        .single()
        .execute()
        .data
        or {}
    )
    return str(row.get("timezone") or "UTC")


def _today_bounds_utc(tz_str: str) -> tuple[datetime, datetime]:
    """Return UTC start and end of today in the user's local timezone."""
    from zoneinfo import ZoneInfo

    try:
        tz = ZoneInfo(tz_str)
    except Exception:
        tz = timezone.utc
    now_local = datetime.now(tz)
    local_start = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    local_end = local_start + timedelta(days=1)
    return local_start.astimezone(timezone.utc), local_end.astimezone(timezone.utc)


def _week_bounds_utc(tz_str: str) -> list[tuple[datetime, datetime, str]]:
    """UTC start/end and local YYYY-MM-DD for Sun–Sat of the current calendar week (oldest first)."""
    from zoneinfo import ZoneInfo

    try:
        tz = ZoneInfo(tz_str)
    except Exception:
        tz = timezone.utc
    now_local = datetime.now(tz)
    # Monday=0 … Sunday=6 → days back to most recent Sunday
    days_since_sunday = (now_local.weekday() + 1) % 7
    sunday_local = (now_local - timedelta(days=days_since_sunday)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    result: list[tuple[datetime, datetime, str]] = []
    for i in range(7):
        day_local = sunday_local + timedelta(days=i)
        start_local = day_local.replace(hour=0, minute=0, second=0, microsecond=0)
        end_local = start_local + timedelta(days=1)
        result.append(
            (
                start_local.astimezone(timezone.utc),
                end_local.astimezone(timezone.utc),
                day_local.date().isoformat(),
            )
        )
    return result


# ── Tags ─────────────────────────────────────────────────────────────────────

async def get_tags(user_id: str) -> list[dict]:
    rows = (
        ((await run_query(supabase_admin.table("focus_tags")
        .select("id, name, color, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=False))).data)
        or []
    )
    # Count sessions per tag
    for row in rows:
        count_res = (
            await run_query(supabase_admin.table("focus_sessions")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("tag_id", row["id"]))
        )
        row["session_count"] = count_res.count or 0
    return rows


async def create_tag(user_id: str, name: str, color: str) -> dict:
    name = name.strip()
    if not name:
        raise ValueError("Tag name cannot be empty")
    if len(name) > 32:
        raise ValueError("Tag name too long (max 32 characters)")
    result = (
        ((await run_query(supabase_admin.table("focus_tags")
        .insert({"user_id": user_id, "name": name, "color": color}))).data)
        or []
    )
    if not result:
        raise ValueError("Failed to create tag")
    return result[0]


async def delete_tag(user_id: str, tag_id: str) -> dict:
    """Deletes the tag. Sessions retain tag_id=NULL (ON DELETE SET NULL)."""
    await run_query(supabase_admin.table("focus_tags").delete().eq("id", tag_id).eq(
        "user_id", user_id
    ))
    return {"deleted": True}


# ── Sessions ──────────────────────────────────────────────────────────────────

async def log_session(
    user_id: str,
    mode: str,
    tag_id: str | None,
    started_at: str,
    ended_at: str,
    focus_seconds: int,
    break_seconds: int,
    rounds_completed: int,
    was_abandoned: bool,
) -> dict:
    """Log a completed or abandoned focus session."""
    if mode not in ("pomodoro", "deep_work", "stopwatch"):
        raise ValueError(f"Invalid mode: {mode}")

    # Verify tag belongs to user if provided
    if tag_id:
        tag_check = (
            ((await run_query(supabase_admin.table("focus_tags")
            .select("id")
            .eq("id", tag_id)
            .eq("user_id", user_id)
            .limit(1))).data)
            or []
        )
        if not tag_check:
            tag_id = None  # tag not found — clear it silently

    row = {
        "user_id": user_id,
        "mode": mode,
        "tag_id": tag_id,
        "started_at": started_at,
        "ended_at": ended_at,
        "focus_seconds": max(0, focus_seconds),
        "break_seconds": max(0, break_seconds),
        "rounds_completed": max(0, rounds_completed),
        "was_abandoned": was_abandoned,
    }
    result = (
        ((await run_query(supabase_admin.table("focus_sessions").insert(row))).data) or []
    )
    out = result[0] if result else row
    if not was_abandoned:
        await check_and_send_focus_first_session_mail(user_id)
    return out


# ── Stats ─────────────────────────────────────────────────────────────────────

async def get_focus_stats(user_id: str) -> dict:
    tz_str = _user_tz_str(user_id)
    today_start, today_end = _today_bounds_utc(tz_str)
    week_days = _week_bounds_utc(tz_str)

    # --- Today ---
    today_rows = (
        ((await run_query(supabase_admin.table("focus_sessions")
        .select("focus_seconds, break_seconds, was_abandoned")
        .eq("user_id", user_id)
        .gte("ended_at", today_start.isoformat())
        .lt("ended_at", today_end.isoformat()))).data)
        or []
    )
    today_focus = sum(r["focus_seconds"] for r in today_rows if not r["was_abandoned"])
    today_break = sum(r["break_seconds"] for r in today_rows if not r["was_abandoned"])
    today_sessions = sum(1 for r in today_rows if not r["was_abandoned"])

    # --- Weekly bar chart (Sun–Sat this week) ---
    weekly_chart = []
    for day_start, day_end, local_date_iso in week_days:
        day_rows = (
            ((await run_query(supabase_admin.table("focus_sessions")
            .select("focus_seconds")
            .eq("user_id", user_id)
            .eq("was_abandoned", False)
            .gte("ended_at", day_start.isoformat())
            .lt("ended_at", day_end.isoformat()))).data)
            or []
        )
        weekly_chart.append(
            {
                "date": local_date_iso,
                "focus_seconds": sum(r["focus_seconds"] for r in day_rows),
            }
        )

    week_total_focus = sum(d["focus_seconds"] for d in weekly_chart)

    # --- All time ---
    all_rows = (
        ((await run_query(supabase_admin.table("focus_sessions")
        .select(
            "focus_seconds, break_seconds, rounds_completed, was_abandoned, ended_at, tag_id"
        )
        .eq("user_id", user_id)
        .order("ended_at", desc=False))).data)
        or []
    )

    completed_rows = [r for r in all_rows if not r["was_abandoned"]]
    total_sessions = len(completed_rows)
    total_focus = sum(r["focus_seconds"] for r in completed_rows)
    total_sessions_incl_abandoned = len(all_rows)
    longest = max((r["focus_seconds"] for r in completed_rows), default=0)
    avg = (total_focus // total_sessions) if total_sessions > 0 else 0
    completion_pct = (
        round(total_sessions / total_sessions_incl_abandoned * 100)
        if total_sessions_incl_abandoned > 0
        else 0
    )

    # Focus streak: consecutive days (including today) with ≥1 completed session
    focus_streak = 0
    if completed_rows:
        from zoneinfo import ZoneInfo

        try:
            tz = ZoneInfo(tz_str)
        except Exception:
            tz = timezone.utc
        session_dates: set[date] = set()
        for r in completed_rows:
            try:
                dt = datetime.fromisoformat(str(r["ended_at"]).replace("Z", "+00:00"))
                session_dates.add(dt.astimezone(tz).date())
            except Exception:
                pass
        today_d = datetime.now(tz).date()
        # Streak counts consecutive days with ≥1 session. Today with no session yet is still
        # "in progress" — continue from yesterday so we don't show 0 until the day is missed.
        check_date = today_d if today_d in session_dates else today_d - timedelta(days=1)
        while check_date in session_dates:
            focus_streak += 1
            check_date -= timedelta(days=1)

    # --- By tag ---
    tags = await get_tags(user_id)
    tag_lookup = {t["id"]: t for t in tags}

    tag_stats: dict[str, dict] = {}
    for r in completed_rows:
        tid = r.get("tag_id") or "__untagged__"
        if tid not in tag_stats:
            tag_info = tag_lookup.get(tid, {})
            tag_stats[tid] = {
                "tag_id": tid if tid != "__untagged__" else None,
                "name": tag_info.get("name", "Untagged"),
                "color": tag_info.get("color", "#4B5563"),
                "focus_seconds": 0,
            }
        tag_stats[tid]["focus_seconds"] += r["focus_seconds"]

    by_tag = sorted(tag_stats.values(), key=lambda x: x["focus_seconds"], reverse=True)
    # Compute pct of total for bar width
    if total_focus > 0:
        for t in by_tag:
            t["pct"] = round(t["focus_seconds"] / total_focus * 100)
    else:
        for t in by_tag:
            t["pct"] = 0

    # --- Recent sessions (last 20) ---
    recent_raw = (
        ((await run_query(supabase_admin.table("focus_sessions")
        .select(
            "id, mode, tag_id, focus_seconds, break_seconds, rounds_completed, was_abandoned, started_at, ended_at"
        )
        .eq("user_id", user_id)
        .order("ended_at", desc=True)
        .limit(20))).data)
        or []
    )
    recent = []
    for r in recent_raw:
        tag_info = tag_lookup.get(r.get("tag_id") or "", {})
        recent.append(
            {
                "id": r["id"],
                "mode": r["mode"],
                "tag_name": tag_info.get("name"),
                "tag_color": tag_info.get("color"),
                "focus_seconds": r["focus_seconds"],
                "break_seconds": r["break_seconds"],
                "rounds_completed": r["rounds_completed"],
                "was_abandoned": r["was_abandoned"],
                "started_at": r["started_at"],
                "ended_at": r["ended_at"],
            }
        )

    return {
        "today": {
            "focus_seconds": today_focus,
            "break_seconds": today_break,
            "sessions": today_sessions,
        },
        "weekly_chart": weekly_chart,
        "week_total_focus_seconds": week_total_focus,
        "all_time": {
            "total_focus_seconds": total_focus,
            "total_sessions": total_sessions,
            "longest_session_seconds": longest,
            "avg_session_seconds": avg,
            "focus_streak_days": focus_streak,
            "completion_pct": completion_pct,
        },
        "by_tag": by_tag,
        "recent_sessions": recent,
    }


# ── Settings ──────────────────────────────────────────────────────────────────

async def get_focus_settings(user_id: str) -> dict:
    row = (
        ((await run_query(supabase_admin.table("users")
        .select("focus_settings")
        .eq("id", user_id)
        .single())).data)
        or {}
    )
    stored = row.get("focus_settings") or {}
    # Merge with defaults so new keys always exist
    return {**DEFAULT_SETTINGS, **stored}


async def update_focus_settings(user_id: str, updates: dict) -> dict:
    current = await get_focus_settings(user_id)
    # Validate ranges
    if "pomodoro_work_minutes" in updates:
        updates["pomodoro_work_minutes"] = max(
            5, min(120, int(updates["pomodoro_work_minutes"]))
        )
    if "pomodoro_short_break_minutes" in updates:
        updates["pomodoro_short_break_minutes"] = max(
            1, min(30, int(updates["pomodoro_short_break_minutes"]))
        )
    if "pomodoro_long_break_minutes" in updates:
        updates["pomodoro_long_break_minutes"] = max(
            5, min(60, int(updates["pomodoro_long_break_minutes"]))
        )
    if "pomodoro_rounds" in updates:
        updates["pomodoro_rounds"] = max(1, min(10, int(updates["pomodoro_rounds"])))
    merged = {**current, **updates}
    await run_query(supabase_admin.table("users").update({"focus_settings": merged}).eq(
        "id", user_id
    ))
    return merged
