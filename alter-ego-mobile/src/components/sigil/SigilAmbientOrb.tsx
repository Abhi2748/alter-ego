import React from "react";
import { SigilRadialGlow } from "./SigilRadialGlow";
import { sigilCanvasGlowSize, SIGIL_AMBIENT_INSET } from "./sigilTypes";

export interface SigilAmbientOrbProps {
  /** Tier accent (hex) — field glow hue */
  tintColor: string;
  /** Outer diameter; default matches HTML ~600px ambient relative to 340 canvas */
  size?: number;
  /** Nudge center if a parent clips oddly (default 0) */
  centerOffsetY?: number;
  /** Override breathe period (ms) */
  durationMs?: number;
}

/**
 * Large, slow radial field behind the canvas stack — HTML `.sigil-page::before` feel.
 * Must live inside the canvas wrapper so `left/top: 50%` locks to the sigil center.
 */
export function SigilAmbientOrb({
  tintColor,
  size,
  centerOffsetY = 0,
  durationMs,
}: SigilAmbientOrbProps) {
  const s = size ?? sigilCanvasGlowSize(SIGIL_AMBIENT_INSET);
  return (
    <SigilRadialGlow
      size={s}
      tintColor={tintColor}
      preset="ambient"
      durationMs={durationMs}
      centerOffsetY={centerOffsetY}
      zIndex={0}
    />
  );
}
