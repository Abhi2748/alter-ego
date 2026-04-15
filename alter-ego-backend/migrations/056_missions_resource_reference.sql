-- ═══════════════════════════════════════════════════════════════════════
-- Migration 056: Mission-level reference support
--
-- Adds a mission-level resource reference field so interest missions can
-- persist and return the "Reference" block shown in Mission Detail.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.missions
    ADD COLUMN IF NOT EXISTS resource_reference TEXT;

