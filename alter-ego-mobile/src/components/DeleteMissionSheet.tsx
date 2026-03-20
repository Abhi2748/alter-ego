/**
 * Bottom sheet to confirm removal of a personal mission (long-press from Home).
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Mission } from "@/services/missions";

export interface DeleteMissionSheetProps {
  visible: boolean;
  mission: Mission | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function displayDifficulty(d: string): string {
  const x = d.toLowerCase();
  if (x === "easy") return "Easy";
  if (x === "hard") return "Hard";
  return "Medium";
}

function difficultyBadgeStyle(d: string) {
  const x = d.toLowerCase();
  if (x === "easy") {
    return {
      bg: "rgba(139,92,246,0.1)" as const,
      border: "rgba(139,92,246,0.2)" as const,
      color: "#8B5CF6" as const,
    };
  }
  if (x === "hard") {
    return {
      bg: "rgba(239,68,68,0.1)" as const,
      border: "rgba(239,68,68,0.2)" as const,
      color: "#EF4444" as const,
    };
  }
  return {
    bg: "rgba(245,158,11,0.1)" as const,
    border: "rgba(245,158,11,0.2)" as const,
    color: "#F59E0B" as const,
  };
}

export function DeleteMissionSheet({ visible, mission, onConfirm, onCancel }: DeleteMissionSheetProps) {
  const d = mission?.difficulty ?? "medium";
  const badge = difficultyBadgeStyle(d);
  const label = displayDifficulty(d);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          {mission ? (
            <>
              <View style={styles.removingSection}>
                <Text style={styles.removingLabel}>REMOVING MISSION</Text>
                <View style={styles.previewCard}>
                  <View style={styles.previewInfo}>
                    <Text style={styles.previewTitle}>{mission.title}</Text>
                    <Text style={styles.previewMeta}>
                      Personal · {mission.xp_value ?? 0} XP per completion
                    </Text>
                  </View>
                  <View style={[styles.diffBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                    <Text style={[styles.diffBadgeText, { color: badge.color }]}>{label}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.bodySection}>
                <View style={styles.warningCallout}>
                  <View style={styles.warningIconCircle}>
                    <Text style={styles.warningIcon}>!</Text>
                  </View>
                  <Text style={styles.warningText}>
                    Removing this mission will{" "}
                    <Text style={styles.warningBold}>delete it permanently</Text>
                    {" "}from your list. This can't be undone.
                  </Text>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.8 }]}
                  onPress={onConfirm}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  <Text style={styles.removeBtnLabel}>Remove Mission</Text>
                </Pressable>

                <Pressable style={styles.cancelBtn} onPress={onCancel}>
                  <Text style={styles.cancelBtnLabel}>Cancel</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(7,8,15,0.65)",
  },
  sheet: {
    backgroundColor: "#111827",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "#2A3050",
    paddingBottom: 40,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -10 },
        shadowRadius: 30,
        shadowOpacity: 0.8,
      },
      android: { elevation: 20 },
    }),
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#1E2333",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  removingSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2333",
    marginBottom: 16,
  },
  removingLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#6B7280",
    marginBottom: 10,
  },
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141824",
    borderWidth: 1,
    borderColor: "#2A3050",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  previewInfo: {
    flex: 1,
    minWidth: 0,
  },
  previewTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    fontWeight: "600",
    color: "#E5E7EB",
    marginBottom: 2,
  },
  previewMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#9CA3AF",
  },
  diffBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    flexShrink: 0,
  },
  diffBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    fontWeight: "700",
  },
  bodySection: {
    paddingHorizontal: 20,
  },
  warningCallout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(239,68,68,0.06)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.15)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  warningIconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(239,68,68,0.15)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  warningIcon: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    fontWeight: "800",
    color: "#EF4444",
  },
  warningText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#9CA3AF",
    lineHeight: 19.5,
  },
  warningBold: {
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
    color: "#EF4444",
  },
  removeBtn: {
    width: "100%",
    height: 56,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 12,
  },
  removeBtnLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    fontWeight: "700",
    color: "#EF4444",
    letterSpacing: 0.2,
  },
  cancelBtn: {
    width: "100%",
    height: 48,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#2A3050",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
  },
});
