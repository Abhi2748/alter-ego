/**
 * Screen 15 — Twin Introduction. Shadow Twin fully introduced. User and Twin side by side.
 * Gap established. Last screen before main app. No back button.
 * Gender is not used for any visual — character art is always character_1_male (analytics only).
 */

import React, { useEffect, useLayoutEffect } from "react";
import { View, Text, StyleSheet, Dimensions, Pressable, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp, CommonActions } from "@react-navigation/native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import type { OnboardingStackParamList } from "../navigation/types";
import { COLORS, SPACING, RADIUS, GRADIENTS, SHADOWS } from "../constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const TOP_ZONE_HEIGHT = SCREEN_HEIGHT * 0.35;
const CHAR_PLACEHOLDER_WIDTH = 140;
const CHAR_PLACEHOLDER_HEIGHT = 180;
const BUTTON_WIDTH = 358;
const BUTTON_HEIGHT = 56;

const DEFAULT_TWIN_MESSAGE =
  '"I\'m glad you\'re here. We have a long way to grow. Let\'s see what you\'re actually made of."';

type Route = RouteProp<OnboardingStackParamList, "TwinIntroduction">;

export function TwinIntroductionScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const params = route.params;
  const username = "You";
  const twinFirstMessage = params?.twinFirstMessage ?? DEFAULT_TWIN_MESSAGE;
  // Character art: use placeholder until assets/images/characters/character_1_male.png exists
  const characterSource = { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQwAADgAHA/j+5qQAAAABJRU5ErkJggg==" };

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false, title: "" });
  }, [navigation]);

  const fractureScaleY = useSharedValue(0);
  const userOpacity = useSharedValue(0);
  const userTranslateX = useSharedValue(-12);
  const twinOpacity = useSharedValue(0);
  const twinTranslateX = useSharedValue(12);
  const gapTextOpacity = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(20);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    const easeOut = Easing.out(Easing.ease);
    fractureScaleY.value = withDelay(0, withTiming(1, { duration: 400, easing: easeOut }));
    userOpacity.value = withDelay(200, withTiming(0.85, { duration: 400, easing: easeOut }));
    userTranslateX.value = withDelay(200, withTiming(0, { duration: 400, easing: easeOut }));
    twinOpacity.value = withDelay(400, withTiming(1, { duration: 400, easing: easeOut }));
    twinTranslateX.value = withDelay(400, withTiming(0, { duration: 400, easing: easeOut }));
    gapTextOpacity.value = withDelay(600, withTiming(1, { duration: 300, easing: easeOut }));
    cardOpacity.value = withDelay(900, withTiming(1, { duration: 400, easing: easeOut }));
    cardTranslateY.value = withDelay(900, withTiming(0, { duration: 400, easing: easeOut }));
    buttonOpacity.value = withDelay(1300, withTiming(1, { duration: 300, easing: easeOut }));
  }, []);

  const fractureStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: fractureScaleY.value }],
  }));
  const userStyle = useAnimatedStyle(() => ({
    opacity: userOpacity.value,
    transform: [{ translateX: userTranslateX.value }],
  }));
  const twinStyle = useAnimatedStyle(() => ({
    opacity: twinOpacity.value,
    transform: [{ translateX: twinTranslateX.value }],
  }));
  const gapTextStyle = useAnimatedStyle(() => ({ opacity: gapTextOpacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));
  const buttonStyle = useAnimatedStyle(() => ({ opacity: buttonOpacity.value }));

  const goToMain = () => {
    type NavWithParent = ReturnType<typeof useNavigation> & {
      getParent?: () => NavWithParent | undefined;
      dispatch: (action: { type: string; payload?: unknown }) => void;
    };
    let nav: NavWithParent | undefined = navigation as NavWithParent;
    while (nav?.getParent?.()) {
      nav = nav.getParent();
    }
    nav?.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Main" }],
      })
    );
  };

  return (
    <LinearGradient
      colors={[COLORS.bg1, COLORS.bg0]}
      style={styles.gradientRoot}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.topZone}>
          <View style={styles.splitRow}>
            <Animated.View style={[styles.half, styles.leftHalf, userStyle]}>
              <LinearGradient
                colors={["#1E2333", "#141824"]}
                style={styles.charPlaceholder}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              >
                <Text style={styles.placeholderLabel}>YOU</Text>
              </LinearGradient>
              <Text style={styles.userName}>{username}</Text>
              <Text style={styles.stageMuted}>The Awakened</Text>
            </Animated.View>

            <Animated.View style={[styles.fractureWrap, fractureStyle]}>
              <LinearGradient
                colors={GRADIENTS.fractureLine.colors}
                start={GRADIENTS.fractureLine.start}
                end={GRADIENTS.fractureLine.end}
                style={styles.fractureLine}
              />
            </Animated.View>

            <Animated.View style={[styles.half, styles.rightHalf, twinStyle]}>
              <View style={styles.charWrap}>
                <Image source={characterSource} style={styles.charImage} resizeMode="cover" />
              </View>
              <Text style={styles.twinLabel}>Shadow Twin</Text>
              <Text style={styles.stageTwin}>The Focused</Text>
            </Animated.View>
          </View>
        </View>

        <View style={styles.centerContent}>
          <View style={styles.gapLine} />
          <Animated.Text style={[styles.gapText, gapTextStyle]}>
            Your rival is you — one week ahead.
          </Animated.Text>
          <View style={styles.gapBelow} />

          <Animated.View style={[styles.twinCard, cardStyle]}>
            <Text style={styles.twinCardLabel}>Your Twin</Text>
            <Text style={styles.twinCardMessage}>{twinFirstMessage}</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.buttonWrap, { bottom: insets.bottom + 32 }, buttonStyle]}>
          <Pressable onPress={goToMain} style={styles.button}>
            <LinearGradient
              colors={GRADIENTS.button.colors}
              start={GRADIENTS.button.start}
              end={GRADIENTS.button.end}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonLabel}>Begin →</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientRoot: { position: "relative", flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: SPACING.screenPadding },
  topZone: {
    height: TOP_ZONE_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  half: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  leftHalf: {},
  rightHalf: {},
  charPlaceholder: {
    width: CHAR_PLACEHOLDER_WIDTH,
    height: CHAR_PLACEHOLDER_HEIGHT,
    borderRadius: RADIUS.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: COLORS.text2,
    letterSpacing: 1,
  },
  charWrap: {
    width: CHAR_PLACEHOLDER_WIDTH,
    height: CHAR_PLACEHOLDER_HEIGHT,
    borderRadius: RADIUS.card,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
  },
  charImage: {
    width: CHAR_PLACEHOLDER_WIDTH,
    height: CHAR_PLACEHOLDER_HEIGHT,
  },
  userName: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.text2,
    marginTop: SPACING.sm,
  },
  stageMuted: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.muted,
  },
  twinLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.violet,
    marginTop: SPACING.sm,
  },
  stageTwin: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.text2,
  },
  fractureWrap: {
    width: 2,
    height: TOP_ZONE_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fractureLine: {
    width: 2,
    height: "100%",
    shadowColor: "#C084FC",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  centerContent: {
    flex: 1,
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: SPACING.lg,
    paddingBottom: 120,
  },
  gapLine: {
    height: 1,
    backgroundColor: COLORS.surface2,
    width: "100%",
    marginBottom: SPACING.lg,
  },
  gapText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
  },
  gapBelow: { height: SPACING.sm },
  twinCard: {
    backgroundColor: "#141824",
    borderRadius: 16,
    padding: 16,
    width: "100%",
    borderLeftWidth: 3,
    borderLeftColor: "#8B5CF6",
    marginTop: SPACING.lg,
  },
  twinCardLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    fontWeight: "500",
    color: "#8B5CF6",
    marginBottom: 8,
  },
  twinCardMessage: {
    fontFamily: "Inter_400Regular_Italic",
    fontSize: 15,
    fontWeight: "400",
    color: "#E5E7EB",
    fontStyle: "italic",
  },
  buttonWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
  },
  button: {
    width: "100%",
    maxWidth: BUTTON_WIDTH,
    ...SHADOWS.button,
    borderRadius: RADIUS.card,
    overflow: "hidden",
    height: BUTTON_HEIGHT,
  },
  buttonGradient: {
    height: BUTTON_HEIGHT,
    borderRadius: RADIUS.card,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    fontWeight: "600",
    color: "#F3F4F6",
  },
});
