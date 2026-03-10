/**
 * Twin Comparison Screen — Screen 17 v1.1. Tab 3. Wired to real twin_state (Twin Design §5.1, §5.2, 1.34).
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { PetAnimation } from "../components/PetAnimation";
import { COLORS, SPACING, RADIUS, GRADIENTS, SHADOWS } from "../constants/theme";
import { supabase } from "../utils/supabase";
import { getTwinComparison, type TwinComparisonOut } from "../utils/api";

const TOP_BAR_HEIGHT = 48;
const CHAR_ZONE_HEIGHT = 280;
const CHAR_WIDTH = 120;
const CHAR_HEIGHT = 160;
const PET_SIZE = 56;
const CHAR_TO_PET_GAP = 8;
const FRACTURE_WIDTH = 2;
const SECTION_GAP = 16;
const CHAR_ZONE_TOP_GAP = 32;
const CHAT_BUTTON_WIDTH = 280;
const CHAT_BUTTON_HEIGHT = 52;
const NAV_BAR_HEIGHT = 56;
const BOTTOM_ABOVE_NAV = 32;

/** Pet stage names 1–8 (Cub → Dragon). */
const PET_STAGE_NAMES: Record<number, string> = {
  1: "Cub",
  2: "Cat",
  3: "Fox",
  4: "Wolf",
  5: "Snow Leopard",
  6: "Panther",
  7: "Griffin",
  8: "Dragon",
};

export function TwinComparisonScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [comparison, setComparison] = useState<TwinComparisonOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const contentPaddingBottom =
    SECTION_GAP + CHAT_BUTTON_HEIGHT + BOTTOM_ABOVE_NAV + NAV_BAR_HEIGHT + insets.bottom;

  const fetchComparison = useCallback(async () => {
    try {
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }
      const data = await getTwinComparison(session.access_token);
      setComparison(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load comparison");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchComparison();
    }, [fetchComparison])
  );

  const formatPowerScore = (n: number) => n.toLocaleString();

  const openTwinChat = () => {
    (navigation as any).navigate("TwinChat");
  };

  // Derived from real data or fallbacks for loading/error
  const userStreak = comparison?.user_streak ?? 0;
  const twinStreak = comparison?.twin_streak ?? 0;
  const userPowerScore = comparison?.user_power_score ?? 0;
  const twinPowerScore = comparison?.twin_power_score ?? 0;
  const userPetStage = comparison?.user_pet_stage ?? 0;
  const twinPetStage = comparison?.twin_pet_stage ?? 0;
  const gapDays = comparison?.gap_days ?? null;
  const twinMessage = comparison?.strip_message ?? null;
  const gapLine = comparison?.gap_line ?? "";
  const userPetHappy = true;

  if (loading && !comparison) {
    return (
      <LinearGradient
        colors={GRADIENTS.background.colors}
        start={GRADIENTS.background.start}
        end={GRADIENTS.background.end}
        style={[styles.container, styles.centered]}
      >
        <View style={[styles.topBar, { paddingTop: insets.top, height: insets.top + TOP_BAR_HEIGHT }]}>
          <Text style={styles.topBarTitle}>Shadow Twin</Text>
        </View>
        <ActivityIndicator size="large" color={COLORS.violet} style={styles.loader} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={GRADIENTS.background.colors}
      start={GRADIENTS.background.start}
      end={GRADIENTS.background.end}
      style={styles.container}
    >
      {/* Fixed top — Screen title bar: 48px + safe area, glass, centered "Shadow Twin", no back */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top,
            height: insets.top + TOP_BAR_HEIGHT,
          },
        ]}
      >
        <Text style={styles.topBarTitle}>Shadow Twin</Text>
      </View>

      {error && !comparison ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => { setLoading(true); fetchComparison(); }} style={styles.retryButton}>
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentPaddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* (A) Character zone — 280px, significant gap from title bar; chars + pets centered on each side */}
        <View
          style={[
            styles.splitZone,
            { height: CHAR_ZONE_HEIGHT, marginTop: CHAR_ZONE_TOP_GAP },
          ]}
        >
          <View style={[styles.half, styles.halfUser]}>
            <View style={styles.halfInner}>
              <View style={[styles.charPlaceholder, styles.charYou]}>
                <Text style={styles.charLabel}>YOU</Text>
              </View>
              <View style={[styles.petWrap, { marginTop: CHAR_TO_PET_GAP }]}>
                {userPetStage > 0 ? (
                  <View style={styles.petUserDarker}>
                    <PetAnimation stage={userPetStage} isHappy={userPetHappy} size={PET_SIZE} />
                  </View>
                ) : (
                  <View style={[styles.charPlaceholder, styles.petPlaceholder]}>
                    <Text style={styles.charLabel}>—</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Fracture line — centered in the split zone (50% of content width) */}
          <View
            style={[styles.fractureWrap, { height: CHAR_ZONE_HEIGHT }]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={GRADIENTS.fractureLine.colors}
              start={GRADIENTS.fractureLine.start}
              end={GRADIENTS.fractureLine.end}
              style={styles.fractureLine}
            />
          </View>

          <View style={[styles.half, styles.halfTwin]}>
            <View style={styles.halfInner}>
              <View style={[styles.charPlaceholder, styles.charTwin]}>
                <Text style={styles.charLabel}>TWIN</Text>
              </View>
              <View style={[styles.petWrap, { marginTop: CHAR_TO_PET_GAP }]}>
                {twinPetStage > 0 ? (
                  <PetAnimation stage={twinPetStage} isHappy={true} size={PET_SIZE} />
                ) : (
                  <View style={[styles.charPlaceholder, styles.petPlaceholder]}>
                    <Text style={styles.charLabel}>—</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* (B) Stats card — 16px below character zone */}
        <View style={[styles.statsCardWrap, { marginTop: SECTION_GAP }]}>
          <View style={styles.statsCard}>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>STREAK</Text>
              <Text style={styles.statValue}>{userStreak}🔥</Text>
              <Text style={styles.statValueTwin}>{twinStreak}🔥</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>POWER SCORE</Text>
              <Text style={styles.powerUser}>
                {comparison?.user_power_score != null ? formatPowerScore(comparison.user_power_score) : "—"}
              </Text>
              <Text style={styles.powerVs}>vs</Text>
              <Text style={styles.powerTwin}>
                {comparison?.twin_power_score != null ? formatPowerScore(comparison.twin_power_score) : "—"}
              </Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>COMPANION</Text>
              <Text style={styles.petStageUser}>{comparison?.user_pet_stage_name ?? PET_STAGE_NAMES[userPetStage] ?? "—"}</Text>
              <Text style={styles.petStageTwin}>{comparison?.twin_pet_stage_name ?? PET_STAGE_NAMES[twinPetStage] ?? "—"}</Text>
            </View>
          </View>
        </View>

        {/* (C) Gap pill — 16px margin above and below */}
        <View style={[styles.gapPillWrap, { marginVertical: SECTION_GAP }]}>
          <View style={styles.gapPill}>
            <Ionicons name="time-outline" size={14} color={COLORS.violetLine} style={styles.gapIcon} />
            <Text style={styles.gapText}>
              Gap: {gapDays != null ? `${gapDays} Days` : "—"}
            </Text>
          </View>
        </View>

        {/* (C.1) Concrete gap line (1.34): Your Twin has [pet] and [XP] XP. You have [pet] and [XP] XP. */}
        {gapLine ? (
          <View style={styles.gapLineWrap}>
            <Text style={styles.gapLineText}>{gapLine}</Text>
          </View>
        ) : null}

        {/* (D) Twin dialogue card — display only */}
        <View style={styles.dialogueWrap}>
          <View style={styles.dialogueCard}>
            <Text style={styles.dialogueLabel}>Your Twin</Text>
            <Text style={styles.dialogueMessage}>
              {twinMessage ?? "Your rival is you — one week ahead. Show up and close the gap."}
            </Text>
          </View>
        </View>

        {/* Talk to Your Twin — primary entry to Twin Chat (Twin strip on Home goes here too) */}
        <View style={styles.chatButtonWrap}>
          <Pressable
            onPress={openTwinChat}
            style={({ pressed }) => [styles.chatButton, pressed && styles.chatButtonPressed]}
          >
            <LinearGradient
              colors={GRADIENTS.button.colors}
              start={GRADIENTS.button.start}
              end={GRADIENTS.button.end}
              style={styles.chatButtonGradient}
            >
              <Ionicons name="chatbubble-ellipses" size={18} color={COLORS.text} style={styles.chatIcon} />
              <Text style={styles.chatButtonLabel}>Talk to Your Twin</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  loader: {
    marginTop: SPACING.xl,
  },
  errorWrap: {
    padding: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.text2,
    textAlign: "center",
  },
  retryButton: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  retryLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: COLORS.violet,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
  },
  topBar: {
    width: "100%",
    backgroundColor: COLORS.glass,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.glassBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  topBarTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: COLORS.text,
  },
  splitZone: {
    width: "100%",
    flexDirection: "row",
  },
  half: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: SPACING.sm,
    alignItems: "center",
  },
  halfUser: {},
  halfTwin: {},
  halfInner: {
    alignItems: "center",
  },
  charPlaceholder: {
    width: CHAR_WIDTH,
    height: CHAR_HEIGHT,
    borderRadius: RADIUS.card,
    alignItems: "center",
    justifyContent: "center",
  },
  charYou: {
    backgroundColor: COLORS.surface2,
    opacity: 0.9,
  },
  charTwin: {
    backgroundColor: COLORS.surface,
  },
  charLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: COLORS.muted,
  },
  petWrap: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  petUserDarker: {
    opacity: 0.85,
  },
  fractureWrap: {
    position: "absolute",
    width: FRACTURE_WIDTH,
    top: 0,
    left: "50%",
    marginLeft: -FRACTURE_WIDTH / 2,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: COLORS.violetLine,
          shadowOpacity: 0.7,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 0 },
        }
      : { elevation: 12 }),
  },
  fractureLine: {
    width: FRACTURE_WIDTH,
    flex: 1,
  },
  statsCardWrap: {
    width: "100%",
  },
  statsCard: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    padding: SPACING.md,
    justifyContent: "space-between",
  },
  statCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  statLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: COLORS.ember,
  },
  statValueTwin: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: COLORS.ember,
    opacity: 0.5,
    marginTop: 4,
  },
  powerUser: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: COLORS.violet,
  },
  powerVs: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "#4B5563",
    marginTop: 2,
  },
  powerTwin: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 2,
  },
  petStageUser: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
    marginTop: 2,
  },
  petStageTwin: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 4,
  },
  gapPillWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  gapPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(192,132,252,0.1)",
    borderWidth: 1,
    borderColor: COLORS.violetLine,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  gapIcon: {
    marginRight: 6,
  },
  gapText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: COLORS.violetLine,
  },
  gapLineWrap: {
    width: "100%",
    marginBottom: SECTION_GAP,
    paddingHorizontal: SPACING.xs,
  },
  gapLineText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.text2,
    textAlign: "center",
  },
  petPlaceholder: {
    width: PET_SIZE,
    height: PET_SIZE,
  },
  dialogueWrap: {
    width: "100%",
    marginBottom: SECTION_GAP,
  },
  dialogueCard: {
    width: "100%",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surface2,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.violet,
    borderRadius: RADIUS.card,
    padding: SPACING.md,
  },
  dialogueLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: COLORS.violet,
    marginBottom: 4,
  },
  dialogueMessage: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    fontStyle: "italic",
    color: COLORS.text,
  },
  chatButtonWrap: {
    marginTop: SECTION_GAP,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  chatButton: {
    width: CHAT_BUTTON_WIDTH,
    height: CHAT_BUTTON_HEIGHT,
    borderRadius: RADIUS.card,
    overflow: "hidden",
    ...(Platform.OS === "ios" ? SHADOWS.button : { elevation: 8 }),
  },
  chatButtonPressed: {
    opacity: 0.92,
  },
  chatButtonGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
  },
  chatIcon: {
    marginRight: 8,
  },
  chatButtonLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
});
