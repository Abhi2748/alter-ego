-- Per–twin-message tone ratings (Twin Chat thumbs). Used for Settings → Tone History.
-- Run on Supabase SQL editor or via migration pipeline.

CREATE TABLE IF NOT EXISTS twin_tone_ratings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  twin_message_id   UUID NOT NULL REFERENCES twin_messages(id) ON DELETE CASCADE,
  rating            TEXT NOT NULL CHECK (rating IN ('positive', 'neutral', 'negative')),
  tone_type         TEXT NOT NULL CHECK (tone_type IN ('rival', 'philosopher', 'silent_force')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, twin_message_id)
);

CREATE INDEX IF NOT EXISTS idx_twin_tone_ratings_user ON twin_tone_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_twin_tone_ratings_message ON twin_tone_ratings(twin_message_id);

ALTER TABLE twin_tone_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "twin_tone_ratings_select_own" ON twin_tone_ratings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "twin_tone_ratings_insert_own" ON twin_tone_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "twin_tone_ratings_update_own" ON twin_tone_ratings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "twin_tone_ratings_delete_own" ON twin_tone_ratings
  FOR DELETE USING (auth.uid() = user_id);
