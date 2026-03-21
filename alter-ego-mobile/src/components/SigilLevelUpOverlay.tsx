import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { SIGIL_LEVELS } from "@/constants/sigils";
import { SigilRenderer } from "@/components/sigil/SigilRenderer";
import { SigilGlow } from "@/components/sigil/SigilGlow";

export type SigilLevelUpPayload = {
  level: number;
  name: string | null;
};

type Props = {
  payload: SigilLevelUpPayload | null;
  onClose: () => void;
};

export function SigilLevelUpOverlay({ payload, onClose }: Props) {
  const scale = useSharedValue(0.3);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!payload) {
      setOpen(false);
      return;
    }
    setOpen(true);
    scale.value = 0.3;
    scale.value = withSpring(1, { damping: 14, stiffness: 120 });
    const t = setTimeout(() => onClose(), 6000);
    return () => clearTimeout(t);
  }, [payload, onClose, scale]);

  const animSigil = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!payload) return null;

  const L = Math.min(10, Math.max(1, payload.level));
  const meta = SIGIL_LEVELS[L - 1];
  const prog = L >= 10 ? 100 : 0;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.glowSlot} pointerEvents="none">
          <SigilGlow size={400} color="rgba(167,139,250,0.12)" durationMs={8000} />
        </View>
        <View style={styles.center}>
          <Animated.View style={[styles.sigilWrap, animSigil]}>
            <SigilRenderer
              level={L}
              size={200}
              accentColor={meta.accentColor}
              accentColor2={meta.accentColor2}
            />
          </Animated.View>
          <Text style={styles.evolved}>SIGIL EVOLVED</Text>
          <Text style={styles.name}>{payload.name ?? meta.name}</Text>
          <Text style={styles.lv}>Level {L}</Text>
          <View style={styles.barTrack}>
            <LinearGradient
              colors={[meta.accentColor2, meta.accentColor]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.barFill, { width: `${prog}%` }]}
            />
          </View>
          <Pressable onPress={onClose} style={styles.ctaWrap}>
            <LinearGradient
              colors={["#6D28D9", "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>Continue</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  glowSlot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    paddingHorizontal: 24,
    width: "100%",
  },
  sigilWrap: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  evolved: {
    marginTop: 32,
    fontSize: 10,
    fontWeight: "700",
    color: "#A78BFA",
    letterSpacing: 4,
    textTransform: "uppercase",
    fontFamily: "Inter_700Bold",
  },
  name: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: "900",
    color: "#E5E7EB",
    letterSpacing: -0.8,
    textAlign: "center",
    fontFamily: "Inter_800ExtraBold",
  },
  lv: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
    fontFamily: "Inter_500Medium",
  },
  barTrack: {
    marginTop: 20,
    width: 220,
    height: 3,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  barFill: {
    height: 3,
    borderRadius: 3,
  },
  ctaWrap: {
    marginTop: 32,
    width: "100%",
    maxWidth: 320,
    borderRadius: 16,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#8B5CF6",
        shadowOpacity: 0.4,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 8 },
    }),
  },
  cta: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#E5E7EB",
    fontFamily: "Inter_700Bold",
  },
});
