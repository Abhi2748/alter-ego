/**
 * Quit milestone SVG icons — Spec §3. Stroke only, no emoji.
 * MS01–MS08 + Comeback + Conquered. 14×14 in rows, 24–28 in modals.
 */

import React from "react";
import Svg, { Path, Circle, Line, Rect } from "react-native-svg";

const STROKE = 1.5;
const SZ = 14;
const SZ_MODAL = 26;

// First Day (1d) — Teardrop/pin. stroke #6366F1
export function IconQuitDay1({ color = "#6366F1", size = SZ }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M7 2.5c0 0 2 1.5 2 3s-1 2-2 2-2-.8-2-2 2-3 2-3z" stroke={color} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
      <Path d="M7 10v2" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

// Three Days (3d) — 5-point star outline. stroke #8B5CF6
export function IconQuitDay3({ color = "#8B5CF6", size = SZ }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M7 1.5l1.2 3.6H12L9.2 7.2l1.2 3.6L7 9.2 4.6 10.8l1.2-3.6L3 5.1h3.8L7 1.5z" stroke={color} strokeWidth={STROKE} strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// One Week (7d) — Sun/compass: circle + 4 rays + centre dot. stroke #F97316
export function IconQuitDay7({ color = "#F97316", size = SZ }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Circle cx={7} cy={7} r={2.5} stroke={color} strokeWidth={STROKE} fill="none" />
      <Line x1={7} y1={1} x2={7} y2={3.5} stroke={color} strokeWidth={STROKE} />
      <Line x1={7} y1={10.5} x2={7} y2={13} stroke={color} strokeWidth={STROKE} />
      <Line x1={1} y1={7} x2={3.5} y2={7} stroke={color} strokeWidth={STROKE} />
      <Line x1={10.5} y1={7} x2={13} y2={7} stroke={color} strokeWidth={STROKE} />
    </Svg>
  );
}

// Two Weeks (14d) — Calendar with dot row. stroke #F59E0B
export function IconQuitDay14({ color = "#F59E0B", size = SZ }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Rect x={2} y={2} width={10} height={10} rx={1} stroke={color} strokeWidth={STROKE} fill="none" />
      <Line x1={2} y1={5} x2={12} y2={5} stroke={color} strokeWidth={STROKE} />
      <Circle cx={5} cy={8} r={0.8} fill={color} opacity={0.9} />
      <Circle cx={7} cy={8} r={0.8} fill={color} opacity={0.9} />
      <Circle cx={9} cy={8} r={0.8} fill={color} opacity={0.9} />
    </Svg>
  );
}

// One Month (30d) — 6-point starburst. stroke #D946EF
export function IconQuitDay30({ color = "#D946EF", size = SZ }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M7 1l1 3h3l-2.5 1.8 1 3L7 6.5 4.5 8.8l1-3L3 4h3l1-3z" stroke={color} strokeWidth={STROKE} strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// Two Months (60d) — Partially-filled star. stroke #FBBF24
export function IconQuitDay60({ color = "#FBBF24", size = SZ }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M7 1.2l1.5 4.5h4.5l-3.5 2.5 1.2 4L7 10.2 3.3 12.2l1.2-4-3.5-2.5h4.5L7 1.2z" stroke={color} strokeWidth={STROKE} strokeLinejoin="round" fill="none" />
      <Path d="M7 4.5l0.8 2.2H10l-2 1.5 0.6 2.2L7 8.2 4.6 10.4l0.6-2.2-2-1.5h2.2L7 4.5z" fill={color} opacity={0.45} />
    </Svg>
  );
}

// Three Months (90d) — Sun with inner rings. stroke #FBBF24
export function IconQuitDay90({ color = "#FBBF24", size = SZ }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Circle cx={7} cy={7} r={3} stroke={color} strokeWidth={STROKE} fill="none" />
      <Circle cx={7} cy={7} r={1} stroke={color} strokeWidth={STROKE} fill="none" />
      <Line x1={7} y1={0.5} x2={7} y2={2.5} stroke={color} strokeWidth={STROKE} />
      <Line x1={7} y1={11.5} x2={7} y2={13.5} stroke={color} strokeWidth={STROKE} />
      <Line x1={0.5} y1={7} x2={2.5} y2={7} stroke={color} strokeWidth={STROKE} />
      <Line x1={11.5} y1={7} x2={13.5} y2={7} stroke={color} strokeWidth={STROKE} />
      <Line x1={2.2} y1={2.2} x2={3.5} y2={3.5} stroke={color} strokeWidth={STROKE} />
      <Line x1={10.5} y1={10.5} x2={11.8} y2={11.8} stroke={color} strokeWidth={STROKE} />
      <Line x1={10.5} y1={3.5} x2={11.8} y2={2.2} stroke={color} strokeWidth={STROKE} />
      <Line x1={2.2} y1={11.8} x2={3.5} y2={10.5} stroke={color} strokeWidth={STROKE} />
    </Svg>
  );
}

// One Year (365d) — Star with outer ring. stroke #FBBF24
export function IconQuitDay365({ color = "#FBBF24", size = SZ }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Circle cx={7} cy={7} r={5.5} stroke={color} strokeWidth={STROKE} fill="none" />
      <Path d="M7 3.5l0.8 2.4h2.4l-2 1.4 0.8 2.4L7 8.1 4.8 9.7l0.8-2.4-2-1.4h2.4L7 3.5z" stroke={color} strokeWidth={STROKE} strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// Comeback — Circular return arrow. stroke #10B981
export function IconQuitComeback({ color = "#10B981", size = SZ }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path
        d="M10 4A5 5 0 1 0 10 10"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M10 4v3h3" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// Conquered — Circle with checkmark. stroke #10B981
export function IconQuitConquered({ color = "#10B981", size = SZ }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Circle cx={7} cy={7} r={5} stroke={color} strokeWidth={STROKE} fill="none" />
      <Path d="M4 7l2.5 2.5L10 5" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

const QUIT_ICON_MAP: Record<string, React.FC<{ color?: string; size?: number }>> = {
  day_1: IconQuitDay1,
  day_3: IconQuitDay3,
  day_7: IconQuitDay7,
  day_14: IconQuitDay14,
  day_30: IconQuitDay30,
  day_60: IconQuitDay60,
  day_90: IconQuitDay90,
  day_365: IconQuitDay365,
  comeback: IconQuitComeback,
  conquered: IconQuitConquered,
};

export function QuitMilestoneIcon({
  type,
  color = "#2D3146",
  size = SZ,
}: {
  type: string;
  color?: string;
  size?: number;
}) {
  const Icon = QUIT_ICON_MAP[type] ?? IconQuitDay1;
  return <Icon color={color} size={size} />;
}

export { SZ as QUIT_ICON_SIZE_ROW, SZ_MODAL as QUIT_ICON_SIZE_MODAL };
