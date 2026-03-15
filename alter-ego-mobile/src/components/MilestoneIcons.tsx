/**
 * Milestone SVG icons — Spec §6. Stroke only, no emoji. 26×26 (28×28 for MS08).
 */

import React from "react";
import Svg, { Path, Circle, Line, Rect } from "react-native-svg";

const STROKE = 1.7;
const STROKE_08 = 1.8;
const SZ = 26;
const SZ08 = 28;

export function IconMS01FirstStep({ color = "#6366F1", size = SZ }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Path
        d="M13 4l2.5 7.5H23l-6 4.5 2.5 7.5L13 18l-6.5 5 2.5-7.5L3 11.5h7.5L13 4z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function IconMS027DaysIn({ color = "#8B5CF6", size = SZ }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Path
        d="M13 5c0 0 4 3 4 6s-2 5-4 5-4-2-4-5 4-6 4-6z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M13 16v5" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

export function IconMS0310Sessions({ color = "#F97316", size = SZ }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Circle cx={13} cy={13} r={9} stroke={color} strokeWidth={STROKE} fill="none" />
      <Circle cx={13} cy={13} r={5} stroke={color} strokeWidth={STROKE} fill="none" />
      <Circle cx={13} cy={13} r={1.5} stroke={color} strokeWidth={STROKE} fill="none" />
    </Svg>
  );
}

export function IconMS04OneMonth({ color = "#F59E0B", size = SZ }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Rect x={4} y={3} width={18} height={20} rx={2} stroke={color} strokeWidth={STROKE} fill="none" />
      <Line x1={4} y1={9} x2={22} y2={9} stroke={color} strokeWidth={STROKE} />
      <Circle cx={8} cy={14} r={1} fill={color} opacity={0.8} />
      <Circle cx={13} cy={14} r={1} fill={color} opacity={0.8} />
      <Circle cx={18} cy={14} r={1} fill={color} opacity={0.8} />
      <Circle cx={8} cy={18} r={1} fill={color} opacity={0.8} />
      <Circle cx={13} cy={18} r={1} fill={color} opacity={0.8} />
    </Svg>
  );
}

export function IconMS0550Sessions({ color = "#D946EF", size = SZ }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Path
        d="M13 3l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6l2-6z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function IconMS06100Sessions({ color = "#FBBF24", size = SZ }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Path
        d="M13 2l3 9h9l-7 5 2.5 8L13 19l-7.5 5 2.5-8L1 11h9l3-9z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M13 8l1.5 4.5H19l-3.5 2.5 1 3.5L13 15l-3.5 3.5 1-3.5L7 12.5h4.5L13 8z"
        fill={color}
        opacity={0.4}
      />
    </Svg>
  );
}

export function IconMS07200Sessions({ color = "#FBBF24", size = SZ }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Path
        d="M13 2l2.5 8H22l-6 4 2.5 8L13 18l-5.5 4 2.5-8-6-4h6.5L13 2z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M13 7l1.5 4.5h4.5l-3.5 2.5 1.5 4.5L13 16l-3 3.5 1.5-4.5-3.5-2.5h4.5L13 7z"
        fill={color}
        opacity={0.5}
      />
    </Svg>
  );
}

export function IconMS08365Sessions({ color = "#FBBF24", size = SZ08 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Circle cx={14} cy={14} r={10} stroke={color} strokeWidth={STROKE_08} fill="none" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const a = (i * 45 * Math.PI) / 180;
        const x1 = 14 + 10 * Math.cos(a);
        const y1 = 14 + 10 * Math.sin(a);
        const x2 = 14 + 14 * Math.cos(a);
        const y2 = 14 + 14 * Math.sin(a);
        return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={STROKE_08} strokeLinecap="round" />;
      })}
      <Path
        d="M14 8l1.5 4.5h4.5l-3.5 2.5 1.5 4.5L14 16l-3 3.5 1.5-4.5-3.5-2.5h4.5L14 8z"
        stroke={color}
        strokeWidth={STROKE_08}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

const ICONS: Record<number, React.FC<{ color?: string; size?: number }>> = {
  1: IconMS01FirstStep,
  2: IconMS027DaysIn,
  3: IconMS0310Sessions,
  4: IconMS04OneMonth,
  5: IconMS0550Sessions,
  6: IconMS06100Sessions,
  7: IconMS07200Sessions,
  8: IconMS08365Sessions,
};

export function MilestoneIcon({ number, color, size }: { number: number; color?: string; size?: number }) {
  const Icon = ICONS[number as keyof typeof ICONS] ?? IconMS01FirstStep;
  return <Icon color={color} size={size} />;
}
