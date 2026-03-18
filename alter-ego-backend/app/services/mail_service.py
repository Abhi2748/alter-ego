"""
In-app mail system.
Pre-written mails triggered by app events.
Stored in app_mails table — displayed as inbox in Profile.
"""

from __future__ import annotations

import logging
from datetime import datetime

from app.core.supabase_client import supabase_admin

logger = logging.getLogger(__name__)

MAIL_CONTENT = {
    "welcome": {
        "subject": "Welcome to ALTER EGO. Here's what happens next.",
        "body": """Welcome.

You've just built the foundations of your discipline engine. Here's what happens from here.

**Every day you get 6 core missions.** Sleep, Movement, Hydration, Mindfulness, No-Phone window, and Journal. These are non-negotiable — they are the biological substrate that makes every other habit possible.

**Your daily XP and Pet Food caps.** Right now your cap is 200 XP and 160 Pet Food per day. As your character evolves, these caps rise — Stage 2 gives you 300 XP/day, Stage 3 gives 450, all the way to 1,000 XP/day at Stage 6. Completing missions beyond the cap still counts toward your streak and habit — the reward just doesn't accumulate further that day.

**Your interest missions are generated fresh each day.** Calibrated to your level, your available time, and how you've been performing. Tap any mission to see the research behind why it was assigned to you.

**Your streak is your most important number.** Right now, any 2 core missions or 1 interest mission counts. As you progress, the requirement grows with you.

**Your Shadow Twin starts today.** Same XP, same level, same pet. Everything from here is built by choices. Tap the Twin tab to see where you stand.

**Your pet unlocks on Day 6.** Until then, the Pet Food you earn is accumulating.

**The leaderboard unlocks at your first 3-day streak.**

Show up tomorrow. That's all.

— ALTER EGO""",
    },
    "twin_guide": {
        "subject": "Your Twin is waiting. Here's how to talk to it.",
        "body": """Your Shadow Twin has been watching since Day 1.

It started at the same position as you. Zero XP. No pet. Day one, equal.

**To chat with your Twin:** tap the Twin tab, then tap the message icon.

Your Twin speaks in one of three voices depending on your archetype:
- **Rival**: competitive, cold, direct. Respects you only through challenge.
- **Philosopher**: reflective, principled. Speaks in truths, not observations.
- **Silent Force**: minimal. Every word deliberate. Often just a few words.

Your Twin does not coach. It does not give advice. It simply IS — and its existence is the pressure.

The gap between you is yours. You made it. You can close it.

— Your Shadow Twin""",
    },
    "first_streak_tip": {
        "subject": "3-day streak. The leaderboard is almost open.",
        "body": """You've maintained your streak for 3 days.

The leaderboard is now unlocked. Tap the Leaderboard tab to see where you stand.

**Power Score** is your ranking metric. It combines: how far through your current character stage you are (35%), your pet stage (20%), your current streak (25%), and your 30-day completion rate (20%). It updates every night.

The score rewards consistent effort over intensity. Someone who shows up every day at Medium difficulty will outscore someone with explosive Hard weeks followed by nothing.

Keep going.

— ALTER EGO""",
    },
    "leaderboard_unlock": {
        "subject": "The leaderboard is now open.",
        "body": """Your first 3-day streak unlocked the leaderboard.

Your current Power Score and rank are now visible in the Leaderboard tab.

The leaderboard updates every night. Your rank reflects your consistency — not just a single good day.

— ALTER EGO""",
    },
    "pet_unlock": {
        "subject": "Your companion arrived.",
        "body": """Day 6. Your companion is here.

It starts as a Cub. It grows through Pet Food — earned every time you complete a mission.

Your companion has 8 stages: Cub → Cat → Fox → Wolf → Snow Leopard → Panther → Griffin → Dragon.

At a consistent pace, reaching Dragon takes about a year. Your Shadow Twin's companion grows too — their stage reflects the gap between you.

Take care of it by showing up.

— ALTER EGO""",
    },
    "day_7_checkin": {
        "subject": "7 days in. Here's what we've learned.",
        "body": """One week.

Your Twin's personality has been set based on how you've shown up. The system learned your archetype from your onboarding answers — now it's being confirmed by your behaviour.

**Your Twin recalibrates every 14 days.** Completion rate, how you respond to the gap, how often you engage with chat — all of it informs how the Twin is tuned.

**One thing to watch:** your most-skipped mission this week appears in your weekly report every Sunday. It's the one place where the data doesn't lie.

The second week is where most people fall off. You already know what to do.

— ALTER EGO""",
    },
    "streak_requirement_update": {
        "subject": "Your streak requirements just changed.",
        "body": """Your discipline has grown. So has the standard.

Your streak requirement has been upgraded:

{requirement_description}

This is permanent. The early requirements built the habit. These build the discipline.

— ALTER EGO""",
    },
    "first_difficulty_upgrade": {
        "subject": "Your missions got harder.",
        "body": """Your completion rate earned this.

The Planner Agent upgraded your interest mission difficulty. This happens automatically when you've been consistently completing at the current level.

Harder missions mean more XP, more Pet Food, and more growth. They also mean more discomfort. That's the point.

If the new difficulty feels wrong, tap any mission and rate it. The Planner reads your feedback.

— ALTER EGO""",
    },
    "twin_recalibration_note": {
        "subject": "Your Twin just adapted.",
        "body": """10 days in. Your Twin has been watching.

Based on how you've shown up, your Shadow Twin recalibrated its personality — intensity, approach to the gap, how often it speaks.

This happens every 14 days. The Twin becomes more precisely tuned over time.

If it feels different — that's intentional.

— ALTER EGO""",
    },
    "week_4_encouragement": {
        "subject": "28 days.",
        "body": """28 days.

Research on habit formation puts the critical window at 21-66 days depending on complexity. You're through it.

This doesn't mean it gets easier. It means the identity is forming. The part of you that negotiated with whether to show up is getting quieter.

Your Shadow Twin has been here every day. The gap reflects 28 days exactly.

Keep going.

— ALTER EGO""",
    },
}


async def send_app_mail(
    user_id: str,
    mail_type: str,
    template_data: dict | None = None,
) -> bool:
    content = MAIL_CONTENT.get(mail_type)
    if not content:
        logger.warning("send_app_mail: unknown mail_type '%s'", mail_type)
        return False

    body = content["body"]
    if template_data:
        try:
            body = body.format(**template_data)
        except KeyError as e:
            logger.warning("send_app_mail: missing template key %s for %s", e, mail_type)

    try:
        supabase_admin.table("app_mails").insert(
            {
                "user_id": user_id,
                "mail_type": mail_type,
                "subject": content["subject"],
                "body_markdown": body,
                "sent_at": datetime.utcnow().isoformat(),
            }
        ).execute()
        return True
    except Exception as e:
        logger.error("send_app_mail: failed for %s: %s", user_id, e)
        return False


async def send_welcome_mail_sequence(user_id: str) -> None:
    await send_app_mail(user_id, "welcome")


async def check_and_send_scheduled_mails(user_id: str) -> None:
    from app.services.mission_service import get_days_since_registration

    user_result = (
        supabase_admin.table("users")
        .select("registration_date, timezone")
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = user_result.data
    if not user:
        return

    days = get_days_since_registration(
        user.get("registration_date", ""), user.get("timezone", "UTC")
    )

    sent_result = (
        supabase_admin.table("app_mails")
        .select("mail_type")
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )
    sent_types = {m["mail_type"] for m in sent_result}

    if days >= 2 and "twin_guide" not in sent_types:
        await send_app_mail(user_id, "twin_guide")
    if days >= 7 and "day_7_checkin" not in sent_types:
        await send_app_mail(user_id, "day_7_checkin")
    if days >= 10 and "twin_recalibration_note" not in sent_types:
        await send_app_mail(user_id, "twin_recalibration_note")
    if days >= 28 and "week_4_encouragement" not in sent_types:
        await send_app_mail(user_id, "week_4_encouragement")
