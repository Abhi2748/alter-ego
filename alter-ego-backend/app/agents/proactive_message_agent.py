"""
Proactive Message Generator — Twin sends unsolicited messages.
Runs via scheduler. Max 3 per user per week.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from pydantic import BaseModel, Field

from app.agents import twin_chat_prompts_v2 as twin_prompts
from app.agents.base import run_agent
from app.core.supabase_client import supabase_admin
from app.services.mission_service import get_days_since_registration, get_user_date
from app.services.twin_tone_mix import pick_mixed_tone_for_message

logger = logging.getLogger(__name__)


async def should_send_proactive(user_id: str) -> bool:
    """Check if user has received < 3 proactive messages this week (UTC week, Mon start)."""
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    ws = week_start.isoformat()

    result = (
        supabase_admin.table("proactive_message_log")
        .select("messages_sent")
        .eq("user_id", user_id)
        .eq("week_start", ws)
        .limit(1)
        .execute()
    )

    if not result.data:
        return True
    return int(result.data[0].get("messages_sent", 0)) < 3


async def record_proactive_sent(user_id: str) -> None:
    """Increment the weekly proactive message counter."""
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    ws = week_start.isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()

    existing = (
        supabase_admin.table("proactive_message_log")
        .select("id, messages_sent")
        .eq("user_id", user_id)
        .eq("week_start", ws)
        .limit(1)
        .execute()
    )

    if existing.data:
        row = existing.data[0]
        supabase_admin.table("proactive_message_log").update(
            {
                "messages_sent": int(row.get("messages_sent", 0)) + 1,
                "last_sent_at": now_iso,
            }
        ).eq("id", row["id"]).execute()
    else:
        supabase_admin.table("proactive_message_log").insert(
            {
                "user_id": user_id,
                "week_start": ws,
                "messages_sent": 1,
                "last_sent_at": now_iso,
            }
        ).execute()


class ProactiveOutput(BaseModel):
    message: str = Field(..., max_length=200)


async def generate_and_store_proactive_message(
    user_id: str,
    trigger_reason: str,
    narrative_seed: str,
    twin_tone_type: str,
    twin_relationship_style: str,
    twin_intensity: int,
    gap_state: str,
    gap_percentage: str,
    user_streak: int,
    twin_streak: int,
    user_missions_today: str,
    last_active: str,
    day_number: int,
    recent_context: str,
    guilt_orientation: float,
    last_proactive_messages: str,
) -> Optional[str]:
    """
    Generate a proactive message and store it in twin_messages.
    Returns the message text or None on failure.
    """
    if not await should_send_proactive(user_id):
        logger.info("Proactive limit reached for user %s", user_id)
        return None

    prompt = (
        str(twin_prompts.PROACTIVE_MESSAGE_PROMPT)
        .replace("{narrative_seed}", narrative_seed)
        .replace("{twin_tone_type}", twin_tone_type)
        .replace("{twin_relationship_style}", twin_relationship_style)
        .replace("{twin_intensity}", str(twin_intensity))
        .replace("{trigger_reason}", trigger_reason)
        .replace("{gap_state}", gap_state)
        .replace("{gap_percentage}", gap_percentage)
        .replace("{user_streak}", str(user_streak))
        .replace("{twin_streak}", str(twin_streak))
        .replace("{user_missions_today}", user_missions_today)
        .replace("{last_active}", last_active)
        .replace("{day_number}", str(day_number))
        .replace("{recent_context}", recent_context)
        .replace("{last_proactive_messages}", last_proactive_messages or "(none yet)")
    )
    prompt += f"\n\n## GUILT ORIENTATION\nScore: {guilt_orientation:.2f}. If > 0.7, do not guilt-trip.\n"

    try:
        result = await run_agent(
            system_prompt=prompt,
            user_message=f"Generate a proactive message. Trigger: {trigger_reason}",
            response_model=ProactiveOutput,
            temperature=0.9,
            max_tokens=100,
            context_label="proactive_message",
        )

        message_text = result.message.strip()
        if not message_text:
            return None

        supabase_admin.table("twin_messages").insert(
            {
                "user_id": user_id,
                "role": "twin",
                "content": message_text,
                "is_proactive": True,
                "is_read": False,
                "trigger_reason": trigger_reason,
                "tone_used": tone_used,
            }
        ).execute()

        await record_proactive_sent(user_id)
        logger.info("Proactive message sent to %s: %s", user_id, trigger_reason)
        return message_text

    except Exception as e:
        logger.warning("Proactive message failed for %s: %s", user_id, e)
        return None


async def fetch_proactive_last_messages(user_id: str) -> str:
    rows = (
        supabase_admin.table("twin_messages")
        .select("content")
        .eq("user_id", user_id)
        .eq("is_proactive", True)
        .order("created_at", desc=True)
        .limit(3)
        .execute()
        .data
        or []
    )
    if not rows:
        return "(none yet)"
    return "\n".join(f"- {str(r.get('content', ''))[:120]}" for r in reversed(rows))


async def build_proactive_context_and_send(user_id: str, trigger_reason: str) -> Optional[str]:
    """Load user/twin/dna state and send one proactive line (scheduler entry)."""
    user_res = (
        supabase_admin.table("users")
        .select(
            "username, archetype, registration_date, timezone, total_xp, "
            "current_streak, character_stage, last_active_date"
        )
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    user = (user_res.data or [None])[0]
    if not user:
        return None

    tz = user.get("timezone", "UTC") or "UTC"
    today = get_user_date(tz)
    reg_day_n = get_days_since_registration(user.get("registration_date", ""), tz)
    days_active = max(0, int(reg_day_n) - 1)

    twin_result = supabase_admin.table("twin_state").select("*").eq("user_id", user_id).execute()
    twin = twin_result.data[0] if twin_result.data else {}

    dna_result = supabase_admin.table("discipline_dna").select("*").eq("user_id", user_id).execute()
    dna = dna_result.data[0] if dna_result.data else {}

    narrative_seed = (dna.get("narrative_seed") or "").strip() or (
        f"User archetype: {user.get('archetype') or 'unknown'}."
    )
    twin_tone = str(dna.get("twin_tone_type") or "rival")
    rel_style = str(dna.get("twin_relationship_style") or "mentor_rival")
    intensity = int(dna.get("twin_intensity") or 3)
    guilt_orientation = float(dna.get("guilt_orientation") or 0.5)

    gap_state = str(twin.get("current_gap_state") or "neck_and_neck")
    from app.agents.twin_response_generator import format_gap_percentage_label

    gap_pct = format_gap_percentage_label(
        gap_state,
        int(twin.get("twin_xp") or 0),
        int(user.get("total_xp") or 0),
    )

    missions = (
        supabase_admin.table("missions")
        .select("title, completed")
        .eq("user_id", user_id)
        .eq("mission_date", today)
        .execute()
        .data
        or []
    )
    done = sum(1 for m in missions if m.get("completed"))
    total = len(missions)
    user_missions_today = f"{done}/{total} missions completed today" if total else "no missions today"

    last_active = str(user.get("last_active_date") or "unknown")

    strip = str(twin.get("strip_message") or "").strip()
    recent_context = strip[:400] if strip else user_missions_today

    last_proactive = await fetch_proactive_last_messages(user_id)

    return await generate_and_store_proactive_message(
        user_id=user_id,
        trigger_reason=trigger_reason,
        narrative_seed=narrative_seed,
        twin_tone_type=twin_tone,
        twin_relationship_style=rel_style,
        twin_intensity=intensity,
        gap_state=gap_state,
        gap_percentage=gap_pct,
        user_streak=int(user.get("current_streak") or 0),
        twin_streak=int(twin.get("twin_streak") or 0),
        user_missions_today=user_missions_today,
        last_active=last_active,
        day_number=days_active,
        recent_context=recent_context,
        guilt_orientation=guilt_orientation,
        last_proactive_messages=last_proactive,
    )
