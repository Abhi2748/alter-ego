/**
 * Onboarding option card §2.2 — premium dark. Single or multi.
 * Unselected: glass card + outline radio. Selected: violet tint + left accent bar + filled radio.
 * Press scale 0.98 (80ms).
 */

import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

type Props = {
  label: string;
  selected: boolean;
  onSelect: () => void;
  multiSelect?: boolean;
};

const PRESS_SCALE = 0.98;
const PRESS_DURATION = 80;

export function OnboardingOptionCard({ label, selected, onSelect, multiSelect: _multiSelect }: Props) {
  const scale = useSharedValue(1);

  const animatedCard = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withTiming(PRESS_SCALE, { duration: PRESS_DURATION });
  };
  const onPressOut = () => {
    scale.value = withTiming(1, { duration: 120 });
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
          selected && styles.cardShadow,
          animatedCard,
        ]}
      >
        {selected && (
          <View style={styles.accentBarWrap} pointerEvents="none">
            <LinearGradient
              colors={["#8B5CF6", "#5B21B6"]}
              style={styles.accentBar}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
          </View>
        )}
        <View style={styles.contentRow}>
          <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={3}>
            {label}
          </Text>
          <View style={styles.radioWrap} pointerEvents="none">
            {selected ? (
              <View style={styles.radioSelected}>
                <View style={styles.radioDot} />
              </View>
            ) : (
              <View style={styles.radioOutline} />
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
    marginBottom: 10,
  },
  card: {
    borderRadius: 16,
    paddingVertical: 17,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: "rgba(42,48,80,0.50)",
    backgroundColor: "rgba(255,255,255,0.03)",
    position: "relative",
    overflow: "hidden",
  },
  cardSelected: {
    backgroundColor: "rgba(109,40,217,0.12)",
    borderColor: "rgba(139,92,246,0.55)",
    ...(Platform.OS !== "web" && {
      shadowColor: "rgba(139,92,246,0.12)",
      shadowOffset: { width: 0, height: 0 },
      shadowRadius: 1,
      shadowOpacity: 1,
      borderWidth: 1.5,
      elevation: 0,
    }),
  },
  cardShadow: {
    ...(Platform.OS === "web" && {
      boxShadow: "0 0 0 1px rgba(139,92,246,0.12)",
    }),
  },
  accentBarWrap: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    overflow: "hidden",
  },
  accentBar: {
    flex: 1,
    width: 3,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 32,
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#E5E7EB",
    paddingRight: 12,
  },
  labelSelected: {
    fontWeight: "600",
    color: "#C4B5FD",
  },
  radioWrap: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOutline: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "rgba(42,48,80,0.60)",
  },
  radioSelected: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#8B5CF6",
    backgroundColor: "rgba(139,92,246,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#8B5CF6",
  },
});
