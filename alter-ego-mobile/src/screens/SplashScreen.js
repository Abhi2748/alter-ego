/**
 * ALTER EGO Splash — Option A · The Axis (matches docs/Splash_Redesign_Mockup.html)
 *
 * Line draw → dot bloom → content rise; navigation unchanged (guest / SignUp / Main / Onboarding).
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useAuthStore } from "@/store/authStore";
import { isGuestMode } from "@/utils/supabase";
import { apiClient } from "@/services/api";
import { onboardingService } from "@/services/onboarding";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

/** Option A — Splash_Redesign_Mockup.html */
const AXIS_END_RATIO = 0.52;
const CONTENT_TOP_RATIO = 0.535;

const LINE_TARGET_H = SCREEN_H * AXIS_END_RATIO;
const CONTENT_TOP = SCREEN_H * CONTENT_TOP_RATIO;

/** HTML: ellipse 60% 50% at 50% 52% — radial stops rgba(109,40,217,0.07) → transparent 70% */
const VIG_CX = SCREEN_W * 0.5;
const VIG_CY = SCREEN_H * 0.52;
const VIG_RX = SCREEN_W * 0.6;
const VIG_RY = SCREEN_H * 0.5;

/**
 * Dot: 5px core + box-shadow rings (SVG stroked annuli) + soft bloom
 * viewBox centered; matches .axis-dot
 */
const DOT_SVG = 40;
const DOT_VB = 40;
const DOT_C = DOT_VB / 2;

const VIOLET = "#8B5CF6";
const VIOLET_DEEP = "#6D28D9";
const BG = "#07080F";

const SPLASH_ANIM_MS = 2700;

const WORDMARK_FONT = Math.min(38, Math.round(SCREEN_W * 0.097));
const WORDMARK_TRACKING = WORDMARK_FONT * 0.28;

export function SplashScreen() {
  const navigation = useNavigation();
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [splashAnimDone, setSplashAnimDone] = useState(false);
  const [authWaitExpired, setAuthWaitExpired] = useState(false);
  const hasNavigatedRef = useRef(false);

  const lineH = useRef(new Animated.Value(0)).current;
  const dotOp = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0.88)).current;

  const contentOp = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const drawLine = Animated.timing(lineH, {
      toValue: LINE_TARGET_H,
      duration: 1680,
      easing: Easing.bezier(0.22, 0.08, 0.2, 1),
      useNativeDriver: false,
    });

    const bloomDot = Animated.sequence([
      Animated.delay(1320),
      Animated.parallel([
        Animated.timing(dotOp, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(dotScale, {
          toValue: 1,
          duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);

    const riseContent = Animated.sequence([
      Animated.delay(1380),
      Animated.parallel([
        Animated.timing(contentOp, {
          toValue: 1,
          duration: 720,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentY, {
          toValue: 0,
          duration: 760,
          easing: Easing.bezier(0.16, 0.84, 0.2, 1),
          useNativeDriver: true,
        }),
      ]),
    ]);

    Animated.parallel([drawLine, bloomDot, riseContent]).start();

    const timer = setTimeout(() => setSplashAnimDone(true), SPLASH_ANIM_MS);
    return () => clearTimeout(timer);
  }, [lineH, dotOp, dotScale, contentOp, contentY]);

  useEffect(() => {
    if (!splashAnimDone || !isLoading) return;
    const t = setTimeout(() => setAuthWaitExpired(true), 6000);
    return () => clearTimeout(t);
  }, [splashAnimDone, isLoading]);

  useEffect(() => {
    if (!splashAnimDone || (isLoading && !authWaitExpired)) return;
    if (hasNavigatedRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        const guest = await isGuestMode();
        if (cancelled || hasNavigatedRef.current) return;
        if (guest) {
          hasNavigatedRef.current = true;
          navigation.replace("Onboarding");
          return;
        }
        if (!isAuthenticated) {
          hasNavigatedRef.current = true;
          navigation.replace("SignUp");
          return;
        }

        const createProfilePromise = onboardingService.createProfile();
        const mePromise = apiClient.get("/api/v1/auth/me");
        const [, meResult] = await Promise.allSettled([createProfilePromise, mePromise]);
        if (cancelled || hasNavigatedRef.current) return;

        if (
          meResult.status === "fulfilled" &&
          meResult.value?.exists &&
          meResult.value?.onboarding_complete
        ) {
          hasNavigatedRef.current = true;
          navigation.replace("Main");
        } else {
          hasNavigatedRef.current = true;
          navigation.replace("Onboarding");
        }
      } catch {
        if (!cancelled && !hasNavigatedRef.current) {
          hasNavigatedRef.current = true;
          navigation.replace("Onboarding");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [splashAnimDone, isLoading, authWaitExpired, isAuthenticated, navigation]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={[BG, BG]} style={StyleSheet.absoluteFill} />

      <Svg
        width={SCREEN_W}
        height={SCREEN_H}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient
            id="splashVignetteA"
            cx={VIG_CX}
            cy={VIG_CY}
            rx={VIG_RX}
            ry={VIG_RY}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={VIOLET_DEEP} stopOpacity={0.07} />
            <Stop offset="70%" stopColor={VIOLET_DEEP} stopOpacity={0} />
            <Stop offset="100%" stopColor={VIOLET_DEEP} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={SCREEN_W} height={SCREEN_H} fill="url(#splashVignetteA)" />
      </Svg>

      <Animated.View
        style={[styles.lineWrap, { height: lineH, width: 1, marginLeft: -0.5 }]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[
            "rgba(139,92,246,0)",
            "rgba(139,92,246,0.18)",
            "rgba(139,92,246,0.55)",
            "rgba(139,92,246,0.9)",
          ]}
          locations={[0, 0.3, 0.85, 1]}
          style={styles.lineGradient}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.dotWrap,
          {
            top: SCREEN_H * AXIS_END_RATIO - DOT_SVG / 2,
            opacity: dotOp,
            transform: [{ scale: dotScale }],
          },
        ]}
        pointerEvents="none"
      >
        <Svg
          width={DOT_SVG}
          height={DOT_SVG}
          viewBox={`0 0 ${DOT_VB} ${DOT_VB}`}
          pointerEvents="none"
        >
          <Defs>
            <RadialGradient id="axisDotBloom" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={VIOLET} stopOpacity={0.35} />
              <Stop offset="100%" stopColor={VIOLET} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {/* 0 0 20px — soft bloom under rings */}
          <Circle cx={DOT_C} cy={DOT_C} r={12} fill="url(#axisDotBloom)" opacity={0.85} />
          {/* 0 0 0 14px rgba(...,0.04) */}
          <Circle
            cx={DOT_C}
            cy={DOT_C}
            r={9.5}
            fill="none"
            stroke="rgba(139,92,246,0.04)"
            strokeWidth={14}
          />
          {/* 0 0 0 6px rgba(...,0.08) */}
          <Circle
            cx={DOT_C}
            cy={DOT_C}
            r={5.5}
            fill="none"
            stroke="rgba(139,92,246,0.08)"
            strokeWidth={6}
          />
          <Circle cx={DOT_C} cy={DOT_C} r={2.5} fill={VIOLET} />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          styles.content,
          {
            top: CONTENT_TOP,
            opacity: contentOp,
            transform: [{ translateY: contentY }],
          },
        ]}
        pointerEvents="none"
      >
        <Text style={[styles.wordmark, { fontSize: WORDMARK_FONT, letterSpacing: WORDMARK_TRACKING }]}>
          ALTER EGO
        </Text>
        <View style={styles.ruleSlot}>
          <LinearGradient
            colors={[
              "rgba(139,92,246,0)",
              "rgba(139,92,246,0.6)",
              "rgba(139,92,246,0)",
            ]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.rule}
          />
        </View>
        <Text style={styles.engine}>The Adaptive Discipline Engine</Text>
      </Animated.View>

      <View style={styles.loader} pointerEvents="none">
        <LoaderDot delay={0} />
        <LoaderDot delay={200} />
        <LoaderDot delay={400} />
      </View>
    </View>
  );
}

/** CSS: pulse 1.4s ease-in-out — 0%,80%,100% op 0.3 scale 0.85; 40% op 1 scale 1 */
function LoaderDot({ delay }) {
  const op = useRef(new Animated.Value(0.3)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    const cycle = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(op, {
            toValue: 1,
            duration: 560,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 560,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(op, {
            toValue: 0.3,
            duration: 560,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.85,
            duration: 560,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(280),
      ])
    );
    const startTimer = setTimeout(() => cycle.start(), delay);
    return () => {
      clearTimeout(startTimer);
      cycle.stop();
    };
  }, [delay, op, scale]);

  return (
    <Animated.View style={[styles.loaderDot, { opacity: op, transform: [{ scale }] }]} />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  lineWrap: {
    position: "absolute",
    top: 0,
    left: "50%",
    overflow: "hidden",
  },
  lineGradient: {
    flex: 1,
    width: "100%",
  },

  dotWrap: {
    position: "absolute",
    left: "50%",
    marginLeft: -DOT_SVG / 2,
    width: DOT_SVG,
    height: DOT_SVG,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: VIOLET,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
      },
      android: {},
    }),
  },

  content: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 40,
  },
  wordmark: {
    fontWeight: "900",
    color: "#E8E9F0",
    textTransform: "uppercase",
    lineHeight: Math.round(WORDMARK_FONT * 1.05),
    marginBottom: 14,
    textAlign: "center",
    includeFontPadding: false,
    ...Platform.select({
      ios: {
        textShadowColor: "rgba(139,92,246,0.15)",
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 30,
      },
      android: {},
    }),
  },
  ruleSlot: {
    width: 40,
    height: 1,
    marginBottom: 14,
    overflow: "hidden",
  },
  rule: {
    flex: 1,
    width: "100%",
    height: 1,
  },
  engine: {
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 9 * 0.32,
    color: "rgba(255,255,255,0.28)",
    textAlign: "center",
    lineHeight: 14,
    includeFontPadding: false,
  },

  loader: {
    position: "absolute",
    bottom: 64,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loaderDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(139,92,246,0.4)",
    marginHorizontal: 3,
  },
});
