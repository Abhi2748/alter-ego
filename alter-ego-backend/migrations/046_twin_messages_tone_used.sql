-- Per-message Twin voice (mixed tones). Ratings / tone history use this, not current DNA alone.
ALTER TABLE twin_messages
  ADD COLUMN IF NOT EXISTS tone_used TEXT;

COMMENT ON COLUMN twin_messages.tone_used IS 'rival | philosopher | silent_force — voice used for this line';
