-- One row per Aether-earning event (analytics / history).

CREATE TABLE IF NOT EXISTS public.sigil_aether_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  log_date      DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'UTC'),
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
