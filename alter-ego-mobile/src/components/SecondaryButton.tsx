/**
 * Secondary Button §2.1 — Skip, Cancel, View. Outlined violet. No gradient.
 */

import React, { useEffect } from "react";
import { Pressable, Text, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { COLORS, RADIUS } from "../constants/theme";

const HEIGHT = 48;
const PRESS_DURATION = 80;
const PRESS_SCALE = 0.98;

export interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  /** Fixed width; e.g. 200 for centered "Return" button. */
  width?: number;
}

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  style,
  width,
}: SecondaryButtonProps) {
  const pressed = useSharedValue(0);
  const isDisabled = useSharedValue(disabled ? 1 : 0);

  useEffect(() => {
    isDisabled.value = withTiming(disabled ? 1 : 0, { duration: 100 });
  }, [disabled]);

  const animatedStyle = useAnimatedStyle(() => {
    const dis = isDisabled.value;
    const p = pressed.value;
    return {
      transform: [{ scale: dis ? 1 : 1 - (1 - PRESS_SCALE) * p }],
      backgroundColor: dis ? COLORS.surface : (p > 0.5 ? "#1E2333" : COLORS.surface),
      borderColor: dis ? COLORS.surface2 : (p > 0.5 ? COLORS.violetGlow : COLORS.violet),
      borderWidth: 1,
      shadowColor: "#8B5CF6",
      shadowOpacity: p > 0.5 ? 0.25 : 0,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 0 },
      elevation: p > 0.5 ? 6 : 0,
    };
  });

  const onPressIn = () => {
    if (disabled) return;
    pressed.value = withTiming(1, { duration: PRESS_DURATION });
  };

  const onPressOut = () => {
    pressed.value = withTiming(0, { duration: PRESS_DURATION });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      style={[styles.wrapper, width != null && { width }, style]}
    >
      <Animated.View style={[styles.button, width != null && { width }, animatedStyle]}>
        <Text
          style={[styles.label, disabled && styles.labelDisabled]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: "center",
  },
  button: {
    height: HEIGHT,
    borderRadius: RADIUS.card,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: COLORS.violet,
  },
  labelDisabled: {
    color: COLORS.muted,
  },
});
