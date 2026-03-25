import React, { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { hexWithAlpha } from "@/utils/interestColor";

export type InsightModalProps = {
  visible: boolean;
  onClose: () => void;
  colorHex: string;
  title: string;
  body: string;
};

export function InsightModal({ visible, onClose, colorHex, title, body }: InsightModalProps) {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 16, stiffness: 220 });
      opacity.value = withTiming(1, { duration: 350 });
    } else {
      scale.value = 0.9;
      opacity.value = 0;
    }
  }, [visible, opacity, scale]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => onClose(), 8000);
    return () => clearTimeout(t);
  }, [visible, onClose]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const C = colorHex.startsWith("#") ? colorHex : `#${colorHex}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.back} onPress={onClose}>
        <Animated.View style={[styles.cardWrap, anim]}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.card}>
              <LinearGradient
                colors={["transparent", hexWithAlpha(C, "80"), "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.topAccent}
              />
              <View style={styles.headerRow}>
                <View
                  style={[
                    styles.bulb,
                    {
                      backgroundColor: hexWithAlpha(C, "24"),
                      borderColor: hexWithAlpha(C, "3D"),
                    },
                  ]}
                >
                  <Text style={styles.bulbEmoji}>💡</Text>
                </View>
                <Text style={[styles.insightLbl, { color: C }]}>INSIGHT UNLOCKED</Text>
              </View>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.body}>{body}</Text>
              <Pressable
                onPress={onClose}
                style={[
                  styles.btn,
                  {
                    backgroundColor: hexWithAlpha(C, "1E"),
                    borderColor: hexWithAlpha(C, "4D"),
                  },
                ]}
              >
                <Text style={[styles.btnText, { color: C }]}>Got it</Text>
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  back: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 40,
  },
  cardWrap: {
    maxWidth: 340,
    width: "100%",
    alignSelf: "center",
  },
  card: {
    backgroundColor: "#0F1220",
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
  bulb: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bulbEmoji: { fontSize: 18 },
  insightLbl: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
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
    color: "#6B7280",
    lineHeight: 22,
    marginBottom: 20,
  },
  btn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
