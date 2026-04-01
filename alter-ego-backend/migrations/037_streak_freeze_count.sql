-- Migration 037: Streak freeze inventory
-- Stores how many user-earned streak freezes a user has available.
-- Automatically consumed in handle_streak_break when streak would otherwise break.
-- Separate from the automatic STREAK_FREEZE_DAYS grace period.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS streak_freeze_count INT DEFAULT 0;
