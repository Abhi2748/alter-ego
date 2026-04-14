/**
 * Pet / companion progression — must match alter-ego-backend/app/core/constants.py
 * (PF_THRESHOLDS, PET_NAMES, TOTAL_PET_STAGES).
 * Order: Cat → Fox → Wolf → Panther → Snow Leopard → Tiger → Phoenix → Dragon.
 */

export const PET_PF_THRESHOLDS = [
  0, 400, 2_800, 10_000, 26_800, 62_000, 113_200, 242_800,
] as const;

export const PET_STAGE_NAMES = [
  "Cat",
  "Fox",
  "Wolf",
  "Panther",
  "Snow Leopard",
  "Tiger",
  "Phoenix",
  "Dragon",
] as const;

export const TOTAL_PET_STAGES = 8;

/**
 * PF bar fill 0–100 for current pet stage window — must match
 * alter-ego-backend/app/api/profile.py (PF_THRESHOLDS segments).
 * Stage 1 (Cat): 0→400 PF full bar; stage 7: 113_200→242_800; max stage = 100%.
 */
export function computePetPfProgressPct(
  totalPf: number,
  petStage: number,
  petUnlocked: boolean
): number {
  const pf = Math.max(0, totalPf);
  if (!petUnlocked || petStage <= 0) {
    const end = PET_PF_THRESHOLDS[1] ?? 400;
    return Math.min(100, Math.round((pf / Math.max(end, 1)) * 1000) / 10);
  }
  if (petStage >= TOTAL_PET_STAGES) {
    return 100;
  }
  const start = PET_PF_THRESHOLDS[petStage - 1];
  const end = PET_PF_THRESHOLDS[petStage];
  const range = Math.max(end - start, 1);
  const raw = ((pf - start) / range) * 100;
  return Math.min(100, Math.max(0, Math.round(raw * 10) / 10));
}
