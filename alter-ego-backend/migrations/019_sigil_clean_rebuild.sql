-- Sigil / Aether clean schema (run in Supabase SQL editor).
-- Replaces older 009–012 sigil objects if present.

DROP TRIGGER IF EXISTS on_user_created_add_sigil_state ON public.users;
DROP FUNCTION IF EXISTS public.create_sigil_state_for_user() CASCADE;

DROP TABLE IF EXISTS public.sigil_aether_log CASCADE;
DROP TABLE IF EXISTS public.sigil_state CASCADE;

CREATE TABLE public.sigil_state (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  total_aether      INTEGER NOT NULL DEFAULT 0,
  aether_today      INTEGER NOT NULL DEFAULT 0,
  surge_active      BOOLEAN NOT NULL DEFAULT FALSE,
  sigil_level       INTEGER NOT NULL DEFAULT 1 CHECK (sigil_level BETWEEN 1 AND 10),
  level_name        TEXT NOT NULL DEFAULT 'The Ember',
  last_aether_date  DATE,
  last_level_up_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sigil_state_user_unique UNIQUE (user_id)
);

ALTER TABLE public.sigil_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sigil state"
  ON public.sigil_state FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to sigil_state"
  ON public.sigil_state FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_sigil_state_user ON public.sigil_state(user_id);

CREATE TABLE public.sigil_aether_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  log_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  aether_earned INTEGER NOT NULL,
  source        TEXT NOT NULL,
  mission_id    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sigil_aether_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own aether log"
  ON public.sigil_aether_log FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to aether_log"
  ON public.sigil_aether_log FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_aether_log_user_date ON public.sigil_aether_log(user_id, log_date DESC);

CREATE OR REPLACE FUNCTION public.create_sigil_state_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sigil_state (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_user_created_add_sigil_state
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_sigil_state_for_user();

INSERT INTO public.sigil_state (user_id)
SELECT id FROM public.users
ON CONFLICT (user_id) DO NOTHING;
