/**
 * Add Interest Modal §2.8 — Bottom sheet. Name input, Add button.
 */

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { COLORS, SPACING, RADIUS, GRADIENTS } from "../constants/theme";

const BACKDROP_OPACITY = 0.7;
const SHEET_ANIM_IN_MS = 300;
const SHEET_ANIM_OUT_MS = 250;
const MAX_HEIGHT_RATIO = 0.85;
const HANDLE_WIDTH = 36;
const HANDLE_HEIGHT = 4;
const HANDLE_MARGIN = 12;
const NAME_MAX_LENGTH = 40;

export interface AddInterestModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string) => void;
}

export function AddInterestModal({
  visible,
  onClose,
  onAdd,
}: AddInterestModalProps) {
  const [name, setName] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const translateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const sheetHeight = Dimensions.get("window").height * MAX_HEIGHT_RATIO;
  const prevVisibleRef = useRef(visible);
  const showContent = visible || isClosing;

  const finishClose = () => {
    setIsClosing(false);
    setName("");
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

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    finishClose();
  };

  const canAdd = name.trim().length > 0;

  if (!showContent) return null;

  return (
    <Modal
      visible={showContent}
      transparent
      animationType="none"
      onRequestClose={handleBackdropPress}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
        <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />
        <KeyboardAvoidingView
          style={styles.keyboard}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <Animated.View
            style={[
              styles.sheet,
              { height: sheetHeight, paddingHorizontal: SPACING.lg, paddingVertical: 20 },
              sheetStyle,
            ]}
          >
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>
            <Text style={styles.title}>New interest</Text>
            <Text style={styles.subtitle}>What do you want to focus on?</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Fitness, Reading"
              placeholderTextColor={COLORS.muted}
              maxLength={NAME_MAX_LENGTH}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <Pressable
              onPress={handleAdd}
              disabled={!canAdd}
              style={({ pressed }) => [styles.addWrap, pressed && styles.addPressed]}
            >
              <LinearGradient
                colors={GRADIENTS.button.colors}
                start={GRADIENTS.button.start}
                end={GRADIENTS.button.end}
                style={[styles.addBtn, !canAdd && styles.addDisabled]}
              >
                <Text style={[styles.addLabel, !canAdd && styles.addLabelDisabled]}>
                  Add interest
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
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
    marginBottom: SPACING.md,
  },
  input: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.surface2,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    marginBottom: SPACING.lg,
  },
  addWrap: { alignSelf: "stretch" },
  addPressed: { opacity: 0.9 },
  addBtn: {
    paddingVertical: 14,
    borderRadius: RADIUS.card,
    alignItems: "center",
    justifyContent: "center",
  },
  addDisabled: { opacity: 0.5 },
  addLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
  addLabelDisabled: { color: COLORS.muted },
});
