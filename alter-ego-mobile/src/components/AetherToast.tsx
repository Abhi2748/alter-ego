import React, { useEffect } from "react";
import { Text } from "react-native";
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

export function AetherToast({ amount, visible, onDismiss }: AetherToastProps) {
  const translateY = useSharedValue(-20);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    translateY.value = withSequence(
      withTiming(0, { duration: 300 }),
      withTiming(0, { duration: 2000 }),
      withTiming(-20, { duration: 300 })
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 300 }),
      withTiming(1, { duration: 2000 }),
      withTiming(0, { duration: 300 }, (finished) => {
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
        {
          position: "absolute",
          top: 80,
          right: 16,
          zIndex: 100,
          paddingVertical: 6,
          paddingHorizontal: 14,
          borderRadius: 20,
          backgroundColor: "rgba(139,92,246,0.15)",
          borderWidth: 1,
          borderColor: "rgba(139,92,246,0.35)",
        },
        animStyle,
      ]}
    >
      <Text style={{ fontSize: 12, fontWeight: "700", color: "#A78BFA" }}>
        +{amount} ✦ Aether
      </Text>
    </Animated.View>
  );
}
