-- Idempotent twin XP finalization: twin_daily_record rows start with xp_earned=0 until
-- the nightly job runs. A plain "xp_earned > 0" check cannot tell "finalized with 0 XP"
-- from "not yet finalized", and finalizing the wrong calendar day (e.g. hour 0 + "today")
-- left twin_state never updated.

ALTER TABLE public.twin_daily_record
ADD COLUMN IF NOT EXISTS twin_xp_finalized BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.twin_daily_record.twin_xp_finalized IS
  'True after mirror XP/PF for this record_date has been applied to twin_state.';

-- Rows that already have non-zero ledger values were finalized by older jobs.
UPDATE public.twin_daily_record
SET twin_xp_finalized = TRUE
WHERE twin_xp_finalized = FALSE
  AND (COALESCE(xp_earned, 0) <> 0 OR COALESCE(pf_earned, 0) <> 0);
