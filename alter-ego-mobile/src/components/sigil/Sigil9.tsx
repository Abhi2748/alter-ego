/**
 * Level 9 — ALTER_EGO_Sigil_FullPage.html (The Absolute)
 */
import React from "react";
import Svg, { Circle, Line, Polygon, Ellipse } from "react-native-svg";
import { useAnimatedProps } from "react-native-reanimated";
import {
  useRotation,
  useHtmlSvgPulseS,
  useHtmlBreatheR,
} from "./SigilAnimations";
import { useRotateCenterStyle } from "./rotateCenter";
import { AnimatedG, AnimatedCircle } from "./sigilSvg";
import { HtmlFlickerStrokeCircle } from "./sigilHtmlPrimitives";
import type { SigilProps } from "./sigilTypes";
import { SIGIL_VB } from "./sigilTypes";

const D9 = "170,22 178,40 170,58 162,40";
const D9_FILLS = [
  "#FDE68A",
  "#FBBF24",
  "#FDE68A",
  "#FEF3C7",
  "#FDE68A",
  "#FBBF24",
  "#FDE68A",
  "#FEF3C7",
  "#FDE68A",
  "#FBBF24",
  "#FDE68A",
  "#FEF3C7",
] as const;

const ROSE12: { rot: number; fill: string }[] = [
  { rot: 0, fill: "#FDE68A" },
  { rot: 30, fill: "#FBBF24" },
  { rot: 60, fill: "#FDE68A" },
  { rot: 90, fill: "#FEF3C7" },
  { rot: 120, fill: "#FDE68A" },
  { rot: 150, fill: "#FBBF24" },
  { rot: 180, fill: "#FDE68A" },
  { rot: 210, fill: "#F59E0B" },
  { rot: 240, fill: "#FDE68A" },
  { rot: 270, fill: "#FBBF24" },
  { rot: 300, fill: "#FDE68A" },
  { rot: 330, fill: "#FEF3C7" },
];

const INNER6: { rot: number; fill: string }[] = [
  { rot: 0, fill: "#FFFBEB" },
  { rot: 60, fill: "#FDE68A" },
  { rot: 120, fill: "#FFFBEB" },
  { rot: 180, fill: "#FDE68A" },
  { rot: 240, fill: "#FFFBEB" },
  { rot: 300, fill: "#FDE68A" },
];

function ray9(i: number): { sw: number; stroke: string } {
  const m = i % 6;
  if (m === 0 || m === 2 || m === 4) return { sw: 1.5, stroke: "#FDE68A" };
  if (m === 1) return { sw: 1, stroke: "#FCD34D" };
  if (m === 3) return { sw: 1, stroke: "#FBBF24" };
  return { sw: 1, stroke: "#F59E0B" };
}

const rayLen9 = 165;

export function Sigil9({ size = 300 }: SigilProps) {
  const pulseStyle = useHtmlSvgPulseS(1900);
  const rRay = useRotation(55000, false);
  const rD = useRotation(20000, true);
  const rRose = useRotation(5500, true);
  const rIn = useRotation(3500, false);

  const sr = useRotateCenterStyle(rRay);
  const sd = useRotateCenterStyle(rD);
  const srose = useRotateCenterStyle(rRose);
  const sin = useRotateCenterStyle(rIn);

  const breathe40 = useHtmlBreatheR(40, 1700, 1.06);
  const ap40 = useAnimatedProps(() => ({ r: breathe40.value }));
  const breathe7 = useHtmlBreatheR(7, 1300, 1.06);
  const ap7 = useAnimatedProps(() => ({ r: breathe7.value }));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${SIGIL_VB} ${SIGIL_VB}`}>
      <AnimatedG style={pulseStyle}>
        <Circle
          cx={170}
          cy={170}
          r={168}
          fill="rgba(253,230,138,0.015)"
          stroke="#FDE68A"
          strokeWidth={0.5}
          opacity={0.25}
        />
        <Circle
          cx={170}
          cy={170}
          r={155}
          fill="rgba(252,211,77,0.02)"
          stroke="#FCD34D"
          strokeWidth={0.75}
          opacity={0.3}
        />
        <Circle
          cx={170}
          cy={170}
          r={142}
          fill="rgba(251,191,36,0.02)"
          stroke="#FBBF24"
          strokeWidth={1}
          opacity={0.35}
        />
        <HtmlFlickerStrokeCircle
          cx={170}
          cy={170}
          r={126}
          stroke="#FDE68A"
          strokeWidth={1.25}
          fo={0.4}
          flickerMs={2500}
          delayMs={0}
        />
        <HtmlFlickerStrokeCircle
          cx={170}
          cy={170}
          r={108}
          stroke="#F59E0B"
          strokeWidth={1.5}
          fo={0.45}
          flickerMs={2500}
          delayMs={400}
        />

        <AnimatedG style={sr}>
          {Array.from({ length: 36 }).map((_, i) => {
            const deg = i * 10;
            const { sw, stroke } = ray9(i);
            const rad = (deg * Math.PI) / 180;
            const x2 = 170 + rayLen9 * Math.sin(rad);
            const y2 = 170 - rayLen9 * Math.cos(rad);
            return (
              <Line
                key={deg}
                x1={170}
                y1={170}
                x2={x2}
                y2={y2}
                stroke={stroke}
                strokeWidth={sw}
                opacity={0.5}
              />
            );
          })}
        </AnimatedG>

        <AnimatedG style={sd}>
          {D9_FILLS.map((fill, i) => (
            <Polygon
              key={i}
              points={D9}
              fill={fill}
              transform={`rotate(${i * 30} 170 170)`}
              opacity={0.8}
            />
          ))}
        </AnimatedG>

        <AnimatedG style={srose}>
          {ROSE12.map(({ rot, fill }) => (
            <Ellipse
              key={rot}
              cx={170}
              cy={118}
              rx={9}
              ry={48}
              fill={fill}
              opacity={0.72}
              transform={`rotate(${rot} 170 170)`}
            />
          ))}
        </AnimatedG>

        <AnimatedG style={sin}>
          {INNER6.map(({ rot, fill }) => (
            <Ellipse
              key={rot}
              cx={170}
              cy={138}
              rx={6}
              ry={28}
              fill={fill}
              opacity={0.65}
              transform={`rotate(${rot} 170 170)`}
            />
          ))}
        </AnimatedG>

        <AnimatedCircle
          cx={170}
          cy={170}
          fill="rgba(253,230,138,0.35)"
          stroke="#FFFBEB"
          strokeWidth={3}
          opacity={0.97}
          animatedProps={ap40}
        />
        <Circle cx={170} cy={170} r={24} fill="#92400E" />
        <Circle cx={170} cy={170} r={14} fill="#FDE68A" />
        <AnimatedCircle cx={170} cy={170} fill="#FFFBEB" animatedProps={ap7} />
        <Circle cx={170} cy={170} r={3} fill="white" />
      </AnimatedG>
    </Svg>
  );
}
