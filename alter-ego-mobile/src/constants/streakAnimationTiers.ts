/**
 * Streak achievement overlay — tier visuals ported from ALTER_EGO_StreakAnimation.html
 * Tier selection uses the same thresholds as the mockup (>= 30, 60, 100, 200, 365).
 */

export type StreakVisualTierKey =
  | "standard"
  | "day30"
  | "day60"
  | "day100"
  | "day200"
  | "day365";

export type StreakOrnamentType =
  | "ticks_30"
  | "double_ring"
  | "triple_ring"
  | "star_compass"
  | "sun_rose";

export interface StreakTierBadge {
  text: string;
  bg: string;
  border: string;
  color: string;
}

export interface StreakVisualTier {
  bloomColor: string;
  bloomSize: number;
  shockColor: string;
  numGradient: string[];
  glowColor: string;
  numSize: number;
  ringColor: string;
  ringInnerColor: string;
  outerDash: string;
  outerColor: string;
  tickColor: string | null;
  streakLabelColor: string;
  badge: StreakTierBadge | null;
  ornament: StreakOrnamentType | null;
  flameSize: number;
  spinSpeed: number;
}

export const STREAK_VISUAL_TIERS: Record<StreakVisualTierKey, StreakVisualTier> = {
  standard: {
    bloomColor: "rgba(109,40,217,0.28)",
    bloomSize: 340,
    shockColor: "rgba(139,92,246,0.25)",
    /** 4-stop ramp: highlight → violet → deep (premium vs flat 2-tone) */
    numGradient: ["#EDE9FE", "#C4B5FD", "#8B5CF6", "#4C1D95"],
    glowColor: "rgba(139,92,246,0.50)",
    numSize: 108,
    ringColor: "rgba(139,92,246,0.55)",
    ringInnerColor: "rgba(109,40,217,0.25)",
    outerDash: "3 12",
    outerColor: "rgba(139,92,246,0.18)",
    tickColor: null,
    streakLabelColor: "#6B7280",
    badge: null,
    ornament: null,
    flameSize: 28,
    spinSpeed: 18,
  },
  day30: {
    bloomColor: "rgba(180,83,9,0.35)",
    bloomSize: 380,
    shockColor: "rgba(251,191,36,0.30)",
    numGradient: ["#FEF3C7", "#FBBF24", "#D97706"],
    glowColor: "rgba(245,158,11,0.55)",
    numSize: 108,
    ringColor: "rgba(251,191,36,0.70)",
    ringInnerColor: "rgba(120,53,15,0.30)",
    outerDash: "2 8",
    outerColor: "rgba(251,191,36,0.25)",
    tickColor: "rgba(251,191,36,0.40)",
    streakLabelColor: "#FBBF24",
    badge: null,
    ornament: "ticks_30",
    flameSize: 30,
    spinSpeed: 24,
  },
  day60: {
    bloomColor: "rgba(120,10,10,0.35)",
    bloomSize: 400,
    shockColor: "rgba(239,68,68,0.25)",
    numGradient: ["#FCA5A5", "#EF4444", "#991B1B"],
    glowColor: "rgba(239,68,68,0.50)",
    numSize: 112,
    ringColor: "rgba(239,68,68,0.65)",
    ringInnerColor: "rgba(127,29,29,0.30)",
    outerDash: "2 6",
    outerColor: "rgba(239,68,68,0.22)",
    tickColor: "rgba(239,68,68,0.35)",
    streakLabelColor: "#FCA5A5",
    badge: null,
    ornament: "double_ring",
    flameSize: 32,
    spinSpeed: 20,
  },
  day100: {
    bloomColor: "rgba(146,64,14,0.42)",
    bloomSize: 420,
    shockColor: "rgba(251,191,36,0.40)",
    numGradient: ["#FEF3C7", "#FCD34D", "#F59E0B", "#D97706"],
    glowColor: "rgba(251,191,36,0.60)",
    numSize: 116,
    ringColor: "rgba(251,191,36,0.80)",
    ringInnerColor: "rgba(146,64,14,0.35)",
    outerDash: "2 5",
    outerColor: "rgba(251,191,36,0.30)",
    tickColor: "rgba(251,191,36,0.50)",
    streakLabelColor: "#FCD34D",
    badge: {
      text: "CENTURY",
      bg: "rgba(120,53,15,0.40)",
      border: "rgba(251,191,36,0.45)",
      color: "#FCD34D",
    },
    ornament: "triple_ring",
    flameSize: 34,
    spinSpeed: 16,
  },
  day200: {
    bloomColor: "rgba(120,53,15,0.45)",
    bloomSize: 440,
    shockColor: "rgba(251,191,36,0.45)",
    numGradient: ["#FFF7ED", "#FDE68A", "#FBBF24", "#B45309"],
    glowColor: "rgba(245,158,11,0.65)",
    numSize: 116,
    ringColor: "rgba(251,191,36,0.85)",
    ringInnerColor: "rgba(120,53,15,0.40)",
    outerDash: "1 4",
    outerColor: "rgba(251,191,36,0.35)",
    tickColor: "rgba(251,191,36,0.55)",
    streakLabelColor: "#FDE68A",
    badge: {
      text: "SOVEREIGN",
      bg: "rgba(120,53,15,0.45)",
      border: "rgba(251,191,36,0.55)",
      color: "#FDE68A",
    },
    ornament: "star_compass",
    flameSize: 34,
    spinSpeed: 14,
  },
  day365: {
    bloomColor: "rgba(6,78,59,0.50)",
    bloomSize: 480,
    shockColor: "rgba(52,211,153,0.40)",
    numGradient: ["#ECFDF5", "#A7F3D0", "#34D399", "#059669"],
    glowColor: "rgba(52,211,153,0.65)",
    numSize: 120,
    ringColor: "rgba(52,211,153,0.90)",
    ringInnerColor: "rgba(6,78,59,0.40)",
    outerDash: "1 3",
    outerColor: "rgba(52,211,153,0.35)",
    tickColor: "rgba(52,211,153,0.60)",
    streakLabelColor: "#A7F3D0",
    badge: {
      text: "LEGENDARY",
      bg: "rgba(6,78,59,0.50)",
      border: "rgba(52,211,153,0.60)",
      color: "#A7F3D0",
    },
    ornament: "sun_rose",
    flameSize: 36,
    spinSpeed: 10,
  },
};

export function getStreakVisualTierKey(n: number): StreakVisualTierKey {
  if (n >= 365) return "day365";
  if (n >= 200) return "day200";
  if (n >= 100) return "day100";
  if (n >= 60) return "day60";
  if (n >= 30) return "day30";
  return "standard";
}

export function getStreakVisualTier(n: number): StreakVisualTier {
  return STREAK_VISUAL_TIERS[getStreakVisualTierKey(n)];
}

/** Matches HTML mockup milestone sub-lines */
export const STREAK_MILESTONE_SUB: Partial<Record<number, string>> = {
  30: "One month of showing up.",
  60: "Two months. Uncommon.",
  100: "100 days. The identity is set.",
  200: "200 days. This is who you are.",
  365: "A full year. Every day you could have stopped. You didn't.",
};

export function getOrdinalDayLabel(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  const suf = s[(v - 20) % 10] || s[v] || s[0];
  return `${n}${suf} day complete`;
}
