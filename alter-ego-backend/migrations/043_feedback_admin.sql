-- Add admin_answer column for storing answers to questions
ALTER TABLE feedback_posts
  ADD COLUMN IF NOT EXISTS admin_answer TEXT;

-- Allow 'rejected' as a valid status
-- Drop the existing CHECK constraint and recreate it with the new value
ALTER TABLE feedback_posts
  DROP CONSTRAINT IF EXISTS feedback_posts_status_check;

ALTER TABLE feedback_posts
  ADD CONSTRAINT feedback_posts_status_check
  CHECK (status IN ('pending', 'approved', 'acknowledged', 'answered', 'resolved', 'rejected'));
