import React from "react";
import Svg, { Circle, G, Path } from "react-native-svg";
import { useAnimatedProps } from "react-native-reanimated";
import { useHtmlSvgPulse, useHtmlFlickerFo, useHtmlBreatheR } from "./SigilAnimations";
import { AnimatedG, AnimatedCircle } from "./sigilSvg";
import type { SigilProps } from "./sigilTypes";
import { HtmlFloatDot } from "./sigilHtmlPrimitives";
import { RotatingG } from "./rotateCenter";

export function Sigil3({ size = 300 }: SigilProps) {
  const { op: pulseOp, sc: pulseSc } = useHtmlSvgPulse(4000);
  const flicker = useHtmlFlickerFo(2500, 1, 0);
  const breatheR = useHtmlBreatheR(36, 3000, 1.06);

  const pulseAp = useAnimatedProps(() => ({
    opacity: pulseOp.value,
    transform: `translate(170, 170) scale(${pulseSc.value}) translate(-170, -170)`,
  }));
  const flickAp = useAnimatedProps(() => ({ opacity: flicker.value }));
  const ringAp = useAnimatedProps(() => ({ r: breatheR.value }));

  return (
    <Svg width={size} height={size} viewBox="0 0 340 340">
      <AnimatedG animatedProps={pulseAp}>
        <Circle
          cx={170}
          cy={170}
          r={152}
          stroke="#0D9488"
          strokeWidth={0.75}
          fill="none"
          opacity={0.15}
          strokeDasharray="3 9"
        />

        <RotatingG durationMs={28000}>
          <Path
            d="M170 170 Q198 128 232 108 Q266 88 278 96 Q290 104 278 120 Q264 136 238 142 Q214 148 196 162 Q182 172 174 176"
            stroke="#2DD4BF"
            strokeWidth={2.5}
            fill="none"
            opacity={0.55}
            strokeLinecap="round"
          />
          <Path
            d="M170 170 Q142 212 108 232 Q74 252 62 244 Q50 236 62 220 Q76 204 102 198 Q126 192 144 178 Q158 168 166 164"
            stroke="#2DD4BF"
            strokeWidth={2.5}
            fill="none"
            opacity={0.55}
            strokeLinecap="round"
          />
          <Path
            d="M170 170 Q212 198 232 232 Q252 266 244 278 Q236 290 220 278 Q204 264 198 238 Q192 214 178 196 Q168 182 164 174"
            stroke="#14B8A6"
            strokeWidth={2}
            fill="none"
            opacity={0.45}
            strokeLinecap="round"
          />
          <Path
            d="M170 170 Q128 142 108 108 Q88 74 96 62 Q104 50 120 62 Q136 76 142 102 Q148 126 162 144 Q172 158 176 166"
            stroke="#14B8A6"
            strokeWidth={2}
            fill="none"
            opacity={0.45}
            strokeLinecap="round"
          />
        </RotatingG>

        <RotatingG durationMs={16000} reverse>
          <Circle
            cx={170}
            cy={170}
            r={80}
            stroke="#2DD4BF"
            strokeWidth={1.5}
            fill="none"
            opacity={0.3}
            strokeDasharray="6 5"
          />
        </RotatingG>

        <RotatingG durationMs={20000}>
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <G key={deg} transform={`rotate(${deg} 170 170)`}>
              <Circle cx={170} cy={70} r={5} fill={deg % 120 === 0 ? "#2DD4BF" : "#5EEAD4"} opacity={0.52} />
            </G>
          ))}
        </RotatingG>

        <HtmlFloatDot cx={96} cy={96} r={4} fill="#2DD4BF" fo={0.32} durMs={8000} delayMs={0} />
        <HtmlFloatDot cx={248} cy={96} r={3.5} fill="#5EEAD4" fo={0.28} durMs={10000} delayMs={1000} />
        <HtmlFloatDot cx={252} cy={252} r={4} fill="#2DD4BF" fo={0.3} durMs={9000} delayMs={2000} />
        <HtmlFloatDot cx={92} cy={255} r={3} fill="#5EEAD4" fo={0.25} durMs={11000} delayMs={500} />

        <AnimatedCircle
          cx={170}
          cy={170}
          fill="rgba(20,184,166,0.12)"
          stroke="#2DD4BF"
          strokeWidth={2}
          opacity={0.6}
          animatedProps={ringAp}
        />
        <Circle cx={170} cy={170} r={20} fill="rgba(20,184,166,0.3)" />
        <Circle cx={170} cy={170} r={11} fill="#0D9488" />
        <Circle cx={170} cy={170} r={5} fill="#2DD4BF" />
        <AnimatedCircle cx={170} cy={170} r={2} fill="#CCFBF1" animatedProps={flickAp} />
      </AnimatedG>
    </Svg>
  );
}
