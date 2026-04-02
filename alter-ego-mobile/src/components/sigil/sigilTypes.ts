export const SIGIL_VB = 340;

/** Matches docs/ALTER_EGO_Sigil_FullPage.html sigil-canvas (340×340 viewBox). */
export const DEFAULT_SIGIL_SIZE = 340;

/** HTML `.canvas-glow` uses inset -40px on the 340×340 canvas → diameter = 340 + 80 */
export const SIGIL_GLOW_INSET_1 = 40;
/** HTML `.canvas-glow2` uses inset -80px */
export const SIGIL_GLOW_INSET_2 = 80;
/** Extra halo for high tiers (L9/L10), ~inset -130px → 600px total */
export const SIGIL_HALO_INSET = 130;
/** Page ambient (~600px circle in HTML); centered with canvas */
export const SIGIL_AMBIENT_INSET = 130;

export function sigilCanvasGlowSize(insetPx: number): number {
  return DEFAULT_SIGIL_SIZE + 2 * insetPx;
}

export interface SigilProps {
  size?: number;
  accentColor?: string;
  accentColor2?: string;
}
