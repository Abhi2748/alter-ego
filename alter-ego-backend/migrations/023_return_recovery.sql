-- B3b: Post-absence return recovery (mission overrides, long-absence ack, final push flag).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS recovery_mode_reason TEXT,
  ADD COLUMN IF NOT EXISTS recovery_mode_until DATE,
  ADD COLUMN IF NOT EXISTS long_absence_shown BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS final_absence_notif_sent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS return_question_shown_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.recovery_mode_reason IS
  'Return reason driving current 3-day recovery mission mode. NULL = no recovery active.';
COMMENT ON COLUMN public.users.recovery_mode_until IS
  'Last calendar day recovery_mode_reason applies (inclusive).';
COMMENT ON COLUMN public.users.long_absence_shown IS
  'True after 14+ day absence acknowledgment screen has been shown.';
COMMENT ON COLUMN public.users.final_absence_notif_sent IS
  'True after day-14 "last time I will ask" notification has been sent.';
COMMENT ON COLUMN public.users.return_question_shown_at IS
  'Timestamp of last time return question was answered (re-ask after new 7+ day absence).';
