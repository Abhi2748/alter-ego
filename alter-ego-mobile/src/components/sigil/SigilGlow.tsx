import React from "react";
import { SigilRadialGlow } from "./SigilRadialGlow";
import {
  sigilCanvasGlowSize,
  SIGIL_GLOW_INSET_1,
  SIGIL_GLOW_INSET_2,
  SIGIL_HALO_INSET,
} from "./sigilTypes";
import type { SigilRadialGlowPreset } from "./SigilRadialGlow";

export type SigilGlowLayer = "glow1" | "glow2" | "halo";

export interface SigilGlowProps {
  /** HTML canvas-glow (-40px), canvas-glow2 (-80px), or L9/10 halo */
  layer: SigilGlowLayer;
  /** Hex or rgba string for radial stops */
  tintColor: string;
  durationMs?: number;
  delayMs?: number;
  /** Override diameter in px (default: from HTML inset proportions vs 340 canvas) */
  size?: number;
}

const LAYER_TO_PRESET: Record<SigilGlowLayer, SigilRadialGlowPreset> = {
  glow1: "glow1",
  glow2: "glow2",
  halo: "halo",
};

const LAYER_DEFAULT_SIZE: Record<SigilGlowLayer, number> = {
  glow1: sigilCanvasGlowSize(SIGIL_GLOW_INSET_1),
  glow2: sigilCanvasGlowSize(SIGIL_GLOW_INSET_2),
  halo: sigilCanvasGlowSize(SIGIL_HALO_INSET),
};

const LAYER_DEFAULT_DURATION: Record<SigilGlowLayer, number> = {
  glow1: 4000,
  glow2: 6000,
  halo: 3000,
};

const LAYER_Z: Record<SigilGlowLayer, number> = {
  glow1: 1,
  glow2: 2,
  halo: 3,
};

/**
 * Canvas-attached radial glows (replaces directional LinearGradient).
 * Centered on the sigil canvas stack in SigilScreen.
 */
export function SigilGlow({ layer, tintColor, durationMs, delayMs = 0, size }: SigilGlowProps) {
  const s = size ?? LAYER_DEFAULT_SIZE[layer];
  const d = durationMs ?? LAYER_DEFAULT_DURATION[layer];
  return (
    <SigilRadialGlow
      size={s}
      tintColor={tintColor}
      preset={LAYER_TO_PRESET[layer]}
      durationMs={d}
      delayMs={delayMs}
      zIndex={LAYER_Z[layer]}
    />
  );
}
