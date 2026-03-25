import React, { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

export function SurgeIndicator({ visible }: { visible: boolean }) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1.0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const dotStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 20,
        backgroundColor: "rgba(139,92,246,0.12)",
        borderWidth: 1,
        borderColor: "rgba(139,92,246,0.3)",
      }}
    >
      <Animated.View
        style={[
          {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: "#A78BFA",
          },
          dotStyle,
        ]}
      />
      <Text
        style={{
          fontSize: 9,
          fontWeight: "700",
          color: "#A78BFA",
          letterSpacing: 1.5,
          textTransform: "uppercase",
        }}
      >
        SURGE ACTIVE
      </Text>
    </View>
  );
}
