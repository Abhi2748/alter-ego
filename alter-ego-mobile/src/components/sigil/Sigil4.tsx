import React from "react";
import Svg, { Circle, Ellipse, G, Line } from "react-native-svg";
import { useAnimatedProps } from "react-native-reanimated";
import { useHtmlSvgPulseS, useHtmlFlickerFo, useHtmlBreatheR } from "./SigilAnimations";
import { AnimatedG, AnimatedCircle } from "./sigilSvg";
import type { SigilProps } from "./sigilTypes";
import { RotatingG } from "./rotateCenter";

const SPOKE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export function Sigil4({ size = 300, accentColor = "#818CF8", accentColor2 = "#4338CA" }: SigilProps) {
  const { op: pulseOp, sc: pulseSc } = useHtmlSvgPulseS(3500);
  const flicker = useHtmlFlickerFo(2000, 1, 0);
  const breatheR = useHtmlBreatheR(38, 2800, 1.06);

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
  const coreAp = useAnimatedProps(() => ({ r: breatheR.value }));

  return (
    <Svg width={size} height={size} viewBox="0 0 340 340">
      <AnimatedG animatedProps={pulseAp}>
        <RotatingG durationMs={35000}>
          <Ellipse cx={170} cy={170} rx={155} ry={55} stroke={accentColor} strokeWidth={1} fill="none" opacity={0.28} />
        </RotatingG>
        <RotatingG durationMs={24000} delayMs={3000}>
          <Ellipse cx={170} cy={170} rx={130} ry={46} stroke="#6366F1" strokeWidth={1.25} fill="none" opacity={0.32} />
        </RotatingG>
        <RotatingG durationMs={18000} reverse>
          <Ellipse cx={170} cy={170} rx={105} ry={38} stroke={accentColor} strokeWidth={1.5} fill="none" opacity={0.38} />
        </RotatingG>
        <RotatingG durationMs={13000} delayMs={1500}>
          <Ellipse cx={170} cy={170} rx={78} ry={28} stroke="#A5B4FC" strokeWidth={2} fill="none" opacity={0.45} />
        </RotatingG>
        <RotatingG durationMs={9000} reverse>
          <Ellipse cx={170} cy={170} rx={52} ry={18} stroke="#C7D2FE" strokeWidth={2} fill="none" opacity={0.5} />
        </RotatingG>

        <RotatingG durationMs={22000}>
          <G opacity={0.3}>
            {SPOKE_ANGLES.map((deg, i) => (
              <G key={deg} transform={`rotate(${deg} 170 170)`}>
                <Line
                  x1={170}
                  y1={170}
                  x2={170}
                  y2={18}
                  stroke={i % 2 === 0 ? accentColor : accentColor2}
                  strokeWidth={1}
                />
              </G>
            ))}
          </G>
        </RotatingG>

        <RotatingG durationMs={35000}>
          {[0, 90, 180, 270].map((deg) => (
            <G key={deg} transform={`rotate(${deg} 170 170)`}>
              <Circle cx={170} cy={15} r={5} fill={deg % 180 === 0 ? accentColor : "#A5B4FC"} opacity={0.65} />
            </G>
          ))}
        </RotatingG>

        <AnimatedCircle
          cx={170}
          cy={170}
          fill="rgba(99,102,241,0.16)"
          stroke={accentColor}
          strokeWidth={2}
          opacity={0.65}
          animatedProps={coreAp}
        />
        <Circle cx={170} cy={170} r={22} fill="rgba(99,102,241,0.35)" />
        <Circle cx={170} cy={170} r={12} fill={accentColor2} />
        <Circle cx={170} cy={170} r={6} fill={accentColor} />
        <AnimatedCircle cx={170} cy={170} r={2.5} fill="#E0E7FF" animatedProps={flickAp} />
      </AnimatedG>
    </Svg>
  );
}
