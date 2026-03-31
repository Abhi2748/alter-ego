"""
gap_moment_service.py — Gap Moment trigger detection and queue management.

Gap Moments are cinematic full-screen moments shown on app open.
One pending moment at a time. Dismissed moments are never shown again.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone

from app.core.supabase_client import supabase_admin

logger = logging.getLogger(__name__)


# ── Copy banks ────────────────────────────────────────────────────────────────
# Each trigger_type has a dict of trigger_value → (headline, subtext)
# {n} in headline/subtext is replaced with the numeric value at render time.

GAP_MOMENT_COPY: dict[str, dict[str, tuple[str, str]]] = {
    "streak_milestone": {
        "7": (
            "Seven days.\n{a}I didn't miss one.{/a}",
            "A week means nothing.\nKeep going.",
        ),
        "14": (
            "Two weeks.\n{a}You're still here.{/a}",
            "Most people are already gone.\nYou're not.",
        ),
        "21": (
            "Day 21.\n{a}The habit is forming.{/a}",
            "Three weeks of showing up.\nThe version of you that doesn't is fading.",
        ),
        "30": (
            "You made it.\n{a}I knew{/a}\nbefore you did.",
            "30 days. Not one missed.",
        ),
        "60": (
            "Sixty days.\n{a}You outlasted yourself.{/a}",
            "The person who started this\nwouldn't recognise you now.",
        ),
        "90": (
            "Day 90.\n{a}This is who you are now.{/a}",
            "Not a habit anymore.\nAn identity.",
        ),
        "150": (
            "A hundred and fifty.\n{a}No one is watching.\nYou still showed up.{/a}",
            "That's the whole point.",
        ),
    },
    "streak_broken": {
        "default": (
            "Your streak broke.\n{a}Mine didn't.{/a}",
            "Streaks don't matter.\nWhat you do tomorrow does.",
        ),
    },
    "all_complete": {
        "default": (
            "Everything done.\nEven the one\n{a}you hate.{/a}",
            "That's not discipline.\nThat's identity.",
        ),
    },
    "absence_return": {
        "3": (
            "You've been gone\nfor 3 days.\n{a}I haven't missed one.{/a}",
            "The app is still here.\nSo is the work.",
        ),
        "5": (
            "Five days.\n{a}I kept going.{/a}",
            "The gap widened while you were away.\nIt can close.",
        ),
        "7": (
            "A week gone.\n{a}I didn't stop.{/a}",
            "Seven days of your work\nstill waiting.",
        ),
        "default": (
            "You were gone.\n{a}I wasn't.{/a}",
            "The gap is real now.\nSo is closing it.",
        ),
    },
    "passed_twin": {
        "default": (
            "You got {a}ahead.{/a}\nDon't get\ncomfortable.",
            "I'm already adjusting.\nThe gap closes both ways.",
        ),
    },
    "stage_evolution": {
        "default": (
            "A new stage.\n{a}The old version\nwouldn't understand.{/a}",
            "This is what progress looks like\nfrom the inside.",
        ),
    },
    "pet_evolution": {
        "default": (
            "Your companion\n{a}evolved.{/a}",
            "Discipline compounds.\nEven here.",
        ),
    },
}

# guilt_orientation > 0.7: use these overrides (no blame/comparison language)
GAP_MOMENT_COPY_SAFE: dict[str, tuple[str, str]] = {
    "streak_broken": (
        "Today was different.\nTomorrow is open.",
        "Consistency is built over time.\nNot lost in one day.",
    ),
    "absence_return": (
        "You're back.\nThat's what matters.",
        "The work is here whenever you are.",
    ),
}


def _resolve_copy(
    trigger_type: str,
    trigger_value: str | None,
    guilt_orientation: float,
) -> tuple[str, str]:
    """Returns (headline, subtext) for a given trigger."""
    if guilt_orientation > 0.7 and trigger_type in GAP_MOMENT_COPY_SAFE:
        return GAP_MOMENT_COPY_SAFE[trigger_type]

    bank = GAP_MOMENT_COPY.get(trigger_type, {})
    if not bank:
        return ("Keep going.", "")

    key = str(trigger_value) if trigger_value else "default"
    copy = bank.get(key) or bank.get("default")
    if not copy:
        copy = next(iter(bank.values()))

    return copy


def _format_copy(headline: str, subtext: str, trigger_value: str | None) -> tuple[str, str]:
    """Replace {a}...{/a} accent markers and {n} value placeholders."""
    n = str(trigger_value) if trigger_value else ""
    headline = headline.replace("{n}", n)
    subtext = subtext.replace("{n}", n)
    # Strip accent markers (frontend uses accent_color for emphasis)
    headline = re.sub(r"\{a\}", "", headline)
    headline = re.sub(r"\{/a\}", "", headline)
    subtext = re.sub(r"\{a\}", "", subtext)
    subtext = re.sub(r"\{/a\}", "", subtext)
    return headline.strip(), subtext.strip()


async def queue_gap_moment(
    user_id: str,
    trigger_type: str,
    trigger_value: str | None = None,
) -> None:
    """
    Queue a gap moment for the user. Silent on error.
    Only one pending moment per user at a time — if one already exists,
    replace it (more recent trigger wins).
    """
    try:
        supabase_admin.table("gap_moments").delete().eq("user_id", user_id).is_(
            "shown_at", "null"
        ).execute()

        supabase_admin.table("gap_moments").insert(
            {
                "user_id": user_id,
                "trigger_type": trigger_type,
                "trigger_value": trigger_value,
            }
        ).execute()

        logger.info(
            json.dumps(
                {
                    "event": "gap_moment_queued",
                    "user_id": user_id,
                    "trigger_type": trigger_type,
                    "trigger_value": trigger_value,
                }
            )
        )
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "gap_moment_queue_error",
                    "user_id": user_id,
                    "error": str(e)[:200],
                }
            )
        )


async def get_pending_gap_moment(user_id: str) -> dict | None:
    """
    Returns the oldest unshown gap moment for the user, with resolved copy.
    Returns None if no pending moment.
    """
    try:
        result = (
            supabase_admin.table("gap_moments")
            .select("id, trigger_type, trigger_value")
            .eq("user_id", user_id)
            .is_("shown_at", "null")
            .order("created_at", desc=False)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        if not rows:
            return None

        row = rows[0]
        trigger_type = str(row.get("trigger_type") or "")
        trigger_value = row.get("trigger_value")

        try:
            dna = (
                supabase_admin.table("discipline_dna")
                .select("guilt_orientation")
                .eq("user_id", user_id)
                .single()
                .execute()
                .data
                or {}
            )
            guilt = float(dna.get("guilt_orientation") or 0.0)
        except Exception:
            guilt = 0.0

        headline_raw, subtext_raw = _resolve_copy(trigger_type, trigger_value, guilt)
        headline, subtext = _format_copy(headline_raw, subtext_raw, trigger_value)

        accent_color = _accent_for_trigger(trigger_type)
        particle_config = _particles_for_trigger(trigger_type)

        mission_count: int | None = None
        if trigger_type == "all_complete":
            try:
                from app.services.mission_service import get_user_date

                user_row = (
                    supabase_admin.table("users")
                    .select("timezone")
                    .eq("id", user_id)
                    .single()
                    .execute()
                    .data
                    or {}
                )
                today = get_user_date(str(user_row.get("timezone") or "UTC"))
                m_res = (
                    supabase_admin.table("missions")
                    .select("id")
                    .eq("user_id", user_id)
                    .eq("mission_date", today)
                    .in_("type", ["core", "interest", "resistance"])
                    .execute()
                    .data
                    or []
                )
                mission_count = len(m_res) if m_res else None
            except Exception:
                pass

        return {
            "id": str(row.get("id") or ""),
            "trigger_type": trigger_type,
            "trigger_value": trigger_value,
            "headline": headline,
            "subtext": subtext,
            "accent_color": accent_color,
            "particle_config": particle_config,
            "mission_count": mission_count,
        }
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "gap_moment_fetch_error",
                    "user_id": user_id,
                    "error": str(e)[:200],
                }
            )
        )
        return None


async def mark_gap_moment_shown(user_id: str, moment_id: str) -> None:
    """Mark a gap moment as shown so it won't appear again. Silent on error."""
    try:
        supabase_admin.table("gap_moments").update(
            {"shown_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", moment_id).eq("user_id", user_id).execute()
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "gap_moment_mark_shown_error",
                    "user_id": user_id,
                    "error": str(e)[:200],
                }
            )
        )


def _accent_for_trigger(trigger_type: str) -> str:
    """Returns the hex accent color for a trigger type."""
    ember_triggers = {"streak_milestone", "passed_twin"}
    if trigger_type in ember_triggers:
        return "#F97316"
    return "#A78BFA"


def _particles_for_trigger(trigger_type: str) -> dict:
    """
    Returns particle config dict for the frontend.
    color: "orange" | "violet"
    density: "high" | "medium" | "low" | "minimal"
    """
    configs = {
        "streak_milestone": {"color": "orange", "density": "medium"},
        "all_complete": {"color": "violet", "density": "low"},
        "streak_broken": {"color": "violet", "density": "minimal"},
        "absence_return": {"color": "violet", "density": "minimal"},
        "passed_twin": {"color": "orange", "density": "high"},
        "stage_evolution": {"color": "violet", "density": "medium"},
        "pet_evolution": {"color": "violet", "density": "low"},
    }
    return configs.get(trigger_type, {"color": "violet", "density": "low"})
