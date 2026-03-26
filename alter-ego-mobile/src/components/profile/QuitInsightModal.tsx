import React from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { QUIT_ORANGE } from "@/constants/missionColors";

export type QuitInsightModalProps = {
  visible: boolean;
  title: string;
  body: string;
  onClose: () => void;
};

export function QuitInsightModal({ visible, title, body, onClose }: QuitInsightModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.cardWrap} onPress={(e) => e.stopPropagation()}>
          <View style={styles.card}>
            <LinearGradient
              colors={["transparent", "rgba(239,68,68,0.5)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topAccent}
            />
            <View style={styles.headerRow}>
              <View style={styles.iconBlock}>
                <Text style={styles.iconEmoji}>💡</Text>
              </View>
              <Text style={styles.insightLbl}>INSIGHT UNLOCKED</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
            <Pressable style={styles.btn} onPress={onClose}>
              <Text style={styles.btnText}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  cardWrap: { maxWidth: 340, width: "100%" },
  card: {
    backgroundColor: "#100C0C",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    overflow: "hidden",
  },
  topAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  iconBlock: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: QUIT_ORANGE.surface,
    borderWidth: 1,
    borderColor: QUIT_ORANGE.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconEmoji: { fontSize: 14 },
  insightLbl: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    color: QUIT_ORANGE.primary,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_800ExtraBold",
    color: "#E5E7EB",
    marginBottom: 8,
  },
  body: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    lineHeight: 22,
    marginBottom: 20,
  },
  btn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: QUIT_ORANGE.surface,
    borderColor: QUIT_ORANGE.border2,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: QUIT_ORANGE.primary },
});
