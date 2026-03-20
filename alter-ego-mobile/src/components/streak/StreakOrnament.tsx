/**
 * Ornament SVGs ported from ALTER_EGO_StreakAnimation.html buildOrnament()
 */
import React from "react";
import Svg, {
  Circle,
  Line,
  Polygon,
  G,
} from "react-native-svg";
import type { StreakOrnamentType, StreakVisualTier } from "@/constants/streakAnimationTiers";

type Props = {
  type: StreakOrnamentType;
  tier: StreakVisualTier;
};

export function StreakOrnament({ type, tier }: Props) {
  const c = tier.ringColor;
  const ic = tier.ringInnerColor;

  switch (type) {
    case "ticks_30": {
      const size = 260;
      const r = size / 2 - 4;
      const dashGap = (2 * Math.PI * r) / 30 - 1;
      const ticks: React.ReactNode[] = [];
      for (let i = 0; i < 30; i++) {
        const angle = (i / 30) * 2 * Math.PI - Math.PI / 2;
        const isMajor = i % 5 === 0;
        const r1 = size / 2 - 6;
        const r2 = isMajor ? size / 2 - 14 : size / 2 - 10;
        const x1 = size / 2 + r1 * Math.cos(angle);
        const y1 = size / 2 + r1 * Math.sin(angle);
        const x2 = size / 2 + r2 * Math.cos(angle);
        const y2 = size / 2 + r2 * Math.sin(angle);
        ticks.push(
          <Line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={c}
            strokeWidth={isMajor ? 1.2 : 0.7}
            strokeLinecap="round"
            opacity={isMajor ? 0.8 : 0.5}
          />
        );
      }
      return (
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={c}
            strokeWidth={0.5}
            strokeDasharray={`1 ${Math.max(0.5, dashGap)}`}
          />
          <G>{ticks}</G>
        </Svg>
      );
    }
    case "double_ring": {
      const size = 280;
      const dots: React.ReactNode[] = [];
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * 2 * Math.PI - Math.PI / 2;
        const r = size / 2 - 10;
        const sx = size / 2 + r * Math.cos(a);
        const sy = size / 2 + r * Math.sin(a);
        dots.push(
          <Circle
            key={i}
            cx={sx}
            cy={sy}
            r={i % 9 === 0 ? 2 : 0.8}
            fill={c}
            opacity={i % 9 === 0 ? 0.7 : 0.3}
          />
        );
      }
      return (
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 6}
            fill="none"
            stroke={c}
            strokeWidth={0.8}
            opacity={0.6}
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 16}
            fill="none"
            stroke={c}
            strokeWidth={0.5}
            strokeDasharray="4 8"
            opacity={0.4}
          />
          <G>{dots}</G>
        </Svg>
      );
    }
    case "triple_ring": {
      const size = 300;
      const tickLines: React.ReactNode[] = [];
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * 2 * Math.PI - Math.PI / 2;
        const isM = i % 5 === 0;
        const isQ = i % 15 === 0;
        const r1 = size / 2 - 5;
        const r2 = size / 2 - (isQ ? 20 : isM ? 14 : 9);
        tickLines.push(
          <Line
            key={i}
            x1={size / 2 + r1 * Math.cos(a)}
            y1={size / 2 + r1 * Math.sin(a)}
            x2={size / 2 + r2 * Math.cos(a)}
            y2={size / 2 + r2 * Math.sin(a)}
            stroke={c}
            strokeWidth={isQ ? 1.5 : isM ? 1 : 0.6}
            strokeLinecap="round"
            opacity={isQ ? 0.9 : isM ? 0.6 : 0.35}
          />
        );
      }
      return (
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 5}
            fill="none"
            stroke={c}
            strokeWidth={1}
            opacity={0.7}
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 18}
            fill="none"
            stroke={c}
            strokeWidth={0.6}
            opacity={0.4}
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 28}
            fill="none"
            stroke={ic}
            strokeWidth={0.5}
            strokeDasharray="2 6"
            opacity={0.3}
          />
          <G>{tickLines}</G>
        </Svg>
      );
    }
    case "star_compass": {
      const size = 320;
      const cx = size / 2;
      const cy = size / 2;
      const r = size / 2 - 8;
      const star = (x: number, y: number, s: number, rot: number) => {
        const pts: string[] = [];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * 2 * Math.PI + rot;
          const ri = i % 2 === 0 ? s : s * 0.45;
          pts.push(`${x + ri * Math.cos(a)},${y + ri * Math.sin(a)}`);
        }
        return <Polygon points={pts.join(" ")} fill={c} opacity={0.7} />;
      };
      return (
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth={0.8} opacity={0.6} />
          <Circle
            cx={cx}
            cy={cy}
            r={r - 12}
            fill="none"
            stroke={c}
            strokeWidth={0.5}
            strokeDasharray="3 9"
            opacity={0.35}
          />
          {star(cx, cy - r + 5, 8, -Math.PI / 2)}
          {star(cx, cy + r - 5, 8, Math.PI / 2)}
          {star(cx - r + 5, cy, 8, Math.PI)}
          {star(cx + r - 5, cy, 8, 0)}
          {star(cx + 0.707 * (r - 8), cy - 0.707 * (r - 8), 4, -Math.PI / 4)}
          {star(cx + 0.707 * (r - 8), cy + 0.707 * (r - 8), 4, Math.PI / 4)}
          {star(cx - 0.707 * (r - 8), cy - 0.707 * (r - 8), 4, (-3 * Math.PI) / 4)}
          {star(cx - 0.707 * (r - 8), cy + 0.707 * (r - 8), 4, (3 * Math.PI) / 4)}
          <Line x1={cx} y1={cy - r + 16} x2={cx} y2={cy + r - 16} stroke={c} strokeWidth={0.4} opacity={0.2} />
          <Line x1={cx - r + 16} y1={cy} x2={cx + r - 16} y2={cy} stroke={c} strokeWidth={0.4} opacity={0.2} />
        </Svg>
      );
    }
    case "sun_rose": {
      const size = 340;
      const cx = size / 2;
      const cy = size / 2;
      const rc = tier.ringColor;
      const rays: React.ReactNode[] = [];
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * 2 * Math.PI - Math.PI / 2;
        const isMajor = i % 6 === 0;
        const isMed = i % 3 === 0;
        const r1 = isMajor ? size / 2 - 5 : isMed ? size / 2 - 8 : size / 2 - 10;
        const r2 = isMajor ? size / 2 - 22 : isMed ? size / 2 - 18 : size / 2 - 14;
        rays.push(
          <Line
            key={i}
            x1={cx + r1 * Math.cos(a)}
            y1={cy + r1 * Math.sin(a)}
            x2={cx + r2 * Math.cos(a)}
            y2={cy + r2 * Math.sin(a)}
            stroke={rc}
            strokeWidth={isMajor ? 2 : isMed ? 1.2 : 0.6}
            strokeLinecap="round"
            opacity={isMajor ? 0.9 : isMed ? 0.6 : 0.35}
          />
        );
      }
      const arrow = (angleDeg: number, len: number) => {
        const a = (angleDeg * Math.PI) / 180 - Math.PI / 2;
        const rr = size / 2 - 4;
        const tx = cx + rr * Math.cos(a);
        const ty = cy + rr * Math.sin(a);
        const bx = cx + (rr - len) * Math.cos(a);
        const by = cy + (rr - len) * Math.sin(a);
        const lx = cx + (rr - len * 0.6) * Math.cos(a - 0.3);
        const ly = cy + (rr - len * 0.6) * Math.sin(a - 0.3);
        const rx2 = cx + (rr - len * 0.6) * Math.cos(a + 0.3);
        const ry2 = cy + (rr - len * 0.6) * Math.sin(a + 0.3);
        return (
          <Polygon
            points={`${tx},${ty} ${lx},${ly} ${bx},${by} ${rx2},${ry2}`}
            fill={rc}
            opacity={0.8}
          />
        );
      };
      return (
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={cx} cy={cy} r={size / 2 - 4} fill="none" stroke={rc} strokeWidth={1} opacity={0.65} />
          <Circle cx={cx} cy={cy} r={size / 2 - 20} fill="none" stroke={rc} strokeWidth={0.5} opacity={0.3} />
          <G>{rays}</G>
          {arrow(0, 24)}
          {arrow(90, 24)}
          {arrow(180, 24)}
          {arrow(270, 24)}
          {arrow(45, 14)}
          {arrow(135, 14)}
          {arrow(225, 14)}
          {arrow(315, 14)}
          <Circle cx={cx} cy={cy} r={6} fill="none" stroke={rc} strokeWidth={1.5} opacity={0.6} />
          <Circle cx={cx} cy={cy} r={2} fill={rc} opacity={0.5} />
        </Svg>
      );
    }
    default:
      return null;
  }
}
