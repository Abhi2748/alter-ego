/**
 * Level 1 — pixel-parallel to ALTER_EGO_Sigil_FullPage.html (The Ember).
 */
import React from "react";
import Svg, { Circle, Path } from "react-native-svg";
import { useAnimatedProps } from "react-native-reanimated";
import { useHtmlSvgPulse, useHtmlFlickerFo } from "./SigilAnimations";
import { AnimatedCircle, AnimatedG } from "./sigilSvg";
import { HtmlDustDot } from "./sigilHtmlPrimitives";
import type { SigilProps } from "./sigilTypes";
import { SIGIL_VB } from "./sigilTypes";

const L1_DUST: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  fo: number;
  durMs: number;
  delayMs: number;
}[] = [
  { cx: 170, cy: 170, r: 8, fill: "#334155", fo: 0.45, durMs: 7000, delayMs: 0 },
  { cx: 120, cy: 130, r: 5, fill: "#475569", fo: 0.32, durMs: 9000, delayMs: 1000 },
  { cx: 220, cy: 140, r: 4, fill: "#334155", fo: 0.28, durMs: 8000, delayMs: 2000 },
  { cx: 130, cy: 210, r: 6, fill: "#475569", fo: 0.38, durMs: 10000, delayMs: 500 },
  { cx: 230, cy: 205, r: 5, fill: "#334155", fo: 0.3, durMs: 7500, delayMs: 1500 },
  { cx: 170, cy: 95, r: 4, fill: "#475569", fo: 0.25, durMs: 11000, delayMs: 3000 },
  { cx: 95, cy: 170, r: 5, fill: "#334155", fo: 0.3, durMs: 8500, delayMs: 800 },
  { cx: 248, cy: 170, r: 4, fill: "#475569", fo: 0.25, durMs: 9500, delayMs: 2500 },
  { cx: 145, cy: 108, r: 3, fill: "#64748B", fo: 0.28, durMs: 12000, delayMs: 4000 },
  { cx: 200, cy: 235, r: 3, fill: "#64748B", fo: 0.22, durMs: 10000, delayMs: 1200 },
  { cx: 258, cy: 118, r: 3, fill: "#334155", fo: 0.2, durMs: 13000, delayMs: 5000 },
  { cx: 80, cy: 220, r: 3, fill: "#475569", fo: 0.2, durMs: 11000, delayMs: 3500 },
  { cx: 255, cy: 255, r: 4, fill: "#334155", fo: 0.18, durMs: 14000, delayMs: 6000 },
  { cx: 82, cy: 105, r: 3.5, fill: "#475569", fo: 0.22, durMs: 10000, delayMs: 2000 },
  { cx: 280, cy: 180, r: 2.5, fill: "#64748B", fo: 0.18, durMs: 12000, delayMs: 4500 },
  { cx: 62, cy: 160, r: 2.5, fill: "#64748B", fo: 0.18, durMs: 9000, delayMs: 3800 },
];

export function Sigil1({ size = 300 }: SigilProps) {
  const pulseStyle = useHtmlSvgPulse(6000);
  const sparkOp = useHtmlFlickerFo(5000, 0.7, 0);
  const sparkAp = useAnimatedProps(() => ({ opacity: sparkOp.value }));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${SIGIL_VB} ${SIGIL_VB}`}>
      <AnimatedG style={pulseStyle}>
        {L1_DUST.map((d, i) => (
          <HtmlDustDot key={i} {...d} />
        ))}
        <Path
          d="M120 170 Q170 120 220 170"
          stroke="#64748B"
          strokeWidth={1.25}
          fill="none"
          opacity={0.18}
          strokeDasharray="4 6"
        />
        <Path
          d="M120 170 Q170 220 220 170"
          stroke="#64748B"
          strokeWidth={1.25}
          fill="none"
          opacity={0.14}
          strokeDasharray="4 6"
        />
        <Path
          d="M140 140 Q170 170 200 200"
          stroke="#475569"
          strokeWidth={0.75}
          fill="none"
          opacity={0.12}
          strokeDasharray="3 7"
        />
        <Path
          d="M200 140 Q170 170 140 200"
          stroke="#475569"
          strokeWidth={0.75}
          fill="none"
          opacity={0.12}
          strokeDasharray="3 7"
        />
        <Circle
          cx={170}
          cy={170}
          r={120}
          fill="none"
          stroke="#334155"
          strokeWidth={0.75}
          opacity={0.1}
          strokeDasharray="2 10"
        />
        <Circle
          cx={170}
          cy={170}
          r={18}
          fill="rgba(51,65,85,0.5)"
          stroke="#475569"
          strokeWidth={1}
          opacity={0.6}
        />
        <Circle cx={170} cy={170} r={9} fill="#3F4F63" opacity={0.85} />
        <Circle cx={170} cy={170} r={4} fill="#64748B" />
        <AnimatedCircle cx={170} cy={170} r={1.5} fill="#94A3B8" animatedProps={sparkAp} />
      </AnimatedG>
    </Svg>
  );
}
