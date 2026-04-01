-- Migration 036: Quit Check-ins
-- Stores trigger check-in data for the quit mission living trigger profile.
-- Three types: slip_context (highest signal), weekly_urge, phase_transition.
-- Check-ins are optional — the system works without them (uses original profile).

CREATE TABLE IF NOT EXISTS public.quit_checkins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quit_path_id UUID NOT NULL REFERENCES public.quit_paths(id) ON DELETE CASCADE,
    checkin_type TEXT NOT NULL,
    -- values: slip_context | weekly_urge | phase_transition
    context_tags TEXT[],
    -- e.g. ['stressed', 'late_night', 'with_friends', 'on_autopilot']
    urge_level TEXT,
    -- values: barely_noticed | manageable | hard | nearly_gave_in | slipped
    free_text TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quit_checkins_user_path
    ON public.quit_checkins(user_id, quit_path_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quit_checkins_type
    ON public.quit_checkins(user_id, checkin_type, created_at DESC);

ALTER TABLE public.quit_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own checkins"
    ON public.quit_checkins FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own checkins"
    ON public.quit_checkins FOR INSERT
    WITH CHECK (auth.uid() = user_id);
