/**
 * Rank Card Screen §25. Shareable achievement card.
 * Header: back + share. Card 358×480: gradient, ALTER EGO + Power Score, character + pet, username/stage/streak, Oracle line. Share + Regenerate Oracle.
 */

import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { PetAnimation } from "../components/PetAnimation";
import {
  COLORS,
  SPACING,
  GRADIENTS,
  RADIUS,
  SHADOWS,
} from "../constants/theme";

const CARD_WIDTH = 358;
const CARD_HEIGHT = 520;
const CARD_RADIUS = 24;
const CARD_PADDING = 24;
const CHAR_W = 160;
const CHAR_H = 220;
const PET_SIZE = 56;
const GLOW_RADIUS = 120;
const CTA_HEIGHT = 56;
const BOTTOM_BAR_PADDING = 16;

const PLACEHOLDER_USERNAME = "Alter";
const PLACEHOLDER_STAGE = "The Focused";
const PLACEHOLDER_POWER_SCORE = "847";
const PLACEHOLDER_STREAK = 12;
const PLACEHOLDER_ORACLE =
  "Seven days of silence, then four of fire. This is what the pattern looks like when you decide.";

export function RankCardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();
  const [regenerating, setRegenerating] = useState(false);
  const [oracleLine, setOracleLine] = useState(PLACEHOLDER_ORACLE);
  const [editOracleVisible, setEditOracleVisible] = useState(false);
  const [editOracleDraft, setEditOracleDraft] = useState(oracleLine);
  const cardRef = useRef<View>(null);

  const openEditOracle = () => {
    setEditOracleDraft(oracleLine);
    setEditOracleVisible(true);
  };
  const saveEditOracle = () => {
    setOracleLine(editOracleDraft.trim() || oracleLine);
    setEditOracleVisible(false);
  };
  const closeEditOracle = () => setEditOracleVisible(false);

  const handleShare = () => {
    console.log("[RankCard] Share Rank Card — view-shot + share sheet (Phase 2)");
  };

  const handleRegenerate = () => {
    setRegenerating(true);
    console.log("[RankCard] Regenerate Oracle line — backend (Phase 2)");
    setTimeout(() => setRegenerating(false), 1500);
  };

  const cardWidth = Math.min(CARD_WIDTH, screenWidth - SPACING.screenPadding * 2);
  const cardHeight = CARD_HEIGHT;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={GRADIENTS.background.colors}
        start={GRADIENTS.background.start}
        end={GRADIENTS.background.end}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Rank Card</Text>
        <Pressable onPress={handleShare} style={styles.shareBtn} hitSlop={12}>
          <Ionicons name="share-outline" size={24} color={COLORS.violet} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom:
              insets.bottom +
              BOTTOM_BAR_PADDING * 2 +
              CTA_HEIGHT +
              12 +
              44,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Main card — more space for Oracle line */}
        <View
          ref={cardRef}
          style={[
            styles.cardWrap,
            {
              width: cardWidth,
              height: cardHeight,
              borderRadius: CARD_RADIUS,
            },
          ]}
          collapsable={false}
        >
          <LinearGradient
            colors={GRADIENTS.rankCard.colors}
            start={GRADIENTS.rankCard.start}
            end={GRADIENTS.rankCard.end}
            style={[StyleSheet.absoluteFill, { borderRadius: CARD_RADIUS }]}
          />
          <View
            style={[
              styles.radialGlow,
              {
                width: GLOW_RADIUS * 2,
                height: GLOW_RADIUS * 2,
                left: cardWidth / 2 - GLOW_RADIUS,
                top: cardHeight / 2 - GLOW_RADIUS,
              },
            ]}
          />
          {/* Corner fracture line */}
          <View style={[styles.fractureLine, { width: cardWidth * 0.5 }]} />
          {/* Top section */}
          <View style={[styles.cardTop, { padding: CARD_PADDING }]}>
            <Text style={styles.alterEgoLabel}>ALTER EGO</Text>
            <Text style={styles.powerScore}>{PLACEHOLDER_POWER_SCORE}</Text>
          </View>
          {/* Character zone */}
          <View style={styles.characterZone}>
            <View style={[styles.charPlaceholder, { width: CHAR_W, height: CHAR_H }]} />
            <View
              style={[
                styles.petOverlap,
                {
                  right: (cardWidth - CHAR_W) / 2 + CHAR_W - PET_SIZE,
                },
              ]}
            >
              <PetAnimation stage={2} isHappy size={PET_SIZE} />
            </View>
          </View>
          {/* Bottom section — Oracle line has more room */}
          <View style={[styles.cardBottom, { padding: CARD_PADDING }]}>
            <Text style={styles.username}>{PLACEHOLDER_USERNAME}</Text>
            <Text style={styles.stageTitle}>{PLACEHOLDER_STAGE}</Text>
            <View style={styles.streakRow}>
              <Text style={styles.streakText}>🔥 {PLACEHOLDER_STREAK}</Text>
            </View>
            <View style={styles.divider} />
            <Pressable onPress={openEditOracle} style={styles.oracleLineWrap}>
              <Text style={styles.oracleLine}>{oracleLine}</Text>
            </Pressable>
          </View>
        </View>

        {/* Tap to edit hint — between card and Share button */}
        <Pressable onPress={openEditOracle} style={styles.editOracleHint}>
          <Text style={styles.editOracleHintText}>Tap to edit the oracle line</Text>
        </Pressable>
      </ScrollView>

      {/* Edit Oracle modal */}
      <Modal
        visible={editOracleVisible}
        transparent
        animationType="fade"
        onRequestClose={closeEditOracle}
      >
        <Pressable style={styles.editOracleBackdrop} onPress={closeEditOracle}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.editOracleKeyboard}
          >
            <Pressable onPress={(e) => e.stopPropagation()} style={styles.editOracleCard}>
              <Text style={styles.editOracleTitle}>Edit Oracle line</Text>
              <TextInput
                style={styles.editOracleInput}
                value={editOracleDraft}
                onChangeText={setEditOracleDraft}
                placeholder="Your custom oracle line..."
                placeholderTextColor={COLORS.muted}
                multiline
                autoFocus
              />
              <View style={styles.editOracleActions}>
                <Pressable onPress={closeEditOracle} style={styles.editOracleCancel}>
                  <Text style={styles.editOracleCancelText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={saveEditOracle} style={styles.editOracleSave}>
                  <Text style={styles.editOracleSaveText}>Save</Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Bottom bar: Share + Regenerate Oracle */}
      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: insets.bottom + BOTTOM_BAR_PADDING,
            paddingTop: BOTTOM_BAR_PADDING,
          },
        ]}
      >
        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [
            styles.ctaWrap,
            styles.ctaWrapInBar,
            pressed && styles.ctaPressed,
          ]}
        >
          <LinearGradient
            colors={GRADIENTS.button.colors}
            start={GRADIENTS.button.start}
            end={GRADIENTS.button.end}
            style={[styles.ctaBtn, SHADOWS.button]}
          >
            <Ionicons name="share-outline" size={18} color={COLORS.text} />
            <Text style={styles.ctaLabel}>Share Rank Card</Text>
          </LinearGradient>
        </Pressable>
        <Pressable
          onPress={handleRegenerate}
          disabled={regenerating}
          style={({ pressed }) => [
            styles.regenerateWrap,
            pressed && !regenerating && styles.regeneratePressed,
          ]}
        >
          {regenerating ? (
            <>
              <ActivityIndicator size="small" color={COLORS.violet} />
              <Text style={styles.regenerateLabel}>Generating...</Text>
            </>
          ) : (
            <Text style={styles.regenerateLabel}>Regenerate Oracle line</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: 12,
    backgroundColor: COLORS.glass,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.glassBorder,
  },
  backBtn: { padding: 4 },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: COLORS.text,
  },
  shareBtn: { padding: 4 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: SPACING.lg,
    alignItems: "center",
  },
  bottomBar: {
    paddingHorizontal: SPACING.screenPadding,
    backgroundColor: COLORS.glass,
    borderTopWidth: 1,
    borderTopColor: COLORS.glassBorder,
  },
  cardWrap: {
    overflow: "hidden",
    alignSelf: "center",
    position: "relative",
  },
  radialGlow: {
    position: "absolute",
    borderRadius: GLOW_RADIUS,
    backgroundColor: "rgba(139,92,246,0.12)",
  },
  fractureLine: {
    position: "absolute",
    top: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.violetLine,
    opacity: 0.3,
    transform: [{ rotate: "-45deg" }, { translateX: 30 }, { translateY: -10 }],
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  alterEgoLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: COLORS.violetGlow,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  powerScore: {
    fontFamily: "Inter_700Bold",
    fontSize: 36,
    color: COLORS.violet,
  },
  characterZone: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    minHeight: CHAR_H + 24,
  },
  charPlaceholder: {
    backgroundColor: COLORS.surface2,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  petOverlap: {
    position: "absolute",
    bottom: 8,
  },
  cardBottom: {},
  username: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: COLORS.text,
  },
  stageTitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.text2,
    marginTop: 2,
  },
  streakRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  streakText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: COLORS.text,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  oracleLineWrap: {
    paddingVertical: 4,
  },
  oracleLine: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.text2,
    fontStyle: "italic",
    textAlign: "center",
  },
  editOracleHint: {
    alignSelf: "center",
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  editOracleHintText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.muted,
  },
  editOracleBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: SPACING.md,
  },
  editOracleKeyboard: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 360,
  },
  editOracleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.modal,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
  },
  editOracleTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 12,
  },
  editOracleInput: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.text,
    minHeight: 80,
    maxHeight: 120,
    padding: 12,
    backgroundColor: COLORS.surface2,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlignVertical: "top",
  },
  editOracleActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 16,
  },
  editOracleCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  editOracleCancelText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: COLORS.text2,
  },
  editOracleSave: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: COLORS.violet,
    borderRadius: RADIUS.card,
  },
  editOracleSaveText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: COLORS.text,
  },
  ctaWrap: {
    width: "100%",
    marginTop: 16,
  },
  ctaWrapInBar: { marginTop: 0 },
  ctaPressed: { opacity: 0.9 },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: CTA_HEIGHT,
    borderRadius: RADIUS.card,
    gap: 8,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#8B5CF6",
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        }
      : { elevation: 8 }),
  },
  ctaLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
  regenerateWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
  },
  regeneratePressed: { opacity: 0.7 },
  regenerateLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.violet,
  },
});
