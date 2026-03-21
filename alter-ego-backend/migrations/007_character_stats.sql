-- Character stat system: per-user SP pools, levels, daily caps, willpower milestones.
-- Run after existing migrations. Backend uses service role (bypasses RLS).

CREATE TABLE IF NOT EXISTS public.character_stats (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  vitality_sp       INTEGER NOT NULL DEFAULT 0,
  focus_sp          INTEGER NOT NULL DEFAULT 0,
  craft_sp          INTEGER NOT NULL DEFAULT 0,
  discipline_sp     INTEGER NOT NULL DEFAULT 0,
  willpower_sp      INTEGER NOT NULL DEFAULT 0,

  vitality_level    INTEGER NOT NULL DEFAULT 1,
  focus_level       INTEGER NOT NULL DEFAULT 1,
  craft_level       INTEGER NOT NULL DEFAULT 1,
  discipline_level  INTEGER NOT NULL DEFAULT 1,
  willpower_level   INTEGER NOT NULL DEFAULT 1,
  aura_level        INTEGER NOT NULL DEFAULT 1,

  vitality_sp_today    INTEGER NOT NULL DEFAULT 0,
  focus_sp_today       INTEGER NOT NULL DEFAULT 0,
  craft_sp_today       INTEGER NOT NULL DEFAULT 0,
  discipline_sp_today  INTEGER NOT NULL DEFAULT 0,
  willpower_sp_today   INTEGER NOT NULL DEFAULT 0,

  missions_completed_today  INTEGER NOT NULL DEFAULT 0,
  total_missions_today      INTEGER NOT NULL DEFAULT 0,
  -- Cumulative SP granted from willpower milestone tiers today (supports 20 → 45 → 80 upgrades)
  willpower_milestone_sp_awarded INTEGER NOT NULL DEFAULT 0,

  last_sp_date      DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT character_stats_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_character_stats_user_id ON public.character_stats(user_id);

ALTER TABLE public.character_stats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'character_stats' AND policyname = 'character_stats_select_own'
  ) THEN
    CREATE POLICY "character_stats_select_own" ON public.character_stats
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Auto row on signup
CREATE OR REPLACE FUNCTION public.create_character_stats_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.character_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_user_created_add_stats ON public.users;
CREATE TRIGGER on_user_created_add_stats
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.create_character_stats_for_user();

INSERT INTO public.character_stats (user_id)
SELECT id FROM public.users
ON CONFLICT (user_id) DO NOTHING;
