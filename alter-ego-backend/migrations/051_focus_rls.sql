-- Enable RLS on focus tables
ALTER TABLE public.focus_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

-- focus_tags: users can only see and manage their own tags
CREATE POLICY "focus_tags_select_own" ON public.focus_tags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "focus_tags_insert_own" ON public.focus_tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "focus_tags_update_own" ON public.focus_tags
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "focus_tags_delete_own" ON public.focus_tags
  FOR DELETE USING (auth.uid() = user_id);

-- focus_sessions: users can only see and manage their own sessions
CREATE POLICY "focus_sessions_select_own" ON public.focus_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "focus_sessions_insert_own" ON public.focus_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "focus_sessions_update_own" ON public.focus_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "focus_sessions_delete_own" ON public.focus_sessions
  FOR DELETE USING (auth.uid() = user_id);