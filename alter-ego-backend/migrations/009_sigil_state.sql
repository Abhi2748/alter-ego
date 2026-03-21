-- Sigil / Aether state (one row per user). Service role writes; users read own row via RLS.

CREATE TABLE IF NOT EXISTS public.sigil_state (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  total_aether       INTEGER NOT NULL DEFAULT 0,
  aether_today       INTEGER NOT NULL DEFAULT 0,
  surge_active       BOOLEAN NOT NULL DEFAULT FALSE,

  sigil_level        INTEGER NOT NULL DEFAULT 1
                       CHECK (sigil_level BETWEEN 1 AND 10),
  level_name         TEXT NOT NULL DEFAULT 'The Ember',

  aether_per_easy    INTEGER NOT NULL DEFAULT 10,
  aether_per_medium  INTEGER NOT NULL DEFAULT 20,
  aether_per_hard    INTEGER NOT NULL DEFAULT 40,
  aether_surge_bonus INTEGER NOT NULL DEFAULT 30,

  last_aether_date   DATE,
  last_level_up_at   TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT sigil_state_user_unique UNIQUE (user_id)
);

ALTER TABLE public.sigil_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sigil state"
  ON public.sigil_state FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to sigil_state"
  ON public.sigil_state FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_sigil_state_user ON public.sigil_state(user_id);
