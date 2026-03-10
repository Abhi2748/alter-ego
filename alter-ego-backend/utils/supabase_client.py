"""Supabase client (service role) for server-side use. Never expose service key to client."""
import os
from supabase import create_client, Client

_url = os.getenv("SUPABASE_URL")
_key = os.getenv("SUPABASE_SERVICE_KEY")

def get_supabase() -> Client:
    if not _url or not _key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return create_client(_url, _key)
