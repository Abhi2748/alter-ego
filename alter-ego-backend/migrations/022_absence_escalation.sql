-- B3: Return / absence escalation — Twin strip, return reason, push cadence.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS absence_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_date DATE,
  ADD COLUMN IF NOT EXISTS return_reason TEXT,
  ADD COLUMN IF NOT EXISTS return_reason_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS twin_tone_override TEXT,
  ADD COLUMN IF NOT EXISTS twin_tone_override_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_absence_notif_day INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unsure_followup_push_sent BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.absence_days IS
  'Consecutive days user has not completed any missions. Reset to 0 on any completion.';
COMMENT ON COLUMN public.users.last_active_date IS
  'Date of last mission completion (user local calendar). Used to compute absence_days.';
COMMENT ON COLUMN public.users.return_reason IS
  'Why user said they left after 7+ day absence. One of: life|motivation|forgot|break|unsure';
COMMENT ON COLUMN public.users.twin_tone_override IS
  'Tone modifier for Twin agent for 7 days after return.';
COMMENT ON COLUMN public.users.twin_tone_override_until IS
  'When twin_tone_override expires. NULL means no override active.';
COMMENT ON COLUMN public.users.last_absence_notif_day IS
  'Last absence_days threshold (1,2,3,5,7) for which an escalation push was sent.';
COMMENT ON COLUMN public.users.unsure_followup_push_sent IS
  'True after 24h follow-up push for return_reason unsure.';
