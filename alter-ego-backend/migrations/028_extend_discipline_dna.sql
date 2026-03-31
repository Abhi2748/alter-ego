-- Migration 028: Extend discipline_dna with profiler dimensions

ALTER TABLE discipline_dna
  ADD COLUMN IF NOT EXISTS archetype_confidence FLOAT DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS secondary_archetype TEXT,
  ADD COLUMN IF NOT EXISTS execution_gap FLOAT DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS failure_resilience FLOAT DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS external_validation_need FLOAT DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS self_belief FLOAT DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS structure_dependence FLOAT DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS guilt_orientation FLOAT DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS competitive_drive FLOAT DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS intrinsic_motivation FLOAT DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS self_talk_pattern TEXT DEFAULT 'pragmatic',
  ADD COLUMN IF NOT EXISTS discipline_framing TEXT DEFAULT 'behavior',
  ADD COLUMN IF NOT EXISTS emotional_starting_state TEXT DEFAULT 'fresh_start',
  ADD COLUMN IF NOT EXISTS core_failure_pattern TEXT,
  ADD COLUMN IF NOT EXISTS success_pattern TEXT,
  ADD COLUMN IF NOT EXISTS twin_relationship_style TEXT DEFAULT 'mentor_rival',
  ADD COLUMN IF NOT EXISTS narrative_seed TEXT;
