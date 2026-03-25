/**
 * Streak break ceremony — full-screen, minimal, opposite of StreakAchievementOverlay.
 * Frontend only; triggered from Home when streak hits 0 after a prior streak ≥ 3.
 */
import React, { useCallback, useEffect, useRef } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";

export interface FractureOverlayProps {
  visible: boolean;
  streakCount: number;
  archetype: string;
  onDismiss: () => void;
}

const FRACTURE_MESSAGES: Record<string, string> = {
  lone_wolf:
    "You always said you didn't need anyone pushing you. Turns out you were right. Nobody pushed you. And you stopped.",
  restless_creator:
    "That was {X} days. The longest you've committed to something since you downloaded this app. You know that, right?",
  reluctant_achiever:
    "Part of you is relieved right now. That part is why you're here.",
  structured_climber:
    "Your system didn't fail. You stopped following your system. Those are different problems.",
  social_performer:
    "Nobody saw this but me. That's either a relief or the whole problem.",
};

const FRACTURE_MESSAGE_30_PLUS =
  "You built something. It's gone now. Build it again or don't. That's the only question.";

const FRACTURE_MESSAGE_DEFAULT =
  "It stopped. That's the whole story. The next one starts now.";

function normalizeArchetypeSlug(raw: string): string {
  const t = raw.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (t.includes("lone") && t.includes("wolf")) return "lone_wolf";
  if (t.includes("restless") && t.includes("creator")) return "restless_creator";
  if (t.includes("reluctant") && t.includes("achiever")) return "reluctant_achiever";
  if (t.includes("structured") && t.includes("climber")) return "structured_climber";
  if (t.includes("social") && t.includes("performer")) return "social_performer";
  if (FRACTURE_MESSAGES[t]) return t;
  return t;
}

function getFractureMessage(archetype: string, streakCount: number): string {
  if (streakCount >= 30) return FRACTURE_MESSAGE_30_PLUS;
  const slug = normalizeArchetypeSlug(archetype);
  const template = FRACTURE_MESSAGES[slug] ?? FRACTURE_MESSAGE_DEFAULT;
  return template.replace("{X}", String(streakCount));
}

// ── Premium visuals: particles + silence pulse (logic/timing unchanged in parent) ──

const FRACTURE_PARTICLES = [
  { left: "15%", bottom: "10%", size: 2, delay: 0, dur: 9000, color: "rgba(239,68,68,0.4)" },
  { left: "32%", bottom: "18%", size: 2, delay: 1500, dur: 12000, color: "rgba(220,38,38,0.3)" },
  { left: "52%", bottom: "14%", size: 3, delay: 3000, dur: 10000, color: "rgba(239,68,68,0.25)" },
  { left: "70%", bottom: "22%", size: 2, delay: 800, dur: 14000, color: "rgba(185,28,28,0.35)" },
  { left: "82%", bottom: "8%", size: 2, delay: 4000, dur: 11000, color: "rgba(239,68,68,0.3)" },
  { left: "8%", bottom: "28%", size: 2, delay: 2000, dur: 13000, color: "rgba(220,38,38,0.25)" },
  { left: "45%", bottom: "35%", size: 2, delay: 5000, dur: 15000, color: "rgba(139,92,246,0.2)" },
  { left: "60%", bottom: "20%", size: 2, delay: 2500, dur: 11000, color: "rgba(167,139,250,0.15)" },
] as const;

function FractureParticle({
  cfg,
  visible,
}: {
  cfg: (typeof FRACTURE_PARTICLES)[number];
  visible: boolean;
}) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(translateY);
      cancelAnimation(opacity);
      translateY.value = 0;
      opacity.value = 0;
      return;
    }

    let cancelled = false;
    let timeoutOuter: ReturnType<typeof setTimeout> | undefined;
    let timeoutMid: ReturnType<typeof setTimeout> | undefined;
    let timeoutLoop: ReturnType<typeof setTimeout> | undefined;

    const loop = () => {
      if (cancelled) return;
      translateY.value = 0;
      opacity.value = 0;
      timeoutOuter = setTimeout(() => {
        if (cancelled) return;
        opacity.value = withTiming(0.7, { duration: cfg.dur * 0.15 });
        translateY.value = withTiming(-110, {
          duration: cfg.dur,
          easing: Easing.linear,
        });
        timeoutMid = setTimeout(() => {
          if (cancelled) return;
          opacity.value = withTiming(0, { duration: cfg.dur * 0.2 });
          timeoutLoop = setTimeout(loop, 300);
        }, cfg.dur * 0.75);
      }, cfg.delay);
    };
    loop();

    return () => {
      cancelled = true;
      if (timeoutOuter) clearTimeout(timeoutOuter);
      if (timeoutMid) clearTimeout(timeoutMid);
      if (timeoutLoop) clearTimeout(timeoutLoop);
    };
  }, [visible, cfg.delay, cfg.dur]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
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
          backgroundColor: cfg.color,
          left: cfg.left as `${number}%`,
          bottom: cfg.bottom as `${number}%`,
        },
        style,
      ]}
    />
  );
}

function SilenceDot() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.08);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.18, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.08, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[styles.silenceDot, style]} />;
}

export function FractureOverlay({
  visible,
  streakCount,
  archetype,
  onDismiss,
}: FractureOverlayProps) {
  const overlayOpacity = useSharedValue(0);
  const numberOpacity = useSharedValue(0);
  const digit1TranslateX = useSharedValue(0);
  const digit1TranslateY = useSharedValue(0);
  const digit1Opacity = useSharedValue(1);
  const digit2TranslateX = useSharedValue(0);
  const digit2TranslateY = useSharedValue(0);
  const digit2Opacity = useSharedValue(1);
  const messageOpacity = useSharedValue(0);
  const messageTranslateY = useSharedValue(12);
  const continueOpacity = useSharedValue(0);
  const zeroOpacity = useSharedValue(0);
  const crackFragOpacity = useSharedValue(0);
  const silenceOpacity = useSharedValue(0);

  const dismissed = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const dismiss = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    onDismissRef.current();
  }, []);

  const isShort = streakCount >= 3 && streakCount < 7;
  const isFull = streakCount >= 7;

  useEffect(() => {
    if (!visible || streakCount < 3) return;

    dismissed.current = false;

    const resetAll = () => {
      cancelAnimation(overlayOpacity);
      cancelAnimation(numberOpacity);
      cancelAnimation(digit1TranslateX);
      cancelAnimation(digit1TranslateY);
      cancelAnimation(digit1Opacity);
      cancelAnimation(digit2TranslateX);
      cancelAnimation(digit2TranslateY);
      cancelAnimation(digit2Opacity);
      cancelAnimation(messageOpacity);
      cancelAnimation(messageTranslateY);
      cancelAnimation(continueOpacity);
      cancelAnimation(zeroOpacity);
      cancelAnimation(crackFragOpacity);
      cancelAnimation(silenceOpacity);
      overlayOpacity.value = 0;
      numberOpacity.value = 0;
      digit1TranslateX.value = 0;
      digit1TranslateY.value = 0;
      digit1Opacity.value = 1;
      digit2TranslateX.value = 0;
      digit2TranslateY.value = 0;
      digit2Opacity.value = 1;
      messageOpacity.value = 0;
      messageTranslateY.value = 12;
      continueOpacity.value = 0;
      zeroOpacity.value = 0;
      crackFragOpacity.value = 0;
      silenceOpacity.value = 0;
    };

    resetAll();

    const ease = Easing.out(Easing.ease);

    overlayOpacity.value = withTiming(1, { duration: 300, easing: ease });

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (isShort) {
      numberOpacity.value = withTiming(1, { duration: 400, easing: ease });

      digit1TranslateX.value = withDelay(
        1500,
        withSpring(-20, { damping: 8, stiffness: 80 })
      );
      digit1TranslateY.value = withDelay(
        1500,
        withSpring(-8, { damping: 10, stiffness: 100 })
      );
      digit1Opacity.value = withDelay(1500, withTiming(0, { duration: 800, easing: ease }));
      digit2TranslateX.value = withDelay(
        1500,
        withSpring(18, { damping: 8, stiffness: 80 })
      );
      digit2TranslateY.value = withDelay(
        1500,
        withSpring(10, { damping: 10, stiffness: 100 })
      );
      digit2Opacity.value = withDelay(1500, withTiming(0, { duration: 800, easing: ease }));
      numberOpacity.value = withDelay(1500, withTiming(0, { duration: 600, easing: ease }));

      messageOpacity.value = withDelay(2500, withTiming(1, { duration: 600, easing: ease }));
      messageTranslateY.value = withDelay(2500, withTiming(0, { duration: 600, easing: ease }));

      continueOpacity.value = withDelay(4000, withTiming(1, { duration: 500, easing: ease }));

      timeoutId = setTimeout(() => dismiss(), 6000);
    } else if (isFull) {
      numberOpacity.value = withTiming(1, { duration: 400, easing: ease });

      const shatterDelay = 2000;
      digit1TranslateX.value = withDelay(
        shatterDelay,
        withSpring(-32, { damping: 6, stiffness: 60 })
      );
      digit1TranslateY.value = withDelay(
        shatterDelay,
        withSpring(-14, { damping: 8, stiffness: 80 })
      );
      digit1Opacity.value = withDelay(
        shatterDelay,
        withSequence(
          withTiming(1, { duration: 100 }),
          withTiming(0, { duration: 900, easing: ease })
        )
      );
      digit2TranslateX.value = withDelay(
        shatterDelay,
        withSpring(28, { damping: 6, stiffness: 60 })
      );
      digit2TranslateY.value = withDelay(
        shatterDelay,
        withSpring(18, { damping: 8, stiffness: 80 })
      );
      digit2Opacity.value = withDelay(
        shatterDelay,
        withSequence(
          withTiming(1, { duration: 100 }),
          withTiming(0, { duration: 900, easing: ease })
        )
      );
      numberOpacity.value = withDelay(shatterDelay, withTiming(0, { duration: 700, easing: ease }));

      crackFragOpacity.value = withDelay(
        2000,
        withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(0, { duration: 700, easing: ease })
        )
      );

      silenceOpacity.value = withDelay(
        3000,
        withSequence(
          withTiming(1, { duration: 400, easing: ease }),
          withDelay(1600, withTiming(0, { duration: 400, easing: ease }))
        )
      );

      messageOpacity.value = withDelay(5000, withTiming(1, { duration: 800, easing: ease }));
      messageTranslateY.value = withDelay(5000, withTiming(0, { duration: 800, easing: ease }));

      continueOpacity.value = withDelay(9000, withTiming(1, { duration: 600, easing: ease }));
      zeroOpacity.value = withDelay(9000, withTiming(1, { duration: 800, easing: ease }));

      timeoutId = setTimeout(() => dismiss(), 12000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [visible, streakCount, isShort, isFull, dismiss]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const numberStyle = useAnimatedStyle(() => ({
    opacity: numberOpacity.value,
  }));

  const digit1Style = useAnimatedStyle(() => ({
    opacity: digit1Opacity.value,
    transform: [
      { translateX: digit1TranslateX.value },
      { translateY: digit1TranslateY.value },
    ],
  }));

  const digit2Style = useAnimatedStyle(() => ({
    opacity: digit2Opacity.value,
    transform: [
      { translateX: digit2TranslateX.value },
      { translateY: digit2TranslateY.value },
    ],
  }));

  const messageStyle = useAnimatedStyle(() => ({
    opacity: messageOpacity.value,
    transform: [{ translateY: messageTranslateY.value }],
  }));

  const continueStyle = useAnimatedStyle(() => ({
    opacity: continueOpacity.value,
  }));

  const zeroStyle = useAnimatedStyle(() => ({
    opacity: zeroOpacity.value,
  }));

  const crackFragStyle = useAnimatedStyle(() => ({
    opacity: crackFragOpacity.value,
  }));

  const silenceStyle = useAnimatedStyle(() => ({
    opacity: silenceOpacity.value,
  }));

  if (!visible || streakCount < 3) return null;

  const message = getFractureMessage(archetype, streakCount);
  const streakStr = String(streakCount);
  const midpoint = Math.ceil(streakStr.length / 2);
  const part1 = streakStr.slice(0, midpoint);
  const part2 = streakStr.slice(midpoint) || null;

  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="none">
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss}>
        <Animated.View style={[styles.overlay, overlayStyle]}>
          <LinearGradient
            colors={["transparent", "rgba(127,29,29,0.15)", "rgba(185,28,28,0.08)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.ambientGlow}
            pointerEvents="none"
          />

          <View style={styles.crackLine} pointerEvents="none" />

          {FRACTURE_PARTICLES.map((cfg, i) => (
            <FractureParticle key={i} cfg={cfg} visible={visible} />
          ))}

          <Animated.View style={[styles.numberStage, numberStyle]}>
            <View style={styles.badge}>
              <View style={styles.badgeLine} />
              <Text style={styles.badgeText}>STREAK LOST</Text>
              <View style={[styles.badgeLine, styles.badgeLineRight]} />
            </View>

            <View style={styles.digitRow}>
              <Animated.Text style={[styles.streakNumber, digit1Style]}>{part1}</Animated.Text>
              {part2 ? (
                <Animated.Text style={[styles.streakNumber, digit2Style]}>{part2}</Animated.Text>
              ) : null}
            </View>
            <Text style={styles.streakLabel}>day streak</Text>

            <Animated.View style={[styles.crackFragsWrap, crackFragStyle]} pointerEvents="none">
              <View
                style={[
                  styles.crackFrag,
                  { width: 40, top: "48%", left: "28%", transform: [{ rotate: "25deg" }] },
                ]}
              />
              <View
                style={[
                  styles.crackFrag,
                  { width: 28, top: "44%", left: "54%", transform: [{ rotate: "-40deg" }] },
                ]}
              />
              <View
                style={[
                  styles.crackFrag,
                  { width: 18, top: "56%", left: "42%", transform: [{ rotate: "70deg" }] },
                ]}
              />
              <View
                style={[
                  styles.crackFrag,
                  { width: 32, top: "37%", left: "47%", transform: [{ rotate: "-15deg" }] },
                ]}
              />
            </Animated.View>
          </Animated.View>

          <Animated.View style={[styles.silenceStage, silenceStyle]}>
            {isFull ? <SilenceDot /> : null}
          </Animated.View>

          <Animated.View style={[styles.messageStage, messageStyle]}>
            <Text style={styles.messageEyebrow}>YOUR TWIN</Text>
            <View style={styles.messageCard}>
              <View style={styles.messageCardTopLine} />
              <Text style={styles.messageText}>{message}</Text>
            </View>
          </Animated.View>

          {isFull ? (
            <Animated.View style={[styles.zeroStage, zeroStyle]}>
              <Text style={styles.zeroNumber}>0</Text>
              <Text style={styles.zeroLabel}>day streak</Text>
              <View style={styles.zeroUnderline} />
            </Animated.View>
          ) : null}

          <Animated.View style={[styles.continueWrap, continueStyle]}>
            <Text style={styles.continueText}>tap anywhere to continue</Text>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingVertical: 52,
    overflow: "hidden",
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
    left: "50%",
    width: 1,
    backgroundColor: "rgba(185,28,28,0.09)",
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    opacity: 0.6,
  },
  badgeLine: {
    width: 24,
    height: 1,
    backgroundColor: "rgba(239,68,68,0.45)",
  },
  badgeLineRight: {
    transform: [{ scaleX: -1 }],
  },
  badgeText: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 3,
    color: "rgba(239,68,68,0.6)",
    textTransform: "uppercase",
    fontFamily: "Inter_700Bold",
  },

  numberStage: {
    position: "absolute",
    alignItems: "center",
  },
  digitRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  streakNumber: {
    fontSize: 120,
    fontWeight: "800",
    color: "#E5E7EB",
    letterSpacing: -6,
    lineHeight: 120,
    textShadowColor: "rgba(229,231,235,0.12)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 40,
    fontFamily: "Inter_800ExtraBold",
  },
  streakLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 4,
    color: "rgba(229,231,235,0.2)",
    textTransform: "uppercase",
    marginTop: 10,
    fontFamily: "Inter_600SemiBold",
  },

  crackFragsWrap: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  crackFrag: {
    position: "absolute",
    height: 1,
    backgroundColor: "rgba(229,231,235,0.06)",
    borderRadius: 1,
  },

  silenceStage: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  silenceDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(229,231,235,0.18)",
  },

  messageStage: {
    position: "absolute",
    maxWidth: 300,
    alignItems: "center",
    gap: 12,
  },
  messageEyebrow: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 4,
    color: "rgba(239,68,68,0.35)",
    textTransform: "uppercase",
    fontFamily: "Inter_700Bold",
  },
  messageCard: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.06)",
    borderRadius: 16,
    padding: 24,
    position: "relative",
    overflow: "hidden",
  },
  messageCardTopLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(229,231,235,0.07)",
  },
  messageText: {
    fontSize: 15,
    fontWeight: "400",
    color: "rgba(229,231,235,0.82)",
    lineHeight: 26,
    fontStyle: "italic",
    textAlign: "center",
    letterSpacing: -0.1,
    fontFamily: "Inter_400Regular_Italic",
  },

  zeroStage: {
    position: "absolute",
    alignItems: "center",
    gap: 10,
  },
  zeroNumber: {
    fontSize: 120,
    fontWeight: "800",
    color: "rgba(127,29,29,0.5)",
    letterSpacing: -6,
    lineHeight: 120,
    textShadowColor: "rgba(127,29,29,0.3)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 40,
    fontFamily: "Inter_800ExtraBold",
  },
  zeroLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 4,
    color: "rgba(185,28,28,0.3)",
    textTransform: "uppercase",
    fontFamily: "Inter_600SemiBold",
  },
  zeroUnderline: {
    width: 32,
    height: 1,
    backgroundColor: "rgba(185,28,28,0.22)",
    marginTop: 4,
  },

  continueWrap: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  continueText: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(255,255,255,0.15)",
    letterSpacing: 1,
    fontFamily: "Inter_500Medium",
  },
});
