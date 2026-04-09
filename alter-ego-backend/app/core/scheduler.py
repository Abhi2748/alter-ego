"""
APScheduler setup for ALTER EGO background jobs.
All jobs that run on a schedule are registered here.

Per-user local time (users.timezone / IANA name):
- twin_journal_midnight: local hour 0 (Twin journal for the calendar day that just ended)
- daily_mission_reset, pet_unlock_check, twin_simulation, twin_recalibration: local hour 1
- day_summary + power_score + scheduled mail: local hour 1 (batched in user_local_maintenance_job)
- onboarding echo + contradiction (C1/C2): local Sunday hour 2 (same job loop)
- weekly_report: local Sunday 03:00

Nudge checks remain hourly (Category A/B timing is handled inside the agent).
"""

import asyncio
import json
from datetime import timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import logging

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


def setup_scheduler():
    """Register all jobs and return the scheduler. Called on app startup."""

    # ── DAILY MISSION RESET ──────────────────────────────────────────────
    # Hourly scan; users processed when local hour is 1 (see daily_mission_reset_job).
    scheduler.add_job(
        daily_mission_reset_job,
        trigger=IntervalTrigger(minutes=60),
        id="daily_mission_reset",
        replace_existing=True,
    )

    # ── PET UNLOCK CHECK (B18) + streak break processing (B19) ──────────
    scheduler.add_job(
        pet_unlock_check_job,
        trigger=IntervalTrigger(minutes=60),
        id="pet_unlock_check",
        replace_existing=True,
    )

    # ── PLACEHOLDER STUBS (implemented in later B steps) ─────────────────
    scheduler.add_job(
        twin_simulation_job,
        trigger=IntervalTrigger(minutes=60),
        id="twin_simulation",
        replace_existing=True,
    )
    scheduler.add_job(
        twin_journal_midnight_job,
        trigger=IntervalTrigger(minutes=60),
        id="twin_journal_midnight",
        replace_existing=True,
    )
    scheduler.add_job(
        user_local_maintenance_job,
        trigger=IntervalTrigger(minutes=60),
        id="user_local_maintenance",
        replace_existing=True,
    )
    scheduler.add_job(
        weekly_report_local_job,
        trigger=IntervalTrigger(minutes=60),
        id="weekly_report_local",
        replace_existing=True,
    )
    scheduler.add_job(
        twin_recalibration_job,
        trigger=IntervalTrigger(minutes=60),
        id="twin_recalibration",
        replace_existing=True,
    )
    scheduler.add_job(
        nudge_check_job,
        trigger=IntervalTrigger(minutes=60),
        id="nudge_check",
        replace_existing=True,
    )
    scheduler.add_job(
        proactive_twin_message_job,
        trigger=IntervalTrigger(minutes=60),
        id="proactive_twin_message_job",
        replace_existing=True,
    )
    scheduler.add_job(
        twin_challenge_weekly_job,
        trigger=IntervalTrigger(minutes=60),
        id="twin_challenge_weekly",
        replace_existing=True,
    )

    return scheduler


async def pet_unlock_check_job():
    """
    Runs every hour. Only processes users whose local hour is 1 (1:00–1:59).
    Finds users who reached day 6 since registration and unlocks their pet.
    Also applies streak breaks when the last streak day is before yesterday (local).
    """
    from datetime import datetime

    from app.core.constants import PET_UNLOCK_DAY
    from app.core.supabase_client import supabase_admin
    from app.services.mission_service import get_days_since_registration
    from app.services.streak_service import sync_streak_if_lapsed
    from zoneinfo import ZoneInfo

    logger.info(json.dumps({"event": "pet_unlock_check_job_start"}))

    users_result = (
        supabase_admin.table("users")
        .select("id, registration_date, pet_unlocked, timezone, last_streak_date, current_streak")
        .eq("onboarding_complete", True)
        .execute()
    )

    unlock_count = 0
    break_count = 0

    for user in (users_result.data or []):
        try:
            timezone = user.get("timezone", "UTC")
            tz = ZoneInfo(timezone)
            local_now = datetime.now(tz)
            local_hour = local_now.hour

            # Align with other deferred jobs: 1:00–1:59 local.
            if local_hour != 1:
                continue

            days = get_days_since_registration(user.get("registration_date", ""), timezone)

            if days >= PET_UNLOCK_DAY and not user.get("pet_unlocked"):
                supabase_admin.table("users").update(
                    {"pet_unlocked": True, "pet_stage": 1, "pet_state": "happy"}
                ).eq("id", user["id"]).execute()

                supabase_admin.table("milestone_log").insert(
                    {
                        "user_id": user["id"],
                        "milestone_type": "pet_unlock",
                        "earned_at": datetime.utcnow().isoformat(),
                    }
                ).execute()

                from app.agents.nudge_agent import send_category_c_notification
                await send_category_c_notification(user["id"], "pet_unlock")

                unlock_count += 1
                logger.info(
                    json.dumps(
                        {
                            "event": "pet_unlocked",
                            "user_id": str(user["id"]),
                        }
                    )
                )

            if await sync_streak_if_lapsed(user["id"]):
                break_count += 1

        except Exception as e:
            logger.error(
                json.dumps(
                    {
                        "event": "pet_unlock_check_error",
                        "user_id": str(user.get("id", "")),
                        "error": str(e)[:200],
                    }
                )
            )
            continue

    logger.info(
        json.dumps(
            {
                "event": "pet_unlock_check_job_done",
                "unlock_count": unlock_count,
                "break_count": break_count,
            }
        )
    )


async def daily_mission_reset_job():
    """
    Runs every hour. For each user whose local time is 01:00–01:59, pre-generates
    today's missions if core rows are still missing.

    Why 1:00 local (not midnight): matches product choice to batch non-urgent work
    shortly after the calendar day starts; GET /missions/today still creates rows
    on demand between midnight and 1:00 if the user opens the app.

    Why hourly and not at fixed UTC time:
    Users are in different timezones — we scan each hour and filter by local hour.
    """
    from app.core.supabase_client import supabase_admin
    from app.services.mission_service import (
        generate_core_missions_for_user,
        get_today_missions,
        get_user_date,
        sync_today_planner_missions,
    )
    from app.services.stat_service import ensure_sp_day_aligned, set_total_missions_for_day
    from app.services.sigil_service import reset_daily_surge
    from datetime import datetime
    from zoneinfo import ZoneInfo

    logger.info(json.dumps({"event": "daily_mission_reset_job_start"}))

    users_result = (
        supabase_admin.table("users")
        .select("id, timezone, registration_date")
        .eq("onboarding_complete", True)
        .execute()
    )

    if not users_result.data:
        logger.info(json.dumps({"event": "daily_mission_reset_job_done", "reset_count": 0, "note": "no_users"}))
        return

    reset_count = 0

    for user in users_result.data:
        try:
            timezone = user.get("timezone", "UTC")
            tz = ZoneInfo(timezone)
            local_now = datetime.now(tz)
            local_hour = local_now.hour

            # Deferred daily generation: 1:00–1:59 local (not UTC midnight).
            if local_hour != 1:
                continue

            today = get_user_date(timezone)

            await ensure_sp_day_aligned(user["id"], today)

            existing = (
                supabase_admin.table("missions")
                .select("id")
                .eq("user_id", user["id"])
                .eq("mission_date", today)
                .eq("type", "core")
                .limit(1)
                .execute()
            )
            if not existing.data:
                await generate_core_missions_for_user(user["id"], today)
                await sync_today_planner_missions(user["id"], today)
                reset_count += 1
                logger.info(
                    json.dumps(
                        {
                            "event": "daily_mission_reset_user",
                            "user_id": str(user["id"]),
                            "date": today,
                        }
                    )
                )
            else:
                await sync_today_planner_missions(user["id"], today)

            rows = await get_today_missions(user["id"], today)
            await set_total_missions_for_day(user["id"], len(rows))

            reset_daily_surge(user["id"])

        except Exception as e:
            logger.error(
                json.dumps(
                    {
                        "event": "daily_mission_reset_error",
                        "user_id": str(user.get("id", "")),
                        "error": str(e)[:200],
                    }
                )
            )
            continue

    logger.info(
        json.dumps(
            {
                "event": "daily_mission_reset_job_done",
                "reset_count": reset_count,
            }
        )
    )


async def twin_simulation_job():
    """
    Runs every hour. Only processes users whose local hour is 1 (1:00–1:59).
    Simulates the twin's day for all users who have completed onboarding.
    """
    from datetime import datetime
    from zoneinfo import ZoneInfo

    from app.services.twin_service import simulate_twin_day
    from app.services.strip_message_service import update_strip_message
    from app.core.supabase_client import supabase_admin
    from app.services.mission_service import get_user_date

    logger.info(json.dumps({"event": "twin_simulation_job_start"}))

    users_result = (
        supabase_admin.table("users")
        .select("id, timezone")
        .eq("onboarding_complete", True)
        .execute()
    )

    success_count = 0
    for user in (users_result.data or []):
        try:
            timezone = user.get("timezone", "UTC") or "UTC"
            tz = ZoneInfo(timezone)
            local_now = datetime.now(tz)
            local_hour = local_now.hour

            if local_hour != 1:
                continue

            today_str = get_user_date(timezone)

            await simulate_twin_day(user["id"])

            # Twin journal is written at local midnight for the day that just ended, not at 1am for "today"
            # (avoids empty user mission counts and premature release). See twin_journal_midnight_job.

            await update_strip_message(user["id"])
            success_count += 1
            logger.info(
                json.dumps(
                    {
                        "event": "twin_simulated",
                        "user_id": str(user.get("id")),
                        "date": today_str,
                    }
                )
            )
        except Exception as e:
            logger.error(
                json.dumps(
                    {
                        "event": "twin_simulation_error",
                        "user_id": str(user.get("id", "")),
                        "error": str(e)[:200],
                    }
                )
            )
            continue

    logger.info(
        json.dumps(
            {
                "event": "twin_simulation_job_done",
                "success_count": success_count,
            }
        )
    )


async def twin_journal_midnight_job():
    """
    Runs every hour. Only processes users whose local hour is 0 (00:00–00:59).
    Writes the Twin journal for the calendar day that just ended (yesterday).
    """
    from datetime import datetime

    from zoneinfo import ZoneInfo

    from app.core.supabase_client import supabase_admin
    from app.services.twin_service import generate_journal_for_yesterday

    logger.info(json.dumps({"event": "twin_journal_midnight_job_start"}))

    users_result = (
        supabase_admin.table("users")
        .select("id, timezone")
        .eq("onboarding_complete", True)
        .execute()
    )

    count = 0
    for user in users_result.data or []:
        try:
            timezone = user.get("timezone", "UTC") or "UTC"
            tz = ZoneInfo(timezone)
            local_now = datetime.now(tz)
            local_hour = local_now.hour

            if local_hour != 0:
                continue

            await generate_journal_for_yesterday(str(user["id"]))
            count += 1
        except Exception as e:
            logger.error(
                json.dumps(
                    {
                        "event": "twin_journal_midnight_error",
                        "user_id": str(user.get("id", "")),
                        "error": str(e)[:200],
                    }
                )
            )
            continue

    logger.info(
        json.dumps(
            {
                "event": "twin_journal_midnight_job_done",
                "count": count,
            }
        )
    )


async def twin_recalibration_job():
    """
    Runs every hour. Only processes users whose local hour is 1 (1:00–1:59).
    Checks each user to see if recalibration is due.
    """
    from datetime import datetime
    from zoneinfo import ZoneInfo

    from app.core.supabase_client import supabase_admin
    from app.core.constants import FIRST_RECALIBRATION_DAY, RECALIBRATION_INTERVAL_DAYS
    from app.services.mail_service import send_app_mail
    from app.services.mission_service import get_days_since_registration
    from app.services.twin_service import recalibrate_twin

    logger.info(json.dumps({"event": "twin_recalibration_job_start"}))

    users_result = (
        supabase_admin.table("users")
        .select("id, registration_date, timezone")
        .eq("onboarding_complete", True)
        .execute()
    )

    recal_count = 0
    for user in (users_result.data or []):
        try:
            timezone = user.get("timezone", "UTC") or "UTC"
            tz = ZoneInfo(timezone)
            local_now = datetime.now(tz)
            local_hour = local_now.hour

            if local_hour != 1:
                continue

            days = get_days_since_registration(user.get("registration_date", ""), user.get("timezone", "UTC"))

            dna = (
                supabase_admin.table("discipline_dna")
                .select("calibration_count, last_calibration_at")
                .eq("user_id", user["id"])
                .single()
                .execute()
                .data
            )

            calibration_count = int(dna.get("calibration_count") or 0) if dna else 0
            last_cal = dna.get("last_calibration_at") if dna else None

            should_recalibrate = False

            if calibration_count == 0 and days >= FIRST_RECALIBRATION_DAY:
                should_recalibrate = True
            elif last_cal:
                from datetime import datetime as dt, timedelta

                last_cal_date = dt.fromisoformat(str(last_cal))
                days_since_cal = (dt.utcnow() - last_cal_date).days
                if days_since_cal >= RECALIBRATION_INTERVAL_DAYS:
                    should_recalibrate = True

            if should_recalibrate:
                await recalibrate_twin(user["id"])
                await send_app_mail(user["id"], "twin_recalibration_note")
                recal_count += 1
                logger.info(
                    json.dumps(
                        {
                            "event": "twin_recalibrated",
                            "user_id": str(user["id"]),
                        }
                    )
                )

            try:
                from app.services.arc_service import run_adaptive_replanning_for_user

                await run_adaptive_replanning_for_user(user["id"])
            except Exception:
                pass

        except Exception as e:
            logger.error(
                json.dumps(
                    {
                        "event": "twin_recalibration_error",
                        "user_id": str(user.get("id", "")),
                        "error": str(e)[:200],
                    }
                )
            )
            continue

    logger.info(
        json.dumps(
            {
                "event": "twin_recalibration_job_done",
                "recal_count": recal_count,
            }
        )
    )


async def user_local_maintenance_job():
    """
    Runs every hour. For each onboarded user:
    - Local hour 1: yesterday summary, power score, scheduled mail.
    - Local Sunday hour 2: onboarding echo (C1) + contradiction journal (C2).
    """
    from datetime import datetime, timezone as dt_timezone

    from app.agents.report_agent import generate_day_summary
    from app.core.supabase_client import supabase_admin
    from app.services.contact_coordination import record_contact
    from app.services.echo_service import (
        fire_contradiction_for_user,
        fire_echo_for_user,
        should_fire_contradiction,
        should_fire_echo,
    )
    from app.services.mail_service import check_and_send_scheduled_mails
    from app.services.mission_service import get_days_since_registration
    from app.services.power_score_service import calculate_power_score
    from zoneinfo import ZoneInfo

    logger.info(json.dumps({"event": "user_local_maintenance_job_start"}))

    users_result = (
        supabase_admin.table("users")
        .select(
            "id, timezone, archetype, registration_date, "
            "last_echo_fired_at, last_echo_question_key, "
            "last_contradiction_fired_at, echoes_fired_count"
        )
        .eq("onboarding_complete", True)
        .execute()
    )

    processed = 0
    for user in users_result.data or []:
        user_id = user.get("id")
        try:
            tz_str = user.get("timezone") or "UTC"
            try:
                tz = ZoneInfo(tz_str)
            except Exception:
                tz = dt_timezone.utc
            local_now = datetime.now(tz)
            local_hour = local_now.hour

            if local_hour == 1:
                yesterday = (local_now.date() - timedelta(days=1)).isoformat()
                await generate_day_summary(user_id, yesterday)
                await calculate_power_score(user_id)
                await check_and_send_scheduled_mails(user_id)
                processed += 1

            # C1 + C2: Sunday 02:00 local (after mission reset hour)
            if local_now.weekday() == 6 and local_hour == 2:
                try:
                    reg_date = str(user.get("registration_date") or "")
                    echo_day_number = get_days_since_registration(reg_date, tz_str)
                    days_active = max(0, echo_day_number - 1)

                    if days_active >= 7:
                        if should_fire_echo(user):
                            fired_echo = await fire_echo_for_user(
                                supabase_admin, user_id, user, echo_day_number
                            )
                            if fired_echo:
                                await record_contact(user_id, "echo", tz_str)
                        if should_fire_contradiction(user):
                            fired_contra = await fire_contradiction_for_user(
                                supabase_admin, user_id, user, echo_day_number
                            )
                            if fired_contra:
                                await record_contact(user_id, "contradiction", tz_str)
                except Exception as e:
                    logger.error(
                        json.dumps(
                            {
                                "event": "echo_scheduler_error",
                                "user_id": str(user_id),
                                "error": str(e)[:200],
                            }
                        )
                    )
        except Exception as e:
            logger.error(
                json.dumps(
                    {
                        "event": "user_local_maintenance_error",
                        "user_id": str(user_id),
                        "error": str(e)[:200],
                    }
                )
            )
            continue

    logger.info(
        json.dumps(
            {
                "event": "user_local_maintenance_job_done",
                "processed_hour1": processed,
            }
        )
    )


async def weekly_report_local_job():
    """Runs every hour; generates the weekly report when user local time is Sunday 03:00–03:59."""
    import asyncio
    from datetime import datetime, timezone as dt_timezone

    from app.agents.report_agent import generate_weekly_report
    from app.core.supabase_client import supabase_admin
    from zoneinfo import ZoneInfo

    logger.info(json.dumps({"event": "weekly_report_local_job_start"}))

    users_result = (
        supabase_admin.table("users")
        .select("id, timezone")
        .eq("onboarding_complete", True)
        .execute()
    )

    due_ids: list[str] = []
    for user in users_result.data or []:
        try:
            tz_str = user.get("timezone") or "UTC"
            try:
                tz = ZoneInfo(tz_str)
            except Exception:
                tz = dt_timezone.utc
            local_now = datetime.now(tz)
            # Monday=0 .. Sunday=6
            if local_now.weekday() != 6:
                continue
            if local_now.hour != 3:
                continue
            due_ids.append(user["id"])
        except Exception as e:
            logger.error(
                json.dumps(
                    {
                        "event": "weekly_report_schedule_error",
                        "user_id": str(user.get("id", "")),
                        "error": str(e)[:200],
                    }
                )
            )

    BATCH_SIZE = 50
    count = 0

    async def _one(uid: str) -> None:
        from datetime import datetime

        from zoneinfo import ZoneInfo

        from app.services.mission_service import local_completed_week_bounds
        from app.services.report_service import weekly_report_week_eligible

        urow = (
            supabase_admin.table("users")
            .select("registration_date, timezone")
            .eq("id", uid)
            .single()
            .execute()
            .data
            or {}
        )
        tz_str = str(urow.get("timezone") or "UTC")
        try:
            tz = ZoneInfo(tz_str)
        except Exception:
            from datetime import timezone as dt_utc

            tz = dt_utc.utc
        now_local = datetime.now(tz)
        ws, we = local_completed_week_bounds(tz_str)
        if not weekly_report_week_eligible(
            urow.get("registration_date"),
            tz_str,
            ws,
            we,
            now_local=now_local,
        ):
            return
        await generate_weekly_report(uid)

    for i in range(0, len(due_ids), BATCH_SIZE):
        batch = due_ids[i : i + BATCH_SIZE]
        results = await asyncio.gather(*[_one(uid) for uid in batch], return_exceptions=True)
        for uid, res in zip(batch, results):
            if isinstance(res, Exception):
                logger.error(
                    json.dumps(
                        {
                            "event": "weekly_report_error",
                            "user_id": str(uid),
                            "error": str(res)[:200],
                        }
                    )
                )
            else:
                count += 1
                logger.info(
                    json.dumps(
                        {
                            "event": "weekly_report_generated",
                            "user_id": str(uid),
                        }
                    )
                )

    logger.info(
        json.dumps(
            {
                "event": "weekly_report_local_job_done",
                "report_count": count,
            }
        )
    )


async def nudge_check_job():
    """Runs every hour. Checks Category A and B nudges + absence escalation pushes (B3)."""
    from app.agents.nudge_agent import check_and_send_nudges
    from app.services.absence_service import process_absence_escalation_notifications

    logger.info(json.dumps({"event": "nudge_check_job_start"}))
    result = await check_and_send_nudges()
    logger.info(json.dumps({"event": "nudge_check_job_nudges", "result": result}))
    try:
        await process_absence_escalation_notifications()
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "nudge_check_absence_error",
                    "error": str(e)[:200],
                }
            )
        )
    logger.info(json.dumps({"event": "nudge_check_job_done"}))


async def proactive_twin_message_job():
    """Hourly tick; implementation lives in `twin_service.proactive_twin_message_job`."""
    from app.services.twin_service import proactive_twin_message_job as _run_proactive_twin

    await _run_proactive_twin()


async def twin_challenge_weekly_job():
    """
    Runs every hour. Only processes users whose local time is Sunday 00:00–00:59.
    Generates a new weekly Twin Challenge for each user who doesn't have an active one.
    Runs at the same local hour as twin_journal_midnight_job (midnight Sunday).
    """
    from datetime import datetime

    from zoneinfo import ZoneInfo

    from app.core.supabase_client import supabase_admin
    from app.services.challenge_service import generate_weekly_challenge

    logger.info(json.dumps({"event": "twin_challenge_weekly_job_start"}))

    users_result = (
        supabase_admin.table("users")
        .select("id, timezone")
        .eq("onboarding_complete", True)
        .execute()
    )

    count = 0
    for user in users_result.data or []:
        try:
            timezone_str = user.get("timezone", "UTC") or "UTC"
            tz = ZoneInfo(timezone_str)
            local_now = datetime.now(tz)

            # Sunday = weekday 6, local midnight hour 0
            if local_now.weekday() != 6 or local_now.hour != 0:
                continue

            await generate_weekly_challenge(str(user["id"]))
            count += 1
        except Exception as e:
            logger.error(json.dumps({
                "event": "twin_challenge_weekly_error",
                "user_id": str(user.get("id", "")),
                "error": str(e)[:200],
            }))
            continue

    logger.info(json.dumps({
        "event": "twin_challenge_weekly_job_done",
        "count": count,
    }))

