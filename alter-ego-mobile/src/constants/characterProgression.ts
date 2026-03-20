/**
 * Character stage XP — must match alter-ego-backend/app/core/constants.py
 * (XP_THRESHOLDS, STAGE_NAMES).
 */

export const CHARACTER_XP_THRESHOLDS = [
  0, 800, 9_800, 36_800, 108_800, 375_200,
] as const;

export const CHARACTER_STAGE_NAMES = [
  "The Awakened",
  "The Focused",
  "The Burning",
  "The Relentless",
  "The Formidable",
  "The Sovereign",
] as const;

export const TOTAL_CHARACTER_STAGES = 6;

/** Remaining XP + progress within current stage (same formulas as profile/overview). */
export function computeCharacterXpDerived(
  totalXp: number,
  characterStage: number
): { xp_to_next_stage: number; stage_progress_pct: number } {
  const stage = Math.min(
    Math.max(characterStage, 1),
    TOTAL_CHARACTER_STAGES
  );
  const stageStart = CHARACTER_XP_THRESHOLDS[stage - 1];
  const stageEnd =
    stage < TOTAL_CHARACTER_STAGES
      ? CHARACTER_XP_THRESHOLDS[stage]
      : CHARACTER_XP_THRESHOLDS[stage - 1];
  const xp_to_next_stage =
    stage < TOTAL_CHARACTER_STAGES
      ? Math.max(0, stageEnd - totalXp)
      : 0;
  const stage_progress_pct =
    stage < TOTAL_CHARACTER_STAGES
      ? Math.round(
          ((totalXp - stageStart) / Math.max(stageEnd - stageStart, 1)) *
            1000
        ) / 10
      : 100;
  return { xp_to_next_stage, stage_progress_pct };
}

/**
 * Label for the XP bar arrow: the stage you are working toward (not current).
 * Stage 1 (Awakened) → "The Focused"; stage 6 → Sovereign (max).
 */
export function getNextStageNameForBar(characterStage: number): string {
  const s = Math.min(
    Math.max(characterStage, 1),
    TOTAL_CHARACTER_STAGES
  );
  if (s >= TOTAL_CHARACTER_STAGES) {
    return CHARACTER_STAGE_NAMES[TOTAL_CHARACTER_STAGES - 1];
  }
  return CHARACTER_STAGE_NAMES[s];
}
