import React, { useEffect } from "react";
import { View, Text, Modal, Pressable, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { SIGIL_LEVELS } from "@/constants/sigils";

export interface SigilLevelUpPayload {
  level: number;
  name: string;
}

interface Props {
  payload: SigilLevelUpPayload | null;
  onClose: () => void;
}

export function SigilLevelUpOverlay({ payload, onClose }: Props) {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!payload) return;
    scale.value = 0.8;
    opacity.value = 0;
    scale.value = withSpring(1, { damping: 14, stiffness: 120 });
    opacity.value = withTiming(1, { duration: 400 });
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [payload, onClose]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!payload) return null;

  const meta = SIGIL_LEVELS[Math.min(payload.level - 1, 9)];

  return (
    <Modal transparent animationType="fade" visible={!!payload}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, animStyle]}>
          <View
            style={[
              styles.glowRing,
              {
                borderColor: meta.accentColor,
                shadowColor: meta.accentColor,
              },
            ]}
          />

          <Text style={[styles.evolvedLabel, { color: meta.accentColor }]}>SIGIL EVOLVED</Text>

          <View
            style={[
              styles.sigilCircle,
              {
                backgroundColor: meta.accentColor + "22",
                borderColor: meta.accentColor,
              },
            ]}
          >
            <View style={[styles.sigilDot, { backgroundColor: meta.accentColor }]} />
          </View>

          <Text style={styles.levelName}>{payload.name}</Text>
          <Text style={styles.levelNum}>Level {payload.level}</Text>

          <Pressable onPress={onClose} style={styles.btnWrap}>
            <LinearGradient
              colors={["#6D28D9", "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btn}
            >
              <Text style={styles.btnTxt}>Continue</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#0F1220",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 32,
    alignItems: "center",
  },
  glowRing: {
    position: "absolute",
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: 25,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  evolvedLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 4,
    textTransform: "uppercase",
    marginBottom: 24,
  },
  sigilCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  sigilDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  levelName: {
    fontSize: 28,
    fontWeight: "900",
    color: "#E5E7EB",
    letterSpacing: -0.8,
    marginBottom: 6,
    textAlign: "center",
  },
  levelNum: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 32,
  },
  btnWrap: { width: "100%", borderRadius: 14, overflow: "hidden" },
  btn: { paddingVertical: 16, alignItems: "center" },
  btnTxt: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
});
