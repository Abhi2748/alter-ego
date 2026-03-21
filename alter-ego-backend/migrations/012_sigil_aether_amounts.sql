-- Rebalance Surge / Aether per-mission and all-complete bonus (easy 10 / medium 20 / hard 40 / bonus 30).

UPDATE public.sigil_state
SET
  aether_per_easy     = 10,
  aether_per_medium   = 20,
  aether_per_hard     = 40,
  aether_surge_bonus  = 30,
  updated_at          = NOW();

ALTER TABLE public.sigil_state
  ALTER COLUMN aether_per_easy     SET DEFAULT 10,
  ALTER COLUMN aether_per_medium   SET DEFAULT 20,
  ALTER COLUMN aether_per_hard     SET DEFAULT 40,
  ALTER COLUMN aether_surge_bonus  SET DEFAULT 30;
