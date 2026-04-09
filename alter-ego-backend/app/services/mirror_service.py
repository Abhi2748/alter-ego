"""
7-Day Mirror — observations from first-week usage (no LLM).
At most 4 batched DB reads: missions, xp_log, twin_daily_record, onboarding_answers.
"""
from __future__ import annotations

import json
import logging
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any

from app.core.supabase_client import supabase_admin

logger = logging.getLogger(__name__)


def _mission_cat(m: dict) -> str:
    raw = m.get("mission_category") or m.get("type") or "core"
    s = str(raw).lower()
    if s in ("core", "interest", "resistance", "personal"):
        return s
    if s == "recovery":
        return "resistance"
    return s


def _load_onboarding_map(rows: list[dict] | None) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for r in rows or []:
        k = r.get("question_key")
        if k:
            out[str(k)] = (r.get("answer_json") or {}) if isinstance(r.get("answer_json"), dict) else {}
    return out


def _reported_productive_bucket(answers_map: dict[str, dict[str, Any]]) -> str | None:
    for _key, aj in answers_map.items():
        val = aj.get("value") if isinstance(aj, dict) else None
        if val is None:
            continue
        s = str(val).lower()
        if "late" in s and "night" in s:
            return "late night"
        if "morning" in s:
            return "morning"
        if "afternoon" in s:
            return "afternoon"
        if "evening" in s:
            return "evening"
        if "night" in s:
            return "late night"
    return None


async def compute_mirror_observations(
    user_id: str,
    reg_date: str,
    window_end: str,
) -> list[dict[str, Any]]:
    """
    Fetch data in up to 4 queries, then build 0–4 observations.
    Each builder is isolated — failures become None.
    """
    missions: list[dict] = []
    try:
        m_result = (
            await run_query(supabase_admin.table("missions")
            .select("mission_category, type, completed, completed_at, title, mission_date")
            .eq("user_id", user_id)
            .gte("mission_date", reg_date)
            .lte("mission_date", window_end))
        )
        missions = m_result.data or []
    except Exception as e:
        logger.error(json.dumps({"event": "mirror_missions_error", "user_id": user_id, "error": str(e)}))

    xp_logs: list[dict] = []
    try:
        x_result = (
            await run_query(supabase_admin.table("xp_log")
            .select("log_date, created_at, amount")
            .eq("user_id", user_id)
            .gte("log_date", reg_date)
            .lte("log_date", window_end))
        )
        xp_logs = x_result.data or []
    except Exception as e:
        logger.error(json.dumps({"event": "mirror_xp_error", "user_id": user_id, "error": str(e)}))

    twin_rows: list[dict] = []
    try:
        twin_result = (
            await run_query(supabase_admin.table("twin_daily_record")
            .select("record_date, xp_earned")
            .eq("user_id", user_id)
            .gte("record_date", reg_date)
            .lte("record_date", window_end))
        )
        twin_rows = twin_result.data or []
    except Exception as e:
        logger.error(json.dumps({"event": "mirror_twin_error", "user_id": user_id, "error": str(e)}))

    onboarding_rows: list[dict] = []
    try:
        o_result = (
            await run_query(supabase_admin.table("onboarding_answers")
            .select("question_key, answer_json")
            .eq("user_id", user_id))
        )
        onboarding_rows = o_result.data or []
    except Exception as e:
        logger.error(json.dumps({"event": "mirror_onboarding_error", "user_id": user_id, "error": str(e)}))

    answers_map = _load_onboarding_map(onboarding_rows)

    twin_total = sum(int(r.get("xp_earned") or 0) for r in twin_rows)
    user_total = sum(int(r.get("amount") or 0) for r in xp_logs)
    twin_xp_gap = twin_total - user_total

    candidates: list[dict[str, Any]] = []
    for obs in (
        _obs_category_order(missions),
        _obs_peak_hour(xp_logs, answers_map),
        _obs_open_without_complete(missions),
        _obs_twin_gap(twin_xp_gap),
        _obs_best_category(missions),
    ):
        if obs:
            candidates.append(obs)

    return candidates[:4]


def _obs_category_order(missions: list) -> dict | None:
    try:
        completed = [m for m in missions if m.get("completed")]
        if len(completed) < 4:
            return None

        cat_counts = Counter(_mission_cat(m) for m in completed)
        if len(cat_counts) < 2:
            return None

        most = cat_counts.most_common()
        first_cat = most[0][0]
        last_cat = most[-1][0]

        labels = {
            "core": "core missions",
            "interest": "interest missions",
            "resistance": "resistance missions",
            "personal": "personal missions",
        }
        first_label = labels.get(first_cat, first_cat)
        last_label = labels.get(last_cat, last_cat)

        return {
            "text": f"You complete {first_label} first. You leave {last_label} for last. Every time.",
            "bold_segments": [first_label, last_label],
            "violet_segments": [],
        }
    except Exception:
        return None


def _obs_peak_hour(xp_logs: list, answers_map: dict[str, dict[str, Any]]) -> dict | None:
    try:
        if len(xp_logs) < 3:
            return None

        hours: list[int] = []
        for log in xp_logs:
            ts = log.get("created_at")
            if not ts:
                continue
            try:
                raw = str(ts).replace("Z", "+00:00")
                dt = datetime.fromisoformat(raw)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                hours.append(dt.astimezone(timezone.utc).hour)
            except Exception:
                continue

        if not hours:
            return None

        hour_counts = Counter(hours)
        peak_hour = hour_counts.most_common(1)[0][0]

        if 5 <= peak_hour < 12:
            peak_label = "morning"
        elif 12 <= peak_hour < 17:
            peak_label = "afternoon"
        elif 17 <= peak_hour < 21:
            peak_label = "evening"
        else:
            peak_label = "late night"

        reported_bucket = _reported_productive_bucket(answers_map)
        if not reported_bucket or reported_bucket == peak_label:
            return None

        h12 = peak_hour % 12 or 12
        ampm = "am" if peak_hour < 12 else "pm"
        peak_time_str = f"{h12}{ampm}"
        reported_display = reported_bucket.replace("_", " ")

        return {
            "text": f"Your peak hour is {peak_time_str}. You told me it was {reported_display}. One of you is lying.",
            "bold_segments": [peak_time_str],
            "violet_segments": [reported_display],
        }
    except Exception:
        return None


def _obs_open_without_complete(missions: list) -> dict | None:
    try:
        days: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "done": 0})

        for m in missions:
            date_key = str(m.get("mission_date", ""))[:10]
            if date_key:
                days[date_key]["total"] += 1
                if m.get("completed"):
                    days[date_key]["done"] += 1

        empty_days = sum(1 for d in days.values() if d["total"] > 0 and d["done"] == 0)

        if empty_days < 2:
            return None

        return {
            "text": f"You had {empty_days} days where you opened the app and completed nothing. That's a pattern, not a coincidence.",
            "bold_segments": [f"{empty_days} days"],
            "violet_segments": [],
        }
    except Exception:
        return None


def _obs_twin_gap(gap: int) -> dict | None:
    try:
        if abs(gap) < 20:
            return None

        if gap > 0:
            return {
                "text": f"Your Twin is {gap} XP ahead of you. It has been working while you decide.",
                "bold_segments": [f"{gap} XP ahead"],
                "violet_segments": [],
            }
        return {
            "text": f"You are {abs(gap)} XP ahead of your Twin. You've been more consistent than your shadow.",
            "bold_segments": [f"{abs(gap)} XP ahead"],
            "violet_segments": [],
        }
    except Exception:
        return None


def _obs_best_category(missions: list) -> dict | None:
    try:
        cats: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "done": 0})

        for m in missions:
            cat = _mission_cat(m)
            cats[cat]["total"] += 1
            if m.get("completed"):
                cats[cat]["done"] += 1

        rates = {cat: (v["done"] / v["total"]) for cat, v in cats.items() if v["total"] >= 2}

        if len(rates) < 2:
            return None

        best = max(rates, key=rates.get)
        rate_pct = int(rates[best] * 100)

        labels = {
            "core": "core missions",
            "interest": "interest missions",
            "resistance": "resistance missions",
            "personal": "personal missions",
        }
        label = labels.get(best, best)

        return {
            "text": f"You completed {rate_pct}% of your {label} this week. That's where your energy goes naturally.",
            "bold_segments": [f"{rate_pct}%", label],
            "violet_segments": [],
        }
    except Exception:
        return None
