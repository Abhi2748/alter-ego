/**
 * Level 10 — ALTER_EGO_Sigil_FullPage.html (The Eternal Flame). No root SVG pulse in HTML.
 */
import React from "react";
import Svg, { Circle, Line, Polygon, Ellipse } from "react-native-svg";
import { useAnimatedProps } from "react-native-reanimated";
import { useRotation, useHtmlBreatheR } from "./SigilAnimations";
import { useRotateCenterStyle } from "./rotateCenter";
import { AnimatedG, AnimatedCircle } from "./sigilSvg";
import { HtmlFlickerStrokeCircle } from "./sigilHtmlPrimitives";
import type { SigilProps } from "./sigilTypes";
import { SIGIL_VB } from "./sigilTypes";

const D10 = "170,18 180,42 170,66 160,42";
const D10_FILLS = [
  "white",
  "#FDE68A",
  "white",
  "#FCD34D",
  "white",
  "#FDE68A",
  "white",
  "#FCD34D",
  "white",
  "#FDE68A",
  "white",
  "#FCD34D",
] as const;

const ROSE_OUT: { rot: number; fill: string }[] = [
  { rot: 0, fill: "white" },
  { rot: 30, fill: "#FDE68A" },
  { rot: 60, fill: "white" },
  { rot: 90, fill: "#FBBF24" },
  { rot: 120, fill: "white" },
  { rot: 150, fill: "#FDE68A" },
  { rot: 180, fill: "white" },
  { rot: 210, fill: "#FBBF24" },
  { rot: 240, fill: "white" },
  { rot: 270, fill: "#FDE68A" },
  { rot: 300, fill: "white" },
  { rot: 330, fill: "#FBBF24" },
];

const ROSE_MID: { rot: number; fill: string }[] = [
  { rot: 15, fill: "#FDE68A" },
  { rot: 45, fill: "white" },
  { rot: 75, fill: "#FDE68A" },
  { rot: 105, fill: "white" },
  { rot: 135, fill: "#FDE68A" },
  { rot: 165, fill: "white" },
  { rot: 195, fill: "#FDE68A" },
  { rot: 225, fill: "white" },
  { rot: 255, fill: "#FDE68A" },
  { rot: 285, fill: "white" },
  { rot: 315, fill: "#FDE68A" },
  { rot: 345, fill: "white" },
];

const ROSE_IN: { rot: number; fill: string }[] = [
  { rot: 0, fill: "white" },
  { rot: 60, fill: "#FDE68A" },
  { rot: 120, fill: "white" },
  { rot: 180, fill: "#FDE68A" },
  { rot: 240, fill: "white" },
  { rot: 300, fill: "#FDE68A" },
];

function ray10(i: number): { sw: number; stroke: string } {
  const m = i % 8;
  if (m === 0 || m === 2 || m === 4 || m === 6) return { sw: 1.5, stroke: "white" };
  if (m === 1 || m === 5) return { sw: 1, stroke: "#FDE68A" };
  return { sw: 1, stroke: "#FCD34D" };
}

const rayLen10 = 170;

export function Sigil10({ size = 300 }: SigilProps) {
  const rRay = useRotation(90000, false);
  const rD = useRotation(14000, true);
  const rOut = useRotation(3500, false);
  const rMid = useRotation(5000, true);
  const rIn = useRotation(2500, false);

  const sr = useRotateCenterStyle(rRay);
  const sd = useRotateCenterStyle(rD);
  const ro = useRotateCenterStyle(rOut);
  const rm = useRotateCenterStyle(rMid);
  const ri = useRotateCenterStyle(rIn);

  const breathe44 = useHtmlBreatheR(44, 1500, 1.06);
  const ap44 = useAnimatedProps(() => ({ r: breathe44.value }));
  const breathe10 = useHtmlBreatheR(10, 1100, 1.06);
  const ap10 = useAnimatedProps(() => ({ r: breathe10.value }));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${SIGIL_VB} ${SIGIL_VB}`}>
      <HtmlFlickerStrokeCircle
        cx={170}
        cy={170}
        r={170}
        stroke="white"
        strokeWidth={0.5}
        fill="rgba(255,255,255,0.01)"
        fo={0.22}
        flickerMs={2000}
        delayMs={0}
      />
      <HtmlFlickerStrokeCircle
        cx={170}
        cy={170}
        r={158}
        stroke="#FDE68A"
        strokeWidth={0.5}
        fill="rgba(253,230,138,0.02)"
        fo={0.28}
        flickerMs={2000}
        delayMs={300}
      />
      <HtmlFlickerStrokeCircle
        cx={170}
        cy={170}
        r={144}
        stroke="white"
        strokeWidth={0.75}
        fill="rgba(255,255,255,0.02)"
        fo={0.33}
        flickerMs={2000}
        delayMs={600}
      />
      <HtmlFlickerStrokeCircle
        cx={170}
        cy={170}
        r={128}
        stroke="#FCD34D"
        strokeWidth={1}
        fill="rgba(252,211,77,0.03)"
        fo={0.38}
        flickerMs={2000}
        delayMs={900}
      />

      <AnimatedG style={sr}>
        {Array.from({ length: 48 }).map((_, i) => {
          const deg = i * 7.5;
          const { sw, stroke } = ray10(i);
          const rad = (deg * Math.PI) / 180;
          const x2 = 170 + rayLen10 * Math.sin(rad);
          const y2 = 170 - rayLen10 * Math.cos(rad);
          return (
            <Line
              key={deg}
              x1={170}
              y1={170}
              x2={x2}
              y2={y2}
              stroke={stroke}
              strokeWidth={sw}
              opacity={0.6}
            />
          );
        })}
      </AnimatedG>

      <AnimatedG style={sd}>
        {D10_FILLS.map((fill, i) => (
          <Polygon
            key={i}
            points={D10}
            fill={fill}
            transform={`rotate(${i * 30} 170 170)`}
            opacity={0.88}
          />
        ))}
      </AnimatedG>

      <AnimatedG style={ro}>
        {ROSE_OUT.map(({ rot, fill }) => (
          <Ellipse
            key={`o-${rot}`}
            cx={170}
            cy={112}
            rx={10}
            ry={54}
            fill={fill}
            opacity={0.75}
            transform={`rotate(${rot} 170 170)`}
          />
        ))}
      </AnimatedG>
      <AnimatedG style={rm}>
        {ROSE_MID.map(({ rot, fill }) => (
          <Ellipse
            key={`m-${rot}`}
            cx={170}
            cy={132}
            rx={7}
            ry={36}
            fill={fill}
            opacity={0.6}
            transform={`rotate(${rot} 170 170)`}
          />
        ))}
      </AnimatedG>
      <AnimatedG style={ri}>
        {ROSE_IN.map(({ rot, fill }) => (
          <Ellipse
            key={`i-${rot}`}
            cx={170}
            cy={148}
            rx={5}
            ry={20}
            fill={fill}
            opacity={0.7}
            transform={`rotate(${rot} 170 170)`}
          />
        ))}
      </AnimatedG>

      <AnimatedCircle
        cx={170}
        cy={170}
        fill="rgba(255,255,255,0.35)"
        stroke="white"
        strokeWidth={4}
        opacity={1}
        animatedProps={ap44}
      />
      <Circle cx={170} cy={170} r={28} fill="rgba(255,255,255,0.8)" />
      <Circle cx={170} cy={170} r={18} fill="white" />
      <AnimatedCircle cx={170} cy={170} fill="white" animatedProps={ap10} />
      <Circle cx={170} cy={170} r={4} fill="white" />
    </Svg>
  );
}
