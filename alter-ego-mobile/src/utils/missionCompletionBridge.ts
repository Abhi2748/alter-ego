/**
 * When a mission completes off the Home swipe path (e.g. journal save),
 * HomeScreen registers a handler so XP bar, SP toast, aether, overlays still run.
 */

import type { CompleteMissionResponse } from "@/services/missions";

export type MissionCompletionSource = { missionId?: string };

export type MissionCompletionCelebrationHandler = (
  result: CompleteMissionResponse,
  source: MissionCompletionSource
) => void;

let handler: MissionCompletionCelebrationHandler | null = null;
let pending: { result: CompleteMissionResponse; source: MissionCompletionSource } | null = null;

export function setMissionCompletionCelebrationHandler(
  h: MissionCompletionCelebrationHandler | null
) {
  handler = h;
  if (handler && pending) {
    handler(pending.result, pending.source);
    pending = null;
  }
}

export function emitMissionCompletionCelebration(
  result: CompleteMissionResponse,
  source: MissionCompletionSource = {}
) {
  if (handler) {
    handler(result, source);
  } else {
    pending = { result, source };
  }
}
