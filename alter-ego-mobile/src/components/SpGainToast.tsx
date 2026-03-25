/**
 * SP gain toast — Reanimated enter/hold/exit. Parent mounts once per trigger; calls onFinish when done.
 */

import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { STATS, type AbilityStatKey } from "@/constants/stats";

export interface SpGainToastProps {
  gains: Array<{ statKey: AbilityStatKey; amount: number }>;
  /** Twin rivalry line after mission complete (optional). */
  footerNote?: string;
  onFinish: () => void;
}

export function SpGainToast({ gains, footerNote, onFinish }: SpGainToastProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-10);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (gains.length === 0 && !footerNote) {
      onFinish();
      return;
    }

    let cancelled = false;

    opacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
    translateY.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) });

    const holdMs = 2000;
    const t = setTimeout(() => {
      if (cancelled) return;
      translateY.value = withTiming(-12, { duration: 200, easing: Easing.in(Easing.quad) });
      opacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) runOnJS(onFinish)();
      });
    }, holdMs);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [gains, footerNote, onFinish, opacity, translateY]);

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, animatedStyle]}>
      <View style={styles.box}>
        {gains.map((g, i) => {
          const s = STATS[g.statKey];
          return (
            <View key={`${g.statKey}-${i}`} style={styles.row}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: s.color,
                    shadowColor: s.color,
                  },
                ]}
              />
              <Text style={[styles.amountSym, { color: s.color, fontFamily: "Inter_700Bold" }]}>
                +{g.amount} {s.symbol}
              </Text>
              <Text style={styles.labelSp} numberOfLines={1}>
                {s.label} SP
              </Text>
            </View>
          );
        })}
        {footerNote ? <Text style={styles.footerNote}>{footerNote}</Text> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 108,
    right: 16,
    zIndex: 2000,
    maxWidth: "72%",
  },
  box: {
    backgroundColor: "#141824",
    borderWidth: 1,
    borderColor: "#2A3050",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 3,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 4,
  },
  amountSym: {
    fontSize: 11,
    fontWeight: "700",
  },
  labelSp: {
    flex: 1,
    fontSize: 9,
    fontWeight: "500",
    color: "#6B7280",
  },
  footerNote: {
    marginTop: 2,
    fontSize: 11,
    color: "rgba(167,139,250,0.7)",
    fontStyle: "italic",
    fontFamily: "Inter_400Regular",
  },
});
