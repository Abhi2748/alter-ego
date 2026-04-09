/**
 * Simple full-screen acknowledgement when pet stage increases (no cinematic).
 */

import React from "react";
import { View, Text, StyleSheet, Modal, Pressable } from "react-native";
import { COLORS, SPACING, RADIUS } from "@/constants/theme";

export interface PetEvolutionModalProps {
  visible: boolean;
  petName: string;
  onClose: () => void;
}

export function PetEvolutionModal({ visible, petName, onClose }: PetEvolutionModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {visible ? (
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.kicker}>Companion evolved</Text>
            <Text style={styles.name}>{petName}</Text>
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
  name: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
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
