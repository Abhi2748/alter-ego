/**
 * Level 7 — ALTER_EGO_Sigil_FullPage.html (The Dominion)
 */
import React from "react";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
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

const BOLT = "M170 170 L176 128 L171 128 L178 86";
const BOLT_STROKES: { rot: number; sw: number; stroke: string }[] = [
  { rot: 0, sw: 1.5, stroke: "#E879F9" },
  { rot: 30, sw: 1.25, stroke: "#F0ABFC" },
  { rot: 60, sw: 1.5, stroke: "#E879F9" },
  { rot: 90, sw: 1.25, stroke: "#D946EF" },
  { rot: 120, sw: 1.5, stroke: "#E879F9" },
  { rot: 150, sw: 1.25, stroke: "#F0ABFC" },
  { rot: 180, sw: 1.5, stroke: "#E879F9" },
  { rot: 210, sw: 1.25, stroke: "#D946EF" },
  { rot: 240, sw: 1.5, stroke: "#E879F9" },
  { rot: 270, sw: 1.25, stroke: "#F0ABFC" },
  { rot: 300, sw: 1.5, stroke: "#E879F9" },
  { rot: 330, sw: 1.25, stroke: "#D946EF" },
];

const OUT8: { rot: number; fill: string }[] = [
  { rot: 0, fill: "#D946EF" },
  { rot: 45, fill: "#C084FC" },
  { rot: 90, fill: "#D946EF" },
  { rot: 135, fill: "#C084FC" },
  { rot: 180, fill: "#D946EF" },
  { rot: 225, fill: "#C084FC" },
  { rot: 270, fill: "#D946EF" },
  { rot: 315, fill: "#C084FC" },
];

const IN12: { rot: number; fill: string }[] = [
  { rot: 0, fill: "#E879F9" },
  { rot: 30, fill: "#C084FC" },
  { rot: 60, fill: "#E879F9" },
  { rot: 90, fill: "#A78BFA" },
  { rot: 120, fill: "#E879F9" },
  { rot: 150, fill: "#C084FC" },
  { rot: 180, fill: "#E879F9" },
  { rot: 210, fill: "#A78BFA" },
  { rot: 240, fill: "#E879F9" },
  { rot: 270, fill: "#C084FC" },
  { rot: 300, fill: "#E879F9" },
  { rot: 330, fill: "#A78BFA" },
];

const SHOCK = [
  { r: 158, sw: 0.75, stroke: "#E879F9", fo: 0.15, delay: 0 },
  { r: 145, sw: 1, stroke: "#C084FC", fo: 0.2, delay: 500 },
  { r: 130, sw: 1.25, stroke: "#E879F9", fo: 0.26, delay: 1000 },
  { r: 112, sw: 1.5, stroke: "#A78BFA", fo: 0.32, delay: 1500 },
  { r: 92, sw: 2, stroke: "#E879F9", fo: 0.38, delay: 2000 },
] as const;

export function Sigil7({ size = 300 }: SigilProps) {
  const pulseStyle = useHtmlSvgPulseS(2500);
  const rBolt = useRotation(25000, true);
  const rOut = useRotation(18000, false);
  const rIn = useRotation(8000, true);
  const rOrb = useRotation(12000, false);

  const sb = useRotateCenterStyle(rBolt);
  const so = useRotateCenterStyle(rOut);
  const si = useRotateCenterStyle(rIn);
  const sor = useRotateCenterStyle(rOrb);

  const coreB = useHtmlBreatheR(38, 2000, 1.06);
  const coreAp = useAnimatedProps(() => ({ r: coreB.value }));
  const flickOp = useHtmlFlickerFo(1600, 1, 0);
  const flickAp = useAnimatedProps(() => ({ opacity: flickOp.value }));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${SIGIL_VB} ${SIGIL_VB}`}>
      <AnimatedG style={pulseStyle}>
        {SHOCK.map((s) => (
          <HtmlFlickerStrokeCircle
            key={s.r}
            cx={170}
            cy={170}
            r={s.r}
            stroke={s.stroke}
            strokeWidth={s.sw}
            fo={s.fo}
            flickerMs={3000}
            delayMs={s.delay}
          />
        ))}

        <AnimatedG style={sb}>
          {BOLT_STROKES.map(({ rot, sw, stroke }) => (
            <Path
              key={rot}
              d={BOLT}
              stroke={stroke}
              strokeWidth={sw}
              fill="none"
              strokeLinecap="round"
              transform={`rotate(${rot} 170 170)`}
              opacity={0.6}
            />
          ))}
        </AnimatedG>

        <AnimatedG style={so}>
          {OUT8.map(({ rot, fill }) => (
            <Ellipse
              key={rot}
              cx={170}
              cy={82}
              rx={14}
              ry={82}
              fill={fill}
              opacity={0.5}
              transform={`rotate(${rot} 170 170)`}
            />
          ))}
        </AnimatedG>

        <AnimatedG style={si}>
          {IN12.map(({ rot, fill }) => (
            <Ellipse
              key={rot}
              cx={170}
              cy={116}
              rx={8}
              ry={50}
              fill={fill}
              opacity={0.7}
              transform={`rotate(${rot} 170 170)`}
            />
          ))}
        </AnimatedG>

        <AnimatedG style={sor}>
          {[0, 60, 120, 180, 240, 300].map((deg, i) => (
            <Circle
              key={deg}
              cx={170}
              cy={66}
              r={9}
              fill={i % 2 === 0 ? "#E879F9" : "#C084FC"}
              opacity={i % 2 === 0 ? 0.85 : 0.8}
              transform={`rotate(${deg} 170 170)`}
            />
          ))}
        </AnimatedG>

        <AnimatedCircle
          cx={170}
          cy={170}
          fill="rgba(217,70,239,0.28)"
          stroke="#E879F9"
          strokeWidth={3}
          opacity={0.94}
          animatedProps={coreAp}
        />
        <Circle cx={170} cy={170} r={22} fill="#86198F" />
        <Circle cx={170} cy={170} r={12} fill="#E879F9" />
        <Circle cx={170} cy={170} r={5.5} fill="#FAE8FF" />
        <AnimatedCircle cx={170} cy={170} r={2.2} fill="white" animatedProps={flickAp} />
      </AnimatedG>
    </Svg>
  );
}
