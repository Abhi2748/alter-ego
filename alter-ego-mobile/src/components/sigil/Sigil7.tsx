import React from "react";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";
import { useAnimatedProps } from "react-native-reanimated";
import { useHtmlSvgPulseS, useHtmlFlickerFo, useHtmlBreatheR } from "./SigilAnimations";
import { svgAdapters, AnimatedG, AnimatedCircle } from "./sigilSvg";
import { DEFAULT_SIGIL_SIZE, type SigilProps } from "./sigilTypes";
import { RotatingG, centerScaleMatrix } from "./rotateCenter";

function ShockRing({
  r,
  strokeW,
  fo,
  delayMs,
  stroke,
}: {
  r: number;
  strokeW: number;
  fo: number;
  delayMs: number;
  stroke: string;
}) {
  const op = useHtmlFlickerFo(3000, fo, delayMs);
  const ap = useAnimatedProps(() => ({ opacity: op.value }), [], svgAdapters);
  return (
    <AnimatedCircle
      cx={170}
      cy={170}
      r={r}
      stroke={stroke}
      strokeWidth={strokeW}
      fill="none"
      animatedProps={ap}
    />
  );
}

const SPIKE_PATH = "M170 170 L176 128 L171 128 L178 86";

export function Sigil7({ size = DEFAULT_SIGIL_SIZE }: SigilProps) {
  const { op: pulseOp, sc: pulseSc } = useHtmlSvgPulseS(2500);
  const flicker = useHtmlFlickerFo(1600, 1, 0);
  const breatheCore = useHtmlBreatheR(38, 2000, 1.06);

  const pulseAp = useAnimatedProps(
    () => ({
      opacity: pulseOp.value,
      transform: centerScaleMatrix(pulseSc.value),
    }),
    [],
    svgAdapters
  );
  const flickAp = useAnimatedProps(() => ({ opacity: flicker.value }), [], svgAdapters);
  const coreAp = useAnimatedProps(() => ({ r: breatheCore.value }), [], svgAdapters);

  return (
    <Svg width={size} height={size} viewBox="0 0 340 340">
      <AnimatedG animatedProps={pulseAp}>
        <ShockRing r={158} strokeW={0.75} fo={0.15} delayMs={0} stroke="#E879F9" />
        <ShockRing r={145} strokeW={1} fo={0.2} delayMs={500} stroke="#C084FC" />
        <ShockRing r={130} strokeW={1.25} fo={0.26} delayMs={1000} stroke="#E879F9" />
        <ShockRing r={112} strokeW={1.5} fo={0.32} delayMs={1500} stroke="#A78BFA" />
        <ShockRing r={92} strokeW={2} fo={0.38} delayMs={2000} stroke="#E879F9" />

        <RotatingG durationMs={25000} reverse>
          <G opacity={0.6}>
            {Array.from({ length: 12 }, (_, i) => (
              <G key={i} transform={`rotate(${i * 30} 170 170)`}>
                <Path
                  d={SPIKE_PATH}
                  stroke={["#E879F9", "#F0ABFC", "#D946EF"][i % 3]}
                  strokeWidth={i % 2 === 0 ? 1.5 : 1.25}
                  fill="none"
                  strokeLinecap="round"
                />
              </G>
            ))}
          </G>
        </RotatingG>

        <RotatingG durationMs={18000}>
          <G opacity={0.5}>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
              <G key={deg} transform={`rotate(${deg} 170 170)`}>
                <Ellipse cx={170} cy={82} rx={14} ry={82} fill={i % 2 === 0 ? "#D946EF" : "#C084FC"} />
              </G>
            ))}
          </G>
        </RotatingG>

        <RotatingG durationMs={8000} reverse>
          <G opacity={0.7}>
            {Array.from({ length: 12 }, (_, i) => (
              <G key={i} transform={`rotate(${i * 30} 170 170)`}>
                <Ellipse
                  cx={170}
                  cy={116}
                  rx={8}
                  ry={50}
                  fill={["#E879F9", "#C084FC", "#A78BFA"][i % 3]}
                />
              </G>
            ))}
          </G>
        </RotatingG>

        <RotatingG durationMs={12000}>
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <G key={deg} transform={`rotate(${deg} 170 170)`}>
              <Circle cx={170} cy={66} r={9} fill={deg % 120 === 0 ? "#E879F9" : "#C084FC"} opacity={0.82} />
            </G>
          ))}
        </RotatingG>

        <AnimatedCircle
          cx={170}
          cy={170}
          fill="rgba(217,70,239,0.28)"
          stroke="#E879F9"
          strokeWidth={3}
          opacity={0.94}
          animatedProps={coreAp}
        />
        <Circle cx={170} cy={170} r={22} fill="#86198F" />
        <Circle cx={170} cy={170} r={12} fill="#E879F9" />
        <Circle cx={170} cy={170} r={5.5} fill="#FAE8FF" />
        <AnimatedCircle cx={170} cy={170} r={2.2} fill="#FFFFFF" animatedProps={flickAp} />
      </AnimatedG>
    </Svg>
  );
}
