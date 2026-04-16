/**
 * Add Mission Modal — Premium bottom sheet. Title input, difficulty chips,
 * XP/PF preview, Add Mission button. KeyboardAvoidingView, gradient background, top accent.
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
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

const BACKDROP_OPACITY = 0.7;
const SHEET_ANIM_IN_MS = 300;
const SHEET_ANIM_OUT_MS = 250;
const MAX_HEIGHT_RATIO = 0.85;
const HANDLE_WIDTH = 36;
const HANDLE_HEIGHT = 3;
const HANDLE_MARGIN_BOTTOM = 18;
const TITLE_MAX_LENGTH = 80;

/** Matches backend PERSONAL_MISSION_XP_BY_TIER + MISSION_PF.personal (spec §9). */
const XP_PET_FOOD: Record<"Easy" | "Medium" | "Hard", { xp: number; pf: number }> = {
  Easy: { xp: 8, pf: 6 },
  Medium: { xp: 15, pf: 11 },
  Hard: { xp: 22, pf: 17 },
};

const DIFFICULTY_CHIP_UNSELECTED = {
  bg: "rgba(255,255,255,0.03)",
  border: "rgba(42,48,80,0.45)",
  text: "#4B5563",
};

const DIFFICULTY_CHIP_STYLES: Record<
  "Easy" | "Medium" | "Hard",
  { bg: string; border: string; text: string }
> = {
  Easy: {
    bg: "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.45)",
    text: "#10B981",
  },
  Medium: {
    bg: "rgba(249,115,22,0.10)",
    border: "rgba(249,115,22,0.45)",
    text: "#F97316",
  },
  Hard: {
    bg: "rgba(239,68,68,0.10)",
    border: "rgba(239,68,68,0.45)",
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
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<AddMissionDifficulty | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
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
    setDifficulty(null);
    setAddError(null);
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
    closeTimeoutRef.current = setTimeout(() => {
      closeTimeoutRef.current = null;
      finishClose();
    }, SHEET_ANIM_OUT_MS + 100);
  };

  const handleAdd = async () => {
    const t = title.trim();
    if (!t || !difficulty) return;
    setAddError(null);
    const result = onAdd(t, difficulty);
    const promise =
      result != null && typeof (result as Promise<void>).then === "function"
        ? (result as Promise<void>)
        : null;
    if (promise) {
      setAddLoading(true);
      try {
        await promise;
        finishClose();
      } catch (e) {
        setAddError(e instanceof Error ? e.message : "Failed to add mission");
      } finally {
        setAddLoading(false);
      }
    } else {
      finishClose();
    }
  };

  const selectedDifficulty = difficulty;
  const xpPf = selectedDifficulty ? XP_PET_FOOD[selectedDifficulty] : null;
  const canAdd = !!title.trim() && !!difficulty && !addLoading;

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
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboard}
          >
            <Animated.View
              style={[
                styles.sheet,
                {
                  paddingHorizontal: 20,
                  paddingTop: 20,
                  paddingBottom: insets.bottom + 24,
                },
                sheetStyle,
              ]}
            >
              <LinearGradient
                colors={["#111623", "#0E1020"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.sheetTopAccent} pointerEvents="none">
                <LinearGradient
                  colors={["transparent", "rgba(139,92,246,0.30)", "transparent"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>

              <View style={styles.handleWrap}>
                <View style={styles.handle} />
              </View>

              <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>Add Mission</Text>
                <Pressable
                  onPress={handleBackdropPress}
                  style={styles.closeButton}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={13} color="#6B7280" />
                </Pressable>
              </View>

              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.inputLabel}>MISSION TITLE</Text>
                <TextInput
                  style={[
                    styles.input,
                    inputFocused && styles.inputFocused,
                  ]}
                  placeholder="What do you want to accomplish?"
                  placeholderTextColor="#2D3146"
                  value={title}
                  onChangeText={setTitle}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  maxLength={TITLE_MAX_LENGTH}
                  cursorColor="#8B5CF6"
                />
                <Text
                  style={[
                    styles.charCount,
                    title.length > 0 && styles.charCountTyping,
                  ]}
                >
                  {title.length} / {TITLE_MAX_LENGTH}
                </Text>

                <Text style={styles.difficultyLabel}>DIFFICULTY</Text>
                <View style={styles.difficultyRow}>
                  {(["Easy", "Medium", "Hard"] as const).map((d) => {
                    const selected = difficulty === d;
                    const chipStyle = selected
                      ? DIFFICULTY_CHIP_STYLES[d]
                      : DIFFICULTY_CHIP_UNSELECTED;
                    return (
                      <Pressable
                        key={d}
                        onPress={() => setDifficulty(d)}
                        style={[
                          styles.difficultyChip,
                          {
                            backgroundColor: chipStyle.bg,
                            borderColor: chipStyle.border,
                          },
                        ]}
                      >
                        <Text style={[styles.difficultyChipText, { color: chipStyle.text }]}>
                          {d}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {xpPf && selectedDifficulty && (
                  <View style={styles.xpPreviewRow}>
                    <View style={styles.xpPreviewItem}>
                      <View style={styles.xpPreviewTop}>
                        <Text style={styles.xpStar}>★</Text>
                        <Text style={styles.xpNumber}>{xpPf.xp}</Text>
                      </View>
                      <Text style={styles.xpLabel}>XP EARNED</Text>
                    </View>
                    <View style={styles.xpPreviewDivider} />
                    <View style={styles.xpPreviewItem}>
                      <View style={styles.xpPreviewTop}>
                        <Text style={styles.pfEmoji}>🌿</Text>
                        <Text style={styles.pfNumber}>{xpPf.pf}</Text>
                      </View>
                      <Text style={styles.xpLabel}>PET FOOD</Text>
                    </View>
                  </View>
                )}

                {addError ? (
                  <Text style={styles.addError}>{addError}</Text>
                ) : null}

                <Pressable
                  onPress={handleAdd}
                  disabled={!canAdd}
                  style={({ pressed }) => [styles.addWrap, pressed && canAdd && styles.addPressed]}
                >
                  {canAdd ? (
                    <LinearGradient
                      colors={["#5B21B6", "#8B5CF6"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.addBtnGradient}
                    >
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                      <Text style={styles.addLabel}>Add Mission</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.addBtnDisabled}>
                      <Ionicons name="add" size={16} color="#374151" />
                      <Text style={styles.addLabelDisabled}>Add Mission</Text>
                    </View>
                  )}
                </Pressable>
              </ScrollView>
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
    alignSelf: "stretch",
    borderRadius: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.55)",
    borderBottomWidth: 0,
    overflow: "hidden",
    maxHeight: Dimensions.get("window").height * 0.85,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.8,
          shadowRadius: 32,
          shadowOffset: { width: 0, height: -4 },
        }
      : { elevation: 16 }),
  },
  sheetTopAccent: {
    position: "absolute",
    top: 0,
    left: "15%",
    right: "15%",
    height: 1,
    overflow: "hidden",
    zIndex: 1,
  },
  handleWrap: {
    alignSelf: "center",
    marginBottom: HANDLE_MARGIN_BOTTOM,
  },
  handle: {
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#E5E7EB",
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 24 },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#374151",
    marginBottom: 7,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5,
    borderColor: "rgba(42,48,80,0.55)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#E5E7EB",
    ...(Platform.OS === "ios" && {
      shadowColor: "rgba(255,255,255,0.03)",
      shadowOffset: { width: 0, height: -1 },
      shadowRadius: 0,
      shadowOpacity: 1,
    }),
  },
  inputFocused: {
    borderColor: "rgba(139,92,246,0.50)",
    ...(Platform.OS === "ios" && {
      shadowColor: "rgba(139,92,246,0.08)",
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
    }),
  },
  charCount: {
    fontSize: 10,
    color: "#2D3146",
    marginTop: 5,
    marginBottom: 14,
    textAlign: "right",
  },
  charCountTyping: {
    color: "#4B5563",
  },
  difficultyLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#374151",
    marginBottom: 8,
  },
  difficultyRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  difficultyChip: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  difficultyChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  xpPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: "rgba(255,255,255,0.025)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.30)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  xpPreviewItem: {
    alignItems: "center",
  },
  xpPreviewTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  xpPreviewDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(42,48,80,0.50)",
  },
  xpStar: {
    fontSize: 13,
    color: "#8B5CF6",
  },
  xpNumber: {
    fontSize: 15,
    fontWeight: "800",
    color: "#E5E7EB",
  },
  pfEmoji: {
    fontSize: 13,
  },
  pfNumber: {
    fontSize: 15,
    fontWeight: "800",
    color: "#E5E7EB",
  },
  xpLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#374151",
    marginTop: 2,
  },
  addError: {
    fontSize: 12,
    color: "#7F1D1D",
    marginBottom: 8,
  },
  addWrap: {
    alignSelf: "stretch",
  },
  addPressed: {
    opacity: 0.95,
  },
  addBtnGradient: {
    height: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...(Platform.OS === "ios" && {
      shadowColor: "rgba(139,92,246,0.30)",
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
    }),
  },
  addBtnDisabled: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(42,48,80,0.35)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  addLabelDisabled: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
  },
});
