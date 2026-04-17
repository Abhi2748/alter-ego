/**
 * Lets App poll GET /twin/gap-moment right after mission completion, not only on resume.
 * Gap moments (e.g. all_complete) are queued in DB on complete; without this, users only
 * see them after backgrounding the app or a long delay.
 */

type GapMomentCheckHandler = () => void;

let handler: GapMomentCheckHandler | null = null;
let pending = false;

export function setGapMomentCheckHandler(h: GapMomentCheckHandler | null) {
  handler = h;
  if (handler && pending) {
    pending = false;
    handler();
  }
}

/** Call after any successful mission completion (swipe, detail, journal auto-complete). */
export function requestGapMomentCheck() {
  if (handler) {
    handler();
  } else {
    pending = true;
  }
}
