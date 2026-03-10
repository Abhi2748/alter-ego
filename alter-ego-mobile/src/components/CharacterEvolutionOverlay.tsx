/**
 * Character Evolution Overlay — 6-phase cinematic (CLAUDE §6, plan Phase D).
 * Phase 1: backdrop fade in. 2: title scale in. 3: character placeholder. 4: hold. 5: fade out → onClose.
 * Total ~ANIMATIONS.evolution (2400ms).
 */

import React, { useEffect } from "react";
import { View, Text, StyleSheet, Modal } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { COLORS, SPACING, RADIUS, ANIMATIONS } from "../constants/theme";

const CHAR_PLACEHOLDER_W = 160;
const CHAR_PLACEHOLDER_H = 220;

const PHASE1_MS = 400;
const PHASE2_MS = 400;
const PHASE3_MS = 400;
const PHASE4_HOLD_MS = 800;
const PHASE5_MS = 400;

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
  const backdropOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.85);
  const charOpacity = useSharedValue(0);
  const charScale = useSharedValue(0.9);

  useEffect(() => {
    if (!visible) {
      backdropOpacity.value = 0;
      titleOpacity.value = 0;
      titleScale.value = 0.85;
      charOpacity.value = 0;
      charScale.value = 0.9;
      return;
    }

    const easeOut = Easing.out(Easing.ease);
    const easeInOut = Easing.inOut(Easing.ease);

    backdropOpacity.value = withTiming(1, { duration: PHASE1_MS, easing: easeOut });

    titleOpacity.value = withDelay(
      PHASE1_MS,
      withTiming(1, { duration: PHASE2_MS, easing: easeOut })
    );
    titleScale.value = withDelay(
      PHASE1_MS,
      withTiming(1, { duration: PHASE2_MS, easing: easeOut })
    );

    charOpacity.value = withDelay(
      PHASE1_MS + PHASE2_MS,
      withTiming(1, { duration: PHASE3_MS, easing: easeOut })
    );
    charScale.value = withDelay(
      PHASE1_MS + PHASE2_MS,
      withTiming(1, { duration: PHASE3_MS, easing: easeInOut })
    );

    const totalBeforeFade = PHASE1_MS + PHASE2_MS + PHASE3_MS + PHASE4_HOLD_MS;
    backdropOpacity.value = withDelay(
      totalBeforeFade,
      withTiming(
        0,
        { duration: PHASE5_MS, easing: Easing.in(Easing.ease) },
        (finished) => {
          if (finished) runOnJS(onClose)();
        }
      )
    );
    titleOpacity.value = withDelay(totalBeforeFade, withTiming(0, { duration: PHASE5_MS, easing: Easing.in(Easing.ease) }));
    charOpacity.value = withDelay(totalBeforeFade, withTiming(0, { duration: PHASE5_MS, easing: Easing.in(Easing.ease) }));
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));
  const charStyle = useAnimatedStyle(() => ({
    opacity: charOpacity.value,
    transform: [{ scale: charScale.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      {visible ? (
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <View style={styles.content}>
            <Animated.Text style={[styles.stageName, titleStyle]}>{stageName}</Animated.Text>
            <Animated.View
              style={[
                styles.charPlaceholder,
                { width: CHAR_PLACEHOLDER_W, height: CHAR_PLACEHOLDER_H },
                charStyle,
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
