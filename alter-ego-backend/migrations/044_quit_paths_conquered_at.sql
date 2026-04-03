-- Self-declared quit conquest (POST /quits/{id}/conquer). Safe if column exists.
ALTER TABLE public.quit_paths
  ADD COLUMN IF NOT EXISTS conquered_at TIMESTAMPTZ;
