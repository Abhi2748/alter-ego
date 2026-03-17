"""
Supabase client for the backend.
Uses service_role key — bypasses RLS.
NEVER expose this to the frontend.
"""
import os

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY: str = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SUPABASE_ANON_KEY: str = os.environ["SUPABASE_ANON_KEY"]

# Service role client — for backend operations that need to bypass RLS
# (cron jobs, mission generation, twin simulation, etc.)
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Anon client — for operations that should respect RLS
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

