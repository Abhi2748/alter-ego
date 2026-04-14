"""
In-app mail system.
Pre-written mails triggered by app events.
Stored in app_mails table — displayed as inbox in Profile.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta

from app.core.supabase_client import supabase_admin, run_query

logger = logging.getLogger(__name__)


def _format_mail_text(text: str, data: dict | None) -> str:
    """Apply template_data only to `{name}` placeholders present in text (ignores extra keys in data)."""
    if not data:
        return text
    names = list(dict.fromkeys(re.findall(r"\{(\w+)\}", text)))
    if not names:
        return text
    kwargs = {k: data.get(k, "") for k in names}
    try:
        return text.format(**kwargs)
    except Exception:
        return text

MAIL_CONTENT = {
    "welcome": {
        "subject": "Welcome to ALTER EGO. Here's what happens next.",
        "body": """Welcome.

You've just built the foundations of your discipline engine. Here's what happens from here.

**Every day you get 6 core missions** — five pillars (Sleep, Movement, Hydration, Mindfulness, No-Phone) plus Journal. What each pillar asks scales with your **Season** and **phase** (fixed templates from the app, not one-off AI missions). Journal stays your daily writing habit. Non-negotiable — the substrate that makes every other habit possible.

**Seasons** — the arc on your Home banner — run for a set number of days and split into phases. They tune how demanding those five pillars are as you progress; when a season ends you see how you did (tier, bonus XP, optional title) and can begin the next arc. Season 1 starts automatically.

**Your daily XP and Pet Food caps** match your character stage. Stage 1: **100 XP** and **160 Pet Food** per day. Then Stage 2: 150 / 240, Stage 3: 200 / 360, Stage 4: 280 / 480, Stage 5: 380 / 640, Stage 6: 500 / 800. Completing missions beyond the cap still counts toward your streak and abilities — only XP and Pet Food stop accumulating for that day.

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

It starts as a Cat. It grows through Pet Food — earned every time you complete a mission.

Your companion has 8 stages (same order as Profile → Companion): Cat → Fox → Wolf → Panther → Snow Leopard → Tiger → Phoenix → Dragon.

At a consistent pace, reaching Dragon takes about a year. Your Shadow Twin's companion grows too — their stage reflects the gap between you.

Take care of it by showing up.

— ALTER EGO""",
    },
    "day_7_checkin": {
        "subject": "7 days in. Here's what we've learned.",
        "body": """One week.

Your Twin's personality has been set based on how you've shown up. The system learned your archetype from your onboarding answers — now it's being confirmed by your behaviour.

**Your Twin recalibrates every 7 days.** Completion rate, how you respond to the gap, how often you engage with chat — all of it informs how the Twin is tuned.

**Seasons** on the Home banner set how tough your five pillar core missions are in each phase (Journal stays the same kind of daily entry). As you move through a season, targets can shift — check the banner for your current day and phase.

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
        "body": """Your Shadow Twin recalibrated.

After the first week, your Twin is tuned from real behaviour — not only your onboarding archetype. Every 7 days it updates again: completion rate, how you respond to the gap, how often you engage with chat — intensity, approach to the gap, and how often it speaks all shift.

The Twin becomes more precisely tuned over time.

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
    "interest_week_one": {
        "subject": "One week of {interest_name}",
        "body": """Most people quit at session 3. You've completed 7. The arc continues.

— ALTER EGO""",
    },
    "interest_halfway": {
        "subject": "Halfway there",
        "body": """50% of your {interest_name} journey done. Your Twin noticed.

— ALTER EGO""",
    },
    "interest_phase_complete": {
        "subject": "{interest_name}: {old_phase} phase complete",
        "body": """You've moved into the {new_phase} phase. What you practiced in {old_phase} is now the foundation.

— ALTER EGO""",
    },
    "interest_not_engaged": {
        "subject": "Your {interest_name} journey",
        "body": """You haven't practiced {interest_name} much lately. Three options: adjust your schedule, change your goal, or pause for now. Your progress is saved either way.

— ALTER EGO""",
    },
    "interest_timeline_adjusted": {
        "subject": "Your {interest_name} timeline updated",
        "body": """Your {interest_name} journey has been adjusted to {new_date}. The missions will adapt — no need to rush. Your progress so far is real.

— ALTER EGO""",
    },

    # ── Streak milestones ─────────────────────────────────────────────────────
    "streak_milestone_7": {
        "subject": "7 days. On a Roll.",
        "body": """7 days.

The first week is the hardest. Most people reset before this. You didn't.

**Your streak tier has updated to On a Roll.** The ring on your home screen reflects it.

Your Shadow Twin has been here every day too. The gap between you now reflects 7 days of real choices.

Keep the standard.

— ALTER EGO""",
    },
    "streak_milestone_30": {
        "subject": "30 days. Inferno.",
        "body": """30 consecutive days.

Research on habit formation puts the critical inflection point at 21–66 days depending on complexity. You're through it.

This doesn't mean it gets easier. It means the identity is consolidating. The part of you that negotiated with whether to show up is quieter now.

**Your streak tier has updated to Inferno.**

Your Shadow Twin's streak is tracked alongside yours. The gap is yours — every day of it.

Keep going.

— ALTER EGO""",
    },
    "streak_milestone_100": {
        "subject": "100.",
        "body": """100 consecutive days.

This is rare. Most people who downloaded an app with the same intention as you did not make it here.

The discipline you've built is real. It shows in the gap.

— ALTER EGO""",
    },

    # ── Growth ────────────────────────────────────────────────────────────────
    "ability_first_levelup": {
        "subject": "Your first ability levelled up.",
        "body": """One of your abilities just crossed its first threshold.

**This is the first level-up in your system.** Every level from here requires more SP — and the daily cap means consistent effort over time beats any single good day.

Tap the Abilities section in your Profile to see where you stand and what builds each stat.

The other four abilities are watching.

— ALTER EGO""",
    },
    "focus_first_session": {
        "subject": "First focus session logged.",
        "body": """Your first focus session is recorded.

Every completed session earns **Focus SP** — contributing to your Focus ability alongside your mindfulness and no-phone missions. The Focus tab tracks your total time, sessions, and streaks.

Three modes. Start with Pomodoro if you're unsure. Switch to Deep Work when you need longer blocks.

— ALTER EGO""",
    },

    # ── Quit paths ────────────────────────────────────────────────────────────
    "quit_path_started": {
        "subject": "You started a quit path.",
        "body": """You've committed to a quit path.

The first 72 hours are the withdrawal window for most habits. Physical and psychological — both real, both temporary.

**Your quit path runs in phases.** Each phase brings resistance missions calibrated to where you are. Completing them builds Discipline SP.

The Conquer milestone is earned when you finish a full phase without a slip. Log slips honestly — the system is built for honesty, not perfection.

One day at a time.

— ALTER EGO""",
    },
    "quit_day_1_clean": {
        "subject": "Day 1 clean.",
        "body": """Day 1 complete.

The first 24 hours are often the hardest — the habit is loudest when it's newest.

You logged it. That's the entire job today.

— ALTER EGO""",
    },
    "quit_week_1_clean": {
        "subject": "7 days clean.",
        "body": """7 days clean.

For most habits, the first week covers the acute withdrawal window. The psychological pull continues — but it changes character after this point.

The system has logged your progress. Your Discipline SP reflects it.

Keep going.

— ALTER EGO""",
    },

    # ── Stage evolution ───────────────────────────────────────────────────────
    "stage_evolved": {
        "subject": "You evolved. Stage {new_stage} — {stage_name}.",
        "body": """Stage {new_stage}. {stage_name}.

Your character evolved. Your XP daily cap has increased — you can now earn more per day than before.

Your Shadow Twin's evolution is tracked alongside yours. The gap reflects who showed up.

— ALTER EGO""",
    },
}


async def send_app_mail(
    user_id: str,
    mail_type: str,
    template_data: dict | None = None,
) -> bool:
    # ── Idempotency guard — never send the same mail_type twice within 60 seconds ──
    # Protects against concurrent scheduler calls when workers restart or overlap.
    try:
        sixty_seconds_ago = (datetime.utcnow() - timedelta(seconds=60)).isoformat()
        recent = (
            await run_query(
                supabase_admin.table("app_mails")
                .select("id")
                .eq("user_id", user_id)
                .eq("mail_type", mail_type)
                .gte("sent_at", sixty_seconds_ago)
                .limit(1)
            )
        ).data or []
        if recent:
            logger.info("send_app_mail: skipping duplicate %s for %s", mail_type, user_id)
            return False
    except Exception:
        pass  # If guard fails, proceed — better to send than to silently drop

    content = MAIL_CONTENT.get(mail_type)
    if not content:
        logger.warning("send_app_mail: unknown mail_type '%s'", mail_type)
        return False

    subject = _format_mail_text(content["subject"], template_data)
    body = _format_mail_text(content["body"], template_data)

    try:
        await run_query(supabase_admin.table("app_mails").insert(
            {
                "user_id": user_id,
                "mail_type": mail_type,
                "subject": subject,
                "body_markdown": body,
                "sent_at": datetime.utcnow().isoformat(),
            }
        ))
        return True
    except Exception as e:
        logger.error("send_app_mail: failed for %s: %s", user_id, e)
        return False


async def send_welcome_mail_sequence(user_id: str) -> None:
    """
    Idempotent: onboarding complete may run more than once (retries / double submit).
    Only one welcome mail per user.
    """
    try:
        existing = (
            await run_query(supabase_admin.table("app_mails")
            .select("id")
            .eq("user_id", user_id)
            .eq("mail_type", "welcome")
            .limit(1))
        )
        if existing.data:
            return
    except Exception as e:
        logger.warning("send_welcome_mail_sequence: could not check existing welcome: %s", e)
    await send_app_mail(user_id, "welcome")


async def check_and_send_scheduled_mails(user_id: str) -> None:
    """
    Called on login / daily mission generation (user_local_maintenance hour 1).
    Fires day-based mails that haven't been sent yet.
    Event-based mails are fired from their respective services.
    """
    from app.services.mission_service import get_days_since_registration

    user_result = (
        await run_query(supabase_admin.table("users")
        .select("registration_date, timezone")
        .eq("id", user_id)
        .single())
    )
    user = user_result.data
    if not user:
        return

    days = get_days_since_registration(
        user.get("registration_date", ""), user.get("timezone", "UTC")
    )

    sent_result = (
        ((await run_query(supabase_admin.table("app_mails")
        .select("mail_type")
        .eq("user_id", user_id))).data)
        or []
    )
    sent_types = {m["mail_type"] for m in sent_result}

    if days >= 2 and "twin_guide" not in sent_types:
        await send_app_mail(user_id, "twin_guide")

    if days >= 6 and "pet_unlock" not in sent_types:
        await send_app_mail(user_id, "pet_unlock")

    if days >= 7 and "day_7_checkin" not in sent_types:
        await send_app_mail(user_id, "day_7_checkin")

    if days >= 28 and "week_4_encouragement" not in sent_types:
        await send_app_mail(user_id, "week_4_encouragement")


async def check_and_send_streak_milestone(user_id: str, new_streak: int) -> None:
    milestones = {
        3: "first_streak_tip",
        7: "streak_milestone_7",
        30: "streak_milestone_30",
        100: "streak_milestone_100",
    }
    mail_type = milestones.get(new_streak)
    if not mail_type:
        return

    existing = (
        ((await run_query(supabase_admin.table("app_mails")
        .select("id")
        .eq("user_id", user_id)
        .eq("mail_type", mail_type)
        .limit(1))).data)
        or []
    )
    if not existing:
        await send_app_mail(user_id, mail_type)


async def check_and_send_ability_levelup_mail(user_id: str) -> None:
    existing = (
        ((await run_query(supabase_admin.table("app_mails")
        .select("id")
        .eq("user_id", user_id)
        .eq("mail_type", "ability_first_levelup")
        .limit(1))).data)
        or []
    )
    if not existing:
        await send_app_mail(user_id, "ability_first_levelup")


async def check_and_send_focus_first_session_mail(user_id: str) -> None:
    existing = (
        ((await run_query(supabase_admin.table("app_mails")
        .select("id")
        .eq("user_id", user_id)
        .eq("mail_type", "focus_first_session")
        .limit(1))).data)
        or []
    )
    if not existing:
        await send_app_mail(user_id, "focus_first_session")


async def check_and_send_quit_path_started_mail(user_id: str) -> None:
    existing = (
        ((await run_query(supabase_admin.table("app_mails")
        .select("id")
        .eq("user_id", user_id)
        .eq("mail_type", "quit_path_started")
        .limit(1))).data)
        or []
    )
    if not existing:
        await send_app_mail(user_id, "quit_path_started")


def _interest_dedupe_marker(interest_id: str) -> str:
    return f"<!--interest:{interest_id}-->"


def mail_exists_for_interest(
    user_id: str, mail_type: str, interest_id: str
) -> bool:
    needle = _interest_dedupe_marker(interest_id)
    rows = (
        supabase_admin.table("app_mails")
        .select("body_markdown")
        .eq("user_id", user_id)
        .eq("mail_type", mail_type)
        .execute()
        .data
        or []
    )
    for r in rows:
        if needle in (r.get("body_markdown") or ""):
            return True
    return False


async def send_interest_mail_once(
    user_id: str,
    mail_type: str,
    interest_id: str,
    template_data: dict | None,
) -> bool:
    if mail_exists_for_interest(user_id, mail_type, interest_id):
        return False
    content = MAIL_CONTENT.get(mail_type)
    if not content:
        return False
    data = dict(template_data or {})
    body = _format_mail_text(content["body"], data) + f"\n\n{_interest_dedupe_marker(interest_id)}"
    subject = _format_mail_text(content["subject"], data)
    try:
        await run_query(supabase_admin.table("app_mails").insert(
            {
                "user_id": user_id,
                "mail_type": mail_type,
                "subject": subject,
                "body_markdown": body,
                "sent_at": datetime.utcnow().isoformat(),
            }
        ))
        return True
    except Exception as e:
        logger.error("send_interest_mail_once: failed for %s: %s", user_id, e)
        return False


async def send_stage_evolved_mail_if_needed(
    user_id: str, new_stage: int, stage_name: str
) -> None:
    marker = f"Stage {new_stage}"
    rows = (
        ((await run_query(supabase_admin.table("app_mails")
        .select("subject")
        .eq("user_id", user_id)
        .eq("mail_type", "stage_evolved"))).data)
        or []
    )
    for r in rows:
        if marker in (r.get("subject") or ""):
            return
    await send_app_mail(
        user_id,
        "stage_evolved",
        {"new_stage": new_stage, "stage_name": stage_name},
    )


async def maybe_send_quit_clean_mails(
    user_id: str, days_since_path_start: int
) -> None:
    """days_since_path_start = calendar days since quit path created (0 = first day)."""
    if days_since_path_start == 1:
        existing = (
            ((await run_query(supabase_admin.table("app_mails")
            .select("id")
            .eq("user_id", user_id)
            .eq("mail_type", "quit_day_1_clean")
            .limit(1))).data)
            or []
        )
        if not existing:
            await send_app_mail(user_id, "quit_day_1_clean")
    if days_since_path_start >= 7:
        existing_w = (
            ((await run_query(supabase_admin.table("app_mails")
            .select("id")
            .eq("user_id", user_id)
            .eq("mail_type", "quit_week_1_clean")
            .limit(1))).data)
            or []
        )
        if not existing_w:
            await send_app_mail(user_id, "quit_week_1_clean")
