/**
 * Static per-ability content: description, missions with icons,
 * symbol, and navigation metadata.
 * All dynamic data (SP, level, progress) comes from useCharacterStats().
 */

export type AbilityKey = "vitality" | "focus" | "craft" | "discipline" | "willpower";

export interface AbilityMission {
  emoji: string;
  name: string;
  sub: string;
}

export interface AbilityStaticConfig {
  key: AbilityKey;
  label: string;
  symbol: string;
  color: string;
  bgTint: string;
  description: string;
  missions: AbilityMission[];
  isWillpower?: boolean;
}

export const ABILITY_DETAILS: Record<AbilityKey, AbilityStaticConfig> = {
  vitality: {
    key: "vitality",
    label: "Vitality",
    symbol: "◈",
    color: "#22C55E",
    bgTint: "rgba(34,197,94,0.06)",
    description:
      "Your body's foundation. Built through sleep, movement, and hydration — the physical prerequisites that sustain every other ability.",
    missions: [
      { emoji: "🌙", name: "Sleep", sub: "Core pillar · sleep" },
      { emoji: "🏃", name: "Movement", sub: "Core pillar · movement" },
      { emoji: "💧", name: "Hydration", sub: "Core pillar · hydration" },
    ],
  },
  focus: {
    key: "focus",
    label: "Focus",
    symbol: "◎",
    color: "#8B5CF6",
    bgTint: "rgba(139,92,246,0.06)",
    description:
      "The quality of your mental presence. Built by quieting distraction, sitting with your thoughts, and recording what matters.",
    missions: [
      { emoji: "🧘", name: "Mindfulness", sub: "Core pillar · mindfulness" },
      { emoji: "📵", name: "No-Phone", sub: "Core pillar · no_phone" },
      { emoji: "📓", name: "Journal", sub: "Core pillar · journal" },
    ],
  },
  craft: {
    key: "craft",
    label: "Craft",
    symbol: "✦",
    color: "#F59E0B",
    bgTint: "rgba(245,158,11,0.06)",
    description:
      "The depth of your skill. Every interest mission you complete adds to this — Craft grows when you show up for the things you want to master.",
    missions: [
      { emoji: "🎯", name: "Interest missions", sub: "Any mission in your interests" },
    ],
  },
  discipline: {
    key: "discipline",
    label: "Discipline",
    symbol: "▲",
    color: "#F97316",
    bgTint: "rgba(249,115,22,0.06)",
    description:
      "The backbone of everything. Discipline grows from completing core daily missions, resisting bad habits, and recovering deliberately.",
    missions: [
      { emoji: "⚡", name: "Core missions", sub: "Five pillars + journal (scales with Season)" },
      { emoji: "🛡️", name: "Resistance missions", sub: "Quit-path completions" },
      { emoji: "🔄", name: "Recovery missions", sub: "Recovery-type completions" },
    ],
  },
  willpower: {
    key: "willpower",
    label: "Willpower",
    symbol: "⬡",
    color: "#EF4444",
    bgTint: "rgba(239,68,68,0.06)",
    description:
      "The force of daily intention. Grows when you pursue personal goals and when you complete your full day without leaving missions behind.",
    missions: [
      { emoji: "🎯", name: "Personal missions", sub: "Missions you set yourself" },
      { emoji: "⚡", name: "Discipline bonus", sub: "All missions grant a small share" },
    ],
    isWillpower: true,
  },
};

export const LEVEL_THRESHOLDS = [0, 150, 450, 1_000, 2_200, 4_500, 8_500, 15_000, 25_000, 40_000];
export const LEVEL_NAMES = [
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

export const WILLPOWER_BONUS: Array<{ missions: number | "all"; label: string; sp: number }> = [
  { missions: 4, label: "4 missions done", sp: 20 },
  { missions: 6, label: "6 missions done", sp: 45 },
  { missions: "all", label: "All missions done", sp: 80 },
];
