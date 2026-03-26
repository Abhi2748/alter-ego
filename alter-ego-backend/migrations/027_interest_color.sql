-- Per-interest accent color for UI (rotates at creation; see profile.py INTEREST_COLOR_PALETTE)
ALTER TABLE public.interests
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#14B8A6';

-- Assign rotating colors to existing interests per user (stable order)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) - 1 AS idx
  FROM public.interests
)
UPDATE public.interests i
SET color = CASE (r.idx % 5)
  WHEN 0 THEN '#14B8A6'
  WHEN 1 THEN '#F59E0B'
  WHEN 2 THEN '#38BDF8'
  WHEN 3 THEN '#84CC16'
  WHEN 4 THEN '#EC4899'
END
FROM ranked r
WHERE i.id = r.id
  AND (i.color IS NULL OR i.color = '#14B8A6');
