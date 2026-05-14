-- Beta signups from the marketing site (website/index.html → Supabase REST).
-- Run in Supabase: SQL Editor → paste → Run.
-- No DROP / TRUNCATE — safe for Supabase’s “destructive change” checker.

CREATE TABLE IF NOT EXISTS public.beta_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  signed_up_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_signups_signed_up_at
  ON public.beta_signups (signed_up_at DESC);

ALTER TABLE public.beta_signups ENABLE ROW LEVEL SECURITY;

-- Allow inserts from the browser using the anon (public) API key
GRANT INSERT ON TABLE public.beta_signups TO anon;
GRANT INSERT ON TABLE public.beta_signups TO authenticated;

-- Create policy only if it doesn’t exist (avoids DROP POLICY, which Supabase flags as destructive)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'beta_signups'
      AND policyname = 'beta_signups_allow_insert_anon'
  ) THEN
    CREATE POLICY beta_signups_allow_insert_anon
      ON public.beta_signups
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;
END
$$;
