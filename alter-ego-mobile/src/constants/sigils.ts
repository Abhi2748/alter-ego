export const SIGIL_LEVELS = [
  {
    level: 1,
    name: "The Ember",
    aetherRequired: 0,
    accentColor: "#64748B",
    accentColor2: "#334155",
    ambientColor: "rgba(100,116,139,0.07)",
    glowColor: "rgba(100,116,139,0.18)",
    glowColor2: "rgba(100,116,139,0.07)",
    description:
      "Cosmic dust. Scattered, unformed — the seed of something that has not yet decided what it will become. One dim spark at the centre.",
  },
  {
    level: 2,
    name: "The Fracture",
    aetherRequired: 300,
    accentColor: "#60A5FA",
    accentColor2: "#1D4ED8",
    ambientColor: "rgba(96,165,250,0.07)",
    glowColor: "rgba(96,165,250,0.20)",
    glowColor2: "rgba(96,165,250,0.08)",
    description:
      "Blue enters. Two spiral arms reach outward — the first suggestion of structure. Dust is being pulled inward. Something is forming.",
  },
  {
    level: 3,
    name: "The Current",
    aetherRequired: 900,
    accentColor: "#2DD4BF",
    accentColor2: "#0F766E",
    ambientColor: "rgba(45,212,191,0.07)",
    glowColor: "rgba(45,212,191,0.22)",
    glowColor2: "rgba(45,212,191,0.08)",
    description:
      "A galaxy in miniature. Four teal arms spiral outward from the core. Six orbital nodes trace a ring. The energy is moving now.",
  },
  {
    level: 4,
    name: "The Vortex",
    aetherRequired: 2100,
    accentColor: "#818CF8",
    accentColor2: "#4338CA",
    ambientColor: "rgba(129,140,248,0.08)",
    glowColor: "rgba(129,140,248,0.24)",
    glowColor2: "rgba(99,102,241,0.10)",
    description:
      "Five plasma rings orbit at different speeds and inclinations. Like a solar system being born. A storm eye forms — indigo, compressed, barely contained.",
  },
  {
    level: 5,
    name: "The Convergence",
    aetherRequired: 4500,
    accentColor: "#A78BFA",
    accentColor2: "#5B21B6",
    ambientColor: "rgba(167,139,250,0.10)",
    glowColor: "rgba(167,139,250,0.28)",
    glowColor2: "rgba(124,58,237,0.12)",
    description:
      "A violet jewel crystallising. 16 starburst rays. An 8-pointed star. Eight diamond nodes orbit the outer ring. A 12-petal rose blooms at the core.",
  },
  {
    level: 6,
    name: "The Resonance",
    aetherRequired: 9000,
    accentColor: "#C084FC",
    accentColor2: "#7C3AED",
    ambientColor: "rgba(192,132,252,0.10)",
    glowColor: "rgba(192,132,252,0.30)",
    glowColor2: "rgba(192,132,252,0.12)",
    description:
      "A living lotus of violet light. Three layers of petals rotate in opposing directions. 12 diamond nodes orbit the boundary. The sigil breathes.",
  },
  {
    level: 7,
    name: "The Dominion",
    aetherRequired: 16500,
    accentColor: "#E879F9",
    accentColor2: "#86198F",
    ambientColor: "rgba(232,121,249,0.10)",
    glowColor: "rgba(232,121,249,0.30)",
    glowColor2: "rgba(232,121,249,0.12)",
    description:
      "A supernova frozen at its most beautiful instant. Five shockwave rings. 12 lightning spikes. Two layers of petals. Six plasma orbs in orbit.",
  },
  {
    level: 8,
    name: "The Ascendancy",
    aetherRequired: 28000,
    accentColor: "#FB7185",
    accentColor2: "#9F1239",
    ambientColor: "rgba(251,113,133,0.10)",
    glowColor: "rgba(251,113,133,0.32)",
    glowColor2: "rgba(251,113,133,0.14)",
    description:
      "Solar prominences arc outward. Eight massive plasma loops. 24 radial rays. The colour shifts from rose to gold at the tips. The core burns near-white.",
  },
  {
    level: 9,
    name: "The Absolute",
    aetherRequired: 45000,
    accentColor: "#FDE68A",
    accentColor2: "#92400E",
    ambientColor: "rgba(253,230,138,0.12)",
    glowColor: "rgba(253,230,138,0.32)",
    glowColor2: "rgba(253,230,138,0.15)",
    description:
      "Near-solar. Five corona halos. 36 rays. 12 blazing diamond nodes. White breaks through at the core. The sigil is becoming light itself.",
  },
  {
    level: 10,
    name: "The Eternal Flame",
    aetherRequired: 70000,
    accentColor: "#F8FAFC",
    accentColor2: "#F59E0B",
    ambientColor: "rgba(255,255,255,0.12)",
    glowColor: "rgba(255,255,255,0.35)",
    glowColor2: "rgba(253,230,138,0.20)",
    description:
      "Total ignition. Four corona halos. 48 solar rays. Twelve white diamond nodes. A triple-layered rose of pure white and gold. It burns without fuel. It simply is.",
  },
] as const;

export function getSigilLevel(aether: number): number {
  let level = 1;
  for (let i = 0; i < SIGIL_LEVELS.length; i++) {
    if (aether >= SIGIL_LEVELS[i].aetherRequired) level = i + 1;
    else break;
  }
  return Math.min(level, 10);
}

export function getAetherProgress(aether: number) {
  const level = getSigilLevel(aether);
  if (level >= 10) {
    return {
      currentLevel: 10,
      nextLevelAether: 70000,
      progressPercent: 100,
      aetherNeeded: 0,
    };
  }
  const curr = SIGIL_LEVELS[level - 1].aetherRequired;
  const next = SIGIL_LEVELS[level].aetherRequired;
  return {
    currentLevel: level,
    nextLevelAether: next,
    progressPercent: Math.round(((aether - curr) / (next - curr)) * 100),
    aetherNeeded: next - aether,
  };
}
