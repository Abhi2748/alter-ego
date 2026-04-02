"""
Outbound contact coordination: daily budget for nudge / proactive / echo / contradiction.
In-app mail does not count toward the budget.
"""

from __future__ import annotations

import logging

from app.core.constants import NUDGE_DAILY_CAPS
from app.core.supabase_client import supabase_admin
from app.services.mission_service import get_user_date

logger = logging.getLogger(__name__)


def _local_date_str(user_tz: str) -> str:
    """Today's calendar date in the user's timezone (YYYY-MM-DD)."""
    return get_user_date(user_tz or "UTC")


def _budget_from_external_validation(ev: float) -> int:
    if ev > 0.7:
        return 3
    if ev > 0.4:
        return 2
    return 1


async def can_contact_user(user_id: str, user_tz: str) -> bool:
    """
    Returns True if the user still has contact budget remaining today (their local date).
    """
    try:
        local_date = _local_date_str(user_tz)
        dna_res = (
            supabase_admin.table("discipline_dna")
            .select("external_validation_need, twin_message_frequency")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        row = (dna_res.data or [None])[0] or {}
        ev = float(row.get("external_validation_need") or 0.5)
        ev_budget = _budget_from_external_validation(ev)

        freq = str(row.get("twin_message_frequency") or "").strip().lower()
        if freq in NUDGE_DAILY_CAPS:
            daily_budget = NUDGE_DAILY_CAPS[freq]
        else:
            daily_budget = ev_budget

        cnt_res = (
            supabase_admin.table("daily_contact_log")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("contact_date", local_date)
            .execute()
        )
        contacts_today = getattr(cnt_res, "count", None)
        if contacts_today is None:
            contacts_today = len(cnt_res.data or [])
        contacts_today = int(contacts_today)
        return contacts_today < daily_budget
    except Exception as e:
        logger.warning("can_contact_user failed user=%s: %s", user_id, e)
        return True


async def record_contact(user_id: str, contact_type: str, user_tz: str) -> None:
    """Inserts a row into daily_contact_log for today's local date."""
    try:
        local_date = _local_date_str(user_tz)
        supabase_admin.table("daily_contact_log").insert(
            {
                "user_id": user_id,
                "contact_date": local_date,
                "contact_type": contact_type,
            }
        ).execute()
    except Exception as e:
        logger.warning(
            "record_contact failed user=%s type=%s: %s", user_id, contact_type, e
        )


async def proactive_sent_today(user_id: str, user_tz: str) -> bool:
    """Returns True if a 'proactive' contact was already recorded today."""
    try:
        local_date = _local_date_str(user_tz)
        res = (
            supabase_admin.table("daily_contact_log")
            .select("id")
            .eq("user_id", user_id)
            .eq("contact_date", local_date)
            .eq("contact_type", "proactive")
            .limit(1)
            .execute()
        )
        return bool(res.data)
    except Exception as e:
        logger.warning("proactive_sent_today failed user=%s: %s", user_id, e)
        return False
