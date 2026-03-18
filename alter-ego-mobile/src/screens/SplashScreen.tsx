import { useEffect } from "react";
import { View, Text, StyleSheet, Dimensions, StatusBar } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "@/utils/supabase";
import { apiClient, isAuthError } from "@/services/api";
import { onboardingService } from "@/services/onboarding";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../navigation/types";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const FIGURE_HEIGHT = 352; // slightly taller figures
const LOGO_BOTTOM_PCT = 0.14;
const LOGO_BLOCK_HEIGHT = 44; // wordmark + gaps + divider + subtitle
const FIGURE_LOGO_GAP = 24;
const figuresRowBottom = SCREEN_HEIGHT * LOGO_BOTTOM_PCT + LOGO_BLOCK_HEIGHT + FIGURE_LOGO_GAP;
const CRACK_HEIGHT = SCREEN_HEIGHT - figuresRowBottom; // crack from top of screen down to figures

// Hooded silhouette path (viewBox 0 0 100 100), rendered at 115×FIGURE_HEIGHT
const SILHOUETTE_PATH =
  "M37,0 L63,0 L73,5 L79,13 L89,19 L96,30 L92,42 L85,48 L82,57 L80,70 L78,83 L76,100 L24,100 L22,83 L20,70 L18,57 L15,48 L8,42 L4,30 L11,19 L21,13 L27,5 Z";

type Nav = StackNavigationProp<RootStackParamList, "Splash">;

export function SplashScreen() {
  const navigation = useNavigation<Nav>();

  // Layer 1 — Background
  const bgOpacity = useSharedValue(0);

  // Layer 2 — Mist
  const mistOpacity = useSharedValue(0);
  const mistTranslateY = useSharedValue(16);

  // Layer 4 — Crack line
  const crackScaleY = useSharedValue(0);
  const crackOpacity = useSharedValue(0);

  // Layer 6 — Figures
  const userOpacity = useSharedValue(0);
  const userTranslateY = useSharedValue(22);
  const userTranslateX = useSharedValue(-7);
  const twinOpacity = useSharedValue(0);
  const twinTranslateY = useSharedValue(22);
  const twinTranslateX = useSharedValue(7);

  // User uncertainty dot pulse
  const userDotScale = useSharedValue(0.85);
  const userDotOpacity = useSharedValue(0.25);

  // Twin base glow pulse
  const twinGlowScaleX = useSharedValue(1);
  const twinGlowOpacity = useSharedValue(0.55);

  // Twin crown pulse
  const twinCrownOpacity = useSharedValue(0.45);

  // Layer 7 — Logo block
  const logoOpacity = useSharedValue(0);
  const logoTranslateY = useSharedValue(8);

  // Layer 8 — Tagline
  const taglineOpacity = useSharedValue(0);
  const taglineTranslateY = useSharedValue(6);

  // Particles (shared values for 6 particles)
  const p1Y = useSharedValue(0);
  const p1Opacity = useSharedValue(0);
  const p1X = useSharedValue(0);
  const p2Y = useSharedValue(0);
  const p2Opacity = useSharedValue(0);
  const p2X = useSharedValue(0);
  const p3Y = useSharedValue(0);
  const p3Opacity = useSharedValue(0);
  const p3X = useSharedValue(0);
  const p4Y = useSharedValue(0);
  const p4Opacity = useSharedValue(0);
  const p4X = useSharedValue(0);
  const p5Y = useSharedValue(0);
  const p5Opacity = useSharedValue(0);
  const p5X = useSharedValue(0);
  const p6Y = useSharedValue(0);
  const p6Opacity = useSharedValue(0);
  const p6X = useSharedValue(0);

  // Crack sparks
  const s1Y = useSharedValue(0);
  const s1Opacity = useSharedValue(0);
  const s2Y = useSharedValue(0);
  const s2Opacity = useSharedValue(0);
  const s3Y = useSharedValue(0);
  const s3Opacity = useSharedValue(0);
  const s4Y = useSharedValue(0);
  const s4Opacity = useSharedValue(0);

  const easeOut = Easing.out(Easing.ease);
  const easeBack = Easing.out(Easing.back(1.2));

  useEffect(() => {
    StatusBar.setHidden(true, "fade");

    // Layer 1 — Background fade in 1000ms
    bgOpacity.value = withTiming(1, { duration: 1000, easing: easeOut });

    // Layer 2 — Mist: delay 300ms, 2000ms fade + translateY 16→0
    mistOpacity.value = withDelay(300, withTiming(1, { duration: 2000, easing: easeOut }));
    mistTranslateY.value = withDelay(300, withTiming(0, { duration: 2000, easing: easeOut }));

    // Layer 4 — Crack: delay 260ms, 400ms scaleY 0→1, opacity 0→1
    crackScaleY.value = withDelay(260, withTiming(1, { duration: 400, easing: easeOut }));
    crackOpacity.value = withDelay(260, withTiming(1, { duration: 400, easing: easeOut }));

    // Layer 6 — User figure: delay 500ms, 750ms
    userOpacity.value = withDelay(500, withTiming(1, { duration: 750, easing: easeBack }));
    userTranslateY.value = withDelay(500, withTiming(0, { duration: 750, easing: easeBack }));
    userTranslateX.value = withDelay(500, withTiming(0, { duration: 750, easing: easeBack }));

    // Layer 6 — Twin figure: delay 650ms, 750ms
    twinOpacity.value = withDelay(650, withTiming(1, { duration: 750, easing: easeBack }));
    twinTranslateY.value = withDelay(650, withTiming(0, { duration: 750, easing: easeBack }));
    twinTranslateX.value = withDelay(650, withTiming(0, { duration: 750, easing: easeBack }));

    // User dot pulse: delay 1800ms, 2600ms loop
    userDotScale.value = withDelay(
      1800,
      withRepeat(
        withSequence(
          withTiming(1.15, { duration: 1300, easing: easeOut }),
          withTiming(0.85, { duration: 1300, easing: easeOut })
        ),
        -1
      )
    );
    userDotOpacity.value = withDelay(
      1800,
      withRepeat(
        withSequence(
          withTiming(0.6, { duration: 867, easing: easeOut }),
          withTiming(0.25, { duration: 867, easing: easeOut }),
          withTiming(0.6, { duration: 866, easing: easeOut }),
          withTiming(0.25, { duration: 866, easing: easeOut })
        ),
        -1
      )
    );

    // Twin glow pulse: delay 1600ms, 3400ms loop
    twinGlowScaleX.value = withDelay(
      1600,
      withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1700, easing: easeOut }),
          withTiming(1, { duration: 1700, easing: easeOut })
        ),
        -1
      )
    );
    twinGlowOpacity.value = withDelay(
      1600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1700, easing: easeOut }),
          withTiming(0.55, { duration: 1700, easing: easeOut })
        ),
        -1
      )
    );

    // Twin crown pulse: delay 1900ms, 3200ms loop
    twinCrownOpacity.value = withDelay(
      1900,
      withRepeat(
        withSequence(
          withTiming(0.85, { duration: 1600, easing: easeOut }),
          withTiming(0.45, { duration: 1600, easing: easeOut })
        ),
        -1
      )
    );

    // Layer 7 — Logo: delay 1150ms, 600ms
    logoOpacity.value = withDelay(1150, withTiming(1, { duration: 600, easing: easeOut }));
    logoTranslateY.value = withDelay(1150, withTiming(0, { duration: 600, easing: easeOut }));

    // Layer 8 — Tagline: delay 1550ms, 500ms
    taglineOpacity.value = withDelay(1550, withTiming(1, { duration: 500, easing: easeOut }));
    taglineTranslateY.value = withDelay(1550, withTiming(0, { duration: 500, easing: easeOut }));

    // Particles — infinite loop: translateY 0→-85, opacity 0→0.38→0.32→0, optional X drift
    const runParticle = (
      yVal: Animated.SharedValue<number>,
      opacityVal: Animated.SharedValue<number>,
      xVal: Animated.SharedValue<number>,
      duration: number,
      delayMs: number,
      dx: number
    ) => {
      yVal.value = withDelay(
        delayMs,
        withRepeat(withTiming(-85, { duration, easing: easeOut }), -1, false)
      );
      opacityVal.value = withDelay(
        delayMs,
        withRepeat(
          withSequence(
            withTiming(0.38, { duration: duration * 0.2, easing: easeOut }),
            withTiming(0.32, { duration: duration * 0.5, easing: easeOut }),
            withTiming(0, { duration: duration * 0.3, easing: easeOut })
          ),
          -1,
          false
        )
      );
      if (dx !== 0) {
        xVal.value = withDelay(
          delayMs,
          withRepeat(
            withSequence(
              withTiming(dx, { duration: duration / 2, easing: easeOut }),
              withTiming(-dx, { duration: duration / 2, easing: easeOut })
            ),
            -1,
            true
          )
        );
      }
    };
    runParticle(p1Y, p1Opacity, p1X, 4400, 1100, -6);
    runParticle(p2Y, p2Opacity, p2X, 5800, 600, 5);
    runParticle(p3Y, p3Opacity, p3X, 3900, 2200, 8);
    runParticle(p4Y, p4Opacity, p4X, 6200, 400, -4);
    runParticle(p5Y, p5Opacity, p5X, 5100, 1700, -7);
    runParticle(p6Y, p6Opacity, p6X, 7000, 900, 9);

    // Crack sparks — rise along the full crack (top of screen to figures)
    const runSpark = (
      yVal: Animated.SharedValue<number>,
      opacityVal: Animated.SharedValue<number>,
      duration: number,
      delayMs: number
    ) => {
      const totalTravel = CRACK_HEIGHT;
      yVal.value = withDelay(
        delayMs,
        withRepeat(
          withTiming(-totalTravel, { duration, easing: easeOut }),
          -1,
          false
        )
      );
      opacityVal.value = withDelay(
        delayMs,
        withRepeat(
          withSequence(
            withTiming(1, { duration: duration * 0.12, easing: easeOut }),
            withTiming(0.5, { duration: duration * 0.76, easing: easeOut }),
            withTiming(0, { duration: duration * 0.12, easing: easeOut })
          ),
          -1,
          false
        )
      );
    };
    runSpark(s1Y, s1Opacity, 2800, 1200);
    runSpark(s2Y, s2Opacity, 3600, 2000);
    runSpark(s3Y, s3Opacity, 4100, 2700);
    runSpark(s4Y, s4Opacity, 2300, 3500);

    const t = setTimeout(async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        navigation.replace("SignUp");
        return;
      }
      if (token === "guest") {
        navigation.replace("Onboarding");
        return;
      }
      try {
        await onboardingService.createProfile();
        const me = await apiClient.get<{
          exists: boolean;
          onboarding_complete?: boolean;
        }>("/api/v1/auth/me");
        if (me.exists && me.onboarding_complete) {
          navigation.replace("Main");
        } else {
          navigation.replace("Onboarding");
        }
      } catch (e) {
        if (token !== "guest" && isAuthError(e)) {
          await supabase.auth.signOut();
        }
        navigation.replace("SignUp");
      }
    }, 2500);

    return () => {
      clearTimeout(t);
      StatusBar.setHidden(false, "fade");
    };
  }, [navigation]);

  const bgAnimatedStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));
  const mistAnimatedStyle = useAnimatedStyle(() => ({
    opacity: mistOpacity.value,
    transform: [{ translateY: mistTranslateY.value }],
  }));
  const crackAnimatedStyle = useAnimatedStyle(() => {
    "worklet";
    const h = CRACK_HEIGHT;
    return {
      opacity: crackOpacity.value,
      transform: [
        { translateY: (1 - crackScaleY.value) * (h / 2) },
        { scaleY: crackScaleY.value },
      ],
    };
  });
  const userAnimatedStyle = useAnimatedStyle(() => ({
    opacity: userOpacity.value,
    transform: [
      { translateY: userTranslateY.value },
      { translateX: userTranslateX.value },
    ],
  }));
  const twinAnimatedStyle = useAnimatedStyle(() => ({
    opacity: twinOpacity.value,
    transform: [
      { translateY: twinTranslateY.value },
      { translateX: twinTranslateX.value },
    ],
  }));
  const userDotAnimatedStyle = useAnimatedStyle(() => ({
    opacity: userDotOpacity.value,
    transform: [{ scale: userDotScale.value }],
  }));
  const twinGlowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: twinGlowOpacity.value,
    transform: [{ scaleX: twinGlowScaleX.value }],
  }));
  const twinCrownAnimatedStyle = useAnimatedStyle(() => ({
    opacity: twinCrownOpacity.value,
  }));
  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoTranslateY.value }],
  }));
  const taglineAnimatedStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineTranslateY.value }],
  }));

  const particleStyle = (
    y: Animated.SharedValue<number>,
    opacity: Animated.SharedValue<number>,
    x: Animated.SharedValue<number>
  ) =>
    useAnimatedStyle(() => ({
      transform: [{ translateY: y.value }, { translateX: x.value }],
      opacity: opacity.value,
    }));

  const p1Style = particleStyle(p1Y, p1Opacity, p1X);
  const p2Style = particleStyle(p2Y, p2Opacity, p2X);
  const p3Style = particleStyle(p3Y, p3Opacity, p3X);
  const p4Style = particleStyle(p4Y, p4Opacity, p4X);
  const p5Style = particleStyle(p5Y, p5Opacity, p5X);
  const p6Style = particleStyle(p6Y, p6Opacity, p6X);

  const sparkStyle = (y: Animated.SharedValue<number>, opacity: Animated.SharedValue<number>) =>
    useAnimatedStyle(() => ({
      transform: [{ translateY: y.value }],
      opacity: opacity.value,
    }));
  const s1Style = sparkStyle(s1Y, s1Opacity);
  const s2Style = sparkStyle(s2Y, s2Opacity);
  const s3Style = sparkStyle(s3Y, s3Opacity);
  const s4Style = sparkStyle(s4Y, s4Opacity);


  return (
    <View style={styles.root}>
      {/* Layer 1 — Background gradient + radial glow */}
      <Animated.View style={[StyleSheet.absoluteFill, bgAnimatedStyle]} pointerEvents="none">
        <LinearGradient
          colors={["#05060C", "#0A0C18", "#06070E"]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        <View
          style={[
            styles.radialGlow,
            {
              marginTop: SCREEN_HEIGHT * 0.08,
            },
          ]}
        />
      </Animated.View>

      {/* Layer 2 — Ground mist */}
      <Animated.View style={[styles.mist, mistAnimatedStyle]} pointerEvents="none">
        <LinearGradient
          colors={["rgba(55,15,130,0.14)", "rgba(80,25,160,0.05)", "transparent"]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
        />
      </Animated.View>

      {/* Layer 3 — Ambient particles */}
      <Animated.View style={[styles.particle, styles.p1, p1Style]} pointerEvents="none" />
      <Animated.View style={[styles.particle, styles.p2, p2Style]} pointerEvents="none" />
      <Animated.View style={[styles.particle, styles.p3, p3Style]} pointerEvents="none" />
      <Animated.View style={[styles.particle, styles.p4, p4Style]} pointerEvents="none" />
      <Animated.View style={[styles.particle, styles.p5, p5Style]} pointerEvents="none" />
      <Animated.View style={[styles.particle, styles.p6, p6Style]} pointerEvents="none" />

      {/* Layer 4 — Crack line */}
      <Animated.View
        style={[
          styles.crackWrapper,
          {
            left: SCREEN_WIDTH / 2 - 0.5,
            top: 0,
            height: CRACK_HEIGHT,
          },
          crackAnimatedStyle,
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[
            "transparent",
            "rgba(155,95,250,0.18)",
            "rgba(192,132,252,0.72)",
            "rgba(215,170,255,0.96)",
            "rgba(192,132,252,0.72)",
            "rgba(155,95,250,0.18)",
            "transparent",
          ]}
          locations={[0, 0.05, 0.28, 0.5, 0.72, 0.95, 1]}
          style={[styles.crackLine, { height: CRACK_HEIGHT }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      </Animated.View>

      {/* Layer 5 — Crack sparks */}
      <Animated.View
        style={[
          styles.spark,
          {
            left: SCREEN_WIDTH / 2 - 2,
            bottom: figuresRowBottom,
          },
          s1Style,
        ]}
        pointerEvents="none"
      />
      <Animated.View
        style={[
          styles.spark,
          styles.sparkSmall,
          {
            left: SCREEN_WIDTH / 2 - 1.5,
            bottom: figuresRowBottom,
          },
          s2Style,
        ]}
        pointerEvents="none"
      />
      <Animated.View
        style={[
          styles.spark,
          {
            left: SCREEN_WIDTH / 2 - 2,
            bottom: figuresRowBottom,
          },
          s3Style,
        ]}
        pointerEvents="none"
      />
      <Animated.View
        style={[
          styles.spark,
          styles.sparkSmall,
          {
            left: SCREEN_WIDTH / 2 - 1.5,
            bottom: figuresRowBottom,
          },
          s4Style,
        ]}
        pointerEvents="none"
      />

      {/* Layer 6 — Two figures (just above ALTER EGO logo) */}
      <Animated.View
        style={[
          styles.figuresRow,
          {
            left: SCREEN_WIDTH / 2 - 134,
            bottom: figuresRowBottom,
            height: FIGURE_HEIGHT,
          },
        ]}
        pointerEvents="none"
      >
        {/* User figure (left) */}
        <Animated.View style={[styles.figureColumn, userAnimatedStyle]}>
          <View style={styles.userUncertaintyDotWrapper}>
            <Animated.View style={[styles.userUncertaintyDot, userDotAnimatedStyle]} />
          </View>
          <Svg width={115} height={FIGURE_HEIGHT} viewBox="0 0 100 100" preserveAspectRatio="none">
            <Path fill="rgba(42,25,88,0.58)" d={SILHOUETTE_PATH} />
            <Defs>
              <SvgLinearGradient id="userRim" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="rgba(110,70,210,0.40)" />
                <Stop offset="0.38" stopColor="transparent" />
              </SvgLinearGradient>
            </Defs>
            <Path fill="url(#userRim)" d={SILHOUETTE_PATH} />
          </Svg>
          <View style={styles.userBaseGlow} />
        </Animated.View>

        {/* Twin figure (right) */}
        <Animated.View style={[styles.figureColumn, twinAnimatedStyle]}>
          <View style={styles.twinCrownWrapper}>
            <Animated.View style={[styles.twinCrownGlow, twinCrownAnimatedStyle]} />
          </View>
          <Svg width={115} height={FIGURE_HEIGHT} viewBox="0 0 100 100" preserveAspectRatio="none">
            <Path fill="rgba(82,42,172,0.78)" d={SILHOUETTE_PATH} />
            <Defs>
              <SvgLinearGradient id="twinRim" x1="1" y1="0" x2="0" y2="0">
                <Stop offset="0" stopColor="rgba(192,132,252,0.68)" />
                <Stop offset="0.44" stopColor="transparent" />
              </SvgLinearGradient>
            </Defs>
            <Path fill="url(#twinRim)" d={SILHOUETTE_PATH} />
          </Svg>
          <Animated.View style={[styles.twinBaseGlow, twinGlowAnimatedStyle]} />
        </Animated.View>
      </Animated.View>

      {/* Layer 7 — Logo block */}
      <Animated.View
        style={[styles.logoBlock, { bottom: SCREEN_HEIGHT * 0.14 }, logoAnimatedStyle]}
        pointerEvents="none"
      >
        <Text style={styles.wordmark}>ALTER EGO</Text>
        <View style={styles.logoDivider}>
          <LinearGradient
            colors={["transparent", "rgba(192,132,252,0.5)", "transparent"]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </View>
        <Text style={styles.subtitle}>The Adaptive Discipline Engine</Text>
      </Animated.View>

      {/* Layer 8 — Tagline */}
      <Animated.View
        style={[styles.taglineBlock, { bottom: SCREEN_HEIGHT * 0.055 }, taglineAnimatedStyle]}
        pointerEvents="none"
      >
        <Text style={styles.taglineMain}>Same start.{"\n"}One kept their word.</Text>
        <Text style={styles.taglineSub}>Meet the version of you that never missed a day.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  radialGlow: {
    position: "absolute",
    width: 320,
    height: 280,
    borderRadius: 160,
    backgroundColor: "transparent",
    shadowColor: "#6D28D9",
    shadowOpacity: 0.28,
    shadowRadius: 80,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    alignSelf: "center",
  },
  mist: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 210,
  },
  particle: {
    position: "absolute",
    width: 2,
    height: 2,
    borderRadius: 2,
    backgroundColor: "rgba(139,92,246,0.42)",
  },
  p1: { bottom: "26%", left: "22%" },
  p2: { bottom: "31%", left: "38%", width: 3, height: 3, borderRadius: 3 },
  p3: { bottom: "24%", left: "55%" },
  p4: { bottom: "29%", left: "68%" },
  p5: { bottom: "20%", left: "78%", width: 3, height: 3, borderRadius: 3 },
  p6: { bottom: "33%", left: "14%" },
  crackWrapper: {
    position: "absolute",
    width: 1,
    overflow: "hidden",
    shadowColor: "#C084FC",
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 2,
  },
  crackLine: {
    width: 1,
  },
  spark: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(215,170,255,0.95)",
    shadowColor: "#D7AAFF",
    shadowOpacity: 0.85,
    shadowRadius: 8,
  },
  sparkSmall: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  figuresRow: {
    position: "absolute",
    width: 268,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 0,
  },
  figureColumn: {
    width: 115,
    height: FIGURE_HEIGHT,
    alignItems: "center",
  },
  userUncertaintyDotWrapper: {
    position: "absolute",
    top: -14,
    left: "50%",
    marginLeft: -2.5,
    zIndex: 1,
  },
  userUncertaintyDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(130,80,230,0.32)",
    shadowColor: "rgba(130,80,230,0.18)",
    shadowRadius: 7,
  },
  userBaseGlow: {
    width: 76,
    height: 32,
    borderRadius: 38,
    backgroundColor: "transparent",
    shadowColor: "rgba(80,35,170,0.20)",
    shadowRadius: 8,
    alignSelf: "center",
    marginTop: -8,
  },
  twinCrownWrapper: {
    position: "absolute",
    top: -14,
    left: "50%",
    marginLeft: -25,
    zIndex: 1,
  },
  twinCrownGlow: {
    width: 50,
    height: 32,
    borderRadius: 25,
    backgroundColor: "transparent",
    shadowColor: "rgba(192,132,252,0.40)",
    shadowRadius: 5,
  },
  twinBaseGlow: {
    width: 96,
    height: 46,
    borderRadius: 48,
    backgroundColor: "transparent",
    shadowColor: "rgba(115,55,235,0.40)",
    shadowRadius: 10,
    alignSelf: "center",
    marginTop: -8,
  },
  logoBlock: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 5,
  },
  wordmark: {
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 7,
    color: "#E5E7EB",
    textTransform: "uppercase",
    textShadowColor: "rgba(139,92,246,0.32)",
    textShadowRadius: 22,
  },
  logoDivider: {
    width: 34,
    height: 1,
    overflow: "hidden",
  },
  subtitle: {
    fontSize: 8,
    fontWeight: "500",
    letterSpacing: 2.8,
    color: "rgba(167,139,250,0.55)",
    textTransform: "uppercase",
  },
  taglineBlock: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 52,
    alignItems: "center",
  },
  taglineMain: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(229,231,235,0.92)",
    textAlign: "center",
    lineHeight: 21,
    letterSpacing: 0.1,
  },
  taglineSub: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(167,139,250,0.58)",
    textAlign: "center",
    letterSpacing: 0.4,
  },
});
