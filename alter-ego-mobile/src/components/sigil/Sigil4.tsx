/**
 * Level 4 — ALTER_EGO_Sigil_FullPage.html (The Vortex)
 */
import React from "react";
import Svg, { Circle, Ellipse, Line } from "react-native-svg";
import { useAnimatedProps } from "react-native-reanimated";
import { useRotation, useHtmlSvgPulseS, useHtmlBreatheR, useHtmlFlickerFo } from "./SigilAnimations";
import { useRotateCenterStyle } from "./rotateCenter";
import { AnimatedG, AnimatedCircle } from "./sigilSvg";
import type { SigilProps } from "./sigilTypes";
import { SIGIL_VB } from "./sigilTypes";

const LAYERS: {
  dur: number;
  rev: boolean;
  delay: number;
  rx: number;
  ry: number;
  sw: number;
  op: number;
  stroke: string;
}[] = [
  { dur: 35000, rev: false, delay: 0, rx: 155, ry: 55, sw: 1, op: 0.28, stroke: "#818CF8" },
  { dur: 24000, rev: false, delay: 3000, rx: 130, ry: 46, sw: 1.25, op: 0.32, stroke: "#6366F1" },
  { dur: 18000, rev: true, delay: 0, rx: 105, ry: 38, sw: 1.5, op: 0.38, stroke: "#818CF8" },
  { dur: 13000, rev: false, delay: 1500, rx: 78, ry: 28, sw: 2, op: 0.45, stroke: "#A5B4FC" },
  { dur: 9000, rev: true, delay: 0, rx: 52, ry: 18, sw: 2, op: 0.5, stroke: "#C7D2FE" },
];

export function Sigil4({ size = 300 }: SigilProps) {
  const pulseStyle = useHtmlSvgPulseS(3500);
  const r0 = useRotation(LAYERS[0].dur, LAYERS[0].rev, LAYERS[0].delay);
  const r1 = useRotation(LAYERS[1].dur, LAYERS[1].rev, LAYERS[1].delay);
  const r2 = useRotation(LAYERS[2].dur, LAYERS[2].rev, LAYERS[2].delay);
  const r3 = useRotation(LAYERS[3].dur, LAYERS[3].rev, LAYERS[3].delay);
  const r4 = useRotation(LAYERS[4].dur, LAYERS[4].rev, LAYERS[4].delay);
  const rSpokes = useRotation(22000, false);
  const rNodes = useRotation(35000, false);

  const s = [
    useRotateCenterStyle(r0),
    useRotateCenterStyle(r1),
    useRotateCenterStyle(r2),
    useRotateCenterStyle(r3),
    useRotateCenterStyle(r4),
  ];
  const sSpokes = useRotateCenterStyle(rSpokes);
  const sNodes = useRotateCenterStyle(rNodes);

  const breatheR = useHtmlBreatheR(38, 2800, 1.06);
  const breatheAp = useAnimatedProps(() => ({ r: breatheR.value }));
  const flickOp = useHtmlFlickerFo(2000, 1, 0);
  const flickAp = useAnimatedProps(() => ({ opacity: flickOp.value }));

  const spokeLen = 152;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${SIGIL_VB} ${SIGIL_VB}`}>
      <AnimatedG style={pulseStyle}>
        {LAYERS.map((layer, i) => (
          <AnimatedG key={i} style={s[i]}>
            <Ellipse
              cx={170}
              cy={170}
              rx={layer.rx}
              ry={layer.ry}
              fill="none"
              stroke={layer.stroke}
              strokeWidth={layer.sw}
              opacity={layer.op}
            />
          </AnimatedG>
        ))}
        <AnimatedG style={sSpokes}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            const x2 = 170 + spokeLen * Math.sin(rad);
            const y2 = 170 - spokeLen * Math.cos(rad);
            return (
              <Line
                key={deg}
                x1={170}
                y1={170}
                x2={x2}
                y2={y2}
                stroke={i % 2 === 0 ? "#818CF8" : "#6366F1"}
                strokeWidth={1}
                opacity={0.3}
              />
            );
          })}
        </AnimatedG>
        <AnimatedG style={sNodes}>
          {[0, 90, 180, 270].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            const nr = 155;
            const nx = 170 + nr * Math.sin(rad);
            const ny = 170 - nr * Math.cos(rad);
            return (
              <Circle
                key={deg}
                cx={nx}
                cy={ny}
                r={5}
                fill={i % 2 === 0 ? "#818CF8" : "#A5B4FC"}
                opacity={i % 2 === 0 ? 0.7 : 0.6}
              />
            );
          })}
        </AnimatedG>
        <AnimatedCircle
          cx={170}
          cy={170}
          fill="rgba(99,102,241,0.16)"
          stroke="#818CF8"
          strokeWidth={2}
          opacity={0.65}
          animatedProps={breatheAp}
        />
        <Circle cx={170} cy={170} r={22} fill="rgba(99,102,241,0.35)" />
        <Circle cx={170} cy={170} r={12} fill="#4338CA" />
        <Circle cx={170} cy={170} r={6} fill="#818CF8" />
        <AnimatedCircle cx={170} cy={170} r={2.5} fill="#E0E7FF" animatedProps={flickAp} />
      </AnimatedG>
    </Svg>
  );
}
