import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform, type DimensionValue } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";

export interface TwinPulseProps {
  statusLine?: string | null;
  message?: string | null;
  userXpToday?: number | null;
  twinXpToday?: number | null;
  hasTwin: boolean;
  onPress: () => void;
  absenceDays?: number | null;
  absenceMessage?: string | null;
}

const DOT_DURATION = 400;

export function TwinPulse({
  statusLine,
  message,
  userXpToday,
  twinXpToday,
  hasTwin,
  onPress,
  absenceDays,
  absenceMessage,
}: TwinPulseProps) {
  const avatarScale = useSharedValue(1);

  const dot1Opacity = useSharedValue(0.3);
  const dot2Opacity = useSharedValue(0.3);
  const dot3Opacity = useSharedValue(0.3);

  const msgOpacity = useSharedValue(0);
  const msgTranslateY = useSharedValue(4);

  useEffect(() => {
    avatarScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    dot1Opacity.value = withDelay(
      0,
      withRepeat(
        withSequence(
          withTiming(1.0, { duration: DOT_DURATION * 0.4 }),
          withTiming(0.3, { duration: DOT_DURATION * 0.6 })
        ),
        -1,
        false
      )
    );
    dot2Opacity.value = withDelay(
      160,
      withRepeat(
        withSequence(
          withTiming(1.0, { duration: DOT_DURATION * 0.4 }),
          withTiming(0.3, { duration: DOT_DURATION * 0.6 })
        ),
        -1,
        false
      )
    );
    dot3Opacity.value = withDelay(
      320,
      withRepeat(
        withSequence(
          withTiming(1.0, { duration: DOT_DURATION * 0.4 }),
          withTiming(0.3, { duration: DOT_DURATION * 0.6 })
        ),
        -1,
        false
      )
    );

    msgOpacity.value = 0;
    msgTranslateY.value = 4;
    msgOpacity.value = withDelay(
      600,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) })
    );
    msgTranslateY.value = withDelay(
      600,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared values are stable; re-run when strip message changes
  }, [message, absenceMessage]);

  const avatarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale.value }],
  }));

  const dot1Style = useAnimatedStyle(() => ({ opacity: dot1Opacity.value }));
  const dot2Style = useAnimatedStyle(() => ({ opacity: dot2Opacity.value }));
  const dot3Style = useAnimatedStyle(() => ({ opacity: dot3Opacity.value }));

  const msgStyle = useAnimatedStyle(() => ({
    opacity: msgOpacity.value,
    transform: [{ translateY: msgTranslateY.value }],
  }));

  const totalXp = Math.max(userXpToday ?? 0, twinXpToday ?? 0, 1);
  const userBarPct = Math.min(((userXpToday ?? 0) / totalXp) * 100, 100);
  const twinBarPct = Math.min(((twinXpToday ?? 0) / totalXp) * 100, 100);
  const showXpBar = userXpToday != null && twinXpToday != null;

  const isAbsentDays = typeof absenceDays === "number" && absenceDays >= 1;

  const displayMessage =
    isAbsentDays && absenceMessage?.trim()
      ? absenceMessage.trim()
      : message ??
        (hasTwin
          ? "Your rival is you — one week ahead."
          : "Your shadow starts where you start. One of you will fall behind.");

  const displayStatus =
    isAbsentDays
      ? `${absenceDays} day${absenceDays > 1 ? "s" : ""} absent`
      : statusLine ?? "Still here.";

  const userBarWidth = `${userBarPct}%` as DimensionValue;
  const twinBarWidth = `${twinBarPct}%` as DimensionValue;

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View style={styles.topAccent} pointerEvents="none">
        <LinearGradient
          colors={["transparent", "rgba(139,92,246,0.22)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <Animated.View style={[styles.avatarWrap, avatarStyle]}>
        <LinearGradient
          colors={["rgba(100,35,200,0.65)", "rgba(192,132,252,0.15)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.avatarLabel}>T</Text>
      </Animated.View>

      <View style={styles.content}>
        <Text
          style={[styles.statusLine, isAbsentDays ? styles.statusLineAbsent : null]}
          numberOfLines={1}
        >
          {displayStatus}
        </Text>

        <View style={styles.typingRow}>
          <Animated.View style={[styles.typingDot, dot1Style]} />
          <Animated.View style={[styles.typingDot, dot2Style]} />
          <Animated.View style={[styles.typingDot, dot3Style]} />
        </View>

        <Animated.Text
          style={[styles.message, msgStyle]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {displayMessage}
        </Animated.Text>

        {showXpBar ? (
          <View style={styles.xpRow}>
            <Text style={styles.xpYou}>You {userXpToday}</Text>
            <View style={styles.xpBarTrack}>
              <View style={[styles.xpBarTwin, { width: twinBarWidth }]} />
              <View style={[styles.xpBarUser, { width: userBarWidth }]} />
            </View>
            <Text style={styles.xpTwin}>{twinXpToday} Twin</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(8,8,20,0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139,92,246,0.12)",
    position: "relative",
    overflow: "hidden",
    gap: 10,
  },
  topAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    overflow: "hidden",
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(192,132,252,0.30)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "rgba(139,92,246,0.3)",
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
        }
      : {}),
  },
  avatarLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(215,185,255,0.85)",
    position: "absolute",
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    position: "relative",
  },
  statusLine: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: "rgba(167,139,250,0.5)",
    textTransform: "uppercase",
  },
  statusLineAbsent: {
    color: "rgba(239,68,68,0.5)",
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 16,
    position: "absolute",
    top: 18,
    left: 0,
  },
  typingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(139,92,246,0.45)",
  },
  message: {
    fontSize: 12,
    fontWeight: "500",
    color: "#C4B5FD",
    fontStyle: "italic",
    lineHeight: 17,
    marginTop: 2,
    minHeight: 34,
  },
  xpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  xpYou: {
    fontSize: 9,
    color: "rgba(139,92,246,0.6)",
    flexShrink: 0,
  },
  xpBarTrack: {
    flex: 1,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 2,
    position: "relative",
    overflow: "hidden",
  },
  xpBarTwin: {
    position: "absolute",
    left: 0,
    top: 0,
    height: "100%",
    backgroundColor: "rgba(192,132,252,0.75)",
    borderRadius: 2,
  },
  xpBarUser: {
    position: "absolute",
    left: 0,
    top: 0,
    height: "100%",
    backgroundColor: "rgba(139,92,246,0.5)",
    borderRadius: 2,
  },
  xpTwin: {
    fontSize: 9,
    color: "rgba(192,132,252,0.6)",
    flexShrink: 0,
  },
  chevron: {
    fontSize: 14,
    color: "#374151",
    flexShrink: 0,
    paddingTop: 10,
  },
});
