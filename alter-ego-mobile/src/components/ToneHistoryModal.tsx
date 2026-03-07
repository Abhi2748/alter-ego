/**
 * Twin Tone History Modal §2.8 — Bottom sheet. Placeholder list of tone ratings.
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
  Platform,
  ScrollView,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { COLORS, SPACING, RADIUS } from "../constants/theme";

const BACKDROP_OPACITY = 0.7;
const SHEET_ANIM_IN_MS = 300;
const SHEET_ANIM_OUT_MS = 250;
const MAX_HEIGHT_RATIO = 0.85;
const HANDLE_WIDTH = 36;
const HANDLE_HEIGHT = 4;
const HANDLE_MARGIN = 12;

export interface ToneHistoryModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ToneHistoryModal({ visible, onClose }: ToneHistoryModalProps) {
  const [isClosing, setIsClosing] = React.useState(false);
  const translateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const sheetHeight = Dimensions.get("window").height * MAX_HEIGHT_RATIO;
  const prevVisibleRef = useRef(visible);
  const showContent = visible || isClosing;

  const finishClose = () => {
    setIsClosing(false);
    onClose();
  };

  useEffect(() => {
    if (visible) {
      setIsClosing(false);
      translateY.value = sheetHeight;
      backdropOpacity.value = 0;
      translateY.value = withTiming(0, {
        duration: SHEET_ANIM_IN_MS,
        easing: Easing.out(Easing.ease),
      });
      backdropOpacity.value = withTiming(BACKDROP_OPACITY, {
        duration: SHEET_ANIM_IN_MS,
        easing: Easing.out(Easing.ease),
      });
    }
  }, [visible]);

  useEffect(() => {
    if (prevVisibleRef.current === true && !visible) setIsClosing(true);
    prevVisibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    if (!visible && isClosing) {
      translateY.value = withTiming(
        sheetHeight,
        { duration: SHEET_ANIM_OUT_MS, easing: Easing.in(Easing.ease) },
        (f) => f && runOnJS(finishClose)()
      );
      backdropOpacity.value = withTiming(0, {
        duration: SHEET_ANIM_OUT_MS,
        easing: Easing.in(Easing.ease),
      });
    }
  }, [visible, isClosing]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  const handleBackdropPress = () => {
    if (!visible) return;
    setIsClosing(true);
    translateY.value = withTiming(
      sheetHeight,
      { duration: SHEET_ANIM_OUT_MS, easing: Easing.in(Easing.ease) },
      (f) => f && runOnJS(finishClose)()
    );
    backdropOpacity.value = withTiming(0, {
      duration: SHEET_ANIM_OUT_MS,
      easing: Easing.in(Easing.ease),
    });
  };

  // Never unmount Modal: use visible prop so native layer properly dismisses and doesn't leave
  // an orphaned view that blocks touches (known RN + Reanimated issue when Modal is unmounted).
  return (
    <Modal
      visible={showContent}
      transparent
      animationType="none"
      onRequestClose={handleBackdropPress}
    >
      {showContent ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
          <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />
          <View style={styles.keyboard}>
            <Animated.View
              style={[
                styles.sheet,
                {
                  height: sheetHeight,
                  paddingHorizontal: SPACING.lg,
                  paddingVertical: 20,
                },
                sheetStyle,
              ]}
            >
              <View style={styles.handleWrap}>
                <View style={styles.handle} />
              </View>
              <Text style={styles.title}>Twin Tone History</Text>
              <Text style={styles.subtitle}>
                Tones you've responded to will appear here.
              </Text>
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.placeholderRow}>
                  <Text style={styles.placeholderText}>No tone ratings yet</Text>
                </View>
              </ScrollView>
            </Animated.View>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  keyboard: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.modal,
    borderTopRightRadius: RADIUS.modal,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.8,
          shadowRadius: 32,
          shadowOffset: { width: 0, height: -4 },
        }
      : { elevation: 16 }),
  },
  handleWrap: {
    alignItems: "center",
    marginTop: HANDLE_MARGIN,
    marginBottom: 8,
  },
  handle: {
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: COLORS.text,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: SPACING.lg,
  },
  scroll: { flex: 1, minHeight: 120 },
  scrollContent: { paddingBottom: SPACING.lg },
  placeholderRow: {
    paddingVertical: SPACING.lg,
    alignItems: "center",
  },
  placeholderText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.muted,
  },
});
