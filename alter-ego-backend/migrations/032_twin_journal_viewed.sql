-- Twin Comparison: server-side "journal read" cursor for is_new on GET /twin/journal
ALTER TABLE public.twin_state
  ADD COLUMN IF NOT EXISTS last_journal_viewed_at TIMESTAMPTZ DEFAULT NULL;
