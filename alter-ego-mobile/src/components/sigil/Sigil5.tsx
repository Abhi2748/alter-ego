/**
 * Level 5 — ALTER_EGO_Sigil_FullPage.html (The Convergence)
 */
import React from "react";
import Svg, { Circle, Line, Polygon, Ellipse } from "react-native-svg";
import { useAnimatedProps } from "react-native-reanimated";
import {
  useRotation,
  useHtmlSvgPulseS,
  useHtmlFlickerFo,
  useHtmlBreatheR,
} from "./SigilAnimations";
import { useRotateCenterStyle } from "./rotateCenter";
import { AnimatedG, AnimatedCircle } from "./sigilSvg";
import type { SigilProps } from "./sigilTypes";
import { SIGIL_VB } from "./sigilTypes";

const DIAMOND = "170,28 178,42 170,56 162,42";
const STAR8 = "170,60 200,140 280,170 200,200 170,280 140,200 60,170 140,140";

const ROSE12: { rot: number; fill: string }[] = [
  { rot: 0, fill: "#8B5CF6" },
  { rot: 30, fill: "#7C3AED" },
  { rot: 60, fill: "#A78BFA" },
  { rot: 90, fill: "#8B5CF6" },
  { rot: 120, fill: "#7C3AED" },
  { rot: 150, fill: "#A78BFA" },
  { rot: 180, fill: "#8B5CF6" },
  { rot: 210, fill: "#7C3AED" },
  { rot: 240, fill: "#A78BFA" },
  { rot: 270, fill: "#8B5CF6" },
  { rot: 300, fill: "#7C3AED" },
  { rot: 330, fill: "#A78BFA" },
];

export function Sigil5({ size = 300 }: SigilProps) {
  const pulseStyle = useHtmlSvgPulseS(3000);
  const rotRays = useRotation(45000, false);
  const rotDiamonds = useRotation(30000, true);
  const rotStarA = useRotation(60000, false);
  const rotStarB = useRotation(60000, true);
  const rotOrbs = useRotation(15000, false);
  const rotRose = useRotation(11000, false);

  const sr = useRotateCenterStyle(rotRays);
  const sd = useRotateCenterStyle(rotDiamonds);
  const ssa = useRotateCenterStyle(rotStarA);
  const ssb = useRotateCenterStyle(rotStarB);
  const so = useRotateCenterStyle(rotOrbs);
  const srz = useRotateCenterStyle(rotRose);

  const ringBreathe = useHtmlBreatheR(72, 4000, 1.06);
  const ringAp = useAnimatedProps(() => ({ r: ringBreathe.value }));
  const coreBreathe = useHtmlBreatheR(32, 2500, 1.06);
  const coreAp = useAnimatedProps(() => ({ r: coreBreathe.value }));
  const flickOp = useHtmlFlickerFo(2000, 1, 0);
  const flickAp = useAnimatedProps(() => ({ opacity: flickOp.value }));

  const rayLen = 160;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${SIGIL_VB} ${SIGIL_VB}`}>
      <AnimatedG style={pulseStyle}>
        <AnimatedG style={sr}>
          {Array.from({ length: 16 }).map((_, i) => {
            const deg = i * 22.5;
            const rad = (deg * Math.PI) / 180;
            const x2 = 170 + rayLen * Math.sin(rad);
            const y2 = 170 - rayLen * Math.cos(rad);
            const thick = i % 2 === 0;
            return (
              <Line
                key={i}
                x1={170}
                y1={170}
                x2={x2}
                y2={y2}
                stroke={thick ? "#A78BFA" : "#7C3AED"}
                strokeWidth={thick ? 1.5 : 1}
                opacity={0.4}
              />
            );
          })}
        </AnimatedG>

        <Circle cx={170} cy={170} r={138} fill="none" stroke="#8B5CF6" strokeWidth={1} opacity={0.25} />

        <AnimatedG style={sd}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
            <Polygon
              key={deg}
              points={DIAMOND}
              fill={i % 2 === 0 ? "#A78BFA" : "#7C3AED"}
              transform={`rotate(${deg} 170 170)`}
              opacity={0.65}
            />
          ))}
        </AnimatedG>

        <AnimatedG style={ssa}>
          <Polygon points={STAR8} fill="none" stroke="#8B5CF6" strokeWidth={1.5} opacity={0.5} />
        </AnimatedG>
        <AnimatedG style={ssb}>
          <Polygon
            points={STAR8}
            fill="none"
            stroke="#A78BFA"
            strokeWidth={1}
            opacity={0.4}
            transform="rotate(22.5 170 170)"
          />
        </AnimatedG>

        <AnimatedG style={so}>
          {[0, 90, 180, 270].map((deg, i) => (
            <Circle
              key={deg}
              cx={170}
              cy={80}
              r={7}
              fill={i % 2 === 0 ? "#8B5CF6" : "#A78BFA"}
              opacity={i % 2 === 0 ? 0.8 : 0.75}
              transform={`rotate(${deg} 170 170)`}
            />
          ))}
        </AnimatedG>

        <AnimatedCircle
          cx={170}
          cy={170}
          fill="none"
          stroke="#7C3AED"
          strokeWidth={1.25}
          opacity={0.35}
          animatedProps={ringAp}
        />

        <AnimatedG style={srz}>
          {ROSE12.map(({ rot, fill }) => (
            <Ellipse
              key={rot}
              cx={170}
              cy={130}
              rx={8}
              ry={32}
              fill={fill}
              opacity={0.6}
              transform={`rotate(${rot} 170 170)`}
            />
          ))}
        </AnimatedG>

        <AnimatedCircle
          cx={170}
          cy={170}
          fill="rgba(124,58,237,0.25)"
          stroke="#A78BFA"
          strokeWidth={2.5}
          opacity={0.9}
          animatedProps={coreAp}
        />
        <Circle cx={170} cy={170} r={18} fill="#5B21B6" />
        <Circle cx={170} cy={170} r={9} fill="#8B5CF6" />
        <Circle cx={170} cy={170} r={4} fill="#C4B5FD" />
        <AnimatedCircle cx={170} cy={170} r={1.5} fill="white" animatedProps={flickAp} />
      </AnimatedG>
    </Svg>
  );
}
