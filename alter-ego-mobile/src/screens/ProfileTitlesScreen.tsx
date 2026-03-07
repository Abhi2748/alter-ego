/**
 * Profile → Titles. Current stage hero (character 120×160, stage title, XP bar 240px §2.5)
 * and stage history list (6 stages: thumbnail 40×54, name, Reached Day X, days at stage).
 * Locked stages: opacity 0.3 + lock icon.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, GRADIENTS, RADIUS } from "../constants/theme";
import { XPProgressBar } from "../components/XPProgressBar";

const CHAR_PLACEHOLDER_W = 120;
const CHAR_PLACEHOLDER_H = 160;
const XP_BAR_WIDTH = 240;
const THUMB_W = 40;
const THUMB_H = 54;

const STAGES: { name: string; xpThreshold: number }[] = [
  { name: "The Awakened", xpThreshold: 0 },
  { name: "The Focused", xpThreshold: 10_000 },
  { name: "The Burning", xpThreshold: 50_000 },
  { name: "The Relentless", xpThreshold: 200_000 },
  { name: "The Formidable", xpThreshold: 600_000 },
  { name: "The Sovereign", xpThreshold: 1_500_000 },
];

/** Placeholder: current total XP and stage progress. */
const CURRENT_TOTAL_XP = 3_200;
const CURRENT_STAGE_INDEX = 0;
const NEXT_STAGE_XP = STAGES[1].xpThreshold;
const NEXT_STAGE_NAME = STAGES[1].name;
const CURRENT_STAGE_NAME = STAGES[CURRENT_STAGE_INDEX].name;

/** Placeholder: for each stage, reached day and days at stage. -1 = locked. */
const STAGE_HISTORY: { reachedDay: number; daysAtStage: number }[] = [
  { reachedDay: 1, daysAtStage: 45 },
  { reachedDay: 46, daysAtStage: 12 },
  { reachedDay: -1, daysAtStage: 0 },
  { reachedDay: -1, daysAtStage: 0 },
  { reachedDay: -1, daysAtStage: 0 },
  { reachedDay: -1, daysAtStage: 0 },
];

export function ProfileTitlesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const contentWidth = width - SPACING.screenPadding * 2;

  const currentXPInStage =
    CURRENT_STAGE_INDEX < STAGES.length - 1
      ? CURRENT_TOTAL_XP - STAGES[CURRENT_STAGE_INDEX].xpThreshold
      : 0;
  const xpToNext =
    CURRENT_STAGE_INDEX < STAGES.length - 1
      ? NEXT_STAGE_XP - STAGES[CURRENT_STAGE_INDEX].xpThreshold
      : 1;

  return (
    <LinearGradient
      colors={GRADIENTS.background.colors}
      start={GRADIENTS.background.start}
      end={GRADIENTS.background.end}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Titles</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + SPACING.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: current stage */}
        <View style={[styles.hero, { width: contentWidth }]}>
          <View
            style={[
              styles.charPlaceholder,
              { width: CHAR_PLACEHOLDER_W, height: CHAR_PLACEHOLDER_H },
            ]}
          />
          <Text style={styles.stageTitle}>{CURRENT_STAGE_NAME}</Text>
          <XPProgressBar
            currentXP={currentXPInStage}
            nextStageXP={xpToNext}
            nextStageName={NEXT_STAGE_NAME}
            width={XP_BAR_WIDTH}
          />
        </View>

        {/* Stage history */}
        <Text style={styles.sectionLabel}>Stage history</Text>
        {STAGES.map((stage, index) => {
          const history = STAGE_HISTORY[index];
          const unlocked = history.reachedDay >= 0;
          return (
            <View
              key={stage.name}
              style={[styles.stageRow, !unlocked && styles.stageRowLocked]}
            >
              {!unlocked && (
                <View style={styles.lockOverlayCenter} pointerEvents="none">
                  <Ionicons name="lock-closed" size={16} color={COLORS.text} />
                </View>
              )}
              <View style={[styles.thumbWrap, { width: THUMB_W, height: THUMB_H }]}>
                <View style={styles.thumbPlaceholder} />
              </View>
              <View style={styles.stageInfo}>
                <Text style={styles.stageName}>{stage.name}</Text>
                {unlocked ? (
                  <>
                    <Text style={styles.reachedLabel}>
                      Reached Day {history.reachedDay}
                    </Text>
                    <Text style={styles.daysLabel}>
                      {history.daysAtStage} day{history.daysAtStage !== 1 ? "s" : ""} at stage
                    </Text>
                  </>
                ) : (
                  <Text style={styles.lockedLabel}>Locked</Text>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { marginRight: SPACING.sm },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: COLORS.text,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: SPACING.lg,
  },
  hero: {
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  charPlaceholder: {
    backgroundColor: COLORS.surface2,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  stageTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  sectionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.muted,
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: SPACING.cardPadding,
    marginBottom: SPACING.cardGap,
    borderWidth: 1,
    borderColor: COLORS.border,
    position: "relative",
  },
  stageRowLocked: {
    opacity: 0.3,
  },
  lockOverlayCenter: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  thumbWrap: {
    marginRight: SPACING.md,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  thumbPlaceholder: {
    flex: 1,
    backgroundColor: COLORS.surface2,
    ...StyleSheet.absoluteFillObject,
  },
  stageInfo: { flex: 1 },
  stageName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
  reachedLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },
  daysLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 1,
  },
  lockedLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },
});
