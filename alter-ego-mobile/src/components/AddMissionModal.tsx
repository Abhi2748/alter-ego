/**
 * Add Mission Modal §2.8 — Bottom sheet. Title input, difficulty chips, Add Mission button.
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
import { DifficultyChip } from "./DifficultyChip";

const BACKDROP_OPACITY = 0.7;
const SHEET_ANIM_IN_MS = 300;
const SHEET_ANIM_OUT_MS = 250;
const MAX_HEIGHT_RATIO = 0.85;
const HANDLE_WIDTH = 36;
const HANDLE_HEIGHT = 4;
const HANDLE_MARGIN = 12;
const TITLE_MAX_LENGTH = 80;

export type AddMissionDifficulty = "Easy" | "Medium" | "Hard";

export interface AddMissionModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (title: string, difficulty: AddMissionDifficulty) => void;
}

export function AddMissionModal({
  visible,
  onClose,
  onAdd,
}: AddMissionModalProps) {
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<AddMissionDifficulty>("Easy");
  const [isClosing, setIsClosing] = useState(false);

  const translateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const sheetHeight = Dimensions.get("window").height * MAX_HEIGHT_RATIO;
  const prevVisibleRef = useRef(visible);
  const showContent = visible || isClosing;

  const finishClose = () => {
    setIsClosing(false);
    setTitle("");
    setDifficulty("Easy");
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
    if (prevVisibleRef.current === true && !visible) {
      setIsClosing(true);
    }
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
    const t = title.trim();
    if (!t) return;
    onAdd(t, difficulty);
    finishClose();
  };

  if (!showContent) return null;

  return (
    <Modal visible={showContent} transparent animationType="none" onRequestClose={handleBackdropPress}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
        <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboard}
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
            <Text style={styles.title}>New Mission</Text>
            <TextInput
              style={styles.input}
              placeholder="What will you do?"
              placeholderTextColor={COLORS.muted}
              value={title}
              onChangeText={setTitle}
              maxLength={TITLE_MAX_LENGTH}
              autoFocus
            />
            <Text style={styles.charCount}>
              {title.length}/{TITLE_MAX_LENGTH}
            </Text>
            <View style={styles.difficultyRow}>
              {(["Easy", "Medium", "Hard"] as const).map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setDifficulty(d)}
                  style={[styles.difficultyChipWrap, difficulty === d && styles.difficultyChipSelected]}
                >
                  <DifficultyChip level={d} />
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={handleAdd}
              disabled={!title.trim()}
              style={({ pressed }) => [styles.addWrap, pressed && styles.addPressed]}
            >
              <LinearGradient
                colors={GRADIENTS.button.colors}
                start={GRADIENTS.button.start}
                end={GRADIENTS.button.end}
                style={[styles.addBtn, !title.trim() && styles.addDisabled]}
              >
                <Text style={[styles.addLabel, !title.trim() && styles.addLabelDisabled]}>
                  Add Mission
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
    fontSize: 20,
    color: COLORS.text,
    marginBottom: 20,
  },
  input: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.surface2,
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 4,
  },
  charCount: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: COLORS.muted,
    alignSelf: "flex-end",
    marginBottom: SPACING.lg,
  },
  difficultyRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: SPACING.lg,
  },
  difficultyChipWrap: {
    padding: 2,
    borderRadius: RADIUS.chip + 2,
  },
  difficultyChipSelected: {
    borderWidth: 2,
    borderColor: COLORS.violet,
  },
  addWrap: {
    alignSelf: "stretch",
  },
  addPressed: {
    opacity: 0.9,
  },
  addBtn: {
    paddingVertical: 14,
    borderRadius: RADIUS.card,
    alignItems: "center",
    justifyContent: "center",
  },
  addDisabled: {
    opacity: 0.5,
  },
  addLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
  addLabelDisabled: {
    color: COLORS.muted,
  },
});
