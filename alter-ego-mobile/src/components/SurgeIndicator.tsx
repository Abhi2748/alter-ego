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
        gap: 4,
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 8,
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderColor: "rgba(192,132,252,0.55)",
      }}
    >
      <Animated.View
        style={[
          {
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: "#C084FC",
          },
          dotStyle,
        ]}
      />
      <Text
        style={{
          fontSize: 8,
          fontWeight: "800",
          color: "#C084FC",
          letterSpacing: 1.2,
          textTransform: "uppercase",
        }}
      >
        SURGE
      </Text>
    </View>
  );
}
