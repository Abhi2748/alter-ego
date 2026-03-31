import React from "react";
import Svg, { Circle, Ellipse, G, Line, Polygon } from "react-native-svg";
import { useAnimatedProps } from "react-native-reanimated";
import { useHtmlSvgPulseS, useHtmlFlickerFo, useHtmlBreatheR } from "./SigilAnimations";
import { AnimatedG, AnimatedCircle } from "./sigilSvg";
import type { SigilProps } from "./sigilTypes";
import { RotatingG } from "./rotateCenter";

function CoronaRing({ r, sw, fo, dly, stroke }: { r: number; sw: number; fo: number; dly: number; stroke: string }) {
  const op = useHtmlFlickerFo(2800, fo, dly);
  const ap = useAnimatedProps(() => ({ opacity: op.value }));
  return (
    <AnimatedCircle cx={170} cy={170} r={r} stroke={stroke} strokeWidth={sw} fill="none" animatedProps={ap} />
  );
}

const RAY_COLORS = ["#FFFFFF", "#FDE68A", "#FCD34D"];

export function Sigil9({ size = 300 }: SigilProps) {
  const { op: pulseOp, sc: pulseSc } = useHtmlSvgPulseS(2000);
  const flicker = useHtmlFlickerFo(1400, 1, 0);
  const breatheOuter = useHtmlBreatheR(40, 2400, 1.05);
  const breatheInner = useHtmlBreatheR(7, 1800, 1.12);

  const pulseAp = useAnimatedProps(() => ({
    opacity: pulseOp.value,
    transform: `translate(170, 170) scale(${pulseSc.value}) translate(-170, -170)`,
  }));
  const flickAp = useAnimatedProps(() => ({ opacity: flicker.value }));
  const outerAp = useAnimatedProps(() => ({ r: breatheOuter.value }));
  const innerAp = useAnimatedProps(() => ({ r: breatheInner.value }));

  return (
    <Svg width={size} height={size} viewBox="0 0 340 340">
      <AnimatedG animatedProps={pulseAp}>
        <CoronaRing r={168} sw={0.75} fo={0.14} dly={0} stroke="#FDE68A" />
        <CoronaRing r={152} sw={1} fo={0.18} dly={300} stroke="#FCD34D" />
        <CoronaRing r={132} sw={1.25} fo={0.22} dly={600} stroke="#FDE68A" />
        <CoronaRing r={108} sw={1.5} fo={0.28} dly={900} stroke="#FFFFFF" />
        <CoronaRing r={88} sw={2} fo={0.34} dly={1200} stroke="#FDE68A" />

        <RotatingG durationMs={55000}>
          <G opacity={0.42}>
            {Array.from({ length: 36 }, (_, i) => (
              <G key={i} transform={`rotate(${i * 10} 170 170)`}>
                <Line
                  x1={170}
                  y1={170}
                  x2={170}
                  y2={5}
                  stroke={RAY_COLORS[i % 3]}
                  strokeWidth={i % 2 === 0 ? 1.5 : 1}
                />
              </G>
            ))}
          </G>
        </RotatingG>

        <RotatingG durationMs={20000} reverse>
          <G opacity={0.55}>
            {Array.from({ length: 12 }, (_, i) => (
              <G key={i} transform={`rotate(${i * 30} 170 170)`}>
                <Polygon points="170,22 182,48 170,74 158,48" fill={i % 2 === 0 ? "#FDE68A" : "#FCD34D"} />
              </G>
            ))}
          </G>
        </RotatingG>

        <RotatingG durationMs={5500} reverse>
          <G opacity={0.65}>
            {Array.from({ length: 12 }, (_, i) => (
              <G key={i} transform={`rotate(${i * 30} 170 170)`}>
                <Ellipse cx={170} cy={118} rx={9} ry={48} fill={i % 2 === 0 ? "#FDE68A" : "#FBBF24"} />
              </G>
            ))}
          </G>
        </RotatingG>

        <RotatingG durationMs={3500}>
          <G opacity={0.55}>
            {[0, 60, 120, 180, 240, 300].map((deg) => (
              <G key={deg} transform={`rotate(${deg} 170 170)`}>
                <Ellipse cx={170} cy={138} rx={6} ry={28} fill={deg % 120 === 0 ? "#FDE68A" : "#FFFBEB"} />
              </G>
            ))}
          </G>
        </RotatingG>

        <AnimatedCircle
          cx={170}
          cy={170}
          fill="rgba(253,230,138,0.15)"
          stroke="#FFFBEB"
          strokeWidth={2}
          opacity={0.95}
          animatedProps={outerAp}
        />
        <Circle cx={170} cy={170} r={24} fill="#92400E" />
        <Circle cx={170} cy={170} r={14} fill="#FDE68A" />
        <AnimatedCircle cx={170} cy={170} fill="#FFFBEB" stroke="#FFFBEB" strokeWidth={1} animatedProps={innerAp} />
        <AnimatedCircle cx={170} cy={170} r={3} fill="#FFFFFF" animatedProps={flickAp} />
      </AnimatedG>
    </Svg>
  );
}
