/**
 * Character stage-up — simple modal (no cinematic / particle sequence).
 */

import React from "react";
import { View, Text, StyleSheet, Modal, Pressable } from "react-native";
import { COLORS, SPACING, RADIUS } from "../constants/theme";

export interface CharacterEvolutionOverlayProps {
  visible: boolean;
  onClose: () => void;
  stageName: string;
}

export function CharacterEvolutionOverlay({
  visible,
  onClose,
  stageName,
}: CharacterEvolutionOverlayProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {visible ? (
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.kicker}>New stage</Text>
            <Text style={styles.stageName}>{stageName}</Text>
            <Pressable style={styles.btn} onPress={onClose}>
              <Text style={styles.btnText}>Continue</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(7,8,15,0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.screenPadding,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: RADIUS.modal,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    alignItems: "center",
  },
  kicker: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    letterSpacing: 2,
    color: COLORS.muted,
    textTransform: "uppercase",
    marginBottom: SPACING.sm,
  },
  stageName: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: COLORS.text,
    textAlign: "center",
    marginBottom: SPACING.lg,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.violetDeep,
  },
  btnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
});
