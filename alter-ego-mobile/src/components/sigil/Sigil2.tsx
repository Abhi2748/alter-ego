import React from "react";
import Svg, { Circle, Path } from "react-native-svg";
import { useAnimatedProps } from "react-native-reanimated";
import { useHtmlSvgPulse, useHtmlFlickerFo } from "./SigilAnimations";
import { svgAdapters, AnimatedG, AnimatedCircle } from "./sigilSvg";
import { DEFAULT_SIGIL_SIZE, type SigilProps } from "./sigilTypes";
import { HtmlFloatDot } from "./sigilHtmlPrimitives";
import { RotatingG, centerScaleMatrix } from "./rotateCenter";

/** Set `true` briefly to verify rotation/dots pipeline (~3× faster spins); keep `false` in production. */
const DEBUG_SIGIL2_EXAGGERATE_MOTION = false;
function sigil2RotMs(ms: number) {
  return DEBUG_SIGIL2_EXAGGERATE_MOTION ? Math.max(2000, Math.round(ms / 3)) : ms;
}

export function Sigil2({ size = DEFAULT_SIGIL_SIZE }: SigilProps) {
  const { op: pulseOp, sc: pulseSc } = useHtmlSvgPulse(5000);
  const flicker = useHtmlFlickerFo(3500, 1, 0);

  const pulseAp = useAnimatedProps(
    () => ({
      opacity: pulseOp.value,
      transform: centerScaleMatrix(pulseSc.value),
    }),
    [],
    svgAdapters
  );
  const flickAp = useAnimatedProps(() => ({ opacity: flicker.value }), [], svgAdapters);

  return (
    <Svg width={size} height={size} viewBox="0 0 340 340">
      <AnimatedG animatedProps={pulseAp}>
        <Circle
          cx={170}
          cy={170}
          r={150}
          stroke="#3B82F6"
          strokeWidth={0.75}
          fill="none"
          opacity={0.12}
          strokeDasharray="2 9"
        />

        <RotatingG durationMs={24000}>
          <Path
            d="M170 170 Q198 135 228 112 Q258 90 268 98 Q278 106 270 118 Q258 132 234 138 Q212 144 196 158 Q182 168 174 174"
            stroke="#60A5FA"
            strokeWidth={2}
            fill="none"
            opacity={0.45}
            strokeLinecap="round"
          />
          <Path
            d="M170 170 Q142 205 112 228 Q82 250 72 242 Q62 234 70 222 Q82 208 106 202 Q128 196 144 182 Q158 172 166 166"
            stroke="#60A5FA"
            strokeWidth={2}
            fill="none"
            opacity={0.4}
            strokeLinecap="round"
          />
          <Path
            d="M228 112 Q252 96 268 104"
            stroke="#93C5FD"
            strokeWidth={1}
            fill="none"
            opacity={0.3}
            strokeLinecap="round"
          />
          <Path
            d="M112 228 Q88 244 72 236"
            stroke="#93C5FD"
            strokeWidth={1}
            fill="none"
            opacity={0.25}
            strokeLinecap="round"
          />
        </RotatingG>

        <HtmlFloatDot cx={112} cy={106} r={4} fill="#60A5FA" fo={0.28} durMs={9000} delayMs={0} />
        <HtmlFloatDot cx={234} cy={108} r={3} fill="#93C5FD" fo={0.25} durMs={11000} delayMs={1000} />
        <HtmlFloatDot cx={252} cy={234} r={4} fill="#60A5FA" fo={0.28} durMs={8000} delayMs={2000} />
        <HtmlFloatDot cx={90} cy={240} r={3} fill="#93C5FD" fo={0.22} durMs={12000} delayMs={500} />
        <HtmlFloatDot cx={170} cy={60} r={3} fill="#60A5FA" fo={0.25} durMs={10000} delayMs={3000} />
        <HtmlFloatDot cx={170} cy={285} r={3} fill="#60A5FA" fo={0.22} durMs={10000} delayMs={1500} />
        <HtmlFloatDot cx={60} cy={170} r={3.5} fill="#93C5FD" fo={0.22} durMs={13000} delayMs={4000} />
        <HtmlFloatDot cx={288} cy={170} r={3} fill="#60A5FA" fo={0.2} durMs={11000} delayMs={2500} />

        <RotatingG durationMs={sigil2RotMs(18000)} reverse>
          <Circle
            cx={170}
            cy={170}
            r={72}
            stroke="#3B82F6"
            strokeWidth={1}
            fill="none"
            opacity={0.22}
            strokeDasharray="5 7"
          />
        </RotatingG>

        <Circle cx={170} cy={170} r={30} fill="rgba(59,130,246,0.12)" stroke="#60A5FA" strokeWidth={1.5} opacity={0.6} />
        <Circle cx={170} cy={170} r={16} fill="rgba(59,130,246,0.3)" opacity={0.85} />
        <Circle cx={170} cy={170} r={7} fill="#3B82F6" />
        <AnimatedCircle cx={170} cy={170} r={3} fill="#BFDBFE" animatedProps={flickAp} />
      </AnimatedG>
    </Svg>
  );
}
