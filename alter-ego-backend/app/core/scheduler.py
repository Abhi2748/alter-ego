"""
APScheduler setup for ALTER EGO background jobs.
All jobs that run on a schedule are registered here.

Jobs registered in this file:
- daily_mission_reset: runs every hour, processes users whose midnight just passed
- pet_unlock_check: runs daily at 00:01 UTC (B18)
- twin_simulation: runs daily at 01:00 UTC (B22)
- weekly_report: runs every Sunday at 03:00 UTC (B30)
- day_summary: runs daily at 01:30 UTC (B31)
- twin_recalibration: runs daily at 02:00 UTC, checks who needs recalibration (B25)

Only daily_mission_reset is implemented now.
The rest are registered as placeholder stubs that log "not yet implemented".
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
import logging

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


def setup_scheduler():
    """Register all jobs and return the scheduler. Called on app startup."""

    # ── DAILY MISSION RESET ──────────────────────────────────────────────
    # Runs every hour. Finds users whose local midnight just passed
    # (within the last 60 minutes) and generates their next day's missions.
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
        power_score_job,
        trigger=CronTrigger(hour=1, minute=45),
        id="power_score",
        replace_existing=True,
    )
    scheduler.add_job(
        weekly_report_job,
        trigger=CronTrigger(day_of_week="sun", hour=3, minute=0),
        id="weekly_report",
        replace_existing=True,
    )
    scheduler.add_job(
        day_summary_job,
        trigger=CronTrigger(hour=1, minute=30),
        id="day_summary",
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
        mail_check_job,
        trigger=CronTrigger(hour=0, minute=30),
        id="mail_check",
        replace_existing=True,
    )

    return scheduler


async def pet_unlock_check_job():
    """
    Runs every hour. Only processes users whose local hour is 0 (midnight to 1am).
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

            # Only process users whose local hour is 0 (midnight to 1am)
            if local_hour != 0:
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
    Runs every hour. Finds all users whose local midnight just passed
    (their local time is now between 00:00 and 00:59) and generates
    their missions for the new day.

    Why hourly and not at fixed UTC time:
    Users are in different timezones. We can't reset everyone at midnight UTC
    because that's the middle of the day for some users.
    Instead, every hour we find users whose local time just crossed midnight.
    """
    from app.core.supabase_client import supabase_admin
    from app.services.mission_service import generate_core_missions_for_user, get_user_date
    from app.agents.planner_agent import generate_all_interest_missions, generate_all_quit_target_missions
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

            # Only process users whose local hour is 0 (midnight to 1am)
            if local_hour != 0:
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
            await generate_all_interest_missions(user["id"], today)
            await generate_all_quit_target_missions(user["id"], today)

            reset_count += 1
            logger.info("daily_mission_reset_job: generated missions for user %s", user["id"])

        except Exception as e:
            logger.error("daily_mission_reset_job: failed for user %s: %s", user.get("id"), e)
            continue

    logger.info("daily_mission_reset_job: completed. Reset %s users.", reset_count)


async def twin_simulation_job():
    """
    Runs every hour. Only processes users whose local hour is 0 (midnight to 1am).
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

            # Only process users whose local hour is 0 (midnight to 1am)
            if local_hour != 0:
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
    Runs every hour. Only processes users whose local hour is 0 (midnight to 1am).
    Checks each user to see if recalibration is due.
    """
    from datetime import datetime
    from zoneinfo import ZoneInfo

    from app.core.supabase_client import supabase_admin
    from app.services.twin_service import recalibrate_twin
    from app.services.mission_service import get_days_since_registration

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

            # Only process users whose local hour is 0 (midnight to 1am)
            if local_hour != 0:
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

            if calibration_count == 0 and days >= 10:
                should_recalibrate = True
            elif last_cal:
                from datetime import datetime as dt, timedelta

                last_cal_date = dt.fromisoformat(str(last_cal))
                days_since_cal = (dt.utcnow() - last_cal_date).days
                if days_since_cal >= 14:
                    should_recalibrate = True

            if should_recalibrate:
                await recalibrate_twin(user["id"])
                recal_count += 1
                logger.info("twin_recalibration_job: recalibrated user %s", user["id"])

        except Exception as e:
            logger.error("twin_recalibration_job: failed for user %s: %s", user.get("id"), e)
            continue

    logger.info("twin_recalibration_job: done. Recalibrated %s users.", recal_count)


async def power_score_job():
    """
    Runs daily at 01:45 UTC (after day_summary at 01:30).
    Recalculates Power Score for all users.
    """
    from app.services.power_score_service import calculate_all_power_scores

    logger.info("power_score_job: starting")
    count = await calculate_all_power_scores()
    logger.info("power_score_job: done. Processed %s users.", count)


async def weekly_report_job():
    """Runs every Sunday at 03:00 UTC. Generates weekly report for all onboarded users."""
    from app.agents.report_agent import generate_weekly_report
    from app.core.supabase_client import supabase_admin

    logger.info("weekly_report_job: starting")
    users = (
        supabase_admin.table("users")
        .select("id")
        .eq("onboarding_complete", True)
        .execute()
        .data
        or []
    )

    count = 0
    for user in users:
        try:
            await generate_weekly_report(user["id"])
            count += 1
        except Exception as e:
            logger.error("weekly_report_job: failed for user %s: %s", user.get("id"), e)
    logger.info("weekly_report_job: done. Generated %s reports.", count)


async def day_summary_job():
    """Runs daily at 01:30 UTC. Generates yesterday's summary for all users."""
    from datetime import date, timedelta

    from app.agents.report_agent import generate_day_summary
    from app.core.supabase_client import supabase_admin

    yesterday = str(date.today() - timedelta(days=1))
    logger.info("day_summary_job: generating summaries for %s", yesterday)

    users = (
        supabase_admin.table("users")
        .select("id")
        .eq("onboarding_complete", True)
        .execute()
        .data
        or []
    )

    count = 0
    for user in users:
        try:
            await generate_day_summary(user["id"], yesterday)
            count += 1
        except Exception as e:
            logger.error("day_summary_job: failed for user %s: %s", user.get("id"), e)
    logger.info("day_summary_job: done. Generated %s summaries.", count)


async def nudge_check_job():
    """Runs every hour. Checks Category A and B nudges."""
    from app.agents.nudge_agent import check_and_send_nudges

    logger.info("nudge_check_job: starting")
    result = await check_and_send_nudges()
    logger.info("nudge_check_job: %s", result)


async def mail_check_job():
    """Runs daily at 00:30 UTC. Sends scheduled in-app mails (twin_guide, day_7, etc.)."""
    from app.core.supabase_client import supabase_admin
    from app.services.mail_service import check_and_send_scheduled_mails

    logger.info("mail_check_job: starting")
    users = (
        supabase_admin.table("users")
        .select("id")
        .eq("onboarding_complete", True)
        .execute()
        .data
        or []
    )
    for user in users:
        try:
            await check_and_send_scheduled_mails(user["id"])
        except Exception as e:
            logger.error("mail_check_job: failed for user %s: %s", user.get("id"), e)
    logger.info("mail_check_job: done")
