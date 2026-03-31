import React from "react";
import Svg, { Circle, Ellipse, G, Line, Polygon } from "react-native-svg";
import { useAnimatedProps } from "react-native-reanimated";
import { useHtmlSvgPulseS, useHtmlFlickerFo, useHtmlBreatheR } from "./SigilAnimations";
import { AnimatedG, AnimatedCircle } from "./sigilSvg";
import type { SigilProps } from "./sigilTypes";
import { RotatingG } from "./rotateCenter";

const RAY_STEPS = 16;

export function Sigil5({ size = 300 }: SigilProps) {
  const { op: pulseOp, sc: pulseSc } = useHtmlSvgPulseS(3000);
  const flicker = useHtmlFlickerFo(2000, 1, 0);
  const breatheRing = useHtmlBreatheR(72, 4000, 1.04);
  const breatheCore = useHtmlBreatheR(32, 2500, 1.06);

  const pulseAp = useAnimatedProps(() => ({
    opacity: pulseOp.value,
    transform: `translate(170, 170) scale(${pulseSc.value}) translate(-170, -170)`,
  }));
  const flickAp = useAnimatedProps(() => ({ opacity: flicker.value }));
  const ringAp = useAnimatedProps(() => ({ r: breatheRing.value }));
  const coreGlowAp = useAnimatedProps(() => ({ r: breatheCore.value }));

  return (
    <Svg width={size} height={size} viewBox="0 0 340 340">
      <AnimatedG animatedProps={pulseAp}>
        <RotatingG durationMs={45000}>
          <G opacity={0.4}>
            {Array.from({ length: RAY_STEPS }, (_, i) => {
              const deg = i * 22.5;
              const wide = i % 2 === 0;
              return (
                <G key={deg} transform={`rotate(${deg} 170 170)`}>
                  <Line
                    x1={170}
                    y1={170}
                    x2={170}
                    y2={10}
                    stroke={wide ? "#A78BFA" : "#7C3AED"}
                    strokeWidth={wide ? 1.5 : 1}
                  />
                </G>
              );
            })}
          </G>
        </RotatingG>

        <Circle cx={170} cy={170} r={138} stroke="#8B5CF6" strokeWidth={1} fill="none" opacity={0.25} />

        <RotatingG durationMs={30000} reverse>
          <G opacity={0.65}>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
              <G key={deg} transform={`rotate(${deg} 170 170)`}>
                <Polygon points="170,28 178,42 170,56 162,42" fill={i % 2 === 0 ? "#A78BFA" : "#7C3AED"} />
              </G>
            ))}
          </G>
        </RotatingG>

        <RotatingG durationMs={60000}>
          <Polygon
            points="170,60 200,140 280,170 200,200 170,280 140,200 60,170 140,140"
            fill="none"
            stroke="#8B5CF6"
            strokeWidth={1.5}
            opacity={0.5}
          />
        </RotatingG>
        <RotatingG durationMs={60000} reverse>
          <G transform="rotate(22.5 170 170)">
            <Polygon
              points="170,60 200,140 280,170 200,200 170,280 140,200 60,170 140,140"
              fill="none"
              stroke="#A78BFA"
              strokeWidth={1}
              opacity={0.4}
            />
          </G>
        </RotatingG>

        <RotatingG durationMs={15000}>
          {[0, 90, 180, 270].map((deg) => (
            <G key={deg} transform={`rotate(${deg} 170 170)`}>
              <Circle cx={170} cy={80} r={7} fill={deg % 180 === 0 ? "#8B5CF6" : "#A78BFA"} opacity={0.78} />
            </G>
          ))}
        </RotatingG>

        <AnimatedCircle
          cx={170}
          cy={170}
          stroke="#7C3AED"
          strokeWidth={1.25}
          fill="none"
          opacity={0.35}
          animatedProps={ringAp}
        />

        <RotatingG durationMs={11000}>
          <G opacity={0.6}>
            {Array.from({ length: 12 }, (_, i) => (
              <G key={i} transform={`rotate(${i * 30} 170 170)`}>
                <Ellipse
                  cx={170}
                  cy={130}
                  rx={8}
                  ry={32}
                  fill={i % 3 === 0 ? "#8B5CF6" : i % 3 === 1 ? "#7C3AED" : "#A78BFA"}
                />
              </G>
            ))}
          </G>
        </RotatingG>

        <AnimatedCircle
          cx={170}
          cy={170}
          fill="rgba(124,58,237,0.25)"
          stroke="#A78BFA"
          strokeWidth={2.5}
          opacity={0.9}
          animatedProps={coreGlowAp}
        />
        <Circle cx={170} cy={170} r={18} fill="#5B21B6" />
        <Circle cx={170} cy={170} r={9} fill="#8B5CF6" />
        <Circle cx={170} cy={170} r={4} fill="#C4B5FD" />
        <AnimatedCircle cx={170} cy={170} r={1.5} fill="#FFFFFF" animatedProps={flickAp} />
      </AnimatedG>
    </Svg>
  );
}
