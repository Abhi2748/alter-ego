/**
 * Atmospheric bloom — matches Alter-Ego-streakanimation.html:
 * radial-gradient(circle, bloomColor 0%, transparent 65%)
 * Soft glow, NOT a flat opaque disk.
 */
import React, { useMemo } from "react";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

function parseRgba(rgba: string): { r: number; g: number; b: number; a: number } {
  const m = rgba.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/i
  );
  if (!m) return { r: 109, g: 40, b: 217, a: 0.28 };
  return {
    r: Number(m[1]),
    g: Number(m[2]),
    b: Number(m[3]),
    a: m[4] !== undefined ? Number(m[4]) : 1,
  };
}

type Props = {
  size: number;
  /** e.g. rgba(109,40,217,0.28) from tier */
  bloomColor: string;
  gradientId: string;
};

export function BloomRadialGlow({ size, bloomColor, gradientId }: Props) {
  const { r, g, b, a } = useMemo(() => parseRgba(bloomColor), [bloomColor]);
  const rgb = `rgb(${r},${g},${b})`;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={rgb} stopOpacity={a} />
          <Stop offset="65%" stopColor={rgb} stopOpacity={0} />
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
