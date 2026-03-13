/**
 * Compact milestone row for Interests tab — locked and unlocked states.
 * Unlocked: violet left edge, tappable, opens full-screen card. Locked: dim, not pressable.
 */

import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import type { MilestoneDefinition } from "../constants/milestoneDefinitions";
import type { InterestMilestone } from "../constants/milestoneDefinitions";

const ROW_ENTRANCE_DURATION = 220;
const ROW_ENTRANCE_DELAY_PER_INDEX = 40;
const EASE_OUT = Easing.out(Easing.ease);

function formatEarnedMeta(milestone: InterestMilestone, definition: MilestoneDefinition): string {
  if (!milestone.earned_at || !milestone.stats) return "";
  const date = new Date(milestone.earned_at);
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const stats = milestone.stats;
  let brief = "";
  if (definition.id === "first_step") brief = "Session 1";
  else if (definition.id === "seven_days") brief = `${stats.streak_days ?? 7}-day streak`;
  else if (definition.id === "ten_sessions") brief = `${stats.sessions_count} sessions`;
  else if (definition.id === "tier_up") brief = `${stats.old_tier ?? "Easy"} → ${stats.new_tier ?? "Medium"}`;
  else if (definition.id === "one_month") brief = `${stats.days_since_start ?? 30} days`;
  else if (definition.id === "fifty_sessions") brief = `${stats.sessions_count} sessions`;
  else if (definition.id === "hundred_sessions") brief = `${stats.sessions_count} sessions`;
  else brief = `${stats.sessions_count} sessions`;
  return `Earned ${dateStr} · ${brief}`;
}

export interface MilestoneRowProps {
  definition: MilestoneDefinition;
  milestone: InterestMilestone;
  onPress: () => void;
  rowIndex: number;
}

export function MilestoneRow({ definition, milestone, onPress, rowIndex }: MilestoneRowProps) {
  const opacity = useSharedValue(milestone.earned ? 0 : 0.38);
  const translateY = useSharedValue(milestone.earned ? 6 : 0);

  useEffect(() => {
    const delay = rowIndex * ROW_ENTRANCE_DELAY_PER_INDEX;
    opacity.value = withDelay(
      delay,
      withTiming(milestone.earned ? 1 : 0.38, { duration: ROW_ENTRANCE_DURATION, easing: EASE_OUT })
    );
    if (milestone.earned) {
      translateY.value = withDelay(
        delay,
        withTiming(0, { duration: ROW_ENTRANCE_DURATION, easing: EASE_OUT })
      );
    }
  }, [milestone.earned, rowIndex]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const isM7 = definition.isRare && milestone.earned;
  const displayIcon = definition.id === "fifty_sessions"
    ? (milestone.interest_icon ?? "✨")
    : (definition.icon ?? "✨");

  if (milestone.earned) {
    return (
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.container,
            styles.containerUnlocked,
            isM7 && styles.containerM7,
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.leftAccent, isM7 && styles.leftAccentM7]} />
          <View style={[styles.iconCircle, isM7 && styles.iconCircleM7]}>
            <Text style={styles.iconText}>{displayIcon}</Text>
          </View>
          <View style={styles.center}>
            <Text style={styles.title}>{definition.title}</Text>
            <Text style={[styles.meta, isM7 && styles.metaM7]} numberOfLines={1}>
              {formatEarnedMeta(milestone, definition)}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={animatedStyle}>
      <View style={styles.container}>
        <View style={styles.iconCircleLocked}>
          <Text style={styles.iconTextLocked}>{displayIcon}</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.title}>{definition.title}</Text>
          <Text style={styles.hint} numberOfLines={1}>
            {definition.lockedHint}
          </Text>
        </View>
        <Text style={styles.lockIcon}>🔒</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    backgroundColor: "#141824",
    borderWidth: 1,
    borderColor: "#1E2333",
  },
  containerUnlocked: {
    opacity: 1,
    borderColor: "rgba(139,92,246,0.22)",
    position: "relative",
  },
  containerM7: {
    borderColor: "rgba(245,158,11,0.25)",
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  leftAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: "#8B5CF6",
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  leftAccentM7: {
    backgroundColor: "#F59E0B",
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(139,92,246,0.10)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleM7: {
    backgroundColor: "rgba(245,158,11,0.08)",
    borderColor: "rgba(245,158,11,0.25)",
  },
  iconCircleLocked: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(107,114,128,0.10)",
    borderWidth: 1,
    borderColor: "rgba(107,114,128,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 16,
  },
  iconTextLocked: {
    fontSize: 16,
    color: "#6B7280",
  },
  center: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E5E7EB",
  },
  hint: {
    fontSize: 10,
    fontWeight: "400",
    color: "#6B7280",
    marginTop: 2,
  },
  meta: {
    fontSize: 10,
    fontWeight: "400",
    color: "#A78BFA",
    marginTop: 2,
  },
  metaM7: {
    color: "#F59E0B",
  },
  chevron: {
    fontSize: 16,
    color: "#6B7280",
  },
  lockIcon: {
    fontSize: 13,
    color: "#6B7280",
    opacity: 0.5,
  },
});

export default MilestoneRow;
