import React, { useState } from "react";
import { View, Text, Modal, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { BlurView } from "expo-blur";

export type DeleteModalProps = {
  visible: boolean;
  onClose: () => void;
  interestName: string;
  questsCompleted: number;
  insightsUnlocked: number;
  onDelete: () => Promise<void>;
};

export function DeleteModal({
  visible,
  onClose,
  interestName,
  questsCompleted,
  insightsUnlocked,
  onDelete,
}: DeleteModalProps) {
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!visible) setLoading(false);
  }, [visible]);

  const run = async () => {
    setLoading(true);
    try {
      await onDelete();
      onClose();
    } catch {
      /* stay open; parent surfaced error */
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.overlayTint} />
        <View style={styles.card}>
          <Text style={styles.icon}>🗑</Text>
          <Text style={styles.title}>Delete {interestName}?</Text>
          <Text style={styles.body}>
            This will permanently delete your {interestName} interest including your entire Path,
            all <Text style={styles.red}>{questsCompleted} Quests completed</Text>, and all{" "}
            <Text style={styles.red}>{insightsUnlocked} Insights earned</Text>.
            {"\n\n"}
            <Text style={styles.red}>This cannot be undone.</Text> Your Craft SP will also be
            removed.
          </Text>
          <Pressable
            style={[styles.btnDanger, loading && { opacity: 0.7 }]}
            onPress={run}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#F87171" />
            ) : (
              <Text style={styles.btnDangerText}>Delete permanently</Text>
            )}
          </Pressable>
          <Pressable style={styles.btnGhost} onPress={onClose} disabled={loading}>
            <Text style={styles.btnGhostText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  overlayTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  card: {
    width: "100%",
    backgroundColor: "#0F1220",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    zIndex: 2,
  },
  icon: { fontSize: 32, textAlign: "center", marginBottom: 8 },
  title: {
    fontSize: 16,
    fontFamily: "Inter_800ExtraBold",
    color: "#E5E7EB",
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  red: { color: "#F87171", fontFamily: "Inter_700Bold" },
  btnDanger: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(248,113,113,0.12)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
    alignItems: "center",
    marginBottom: 8,
  },
  btnDangerText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#F87171",
  },
  btnGhost: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  btnGhostText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#6B7280",
  },
});
