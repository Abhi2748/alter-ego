/**
 * Day Detail Modal §2.8 — Bottom sheet for Streak Heatmap cell tap.
 * Shows date and placeholder stats (missions, XP, pet state, Twin comment).
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
  ScrollView,
  Platform,
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

export interface DayDetailModalProps {
  visible: boolean;
  onClose: () => void;
  /** Date string (e.g. YYYY-MM-DD) for the selected day */
  date: string;
  /** Completion level 0–4 for that day */
  level: number;
}

function formatDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function DayDetailModal({
  visible,
  onClose,
  date,
  level,
}: DayDetailModalProps) {
  const translateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const [isClosing, setIsClosing] = useState(false);

  const sheetHeight = Dimensions.get("window").height * MAX_HEIGHT_RATIO;
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
    if (!visible && !isClosing) {
      setIsClosing(true);
    }
  }, [visible, isClosing]);

  useEffect(() => {
    if (!visible && isClosing) {
      translateY.value = withTiming(
        sheetHeight,
        {
          duration: SHEET_ANIM_OUT_MS,
          easing: Easing.in(Easing.ease),
        },
        (finished) => {
          if (finished) runOnJS(finishClose)();
        }
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

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleBackdropPress = () => {
    if (!visible) return;
    setIsClosing(true);
    translateY.value = withTiming(
      sheetHeight,
      {
        duration: SHEET_ANIM_OUT_MS,
        easing: Easing.in(Easing.ease),
      },
      (finished) => {
        if (finished) runOnJS(finishClose)();
      }
    );
    backdropOpacity.value = withTiming(0, {
      duration: SHEET_ANIM_OUT_MS,
      easing: Easing.in(Easing.ease),
    });
  };

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
        <Animated.View
          style={[
            styles.backdrop,
            backdropStyle,
          ]}
          pointerEvents="none"
        />
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
          pointerEvents="box-none"
        >
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.dateLabel}>{formatDateLabel(date)}</Text>
            <Text style={styles.levelLabel}>Completion level: {level}</Text>
            <View style={styles.placeholderRow}>
              <Text style={styles.placeholderLabel}>Missions completed</Text>
              <Text style={styles.placeholderValue}>—</Text>
            </View>
            <View style={styles.placeholderRow}>
              <Text style={styles.placeholderLabel}>XP earned</Text>
              <Text style={styles.placeholderValue}>—</Text>
            </View>
            <View style={styles.placeholderRow}>
              <Text style={styles.placeholderLabel}>Pet state</Text>
              <Text style={styles.placeholderValue}>—</Text>
            </View>
            <View style={styles.placeholderRow}>
              <Text style={styles.placeholderLabel}>Twin comment</Text>
              <Text style={styles.placeholderValue}>—</Text>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
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
          shadowColor: "#000000",
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  dateLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: COLORS.text,
    marginBottom: 4,
  },
  levelLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: SPACING.lg,
  },
  placeholderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  placeholderLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.text2,
  },
  placeholderValue: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: COLORS.muted,
  },
});
