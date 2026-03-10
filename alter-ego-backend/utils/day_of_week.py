"""
Day-of-week completion for Report and Profile. Last 30 days, streak_log completion_level 0–4 → % per weekday.
Returns [mon_pct, tue_pct, wed_pct, thu_pct, fri_pct, sat_pct, sun_pct] (0–100).
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import List

# Python weekday(): Monday=0 .. Sunday=6. Return order: Mon..Sun.


def get_day_of_week_completion(supabase, user_id: str, days: int = 30) -> List[float]:
    """
    Aggregate streak_log for the last `days` days; for each weekday (Mon–Sun) compute
    average completion % (completion_level 0–4 → 0–100%). Returns list of 7 floats.
    """
    end = date.today()
    start = end - timedelta(days=days)
    r = (
        supabase.table("streak_log")
        .select("date, completion_level")
        .eq("user_id", user_id)
        .gte("date", start.isoformat())
        .lte("date", end.isoformat())
        .execute()
    )
    rows = r.data or []
    # Group by weekday (0=Mon .. 6=Sun). completion_level 0–4 → pct 0–100
    by_weekday: List[List[float]] = [[] for _ in range(7)]
    for row in rows:
        d = row.get("date")
        level = int(row.get("completion_level", 0))
        if d is None:
            continue
        try:
            if isinstance(d, str):
                dt = date.fromisoformat(d)
            else:
                dt = d
            w = dt.weekday()
            if 0 <= w <= 6:
                pct = min(100.0, max(0.0, (level / 4.0) * 100.0))
                by_weekday[w].append(pct)
        except Exception:
            continue
    out = []
    for w in range(7):
        vals = by_weekday[w]
        if not vals:
            out.append(0.0)
        else:
            out.append(round(sum(vals) / len(vals), 1))
    return out
