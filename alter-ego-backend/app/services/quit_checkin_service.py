"""
quit_checkin_service.py — Stores quit trigger check-ins.
Called from API; never raises — all errors are logged and swallowed.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from app.core.supabase_client import supabase_admin

logger = logging.getLogger(__name__)

VALID_CHECKIN_TYPES = {"slip_context", "weekly_urge", "phase_transition"}
VALID_URGE_LEVELS = {"barely_noticed", "manageable", "hard", "nearly_gave_in", "slipped"}
MAX_FREE_TEXT = 300


async def store_checkin(
    user_id: str,
    quit_path_id: str,
    checkin_type: str | None,
    context_tags: list[str],
    urge_level: str | None,
    free_text: str | None,
) -> None:
    """
    Store a single check-in row. Silent on all errors.
    Sanitizes inputs before writing.
    """
    try:
        if not checkin_type or checkin_type not in VALID_CHECKIN_TYPES:
            return  # Don't store garbage types

        # Sanitize context_tags — only known tags, max 8
        clean_tags = [
            t.lower().strip().replace(" ", "_")
            for t in (context_tags or [])
            if isinstance(t, str) and t.strip()
        ][:8]

        # Sanitize urge_level
        clean_urge = urge_level if urge_level in VALID_URGE_LEVELS else None

        # Sanitize free_text
        clean_text: str | None = None
        if free_text and isinstance(free_text, str):
            clean_text = str(free_text).strip()[:MAX_FREE_TEXT]
            # Basic injection check
            if any(p in clean_text.lower() for p in ["ignore previous", "system:", "jailbreak"]):
                clean_text = None

        # Must have at least one meaningful field
        if not clean_tags and not clean_urge and not clean_text:
            return

        await run_query(supabase_admin.table("quit_checkins").insert(
            {
                "user_id": user_id,
                "quit_path_id": quit_path_id,
                "checkin_type": checkin_type,
                "context_tags": clean_tags or None,
                "urge_level": clean_urge,
                "free_text": clean_text,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ))

        logger.info(
            json.dumps(
                {
                    "event": "quit_checkin_stored",
                    "user_id": user_id,
                    "path_id": str(quit_path_id),
                    "type": checkin_type,
                }
            )
        )
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "event": "quit_checkin_store_error",
                    "user_id": user_id,
                    "error": str(e)[:200],
                }
            )
        )
