/**
 * Twin Introduction — final onboarding screen. Premium dark cinematic design,
 * dual character arena, fracture line, Twin message, Begin → NotificationPermission.
 * No back button. No scroll. Everything fits in viewport.
 */

import React, { useEffect, useLayoutEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  Platform,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { dispatchResetToMain } from "../navigation/resetToMain";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import Svg, { Path, Line } from "react-native-svg";
import type { OnboardingStackParamList } from "../navigation/types";
import { NOTIF_PERMISSION_ASKED_KEY } from "../constants/notificationPermission";
import { useOnboardingAnswers } from "../context/OnboardingAnswersContext";
import { useUserStore } from "@/store/userStore";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const ARENA_HEIGHT = SCREEN_HEIGHT * 0.52;
const CHAR_WIDTH = 130;
const CHAR_HEIGHT = 180;
const TWIN_INTRO_USER_IMAGE = require("../../assets/images/onboarding/twin_intro_user.png.png");
const TWIN_INTRO_TWIN_IMAGE = require("../../assets/images/onboarding/twin_intro_twin.png.png");

/**
 * First Shadow Twin line on Twin Introduction — voice-led by archetype (not Q13 commitment).
 * Short, cinematic, a little sharp; invites rivalry without guilt.
 */
const ARCHETYPE_TWIN_INTRO_MESSAGES: Record<string, string> = {
  "The Restless Creator":
    "You finally showed up. I've been here. When the new wears off — I'll still be repeating. The question is whether you will.",
  "The Reluctant Achiever":
    "You already know what to do. You keep waiting for a cleaner moment that won't come. I don't wait. I show up anyway.",
  "The Structured Climber":
    "Good. I'm ahead. You love a plan — so do I. The gap isn't theory; it's whether you execute when the plan gets uncomfortable.",
  "The Lone Wolf":
    "You work alone. So do I. No crowd, no applause — just two people at the same line. We'll see who keeps the pace.",
  "The Social Performer":
    "You care what they think. I only care what the data says. Same scoreboard — different mirrors. Make it count.",
};

const DEFAULT_TWIN_MESSAGE =
  "Same start. Different story — depending on whether you keep showing up when it's quiet.";

/** Resolve intro copy from archetype label (case-insensitive if backend casing differs). */
function getTwinIntroductionMessage(archetype: string | undefined | null): string {
  if (!archetype?.trim()) return DEFAULT_TWIN_MESSAGE;
  const key = archetype.trim();
  if (ARCHETYPE_TWIN_INTRO_MESSAGES[key]) return ARCHETYPE_TWIN_INTRO_MESSAGES[key];
  const lower = key.toLowerCase();
  const hit = Object.entries(ARCHETYPE_TWIN_INTRO_MESSAGES).find(
    ([k]) => k.toLowerCase() === lower
  );
  return hit ? hit[1] : DEFAULT_TWIN_MESSAGE;
}

type Route = RouteProp<OnboardingStackParamList, "TwinIntroduction">;

function BeginArrowIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Line x1={2} y1={8} x2={10} y2={8} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
      <Path
        d="M10 5l4 3-4 3"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TwinIntroductionScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { answers, archetypeContent } = useOnboardingAnswers();
  const profile = useUserStore((s) => s.profile);
  const params = route.params;
  const username = profile?.username ?? answers?.username ?? "You";
  const userStageName = profile?.character_stage_name ?? "The Awakened";
  const archetype = params?.archetype ?? archetypeContent?.archetype;
  /** Always archetype-led — not the API / Q13 commitment line. */
  const twinFirstMessage = getTwinIntroductionMessage(archetype);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false, title: "" });
  }, [navigation]);

  const fractureHeight = useSharedValue(0);
  const userOpacity = useSharedValue(0);
  const userTranslateX = useSharedValue(-12);
  const twinOpacity = useSharedValue(0);
  const twinTranslateX = useSharedValue(12);
  const labelsOpacity = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(20);
  const taglineOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    const easeOut = Easing.out(Easing.ease);
    fractureHeight.value = withDelay(0, withTiming(ARENA_HEIGHT, { duration: 400, easing: easeOut }));
    userOpacity.value = withDelay(200, withTiming(0.82, { duration: 400, easing: easeOut }));
    userTranslateX.value = withDelay(200, withTiming(0, { duration: 400, easing: easeOut }));
    twinOpacity.value = withDelay(400, withTiming(1, { duration: 400, easing: easeOut }));
    twinTranslateX.value = withDelay(400, withTiming(0, { duration: 400, easing: easeOut }));
    labelsOpacity.value = withDelay(600, withTiming(1, { duration: 300, easing: easeOut }));
    cardOpacity.value = withDelay(900, withTiming(1, { duration: 400, easing: easeOut }));
    cardTranslateY.value = withDelay(900, withTiming(0, { duration: 400, easing: easeOut }));
    taglineOpacity.value = withDelay(1300, withTiming(1, { duration: 300, easing: easeOut }));
    buttonOpacity.value = withDelay(1600, withTiming(1, { duration: 400, easing: easeOut }));
  }, []);

  const fractureStyle = useAnimatedStyle(() => ({
    height: fractureHeight.value,
  }));

  const userStyle = useAnimatedStyle(() => ({
    opacity: userOpacity.value,
    transform: [{ translateX: userTranslateX.value }],
  }));

  const twinStyle = useAnimatedStyle(() => ({
    opacity: twinOpacity.value,
    transform: [{ translateX: twinTranslateX.value }],
  }));

  const labelsStyle = useAnimatedStyle(() => ({ opacity: labelsOpacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));
  const buttonStyle = useAnimatedStyle(() => ({ opacity: buttonOpacity.value }));

  const goToNotificationPermission = async () => {
    const asked = await AsyncStorage.getItem(NOTIF_PERMISSION_ASKED_KEY);
    if (asked) {
      dispatchResetToMain(navigation);
      return;
    }
    (navigation as { navigate: (name: string) => void }).navigate("NotificationPermission");
  };

  const fractureColors = [
    "transparent",
    "rgba(192,132,252,0.60)",
    "#C084FC",
    "#C084FC",
    "rgba(192,132,252,0.60)",
    "transparent",
  ];
  const fractureLocations = [0, 0.2, 0.4, 0.6, 0.8, 1];

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#07080F", "#0A0B18", "#06070C"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeContent} edges={["top"]}>
      <View style={styles.arenaZone}>
        {/* Atmosphere glows — linear approximation (no radial in RN) */}
        <View style={styles.glowLeft} pointerEvents="none">
          <LinearGradient
            colors={["rgba(80,20,160,0.20)", "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View style={styles.glowRight} pointerEvents="none">
          <LinearGradient
            colors={["rgba(40,20,120,0.28)", "transparent"]}
            start={{ x: 1, y: 0.5 }}
            end={{ x: 0, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={styles.splitRow}>
          {/* User half */}
          <Animated.View style={[styles.half, styles.userHalf, userStyle]}>
            <View style={styles.charWrap}>
              <Image source={TWIN_INTRO_USER_IMAGE} style={styles.characterImage} resizeMode="contain" />
              <Text style={styles.youLabel}>YOU</Text>
            </View>
            <Animated.View style={[styles.labelsWrap, labelsStyle]}>
              <Text style={styles.userName} numberOfLines={1}>
                {username}
              </Text>
              <Text style={styles.stageUser}>{userStageName}</Text>
            </Animated.View>
          </Animated.View>

          {/* Fracture line — draws from top */}
          <Animated.View style={[styles.fractureWrap, fractureStyle]}>
            <LinearGradient
              colors={fractureColors}
              locations={fractureLocations}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.fractureLine}
            />
          </Animated.View>

          {/* Twin half */}
          <Animated.View style={[styles.half, styles.twinHalf, twinStyle]}>
            <View style={styles.charWrap}>
              <Image source={TWIN_INTRO_TWIN_IMAGE} style={styles.characterImage} resizeMode="contain" />
              <Text style={styles.twinCharLabel}>TWIN</Text>
            </View>
            <Animated.View style={[styles.labelsWrap, labelsStyle]}>
              <Text style={styles.twinName}>Shadow Twin</Text>
            <Text style={styles.stageTwin}>{userStageName}</Text>
            </Animated.View>
          </Animated.View>
        </View>
      </View>

      <View style={styles.contentZone}>
        <Animated.View style={[styles.taglineWrap, taglineStyle]}>
          <Text style={styles.tagline1}>Same start.</Text>
          <Text style={styles.tagline2}>Different story — depending on you.</Text>
        </Animated.View>

        <Animated.View style={[styles.twinCard, cardStyle]}>
          <View style={styles.twinCardRim} />
          <Text style={styles.twinCardLabel}>Your Twin</Text>
          <Text style={styles.twinCardMessage}>{twinFirstMessage}</Text>
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.ctaWrap,
          { paddingBottom: insets.bottom + 16 },
          buttonStyle,
        ]}
      >
        <Pressable onPress={goToNotificationPermission} style={styles.button}>
          <LinearGradient
            colors={["#5B21B6", "#8B5CF6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonLabel}>Begin</Text>
            <BeginArrowIcon />
          </LinearGradient>
        </Pressable>
      </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  safeContent: {
    flex: 1,
  },
  arenaZone: {
    height: ARENA_HEIGHT,
    flexDirection: "row",
    position: "relative",
    overflow: "hidden",
  },
  glowLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "50%",
  },
  glowRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "50%",
  },
  splitRow: {
    flex: 1,
    flexDirection: "row",
    position: "relative",
  },
  half: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    position: "relative",
    zIndex: 1,
  },
  userHalf: {
    paddingBottom: 16,
    paddingRight: 12,
  },
  twinHalf: {
    paddingBottom: 16,
    paddingLeft: 12,
  },
  charWrap: {
    position: "relative",
  },
  characterImage: {
    width: CHAR_WIDTH,
    height: CHAR_HEIGHT,
    ...Platform.select({
      ios: {
        shadowColor: "rgba(50,20,120,0.22)",
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 6 },
    }),
  },
  youLabel: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    color: "rgba(107,114,128,0.4)",
    textAlign: "center",
  },
  twinCharLabel: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    color: "rgba(192,132,252,0.50)",
    textAlign: "center",
  },
  labelsWrap: {
    marginTop: 8,
    alignItems: "center",
    textAlign: "center",
  },
  userName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9CA3AF",
    textAlign: "center",
  },
  stageUser: {
    fontSize: 11,
    color: "#4B5563",
    marginTop: 1,
    textAlign: "center",
  },
  twinName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8B5CF6",
    textAlign: "center",
  },
  stageTwin: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 1,
    textAlign: "center",
  },
  fractureWrap: {
    position: "absolute",
    top: 0,
    left: "50%",
    marginLeft: -1,
    width: 2,
    zIndex: 10,
    overflow: "hidden",
  },
  fractureLine: {
    width: 2,
    height: ARENA_HEIGHT,
    ...Platform.select({
      ios: {
        shadowColor: "#C084FC",
        shadowOpacity: 0.7,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 8 },
    }),
  },
  contentZone: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    justifyContent: "flex-start",
    position: "relative",
    zIndex: 1,
  },
  taglineWrap: {
    marginBottom: 16,
  },
  tagline1: {
    fontSize: 18,
    fontWeight: "800",
    color: "#E5E7EB",
    letterSpacing: -0.3,
    lineHeight: 18 * 1.3,
    textAlign: "center",
  },
  tagline2: {
    fontSize: 18,
    fontWeight: "800",
    color: "#A78BFA",
    letterSpacing: -0.3,
    lineHeight: 18 * 1.3,
    textAlign: "center",
  },
  twinCard: {
    backgroundColor: "rgba(10,8,22,0.70)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.28)",
    borderLeftWidth: 3,
    borderLeftColor: "#8B5CF6",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    position: "relative",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "rgba(109,40,217,0.10)",
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 4 },
    }),
  },
  twinCardRim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(139,92,246,0.08)",
  },
  twinCardLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#8B5CF6",
    marginBottom: 6,
  },
  twinCardMessage: {
    fontSize: 14,
    fontWeight: "400",
    color: "#C4B5FD",
    fontStyle: "italic",
    lineHeight: 14 * 1.55,
  },
  ctaWrap: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  button: {
    height: 56,
    borderRadius: 18,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "rgba(139,92,246,0.40)",
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 8 },
    }),
  },
  buttonGradient: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
});
