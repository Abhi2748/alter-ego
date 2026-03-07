/**
 * Milestone Achievement Card — Modal overlay for milestone unlocks.
 * Full-screen dark overlay, centered card, "MILESTONE UNLOCKED" + achievement name + sub-text + character placeholder + earned badge + Share. Auto-dismiss 8s, tap outside dismisses.
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, GRADIENTS, RADIUS, SHADOWS } from "../constants/theme";

const CARD_WIDTH = 340;
const CARD_HEIGHT = 480;
const CARD_RADIUS = 24;
const AUTO_DISMISS_MS = 8000;
const CHAR_PLACEHOLDER_W = 140;
const CHAR_PLACEHOLDER_H = 180;
const SHARE_BTN_HEIGHT = 48;

export interface MilestoneAchievementCardProps {
  visible: boolean;
  onClose: () => void;
  /** e.g. "7-Day Streak" */
  achievementName: string;
  /** Optional italic sub-text */
  subText?: string;
  /** e.g. "Earned: 1 Streak Freeze" */
  earnedBadge?: string;
}

export function MilestoneAchievementCard({
  visible,
  onClose,
  achievementName,
  subText = "You're building something real.",
  earnedBadge = "Earned: 1 Streak Freeze",
}: MilestoneAchievementCardProps) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      onClose();
    }, AUTO_DISMISS_MS);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [visible, onClose]);

  const handleShare = () => {
    console.log("[MilestoneAchievementCard] Share — Phase 1");
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.cardWrap}>
          <LinearGradient
            colors={["#1E1B4B", "#0D0F1A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[styles.card, { width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: CARD_RADIUS }]}
          >
            <Text style={styles.label}>MILESTONE UNLOCKED</Text>
            <Text style={styles.achievementName}>{achievementName}</Text>
            {subText ? (
              <Text style={styles.subText} numberOfLines={2}>
                {subText}
              </Text>
            ) : null}
            <View
              style={[
                styles.charPlaceholder,
                { width: CHAR_PLACEHOLDER_W, height: CHAR_PLACEHOLDER_H },
              ]}
            />
            <View style={styles.badgeWrap}>
              <Text style={styles.badgeText}>{earnedBadge}</Text>
            </View>
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [styles.shareBtnWrap, pressed && styles.shareBtnPressed]}
            >
              <LinearGradient
                colors={GRADIENTS.button.colors}
                start={GRADIENTS.button.start}
                end={GRADIENTS.button.end}
                style={[styles.shareBtn, SHADOWS.button]}
              >
                <Ionicons name="share-outline" size={18} color={COLORS.text} />
                <Text style={styles.shareBtnText}>Share</Text>
              </LinearGradient>
            </Pressable>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#0F0C29",
    justifyContent: "center",
    alignItems: "center",
  },
  cardWrap: {
    overflow: "hidden",
    borderRadius: CARD_RADIUS,
  },
  card: {
    padding: SPACING.lg,
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: COLORS.violetGlow,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  achievementName: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: COLORS.text,
    textAlign: "center",
    marginTop: 4,
  },
  subText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    fontStyle: "italic",
    color: COLORS.text2,
    textAlign: "center",
    marginTop: 8,
  },
  charPlaceholder: {
    backgroundColor: COLORS.surface2,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badgeWrap: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(139,92,246,0.15)",
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    borderColor: COLORS.violet,
  },
  badgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.violetGlow,
  },
  shareBtnWrap: {
    width: "100%",
  },
  shareBtnPressed: { opacity: 0.9 },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: SHARE_BTN_HEIGHT,
    borderRadius: RADIUS.card,
    gap: 8,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#8B5CF6",
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        }
      : { elevation: 8 }),
  },
  shareBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
});
