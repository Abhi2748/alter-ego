CREATE TABLE IF NOT EXISTS public.gap_moments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL,
    trigger_value TEXT,
    shown_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gap_moments_user_pending
    ON public.gap_moments(user_id, shown_at)
    WHERE shown_at IS NULL;

ALTER TABLE public.gap_moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own gap moments"
    ON public.gap_moments FOR SELECT
    USING (auth.uid() = user_id);
