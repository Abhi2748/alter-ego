"""
Memory Anchor Classifier — tags important conversation moments.
Runs ASYNCHRONOUSLY after each chat exchange (non-blocking).
"""

from __future__ import annotations

import logging
from typing import Optional

from pydantic import BaseModel, Field

from app.agents import twin_chat_prompts_v2 as twin_prompts
from app.agents.base import run_agent
from app.core.supabase_client import supabase_admin

logger = logging.getLogger(__name__)


class MemoryAnchor(BaseModel):
    is_anchor: bool = False
    anchor_type: Optional[str] = None
    summary: Optional[str] = None
    emotional_weight: Optional[str] = None
    reference_phrase: Optional[str] = None


async def classify_and_store_anchor(
    user_id: str,
    user_message: str,
    twin_response: str,
    source_message_id: str | None = None,
) -> None:
    """
    Check if this exchange contains a memory anchor. If yes, store it.
    This runs in the background — never blocks the chat response.
    """
    try:
        prompt = (
            str(twin_prompts.MEMORY_ANCHOR_PROMPT)
            .replace("{user_message}", user_message)
            .replace("{twin_response}", twin_response)
        )

        result = await run_agent(
            system_prompt=prompt,
            user_message=f"Classify: {user_message}",
            response_model=MemoryAnchor,
            temperature=0.1,
            max_tokens=200,
            context_label="memory_anchor_classifier",
        )

        if result.is_anchor and result.summary:
            supabase_admin.table("memory_anchors").insert(
                {
                    "user_id": user_id,
                    "anchor_type": result.anchor_type or "personal_revelation",
                    "summary": result.summary,
                    "emotional_weight": result.emotional_weight or "medium",
                    "reference_phrase": result.reference_phrase,
                    "source_message_id": source_message_id,
                }
            ).execute()

            logger.info(
                "Memory anchor stored for user %s: %s",
                user_id,
                result.anchor_type,
            )

    except Exception as e:
        logger.warning("Memory anchor classification failed: %s", e)
