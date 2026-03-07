/**
 * Add Mission Modal §2.8 — Bottom sheet. Title input (§2.4), difficulty chip picker (§2.3), Add Mission button.
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
  Keyboard,
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
const TITLE_MAX_LENGTH = 80;

/** §2.3 — Difficulty chips (Easy / Medium / Hard) for picker. Padding 4px vertical, 10px horizontal. */
const DIFFICULTY_CHIP_STYLES: Record<
  "Easy" | "Medium" | "Hard",
  { bg: string; border: string; text: string }
> = {
  Easy: {
    bg: "rgba(139,92,246,0.15)",
    border: "#8B5CF6",
    text: "#8B5CF6",
  },
  Medium: {
    bg: "rgba(245,158,11,0.15)",
    border: "#F59E0B",
    text: "#F59E0B",
  },
  Hard: {
    bg: "rgba(239,68,68,0.12)",
    border: "#EF4444",
    text: "#EF4444",
  },
};

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
  const [inputFocused, setInputFocused] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const translateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const sheetHeight = Dimensions.get("window").height * MAX_HEIGHT_RATIO;
  const prevVisibleRef = useRef(visible);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showContent = visible || isClosing;

  const finishClose = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsClosing(false);
    setInputFocused(false);
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

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, []);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  const handleBackdropPress = () => {
    if (!visible) return;
    Keyboard.dismiss();
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
    // Fallback: if Reanimated completion callback never runs, finish close so screen doesn't stay stuck
    closeTimeoutRef.current = setTimeout(() => {
      closeTimeoutRef.current = null;
      finishClose();
    }, SHEET_ANIM_OUT_MS + 100);
  };

  const handleAdd = () => {
    const t = title.trim();
    if (!t) return;
    onAdd(t, difficulty);
    finishClose();
  };

  // Never unmount Modal: use visible prop so native layer properly dismisses and doesn't leave
  // an orphaned view that blocks touches (known RN + Reanimated issue when Modal is unmounted).
  return (
    <Modal visible={showContent} transparent animationType="none" onRequestClose={handleBackdropPress}>
      {showContent ? (
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
              {/* §2.4 — Label above input: 12px / 500 / #9CA3AF, 8px gap */}
              <Text style={styles.inputLabel}>Mission title</Text>
              <TextInput
                style={[styles.input, inputFocused && styles.inputFocused]}
                placeholder="What will you do?"
                placeholderTextColor={COLORS.muted}
                value={title}
                onChangeText={setTitle}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                maxLength={TITLE_MAX_LENGTH}
                autoFocus
                cursorColor={COLORS.violet}
              />
              <Text style={styles.charCount}>
                {title.length}/{TITLE_MAX_LENGTH}
              </Text>
              {/* §2.3 — Difficulty chip picker: Easy / Medium / Hard, single select */}
              <Text style={styles.difficultyLabel}>Difficulty</Text>
              <View style={styles.difficultyRow}>
                {(["Easy", "Medium", "Hard"] as const).map((d) => {
                  const chipStyle = DIFFICULTY_CHIP_STYLES[d];
                  const selected = difficulty === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => setDifficulty(d)}
                      style={[
                        styles.difficultyChip,
                        {
                          backgroundColor: chipStyle.bg,
                          borderColor: chipStyle.border,
                          borderWidth: 1,
                        },
                        selected && styles.difficultyChipGlow,
                      ]}
                    >
                      <Text style={[styles.difficultyChipText, { color: chipStyle.text }]}>{d}</Text>
                    </Pressable>
                  );
                })}
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
  /* §2.4 — Label above input: Inter 12px / 500 / #9CA3AF, 8px gap */
  inputLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.text2,
    marginBottom: SPACING.sm,
  },
  input: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    height: 52,
    borderWidth: 1,
    borderColor: "#1E2333",
    marginBottom: 4,
  },
  inputFocused: {
    borderColor: COLORS.violet,
    backgroundColor: "rgba(139,92,246,0.1)",
  },
  charCount: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: COLORS.muted,
    alignSelf: "flex-end",
    marginBottom: SPACING.lg,
  },
  difficultyLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.text2,
    marginBottom: SPACING.sm,
  },
  difficultyRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: SPACING.lg,
  },
  /* §2.3 — Padding 4px vertical, 10px horizontal; radius 10px; text 12px / 600 */
  difficultyChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADIUS.chip,
  },
  difficultyChipGlow: {
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#E5E7EB",
          shadowOpacity: 0.5,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 },
        }
      : { elevation: 6 }),
  },
  difficultyChipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
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
