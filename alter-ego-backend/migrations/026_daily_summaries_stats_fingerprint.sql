-- Invalidate day summaries when mission stats change (compare fingerprint on read).

ALTER TABLE public.daily_summaries
  ADD COLUMN IF NOT EXISTS stats_fingerprint TEXT;

COMMENT ON COLUMN public.daily_summaries.stats_fingerprint IS
  'Hash of completed/total/core/xp/streak for cache invalidation; regenerated when stats change.';
