-- Twin chat: structured agent fields, per-message ratings, calibration inputs.
-- App table name is twin_messages (not twin_chat_history).

ALTER TABLE public.twin_messages
  ADD COLUMN IF NOT EXISTS message_rating INTEGER DEFAULT NULL
    CHECK (message_rating IS NULL OR message_rating IN (-1, 0, 1)),
  ADD COLUMN IF NOT EXISTS rating_used_in_calibration BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS emotional_register TEXT,
  ADD COLUMN IF NOT EXISTS conversation_note TEXT;

CREATE INDEX IF NOT EXISTS idx_twin_messages_ratings
  ON public.twin_messages(user_id, message_rating)
  WHERE message_rating IS NOT NULL AND rating_used_in_calibration = FALSE;

ALTER TABLE public.discipline_dna
  ADD COLUMN IF NOT EXISTS tone_preference_signal DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS chat_rating_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_rating_calibration_at TIMESTAMPTZ;

COMMENT ON COLUMN public.discipline_dna.tone_preference_signal IS
  '0.0 = warmer/more human twin copy; 1.0 = colder/minimal; 0.5 = neutral / archetype default';
