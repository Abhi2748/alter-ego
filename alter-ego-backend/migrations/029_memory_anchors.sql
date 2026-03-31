-- Migration 029: Memory anchors for Twin Chat

CREATE TABLE IF NOT EXISTS memory_anchors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  anchor_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  emotional_weight TEXT DEFAULT 'medium',
  reference_phrase TEXT,
  source_message_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_anchors_user
  ON memory_anchors(user_id);

ALTER TABLE memory_anchors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own anchors"
  ON memory_anchors FOR SELECT
  USING (auth.uid() = user_id);
