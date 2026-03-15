/**
 * Mark as Conquered — confirm sheet, then show Conquered milestone. Spec §7.2.
 */

import React from "react";
import { View, Text, StyleSheet, Modal, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QuitMilestoneIcon } from "./QuitMilestoneIcons";

const GREEN = "#10B981";
const GREEN_DEEP = "#059669";
const GREEN_DARK = "#064E3B";
const LIGHT_GREEN = "#6EE7B7";
const TEXT = "#E5E7EB";
const MUTED = "#4B5563";

interface MarkAsConqueredSheetProps {
  visible: boolean;
  quitName: string;
  finalCleanDays: number;
  cravingsResisted: number;
  journeyDays: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function MarkAsConqueredSheet({
  visible,
  quitName,
  finalCleanDays,
  cravingsResisted,
  journeyDays,
  onConfirm,
  onCancel,
}: MarkAsConqueredSheetProps) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide">
      <Pressable style={styles.overlay} onPress={onCancel}>
        <LinearGradient
          colors={["#080F0C", "#050A07"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}
        >
          <View style={styles.accentLine} />
          <View style={[styles.iconWrap, { borderColor: "rgba(16,185,129,0.35)" }]}>
            <QuitMilestoneIcon type="conquered" color={GREEN} size={30} />
          </View>
          <Text style={styles.title}>Mark as Conquered?</Text>
          <Text style={styles.sub}>
            You're telling us you're done with this — for good. We'll create a milestone card for you to share, and move this to your Conquered list.
          </Text>
          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>YOUR MILESTONE CARD WILL SHOW</Text>
            <View style={styles.previewRow}>
              <View style={styles.previewCol}>
                <Text style={[styles.previewValue, { color: LIGHT_GREEN }]}>{finalCleanDays}</Text>
                <Text style={styles.previewColLabel}>Clean Days</Text>
              </View>
              <View style={styles.previewCol}>
                <Text style={[styles.previewValue, { color: LIGHT_GREEN }]}>{cravingsResisted}</Text>
                <Text style={styles.previewColLabel}>Cravings Resisted</Text>
              </View>
              <View style={styles.previewCol}>
                <Text style={[styles.previewValue, { color: LIGHT_GREEN }]}>{journeyDays}</Text>
                <Text style={styles.previewColLabel}>Journey (days)</Text>
              </View>
            </View>
          </View>
          <Pressable onPress={onConfirm} style={styles.primaryBtn}>
            <LinearGradient
              colors={[GREEN_DARK, GREEN_DEEP, GREEN]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.primaryBtnText}>✦ Yes, I conquered this</Text>
          </Pressable>
          <Pressable onPress={onCancel} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Not yet — keep tracking</Text>
          </Pressable>
        </LinearGradient>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.7)" },
  sheet: {
    width: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.25)",
    borderBottomWidth: 0,
  },
  accentLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(16,185,129,0.50)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(6,78,59,0.20)",
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
    shadowColor: "rgba(16,185,129,0.12)",
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  title: { fontSize: 22, fontWeight: "900", color: TEXT, textAlign: "center", marginBottom: 8 },
  sub: { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  previewCard: {
    backgroundColor: "rgba(6,78,59,0.12)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.18)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  previewLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "rgba(16,185,129,0.55)",
    marginBottom: 10,
  },
  previewRow: { flexDirection: "row", justifyContent: "space-between" },
  previewCol: { flex: 1, alignItems: "center" },
  previewValue: { fontSize: 18, fontWeight: "800" },
  previewColLabel: { fontSize: 8, color: MUTED, marginTop: 2 },
  primaryBtn: {
    height: 52,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "rgba(16,185,129,0.30)",
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF", textAlign: "center", paddingVertical: 16 },
  secondaryBtn: { height: 44, justifyContent: "center", alignItems: "center" },
  secondaryBtnText: { fontSize: 13, color: MUTED },
});
