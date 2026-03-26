import React, { useEffect } from "react";
import { Text, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
} from "react-native-reanimated";

interface AetherToastProps {
  amount: number;
  visible: boolean;
  onDismiss: () => void;
}

/** Bottom banner — distinct from SP toast (top-left) and Surge pill (top bar). */
export function AetherToast({ amount, visible, onDismiss }: AetherToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(24);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    translateY.value = withSequence(
      withTiming(0, { duration: 280 }),
      withTiming(0, { duration: 2200 }),
      withTiming(24, { duration: 280 })
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 280 }),
      withTiming(1, { duration: 2200 }),
      withTiming(0, { duration: 280 }, (finished) => {
        if (finished) runOnJS(onDismiss)();
      })
    );
  }, [visible, onDismiss]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.outer,
        {
          bottom: insets.bottom + 88,
          paddingHorizontal: 16,
        },
        animStyle,
      ]}
    >
      <View style={styles.inner}>
        <Text style={styles.kicker}>AETHER</Text>
        <Text style={styles.amount}>
          +{amount} <Text style={styles.dim}>✦</Text>
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 150,
    alignItems: "center",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#141824",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.5)",
    borderLeftWidth: 3,
    borderLeftColor: "#A78BFA",
    maxWidth: 360,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  kicker: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#6B7280",
  },
  amount: {
    fontSize: 15,
    fontWeight: "800",
    color: "#E5E7EB",
  },
  dim: {
    color: "#A78BFA",
    fontWeight: "700",
  },
});
