/**
 * Full-screen ritual loading UI after final onboarding step (POST /onboarding/complete).
 * Timer-driven phases only; parent navigates when the request resolves.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Polygon } from "react-native-svg";
import AnimatedRe, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";

const { width: SCREEN_W } = Dimensions.get("window");

const MAIN_MESSAGES = [
  "Reading your patterns",
  "Mapping what drives you",
  "Designing your first day",
  "Calibrating your missions",
  "Preparing your world",
] as const;

const FACTS: { text: string; highlights: string[] }[] = [
  {
    text: "People who define specific habits are 42% more likely to stick with them long-term.",
    highlights: ["specific habits", "42%"],
  },
  {
    text: "The first 7 days of a new habit are the hardest. After that, your brain starts to automate.",
    highlights: ["The first 7 days"],
  },
  {
    text: "Consistency beats intensity. Showing up for 15 minutes daily outperforms a 2-hour session once a week.",
    highlights: ["Consistency", "15 minutes daily"],
  },
  {
    text: "Most people quit in week 2. The ones who don't are the ones who make it non-negotiable.",
    highlights: ["week 2", "non-negotiable"],
  },
  {
    text: "Small wins compounding over 90 days produce more change than any single burst of effort.",
    highlights: ["Small wins", "90 days"],
  },
];

const STEP_LABELS = ["Capture", "Analyse", "Classify", "Build"] as const;

function renderFactWithHighlights(
  fact: (typeof FACTS)[number],
  baseStyle: object,
  hiStyle: object
) {
  let remaining = fact.text;
  const parts: React.ReactNode[] = [];
  let key = 0;
  const sorted = [...fact.highlights].sort((a, b) => b.length - a.length);
  while (remaining.length > 0) {
    let foundIdx = -1;
    let foundPhrase = "";
    for (const h of sorted) {
      const i = remaining.indexOf(h);
      if (i !== -1 && (foundIdx === -1 || i < foundIdx)) {
        foundIdx = i;
        foundPhrase = h;
      }
    }
    if (foundIdx === -1) {
      parts.push(
        <Text key={key++} style={baseStyle}>
          {remaining}
        </Text>
      );
      break;
    }
    if (foundIdx > 0) {
      parts.push(
        <Text key={key++} style={baseStyle}>
          {remaining.slice(0, foundIdx)}
        </Text>
      );
    }
    parts.push(
      <Text key={key++} style={[baseStyle, hiStyle]}>
        {foundPhrase}
      </Text>
    );
    remaining = remaining.slice(foundIdx + foundPhrase.length);
  }
  return parts;
}

function FloatingParticle({
  left,
  top,
  size,
  delayMs,
}: {
  left: number;
  top: number;
  size: number;
  delayMs: number;
}) {
  const y = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      y.value = withRepeat(
        withTiming(-60, { duration: 7000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs, y]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));
  return (
    <AnimatedRe.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left,
          top,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#A78BFA",
          opacity: 0.2,
        },
        style,
      ]}
    />
  );
}

function PhaseNode({
  index,
  active,
  done,
}: {
  index: number;
  active: boolean;
  done: boolean;
}) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 750, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [active, pulse]);
  const glowStyle = useAnimatedStyle(() => {
    const r = 8 + pulse.value * 8;
    const o = 0.35 + pulse.value * 0.35;
    return {
      shadowRadius: r,
      shadowOpacity: o,
    };
  });

  const circle = (
    <View
      style={[
        styles.phaseNodeCircle,
        done && styles.phaseNodeDone,
        active && !done && styles.phaseNodeActive,
        !done && !active && styles.phaseNodeIdle,
      ]}
    >
      <Text style={[styles.phaseNodeNum, active && styles.phaseNodeNumActive, done && styles.phaseNodeNumDone]}>
        {done ? "✓" : index + 1}
      </Text>
    </View>
  );

  return (
    <View style={styles.phaseNodeCol}>
      <View style={styles.phaseNodeCircleWrap}>
        {active && !done ? (
          <AnimatedRe.View
            style={[
              styles.phaseNodeGlowWrap,
              glowStyle,
              {
                shadowColor: "#8B5CF6",
                shadowOffset: { width: 0, height: 0 },
                elevation: Platform.OS === "android" ? 8 : 0,
              },
            ]}
          >
            {circle}
          </AnimatedRe.View>
        ) : (
          circle
        )}
      </View>
      <Text style={[styles.phaseLabel, active && styles.phaseLabelActive]} numberOfLines={1}>
        {STEP_LABELS[index]}
      </Text>
    </View>
  );
}

function Connector({ filled }: { filled: boolean }) {
  return (
    <View style={styles.connectorWrap}>
      <LinearGradient
        colors={filled ? ["#1E2333", "rgba(139,92,246,0.4)"] : ["#1E2333", "#1E2333"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.connectorLine}
      />
    </View>
  );
}

export function OnboardingCompletionOverlay({ active }: { active: boolean }) {
  const [activeStep, setActiveStep] = useState(0);
  const [doneSteps, setDoneSteps] = useState<[boolean, boolean, boolean, boolean]>([
    false,
    false,
    false,
    false,
  ]);

  const mainOpacity = useRef(new Animated.Value(1)).current;
  const factOpacity = useRef(new Animated.Value(1)).current;

  const outerRot = useSharedValue(0);
  const innerRot = useSharedValue(0);
  const orbitAngle = useSharedValue(0);
  const orbScale = useSharedValue(1);
  const orbShadow = useSharedValue(0.5);

  useEffect(() => {
    if (!active) return;
    outerRot.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false
    );
    innerRot.value = withRepeat(
      withTiming(-360, { duration: 5000, easing: Easing.linear }),
      -1,
      false
    );
    orbitAngle.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 3000, easing: Easing.linear }),
      -1,
      false
    );
    orbScale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 1250, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    orbShadow.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 1250, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 1250, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    return () => {
      outerRot.value = 0;
      innerRot.value = 0;
      orbitAngle.value = 0;
      orbScale.value = 1;
      orbShadow.value = 0.5;
    };
  }, [active, outerRot, innerRot, orbitAngle, orbScale, orbShadow]);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${outerRot.value}deg` }],
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${innerRot.value}deg` }],
  }));
  const orbitStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: 60 + 57 * Math.cos(orbitAngle.value) - 3,
    top: 60 + 57 * Math.sin(orbitAngle.value) - 3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#8B5CF6",
  }));
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
    shadowOpacity: orbShadow.value,
  }));

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!active) {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      setActiveStep(0);
      setDoneSteps([false, false, false, false]);
      mainOpacity.setValue(1);
      factOpacity.setValue(1);
      return;
    }

    setActiveStep(0);
    setDoneSteps([false, false, false, false]);

    timersRef.current = [
      setTimeout(() => {
        setDoneSteps([true, false, false, false]);
        setActiveStep(1);
      }, 2000),
      setTimeout(() => {
        setDoneSteps([true, true, false, false]);
        setActiveStep(2);
      }, 4000),
      setTimeout(() => {
        setDoneSteps([true, true, true, false]);
        setActiveStep(3);
      }, 6000),
    ];

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [active, mainOpacity, factOpacity]);

  // Tie opacity + copy transitions to the step progression (facts should not change independently).
  useEffect(() => {
    if (!active) return;
    mainOpacity.setValue(0);
    factOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(mainOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(factOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [activeStep, active, mainOpacity, factOpacity]);

  const mainIdx = Math.min(activeStep, MAIN_MESSAGES.length - 1);
  const factIdx = Math.min(activeStep, FACTS.length - 1);

  if (!active) return null;

  const particles = [
    { l: SCREEN_W * 0.08, t: 120, s: 3, d: 0 },
    { l: SCREEN_W * 0.85, t: 180, s: 2, d: 400 },
    { l: SCREEN_W * 0.2, t: 240, s: 4, d: 800 },
    { l: SCREEN_W * 0.7, t: 100, s: 3, d: 200 },
    { l: SCREEN_W * 0.5, t: 320, s: 2, d: 600 },
    { l: SCREEN_W * 0.15, t: 400, s: 3, d: 1000 },
  ];

  return (
    <View style={styles.root} pointerEvents="box-none">
      <LinearGradient
        colors={["#0D0F1A", "#07080F"]}
        locations={[0, 1]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {particles.map((p, i) => (
        <FloatingParticle key={i} left={p.l} top={p.t} size={p.s} delayMs={p.d} />
      ))}

      <View style={styles.centerBlock}>
        <View style={styles.radialGlow} pointerEvents="none">
          <LinearGradient
            colors={["rgba(139,92,246,0.12)", "transparent"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 1 }}
          />
        </View>

        <View style={styles.hexHost}>
          <AnimatedRe.View style={[styles.hexOuterSvg, outerStyle]}>
            <Svg width={120} height={120} viewBox="0 0 120 120">
              <Polygon
                points="60,4 110,32 110,88 60,116 10,88 10,32"
                fill="none"
                stroke="rgba(139,92,246,0.35)"
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
            </Svg>
          </AnimatedRe.View>
          <AnimatedRe.View style={[styles.hexInnerWrap, innerStyle]} pointerEvents="none">
            <Svg width={80} height={80} viewBox="0 0 80 80">
              <Polygon
                points="40,4 72,22 72,58 40,76 8,58 8,22"
                fill="none"
                stroke="rgba(167,139,250,0.55)"
                strokeWidth={1}
              />
            </Svg>
          </AnimatedRe.View>
          <AnimatedRe.View style={orbitStyle} />
          <AnimatedRe.View style={[styles.centralOrb, orbStyle]}>
            <LinearGradient
              colors={["#A78BFA", "#6D28D9"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </AnimatedRe.View>
        </View>

        <Text style={styles.phaseTitle}>BUILDING YOUR WORLD</Text>

        <Animated.View style={{ opacity: mainOpacity, minHeight: 56, justifyContent: "center" }}>
          <Text style={styles.mainMessage}>{MAIN_MESSAGES[mainIdx]}</Text>
        </Animated.View>

        <Text style={styles.subtitle}>
          This takes a few seconds. Your programme is being built from scratch.
        </Text>

        <View style={styles.trackRow}>
          {[0, 1, 2, 3].map((i) => (
            <React.Fragment key={i}>
              <PhaseNode index={i} active={activeStep === i} done={doneSteps[i]} />
              {i < 3 && <Connector filled={doneSteps[i]} />}
            </React.Fragment>
          ))}
        </View>
      </View>

      <View style={styles.factCard}>
        <Text style={styles.factLabel}>✦  DID YOU KNOW</Text>
        <Animated.View style={{ opacity: factOpacity }}>
          <Text style={styles.factBody}>
            {renderFactWithHighlights(FACTS[factIdx], styles.factBody, styles.factHi)}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#07080F",
  },
  centerBlock: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 200,
  },
  radialGlow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    overflow: "hidden",
    alignSelf: "center",
    top: "50%",
    transform: [{ translateY: -140 }],
  },
  hexHost: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  hexOuterSvg: {
    position: "absolute",
  },
  hexInnerWrap: {
    position: "absolute",
    width: 80,
    height: 80,
    left: 20,
    top: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  centralOrb: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    alignSelf: "center",
    top: "50%",
    zIndex: 10,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
    elevation: 20,
  },
  phaseTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 4,
    color: "#A78BFA",
    textAlign: "center",
    marginBottom: 16,
  },
  mainMessage: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    fontWeight: "700",
    color: "#E5E7EB",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    fontWeight: "400",
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20.8,
    marginTop: 8,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
    maxWidth: 360,
    justifyContent: "space-between",
  },
  phaseNodeCol: {
    alignItems: "center",
    width: 56,
  },
  phaseNodeCircleWrap: {
    marginBottom: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  phaseNodeGlowWrap: {
    borderRadius: 12,
  },
  phaseNodeCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  phaseNodeIdle: {
    borderColor: "#2A3050",
    backgroundColor: "#141824",
  },
  phaseNodeActive: {
    borderColor: "#A78BFA",
    backgroundColor: "rgba(139,92,246,0.2)",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  phaseNodeDone: {
    borderColor: "#8B5CF6",
    backgroundColor: "rgba(139,92,246,0.15)",
  },
  phaseNodeNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
  },
  phaseNodeNumActive: {
    color: "#A78BFA",
  },
  phaseNodeNumDone: {
    color: "#A78BFA",
  },
  phaseLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
  },
  phaseLabelActive: {
    color: "#A78BFA",
  },
  connectorWrap: {
    flex: 1,
    justifyContent: "center",
    paddingTop: 10,
    minWidth: 8,
    paddingHorizontal: 2,
  },
  connectorLine: {
    height: 1,
    width: "100%",
  },
  factCard: {
    position: "absolute",
    left: 32,
    right: 32,
    bottom: 60,
    backgroundColor: "#141824",
    borderWidth: 1,
    borderColor: "#2A3050",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  factLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#6B7280",
    marginBottom: 6,
  },
  factBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#9CA3AF",
    lineHeight: 19.5,
  },
  factHi: {
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
    color: "#A78BFA",
  },
});
