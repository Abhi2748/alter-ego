/**
 * Pet / companion progression — must match alter-ego-backend/app/core/constants.py
 * (PF_THRESHOLDS, PET_NAMES, TOTAL_PET_STAGES).
 */

export const PET_PF_THRESHOLDS = [
  0, 400, 2_800, 10_000, 26_800, 62_000, 113_200, 242_800,
] as const;

export const PET_STAGE_NAMES = [
  "Cub",
  "Cat",
  "Fox",
  "Wolf",
  "Snow Leopard",
  "Panther",
  "Griffin",
  "Dragon",
] as const;

export const TOTAL_PET_STAGES = 8;
