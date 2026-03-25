import React from "react";
import Svg, { Circle, Ellipse, G, Line, Path } from "react-native-svg";
import { useAnimatedProps } from "react-native-reanimated";
import { useHtmlSvgPulseS, useHtmlFlickerFo, useHtmlBreatheR } from "./SigilAnimations";
import { AnimatedG, AnimatedCircle } from "./sigilSvg";
import type { SigilProps } from "./sigilTypes";
import { RotatingG } from "./rotateCenter";

function FlickerOutline({ r, fo, delayMs }: { r: number; fo: number; delayMs: number }) {
  const op = useHtmlFlickerFo(3000, fo, delayMs);
  const ap = useAnimatedProps(() => ({ opacity: op.value }));
  return (
    <AnimatedCircle
      cx={170}
      cy={170}
      r={r}
      stroke="#FB7185"
      strokeWidth={0.75}
      fill="none"
      animatedProps={ap}
    />
  );
}

const ARC_A = "M170 80 Q240 50 260 100 Q280 150 240 175 Q220 188 200 178";
const ARC_B = "M170 80 Q100 50 80 100 Q60 150 100 175 Q120 188 140 178";
const ARC_C = "M170 260 Q240 290 260 240 Q280 190 240 165 Q220 152 200 162";
const ARC_D = "M170 260 Q100 290 80 240 Q60 190 100 165 Q120 152 140 162";

const RAY_COLORS = ["#FB7185", "#F43F5E", "#FBBF24"];

export function Sigil8({ size = 300 }: SigilProps) {
  const { op: pulseOp, sc: pulseSc } = useHtmlSvgPulseS(2200);
  const flicker = useHtmlFlickerFo(1600, 1, 0);
  const breatheCore = useHtmlBreatheR(40, 2200, 1.05);

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
        <FlickerOutline r={156} fo={0.18} delayMs={0} />
        <FlickerOutline r={140} fo={0.22} delayMs={400} />

        <RotatingG durationMs={30000}>
          <G opacity={0.55}>
            <Path d={ARC_A} stroke="#FB7185" strokeWidth={2.5} fill="none" strokeLinecap="round" />
            <Path d={ARC_B} stroke="#FB7185" strokeWidth={2.5} fill="none" strokeLinecap="round" />
            <Path d={ARC_C} stroke="#FB7185" strokeWidth={2.5} fill="none" strokeLinecap="round" />
            <Path d={ARC_D} stroke="#FB7185" strokeWidth={2.5} fill="none" strokeLinecap="round" />
          </G>
        </RotatingG>
        <RotatingG durationMs={22000} reverse>
          <G opacity={0.45} transform="rotate(45 170 170)">
            <Path d={ARC_A} stroke="#FBBF24" strokeWidth={2} fill="none" strokeLinecap="round" />
            <Path d={ARC_B} stroke="#FBBF24" strokeWidth={2} fill="none" strokeLinecap="round" />
            <Path d={ARC_C} stroke="#FBBF24" strokeWidth={2} fill="none" strokeLinecap="round" />
            <Path d={ARC_D} stroke="#FBBF24" strokeWidth={2} fill="none" strokeLinecap="round" />
          </G>
        </RotatingG>

        <RotatingG durationMs={40000}>
          <G opacity={0.38}>
            {Array.from({ length: 24 }, (_, i) => (
              <G key={i} transform={`rotate(${i * 15} 170 170)`}>
                <Line
                  x1={170}
                  y1={170}
                  x2={170}
                  y2={12}
                  stroke={RAY_COLORS[i % 3]}
                  strokeWidth={i % 2 === 0 ? 1.5 : 1}
                />
              </G>
            ))}
          </G>
        </RotatingG>

        <RotatingG durationMs={7000} reverse>
          <G opacity={0.68}>
            {Array.from({ length: 12 }, (_, i) => (
              <G key={i} transform={`rotate(${i * 30} 170 170)`}>
                <Ellipse cx={170} cy={120} rx={9} ry={46} fill="#FB7185" />
              </G>
            ))}
          </G>
        </RotatingG>

        <RotatingG durationMs={9000}>
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <G key={deg} transform={`rotate(${deg} 170 170)`}>
              <Circle cx={170} cy={80} r={6} fill="#FB7185" opacity={0.85} />
            </G>
          ))}
        </RotatingG>

        <AnimatedCircle
          cx={170}
          cy={170}
          fill="rgba(251,113,133,0.2)"
          stroke="#FB7185"
          strokeWidth={2}
          opacity={0.9}
          animatedProps={coreAp}
        />
        <Circle cx={170} cy={170} r={24} fill="#9F1239" />
        <Circle cx={170} cy={170} r={14} fill="#FB7185" />
        <Circle cx={170} cy={170} r={8} fill="#FECDD3" />
        <AnimatedCircle cx={170} cy={170} r={4} fill="#FFFFFF" animatedProps={flickAp} />
      </AnimatedG>
    </Svg>
  );
}
