"""
Absence detection, Twin accomplishment feed, escalation pushes (B3).
No LLM. Errors logged; never raises to callers.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Mapping
from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.core.constants import (
    ABSENCE_NOTIFICATION_COPY,
    ABSENCE_PUSH_THRESHOLD_DAYS,
    ABSENCE_SILENT_RETURN_NOTIFICATION,
)
from app.core.supabase_client import supabase_admin
from app.services.mission_service import get_user_date

logger = logging.getLogger(__name__)


def _resolve_last_active_date(user: Mapping[str, Any], supabase: Any, user_id: str) -> str | None:
    """
    Most recent calendar day the user earned XP / was marked active / had streak credit.
    Prefer the latest of all signals so a stale users.last_active_date cannot hide real activity.
    """
    candidates: list[str] = []

    la = user.get("last_active_date")
    if la:
        candidates.append(str(la)[:10])

    xp_result = (
        supabase.table("xp_log")
        .select("log_date")
        .eq("user_id", user_id)
        .order("log_date", desc=True)
        .limit(1)
        .execute()
    )
    if xp_result.data:
        d = str(xp_result.data[0].get("log_date", ""))[:10]
        if d:
            candidates.append(d)

    ls = user.get("last_streak_date")
    if ls:
        candidates.append(str(ls)[:10])

    if not candidates:
        return None
    return max(candidates)


def compute_absence_days(
    supabase: Any,
    user_id: str,
    user: dict,
    today: str,
) -> int:
    """
    Full calendar days missed since last activity (not "days since last completion" raw delta).

    If the user was active yesterday but not yet today, that is 0 missed days — not day-1 absence.
    Syncs users.absence_days. Returns computed value; on error returns 0.
    """
    try:
        last_active = _resolve_last_active_date(user, supabase, user_id)
        if not last_active:
            return 0

        today_date = date.fromisoformat(today[:10])
        last_date = date.fromisoformat(last_active[:10])
        if last_date > today_date:
            return 0

        raw_gap = (today_date - last_date).days
        # raw_gap 1 = last active yesterday → 0 full missed days (today still in progress)
        days_absent = max(0, raw_gap - 1)

        prev = int(user.get("absence_days") or 0)
        if days_absent != prev:
            supabase.table("users").update({"absence_days": days_absent}).eq("id", user_id).execute()
            if days_absent >= 1:
                logger.info(
                    json.dumps(
                        {
                            "event": "absence_detected",
                            "user_id": user_id,
                            "days": days_absent,
                        }
                    )
                )

        return max(0, days_absent)
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "absence_compute_error",
                    "user_id": user_id,
                    "error": str(e),
                }
            )
        )
        return 0


def reset_absence(supabase: Any, user_id: str, today: str) -> None:
    """On any mission completion: clear absence streak and mark last active."""
    try:
        supabase.table("users").update(
            {
                "absence_days": 0,
                "last_active_date": today[:10],
                "last_absence_notif_day": 0,
                "final_absence_notif_sent": False,
                "long_absence_shown": False,
            }
        ).eq("id", user_id).execute()
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "absence_reset_error",
                    "user_id": user_id,
                    "error": str(e),
                }
            )
        )


def get_twin_accomplishments(
    supabase: Any,
    user_id: str,
    days: int,
    anchor_today: str | None = None,
) -> list[dict[str, str]]:
    """
    Last N days of twin_daily_record for day-5 interstitial (max 3 entries).
    """
    try:
        result = (
            supabase.table("twin_daily_record")
            .select("record_date, xp_earned, missions_completed")
            .eq("user_id", user_id)
            .order("record_date", desc=True)
            .limit(max(days, 1))
            .execute()
        )

        ref = date.today()
        if anchor_today:
            try:
                ref = date.fromisoformat(anchor_today[:10])
            except Exception:
                pass

        entries: list[dict[str, str]] = []
        for row in (result.data or [])[:3]:
            xp = int(row.get("xp_earned") or 0)
            missions = int(row.get("missions_completed") or 0)
            rec_date = str(row.get("record_date", ""))[:10]
            if xp == 0 and missions == 0:
                continue

            try:
                rd = date.fromisoformat(rec_date)
                days_ago = (ref - rd).days
                if days_ago == 0:
                    time_label = "today"
                elif days_ago == 1:
                    time_label = "yesterday"
                else:
                    time_label = f"{days_ago} days ago"
            except Exception:
                time_label = rec_date

            entry_text = f"Completed {missions} mission{'s' if missions != 1 else ''}"
            if xp > 0:
                entry_text += f" · +{xp} XP"
            entries.append({"text": entry_text, "time_label": time_label})

        return entries
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "twin_accomplishments_error",
                    "user_id": user_id,
                    "error": str(e),
                }
            )
        )
        return []


async def process_absence_escalation_notifications() -> None:
    """
    Hourly (via nudge_check_job). Recompute absence, send threshold pushes once,
    and send 24h unsure follow-up. Silent on all errors per user.
    """
    from app.agents.nudge_agent import _send_push_notification

    try:
        users_result = (
            supabase_admin.table("users")
            .select(
                "id, timezone, push_token, notifications_enabled, onboarding_complete, "
                "last_active_date, absence_days, last_absence_notif_day, last_streak_date, "
                "return_reason, return_reason_set_at, unsure_followup_push_sent, "
                "final_absence_notif_sent"
            )
            .eq("onboarding_complete", True)
            .eq("notifications_enabled", True)
            .execute()
        )
    except Exception as e:
        logger.error(
            json.dumps(
                {"event": "absence_notif_batch_error", "error": str(e)[:200]}
            )
        )
        return

    for user in users_result.data or []:
        uid = str(user.get("id") or "")
        if not uid:
            continue
        token = user.get("push_token")
        if not token:
            continue

        try:
            tz = str(user.get("timezone") or "UTC").strip() or "UTC"
            today = get_user_date(tz)

            days = compute_absence_days(supabase_admin, uid, user, today)

            if days >= 14:
                final_sent = bool(user.get("final_absence_notif_sent"))
                if not final_sent and token:
                    fn = ABSENCE_FINAL_NOTIFICATION
                    await _send_push_notification(
                        token,
                        fn["title"],
                        fn["body"],
                        push_context="absence_final",
                    )
                    try:
                        supabase_admin.table("users").update(
                            {"final_absence_notif_sent": True}
                        ).eq("id", uid).execute()
                    except Exception:
                        pass
                    logger.info(
                        json.dumps(
                            {
                                "event": "absence_notification_sent",
                                "user_id": uid,
                                "absence_days": days,
                                "notification_type": "final",
                            }
                        )
                    )
                continue

            if days in ABSENCE_PUSH_THRESHOLD_DAYS:
                last_sent = int(user.get("last_absence_notif_day") or 0)
                if last_sent != days:
                    copy = ABSENCE_NOTIFICATION_COPY.get(days)
                    if copy:
                        await _send_push_notification(
                            token,
                            copy["title"],
                            copy["body"],
                            push_context=f"absence_day_{days}",
                        )
                        try:
                            supabase_admin.table("users").update(
                                {"last_absence_notif_day": days}
                            ).eq("id", uid).execute()
                        except Exception:
                            pass
                        logger.info(
                            json.dumps(
                                {
                                    "event": "absence_notification_sent",
                                    "user_id": uid,
                                    "absence_days": days,
                                    "notification_type": f"day_{days}",
                                }
                            )
                        )

            if (
                user.get("return_reason") == "unsure"
                and not user.get("unsure_followup_push_sent")
                and user.get("return_reason_set_at")
            ):
                try:
                    raw = str(user["return_reason_set_at"]).replace("Z", "+00:00")
                    set_at = datetime.fromisoformat(raw)
                    if set_at.tzinfo is None:
                        set_at = set_at.replace(tzinfo=timezone.utc)
                    if datetime.now(timezone.utc) - set_at >= timedelta(hours=24):
                        n = ABSENCE_SILENT_RETURN_NOTIFICATION
                        await _send_push_notification(
                            token,
                            n["title"],
                            n["body"],
                            push_context="absence_unsure_followup",
                        )
                        supabase_admin.table("users").update(
                            {"unsure_followup_push_sent": True}
                        ).eq("id", uid).execute()
                        logger.info(
                            json.dumps(
                                {
                                    "event": "absence_notification_sent",
                                    "user_id": uid,
                                    "absence_days": days,
                                    "notification_type": "unsure_followup",
                                }
                            )
                        )
                except Exception as ex:
                    logger.error(
                        json.dumps(
                            {
                                "event": "absence_unsure_followup_error",
                                "user_id": uid,
                                "error": str(ex)[:200],
                            }
                        )
                    )

        except Exception as err:
            logger.error(
                json.dumps(
                    {
                        "event": "absence_notification_error",
                        "user_id": uid,
                        "error": str(err)[:200],
                    }
                )
            )

