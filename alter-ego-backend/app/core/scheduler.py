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
        trigger=CronTrigger(hour=0, minute=1),
        id="pet_unlock_check",
        replace_existing=True,
    )

    # ── PLACEHOLDER STUBS (implemented in later B steps) ─────────────────
    scheduler.add_job(
        lambda: logger.info("twin_simulation: not yet implemented"),
        trigger=CronTrigger(hour=1, minute=0),
        id="twin_simulation",
        replace_existing=True,
    )
    scheduler.add_job(
        lambda: logger.info("weekly_report: not yet implemented"),
        trigger=CronTrigger(day_of_week="sun", hour=3, minute=0),
        id="weekly_report",
        replace_existing=True,
    )
    scheduler.add_job(
        lambda: logger.info("day_summary: not yet implemented"),
        trigger=CronTrigger(hour=1, minute=30),
        id="day_summary",
        replace_existing=True,
    )
    scheduler.add_job(
        lambda: logger.info("twin_recalibration: not yet implemented"),
        trigger=CronTrigger(hour=2, minute=0),
        id="twin_recalibration",
        replace_existing=True,
    )

    return scheduler


async def pet_unlock_check_job():
    """
    Runs daily at 00:01 UTC.
    Finds users who reached day 6 since registration and unlocks their pet.
    Also handles streak breaks for users who missed yesterday.
    """
    from datetime import datetime

    from app.core.constants import PET_UNLOCK_DAY
    from app.core.supabase_client import supabase_admin
    from app.services.mission_service import get_days_since_registration, get_user_date
    from app.services.streak_service import handle_streak_break

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

