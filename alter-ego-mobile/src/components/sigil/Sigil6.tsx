/**
 * Level 6 — ALTER_EGO_Sigil_FullPage.html (The Resonance)
 */
import React from "react";
import Svg, { Circle, Ellipse, Polygon } from "react-native-svg";
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

const D12 = "170,12 177,26 170,40 163,26";
const D12_FILLS = [
  "#C084FC",
  "#A78BFA",
  "#C084FC",
  "#E879F9",
  "#C084FC",
  "#A78BFA",
  "#C084FC",
  "#A78BFA",
  "#C084FC",
  "#E879F9",
  "#C084FC",
  "#A78BFA",
] as const;

const OUT6: { rot: number; fill: string }[] = [
  { rot: 0, fill: "#9333EA" },
  { rot: 60, fill: "#7C3AED" },
  { rot: 120, fill: "#9333EA" },
  { rot: 180, fill: "#7C3AED" },
  { rot: 240, fill: "#9333EA" },
  { rot: 300, fill: "#7C3AED" },
];

const MID12: { rot: number; fill: string }[] = [
  { rot: 0, fill: "#C084FC" },
  { rot: 30, fill: "#A78BFA" },
  { rot: 60, fill: "#C084FC" },
  { rot: 90, fill: "#E879F9" },
  { rot: 120, fill: "#C084FC" },
  { rot: 150, fill: "#A78BFA" },
  { rot: 180, fill: "#C084FC" },
  { rot: 210, fill: "#A78BFA" },
  { rot: 240, fill: "#C084FC" },
  { rot: 270, fill: "#E879F9" },
  { rot: 300, fill: "#C084FC" },
  { rot: 330, fill: "#A78BFA" },
];

const IN12: { rot: number; fill: string }[] = [
  { rot: 0, fill: "#C084FC" },
  { rot: 30, fill: "#E879F9" },
  { rot: 60, fill: "#C084FC" },
  { rot: 90, fill: "#A78BFA" },
  { rot: 120, fill: "#C084FC" },
  { rot: 150, fill: "#E879F9" },
  { rot: 180, fill: "#C084FC" },
  { rot: 210, fill: "#A78BFA" },
  { rot: 240, fill: "#C084FC" },
  { rot: 270, fill: "#E879F9" },
  { rot: 300, fill: "#C084FC" },
  { rot: 330, fill: "#A78BFA" },
];

export function Sigil6({ size = 300 }: SigilProps) {
  const pulseStyle = useHtmlSvgPulseS(2800);
  const rOut = useRotation(60000, false);
  const rD = useRotation(40000, true);
  const rLarge = useRotation(55000, false);
  const rMid = useRotation(22000, true);
  const rIn = useRotation(9000, false);
  const rOrb = useRotation(10000, false);

  const s0 = useRotateCenterStyle(rOut);
  const s1 = useRotateCenterStyle(rD);
  const s2 = useRotateCenterStyle(rLarge);
  const s3 = useRotateCenterStyle(rMid);
  const s4 = useRotateCenterStyle(rIn);
  const s5 = useRotateCenterStyle(rOrb);

  const coreB = useHtmlBreatheR(36, 2200, 1.06);
  const coreAp = useAnimatedProps(() => ({ r: coreB.value }));
  const flickOp = useHtmlFlickerFo(1800, 1, 0);
  const flickAp = useAnimatedProps(() => ({ opacity: flickOp.value }));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${SIGIL_VB} ${SIGIL_VB}`}>
      <AnimatedG style={pulseStyle}>
        <AnimatedG style={s0}>
          <Circle
            cx={170}
            cy={170}
            r={155}
            fill="none"
            stroke="#C084FC"
            strokeWidth={0.75}
            opacity={0.2}
            strokeDasharray="2 10"
          />
        </AnimatedG>

        <AnimatedG style={s1}>
          {D12_FILLS.map((fill, i) => (
            <Polygon
              key={i}
              points={D12}
              fill={fill}
              transform={`rotate(${i * 30} 170 170)`}
              opacity={0.6}
            />
          ))}
        </AnimatedG>

        <AnimatedG style={s2}>
          {OUT6.map(({ rot, fill }) => (
            <Ellipse
              key={rot}
              cx={170}
              cy={68}
              rx={18}
              ry={90}
              fill={fill}
              opacity={0.38}
              transform={`rotate(${rot} 170 170)`}
            />
          ))}
        </AnimatedG>

        <AnimatedG style={s3}>
          {MID12.map(({ rot, fill }) => (
            <Ellipse
              key={rot}
              cx={170}
              cy={96}
              rx={10}
              ry={68}
              fill={fill}
              opacity={0.55}
              transform={`rotate(${rot} 170 170)`}
            />
          ))}
        </AnimatedG>

        <AnimatedG style={s4}>
          {IN12.map(({ rot, fill }) => (
            <Ellipse
              key={rot}
              cx={170}
              cy={124}
              rx={7}
              ry={42}
              fill={fill}
              opacity={0.72}
              transform={`rotate(${rot} 170 170)`}
            />
          ))}
        </AnimatedG>

        <AnimatedG style={s5}>
          {[0, 90, 180, 270].map((deg, i) => (
            <Circle
              key={deg}
              cx={170}
              cy={80}
              r={8.2}
              fill={i % 2 === 0 ? "#C084FC" : "#E879F9"}
              opacity={i % 2 === 0 ? 0.78 : 0.72}
              transform={`rotate(${deg} 170 170)`}
            />
          ))}
        </AnimatedG>

        <AnimatedCircle
          cx={170}
          cy={170}
          fill="rgba(192,132,252,0.3)"
          stroke="#C084FC"
          strokeWidth={2.5}
          opacity={0.92}
          animatedProps={coreAp}
        />
        <Circle cx={170} cy={170} r={20} fill="#6D28D9" />
        <Circle cx={170} cy={170} r={11} fill="#C084FC" />
        <Circle cx={170} cy={170} r={5} fill="#F5D0FE" />
        <AnimatedCircle cx={170} cy={170} r={2} fill="white" animatedProps={flickAp} />
      </AnimatedG>
    </Svg>
  );
}
