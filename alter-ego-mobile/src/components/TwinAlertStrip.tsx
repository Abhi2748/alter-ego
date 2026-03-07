/**
 * Twin Alert Strip §2.9 — Tap to open Twin Chat. Glow pulse §3.3 when hasNewMessage.
 * Left: Twin thumbnail (placeholder "T" in Phase 1). Center: message. Right: chevron.
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import { COLORS, SPACING } from "../constants/theme";

const STRIP_HEIGHT = 56;
const THUMB_SIZE = 40;
const GLOW_DURATION = 300; // 300ms each way = 600ms per cycle
const GLOW_MIN = 0.2;
const GLOW_MAX = 0.7;
const GLOW_REPEATS = 3;

export interface TwinAlertStripProps {
  message: string;
  hasNewMessage: boolean;
  onPress: () => void;
  /** Optional. Phase 1 uses placeholder. When set, shows character_[stage+1]_[gender].png */
  twinThumbnailUri?: string | null;
}

const DEFAULT_MESSAGE = "You hesitated yesterday. I didn't.";

export function TwinAlertStrip({
  message,
  hasNewMessage,
  onPress,
  twinThumbnailUri,
}: TwinAlertStripProps) {
  const glowOpacity = useSharedValue(0);
  const prevNewMessage = useRef(false);

  useEffect(() => {
    const justBecameTrue = hasNewMessage && !prevNewMessage.current;
    prevNewMessage.current = hasNewMessage;
    if (justBecameTrue) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(GLOW_MAX, {
            duration: GLOW_DURATION,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(GLOW_MIN, {
            duration: GLOW_DURATION,
            easing: Easing.inOut(Easing.ease),
          })
        ),
        GLOW_REPEATS,
        false
      );
    }
  }, [hasNewMessage]);

  const animatedStripStyle = useAnimatedStyle(() => {
    const opacity = glowOpacity.value;
    const borderColor =
      opacity === 0 ? "#2A3050" : `rgba(192,132,252,${opacity})`;
    return {
      borderTopColor: borderColor,
      borderBottomColor: borderColor,
      shadowColor: "#C084FC",
      shadowOpacity: opacity,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 0 },
      ...(Platform.OS === "android" && { elevation: opacity > 0 ? 12 : 0 }),
    };
  }, []);

  return (
    <Pressable
      style={styles.touchable}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open Twin chat"
    >
      <Animated.View style={[styles.strip, animatedStripStyle]}>
        <BlurView
          intensity={8}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.stripOverlay,
          ]}
        />
        <View style={styles.row}>
          <View style={styles.thumbnailWrap}>
            {twinThumbnailUri ? (
              <Image
                source={{ uri: twinThumbnailUri }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.thumbnailPlaceholder}>
                <Text style={styles.thumbnailLabel}>T</Text>
              </View>
            )}
          </View>
          <Text
            style={styles.message}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {message || DEFAULT_MESSAGE}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={COLORS.muted}
            style={styles.chevron}
          />
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchable: {
    height: STRIP_HEIGHT,
    minHeight: STRIP_HEIGHT,
  },
  strip: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    overflow: "hidden",
  },
  stripOverlay: {
    backgroundColor: COLORS.glass,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.screenPadding,
  },
  thumbnailWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.violet,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  thumbnailPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(109,40,217,0.4)",
    borderRadius: THUMB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: COLORS.violet,
  },
  message: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.text2,
  },
  chevron: {
    marginLeft: SPACING.sm,
  },
});
