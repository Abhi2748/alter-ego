"""
challenge_service.py — Twin Challenge generation and progress tracking.

One challenge per week per user. Generated Sunday midnight.
Progress computed on-demand from existing mission/XP/journal tables.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone

from app.core.supabase_client import supabase_admin, run_query
from app.services.mission_service import get_user_date

logger = logging.getLogger(__name__)


async def _award_challenge_aether(user_id: str, amount: int, challenge_id: str) -> None:
    """
    Directly awards aether for a completed Twin Challenge.
    Writes to sigil_aether_log and updates sigil_state.total_aether.
    Does NOT trigger surge detection or sigil level-up — challenge rewards
    are a bonus separate from the mission-completion aether economy.
    Silent on any error — never blocks challenge completion flow.
    """
    from datetime import date as date_cls

    today_str = date_cls.today().isoformat()
    try:
        await run_query(supabase_admin.table("sigil_aether_log").insert(
            {
                "user_id": user_id,
                "log_date": today_str,
                "aether_earned": amount,
                "source": "twin_challenge",
                "mission_id": str(challenge_id),
            }
        ))

        try:
            current = (
                ((await run_query(supabase_admin.table("sigil_state")
                .select("total_aether")
                .eq("user_id", user_id)
                .single())).data)
                or {}
            )
            new_total = int(current.get("total_aether") or 0) + amount
            await run_query(supabase_admin.table("sigil_state").update({"total_aether": new_total}).eq(
                "user_id", user_id
            ))
        except Exception:
            pass

    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "challenge_aether_award_error",
                    "user_id": user_id,
                    "challenge_id": str(challenge_id),
                    "error": str(e)[:200],
                }
            )
        )

# ── Challenge templates ────────────────────────────────────────────────────────
# Each template: (challenge_type, text_template, target_value, xp_reward)
# Variables in text: {n} = target_value, {interest} = user's top interest name

CHALLENGE_TEMPLATES = {
    "streak": [
        ("streak", "Complete at least 4 core missions every day for {n} consecutive days.", 5, 75),
        ("streak", "Don't miss a single core mission for {n} days straight.", 7, 100),
        ("streak", "Hit your daily mission minimum for {n} days without a break.", 5, 75),
    ],
    "pillar": [
        ("pillar", "Complete the Movement mission every day for {n} days.", 7, 60),
        ("pillar", "Don't skip your Sleep mission for {n} days.", 7, 60),
        ("pillar", "Complete Mindfulness every day this week — all {n} days.", 7, 60),
    ],
    "volume": [
        ("volume", "Earn {n} XP this week.", 300, 50),
        ("volume", "Earn {n} XP across any missions before the week ends.", 400, 75),
        ("volume", "Hit {n} total XP this week — any mission type counts.", 250, 50),
    ],
    "journal": [
        ("journal", "Write a journal entry every day for {n} days.", 5, 60),
        ("journal", "Complete your journal mission {n} days this week.", 7, 75),
    ],
    "interest": [
        ("interest", "Practice your interest {n} days this week.", 4, 60),
        ("interest", "Complete an interest mission on {n} different days.", 5, 75),
    ],
}

ALL_TYPES = list(CHALLENGE_TEMPLATES.keys())


def _pick_challenge_template(
    user_id: str,
    week_start: str,
    recent_completion_rate: float,
    has_interests: bool,
    has_journal: bool,
) -> tuple[str, str, int, int]:
    """
    Pick a challenge type and template appropriate for the user's recent performance.
    Deterministic per user+week (hash-based index) so the same challenge isn't
    regenerated on repeated calls.
    Returns (challenge_type, challenge_text, target_value, xp_reward).
    """
    available_types = list(ALL_TYPES)
    if not has_interests:
        available_types = [t for t in available_types if t != "interest"]
    if not has_journal:
        available_types = [t for t in available_types if t != "journal"]
    if not available_types:
        available_types = ["volume"]

    # Deterministic type selection: hash of user_id + week_start
    idx = int(abs(hash(f"{user_id}:{week_start}"))) % len(available_types)
    chosen_type = available_types[idx]

    templates = CHALLENGE_TEMPLATES[chosen_type]
    t_idx = int(abs(hash(f"{user_id}:{week_start}:t"))) % len(templates)
    ctype, text_tpl, target, xp = templates[t_idx]

    # Scale target based on recent performance
    # Low performers get easier targets; high performers get harder ones
    if recent_completion_rate < 0.4 and target > 4:
        target = max(3, target - 2)
        xp = max(40, xp - 15)
    elif recent_completion_rate > 0.8 and target < 7:
        target = min(7, target + 1)
        xp = min(100, xp + 15)

    challenge_text = text_tpl.format(n=target)
    return ctype, challenge_text, target, xp


async def get_active_challenge(user_id: str) -> dict | None:
    """
    Returns the user's current active challenge (pending or accepted), or None.
    Computes current_value on-demand from mission/XP/journal data.
    """
    try:
        result = (
            await run_query(supabase_admin.table("twin_challenges")
            .select("*")
            .eq("user_id", user_id)
            .in_("status", ["pending", "accepted"])
            .order("issued_at", desc=True)
            .limit(1))
        )
        rows = result.data or []
        if not rows:
            return None

        challenge = rows[0]

        # Check expiry
        expires_raw = challenge.get("expires_at")
        if expires_raw:
            try:
                expires_dt = datetime.fromisoformat(str(expires_raw).replace("Z", "+00:00"))
                if datetime.now(timezone.utc) > expires_dt:
                    # Mark as failed if accepted, else just expired
                    new_status = "failed" if challenge.get("status") == "accepted" else "declined"
                    await run_query(supabase_admin.table("twin_challenges").update(
                        {"status": new_status}
                    ).eq("id", challenge["id"]))
                    return None
            except Exception:
                pass

        # Compute current progress if accepted
        if challenge.get("status") == "accepted":
            current_value = await _compute_progress(user_id, challenge)
            # Check if completed
            if current_value >= int(challenge.get("target_value") or 1):
                await run_query(supabase_admin.table("twin_challenges").update(
                    {
                        "status": "completed",
                        "current_value": current_value,
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                    }
                ).eq("id", challenge["id"]))
                challenge["status"] = "completed"
                challenge["current_value"] = current_value

                aether_amount = int(challenge.get("xp_reward") or 50)
                asyncio.create_task(
                    _award_challenge_aether(user_id, aether_amount, str(challenge["id"]))
                )

                return challenge
            # Update current_value in DB (best-effort)
            try:
                await run_query(supabase_admin.table("twin_challenges").update(
                    {"current_value": current_value}
                ).eq("id", challenge["id"]))
            except Exception:
                pass
            challenge["current_value"] = current_value

        return challenge
    except Exception as e:
        logger.error(json.dumps({
            "event": "get_active_challenge_error",
            "user_id": user_id,
            "error": str(e)[:200],
        }))
        return None


async def _compute_progress(user_id: str, challenge: dict) -> int:
    """Compute current progress value for an accepted challenge."""
    try:
        ctype = str(challenge.get("challenge_type") or "volume")
        accepted_raw = challenge.get("accepted_at") or challenge.get("issued_at")
        expires_raw = challenge.get("expires_at")

        if not accepted_raw or not expires_raw:
            return int(challenge.get("current_value") or 0)

        accepted_dt = datetime.fromisoformat(str(accepted_raw).replace("Z", "+00:00"))
        expires_dt = datetime.fromisoformat(str(expires_raw).replace("Z", "+00:00"))
        start_date = accepted_dt.date().isoformat()
        end_date = min(expires_dt.date(), datetime.now(timezone.utc).date()).isoformat()

        if ctype == "volume":
            # Sum XP earned since accepted_at
            rows = (
                ((await run_query(supabase_admin.table("xp_log")
                .select("amount")
                .eq("user_id", user_id)
                .gte("log_date", start_date)
                .lte("log_date", end_date))).data) or []
            )
            return sum(int(r.get("amount") or 0) for r in rows)

        elif ctype in ("streak", "pillar", "journal", "interest"):
            # Count distinct days with qualifying completions
            if ctype == "journal":
                rows = (
                    ((await run_query(supabase_admin.table("journal_entries")
                    .select("mission_date")
                    .eq("user_id", user_id)
                    .gte("mission_date", start_date)
                    .lte("mission_date", end_date))).data) or []
                )
                return len({str(r.get("mission_date") or "")[:10] for r in rows if r.get("mission_date")})

            elif ctype == "interest":
                rows = (
                    ((await run_query(supabase_admin.table("missions")
                    .select("mission_date")
                    .eq("user_id", user_id)
                    .eq("type", "interest")
                    .eq("completed", True)
                    .gte("mission_date", start_date)
                    .lte("mission_date", end_date))).data) or []
                )
                return len({str(r.get("mission_date") or "")[:10] for r in rows if r.get("mission_date")})

            elif ctype == "pillar":
                # Extract target pillar from challenge text (simple keyword match)
                text_lower = str(challenge.get("challenge_text") or "").lower()
                pillar_map = {
                    "movement": "movement", "sleep": "sleep",
                    "mindfulness": "mindfulness", "hydration": "hydration",
                    "no phone": "no_phone", "focus": "no_phone",
                }
                target_pillar = "movement"
                for keyword, pillar in pillar_map.items():
                    if keyword in text_lower:
                        target_pillar = pillar
                        break
                rows = (
                    ((await run_query(supabase_admin.table("missions")
                    .select("mission_date")
                    .eq("user_id", user_id)
                    .eq("type", "core")
                    .eq("core_pillar", target_pillar)
                    .eq("completed", True)
                    .gte("mission_date", start_date)
                    .lte("mission_date", end_date))).data) or []
                )
                return len({str(r.get("mission_date") or "")[:10] for r in rows if r.get("mission_date")})

            else:  # streak: count days with ≥4 core missions completed
                rows = (
                    ((await run_query(supabase_admin.table("missions")
                    .select("mission_date, completed")
                    .eq("user_id", user_id)
                    .eq("type", "core")
                    .gte("mission_date", start_date)
                    .lte("mission_date", end_date))).data) or []
                )
                by_date: dict[str, int] = {}
                for r in rows:
                    if r.get("completed"):
                        d = str(r.get("mission_date") or "")[:10]
                        if d:
                            by_date[d] = by_date.get(d, 0) + 1
                return sum(1 for count in by_date.values() if count >= 4)

    except Exception as e:
        logger.error(json.dumps({
            "event": "challenge_progress_error",
            "user_id": user_id,
            "error": str(e)[:200],
        }))
        return int(challenge.get("current_value") or 0)


async def generate_weekly_challenge(user_id: str) -> dict | None:
    """
    Generate a new weekly challenge for the user.
    Called Sunday midnight. Skips if an active challenge already exists.
    Returns the created challenge dict or None.
    """
    try:
        # Skip if active challenge already exists
        existing = (
            await run_query(supabase_admin.table("twin_challenges")
            .select("id")
            .eq("user_id", user_id)
            .in_("status", ["pending", "accepted"])
            .limit(1))
        )
        if existing.data:
            return None

        # Get user timezone for expires_at calculation
        user_row = (
            ((await run_query(supabase_admin.table("users")
            .select("timezone")
            .eq("id", user_id)
            .single())).data) or {}
        )
        tz_str = str(user_row.get("timezone") or "UTC").strip() or "UTC"
        today = get_user_date(tz_str)

        # Week start for deterministic selection
        from datetime import date as date_cls
        anchor = date_cls.fromisoformat(today)
        # Next Sunday = 7 days from now
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        week_start = today

        # Fetch recent 14-day completion rate
        two_weeks_ago = str(anchor - timedelta(days=14))
        mission_rows = (
            ((await run_query(supabase_admin.table("missions")
            .select("completed")
            .eq("user_id", user_id)
            .gte("mission_date", two_weeks_ago)
            .lte("mission_date", today))).data) or []
        )
        total = len(mission_rows)
        done = sum(1 for m in mission_rows if m.get("completed"))
        recent_rate = (done / total) if total > 0 else 0.5

        # Check if user has interests
        interest_rows = (
            await run_query(supabase_admin.table("interests")
            .select("id")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .limit(1))
        )
        has_interests = bool(interest_rows.data)

        # Check if user uses journal
        journal_rows = (
            await run_query(supabase_admin.table("journal_entries")
            .select("id")
            .eq("user_id", user_id)
            .gte("mission_date", two_weeks_ago)
            .limit(1))
        )
        has_journal = bool(journal_rows.data)

        ctype, text, target, xp = _pick_challenge_template(
            user_id, week_start, recent_rate, has_interests, has_journal
        )

        row = {
            "user_id": user_id,
            "challenge_type": ctype,
            "challenge_text": text,
            "target_value": target,
            "current_value": 0,
            "status": "pending",
            "expires_at": expires_at.isoformat(),
            "xp_reward": xp,
            "twin_journal_acknowledged": False,
        }

        result = await run_query(supabase_admin.table("twin_challenges").insert(row))
        if result.data:
            logger.info(json.dumps({
                "event": "twin_challenge_generated",
                "user_id": user_id,
                "type": ctype,
            }))
            return result.data[0]
        return None

    except Exception as e:
        logger.error(json.dumps({
            "event": "generate_weekly_challenge_error",
            "user_id": user_id,
            "error": str(e)[:200],
        }))
        return None


async def accept_challenge(user_id: str, challenge_id: str) -> bool:
    """Accept a pending challenge. Returns True on success."""
    try:
        result = (
            await run_query(supabase_admin.table("twin_challenges")
            .update({
                "status": "accepted",
                "accepted_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("id", challenge_id)
            .eq("user_id", user_id)
            .eq("status", "pending"))
        )
        return bool(result.data)
    except Exception as e:
        logger.error(json.dumps({
            "event": "accept_challenge_error",
            "user_id": user_id,
            "error": str(e)[:200],
        }))
        return False


async def decline_challenge(user_id: str, challenge_id: str) -> bool:
    """Decline a pending challenge. Returns True on success."""
    try:
        result = (
            await run_query(supabase_admin.table("twin_challenges")
            .update({"status": "declined"})
            .eq("id", challenge_id)
            .eq("user_id", user_id)
            .eq("status", "pending"))
        )
        return bool(result.data)
    except Exception as e:
        logger.error(json.dumps({
            "event": "decline_challenge_error",
            "user_id": user_id,
            "error": str(e)[:200],
        }))
        return False
