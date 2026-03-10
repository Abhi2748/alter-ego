import { useEffect } from "react";
import { View, Text, StyleSheet, Dimensions, StatusBar } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../navigation/types";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { COLORS } from "../constants/theme";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const FRACTURE_HEIGHT = SCREEN_HEIGHT * 0.6;
const FRACTURE_COLOR = "#C084FC";
const GRADIENT_COLORS = ["#0D0F1A", "#07080F"] as const;

type Nav = StackNavigationProp<RootStackParamList, "Splash">;

export function SplashScreen() {
  const navigation = useNavigation<Nav>();

  const gradientOpacity = useSharedValue(0);
  const fractureScaleY = useSharedValue(0);
  const leftSilhouetteOpacity = useSharedValue(0);
  const rightSilhouetteOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const fadeToBlackOpacity = useSharedValue(0);

  useEffect(() => {
    StatusBar.setHidden(true, "fade");

    const easeOut = Easing.out(Easing.ease);
    const easeIn = Easing.in(Easing.ease);

    gradientOpacity.value = withDelay(0, withTiming(1, { duration: 400, easing: easeOut }));
    fractureScaleY.value = withDelay(400, withTiming(1, { duration: 200, easing: easeOut }));
    leftSilhouetteOpacity.value = withDelay(600, withTiming(0.7, { duration: 300, easing: easeOut }));
    rightSilhouetteOpacity.value = withDelay(600, withTiming(0.9, { duration: 300, easing: easeOut }));
    taglineOpacity.value = withDelay(1200, withTiming(1, { duration: 500, easing: easeOut }));
    fadeToBlackOpacity.value = withDelay(2200, withTiming(1, { duration: 300, easing: easeIn }));

    const t = setTimeout(() => {
      navigation.replace("SignUp");
    }, 2500);

    return () => {
      clearTimeout(t);
      StatusBar.setHidden(false, "fade");
    };
  }, [navigation]);

  const gradientAnimatedStyle = useAnimatedStyle(() => ({
    opacity: gradientOpacity.value,
  }));

  const fractureAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: fractureScaleY.value }],
  }));

  const leftSilhouetteAnimatedStyle = useAnimatedStyle(() => ({
    opacity: leftSilhouetteOpacity.value,
  }));

  const rightSilhouetteAnimatedStyle = useAnimatedStyle(() => ({
    opacity: rightSilhouetteOpacity.value,
  }));

  const taglineAnimatedStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  const fadeToBlackAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fadeToBlackOpacity.value,
  }));

  return (
    <View style={styles.root}>
      {/* Gradient: fades in 0–400ms */}
      <Animated.View style={[StyleSheet.absoluteFill, gradientAnimatedStyle]} pointerEvents="none">
        <LinearGradient
          colors={[...GRADIENT_COLORS]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      </Animated.View>

      {/* Fracture line: scaleY 400–600ms */}
      <Animated.View
        style={[
          styles.fractureLine,
          fractureAnimatedStyle,
        ]}
        pointerEvents="none"
      >
        <View style={styles.fractureLineInner} />
      </Animated.View>

      {/* Left silhouette: 120×320, right edge on fracture, opacity 600–900ms */}
      <Animated.View style={[styles.leftSilhouette, leftSilhouetteAnimatedStyle]} pointerEvents="none">
        <View style={styles.leftSilhouetteRect} />
      </Animated.View>

      {/* Right silhouette: 120×340, left edge on fracture, opacity 600–900ms */}
      <Animated.View style={[styles.rightSilhouette, rightSilhouetteAnimatedStyle]} pointerEvents="none">
        <View style={styles.rightSilhouetteRect} />
      </Animated.View>

      {/* Tagline: 65% from top, opacity 1200–1700ms */}
      <Animated.Text style={[styles.tagline, taglineAnimatedStyle]} pointerEvents="none">
        Your rival is you — one week ahead.
      </Animated.Text>

      {/* Fade to black: 2200–2500ms */}
      <Animated.View style={[styles.fadeToBlack, fadeToBlackAnimatedStyle]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  fractureLine: {
    position: "absolute",
    left: SCREEN_WIDTH / 2 - 1,
    top: (SCREEN_HEIGHT - FRACTURE_HEIGHT) / 2,
    width: 2,
    height: FRACTURE_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    transformOrigin: "center",
  },
  fractureLineInner: {
    width: 2,
    height: FRACTURE_HEIGHT,
    backgroundColor: FRACTURE_COLOR,
    shadowColor: FRACTURE_COLOR,
    shadowOpacity: 0.8,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  leftSilhouette: {
    position: "absolute",
    left: SCREEN_WIDTH / 2 - 120 - 2,
    top: (SCREEN_HEIGHT - 320) / 2,
    width: 120,
    height: 320,
  },
  leftSilhouetteRect: {
    width: 120,
    height: 320,
    backgroundColor: "rgba(30,35,51,0.6)",
  },
  rightSilhouette: {
    position: "absolute",
    left: SCREEN_WIDTH / 2 + 2,
    top: (SCREEN_HEIGHT - 340) / 2,
    width: 120,
    height: 340,
  },
  rightSilhouetteRect: {
    width: 120,
    height: 340,
    backgroundColor: "rgba(30,35,51,0.8)",
  },
  tagline: {
    position: "absolute",
    left: (SCREEN_WIDTH - 280) / 2,
    top: SCREEN_HEIGHT * 0.65,
    width: 280,
    fontFamily: "Inter_400Regular",
    fontSize: 18,
    fontWeight: "400",
    color: COLORS.text,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  fadeToBlack: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },
});
