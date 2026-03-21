import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";

const VIOLET_GLOW = "#A78BFA";

export type AetherToastProps = {
  amount: number;
  visible: boolean;
  onDismiss: () => void;
};

export function AetherToast({ amount, visible, onDismiss }: AetherToastProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (!visible || amount <= 0) {
      opacity.value = 0;
      translateY.value = -20;
      return;
    }

    let cancelled = false;
    opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
    translateY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) });

    const t = setTimeout(() => {
      if (cancelled) return;
      translateY.value = withTiming(-16, { duration: 200, easing: Easing.in(Easing.quad) });
      opacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) runOnJS(onDismiss)();
      });
    }, 2500);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [visible, amount, onDismiss, opacity, translateY]);

  if (!visible || amount <= 0) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, style]}>
      <View style={styles.box}>
        <Text style={styles.text}>
          +{amount} ✦ Aether
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 80,
    right: 16,
    zIndex: 100,
  },
  box: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "rgba(139,92,246,0.15)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.35)",
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
    color: VIOLET_GLOW,
    fontFamily: "Inter_700Bold",
  },
});
