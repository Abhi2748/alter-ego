import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type PetDialogueBubbleProps = {
  visible: boolean;
  text: string;
};

export default function PetDialogueBubble({ visible, text }: PetDialogueBubbleProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
      translateY.value = withTiming(0, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    opacity.value = withTiming(0, {
      duration: 180,
      easing: Easing.in(Easing.cubic),
    });
    translateY.value = withTiming(6, {
      duration: 180,
      easing: Easing.in(Easing.cubic),
    });
  }, [opacity, translateY, visible, text]);

  const bubbleAnimStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, bubbleAnimStyle]}>
      <View style={styles.bubble}>
        <Text style={styles.label}>Companion</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
      <View style={styles.tailOuter} />
      <View style={styles.tailInner} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: -10,
    bottom: 74,
    maxWidth: 250,
    zIndex: 6,
  },
  bubble: {
    backgroundColor: "rgba(12,10,20,0.88)",
    borderColor: "rgba(139,92,246,0.62)",
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#8B5CF6",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  label: {
    color: "rgba(167,139,250,0.84)",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.4,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  text: {
    color: "#E5E7EB",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  tailOuter: {
    position: "absolute",
    right: 24,
    bottom: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 11,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "rgba(139,92,246,0.62)",
  },
  tailInner: {
    position: "absolute",
    right: 25,
    bottom: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "rgba(12,10,20,0.88)",
  },
});

