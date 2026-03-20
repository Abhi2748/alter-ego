/**
 * Top toast for mission delete success / error (Reanimated).
 */

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";

const HOLD_MS = 2000;
const IN_MS = 250;
const OUT_MS = 200;

type ToastVariant = "success" | "error";

export function MissionRemovedToast({
  visible,
  variant = "success",
  message,
  onHidden,
}: {
  visible: boolean;
  variant?: ToastVariant;
  message: string;
  onHidden?: () => void;
}) {
  const translateY = useSharedValue(-20);
  const opacity = useSharedValue(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const hold = variant === "error" ? 2800 : HOLD_MS;

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (!visible) {
      translateY.value = -20;
      opacity.value = 0;
      return;
    }

    translateY.value = -20;
    opacity.value = 0;
    translateY.value = withTiming(0, { duration: IN_MS, easing: Easing.out(Easing.ease) });
    opacity.value = withTiming(1, { duration: IN_MS, easing: Easing.out(Easing.ease) });

    const t1 = setTimeout(() => {
      translateY.value = withTiming(-20, { duration: OUT_MS, easing: Easing.in(Easing.ease) });
      opacity.value = withTiming(0, { duration: OUT_MS, easing: Easing.in(Easing.ease) });
      const t2 = setTimeout(() => onHidden?.(), OUT_MS);
      timersRef.current.push(t2);
    }, IN_MS + hold);
    timersRef.current.push(t1);

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [visible, translateY, opacity, onHidden, hold]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  const isErr = variant === "error";

  return (
    <Animated.View style={[styles.wrap, animStyle]} pointerEvents="none">
      <View
        style={[
          styles.inner,
          isErr && {
            borderColor: "rgba(239,68,68,0.3)",
          },
        ]}
      >
        {!isErr ? (
          <View style={styles.checkCircle}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
        ) : (
          <View style={styles.errDot} />
        )}
        <Text style={[styles.label, isErr && styles.labelErr]}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 56,
    left: 20,
    right: 20,
    zIndex: 100,
    alignItems: "stretch",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#141824",
    borderWidth: 1,
    borderColor: "#2A3050",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowRadius: 12,
        shadowOpacity: 0.5,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 8 },
    }),
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(139,92,246,0.15)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    fontWeight: "700",
    color: "#A78BFA",
  },
  errDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  label: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    fontWeight: "600",
    color: "#E5E7EB",
  },
  labelErr: {
    fontFamily: "Inter_400Regular",
    fontWeight: "400",
    color: "#EF4444",
  },
});
