-- Twin's daily journal: one AI-generated entry per user per calendar day (service role writes).

CREATE TABLE IF NOT EXISTS public.twin_journal (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  entry_date           DATE NOT NULL,
  content              TEXT NOT NULL,
  relationship_phase   TEXT NOT NULL DEFAULT 'observer',
  missions_completed   INTEGER NOT NULL DEFAULT 0,
  missions_total       INTEGER NOT NULL DEFAULT 0,
  archetype            TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT twin_journal_unique_day UNIQUE (user_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_twin_journal_user_date
  ON public.twin_journal(user_id, entry_date DESC);

ALTER TABLE public.twin_journal ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'twin_journal' AND policyname = 'Users read own twin journal'
  ) THEN
    CREATE POLICY "Users read own twin journal"
      ON public.twin_journal FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'twin_journal' AND policyname = 'Service role full access twin_journal'
  ) THEN
    CREATE POLICY "Service role full access twin_journal"
      ON public.twin_journal FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;
