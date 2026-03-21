/**
 * Level 2 — ALTER_EGO_Sigil_FullPage.html (The Fracture)
 */
import React from "react";
import Svg, { Circle, Path } from "react-native-svg";
import { useAnimatedProps } from "react-native-reanimated";
import { useRotation, useHtmlSvgPulse, useHtmlFlickerFo } from "./SigilAnimations";
import { useRotateCenterStyle } from "./rotateCenter";
import { AnimatedG, AnimatedCircle } from "./sigilSvg";
import { HtmlFloatDot } from "./sigilHtmlPrimitives";
import type { SigilProps } from "./sigilTypes";
import { SIGIL_VB } from "./sigilTypes";

const L2_FLOAT: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  fo: number;
  durMs: number;
  delayMs: number;
}[] = [
  { cx: 112, cy: 106, r: 4, fill: "#60A5FA", fo: 0.28, durMs: 9000, delayMs: 0 },
  { cx: 234, cy: 108, r: 3, fill: "#93C5FD", fo: 0.25, durMs: 11000, delayMs: 1000 },
  { cx: 252, cy: 234, r: 4, fill: "#60A5FA", fo: 0.28, durMs: 8000, delayMs: 2000 },
  { cx: 90, cy: 240, r: 3, fill: "#93C5FD", fo: 0.22, durMs: 12000, delayMs: 500 },
  { cx: 170, cy: 60, r: 3, fill: "#60A5FA", fo: 0.25, durMs: 10000, delayMs: 3000 },
  { cx: 170, cy: 285, r: 3, fill: "#60A5FA", fo: 0.22, durMs: 10000, delayMs: 1500 },
  { cx: 60, cy: 170, r: 3.5, fill: "#93C5FD", fo: 0.22, durMs: 13000, delayMs: 4000 },
  { cx: 288, cy: 170, r: 3, fill: "#60A5FA", fo: 0.2, durMs: 11000, delayMs: 2500 },
];

export function Sigil2({ size = 300 }: SigilProps) {
  const pulseStyle = useHtmlSvgPulse(5000);
  const rotArms = useRotation(24000, false);
  const rotRing = useRotation(18000, true);
  const armsStyle = useRotateCenterStyle(rotArms);
  const ringStyle = useRotateCenterStyle(rotRing);
  const coreOp = useHtmlFlickerFo(3500, 1, 0);
  const coreAp = useAnimatedProps(() => ({ opacity: coreOp.value }));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${SIGIL_VB} ${SIGIL_VB}`}>
      <AnimatedG style={pulseStyle}>
        <Circle
          cx={170}
          cy={170}
          r={150}
          fill="none"
          stroke="#3B82F6"
          strokeWidth={0.75}
          opacity={0.12}
          strokeDasharray="2 9"
        />
        <AnimatedG style={armsStyle}>
          <Path
            d="M170 170 Q198 135 228 112 Q258 90 268 98 Q278 106 270 118 Q258 132 234 138 Q212 144 196 158 Q182 168 174 174"
            fill="none"
            stroke="#60A5FA"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.45}
          />
          <Path
            d="M170 170 Q142 205 112 228 Q82 250 72 242 Q62 234 70 222 Q82 208 106 202 Q128 196 144 182 Q158 172 166 166"
            fill="none"
            stroke="#60A5FA"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.4}
          />
          <Path
            d="M228 112 Q252 96 268 104"
            fill="none"
            stroke="#93C5FD"
            strokeWidth={1}
            strokeLinecap="round"
            opacity={0.3}
          />
          <Path
            d="M112 228 Q88 244 72 236"
            fill="none"
            stroke="#93C5FD"
            strokeWidth={1}
            strokeLinecap="round"
            opacity={0.25}
          />
        </AnimatedG>
        {L2_FLOAT.map((p, i) => (
          <HtmlFloatDot key={i} {...p} />
        ))}
        <AnimatedG style={ringStyle}>
          <Circle
            cx={170}
            cy={170}
            r={72}
            fill="none"
            stroke="#3B82F6"
            strokeWidth={1}
            opacity={0.22}
            strokeDasharray="5 7"
          />
        </AnimatedG>
        <Circle
          cx={170}
          cy={170}
          r={30}
          fill="rgba(59,130,246,0.12)"
          stroke="#60A5FA"
          strokeWidth={1.5}
          opacity={0.6}
        />
        <Circle cx={170} cy={170} r={16} fill="rgba(59,130,246,0.3)" opacity={0.85} />
        <Circle cx={170} cy={170} r={7} fill="#3B82F6" />
        <AnimatedCircle cx={170} cy={170} r={3} fill="#BFDBFE" animatedProps={coreAp} />
      </AnimatedG>
    </Svg>
  );
}
