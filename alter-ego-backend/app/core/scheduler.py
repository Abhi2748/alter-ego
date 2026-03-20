"""
APScheduler setup for ALTER EGO background jobs.
All jobs that run on a schedule are registered here.

Per-user local time (users.timezone / IANA name):
- daily_mission_reset, pet_unlock_check, twin_simulation, twin_recalibration: local hour 1
- day_summary + power_score + scheduled mail: local hour 1 (batched in user_local_maintenance_job)
- weekly_report: local Sunday 03:00

Nudge checks remain hourly (Category A/B timing is handled inside the agent).
"""

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

    return scheduler


async def pet_unlock_check_job():
    """
    Runs every hour. Only processes users whose local hour is 1 (1:00–1:59).
    Finds users who reached day 6 since registration and unlocks their pet.
    Also handles streak breaks for users who missed yesterday.
    """
    from datetime import datetime

    from app.core.constants import PET_UNLOCK_DAY
    from app.core.supabase_client import supabase_admin
    from app.services.mission_service import get_days_since_registration, get_user_date
    from app.services.streak_service import handle_streak_break
    from zoneinfo import ZoneInfo

    logger.info("pet_unlock_check_job: starting")

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
                logger.info("Pet unlocked for user %s", user["id"])

            last_streak_date = user.get("last_streak_date")
            today = get_user_date(timezone)
            if last_streak_date and str(last_streak_date) < str(today):
                await handle_streak_break(user["id"])
                break_count += 1

        except Exception as e:
            logger.error("pet_unlock_check_job: failed for user %s: %s", user.get("id"), e)
            continue

    logger.info(
        "pet_unlock_check_job: done. Unlocked %s pets, processed %s streak breaks.",
        unlock_count,
        break_count,
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
    from app.services.mission_service import generate_core_missions_for_user, get_user_date, sync_today_planner_missions
    from datetime import datetime
    from zoneinfo import ZoneInfo

    logger.info("daily_mission_reset_job: starting")

    users_result = (
        supabase_admin.table("users")
        .select("id, timezone, registration_date")
        .eq("onboarding_complete", True)
        .execute()
    )

    if not users_result.data:
        logger.info("daily_mission_reset_job: no users found")
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

            existing = (
                supabase_admin.table("missions")
                .select("id")
                .eq("user_id", user["id"])
                .eq("mission_date", today)
                .eq("type", "core")
                .limit(1)
                .execute()
            )
            if existing.data:
                continue

            await generate_core_missions_for_user(user["id"], today)
            await sync_today_planner_missions(user["id"], today)

            reset_count += 1
            logger.info("daily_mission_reset_job: generated missions for user %s", user["id"])

        except Exception as e:
            logger.error("daily_mission_reset_job: failed for user %s: %s", user.get("id"), e)
            continue

    logger.info("daily_mission_reset_job: completed. Reset %s users.", reset_count)


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

    logger.info("twin_simulation_job: starting")

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

            # Keep parity with daily_mission_reset_job: ensure date lookup uses same helper.
            _ = get_user_date(timezone)

            await simulate_twin_day(user["id"])
            # Update strip message after simulation (no event context here)
            await update_strip_message(user["id"])
            success_count += 1
        except Exception as e:
            logger.error("twin_simulation_job: failed for user %s: %s", user.get("id"), e)
            continue

    logger.info("twin_simulation_job: done. Simulated %s users.", success_count)


async def twin_recalibration_job():
    """
    Runs every hour. Only processes users whose local hour is 1 (1:00–1:59).
    Checks each user to see if recalibration is due.
    """
    from datetime import datetime
    from zoneinfo import ZoneInfo

    from app.core.supabase_client import supabase_admin
    from app.core.constants import (
        TWIN_FIRST_CALIBRATION_DAY,
        TWIN_RECALIBRATION_INTERVAL_DAYS,
    )
    from app.services.mail_service import send_app_mail
    from app.services.mission_service import get_days_since_registration
    from app.services.twin_service import recalibrate_twin

    logger.info("twin_recalibration_job: starting")

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

            if calibration_count == 0 and days >= TWIN_FIRST_CALIBRATION_DAY:
                should_recalibrate = True
            elif last_cal:
                from datetime import datetime as dt, timedelta

                last_cal_date = dt.fromisoformat(str(last_cal))
                days_since_cal = (dt.utcnow() - last_cal_date).days
                if days_since_cal >= TWIN_RECALIBRATION_INTERVAL_DAYS:
                    should_recalibrate = True

            if should_recalibrate:
                await recalibrate_twin(user["id"])
                await send_app_mail(user["id"], "twin_recalibration_note")
                recal_count += 1
                logger.info("twin_recalibration_job: recalibrated user %s", user["id"])

        except Exception as e:
            logger.error("twin_recalibration_job: failed for user %s: %s", user.get("id"), e)
            continue

    logger.info("twin_recalibration_job: done. Recalibrated %s users.", recal_count)


async def user_local_maintenance_job():
    """
    Runs every hour. For each onboarded user in local hour 1:
    1) Generate yesterday's day summary (idempotent if already stored)
    2) Recalculate Power Score
    3) Send any due scheduled in-app mails (twin_guide, day_7, etc.)
    """
    from datetime import datetime, timezone as dt_timezone

    from app.agents.report_agent import generate_day_summary
    from app.core.supabase_client import supabase_admin
    from app.services.mail_service import check_and_send_scheduled_mails
    from app.services.power_score_service import calculate_power_score
    from zoneinfo import ZoneInfo

    logger.info("user_local_maintenance_job: starting")

    users_result = (
        supabase_admin.table("users")
        .select("id, timezone")
        .eq("onboarding_complete", True)
        .execute()
    )

    processed = 0
    for user in users_result.data or []:
        try:
            tz_str = user.get("timezone") or "UTC"
            try:
                tz = ZoneInfo(tz_str)
            except Exception:
                tz = dt_timezone.utc
            local_now = datetime.now(tz)
            if local_now.hour != 1:
                continue

            yesterday = (local_now.date() - timedelta(days=1)).isoformat()
            await generate_day_summary(user["id"], yesterday)
            await calculate_power_score(user["id"])
            await check_and_send_scheduled_mails(user["id"])
            processed += 1
        except Exception as e:
            logger.error("user_local_maintenance_job: failed for user %s: %s", user.get("id"), e)
            continue

    logger.info("user_local_maintenance_job: done. Processed %s users (local hour 1).", processed)


async def weekly_report_local_job():
    """Runs every hour; generates the weekly report when user local time is Sunday 03:00–03:59."""
    from datetime import datetime, timezone as dt_timezone

    from app.agents.report_agent import generate_weekly_report
    from app.core.supabase_client import supabase_admin
    from zoneinfo import ZoneInfo

    logger.info("weekly_report_local_job: starting")

    users_result = (
        supabase_admin.table("users")
        .select("id, timezone")
        .eq("onboarding_complete", True)
        .execute()
    )

    count = 0
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
            await generate_weekly_report(user["id"])
            count += 1
        except Exception as e:
            logger.error("weekly_report_local_job: failed for user %s: %s", user.get("id"), e)
            continue

    logger.info("weekly_report_local_job: done. Generated %s reports.", count)


async def nudge_check_job():
    """Runs every hour. Checks Category A and B nudges."""
    from app.agents.nudge_agent import check_and_send_nudges

    logger.info("nudge_check_job: starting")
    result = await check_and_send_nudges()
    logger.info("nudge_check_job: %s", result)


