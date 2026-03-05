/**
 * Onboarding option card §2.2 — selectable, single or multi.
 * Unselected: #141824, 1px #1E2333. Selected: 1.5px #8B5CF6, glow, checkmark.
 */

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { COLORS, RADIUS, SPACING, ANIMATIONS, SHADOWS } from "../constants/theme";

type Props = {
  label: string;
  selected: boolean;
  onSelect: () => void;
  /** When true, show "multiple" hint (e.g. checkbox style). */
  multiSelect?: boolean;
};

export function OnboardingOptionCard({ label, selected, onSelect, multiSelect }: Props) {
  const scale = useSharedValue(1);
  const checkOpacity = useSharedValue(selected ? 1 : 0);

  const animatedCard = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedCheck = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
  }));

  React.useEffect(() => {
    checkOpacity.value = withTiming(selected ? 1 : 0, { duration: 100 });
  }, [selected]);

  const onPressIn = () => {
    scale.value = withTiming(ANIMATIONS.pressScale, { duration: ANIMATIONS.pressIn });
  };
  const onPressOut = () => {
    scale.value = withTiming(1, { duration: ANIMATIONS.pressOut });
  };

  return (
    <Pressable
      onPress={onSelect}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.wrapper}
    >
      <Animated.View
        style={[
          styles.card,
          selected && styles.cardSelected,
          selected && styles.cardGlow,
          animatedCard,
        ]}
      >
        <View style={styles.contentRow}>
          <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={3}>
            {label}
          </Text>
          <View style={styles.circleWrap} pointerEvents="none">
            {selected ? (
              <Animated.View style={animatedCheck}>
                <Ionicons name="checkmark-circle" size={22} color={COLORS.violet} />
              </Animated.View>
            ) : (
              <View style={styles.circleOutline}>
                <Ionicons name="ellipse-outline" size={22} color={COLORS.border} />
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  card: {
    minHeight: 64,
    borderRadius: RADIUS.card,
    paddingVertical: SPACING.cardPadding,
    paddingHorizontal: SPACING.cardPadding,
    borderWidth: 1,
    borderColor: COLORS.surface2,
    backgroundColor: COLORS.surface,
  },
  cardSelected: {
    borderWidth: 1.5,
    borderColor: COLORS.violet,
    backgroundColor: "rgba(139,92,246,0.15)",
  },
  cardGlow: {
    ...SHADOWS.violet,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 32,
  },
  label: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    fontWeight: "400",
    color: COLORS.text2,
    paddingRight: SPACING.sm,
  },
  labelSelected: {
    color: COLORS.text,
  },
  circleWrap: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  circleOutline: {
    alignItems: "center",
    justifyContent: "center",
  },
});
