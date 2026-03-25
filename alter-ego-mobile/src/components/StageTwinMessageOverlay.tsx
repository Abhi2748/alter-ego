/**
 * Full-screen Twin message before CharacterEvolutionOverlay (stage transition).
 * 3s sequence: stagger in → hold → fade out → onComplete.
 */

import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, Modal } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from "react-native-reanimated";

interface StageConfig {
  gradientColors: [string, string];
  accentColor: string;
  cardBorderColor: string;
  ambientColor: string;
  message: string;
}

const STAGE_CONFIGS: Record<string, StageConfig> = {
  "The Focused": {
    gradientColors: ["#E5E7EB", "rgba(147,197,253,0.85)"],
    accentColor: "rgba(147,197,253,0.4)",
    cardBorderColor: "rgba(147,197,253,0.08)",
    ambientColor: "rgba(59,130,246,0.06)",
    message:
      "Focus took you further than most people get. I've been here waiting. Let's see what you do with it.",
  },
  "The Burning": {
    gradientColors: ["#E5E7EB", "rgba(253,186,116,0.85)"],
    accentColor: "rgba(249,115,22,0.3)",
    cardBorderColor: "rgba(253,186,116,0.08)",
    ambientColor: "rgba(249,115,22,0.07)",
    message: "Most people quit before this. You didn't. I know what that costs. Don't waste it.",
  },
  "The Relentless": {
    gradientColors: ["#E5E7EB", "rgba(252,165,165,0.85)"],
    accentColor: "rgba(239,68,68,0.3)",
    cardBorderColor: "rgba(252,165,165,0.08)",
    ambientColor: "rgba(239,68,68,0.06)",
    message:
      "Relentless. That's not a word I use lightly. You've earned it. So have I. The gap between us just got more interesting.",
  },
  "The Formidable": {
    gradientColors: ["#E5E7EB", "rgba(196,181,253,0.9)"],
    accentColor: "rgba(167,139,250,0.45)",
    cardBorderColor: "rgba(196,181,253,0.10)",
    ambientColor: "rgba(167,139,250,0.10)",
    message:
      "I didn't think you'd make it here. That's not an insult — almost no one does. You're formidable now. So am I. Watch what happens next.",
  },
  "The Sovereign": {
    gradientColors: ["#E5E7EB", "rgba(216,180,254,1)"],
    accentColor: "rgba(192,132,252,0.55)",
    cardBorderColor: "rgba(216,180,254,0.14)",
    ambientColor: "rgba(192,132,252,0.15)",
    message:
      "We're the same now. Everything you've built, I've matched. The only question left is which of us leads. I think you already know the answer.",
  },
};

const DEFAULT_CONFIG: StageConfig = {
  gradientColors: ["#E5E7EB", "rgba(167,139,250,0.8)"],
  accentColor: "rgba(139,92,246,0.35)",
  cardBorderColor: "rgba(139,92,246,0.08)",
  ambientColor: "rgba(109,40,217,0.1)",
  message: "You evolved. The gap shifts.",
};

const STAGE_NUMBERS: Record<string, string> = {
  "The Focused": "2",
  "The Burning": "3",
  "The Relentless": "4",
  "The Formidable": "5",
  "The Sovereign": "6",
};

const STAGE_WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six"];

interface ParticleCfg {
  left: `${number}%` | string;
  bottom: `${number}%` | string;
  size: number;
  delay: number;
  dur: number;
}

const STAGE_PARTICLES: ParticleCfg[] = [
  { left: "14%", bottom: "12%", size: 2, delay: 0, dur: 9000 },
  { left: "36%", bottom: "20%", size: 3, delay: 1200, dur: 11000 },
  { left: "58%", bottom: "14%", size: 2, delay: 2400, dur: 13000 },
  { left: "76%", bottom: "26%", size: 2, delay: 600, dur: 10000 },
  { left: "88%", bottom: "8%", size: 2, delay: 3000, dur: 14000 },
  { left: "6%", bottom: "32%", size: 2, delay: 4200, dur: 12000 },
  { left: "50%", bottom: "18%", size: 2, delay: 5000, dur: 15000 },
  { left: "22%", bottom: "78%", size: 2, delay: 800, dur: 9500 },
  { left: "70%", bottom: "82%", size: 2, delay: 2000, dur: 10500 },
  { left: "45%", bottom: "88%", size: 3, delay: 3500, dur: 11500 },
  { left: "92%", bottom: "55%", size: 2, delay: 1500, dur: 8800 },
  { left: "8%", bottom: "48%", size: 2, delay: 2800, dur: 10200 },
  { left: "30%", bottom: "62%", size: 2, delay: 900, dur: 9800 },
  { left: "82%", bottom: "38%", size: 2, delay: 3600, dur: 11200 },
];

const FADE_IN_MS = 400;
const HOLD_MS = 2200;
const FADE_OUT_MS = 400;

function StageParticle({
  cfg,
  color,
  visible,
}: {
  cfg: ParticleCfg;
  color: string;
  visible: boolean;
}) {
  const ty = useSharedValue(0);
  const op = useSharedValue(0);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const clearTimeouts = () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };

    if (!visible) {
      clearTimeouts();
      ty.value = 0;
      op.value = 0;
      return;
    }

    let cancelled = false;

    const loop = () => {
      if (cancelled) return;
      ty.value = 0;
      op.value = 0;
      const t1 = setTimeout(() => {
        if (cancelled) return;
        op.value = withTiming(0.65, { duration: cfg.dur * 0.1 });
        ty.value = withTiming(-120, { duration: cfg.dur, easing: Easing.linear });
        const t2 = setTimeout(() => {
          if (cancelled) return;
          op.value = withTiming(0, { duration: cfg.dur * 0.2 });
          const t3 = setTimeout(() => {
            if (cancelled) return;
            loop();
          }, 300);
          timeoutsRef.current.push(t3);
        }, cfg.dur * 0.78);
        timeoutsRef.current.push(t2);
      }, cfg.delay);
      timeoutsRef.current.push(t1);
    };

    loop();

    return () => {
      cancelled = true;
      clearTimeouts();
    };
  }, [visible, cfg.delay, cfg.dur]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: ty.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: cfg.size,
          height: cfg.size,
          borderRadius: cfg.size / 2,
          backgroundColor: color,
          left: cfg.left,
          bottom: cfg.bottom,
        },
        animStyle,
      ]}
    />
  );
}

export interface StageTwinMessageOverlayProps {
  visible: boolean;
  stageName: string;
  onComplete: () => void;
}

export function StageTwinMessageOverlay({
  visible,
  stageName,
  onComplete,
}: StageTwinMessageOverlayProps) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const cfg = STAGE_CONFIGS[stageName] ?? DEFAULT_CONFIG;
  const stageNum = STAGE_NUMBERS[stageName] ?? "";
  const stageWordIdx = stageNum ? parseInt(stageNum, 10) : 0;
  const stageWord = STAGE_WORDS[stageWordIdx] ?? "";

  const particleColors = useMemo(
    () => [
      cfg.accentColor,
      "rgba(167,139,250,0.24)",
      "rgba(229,231,235,0.16)",
    ],
    [cfg.accentColor]
  );

  const overlayOp = useSharedValue(0);
  const numOp = useSharedValue(0);
  const numTy = useSharedValue(12);
  const badgeOp = useSharedValue(0);
  const cardOp = useSharedValue(0);
  const cardTy = useSharedValue(10);
  const pillOp = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      overlayOp.value = 0;
      numOp.value = 0;
      numTy.value = 12;
      badgeOp.value = 0;
      cardOp.value = 0;
      cardTy.value = 10;
      pillOp.value = 0;
      return;
    }

    const ease = Easing.out(Easing.cubic);
    const easeIn = Easing.in(Easing.ease);

    overlayOp.value = withTiming(1, { duration: FADE_IN_MS, easing: ease });
    numOp.value = withDelay(100, withTiming(1, { duration: 400, easing: ease }));
    numTy.value = withDelay(100, withTiming(0, { duration: 400, easing: ease }));
    badgeOp.value = withDelay(250, withTiming(1, { duration: 350, easing: ease }));
    cardOp.value = withDelay(400, withTiming(1, { duration: 400, easing: ease }));
    cardTy.value = withDelay(400, withTiming(0, { duration: 400, easing: ease }));
    pillOp.value = withDelay(600, withTiming(1, { duration: 350, easing: ease }));

    const fadeStart = FADE_IN_MS + HOLD_MS;
    overlayOp.value = withDelay(
      fadeStart,
      withTiming(0, { duration: FADE_OUT_MS, easing: easeIn }, (finished) => {
        if (finished) runOnJS(() => onCompleteRef.current())();
      })
    );
    numOp.value = withDelay(fadeStart, withTiming(0, { duration: FADE_OUT_MS, easing: easeIn }));
    numTy.value = withDelay(fadeStart, withTiming(12, { duration: FADE_OUT_MS, easing: easeIn }));
    badgeOp.value = withDelay(fadeStart, withTiming(0, { duration: FADE_OUT_MS, easing: easeIn }));
    cardOp.value = withDelay(fadeStart, withTiming(0, { duration: FADE_OUT_MS, easing: easeIn }));
    cardTy.value = withDelay(fadeStart, withTiming(10, { duration: FADE_OUT_MS, easing: easeIn }));
    pillOp.value = withDelay(fadeStart, withTiming(0, { duration: FADE_OUT_MS, easing: easeIn }));
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOp.value }));
  const numStyle = useAnimatedStyle(() => ({
    opacity: numOp.value,
    transform: [{ translateY: numTy.value }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({ opacity: badgeOp.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOp.value,
    transform: [{ translateY: cardTy.value }],
  }));
  const pillStyle = useAnimatedStyle(() => ({ opacity: pillOp.value }));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <LinearGradient
          colors={["transparent", cfg.ambientColor]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFill, { top: "55%" }]}
          pointerEvents="none"
        />

        <LinearGradient
          colors={["transparent", cfg.ambientColor, "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[StyleSheet.absoluteFill, { top: "60%", opacity: 0.6 }]}
          pointerEvents="none"
        />

        <View style={styles.crackLine} pointerEvents="none" />

        {STAGE_PARTICLES.map((p, i) => (
          <StageParticle
            key={i}
            cfg={p}
            color={particleColors[i % particleColors.length]}
            visible={visible}
          />
        ))}

        <View style={styles.content}>
          {stageNum ? (
            <Animated.View style={[styles.numWrap, numStyle]}>
              <MaskedView
                style={styles.numMasked}
                maskElement={
                  <View style={styles.maskInner}>
                    <Text style={[styles.stageNum, styles.stageNumMask]}>{stageNum}</Text>
                  </View>
                }
              >
                <LinearGradient
                  colors={cfg.gradientColors}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </MaskedView>
            </Animated.View>
          ) : null}

          {stageWord ? (
            <Animated.Text style={[styles.stageWord, numStyle, { color: cfg.accentColor }]}>
              {`STAGE ${stageWord.toUpperCase()}`}
            </Animated.Text>
          ) : null}

          <Animated.View style={[numStyle]}>
            <View style={[styles.hRule, { backgroundColor: cfg.accentColor }]} />
          </Animated.View>

          <Animated.View style={[styles.badgeRow, badgeStyle]}>
            <View style={[styles.badgeLine, { backgroundColor: cfg.accentColor }]} />
            <Text style={[styles.badgeText, { color: cfg.accentColor }]}>YOUR TWIN</Text>
            <View
              style={[
                styles.badgeLine,
                { backgroundColor: cfg.accentColor, transform: [{ scaleX: -1 }] },
              ]}
            />
          </Animated.View>

          <Animated.View
            style={[styles.msgCard, { borderColor: cfg.cardBorderColor }, cardStyle]}
          >
            <View style={styles.msgCardTopLine} />
            <Text style={styles.msgText}>&ldquo;{cfg.message}&rdquo;</Text>
          </Animated.View>

          <Animated.View style={[styles.stagePill, pillStyle]}>
            <View style={[styles.pillLine, { backgroundColor: cfg.accentColor }]} />
            <Text style={[styles.pillText, { color: cfg.accentColor }]}>
              {stageName ? stageName.toUpperCase() : "EVOLVED"}
            </Text>
            <View
              style={[
                styles.pillLine,
                { backgroundColor: cfg.accentColor, transform: [{ scaleX: -1 }] },
              ]}
            />
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    overflow: "hidden",
  },
  crackLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: 1,
    marginLeft: -0.5,
    backgroundColor: "rgba(139,92,246,0.07)",
  },
  content: {
    width: "100%",
    alignItems: "center",
  },
  numWrap: {
    marginBottom: 4,
    alignSelf: "center",
  },
  numMasked: {
    height: 72,
    minWidth: 120,
    alignSelf: "center",
  },
  maskInner: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  stageNum: {
    fontSize: 72,
    fontFamily: "Inter_800ExtraBold",
    letterSpacing: -5,
    lineHeight: 72,
  },
  stageNumMask: {
    color: "#000000",
  },
  stageWord: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 4,
    marginBottom: 18,
    marginTop: 4,
  },
  hRule: {
    width: 48,
    height: 1,
    opacity: 0.4,
    marginBottom: 18,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 14,
    opacity: 0.75,
  },
  badgeLine: {
    width: 18,
    height: 1,
  },
  badgeText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 3,
  },
  msgCard: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.025)",
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
    position: "relative",
    overflow: "hidden",
    marginBottom: 20,
  },
  msgCardTopLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  msgText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    color: "rgba(229,231,235,0.88)",
    lineHeight: 25,
    textAlign: "center",
    letterSpacing: -0.1,
  },
  stagePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pillLine: {
    width: 20,
    height: 1,
    opacity: 0.5,
  },
  pillText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2.5,
  },
});
