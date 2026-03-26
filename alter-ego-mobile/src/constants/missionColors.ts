// Quit / Resistance — orange system
export const QUIT_ORANGE = {
  primary: "#F97316", // orange-500
  deep: "#C2410C", // orange-700
  surface: "rgba(249,115,22,0.08)",
  border: "rgba(249,115,22,0.18)",
  border2: "rgba(249,115,22,0.30)",
  text: "#FB923C", // orange-400 — readable on dark
  muted: "rgba(249,115,22,0.55)",
} as const;

// Interest palette — 5 colors, rotate by index
export const INTEREST_COLORS = [
  {
    primary: "#14B8A6", // teal
    deep: "#0D9488",
    surface: "rgba(20,184,166,0.08)",
    border: "rgba(20,184,166,0.20)",
    text: "#2DD4BF",
  },
  {
    primary: "#F59E0B", // amber
    deep: "#D97706",
    surface: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.20)",
    text: "#FCD34D",
  },
  {
    primary: "#38BDF8", // sky
    deep: "#0284C7",
    surface: "rgba(56,189,248,0.08)",
    border: "rgba(56,189,248,0.20)",
    text: "#7DD3FC",
  },
  {
    primary: "#84CC16", // lime
    deep: "#65A30D",
    surface: "rgba(132,204,22,0.08)",
    border: "rgba(132,204,22,0.20)",
    text: "#BEF264",
  },
  {
    primary: "#EC4899", // pink
    deep: "#BE185D",
    surface: "rgba(236,72,153,0.08)",
    border: "rgba(236,72,153,0.20)",
    text: "#F9A8D4",
  },
] as const;

export type InterestColorScheme = (typeof INTEREST_COLORS)[number];

// Get color scheme by index (wraps around)
export function getInterestColor(index: number): InterestColorScheme {
  return INTEREST_COLORS[index % INTEREST_COLORS.length];
}

// Get color scheme from stored hex string
export function getInterestColorByHex(hex: string): InterestColorScheme {
  return INTEREST_COLORS.find((c) => c.primary === hex) ?? INTEREST_COLORS[0];
}
