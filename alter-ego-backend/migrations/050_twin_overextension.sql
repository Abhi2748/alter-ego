-- Twin mirror competition: overextension window after twin crosses user
ALTER TABLE twin_state
  ADD COLUMN IF NOT EXISTS twin_overextension_day INTEGER DEFAULT 0;

COMMENT ON COLUMN twin_state.twin_overextension_day IS
  '0 = not in overextension. 1/2/3 = days since twin crossed user (reduced mirror factor). Resets to 0 after day 3 or when user re-crosses twin.';
