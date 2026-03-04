/**
 * ALTER EGO design tokens.
 * Use these where NativeWind className cannot reach: inline styles, shadows, gradients.
 * See CLAUDE.md §5. Tailwind config (ae colors) mirrors COLORS for className usage.
 */

export const COLORS = {
  // Backgrounds
  bg0: "#07080F",
  bg1: "#0D0F1A",
  surface: "#141824",
  surface2: "#1E2333",
  border: "#2A3050",

  // Violet — primary accent family
  violet: "#8B5CF6",
  violetDeep: "#6D28D9",
  violetGlow: "#A78BFA",
  violetLine: "#C084FC",

  // Single warm accent (streak flame only)
  ember: "#F97316",
  emberGlow: "#FB923C",

  // Text
  text: "#E5E7EB",
  text2: "#9CA3AF",
  muted: "#6B7280",

  // States
  danger: "#7F1D1D",
  success: "#8B5CF6",

  // Glass surfaces
  glass: "rgba(20,24,36,0.75)",
  glassBlur: 10,
  glassBorder: "#2A3050",
};

/** Typography scale (Inter only). Part 1 §1.2 / CLAUDE.md §5.2 — size (px) + weight. */
export const FONTS = {
  display: { size: 32, weight: "700" as const, tracking: -0.5 },
  h1: { size: 28, weight: "700" as const, tracking: -0.5 },
  h2: { size: 24, weight: "700" as const, tracking: -0.3 },
  h3: { size: 18, weight: "600" as const, tracking: -0.2 },
  body: { size: 16, weight: "400" as const, tracking: 0 },
  bodyMd: { size: 15, weight: "400" as const, tracking: 0 },
  bodySm: { size: 14, weight: "400" as const, tracking: 0 },
  label: { size: 12, weight: "500" as const, tracking: 0.3 },
  micro: { size: 11, weight: "500" as const, tracking: 0.4 },
  stat: { weight: "700" as const },
};

/** 8pt grid: 4, 8, 12, 16, 24, 32, 40, 48 (+ semantic keys for screen/card/section). */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
  screenPadding: 16,
  cardGap: 12,
  sectionGap: 24,
  cardPadding: 16,
  heroToSection: 24,
  contentPaddingBottom: 96,
};

/** Radius scale: 10 (chip), 16 (card), 24 (modal), 9999 (pill/circle). */
export const RADIUS = {
  chip: 10,
  card: 16,
  modal: 24,
  full: 9999,
};

export const SHADOWS = {
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  violet: {
    shadowColor: "#8B5CF6",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  violetGlow: {
    shadowColor: "#8B5CF6",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  fracture: {
    shadowColor: "#C084FC",
    shadowOpacity: 0.7,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  button: {
    shadowColor: "#8B5CF6",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
};

export const GRADIENTS = {
  background: { colors: ["#0D0F1A", "#07080F"] as const, start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  button: { colors: ["#6D28D9", "#8B5CF6"] as const, start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
  xpBar: { colors: ["#6D28D9", "#A78BFA"] as const, start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
  evolution: { colors: ["#1E1B4B", "#0F0C29"] as const, start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  fractureLine: {
    colors: ["transparent", "#C084FC", "transparent"] as const,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  rankCard: { colors: ["#1E1B4B", "#0D0F1A"] as const, start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
};

export const HEATMAP_LEVELS = ["#111827", "#312E81", "#4C1D95", "#6D28D9", "#A78BFA"];

export const ANIMATIONS = {
  tap: 100,
  cardAppear: 200,
  transition: 260,
  missionBurst: 450,
  twinkPulse: 600,
  xpFill: 260,
  evolution: 2400,
  standard: "easeOut" as const,
  cinematic: "easeInOut" as const,
  pressScale: 0.97,
  pressIn: 80,
  pressOut: 120,
  staggerDelay: 60,
  staggerMax: 300,
  glowMin: 0.2,
  glowMax: 0.7,
  glowRepeats: 3,
};
