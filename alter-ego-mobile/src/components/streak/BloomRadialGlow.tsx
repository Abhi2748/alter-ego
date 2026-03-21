/**
 * Atmospheric bloom — richer than flat radial: hot core + mid halo + long falloff
 * (premium read vs a single flat purple disk).
 */
import React, { useMemo } from "react";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { parseRgba, rgbaToRgb } from "@/components/streak/parseRgba";

type Props = {
  size: number;
  /** e.g. rgba(109,40,217,0.28) from tier */
  bloomColor: string;
  gradientId: string;
};

export function BloomRadialGlow({ size, bloomColor, gradientId }: Props) {
  const { r, g, b, a } = useMemo(() => parseRgba(bloomColor), [bloomColor]);
  const rgb = rgbaToRgb({ r, g, b });
  /** Slightly brighter core, softer shoulder — reads more “lit” than one flat stop */
  const coreA = Math.min(1, a * 1.35);
  const midA = a * 0.55;
  const outerA = a * 0.12;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id={gradientId} cx="48%" cy="44%" r="52%">
          <Stop offset="0%" stopColor={rgb} stopOpacity={coreA} />
          <Stop offset="22%" stopColor={rgb} stopOpacity={midA} />
          <Stop offset="48%" stopColor={rgb} stopOpacity={outerA} />
          <Stop offset="72%" stopColor={rgb} stopOpacity={0} />
          <Stop offset="100%" stopColor={rgb} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={size / 2}
        fill={`url(#${gradientId})`}
      />
    </Svg>
  );
}
