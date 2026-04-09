-- Streak freeze: auto-consume on miss vs manual reserve
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS streak_freeze_auto_consume BOOLEAN DEFAULT TRUE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS freeze_reserved_next_miss BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN users.streak_freeze_auto_consume IS 'If true, consume a freeze automatically when a day is missed (when inventory > 0)';
COMMENT ON COLUMN users.freeze_reserved_next_miss IS 'If true, next miss is covered without consuming again (freeze was spent at reserve time)';
