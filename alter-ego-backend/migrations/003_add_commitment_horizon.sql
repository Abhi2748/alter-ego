-- Add commitment_horizon to users table
-- Stores the user's answer to Q14: how long before judging results
-- Values: '2_weeks' | '1_month' | '3_months' | 'however_long'

ALTER TABLE users
ADD COLUMN IF NOT EXISTS commitment_horizon TEXT
CHECK (commitment_horizon IS NULL OR commitment_horizon IN ('2_weeks', '1_month', '3_months', 'however_long'));

COMMENT ON COLUMN users.commitment_horizon IS
'How long the user is willing to commit before judging results. Set during onboarding Q14.';
