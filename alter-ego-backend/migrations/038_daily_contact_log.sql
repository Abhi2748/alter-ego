-- Phase 4: daily contact log for outbound active contacts (nudge / proactive / echo / contradiction).
-- In-app mail is excluded. contact_type: nudge | proactive | echo | contradiction
-- Note: 033 is twin_challenges; this file is the next sequential migration.

CREATE TABLE IF NOT EXISTS daily_contact_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_date DATE NOT NULL,
    contact_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_contact_user_date
    ON daily_contact_log(user_id, contact_date);
