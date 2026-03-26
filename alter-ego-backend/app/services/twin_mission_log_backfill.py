"""
One-off: recompute twin_mission_log.simulated_hour (and completed_at) for a date
using current _mission_local_hour_window / _assign_simulated_times_for_missions logic.

Usage (from alter-ego-backend/):

    python -m app.services.twin_mission_log_backfill
    python -m app.services.twin_mission_log_backfill --date 2026-03-25
    python -m app.services.twin_mission_log_backfill --list-dates

Default --date: **this machine's local calendar today** (not UTC). Rows in the DB use
each user's *local* mission day; the backfill filters by one `mission_date` string,
so pick a date that actually exists — use `--list-dates` if unsure.

Requires .env with Supabase service credentials (same as the API).
"""

from __future__ import annotations

import argparse
import asyncio
import json
from datetime import date, datetime, timedelta, timezone

from app.core.supabase_client import supabase_admin
from app.services.twin_service import backfill_twin_mission_log_simulated_hours_for_date


def _list_dates_with_row_counts() -> list[tuple[str, int]]:
    """Last 14 local days through tomorrow; count rows per mission_date (exact)."""
    out: list[tuple[str, int]] = []
    today = date.today()
    for i in range(-14, 2):
        d = (today + timedelta(days=i)).isoformat()
        res = (
            supabase_admin.table("twin_mission_log")
            .select("id", count="exact")
            .eq("mission_date", d)
            .execute()
        )
        c = int(getattr(res, "count", None) or 0)
        if c > 0:
            out.append((d, c))
    return out


async def _async_main() -> None:
    parser = argparse.ArgumentParser(description="Backfill twin_mission_log simulated_hour for one date.")
    parser.add_argument(
        "--date",
        default=None,
        help="Mission date YYYY-MM-DD (default: local today on this machine; see --utc-today)",
    )
    parser.add_argument(
        "--utc-today",
        action="store_true",
        help="Use UTC calendar date as default when --date is omitted (overrides local today).",
    )
    parser.add_argument(
        "--list-dates",
        action="store_true",
        help="Print row counts per mission_date (local window: 14 days ago .. tomorrow), then exit.",
    )
    args = parser.parse_args()

    if args.list_dates:
        rows = _list_dates_with_row_counts()
        if not rows:
            print(json.dumps({"message": "No twin_mission_log rows in the local date window.", "dates": []}, indent=2))
        else:
            print(json.dumps({"dates": [{"mission_date": d, "rows": n} for d, n in rows]}, indent=2))
        return

    if args.date:
        mission_date = args.date
    elif args.utc_today:
        mission_date = datetime.now(timezone.utc).date().isoformat()
    else:
        mission_date = date.today().isoformat()

    result = await backfill_twin_mission_log_simulated_hours_for_date(mission_date)
    print(json.dumps(result, indent=2))


def main() -> None:
    asyncio.run(_async_main())


if __name__ == "__main__":
    main()
