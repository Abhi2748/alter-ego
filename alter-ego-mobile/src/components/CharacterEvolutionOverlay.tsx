/**
 * Character Evolution Overlay — Phase 1 simplified.
 * Modal: fade-in 300ms, show stage name + placeholder, auto-dismiss after 2500ms, fade-out 300ms.
 * Full 6-phase Reanimated animation in Phase 3.
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { COLORS, SPACING, RADIUS } from "../constants/theme";

const FADE_IN_MS = 300;
const FADE_OUT_MS = 300;
const SHOW_DURATION_MS = 2500;

const CHAR_PLACEHOLDER_W = 160;
const CHAR_PLACEHOLDER_H = 220;

export interface CharacterEvolutionOverlayProps {
  visible: boolean;
  onClose: () => void;
  /** New stage name, e.g. "The Focused" */
  stageName: string;
}

export function CharacterEvolutionOverlay({
  visible,
  onClose,
  stageName,
}: CharacterEvolutionOverlayProps) {
  const opacity = useSharedValue(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startFadeOut = () => {
    opacity.value = withTiming(
      0,
      { duration: FADE_OUT_MS, easing: Easing.in(Easing.ease) },
      (finished) => {
        if (finished) runOnJS(onClose)();
      }
    );
  };

  useEffect(() => {
    if (!visible) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      opacity.value = 0;
      return;
    }

    opacity.value = 0;
    opacity.value = withTiming(1, {
      duration: FADE_IN_MS,
      easing: Easing.out(Easing.ease),
    });

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      startFadeOut();
    }, SHOW_DURATION_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      {visible ? (
        <Animated.View style={[styles.backdrop, animatedStyle]}>
          <View style={styles.content}>
            <Text style={styles.stageName}>{stageName}</Text>
            <View
              style={[
                styles.charPlaceholder,
                { width: CHAR_PLACEHOLDER_W, height: CHAR_PLACEHOLDER_H },
              ]}
            />
          </View>
        </Animated.View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#0F0C29",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: SPACING.screenPadding,
  },
  stageName: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    color: COLORS.text,
    textAlign: "center",
    marginBottom: SPACING.lg,
  },
  charPlaceholder: {
    backgroundColor: COLORS.surface2,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
