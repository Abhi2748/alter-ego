-- daily_contact_log: enable RLS (Supabase / PostgREST exposure).
-- Writes use service_role in FastAPI (bypasses RLS). Authenticated clients may only
-- read their own rows if the table is queried with the user JWT.

ALTER TABLE public.daily_contact_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_contact_log_select_own" ON public.daily_contact_log
    FOR SELECT USING (auth.uid() = user_id);
