/**
 * Closed beta: Google + Sign in later only; hide subscription paywall entry.
 * Set EXPO_PUBLIC_CLOSED_BETA=true in .env for beta builds.
 */
export const IS_CLOSED_BETA =
  process.env.EXPO_PUBLIC_CLOSED_BETA === "true" ||
  process.env.EXPO_PUBLIC_CLOSED_BETA === "1";
