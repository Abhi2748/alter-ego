/**
 * Level 3 — ALTER_EGO_Sigil_FullPage.html (The Current)
 */
import React from "react";
import Svg, { Circle, Path } from "react-native-svg";
import { useAnimatedProps } from "react-native-reanimated";
import {
  useRotation,
  useHtmlSvgPulse,
  useHtmlFlickerFo,
  useHtmlBreatheR,
} from "./SigilAnimations";
import { useRotateCenterStyle } from "./rotateCenter";
import { AnimatedG, AnimatedCircle, AnimatedEllipse } from "./sigilSvg";
import { HtmlFloatDot } from "./sigilHtmlPrimitives";
import type { SigilProps } from "./sigilTypes";
import { SIGIL_VB } from "./sigilTypes";

const L3_FLOAT = [
  { cx: 96, cy: 96, r: 4, fill: "#2DD4BF", fo: 0.32, durMs: 8000, delayMs: 0 },
  { cx: 248, cy: 96, r: 3.5, fill: "#5EEAD4", fo: 0.28, durMs: 10000, delayMs: 1000 },
  { cx: 252, cy: 252, r: 4, fill: "#2DD4BF", fo: 0.3, durMs: 9000, delayMs: 2000 },
  { cx: 92, cy: 255, r: 3, fill: "#5EEAD4", fo: 0.25, durMs: 11000, delayMs: 500 },
] as const;

const ROSE12: { rot: number; fill: string }[] = [
  { rot: 0, fill: "#2DD4BF" },
  { rot: 30, fill: "#5EEAD4" },
  { rot: 60, fill: "#2DD4BF" },
  { rot: 90, fill: "#5EEAD4" },
  { rot: 120, fill: "#2DD4BF" },
  { rot: 150, fill: "#5EEAD4" },
  { rot: 180, fill: "#2DD4BF" },
  { rot: 210, fill: "#5EEAD4" },
  { rot: 240, fill: "#2DD4BF" },
  { rot: 270, fill: "#5EEAD4" },
  { rot: 300, fill: "#2DD4BF" },
  { rot: 330, fill: "#5EEAD4" },
];

export function Sigil3({ size = 300 }: SigilProps) {
  const pulseStyle = useHtmlSvgPulse(4000);
  const rotGalaxy = useRotation(28000, false);
  const rotInner = useRotation(16000, true);
  const rotOrbit = useRotation(20000, false);
  const g1 = useRotateCenterStyle(rotGalaxy);
  const g2 = useRotateCenterStyle(rotInner);
  const g3 = useRotateCenterStyle(rotOrbit);

  const breatheR = useHtmlBreatheR(36, 3000, 1.06);
  const breatheAp = useAnimatedProps(() => ({ r: breatheR.value }));
  const flickOp = useHtmlFlickerFo(2500, 1, 0);
  const flickAp = useAnimatedProps(() => ({ opacity: flickOp.value }));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${SIGIL_VB} ${SIGIL_VB}`}>
      <AnimatedG style={pulseStyle}>
        <Circle
          cx={170}
          cy={170}
          r={152}
          fill="none"
          stroke="#0D9488"
          strokeWidth={0.75}
          opacity={0.15}
          strokeDasharray="3 9"
        />
        <AnimatedG style={g1}>
          <Path
            d="M170 170 Q198 128 232 108 Q266 88 278 96 Q290 104 278 120 Q264 136 238 142 Q214 148 196 162 Q182 172 174 176"
            fill="none"
            stroke="#2DD4BF"
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.55}
          />
          <Path
            d="M170 170 Q142 212 108 232 Q74 252 62 244 Q50 236 62 220 Q76 204 102 198 Q126 192 144 178 Q158 168 166 164"
            fill="none"
            stroke="#2DD4BF"
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.55}
          />
          <Path
            d="M170 170 Q212 198 232 232 Q252 266 244 278 Q236 290 220 278 Q204 264 198 238 Q192 214 178 196 Q168 182 164 174"
            fill="none"
            stroke="#14B8A6"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.45}
          />
          <Path
            d="M170 170 Q128 142 108 108 Q88 74 96 62 Q104 50 120 62 Q136 76 142 102 Q148 126 162 144 Q172 158 176 166"
            fill="none"
            stroke="#14B8A6"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.45}
          />
        </AnimatedG>
        <AnimatedG style={g2}>
          <Circle
            cx={170}
            cy={170}
            r={80}
            fill="none"
            stroke="#2DD4BF"
            strokeWidth={1.5}
            opacity={0.3}
            strokeDasharray="6 5"
          />
        </AnimatedG>
        <AnimatedG style={g3}>
          {ROSE12.map(({ rot, fill }) => (
            <Circle
              key={rot}
              cx={170}
              cy={70}
              r={5}
              fill={fill}
              opacity={fill === "#2DD4BF" ? 0.55 : 0.5}
              transform={`rotate(${rot} 170 170)`}
            />
          ))}
        </AnimatedG>
        {L3_FLOAT.map((p, i) => (
          <HtmlFloatDot key={i} {...p} />
        ))}
        <AnimatedCircle
          cx={170}
          cy={170}
          fill="rgba(20,184,166,0.12)"
          stroke="#2DD4BF"
          strokeWidth={2}
          opacity={0.6}
          animatedProps={breatheAp}
        />
        <Circle cx={170} cy={170} r={20} fill="rgba(20,184,166,0.3)" />
        <Circle cx={170} cy={170} r={11} fill="#0D9488" />
        <Circle cx={170} cy={170} r={5} fill="#2DD4BF" />
        <AnimatedCircle cx={170} cy={170} r={2} fill="#CCFBF1" animatedProps={flickAp} />
      </AnimatedG>
    </Svg>
  );
}
