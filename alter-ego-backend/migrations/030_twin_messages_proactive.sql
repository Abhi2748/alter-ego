-- Migration 030: Proactive Twin messages + weekly cap log

ALTER TABLE twin_messages
  ADD COLUMN IF NOT EXISTS is_proactive BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS trigger_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_twin_messages_unread
  ON twin_messages(user_id, is_read) WHERE is_read = false;

CREATE TABLE IF NOT EXISTS proactive_message_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  messages_sent INT DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  UNIQUE(user_id, week_start)
);

ALTER TABLE proactive_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own proactive log"
  ON proactive_message_log FOR SELECT
  USING (auth.uid() = user_id);
