import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

const VIOLET_GLOW = "#A78BFA";

export function SurgeIndicator({ visible }: { visible: boolean }) {
  const dotOp = useSharedValue(0.5);

  useEffect(() => {
    if (!visible) {
      dotOp.value = 0.5;
      return;
    }
    dotOp.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [visible, dotOp]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOp.value,
  }));

  if (!visible) return null;

  return (
    <View style={styles.row} pointerEvents="none">
      <Animated.View style={[styles.dot, dotStyle]} />
      <Text style={styles.label}>SURGE ACTIVE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: "rgba(139,92,246,0.12)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.3)",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: VIOLET_GLOW,
  },
  label: {
    fontSize: 9,
    fontWeight: "700",
    color: VIOLET_GLOW,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontFamily: "Inter_700Bold",
  },
});
