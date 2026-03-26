/**
 * Rank Card Screen §25. Premium shareable achievement card.
 * Header: back + "Rank Card" + share. Card: gradient, rank badge (hideable), Power Score, character + pet, identity, oracle. Toggle rank, Share, Regenerate.
 */

import React, { useState, useRef, useEffect } from "react";
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
  Share,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { captureRef } from "react-native-view-shot";
import { PetAnimation } from "../components/PetAnimation";
import type { MainStackParamList } from "../navigation/types";
import { useUserStore } from "@/store/userStore";
import { twinService } from "@/services/twin";
import { leaderboardService } from "@/services/leaderboard";

const CARD_MARGIN_H = 24;
const CARD_RADIUS = 22;
const CHAR_W = 130;
const CHAR_H = 185;
const PET_SIZE = 64;
const CTA_HEIGHT = 52;

// Position-based theme (gold/silver/bronze) — matches LeaderboardScreen podium
const GOLD = "#FFD700";
const SILVER = "#C0C0C0";
const BRONZE = "#CD7F32";

type RankPosition = 1 | 2 | 3;
const RANK_CARD_THEME: Record<
  RankPosition | "default",
  {
    gradientColors: readonly [string, string, string];
    borderColor: string;
    glowColor: string;
    fractureColor: string;
    rankBadgeBg: string;
    rankBadgeBorder: string;
    rankBadgeNumColor: string;
    brandColor: string;
    powerScoreColor: string;
    stageBadgeBg: string;
    stageBadgeBorder: string;
    stageBadgeTextColor: string;
    charGlowColor: string;
    charFillBorder: string;
    petCircleBorder: string;
  }
> = {
  1: {
    gradientColors: ["#1A1535", "#151028", "#0C0B1E"],
    borderColor: "rgba(255,215,0,0.32)",
    glowColor: "rgba(255,215,0,0.08)",
    fractureColor: "rgba(255,215,0,0.35)",
    rankBadgeBg: "rgba(255,215,0,0.16)",
    rankBadgeBorder: "rgba(255,215,0,0.38)",
    rankBadgeNumColor: GOLD,
    brandColor: "rgba(255,215,0,0.95)",
    powerScoreColor: GOLD,
    stageBadgeBg: "rgba(255,215,0,0.15)",
    stageBadgeBorder: "rgba(255,215,0,0.28)",
    stageBadgeTextColor: "rgba(255,215,0,0.9)",
    charGlowColor: "rgba(255,215,0,0.12)",
    charFillBorder: "rgba(255,215,0,0.22)",
    petCircleBorder: "rgba(255,215,0,0.38)",
  },
  2: {
    gradientColors: ["#141820", "#10141C", "#0C0E18"],
    borderColor: "rgba(192,192,192,0.22)",
    glowColor: "rgba(192,192,220,0.06)",
    fractureColor: "rgba(200,200,220,0.28)",
    rankBadgeBg: "rgba(200,200,220,0.10)",
    rankBadgeBorder: "rgba(200,200,220,0.25)",
    rankBadgeNumColor: SILVER,
    brandColor: "rgba(200,200,220,0.9)",
    powerScoreColor: "#C0C0DC",
    stageBadgeBg: "rgba(200,200,220,0.10)",
    stageBadgeBorder: "rgba(200,200,220,0.22)",
    stageBadgeTextColor: "#C0C0DC",
    charGlowColor: "rgba(160,160,180,0.10)",
    charFillBorder: "rgba(180,180,200,0.18)",
    petCircleBorder: "rgba(180,180,200,0.28)",
  },
  3: {
    gradientColors: ["#1A1410", "#14100C", "#0E0C0A"],
    borderColor: "rgba(205,127,50,0.28)",
    glowColor: "rgba(180,100,40,0.06)",
    fractureColor: "rgba(200,120,50,0.30)",
    rankBadgeBg: "rgba(180,90,30,0.14)",
    rankBadgeBorder: "rgba(180,90,30,0.28)",
    rankBadgeNumColor: BRONZE,
    brandColor: "rgba(205,127,50,0.9)",
    powerScoreColor: "#CD9060",
    stageBadgeBg: "rgba(180,90,30,0.12)",
    stageBadgeBorder: "rgba(180,90,30,0.25)",
    stageBadgeTextColor: "#CD9060",
    charGlowColor: "rgba(180,90,30,0.08)",
    charFillBorder: "rgba(180,100,40,0.20)",
    petCircleBorder: "rgba(180,100,40,0.30)",
  },
  default: {
    gradientColors: ["#1A1535", "#111028", "#0C0B1E"],
    borderColor: "rgba(139,92,246,0.22)",
    glowColor: "rgba(100,40,200,0.06)",
    fractureColor: "rgba(192,132,252,0.25)",
    rankBadgeBg: "rgba(139,92,246,0.12)",
    rankBadgeBorder: "rgba(139,92,246,0.22)",
    rankBadgeNumColor: "#8B5CF6",
    brandColor: "#A78BFA",
    powerScoreColor: "#8B5CF6",
    stageBadgeBg: "rgba(139,92,246,0.15)",
    stageBadgeBorder: "rgba(139,92,246,0.25)",
    stageBadgeTextColor: "#A78BFA",
    charGlowColor: "rgba(100,40,200,0.20)",
    charFillBorder: "rgba(139,92,246,0.16)",
    petCircleBorder: "rgba(139,92,246,0.38)",
  },
};

export function RankCardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<MainStackParamList, "RankCard">>();
  const { width: screenWidth } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const rankPosition = route.params?.rankPosition;
  const theme = rankPosition
    ? RANK_CARD_THEME[rankPosition]
    : RANK_CARD_THEME.default;

  const profile = useUserStore((s) => s.profile);
  const [globalRank, setGlobalRank] = useState<number | null>(null);

  const [showRank, setShowRank] = useState(true);
  const [oracleLine, setOracleLine] = useState("—");
  const [editingOracle, setEditingOracle] = useState(false);
  const [editOracleVisible, setEditOracleVisible] = useState(false);
  const [editOracleDraft, setEditOracleDraft] = useState(oracleLine);
  const [regenerating, setRegenerating] = useState(false);
  const [sharing, setSharing] = useState(false);

  const fallbackOracle = (p: typeof profile) => {
    if (!p?.username) return "—";
    return `${p.username} — ${p.character_stage_name}. Power ${p.power_score.toLocaleString()} · ${p.current_streak}-day streak.`;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [state, lb] = await Promise.all([
          twinService.getState(),
          leaderboardService.getLeaderboard(),
        ]);
        if (!alive) return;
        const msg = state.rank_card_oracle?.trim();
        if (msg) setOracleLine(msg);
        else setOracleLine(fallbackOracle(profile));
        const r = lb.current_user?.rank;
        setGlobalRank(typeof r === "number" ? r : null);
      } catch {
        if (!alive) return;
        setOracleLine(fallbackOracle(profile));
      }
    })();
    return () => {
      alive = false;
    };
  }, [profile]);

  const cardWidth = screenWidth - CARD_MARGIN_H * 2;

  const openEditOracle = () => {
    setEditOracleDraft(oracleLine);
    setEditOracleVisible(true);
  };
  const saveEditOracle = () => {
    setOracleLine(editOracleDraft.trim() || oracleLine);
    setEditOracleVisible(false);
  };
  const closeEditOracle = () => setEditOracleVisible(false);

  const handleShare = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, {
        format: "png",
        quality: 0.95,
        result: "tmpfile",
      });
      await Share.share({
        url: Platform.OS === "ios" ? uri : `file://${uri}`,
        message: "My ALTER EGO Rank Card",
        title: "Rank Card",
      });
    } catch (e) {
      if ((e as Error).message?.includes("User did not share")) return;
    } finally {
      setSharing(false);
    }
  };

  const handleShareFromHeader = () => {
    handleShare();
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const state = await twinService.getState();
      const msg = state.rank_card_oracle?.trim();
      if (msg) setOracleLine(msg);
      else setOracleLine(fallbackOracle(profile));
    } catch {
      setOracleLine(fallbackOracle(profile));
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#07080F", "#050508"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 10,
            paddingBottom: 14,
            paddingHorizontal: 16,
          },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={22} color="#6B7280" />
        </Pressable>
        <Text style={styles.headerTitle}>Rank Card</Text>
        <Pressable
          onPress={handleShareFromHeader}
          style={styles.headerShareBtn}
          hitSlop={12}
          disabled={sharing}
        >
          {sharing ? (
            <ActivityIndicator size="small" color="#8B5CF6" />
          ) : (
            <Ionicons name="share-outline" size={22} color="#8B5CF6" />
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { flexGrow: 1, paddingTop: 32, paddingBottom: 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Card — capture target, centered in scroll */}
        <View
          ref={cardRef}
          collapsable={false}
          style={[styles.cardOuter, { width: cardWidth }]}
        >
          <LinearGradient
            colors={[...theme.gradientColors]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.2, y: 1 }}
            style={[
              styles.cardGradient,
              { borderRadius: CARD_RADIUS, borderColor: theme.borderColor },
            ]}
          />
          {/* Ambient glow — fixed violet; do not tint by rank (gold/silver/bronze) */}
          <View
            style={[styles.ambientGlow, { backgroundColor: RANK_CARD_THEME.default.glowColor }]}
            pointerEvents="none"
          />
          {/* Corner fracture */}
          <View style={styles.cornerFractureWrap} pointerEvents="none">
            <View
              style={[
                styles.cornerFractureLine,
                { backgroundColor: theme.fractureColor },
              ]}
            />
          </View>

          <View style={styles.cardInner}>
            {/* Top row: app name up first, then power score */}
            <View style={styles.topRow}>
              <Text style={[styles.brandLabel, { color: theme.brandColor }]}>
                ALTER EGO
              </Text>
              <Text
                style={[styles.powerScore, { color: theme.powerScoreColor }]}
              >
                {(profile?.power_score ?? 0).toLocaleString()}
              </Text>
            </View>

            {/* Global rank badge — below ALTER EGO, only when showRank */}
            {showRank && (
              <View
                style={[
                  styles.rankBadge,
                  {
                    backgroundColor: theme.rankBadgeBg,
                    borderColor: theme.rankBadgeBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.rankBadgeHash,
                    { color: theme.rankBadgeNumColor, opacity: 0.8 },
                  ]}
                >
                  #
                </Text>
                <Text
                  style={[styles.rankBadgeNum, { color: theme.rankBadgeNumColor }]}
                >
                  {globalRank != null ? globalRank : "—"}
                </Text>
                <Text style={styles.rankBadgeLabel}>global</Text>
              </View>
            )}

            {/* Art zone: character + pet */}
            <View style={styles.artZone}>
              <View style={styles.charCardWrap}>
                <View
                  style={[
                    styles.charGlow,
                    { backgroundColor: theme.charGlowColor },
                  ]}
                  pointerEvents="none"
                />
                <LinearGradient
                  colors={[
                    "rgba(60,25,130,0.32)",
                    "rgba(10,10,22,0.75)",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={[
                    styles.charFill,
                    { borderColor: theme.charFillBorder },
                  ]}
                />
                <View
                  style={[
                    styles.stageBadge,
                    {
                      backgroundColor: theme.stageBadgeBg,
                      borderColor: theme.stageBadgeBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.stageBadgeText,
                      { color: theme.stageBadgeTextColor },
                    ]}
                  >
                    Stage {profile?.character_stage ?? 1}
                  </Text>
                </View>
              </View>
              <View style={styles.petZone}>
                <View
                  style={[
                    styles.petCircle,
                    { borderColor: theme.petCircleBorder },
                  ]}
                >
                  {profile?.pet_unlocked && (profile.pet_stage ?? 0) > 0 ? (
                    <PetAnimation
                      stage={Math.min(8, Math.max(1, profile.pet_stage))}
                      isHappy
                      size={60}
                    />
                  ) : (
                    <Text style={{ fontSize: 9, color: "#6B7280", textAlign: "center", padding: 8 }}>
                      Pet soon
                    </Text>
                  )}
                </View>
                <Text style={styles.petName}>
                  {profile?.pet_name ?? "—"}
                </Text>
              </View>
            </View>

            {/* Identity row */}
            <View style={styles.identityRow}>
              <View>
                <Text style={styles.username}>
                  {profile?.username ?? "—"}
                </Text>
                <Text style={styles.stageTitle}>
                  {profile?.character_stage_name ?? "—"}
                </Text>
              </View>
              <View style={styles.streakRow}>
                <Ionicons name="flame" size={18} color="#F97316" />
                <Text style={styles.streakNum}>
                  {profile?.current_streak ?? 0}
                </Text>
              </View>
            </View>

            {/* Divider + Oracle */}
            <LinearGradient
              colors={["transparent", "rgba(42,48,80,0.8)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.divider}
            />
            <Pressable onPress={openEditOracle} style={styles.oracleWrap}>
              <Text style={styles.oracleLine} numberOfLines={3}>
                {regenerating ? "Generating..." : oracleLine}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Bottom controls — full width box at bottom */}
      <View
        style={[
          styles.bottomBox,
          {
            paddingBottom: insets.bottom + 16,
            paddingTop: 16,
          },
        ]}
      >
        <Text style={[styles.editHint, styles.bottomBoxPadding]}>Tap oracle line to edit</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Show global rank</Text>
          <View style={styles.switchWrap}>
            <Switch
              value={showRank}
              onValueChange={setShowRank}
              trackColor={{
                false: "#1F2937",
                true: "rgba(139,92,246,0.4)",
              }}
              thumbColor={showRank ? "#8B5CF6" : "#374151"}
              style={styles.switch}
            />
          </View>
        </View>
        <View style={styles.shareBtnWrapContainer}>
        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [
            styles.shareBtnWrap,
            pressed && styles.shareBtnPressed,
          ]}
          disabled={sharing}
        >
          <LinearGradient
            colors={["#5B21B6", "#8B5CF6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.shareBtnGradient}
          >
            {sharing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                <Text style={styles.shareBtnLabel}>Share Rank Card</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
        <Pressable
          onPress={handleRegenerate}
          disabled={regenerating}
          style={styles.regenerateWrap}
        >
          <Text style={styles.regenerateLabel}>
            {regenerating ? "Generating..." : "Regenerate oracle line"}
          </Text>
        </Pressable>
        </View>
      </View>

      {/* Edit Oracle modal */}
      <Modal
        visible={editOracleVisible}
        transparent
        animationType="fade"
        onRequestClose={closeEditOracle}
      >
        <Pressable style={styles.editBackdrop} onPress={closeEditOracle}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.editKeyboard}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={styles.editCard}
            >
              <Text style={styles.editTitle}>Edit Oracle line</Text>
              <TextInput
                style={styles.editInput}
                value={editOracleDraft}
                onChangeText={setEditOracleDraft}
                placeholder="Your custom oracle line..."
                placeholderTextColor="#6B7280"
                multiline
                autoFocus
              />
              <View style={styles.editActions}>
                <Pressable onPress={closeEditOracle} style={styles.editCancel}>
                  <Text style={styles.editCancelText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={saveEditOracle} style={styles.editSave}>
                  <Text style={styles.editSaveText}>Save</Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(7,8,15,0.8)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.4)",
  },
  backBtn: { padding: 4, width: 40, height: 40, justifyContent: "center" },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: "#E5E7EB",
  },
  headerShareBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: CARD_MARGIN_H,
    alignItems: "center",
  },
  bottomBox: {
    width: "100%",
    paddingHorizontal: 16,
    backgroundColor: "rgba(7,8,15,0.85)",
    borderTopWidth: 1,
    borderTopColor: "rgba(42,48,80,0.4)",
    alignItems: "center",
  },
  cardOuter: {
    borderRadius: CARD_RADIUS,
    overflow: "hidden",
    position: "relative",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.7,
          shadowRadius: 60,
          shadowOffset: { width: 0, height: 8 },
        }
      : { elevation: 12 }),
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.22)",
  },
  ambientGlow: {
    position: "absolute",
    top: "-15%",
    left: "50%",
    marginLeft: -140,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(100,40,200,0.06)",
    opacity: 1,
  },
  cornerFractureWrap: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 60,
    height: 60,
    overflow: "hidden",
    borderRadius: 0,
  },
  cornerFractureLine: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 80,
    height: 1,
    backgroundColor: "rgba(192,132,252,0.25)",
    transform: [{ rotate: "-45deg" }],
  },
  cardInner: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
    position: "relative",
  },
  rankBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    backgroundColor: "rgba(139,92,246,0.12)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.22)",
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginBottom: 6,
    marginTop: 0,
    zIndex: 2,
  },
  rankBadgeHash: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(139,92,246,0.6)",
  },
  rankBadgeNum: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#8B5CF6",
    letterSpacing: -0.3,
  },
  rankBadgeLabel: {
    fontSize: 8,
    color: "#4B5563",
    letterSpacing: 0.5,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    zIndex: 1,
  },
  brandLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2.5,
    color: "#A78BFA",
  },
  powerScore: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: "#8B5CF6",
    letterSpacing: -1,
  },
  artZone: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 10,
    marginBottom: 14,
    zIndex: 1,
  },
  charCardWrap: {
    width: CHAR_W,
    height: CHAR_H,
    borderRadius: 14,
    position: "relative",
  },
  charGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    backgroundColor: "rgba(100,40,200,0.20)",
  },
  charFill: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.16)",
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.4,
          shadowRadius: 32,
          shadowOffset: { width: 0, height: 0 },
        }
      : {}),
  },
  stageBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(139,92,246,0.15)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.25)",
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  stageBadgeText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    color: "#A78BFA",
  },
  petZone: {
    flexDirection: "column",
    alignItems: "center",
    gap: 5,
    marginBottom: 10,
  },
  petCircle: {
    width: PET_SIZE,
    height: PET_SIZE,
    borderRadius: PET_SIZE / 2,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(139,92,246,0.38)",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "rgba(109,40,217,0.25)",
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 0 },
        }
      : {}),
    alignItems: "center",
    justifyContent: "center",
  },
  petName: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#6B7280",
    letterSpacing: 0.5,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    zIndex: 1,
  },
  username: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
    letterSpacing: -0.3,
  },
  stageTitle: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 1,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  streakNum: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#F97316",
  },
  divider: {
    height: 1,
    width: "100%",
    marginBottom: 10,
    zIndex: 1,
  },
  oracleWrap: {
    paddingHorizontal: 4,
    zIndex: 1,
  },
  oracleLine: {
    fontSize: 11.5,
    fontStyle: "italic",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
  },
  editHint: {
    textAlign: "center",
    fontSize: 11,
    color: "#374151",
    paddingVertical: 6,
  },
  bottomBoxPadding: { paddingHorizontal: 16 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.3)",
    marginBottom: 8,
  },
  shareBtnWrapContainer: {
    width: "100%",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  toggleLabel: {
    fontSize: 10,
    color: "#6B7280",
  },
  switchWrap: {
    transform: [{ scale: 0.78 }],
  },
  switch: {},
  shareBtnWrap: {
    width: "100%",
    height: CTA_HEIGHT,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 8,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#8B5CF6",
          shadowOpacity: 0.35,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 4 },
        }
      : { elevation: 8 }),
  },
  shareBtnPressed: { opacity: 0.9 },
  shareBtnGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  shareBtnLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  regenerateWrap: {
    alignSelf: "center",
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  regenerateLabel: {
    fontSize: 13,
    color: "#6D28D9",
  },
  editBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 16,
  },
  editKeyboard: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 360,
  },
  editCard: {
    backgroundColor: "#141824",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#2A3050",
    padding: 24,
  },
  editTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#E5E7EB",
    marginBottom: 12,
  },
  editInput: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#E5E7EB",
    minHeight: 80,
    maxHeight: 120,
    padding: 12,
    backgroundColor: "#1E2333",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A3050",
    textAlignVertical: "top",
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 16,
  },
  editCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  editCancelText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#9CA3AF",
  },
  editSave: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#8B5CF6",
    borderRadius: 16,
  },
  editSaveText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#E5E7EB",
  },
});
