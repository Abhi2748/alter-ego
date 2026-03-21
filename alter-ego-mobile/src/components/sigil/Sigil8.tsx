/**
 * Level 8 — ALTER_EGO_Sigil_FullPage.html (The Ascendancy)
 */
import React from "react";
import Svg, { Circle, Line, Path, Ellipse } from "react-native-svg";
import { useAnimatedProps } from "react-native-reanimated";
import {
  useRotation,
  useHtmlSvgPulseS,
  useHtmlFlickerFo,
  useHtmlBreatheR,
} from "./SigilAnimations";
import { useRotateCenterStyle } from "./rotateCenter";
import { AnimatedG, AnimatedCircle } from "./sigilSvg";
import { HtmlFlickerStrokeCircle } from "./sigilHtmlPrimitives";
import type { SigilProps } from "./sigilTypes";
import { SIGIL_VB } from "./sigilTypes";

const ARCS = [
  "M170 80 Q240 50 260 100 Q280 150 240 175 Q220 188 200 178",
  "M170 80 Q100 50 80 100 Q60 150 100 175 Q120 188 140 178",
  "M170 260 Q240 290 260 240 Q280 190 240 165 Q220 152 200 162",
  "M170 260 Q100 290 80 240 Q60 190 100 165 Q120 152 140 162",
] as const;

const RAY24: { deg: number; sw: number; stroke: string }[] = Array.from({ length: 24 }, (_, i) => {
  const deg = i * 15;
  const mod = i % 4;
  if (mod === 0) return { deg, sw: 1.5, stroke: "#FB7185" };
  if (mod === 1) return { deg, sw: 1, stroke: "#F43F5E" };
  if (mod === 2) return { deg, sw: 1.5, stroke: "#FB7185" };
  return { deg, sw: 1, stroke: "#FBBF24" };
});

const ROSE12: { rot: number; fill: string }[] = [
  { rot: 0, fill: "#FB7185" },
  { rot: 30, fill: "#FBBF24" },
  { rot: 60, fill: "#FB7185" },
  { rot: 90, fill: "#F43F5E" },
  { rot: 120, fill: "#FB7185" },
  { rot: 150, fill: "#FBBF24" },
  { rot: 180, fill: "#FB7185" },
  { rot: 210, fill: "#F43F5E" },
  { rot: 240, fill: "#FB7185" },
  { rot: 270, fill: "#FBBF24" },
  { rot: 300, fill: "#FB7185" },
  { rot: 330, fill: "#F43F5E" },
];

const rayLen = 158;

export function Sigil8({ size = 300 }: SigilProps) {
  const pulseStyle = useHtmlSvgPulseS(2200);
  const rA1 = useRotation(30000, false);
  const rA2 = useRotation(22000, true);
  const rRay = useRotation(40000, false);
  const rRose = useRotation(7000, true);
  const rOrb = useRotation(9000, false);

  const a1 = useRotateCenterStyle(rA1);
  const a2 = useRotateCenterStyle(rA2);
  const ry = useRotateCenterStyle(rRay);
  const rz = useRotateCenterStyle(rRose);
  const ro = useRotateCenterStyle(rOrb);

  const coreB = useHtmlBreatheR(38, 1900, 1.06);
  const coreAp = useAnimatedProps(() => ({ r: coreB.value }));
  const flickOp = useHtmlFlickerFo(1500, 1, 0);
  const flickAp = useAnimatedProps(() => ({ opacity: flickOp.value }));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${SIGIL_VB} ${SIGIL_VB}`}>
      <AnimatedG style={pulseStyle}>
        <HtmlFlickerStrokeCircle
          cx={170}
          cy={170}
          r={156}
          stroke="#FB7185"
          strokeWidth={0.75}
          fo={0.18}
          flickerMs={3000}
          delayMs={0}
        />
        <HtmlFlickerStrokeCircle
          cx={170}
          cy={170}
          r={140}
          stroke="#F43F5E"
          strokeWidth={1}
          fo={0.22}
          flickerMs={3000}
          delayMs={400}
        />

        <AnimatedG style={a1}>
          {ARCS.map((d) => (
            <Path
              key={d}
              d={d}
              fill="none"
              stroke="#FB7185"
              strokeWidth={2.5}
              strokeLinecap="round"
              opacity={0.55}
            />
          ))}
        </AnimatedG>
        <AnimatedG style={a2}>
          {ARCS.map((d) => (
            <Path
              key={`g-${d}`}
              d={d}
              fill="none"
              stroke="#FBBF24"
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.45}
              transform="rotate(45 170 170)"
            />
          ))}
        </AnimatedG>

        <AnimatedG style={ry}>
          {RAY24.map(({ deg, sw, stroke }) => {
            const rad = (deg * Math.PI) / 180;
            const x2 = 170 + rayLen * Math.sin(rad);
            const y2 = 170 - rayLen * Math.cos(rad);
            return (
              <Line
                key={deg}
                x1={170}
                y1={170}
                x2={x2}
                y2={y2}
                stroke={stroke}
                strokeWidth={sw}
                opacity={0.38}
              />
            );
          })}
        </AnimatedG>

        <AnimatedG style={rz}>
          {ROSE12.map(({ rot, fill }) => (
            <Ellipse
              key={rot}
              cx={170}
              cy={120}
              rx={9}
              ry={46}
              fill={fill}
              opacity={0.68}
              transform={`rotate(${rot} 170 170)`}
            />
          ))}
        </AnimatedG>

        <AnimatedG style={ro}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
            <Circle
              key={deg}
              cx={170}
              cy={72}
              r={8}
              fill={i % 2 === 0 ? "#FB7185" : "#FBBF24"}
              opacity={i % 2 === 0 ? 0.88 : 0.8}
              transform={`rotate(${deg} 170 170)`}
            />
          ))}
        </AnimatedG>

        <AnimatedCircle
          cx={170}
          cy={170}
          fill="rgba(251,113,133,0.28)"
          stroke="#FBBF24"
          strokeWidth={3}
          opacity={0.95}
          animatedProps={coreAp}
        />
        <Circle cx={170} cy={170} r={22} fill="#9F1239" />
        <Circle cx={170} cy={170} r={12} fill="#FB7185" />
        <Circle cx={170} cy={170} r={6} fill="#FEF3C7" />
        <AnimatedCircle cx={170} cy={170} r={2.5} fill="white" animatedProps={flickAp} />
      </AnimatedG>
    </Svg>
  );
}
