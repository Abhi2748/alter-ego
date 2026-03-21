-- Tag missions with stat key for SP routing (matches app.core.constants PILLAR_TO_STAT / MISSION_TYPE_TO_STAT).

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS stat_tag VARCHAR(20);

UPDATE public.missions SET stat_tag = 'vitality'
WHERE stat_tag IS NULL AND type = 'core' AND core_pillar IN ('sleep', 'movement', 'hydration');

UPDATE public.missions SET stat_tag = 'focus'
WHERE stat_tag IS NULL AND type = 'core' AND core_pillar IN ('mindfulness', 'no_phone', 'journal');

UPDATE public.missions SET stat_tag = 'craft'
WHERE stat_tag IS NULL AND type = 'interest';

UPDATE public.missions SET stat_tag = 'willpower'
WHERE stat_tag IS NULL AND type = 'personal';

UPDATE public.missions SET stat_tag = 'discipline'
WHERE stat_tag IS NULL AND type IN ('resistance', 'recovery');

UPDATE public.missions SET stat_tag = 'discipline'
WHERE stat_tag IS NULL AND type = 'core';
