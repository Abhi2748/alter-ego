/**
 * Haptic utility — ALTER EGO
 *
 * Single source of truth for all tactile feedback.
 * All calls are wrapped in try/catch: haptics must never crash the app
 * (some devices/emulators do not support the Haptics API).
 *
 * Call sites:
 *   - applyMissionCompletionSideEffects (useMissions.ts) — all successful API completions
 *     (Home swipe, Mission Detail, journal save — journal calls apply before emit; haptic here only)
 *   - UpvoteButton (components/feedback/UpvoteButton.tsx) — community board upvote
 */

import * as Haptics from "expo-haptics";
import type { CompleteMissionResponse } from "@/services/missions";

// Streak values that deserve a distinct haptic (mirrors backend STREAK_MILESTONES)
const STREAK_MILESTONES = new Set([3, 7, 14, 30, 60, 100, 200, 365]);

/**
 * Fires the correct haptic pattern for a completed mission.
 *
 * Priority order (highest to lowest):
 *   1. stage_evolved   → Heavy impact  (character evolution — rarest, biggest)
 *   2. streak_milestone → Success notification  (streak hit a named milestone)
 *   3. pet_evolved     → Medium + brief Light double-pulse  (pet milestone)
 *   4. normal          → Medium impact  (standard completion)
 *
 * Skipped entirely if result.already_completed is true.
 */
export async function triggerMissionCompletionHaptic(
  result: CompleteMissionResponse
): Promise<void> {
  if (result.already_completed) return;

  try {
    if (result.stage_evolved) {
      // Character evolution — the heaviest physical moment in the app
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      return;
    }

    const streakIsAtMilestone =
      result.streak_updated &&
      result.current_streak != null &&
      STREAK_MILESTONES.has(result.current_streak);

    if (streakIsAtMilestone) {
      // Named streak milestone (7, 30, 100, etc.) — success notification pattern
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    if (result.pet_evolved) {
      // Pet evolution — double pulse: medium then light
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await new Promise<void>((res) => setTimeout(res, 120));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    // Standard mission completion
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Haptics not supported on this device — silent fail
  }
}

/**
 * Light impact for the community board upvote toggle.
 * Subtle — just enough to confirm the tap registered.
 */
export async function triggerUpvoteHaptic(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Silent fail
  }
}
