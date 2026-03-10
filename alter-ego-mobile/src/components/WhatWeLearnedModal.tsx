/**
 * Phase E: Optional "What we learned about you" modal at day 14.
 * Show before or with paywall when backend returns show: true and bullets.
 */

import React from "react";
import { View, Text, StyleSheet, Modal, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, RADIUS, GRADIENTS } from "../constants/theme";

export interface WhatWeLearnedModalProps {
  visible: boolean;
  onClose: () => void;
  bullets: string[];
}

export function WhatWeLearnedModal({
  visible,
  onClose,
  bullets,
}: WhatWeLearnedModalProps) {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.cardWrap} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={GRADIENTS.rankCard.colors as unknown as [string, string]}
            start={GRADIENTS.rankCard.start}
            end={GRADIENTS.rankCard.end}
            style={styles.card}
          >
            <Text style={styles.title}>What we learned about you</Text>
            {bullets.map((line, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{line}</Text>
              </View>
            ))}
            <Pressable onPress={onClose} style={styles.button}>
              <Text style={styles.buttonLabel}>Continue</Text>
            </Pressable>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.md,
  },
  cardWrap: {
    width: "100%",
    maxWidth: 340,
  },
  card: {
    borderRadius: RADIUS.modal,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: SPACING.sm,
  },
  bulletDot: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: COLORS.violet,
    marginRight: SPACING.sm,
  },
  bulletText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: COLORS.text2,
    flex: 1,
  },
  button: {
    marginTop: SPACING.lg,
    height: 48,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
});
