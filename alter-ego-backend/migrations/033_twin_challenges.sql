CREATE TABLE IF NOT EXISTS public.twin_challenges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge_type TEXT NOT NULL,
    challenge_text TEXT NOT NULL,
    target_value INT NOT NULL,
    current_value INT DEFAULT 0,
    status TEXT DEFAULT 'pending',
    -- status values: pending | accepted | completed | failed | declined
    issued_at TIMESTAMPTZ DEFAULT now(),
    accepted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    xp_reward INT DEFAULT 50,
    twin_journal_acknowledged BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_twin_challenges_user_id
    ON public.twin_challenges(user_id);

CREATE INDEX IF NOT EXISTS idx_twin_challenges_status
    ON public.twin_challenges(user_id, status);

ALTER TABLE public.twin_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own challenges"
    ON public.twin_challenges FOR SELECT
    USING (auth.uid() = user_id);
