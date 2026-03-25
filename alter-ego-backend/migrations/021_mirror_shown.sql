-- 7-Day Mirror: one-time UI flag after GET /api/v1/profile/mirror succeeds.

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS mirror_shown BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.mirror_shown IS
  'True after the 7-Day Mirror has been shown to the user. Never resets.';
