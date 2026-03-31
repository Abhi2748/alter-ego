import React from "react";
import Svg, { Circle, Ellipse, G, Line, Polygon } from "react-native-svg";
import { useAnimatedProps } from "react-native-reanimated";
import { useHtmlSvgPulseS, useHtmlFlickerFo, useHtmlBreatheR } from "./SigilAnimations";
import { AnimatedG, AnimatedCircle } from "./sigilSvg";
import type { SigilProps } from "./sigilTypes";
import { RotatingG } from "./rotateCenter";

function Corona10({ r, sw, fo, dly }: { r: number; sw: number; fo: number; dly: number }) {
  const op = useHtmlFlickerFo(2600, fo, dly);
  const ap = useAnimatedProps(() => ({ opacity: op.value }));
  return (
    <AnimatedCircle
      cx={170}
      cy={170}
      r={r}
      stroke="#FDE68A"
      strokeWidth={sw}
      fill="none"
      animatedProps={ap}
    />
  );
}

const RAY_COLORS = ["#FFFFFF", "#FDE68A", "#FCD34D"];

export function Sigil10({ size = 300 }: SigilProps) {
  const { op: pulseOp, sc: pulseSc } = useHtmlSvgPulseS(1800);
  const flicker = useHtmlFlickerFo(1200, 1, 0);
  const breatheA = useHtmlBreatheR(44, 2600, 1.04);
  const breatheB = useHtmlBreatheR(10, 1600, 1.1);

  const pulseAp = useAnimatedProps(() => ({
    opacity: pulseOp.value,
    transform: `translate(170, 170) scale(${pulseSc.value}) translate(-170, -170)`,
  }));
  const flickAp = useAnimatedProps(() => ({ opacity: flicker.value }));
  const outerCoreAp = useAnimatedProps(() => ({ r: breatheA.value }));
  const innerCoreAp = useAnimatedProps(() => ({ r: breatheB.value }));

  return (
    <Svg width={size} height={size} viewBox="0 0 340 340">
      <AnimatedG animatedProps={pulseAp}>
        <Corona10 r={170} sw={0.75} fo={0.16} dly={0} />
        <Corona10 r={158} sw={1} fo={0.2} dly={250} />
        <Corona10 r={140} sw={1.25} fo={0.24} dly={500} />
        <Corona10 r={122} sw={1.5} fo={0.3} dly={750} />

        <RotatingG durationMs={90000}>
          <G opacity={0.45}>
            {Array.from({ length: 48 }, (_, i) => (
              <G key={i} transform={`rotate(${i * 7.5} 170 170)`}>
                <Line
                  x1={170}
                  y1={170}
                  x2={170}
                  y2={0}
                  stroke={RAY_COLORS[i % 3]}
                  strokeWidth={i % 2 === 0 ? 1.5 : 1}
                />
              </G>
            ))}
          </G>
        </RotatingG>

        <RotatingG durationMs={14000} reverse>
          <G opacity={0.7}>
            {Array.from({ length: 12 }, (_, i) => (
              <G key={i} transform={`rotate(${i * 30} 170 170)`}>
                <Polygon points="170,18 180,42 170,66 160,42" fill={i % 2 === 0 ? "#F8FAFC" : "#FDE68A"} />
              </G>
            ))}
          </G>
        </RotatingG>

        <RotatingG durationMs={3500}>
          <G opacity={0.62}>
            {Array.from({ length: 12 }, (_, i) => (
              <G key={i} transform={`rotate(${i * 30} 170 170)`}>
                <Ellipse
                  cx={170}
                  cy={112}
                  rx={10}
                  ry={54}
                  fill={i % 3 === 0 ? "#FFFFFF" : i % 3 === 1 ? "#FDE68A" : "#FBBF24"}
                />
              </G>
            ))}
          </G>
        </RotatingG>

        <RotatingG durationMs={5000} reverse>
          <G opacity={0.55} transform="rotate(15 170 170)">
            {Array.from({ length: 12 }, (_, i) => (
              <G key={i} transform={`rotate(${i * 30} 170 170)`}>
                <Ellipse
                  cx={170}
                  cy={132}
                  rx={7}
                  ry={36}
                  fill={i % 2 === 0 ? "#FDE68A" : "#FFFFFF"}
                />
              </G>
            ))}
          </G>
        </RotatingG>

        <RotatingG durationMs={2500}>
          <G opacity={0.6}>
            {[0, 60, 120, 180, 240, 300].map((deg) => (
              <G key={deg} transform={`rotate(${deg} 170 170)`}>
                <Ellipse cx={170} cy={148} rx={5} ry={20} fill={deg % 120 === 0 ? "#FFFFFF" : "#FDE68A"} />
              </G>
            ))}
          </G>
        </RotatingG>

        <AnimatedCircle
          cx={170}
          cy={170}
          fill="rgba(255,255,255,0.12)"
          stroke="#FFFFFF"
          strokeWidth={4}
          opacity={0.95}
          animatedProps={outerCoreAp}
        />
        <Circle cx={170} cy={170} r={28} fill="rgba(255,255,255,0.8)" />
        <Circle cx={170} cy={170} r={18} fill="#FFFFFF" />
        <AnimatedCircle
          cx={170}
          cy={170}
          fill="rgba(253,230,138,0.35)"
          stroke="#FDE68A"
          strokeWidth={1}
          animatedProps={innerCoreAp}
        />
        <AnimatedCircle cx={170} cy={170} r={4} fill="#FFFFFF" animatedProps={flickAp} />
      </AnimatedG>
    </Svg>
  );
}
