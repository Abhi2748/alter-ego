-- Migration 053: unique constraint on core missions per (user_id, mission_date, core_pillar)
-- Prevents duplicate core missions from concurrent inserts.
-- Deduplicate any existing duplicates first (keep oldest row per group).

-- Remove duplicates: keep the row with the smallest created_at per group.
-- Uses a CTE to identify which rows to delete.
DELETE FROM public.missions
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY user_id, mission_date, core_pillar
                   ORDER BY created_at ASC
               ) AS rn
        FROM public.missions
        WHERE type = 'core'
          AND core_pillar IS NOT NULL
    ) ranked
    WHERE rn > 1
);

-- Add partial unique index: one row per (user_id, mission_date, core_pillar)
-- for all core-type missions. Covers all pillars including journal.
CREATE UNIQUE INDEX IF NOT EXISTS idx_missions_core_pillar_unique
    ON public.missions (user_id, mission_date, core_pillar)
    WHERE type = 'core' AND core_pillar IS NOT NULL;
