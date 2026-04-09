-- New mail_type enum values (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'streak_milestone_7'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'mail_type')) THEN
    ALTER TYPE mail_type ADD VALUE 'streak_milestone_7';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'streak_milestone_30'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'mail_type')) THEN
    ALTER TYPE mail_type ADD VALUE 'streak_milestone_30';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'streak_milestone_100'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'mail_type')) THEN
    ALTER TYPE mail_type ADD VALUE 'streak_milestone_100';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ability_first_levelup'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'mail_type')) THEN
    ALTER TYPE mail_type ADD VALUE 'ability_first_levelup';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'focus_first_session'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'mail_type')) THEN
    ALTER TYPE mail_type ADD VALUE 'focus_first_session';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'quit_path_started'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'mail_type')) THEN
    ALTER TYPE mail_type ADD VALUE 'quit_path_started';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'quit_day_1_clean'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'mail_type')) THEN
    ALTER TYPE mail_type ADD VALUE 'quit_day_1_clean';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'quit_week_1_clean'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'mail_type')) THEN
    ALTER TYPE mail_type ADD VALUE 'quit_week_1_clean';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'stage_evolved'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'mail_type')) THEN
    ALTER TYPE mail_type ADD VALUE 'stage_evolved';
  END IF;
END $$;
