import React from "react";
import Svg, { Circle, Ellipse, G, Polygon } from "react-native-svg";
import { useAnimatedProps } from "react-native-reanimated";
import { useHtmlSvgPulseS, useHtmlFlickerFo, useHtmlBreatheR } from "./SigilAnimations";
import { AnimatedG, AnimatedCircle } from "./sigilSvg";
import type { SigilProps } from "./sigilTypes";
import { RotatingG } from "./rotateCenter";

export function Sigil6({ size = 300 }: SigilProps) {
  const { op: pulseOp, sc: pulseSc } = useHtmlSvgPulseS(2500);
  const flicker = useHtmlFlickerFo(1800, 1, 0);
  const breatheCore = useHtmlBreatheR(36, 2200, 1.06);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOp.value,
    transform: [
      { translateX: 170 },
      { translateY: 170 },
      { scale: pulseSc.value },
      { translateX: -170 },
      { translateY: -170 },
    ],
  }));
  const flickAp = useAnimatedProps(() => ({ opacity: flicker.value }));
  const coreAp = useAnimatedProps(() => ({ r: breatheCore.value }));

  return (
    <Svg width={size} height={size} viewBox="0 0 340 340">
      <AnimatedG animatedProps={pulseAp}>
        <RotatingG durationMs={60000}>
          <Circle
            cx={170}
            cy={170}
            r={155}
            stroke="#C084FC"
            strokeWidth={0.75}
            fill="none"
            opacity={0.2}
            strokeDasharray="2 10"
          />
        </RotatingG>

        <RotatingG durationMs={40000} reverse>
          <G opacity={0.6}>
            {Array.from({ length: 12 }, (_, i) => (
              <G key={i} transform={`rotate(${i * 30} 170 170)`}>
                <Polygon points="170,12 177,26 170,40 163,26" fill={["#C084FC", "#A78BFA", "#E879F9"][i % 3]} />
              </G>
            ))}
          </G>
        </RotatingG>

        <RotatingG durationMs={55000}>
          <G opacity={0.38}>
            {[0, 60, 120, 180, 240, 300].map((deg) => (
              <G key={deg} transform={`rotate(${deg} 170 170)`}>
                <Ellipse cx={170} cy={68} rx={18} ry={90} fill={deg % 120 === 0 ? "#9333EA" : "#7C3AED"} />
              </G>
            ))}
          </G>
        </RotatingG>

        <RotatingG durationMs={22000} reverse>
          <G opacity={0.55}>
            {Array.from({ length: 12 }, (_, i) => (
              <G key={`m-${i}`} transform={`rotate(${i * 30} 170 170)`}>
                <Ellipse
                  cx={170}
                  cy={96}
                  rx={10}
                  ry={68}
                  fill={["#C084FC", "#A78BFA", "#E879F9"][i % 3]}
                />
              </G>
            ))}
          </G>
        </RotatingG>
        <RotatingG durationMs={9000}>
          <G opacity={0.72}>
            {Array.from({ length: 12 }, (_, i) => (
              <G key={`in-${i}`} transform={`rotate(${i * 30} 170 170)`}>
                <Ellipse
                  cx={170}
                  cy={124}
                  rx={7}
                  ry={42}
                  fill={["#C084FC", "#E879F9", "#A78BFA"][i % 3]}
                />
              </G>
            ))}
          </G>
        </RotatingG>

        <RotatingG durationMs={10000}>
          {[0, 90, 180, 270].map((deg) => (
            <G key={deg} transform={`rotate(${deg} 170 170)`}>
              <Circle cx={170} cy={80} r={8} fill={deg % 180 === 0 ? "#C084FC" : "#E879F9"} opacity={0.82} />
            </G>
          ))}
        </RotatingG>

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
        <AnimatedCircle cx={170} cy={170} r={2} fill="#FFFFFF" animatedProps={flickAp} />
      </AnimatedG>
    </Svg>
  );
}
