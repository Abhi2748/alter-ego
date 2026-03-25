-- C1/C2: onboarding echo + contradiction scheduler tracking (users columns only)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_echo_fired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_echo_question_key TEXT,
  ADD COLUMN IF NOT EXISTS last_contradiction_fired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS echoes_fired_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.users.last_echo_fired_at IS
  'When the last onboarding echo was surfaced. Used to enforce 7-day gap.';
COMMENT ON COLUMN public.users.last_echo_question_key IS
  'Which onboarding question was last echoed. Prevents repeat.';
COMMENT ON COLUMN public.users.last_contradiction_fired_at IS
  'When the last contradiction observation was surfaced. Enforces minimum day gap.';
COMMENT ON COLUMN public.users.echoes_fired_count IS
  'Total onboarding echoes surfaced (analytics).';
