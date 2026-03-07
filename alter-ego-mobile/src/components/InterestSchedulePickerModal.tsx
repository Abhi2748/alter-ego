/**
 * Interest Schedule Picker Modal §2.8 — Bottom sheet. [Interest name] Schedule, 7 day circles, Save Schedule.
 */

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
  Platform,
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
const DAY_BUTTON_SIZE = 40;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface InterestSchedulePickerModalProps {
  visible: boolean;
  onClose: () => void;
  interestName: string;
  /** Day indices 0–6 (Mon–Sun) that are currently selected. */
  currentSchedule: number[];
  onSave: (schedule: number[]) => void;
}

export function InterestSchedulePickerModal({
  visible,
  onClose,
  interestName,
  currentSchedule,
  onSave,
}: InterestSchedulePickerModalProps) {
  const [selectedDays, setSelectedDays] = useState<number[]>(() => [...currentSchedule]);
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
    onClose();
  };

  useEffect(() => {
    if (visible) {
      setIsClosing(false);
      setSelectedDays([...currentSchedule]);
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

  const toggleDay = (index: number) => {
    setSelectedDays((prev) =>
      prev.includes(index) ? prev.filter((d) => d !== index) : [...prev, index].sort((a, b) => a - b)
    );
  };

  const handleSave = () => {
    if (selectedDays.length === 0) return;
    onSave(selectedDays);
    finishClose();
  };

  const canSave = selectedDays.length >= 1;

  return (
    <Modal visible={showContent} transparent animationType="none" onRequestClose={handleBackdropPress}>
      {showContent ? (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
        <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />
        <View style={styles.keyboard}>
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

            <Text style={styles.title}>{interestName} Schedule</Text>

            <View style={styles.daysRow}>
              {DAY_LABELS.map((label, index) => {
                const selected = selectedDays.includes(index);
                return (
                  <Pressable
                    key={index}
                    onPress={() => toggleDay(index)}
                    style={[
                      styles.dayButton,
                      selected ? styles.dayButtonSelected : styles.dayButtonUnselected,
                    ]}
                  >
                    <Text
                      style={[styles.dayLabel, selected ? styles.dayLabelSelected : styles.dayLabelUnselected]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              style={({ pressed }) => [styles.saveWrap, pressed && styles.savePressed]}
            >
              <LinearGradient
                colors={GRADIENTS.button.colors}
                start={GRADIENTS.button.start}
                end={GRADIENTS.button.end}
                style={[styles.saveBtn, !canSave && styles.saveDisabled]}
              >
                <Text style={[styles.saveLabel, !canSave && styles.saveLabelDisabled]}>
                  Save Schedule
                </Text>
              </LinearGradient>
            </Pressable>
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
    marginBottom: SPACING.lg,
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.xl,
  },
  dayButton: {
    width: DAY_BUTTON_SIZE,
    height: DAY_BUTTON_SIZE,
    borderRadius: DAY_BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dayButtonUnselected: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayButtonSelected: {
    backgroundColor: COLORS.violet,
  },
  dayLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  dayLabelUnselected: {
    color: COLORS.muted,
  },
  dayLabelSelected: {
    color: "#FFFFFF",
  },
  saveWrap: {
    alignSelf: "stretch",
  },
  savePressed: {
    opacity: 0.9,
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: RADIUS.card,
    alignItems: "center",
    justifyContent: "center",
  },
  saveDisabled: {
    opacity: 0.5,
  },
  saveLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
  saveLabelDisabled: {
    color: COLORS.muted,
  },
});
