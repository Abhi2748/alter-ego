"""
Supabase client for the backend.
Uses service_role key — bypasses RLS.
NEVER expose this to the frontend.
"""
import os
import asyncio as _asyncio
import logging

from dotenv import load_dotenv
import httpx
from supabase import Client, ClientOptions, create_client

load_dotenv()

SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY: str = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SUPABASE_ANON_KEY: str = os.environ["SUPABASE_ANON_KEY"]

# Service role client — for backend operations that need to bypass RLS
# (cron jobs, mission generation, twin simulation, etc.)
_client_options = ClientOptions(
    postgrest_client_timeout=20,
    storage_client_timeout=20,
)

supabase_admin: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    options=_client_options,
)

# Anon client — for operations that should respect RLS
supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    options=_client_options,
)

logger = logging.getLogger(__name__)


async def run_query(query_chain, timeout: float = 20.0):
    """
    Execute sync Supabase queries off the event loop.
    Retries a few transient network/protocol failures to reduce one-off 500s.
    """
    delays_sec = (0.15, 0.4, 0.9)
    transient_errors = (
        httpx.RemoteProtocolError,
        httpx.ConnectError,
        httpx.ReadTimeout,
        httpx.WriteError,
        httpx.TimeoutException,
        httpx.NetworkError,
        _asyncio.TimeoutError,
    )
    attempts = len(delays_sec) + 1
    for attempt in range(1, attempts + 1):
        try:
            return await _asyncio.wait_for(
                _asyncio.to_thread(lambda: query_chain.execute()),
                timeout=timeout,
            )
        except transient_errors as exc:
            if attempt >= attempts:
                raise
            logger.warning(
                "run_query transient error (attempt %s/%s): %s",
                attempt,
                attempts,
                exc,
            )
            await _asyncio.sleep(delays_sec[attempt - 1])

