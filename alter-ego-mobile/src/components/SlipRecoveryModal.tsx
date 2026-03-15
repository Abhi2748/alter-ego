/**
 * Slip recovery modal — shown when streak breaks. Spec §6.
 * No shame language. "It happens." Stats preserved. Start again / I need help.
 */

import React from "react";
import { View, Text, StyleSheet, Modal, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QuitMilestoneIcon } from "./QuitMilestoneIcons";

const EMBER = "#F97316";
const VIOLET_GLOW = "#A78BFA";
const VIOLET = "#8B5CF6";
const TEXT = "#E5E7EB";
const MUTED = "#4B5563";
const DIM = "#374151";

interface SlipRecoveryModalProps {
  visible: boolean;
  quitName: string;
  bestStreak: number;
  totalCleanDays: number;
  cravingsResisted: number;
  onStartAgain: () => void;
  onNeedHelp: () => void;
  onClose: () => void;
}

export function SlipRecoveryModal({
  visible,
  quitName,
  bestStreak,
  totalCleanDays,
  cravingsResisted,
  onStartAgain,
  onNeedHelp,
  onClose,
}: SlipRecoveryModalProps) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 32 }]} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <LinearGradient
            colors={["#0E0A04", "#090804"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.sheetGradient}
          />
          <View style={styles.iconWrap}>
            <QuitMilestoneIcon type="comeback" color={EMBER} size={28} />
          </View>
          <Text style={styles.title}>It happens.</Text>
          <Text style={styles.sub}>
            Your streak broke. You're back now. That matters more than the slip.
          </Text>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>What you built stays</Text>
            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text style={[styles.statValue, { color: EMBER }]}>{bestStreak}</Text>
                <Text style={styles.statLabel}>Best Streak</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={[styles.statValue, { color: VIOLET_GLOW }]}>{totalCleanDays}</Text>
                <Text style={styles.statLabel}>Total Clean Days</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={[styles.statValue, { color: VIOLET }]}>{cravingsResisted}</Text>
                <Text style={styles.statLabel}>Cravings Resisted</Text>
              </View>
            </View>
          </View>
          <Pressable onPress={onStartAgain} style={styles.primaryBtn}>
            <LinearGradient
              colors={["#C2410C", EMBER]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.primaryBtnText}>Start again today</Text>
          </Pressable>
          <Pressable onPress={onNeedHelp} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>I need help understanding why I slipped</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sheet: {
    width: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.20)",
    borderBottomWidth: 0,
  },
  sheetGradient: { ...StyleSheet.absoluteFillObject },
  handle: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignSelf: "center",
    marginBottom: 16,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(249,115,22,0.12)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.22)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: "900", color: TEXT, textAlign: "center", marginBottom: 8 },
  sub: { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  statsCard: {
    backgroundColor: "rgba(255,255,255,0.025)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.30)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  statsLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: DIM, marginBottom: 10 },
  statsRow: { flexDirection: "row", justifyContent: "space-between" },
  statCol: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 8, color: DIM, marginTop: 2 },
  primaryBtn: {
    height: 52,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
  },
  primaryBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF", textAlign: "center", paddingVertical: 16 },
  secondaryBtn: { height: 40, justifyContent: "center", alignItems: "center" },
  secondaryBtnText: { fontSize: 13, color: MUTED },
});
