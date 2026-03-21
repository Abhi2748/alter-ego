-- Optional title + bookmark for journal entries (UI parity with app)
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS bookmarked BOOLEAN NOT NULL DEFAULT FALSE;
