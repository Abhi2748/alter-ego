-- Focus tags: user-defined labels for sessions
CREATE TABLE IF NOT EXISTS focus_tags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  color       TEXT        NOT NULL DEFAULT '#8B5CF6',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Focus sessions: every completed or abandoned timer run
CREATE TABLE IF NOT EXISTS focus_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode              TEXT        NOT NULL CHECK (mode IN ('pomodoro', 'deep_work', 'stopwatch')),
  tag_id            UUID        REFERENCES focus_tags(id) ON DELETE SET NULL,
  started_at        TIMESTAMPTZ NOT NULL,
  ended_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  focus_seconds     INTEGER     NOT NULL DEFAULT 0,
  break_seconds     INTEGER     NOT NULL DEFAULT 0,
  rounds_completed  INTEGER     NOT NULL DEFAULT 0,
  was_abandoned     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_ended
  ON focus_sessions(user_id, ended_at DESC);

CREATE INDEX IF NOT EXISTS idx_focus_tags_user
  ON focus_tags(user_id);

-- Per-user focus settings stored as JSONB on the users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS focus_settings JSONB DEFAULT '{
  "pomodoro_work_minutes": 25,
  "pomodoro_short_break_minutes": 5,
  "pomodoro_long_break_minutes": 15,
  "pomodoro_rounds": 4,
  "auto_start_breaks": true,
  "auto_start_work": false,
  "sound_enabled": true
}'::jsonb;
