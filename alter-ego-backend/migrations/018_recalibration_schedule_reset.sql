-- Reset calibration timing for users who have not had a first recalibration yet,
-- so the scheduler (day 7 + every 7 days) is not delayed by a stale last_calibration_at.
-- Rows with calibration_count > 0 are unchanged.

UPDATE public.discipline_dna
SET last_calibration_at = NULL
WHERE calibration_count = 0;
