"""
arc_service.py — Interest learning arc calculations.

Computes arc phases, session targets, and handles adaptive replanning.
Called by: interest creation, mission completion hook, weekly recalibration job.
"""
from __future__ import annotations

import json
import logging
from datetime import date as date_cls, datetime, timezone, timedelta
from typing import Literal

from app.core.supabase_client import supabase_admin
from app.services.mail_service import send_app_mail

logger = logging.getLogger(__name__)

ArcPhase = Literal["foundation", "building", "applying", "mastery", "no_deadline"]

# ── Arc phase boundaries (% of total_planned_sessions) ────────────────────────
ARC_PHASE_BOUNDARIES = {
    "foundation": (0.0, 0.20),
    "building": (0.20, 0.50),
    "applying": (0.50, 0.80),
    "mastery": (0.80, 1.00),
}

ARC_PHASE_LABELS = {
    "foundation": "Foundation",
    "building": "Building",
    "applying": "Applying",
    "mastery": "Mastery",
    "no_deadline": "Open Practice",
}

# ── Timeline → weeks mapping ───────────────────────────────────────────────────
TIMELINE_WEEKS: dict[str, int | None] = {
    "1_month": 4,
    "3_months": 13,
    "6_months": 26,
    "1_year": 52,
    "no_deadline": None,
}


def compute_total_sessions(timeline_key: str, active_days_per_week: int) -> int | None:
    """
    Returns the planned total session count, or None for no_deadline.
    active_days_per_week: number of days per week the interest is scheduled (1-7).
    """
    weeks = TIMELINE_WEEKS.get(timeline_key)
    if weeks is None:
        return None
    return max(1, active_days_per_week * weeks)


def compute_arc_phase(sessions_completed: int, total_planned: int | None) -> ArcPhase:
    """Returns current arc phase based on sessions completed vs total planned."""
    if total_planned is None or total_planned == 0:
        return "no_deadline"
    pct = sessions_completed / total_planned
    if pct < ARC_PHASE_BOUNDARIES["building"][0]:
        return "foundation"
    if pct < ARC_PHASE_BOUNDARIES["applying"][0]:
        return "building"
    if pct < ARC_PHASE_BOUNDARIES["mastery"][0]:
        return "applying"
    return "mastery"


def phase_progress_pct(sessions_completed: int, total_planned: int | None) -> float:
    """Returns overall arc progress as 0.0–1.0."""
    if not total_planned:
        return 0.0
    return min(1.0, sessions_completed / total_planned)


def phase_session_number(sessions_completed: int, total_planned: int | None) -> int:
    """
    Returns the session number within the current arc phase (1-indexed).
    Example: if foundation is sessions 1–13 and user has completed 8, returns 8.
    """
    if not total_planned:
        return sessions_completed + 1
    phase = compute_arc_phase(sessions_completed, total_planned)
    if phase == "no_deadline":
        return sessions_completed + 1
    lo_pct, _ = ARC_PHASE_BOUNDARIES[phase]
    phase_start_session = int(lo_pct * total_planned)
    return max(1, sessions_completed - phase_start_session + 1)


def sessions_in_phase(phase: ArcPhase, total_planned: int) -> int:
    """Returns total sessions allocated to a given phase."""
    if phase == "no_deadline" or not total_planned:
        return 0
    lo, hi = ARC_PHASE_BOUNDARIES[phase]
    return max(1, int((hi - lo) * total_planned))


def compute_completion_rate_14d(user_id: str, interest_id: str) -> float:
    """
    Returns the 14-day interest mission completion rate (0.0–1.0).
    Used by adaptive replanning.
    """
    try:
        cutoff = str(date_cls.today() - timedelta(days=14))
        rows = (
            supabase_admin.table("missions")
            .select("completed")
            .eq("user_id", user_id)
            .eq("interest_id", interest_id)
            .gte("mission_date", cutoff)
            .execute()
            .data
            or []
        )
        if not rows:
            return 1.0  # No data — assume on track
        return sum(1 for r in rows if r.get("completed")) / len(rows)
    except Exception:
        return 1.0


async def increment_sessions_and_check_phase(
    user_id: str,
    interest_id: str,
) -> dict:
    """
    Called after an interest mission is completed.
    Increments sessions_completed, checks for phase transition and milestones.
    Returns: {
        "sessions_completed": int,
        "arc_phase": str,
        "phase_changed": bool,
        "old_phase": str,
        "milestone_hit": str | None,  -- "25pct" | "50pct" | "goal" | "7sessions" | "phase_complete" | None
    }
    Silent on error.
    """
    try:
        interest = (
            supabase_admin.table("interests")
            .select(
                "sessions_completed, total_planned_sessions, current_arc_phase, arc_phase_session, normalised_name"
            )
            .eq("id", interest_id)
            .eq("user_id", user_id)
            .single()
            .execute()
            .data
            or {}
        )
        if not interest:
            return {
                "sessions_completed": 0,
                "arc_phase": "no_deadline",
                "phase_changed": False,
                "old_phase": "no_deadline",
                "milestone_hit": None,
            }

        old_sessions = int(interest.get("sessions_completed") or 0)
        total = interest.get("total_planned_sessions")
        total_int = int(total) if total else None
        old_phase = str(interest.get("current_arc_phase") or "foundation")

        new_sessions = old_sessions + 1
        new_phase = compute_arc_phase(new_sessions, total_int)
        new_arc_session = phase_session_number(new_sessions, total_int)
        phase_changed = new_phase != old_phase

        update_payload: dict = {
            "sessions_completed": new_sessions,
            "current_arc_phase": new_phase,
            "arc_phase_session": new_arc_session,
        }

        supabase_admin.table("interests").update(update_payload).eq("id", interest_id).eq(
            "user_id", user_id
        ).execute()

        # ── Milestone detection ─────────────────────────────────────────────
        milestone_hit: str | None = None
        interest_name = str(interest.get("normalised_name") or "your interest")

        if new_sessions == 1:
            milestone_hit = "first_session"
            _log_milestone(user_id, interest_id, "first_session")

        elif new_sessions == 7:
            milestone_hit = "7sessions"
            _log_milestone(user_id, interest_id, "sessions_7")
            await send_app_mail(
                user_id,
                "interest_week_one",
                template_data={"interest_name": interest_name},
            )

        elif new_sessions in (25, 50, 100):
            key = f"sessions_{new_sessions}"
            milestone_hit = key
            _log_milestone(user_id, interest_id, key)

        if total_int:
            pct = new_sessions / total_int
            if abs(pct - 0.25) < (0.5 / total_int):
                milestone_hit = "25pct"
                _log_milestone(user_id, interest_id, "arc_25pct")
            elif abs(pct - 0.50) < (0.5 / total_int):
                milestone_hit = "50pct"
                _log_milestone(user_id, interest_id, "arc_50pct")
                await send_app_mail(
                    user_id,
                    "interest_halfway",
                    template_data={"interest_name": interest_name},
                )
            elif new_sessions >= total_int:
                milestone_hit = "goal"
                _log_milestone(user_id, interest_id, "arc_goal_reached")

        if phase_changed:
            if milestone_hit is None:
                milestone_hit = "phase_complete"
            _log_milestone(user_id, interest_id, f"arc_phase_{old_phase}_complete")
            await send_app_mail(
                user_id,
                "interest_phase_complete",
                template_data={
                    "interest_name": interest_name,
                    "old_phase": ARC_PHASE_LABELS.get(old_phase, old_phase),
                    "new_phase": ARC_PHASE_LABELS.get(new_phase, new_phase),
                },
            )

        # ── Reward and gap moment routing ──────────────────────────────────
        try:
            from app.services.gap_moment_service import queue_gap_moment

            if phase_changed:
                _award_interest_aether(
                    user_id,
                    50,
                    f"{interest_name}: {ARC_PHASE_LABELS.get(old_phase, old_phase)} phase complete",
                )
                await queue_gap_moment(user_id, "interest_milestone", f"phase_{old_phase}")

            if total_int:
                pct_new = new_sessions / total_int
                if abs(pct_new - 0.25) < (0.5 / total_int):
                    _award_interest_aether(user_id, 25, f"{interest_name}: 25% of goal")
                    await queue_gap_moment(user_id, "interest_milestone", "25pct")

                elif abs(pct_new - 0.50) < (0.5 / total_int):
                    _award_interest_aether(user_id, 50, f"{interest_name}: halfway")
                    await queue_gap_moment(user_id, "interest_milestone", "50pct")

                elif new_sessions >= total_int:
                    _award_interest_aether(user_id, 150, f"{interest_name}: goal reached")
                    _award_streak_freeze(user_id)
                    _award_streak_freeze(user_id)
                    await queue_gap_moment(user_id, "interest_milestone", "goal")

            if new_sessions in (25, 100):
                await queue_gap_moment(
                    user_id, "interest_milestone", f"sessions_{new_sessions}"
                )

        except Exception as e:
            logger.error(
                json.dumps(
                    {
                        "event": "arc_reward_error",
                        "user_id": user_id,
                        "interest_id": str(interest_id),
                        "error": str(e)[:200],
                    }
                )
            )

        return {
            "sessions_completed": new_sessions,
            "arc_phase": new_phase,
            "phase_changed": phase_changed,
            "old_phase": old_phase,
            "milestone_hit": milestone_hit,
        }

    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "arc_increment_error",
                    "user_id": user_id,
                    "interest_id": str(interest_id),
                    "error": str(e)[:200],
                }
            )
        )
        return {
            "sessions_completed": 0,
            "arc_phase": "no_deadline",
            "phase_changed": False,
            "old_phase": "no_deadline",
            "milestone_hit": None,
        }


def _log_milestone(user_id: str, interest_id: str, milestone_type: str) -> None:
    """Insert a milestone_log row. Silent on error."""
    try:
        supabase_admin.table("milestone_log").insert(
            {
                "user_id": user_id,
                "milestone_type": f"interest_{milestone_type}",
                "interest_id": str(interest_id),
                "earned_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()
    except Exception:
        pass


def _award_interest_aether(user_id: str, amount: int, reason: str) -> None:
    """
    Awards aether for interest arc milestones.
    Same pattern as challenge_service._award_challenge_aether.
    Silent on error.
    """
    today_str = date_cls.today().isoformat()
    try:
        supabase_admin.table("sigil_aether_log").insert(
            {
                "user_id": user_id,
                "log_date": today_str,
                "aether_earned": amount,
                "source": f"interest_milestone:{reason[:80]}",
            }
        ).execute()
        try:
            supabase_admin.rpc(
                "increment_sigil_aether",
                {"p_user_id": user_id, "p_amount": amount},
            ).execute()
        except Exception:
            current = (
                supabase_admin.table("sigil_state")
                .select("total_aether")
                .eq("user_id", user_id)
                .single()
                .execute()
                .data
                or {}
            )
            new_total = int(current.get("total_aether") or 0) + amount
            supabase_admin.table("sigil_state").update({"total_aether": new_total}).eq(
                "user_id", user_id
            ).execute()
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "interest_aether_award_error",
                    "user_id": user_id,
                    "amount": amount,
                    "error": str(e)[:200],
                }
            )
        )


def _award_streak_freeze(user_id: str) -> None:
    """
    Awards one streak freeze to the user.
    Increments streak_freeze_count on users table. Silent on error.
    """
    try:
        row = (
            supabase_admin.table("users")
            .select("streak_freeze_count")
            .eq("id", user_id)
            .single()
            .execute()
            .data
            or {}
        )
        current = int(row.get("streak_freeze_count") or 0)
        supabase_admin.table("users").update(
            {"streak_freeze_count": current + 1}
        ).eq("id", user_id).execute()
    except Exception as e2:
        logger.error(
            json.dumps(
                {
                    "event": "streak_freeze_award_error",
                    "user_id": user_id,
                    "error": str(e2)[:200],
                }
            )
        )


async def run_adaptive_replanning_for_user(user_id: str) -> None:
    """
    Weekly adaptive replanning check for all active interests of a user.
    Called from the recalibration scheduler job.
    Scenarios:
      A — On track (≥70%): no change
      B — Falling behind (40-70% for 2+ weeks): extend timeline proportionally
      C — Not engaged (<20% for 2+ weeks): send engagement mail with options
      D — Ahead (≥90%): maintain current pace (do not compress arc)
    """
    try:
        interests = (
            supabase_admin.table("interests")
            .select(
                "id, normalised_name, target_date, total_planned_sessions, sessions_completed, "
                "timeline_adjusted_count, arc_paused, active_days"
            )
            .eq("user_id", user_id)
            .eq("is_active", True)
            .eq("arc_paused", False)
            .execute()
            .data
            or []
        )

        for interest in interests:
            try:
                interest_id = str(interest["id"])
                total = interest.get("total_planned_sessions")
                if not total:
                    continue  # no_deadline — skip

                rate = compute_completion_rate_14d(user_id, interest_id)
                interest_name = str(interest.get("normalised_name") or "your interest")
                target_date_raw = interest.get("target_date")

                if rate >= 0.70:
                    # Scenario A — on track, nothing to do
                    continue

                elif rate < 0.20:
                    # Scenario C — not engaged
                    adj_count = int(interest.get("timeline_adjusted_count") or 0)
                    if adj_count == 0:
                        await send_app_mail(
                            user_id,
                            "interest_not_engaged",
                            template_data={"interest_name": interest_name},
                        )

                elif rate < 0.70:
                    # Scenario B — falling behind, extend timeline proportionally
                    if not target_date_raw:
                        continue
                    try:
                        target_date = date_cls.fromisoformat(str(target_date_raw))
                    except Exception:
                        continue

                    sessions_done = int(interest.get("sessions_completed") or 0)
                    sessions_remaining = max(0, int(total) - sessions_done)

                    # Compute active days per week
                    active_days = interest.get("active_days") or [1, 2, 3, 4, 5, 6, 7]
                    if not isinstance(active_days, list):
                        active_days = [1, 2, 3, 4, 5, 6, 7]
                    days_per_week = max(1, len(active_days))

                    # At current rate, how many weeks do we need?
                    effective_rate = max(0.1, rate)
                    weeks_needed = int((sessions_remaining / days_per_week) / effective_rate) + 1
                    new_target_date = date_cls.today() + timedelta(weeks=weeks_needed)

                    if new_target_date > target_date:
                        adj_count = int(interest.get("timeline_adjusted_count") or 0)
                        supabase_admin.table("interests").update(
                            {
                                "target_date": new_target_date.isoformat(),
                                "timeline_adjusted_count": adj_count + 1,
                            }
                        ).eq("id", interest_id).eq("user_id", user_id).execute()

                        await send_app_mail(
                            user_id,
                            "interest_timeline_adjusted",
                            template_data={
                                "interest_name": interest_name,
                                "new_date": new_target_date.strftime("%B %Y"),
                            },
                        )

            except Exception as e:
                logger.error(
                    json.dumps(
                        {
                            "event": "arc_replan_interest_error",
                            "user_id": user_id,
                            "interest_id": str(interest.get("id", "")),
                            "error": str(e)[:200],
                        }
                    )
                )
                continue

    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "arc_replan_user_error",
                    "user_id": user_id,
                    "error": str(e)[:200],
                }
            )
        )
