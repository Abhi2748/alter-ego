/**
 * 7-Day Mirror — full-screen modal (day 7+), data from GET /api/v1/profile/mirror.
 * Staggered Reanimated reveals; gradient numeral, particles, ambient glow, fracture line.
 */
import React, { useEffect } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from "react-native";
import type { ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import type { AnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MirrorObservation } from "@/services/profile";
import { COLORS, GRADIENTS } from "@/constants/theme";

const { width: SW } = Dimensions.get("window");

/** ms between each stagger step (spec) */
const STAGGER_MS = 500;
/** Fade + lift duration per step */
const STEP_DURATION_MS = 500;
const EASE = Easing.out(Easing.cubic);

interface SevenDayMirrorProps {
  visible: boolean;
  observations: MirrorObservation[];
  closingLine: string;
  onDismiss: () => void;
}

const PARTICLES = [
  { left: "18%", bottom: "15%", size: 2, delay: 0, duration: 8000, dx: 6 },
  { left: "35%", bottom: "22%", size: 3, delay: 1200, duration: 11000, dx: -8 },
  { left: "55%", bottom: "18%", size: 2, delay: 2800, duration: 9000, dx: 10 },
  { left: "72%", bottom: "30%", size: 2, delay: 500, duration: 13000, dx: -5 },
  { left: "82%", bottom: "12%", size: 3, delay: 3500, duration: 10000, dx: 7 },
  { left: "8%", bottom: "25%", size: 2, delay: 1800, duration: 12000, dx: -9 },
  { left: "45%", bottom: "35%", size: 2, delay: 4200, duration: 14000, dx: 4 },
  { left: "62%", bottom: "8%", size: 3, delay: 2100, duration: 9500, dx: -6 },
] as const;

function Particle({
  config,
  active,
}: {
  config: (typeof PARTICLES)[number];
  active: boolean;
}) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(translateY);
      cancelAnimation(translateX);
      cancelAnimation(opacity);
      translateY.value = 0;
      translateX.value = 0;
      opacity.value = 0;
      return;
    }

    const D = config.duration;
    const rise = D;
    const fadeIn = Math.max(120, D * 0.15);
    const fadeOut = Math.max(100, D * 0.2);
    const pause = Math.max(80, D * 0.12);
    const holdOpaque = Math.max(0, rise - fadeIn - fadeOut);

    translateY.value = withDelay(
      config.delay,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(-100, { duration: rise, easing: Easing.linear }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      )
    );
    translateX.value = withDelay(
      config.delay,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(config.dx, { duration: rise, easing: Easing.linear }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      config.delay,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(0.55, { duration: fadeIn, easing: EASE }),
          withTiming(0.55, { duration: holdOpaque, easing: Easing.linear }),
          withTiming(0, { duration: fadeOut, easing: EASE }),
          withTiming(0, { duration: pause })
        ),
        -1,
        false
      )
    );
  }, [active, config.delay, config.duration, config.dx]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { translateX: translateX.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          left: config.left as `${number}%`,
          bottom: config.bottom as `${number}%`,
        },
        style,
      ]}
      pointerEvents="none"
    />
  );
}

function renderObservationInline(obs: MirrorObservation): React.ReactNode[] {
  const text = obs.text;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  while (cursor < text.length) {
    let bestIdx = text.length;
    let bestLen = 0;
    let bestType: "bold" | "violet" = "bold";
    const hay = text.slice(cursor).toLowerCase();

    for (const s of obs.bold_segments) {
      if (!s) continue;
      const rel = hay.indexOf(s.toLowerCase());
      if (rel === -1) continue;
      const abs = cursor + rel;
      if (abs < bestIdx || (abs === bestIdx && s.length > bestLen)) {
        bestIdx = abs;
        bestLen = s.length;
        bestType = "bold";
      }
    }
    for (const s of obs.violet_segments) {
      if (!s) continue;
      const rel = hay.indexOf(s.toLowerCase());
      if (rel === -1) continue;
      const abs = cursor + rel;
      if (abs < bestIdx || (abs === bestIdx && s.length > bestLen)) {
        bestIdx = abs;
        bestLen = s.length;
        bestType = "violet";
      }
    }

    if (bestIdx >= text.length) {
      parts.push(
        <Text key={key++} style={styles.obsNormal}>
          {text.slice(cursor)}
        </Text>
      );
      break;
    }

    if (bestIdx > cursor) {
      parts.push(
        <Text key={key++} style={styles.obsNormal}>
          {text.slice(cursor, bestIdx)}
        </Text>
      );
    }

    const slice = text.slice(bestIdx, bestIdx + bestLen);
    parts.push(
      <Text key={key++} style={bestType === "bold" ? styles.obsBold : styles.obsViolet}>
        {slice}
      </Text>
    );
    cursor = bestIdx + bestLen;
  }

  return parts;
}

function ObsCard({
  obs,
  animStyle,
}: {
  obs: MirrorObservation;
  animStyle: AnimatedStyle<ViewStyle>;
}) {
  return (
    <Animated.View style={[styles.obsCard, animStyle]}>
      <View style={styles.obsAccent} />
      <Text style={styles.obsIcon}>◎</Text>
      <Text style={styles.obsText}>{renderObservationInline(obs)}</Text>
    </Animated.View>
  );
}

export function SevenDayMirror({
  visible,
  observations,
  closingLine,
  onDismiss,
}: SevenDayMirrorProps) {
  const insets = useSafeAreaInsets();

  const op0 = useSharedValue(0);
  const op1 = useSharedValue(0);
  const op2 = useSharedValue(0);
  const op3 = useSharedValue(0);
  const op4 = useSharedValue(0);
  const op5 = useSharedValue(0);
  const op6 = useSharedValue(0);
  const op7 = useSharedValue(0);
  const op8 = useSharedValue(0);
  const op9 = useSharedValue(0);

  const ty0 = useSharedValue(10);
  const ty1 = useSharedValue(10);
  const ty2 = useSharedValue(10);
  const ty3 = useSharedValue(10);
  const ty4 = useSharedValue(10);
  const ty5 = useSharedValue(10);
  const ty6 = useSharedValue(10);
  const ty7 = useSharedValue(10);
  const ty8 = useSharedValue(10);
  const ty9 = useSharedValue(10);

  const opVals = [op0, op1, op2, op3, op4, op5, op6, op7, op8, op9];
  const tyVals = [ty0, ty1, ty2, ty3, ty4, ty5, ty6, ty7, ty8, ty9];

  useEffect(() => {
    opVals.forEach((v) => cancelAnimation(v));
    tyVals.forEach((v) => cancelAnimation(v));

    if (!visible) {
      opVals.forEach((v) => {
        v.value = 0;
      });
      tyVals.forEach((v) => {
        v.value = 10;
      });
      return;
    }

    const anim = { duration: STEP_DURATION_MS, easing: EASE };
    opVals.forEach((v, i) => {
      v.value = withDelay(i * STAGGER_MS, withTiming(1, anim));
    });
    tyVals.forEach((v, i) => {
      v.value = withDelay(i * STAGGER_MS, withTiming(0, anim));
    });
  }, [visible]);

  const s0 = useAnimatedStyle(() => ({
    opacity: op0.value,
    transform: [{ translateY: ty0.value }],
  }));
  const s1 = useAnimatedStyle(() => ({
    opacity: op1.value,
    transform: [{ translateY: ty1.value }],
  }));
  const s2 = useAnimatedStyle(() => ({
    opacity: op2.value,
    transform: [{ translateY: ty2.value }],
  }));
  const s3 = useAnimatedStyle(() => ({
    opacity: op3.value,
    transform: [{ translateY: ty3.value }],
  }));
  const s4 = useAnimatedStyle(() => ({
    opacity: op4.value,
    transform: [{ translateY: ty4.value }],
  }));
  const s5 = useAnimatedStyle(() => ({
    opacity: op5.value,
    transform: [{ translateY: ty5.value }],
  }));
  const s6 = useAnimatedStyle(() => ({
    opacity: op6.value,
    transform: [{ translateY: ty6.value }],
  }));
  const s7 = useAnimatedStyle(() => ({
    opacity: op7.value,
    transform: [{ translateY: ty7.value }],
  }));
  const s8 = useAnimatedStyle(() => ({
    opacity: op8.value,
    transform: [{ translateY: ty8.value }],
  }));
  const s9 = useAnimatedStyle(() => ({
    opacity: op9.value,
    transform: [{ translateY: ty9.value }],
  }));

  const obsStyles = [s4, s5, s6, s7];

  if (!visible) {
    return null;
  }

  const padTop = Math.max(insets.top, 16) + 44;
  const padBottom = Math.max(insets.bottom, 24) + 24;

  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="none">
      <LinearGradient
        colors={[COLORS.bg1, COLORS.bg0]}
        start={GRADIENTS.background.start}
        end={GRADIENTS.background.end}
        style={[styles.overlayRoot, { paddingTop: padTop, paddingBottom: padBottom }]}
      >
        <LinearGradient
          colors={["transparent", "rgba(109,40,217,0.1)", "rgba(76,29,149,0.06)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.ambientGlow}
          pointerEvents="none"
        />

        <LinearGradient
          colors={["transparent", COLORS.violetLine, "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.crackLine}
          pointerEvents="none"
        />

        {PARTICLES.map((p, i) => (
          <Particle key={i} config={p} active={visible} />
        ))}

        <View style={styles.content}>
          <Animated.View style={[styles.badge, s0]}>
            <View style={styles.badgeLine} />
            <Text style={styles.badgeText}>DAY 7</Text>
            <View style={[styles.badgeLine, { transform: [{ scaleX: -1 }] }]} />
          </Animated.View>

          <Animated.View style={[styles.numberWrap, s1]}>
            <MaskedView
              style={styles.numberMaskWrap}
              maskElement={
                <View style={styles.numberMaskInner}>
                  <Text style={styles.numberMaskText}>7</Text>
                </View>
              }
            >
              <LinearGradient
                colors={[COLORS.violetDeep, COLORS.violet, COLORS.violetGlow]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </MaskedView>
          </Animated.View>

          <Animated.View style={[styles.daysRow, s2]}>
            <Text style={styles.daysWord}>DAYS</Text>
            <View style={styles.hDivider} />
          </Animated.View>

          <Animated.Text style={[styles.intro, s3]}>Here is what I know about you.</Animated.Text>

          <View style={styles.obsList}>
            {observations.slice(0, 4).map((obs, i) => (
              <ObsCard key={`${i}-${obs.text.slice(0, 24)}`} obs={obs} animStyle={obsStyles[i]} />
            ))}
          </View>

          <Animated.View style={[styles.closingWrap, s8]}>
            <LinearGradient
              colors={["transparent", COLORS.violetLine, "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.closingLineGrad}
            />
            <Text style={styles.closingText}>{closingLine}</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.continueWrap, s9]}>
          <Pressable
            style={({ pressed }) => [styles.continueBtn, pressed && styles.continueBtnPressed]}
            onPress={onDismiss}
          >
            <Text style={styles.continueTxt}>Continue</Text>
            <Text style={styles.continueArrow}>→</Text>
          </Pressable>
        </Animated.View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 28,
  },
  ambientGlow: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
  },
  crackLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: SW / 2 - 1,
    width: 2,
    opacity: 0.35,
  },
  particle: {
    position: "absolute",
    backgroundColor: "rgba(167,139,250,0.5)",
  },
  content: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    minHeight: 0,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  badgeLine: {
    width: 28,
    height: 1,
    backgroundColor: "rgba(167,139,250,0.35)",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 4,
    color: "rgba(167,139,250,0.5)",
    fontFamily: "Inter_700Bold",
  },
  numberWrap: {
    marginBottom: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  numberMaskWrap: {
    height: 88,
    width: 72,
    justifyContent: "center",
    alignItems: "center",
  },
  numberMaskInner: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  numberMaskText: {
    fontSize: 88,
    fontWeight: "800",
    letterSpacing: -5,
    lineHeight: 88,
    color: "#000000",
    fontFamily: "Inter_800ExtraBold",
    textAlign: "center",
  },
  daysRow: {
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  daysWord: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 5,
    color: "rgba(167,139,250,0.35)",
    fontFamily: "Inter_600SemiBold",
  },
  hDivider: {
    width: 48,
    height: 1,
    backgroundColor: "rgba(139,92,246,0.2)",
  },
  intro: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(229,231,235,0.45)",
    fontStyle: "italic",
    textAlign: "center",
    letterSpacing: 0.3,
    marginBottom: 16,
    fontFamily: "Inter_400Regular_Italic",
    paddingHorizontal: 8,
  },
  obsList: {
    width: "100%",
    gap: 9,
    marginBottom: 16,
    flexShrink: 1,
  },
  obsCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(255,255,255,0.025)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.1)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    paddingLeft: 14,
    gap: 8,
    position: "relative",
    overflow: "hidden",
  },
  obsAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "rgba(139,92,246,0.35)",
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  obsIcon: {
    fontSize: 12,
    color: "rgba(167,139,250,0.4)",
    marginTop: 1,
    flexShrink: 0,
  },
  obsText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  obsNormal: {
    color: "rgba(229,231,235,0.7)",
    fontWeight: "400",
    fontSize: 12,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  obsBold: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 19,
    fontFamily: "Inter_700Bold",
  },
  obsViolet: {
    color: "rgba(167,139,250,0.9)",
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 19,
    fontFamily: "Inter_600SemiBold",
  },
  closingWrap: {
    alignItems: "center",
    gap: 10,
    marginTop: "auto",
  },
  closingLineGrad: {
    width: 2,
    height: 20,
    opacity: 0.5,
  },
  closingText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    color: "rgba(167,139,250,0.4)",
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  continueWrap: {
    width: "100%",
    marginTop: 12,
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(139,92,246,0.08)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.18)",
    borderRadius: 10,
    paddingVertical: 14,
    minHeight: 48,
  },
  continueBtnPressed: {
    opacity: 0.85,
  },
  continueTxt: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(167,139,250,0.7)",
    letterSpacing: 0.5,
    fontFamily: "Inter_600SemiBold",
  },
  continueArrow: {
    fontSize: 14,
    color: "rgba(139,92,246,0.5)",
  },
});
