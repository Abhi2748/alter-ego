"""
Shared OpenAI + instructor helpers for structured agent outputs.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import TypeVar

import instructor
from openai import OpenAI
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Default model for structured agents (override via OPENAI_AGENT_MODEL if needed).
MODEL = os.environ.get("OPENAI_AGENT_MODEL", "gpt-4o-mini")

T = TypeVar("T", bound=BaseModel)


def get_instructor_client():
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    return instructor.from_openai(OpenAI(api_key=api_key))


async def run_agent(
    *,
    system_prompt: str,
    user_message: str,
    response_model: type[T],
    temperature: float = 0.5,
    max_tokens: int = 1200,
    context_label: str = "agent",
    model: str | None = None,
) -> T:
    """
    Run a single-turn structured completion. Uses a thread pool because the
    OpenAI + instructor client is synchronous.
    """

    model_name = model or MODEL

    def _call() -> T:
        client = get_instructor_client()
        return client.chat.completions.create(
            model=model_name,
            temperature=temperature,
            max_tokens=max_tokens,
            response_model=response_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )

    try:
        return await asyncio.to_thread(_call)
    except Exception:
        logger.exception("run_agent failed context=%s", context_label)
        raise
