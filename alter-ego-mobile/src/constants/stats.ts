/**
 * Character stat system — UI constants (placeholders; no API wiring yet).
 */

export const STATS = {
  vitality: {
    key: "vitality",
    symbol: "◈",
    color: "#22C55E",
    glowColor: "rgba(34,197,94,0.5)",
    label: "Vitality",
    sources: "Sleep · Movement · Hydration",
  },
  focus: {
    key: "focus",
    symbol: "◎",
    color: "#8B5CF6",
    glowColor: "rgba(139,92,246,0.5)",
    label: "Focus",
    sources: "Mind · No-Phone · Journal",
  },
  craft: {
    key: "craft",
    symbol: "✦",
    color: "#F59E0B",
    glowColor: "rgba(245,158,11,0.5)",
    label: "Craft",
    sources: "Interest missions",
  },
  discipline: {
    key: "discipline",
    symbol: "▲",
    color: "#F97316",
    glowColor: "rgba(249,115,22,0.5)",
    label: "Discipline",
    sources: "Every completion",
  },
  willpower: {
    key: "willpower",
    symbol: "⬡",
    color: "#EF4444",
    glowColor: "rgba(239,68,68,0.5)",
    label: "Willpower",
    sources: "Complete full days",
  },
  aura: {
    key: "aura",
    symbol: "◉",
    color: "#C084FC",
    glowColor: "rgba(192,132,252,0.5)",
    label: "Aura",
    sources: "Average of all abilities",
  },
} as const;

export type StatKey = keyof typeof STATS;

/** Stats that can appear on mission cards / SP toast (excludes aura aggregate). */
export type AbilityStatKey = Exclude<StatKey, "aura">;

const ABILITY_KEYS: AbilityStatKey[] = [
  "vitality",
  "focus",
  "craft",
  "discipline",
  "willpower",
];

export function parseStatTag(raw?: string | null): AbilityStatKey | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const k = raw.toLowerCase().trim();
  return (ABILITY_KEYS as readonly string[]).includes(k) ? (k as AbilityStatKey) : undefined;
}

export const STAT_LEVEL_NAMES = [
  "Dormant",
  "Stirring",
  "Forming",
  "Grounded",
  "Rising",
  "Forged",
  "Honed",
  "Sovereign",
  "Transcendent",
  "Eternal",
];

/** Mission pillar / type → stat (for Home cards). */
export const MISSION_STAT_MAP: Record<string, StatKey> = {
  sleep: "vitality",
  movement: "vitality",
  hydration: "vitality",
  mindfulness: "focus",
  no_phone: "focus",
  journal: "focus",
  interest: "craft",
  personal: "willpower",
};

export type MissionKindForStat = "core" | "interest" | "resistance" | "personal";

export function resolveStatKeyForMission(
  missionType: MissionKindForStat,
  corePillar: string | null | undefined
): StatKey | undefined {
  if (missionType === "interest") return "craft";
  if (missionType === "personal") return "willpower";
  if (missionType === "resistance") return "discipline";
  if (missionType === "core" && corePillar) {
    const k = corePillar.toLowerCase().replace(/-/g, "_");
    return MISSION_STAT_MAP[k];
  }
  return undefined;
}
