/**
 * GapMomentScreen — Full-screen cinematic moment.
 * Shown on app open when a pending gap moment exists.
 * Auto-dismisses after 5 seconds. Tap to dismiss early.
 */
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Animated,
  StatusBar,
} from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GapMoment } from "@/services/twin";
import { twinService } from "@/services/twin";

const { width: SW, height: SH } = Dimensions.get("window");

const DENSITY_COUNT: Record<string, number> = {
  high: 70,
  medium: 55,
  low: 40,
  minimal: 15,
};

const PARTICLE_COLORS: Record<string, string[]> = {
  orange: ["rgba(249,115,22,", "rgba(255,200,130,", "rgba(255,170,80,"],
  violet: ["rgba(139,92,246,", "rgba(167,139,250,", "rgba(192,132,252,"],
};

const BG_GRADIENT: Record<string, [string, string]> = {
  streak_milestone: ["#040200", "#000000"],
  all_complete: ["#000000", "#000000"],
  streak_broken: ["#000000", "#000000"],
  absence_return: ["#000000", "#000000"],
  passed_twin: ["#010008", "#020100"],
  stage_evolution: ["#000000", "#020010"],
  pet_evolution: ["#000000", "#000005"],
};

const ATMO_COLOR: Record<string, string> = {
  streak_milestone: "rgba(180,80,0,0.13)",
  all_complete: "rgba(55,12,110,0.18)",
  streak_broken: "rgba(15,12,25,0.5)",
  absence_return: "rgba(30,8,65,0.2)",
  passed_twin: "rgba(120,40,0,0.1)",
  stage_evolution: "rgba(40,10,90,0.15)",
  pet_evolution: "rgba(30,8,65,0.12)",
};

const ACircle = Animated.createAnimatedComponent(Circle);
const ALine = Animated.createAnimatedComponent(Line);

function Particle({ colorBase, opacity }: { colorBase: string; opacity: number }) {
  const translateY = useRef(new Animated.Value(SH * 0.3 + Math.random() * SH * 0.5)).current;
  const translateX = useRef(new Animated.Value(Math.random() * SW)).current;
  const size = useMemo(() => 0.4 + Math.random() * 1.6, []);

  useEffect(() => {
    const dur = 8000 + Math.random() * 6000;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -80 - Math.random() * 60,
          duration: dur,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: SH + 40,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [translateY]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${colorBase}${opacity.toFixed(2)})`,
        transform: [{ translateX }, { translateY }],
      }}
    />
  );
}

function MissionPolygon({ count }: { count: number }) {
  const n = Math.max(3, count);
  const R = 80;
  const cx = 110;
  const cy = 110;
  const NODE_R = 5;

  const verts = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) };
      }),
    [n]
  );

  const nodeAnims = useRef(verts.map(() => new Animated.Value(0))).current;
  const edgeAnims = useRef(verts.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const nodeDelay = 140;
    const edgeDelay = 120;
    const startDelay = 700;
    const nodeSeq = nodeAnims.map((anim, i) =>
      Animated.sequence([
        Animated.delay(startDelay + i * nodeDelay),
        Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: false }),
      ])
    );
    const edgeStart = startDelay + n * nodeDelay + 200;
    const edgeSeq = edgeAnims.map((anim, i) =>
      Animated.sequence([
        Animated.delay(edgeStart + i * edgeDelay),
        Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: false }),
      ])
    );
    Animated.parallel([...nodeSeq, ...edgeSeq]).start();
  }, [n, nodeAnims, edgeAnims]);

  return (
    <Svg width={220} height={220}>
      {verts.map((v, i) => {
        const next = verts[(i + 1) % n];
        return (
          <ALine
            key={`e${i}`}
            x1={v.x}
            y1={v.y}
            x2={next.x}
            y2={next.y}
            stroke="rgba(139,92,246,0.2)"
            strokeWidth={0.75}
            opacity={edgeAnims[i]}
          />
        );
      })}
      {verts.map((v, i) => (
        <ACircle
          key={`n${i}`}
          cx={v.x}
          cy={v.y}
          r={NODE_R}
          fill="rgba(139,92,246,0.3)"
          stroke="rgba(167,139,250,0.75)"
          strokeWidth={1}
          opacity={nodeAnims[i]}
        />
      ))}
    </Svg>
  );
}

interface GapMomentScreenProps {
  moment: GapMoment;
  onDismiss: () => void;
}

export function GapMomentScreen({ moment, onDismiss }: GapMomentScreenProps) {
  const insets = useSafeAreaInsets();
  const progressAnim = useRef(new Animated.Value(1)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  const handleDismiss = useCallback(() => {
    void twinService.dismissGapMoment(moment.id).catch(() => {});
    onDismiss();
  }, [moment.id, onDismiss]);

  useEffect(() => {
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 600,
      delay: 300,
      useNativeDriver: true,
    }).start();

    const t = Animated.timing(progressAnim, {
      toValue: 0,
      duration: 5000,
      delay: 1800,
      useNativeDriver: false,
    });
    t.start(({ finished }) => {
      if (finished) handleDismiss();
    });
    return () => t.stop();
  }, [contentAnim, progressAnim, handleDismiss]);

  const pCount = DENSITY_COUNT[moment.particle_config.density] ?? 40;
  const pColors = PARTICLE_COLORS[moment.particle_config.color] ?? PARTICLE_COLORS.violet;
  const bgColors = BG_GRADIENT[moment.trigger_type] ?? (["#000000", "#000000"] as [string, string]);
  const atmoClr = ATMO_COLOR[moment.trigger_type] ?? "rgba(30,8,65,0.15)";
  const accentClr = moment.accent_color;

  const headlineLines = moment.headline.split("\n");

  const particles = useMemo(
    () =>
      Array.from({ length: pCount }, (_, i) => ({
        id: i,
        color: pColors[i % pColors.length],
        opacity: 0.3 + Math.random() * 0.45,
      })),
    [pCount, pColors]
  );

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SW],
  });

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss}>
      <StatusBar hidden />
      <LinearGradient
        colors={bgColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.atmo, { backgroundColor: atmoClr }]} />

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {particles.map((p) => (
          <Particle key={p.id} colorBase={p.color} opacity={p.opacity} />
        ))}
      </View>

      <Animated.View style={[styles.hero, { opacity: contentAnim }]}>
        {moment.trigger_type === "all_complete" && moment.mission_count != null && moment.mission_count > 0 ? (
          <MissionPolygon count={moment.mission_count} />
        ) : null}

        {(moment.trigger_type === "streak_milestone" || moment.trigger_type === "streak_broken") &&
        moment.trigger_value ? (
          <Text style={[styles.ghostNum, { color: `${accentClr}0D` }]}>{moment.trigger_value}</Text>
        ) : null}
      </Animated.View>

      <Animated.View style={[styles.textBlock, { opacity: contentAnim }]}>
        <Text style={styles.eyebrow}>{_eyebrowForTrigger(moment.trigger_type, moment.trigger_value)}</Text>

        <Text style={styles.headline}>
          {headlineLines.map((line, i) => (
            <Text
              key={i}
              style={i === headlineLines.length - 1 ? { color: accentClr } : { color: "#E5E7EB" }}
            >
              {line}
              {i < headlineLines.length - 1 ? "\n" : ""}
            </Text>
          ))}
        </Text>

        {moment.subtext ? <Text style={styles.subtext}>{moment.subtext}</Text> : null}
      </Animated.View>

      <Text style={[styles.tapHint, { bottom: insets.bottom + 44 }]}>Tap to continue</Text>

      <View style={styles.progressBar}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              backgroundColor: accentClr,
              width: progressWidth,
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

function _eyebrowForTrigger(triggerType: string, triggerValue: string | null): string {
  const map: Record<string, string> = {
    streak_milestone: `Day ${triggerValue ?? ""}`,
    streak_broken: "Broken",
    all_complete: "Clean Day",
    absence_return:
      triggerValue === "default" || !triggerValue
        ? "Welcome Back"
        : `${triggerValue} Days Gone`,
    passed_twin: "You're Ahead",
    stage_evolution: "New Stage",
    pet_evolution: "Evolution",
  };
  return map[triggerType] ?? "";
}

const styles = StyleSheet.create({
  atmo: {
    position: "absolute",
    inset: 0,
  },
  hero: {
    position: "absolute",
    top: "22%",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    height: 260,
  },
  ghostNum: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 200,
    fontWeight: "800",
    letterSpacing: -12,
    lineHeight: 200,
  },
  textBlock: {
    position: "absolute",
    top: "52%",
    left: 0,
    right: 0,
    paddingHorizontal: 44,
    alignItems: "center",
  },
  eyebrow: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 4,
    textTransform: "uppercase",
    color: "rgba(107,114,128,0.5)",
    marginBottom: 18,
  },
  headline: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 38,
    letterSpacing: -0.5,
    textAlign: "center",
    color: "#E5E7EB",
  },
  subtext: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 22,
    color: "rgba(107,114,128,0.5)",
    textAlign: "center",
    marginTop: 18,
  },
  tapHint: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    color: "rgba(75,85,99,0.4)",
  },
  progressBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    opacity: 0.6,
  },
});
