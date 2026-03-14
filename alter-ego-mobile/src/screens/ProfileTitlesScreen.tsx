/**
 * Profile → Titles. Current stage hero, 6 stage history rows with escalating
 * colour treatments, tappable achievement card modals for unlocked stages.
 */

import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Platform,
  Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { captureRef } from "react-native-view-shot";

// -----------------------------------------------------------------------------
// TYPES & STAGE COLOUR SYSTEM
// -----------------------------------------------------------------------------

export interface TitleStage {
  stage_number: number;
  title: string;
  reached_day: number | null;
  days_at_stage: number | null;
  is_current: boolean;
  is_locked: boolean;
  xp_to_unlock: number;
  peak_streak_at_stage: number | null;
  xp_earned_at_stage: number | null;
}

export interface TitlesScreenData {
  current_stage: number;
  current_stage_title: string;
  current_xp: number;
  next_stage_title: string;
  next_stage_xp_required: number;
  stages: TitleStage[];
}

const PLACEHOLDER_TITLES: TitlesScreenData = {
  current_stage: 1,
  current_stage_title: "The Awakened",
  current_xp: 3240,
  next_stage_title: "The Focused",
  next_stage_xp_required: 10000,
  stages: [
    {
      stage_number: 1,
      title: "The Awakened",
      reached_day: 1,
      days_at_stage: 45,
      is_current: true,
      is_locked: false,
      xp_to_unlock: 0,
      peak_streak_at_stage: 14,
      xp_earned_at_stage: 3240,
    },
    {
      stage_number: 2,
      title: "The Focused",
      reached_day: null,
      days_at_stage: null,
      is_current: false,
      is_locked: true,
      xp_to_unlock: 10000,
      peak_streak_at_stage: null,
      xp_earned_at_stage: null,
    },
    {
      stage_number: 3,
      title: "The Burning",
      reached_day: null,
      days_at_stage: null,
      is_current: false,
      is_locked: true,
      xp_to_unlock: 50000,
      peak_streak_at_stage: null,
      xp_earned_at_stage: null,
    },
    {
      stage_number: 4,
      title: "The Relentless",
      reached_day: null,
      days_at_stage: null,
      is_current: false,
      is_locked: true,
      xp_to_unlock: 200000,
      peak_streak_at_stage: null,
      xp_earned_at_stage: null,
    },
    {
      stage_number: 5,
      title: "The Formidable",
      reached_day: null,
      days_at_stage: null,
      is_current: false,
      is_locked: true,
      xp_to_unlock: 600000,
      peak_streak_at_stage: null,
      xp_earned_at_stage: null,
    },
    {
      stage_number: 6,
      title: "The Sovereign",
      reached_day: null,
      days_at_stage: null,
      is_current: false,
      is_locked: true,
      xp_to_unlock: 1500000,
      peak_streak_at_stage: null,
      xp_earned_at_stage: null,
    },
  ],
};

type StageNum = 1 | 2 | 3 | 4 | 5 | 6;

const STAGE_CONFIG: Record<
  StageNum,
  {
    leftEdge: [string, string];
    rowBg: string | { colors: string[]; start: { x: number; y: number }; end: { x: number; y: number } };
    rowBorder: string;
    rowShadow?: { shadowColor: string; shadowRadius: number };
    rowAccentLine?: boolean;
    thumbBg: string;
    thumbBorder: string;
    thumbTextOpacity: number;
    nameColor: string;
    sheetBg: { colors: string[]; start: { x: number; y: number }; end: { x: number; y: number } };
    sheetBorder: string;
    sheetShadow?: { shadowColor: string; shadowRadius: number };
    cardBg: { colors: string[]; start: { x: number; y: number }; end: { x: number; y: number } };
    cardBorder: string;
    cardShadow?: { shadowColor: string; shadowRadius: number };
    accent: string;
    accentGlow: string;
  }
> = {
  1: {
    leftEdge: ["#4338CA", "#1E1B4B"],
    rowBg: "#111623",
    rowBorder: "#1A1F30",
    thumbBg: "rgba(67,56,202,0.15)",
    thumbBorder: "rgba(67,56,202,0.25)",
    thumbTextOpacity: 0.45,
    nameColor: "#E5E7EB",
    sheetBg: { colors: ["#0F0E1E", "#0A0A18"], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
    sheetBorder: "rgba(67,56,202,0.25)",
    cardBg: { colors: ["#12112A", "#0C0B1C"], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
    cardBorder: "rgba(67,56,202,0.20)",
    accent: "#4338CA",
    accentGlow: "rgba(67,56,202,0.6)",
  },
  2: {
    leftEdge: ["#8B5CF6", "#5B21B6"],
    rowBg: "rgba(14,12,26,0.9)",
    rowBorder: "rgba(139,92,246,0.20)",
    thumbBg: "rgba(139,92,246,0.15)",
    thumbBorder: "rgba(139,92,246,0.25)",
    thumbTextOpacity: 0.5,
    nameColor: "#E5E7EB",
    sheetBg: { colors: ["#110E22", "#0C0A1A"], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
    sheetBorder: "rgba(139,92,246,0.30)",
    cardBg: { colors: ["#160F2E", "#0E0B22"], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
    cardBorder: "rgba(139,92,246,0.28)",
    accent: "#8B5CF6",
    accentGlow: "rgba(139,92,246,0.6)",
  },
  3: {
    leftEdge: ["#F97316", "#C2410C"],
    rowBg: "rgba(18,12,8,0.9)",
    rowBorder: "rgba(249,115,22,0.18)",
    thumbBg: "rgba(249,115,22,0.15)",
    thumbBorder: "rgba(249,115,22,0.25)",
    thumbTextOpacity: 0.45,
    nameColor: "#E5E7EB",
    sheetBg: { colors: ["#1A0C06", "#100806"], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
    sheetBorder: "rgba(249,115,22,0.25)",
    cardBg: { colors: ["#1E0E04", "#130A04"], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
    cardBorder: "rgba(249,115,22,0.25)",
    accent: "#F97316",
    accentGlow: "rgba(249,115,22,0.6)",
  },
  4: {
    leftEdge: ["#F59E0B", "#92400E"],
    rowBg: "rgba(20,15,5,0.9)",
    rowBorder: "rgba(245,158,11,0.20)",
    thumbBg: "rgba(245,158,11,0.15)",
    thumbBorder: "rgba(245,158,11,0.25)",
    thumbTextOpacity: 0.45,
    nameColor: "#E5E7EB",
    sheetBg: { colors: ["#1C1204", "#120C04"], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
    sheetBorder: "rgba(245,158,11,0.30)",
    sheetShadow: { shadowColor: "rgba(245,158,11,0.08)", shadowRadius: 20 },
    cardBg: { colors: ["#201504", "#150E03"], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
    cardBorder: "rgba(245,158,11,0.32)",
    accent: "#F59E0B",
    accentGlow: "rgba(245,158,11,0.6)",
  },
  5: {
    leftEdge: ["#D946EF", "#86198F"],
    rowBg: "rgba(18,8,20,0.9)",
    rowBorder: "rgba(217,70,239,0.20)",
    thumbBg: "rgba(217,70,239,0.15)",
    thumbBorder: "rgba(217,70,239,0.25)",
    thumbTextOpacity: 0.5,
    nameColor: "#E5E7EB",
    sheetBg: { colors: ["#16081A", "#0E0612"], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
    sheetBorder: "rgba(217,70,239,0.30)",
    cardBg: { colors: ["#1A0820", "#100614"], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
    cardBorder: "rgba(217,70,239,0.30)",
    accent: "#D946EF",
    accentGlow: "rgba(217,70,239,0.6)",
  },
  6: {
    leftEdge: ["#FBBF24", "#F59E0B", "#D97706"],
    rowBg: { colors: ["rgba(30,22,8,0.95)", "rgba(18,14,4,0.98)"], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
    rowBorder: "rgba(245,158,11,0.35)",
    rowShadow: { shadowColor: "rgba(245,158,11,0.06)", shadowRadius: 20 },
    rowAccentLine: true,
    thumbBg: "rgba(251,191,36,0.15)",
    thumbBorder: "rgba(251,191,36,0.30)",
    thumbTextOpacity: 0.5,
    nameColor: "#FBBF24",
    sheetBg: { colors: ["#1E1408", "#120E04"], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
    sheetBorder: "rgba(245,158,11,0.45)",
    sheetShadow: { shadowColor: "rgba(245,158,11,0.12)", shadowRadius: 24 },
    cardBg: { colors: ["#22180A", "#180E04"], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
    cardBorder: "rgba(245,158,11,0.50)",
    cardShadow: { shadowColor: "rgba(245,158,11,0.15)", shadowRadius: 40 },
    accent: "#FBBF24",
    accentGlow: "rgba(251,191,36,0.7)",
  },
};

const USERNAME_PLACEHOLDER = "Alter";

// -----------------------------------------------------------------------------
// HERO XP BAR
// -----------------------------------------------------------------------------

function HeroXPBar({
  currentXP,
  nextStageTitle,
  nextStageXPRequired,
}: {
  currentXP: number;
  nextStageTitle: string;
  nextStageXPRequired: number;
}) {
  const progress = Math.min(1, nextStageXPRequired > 0 ? currentXP / nextStageXPRequired : 0);
  const fillWidthPx = Math.max(0, 240 * progress);
  return (
    <View style={styles.xpBarWrap}>
      <View style={styles.xpBarLabelRow}>
        <Text style={styles.xpBarLabelLeft}>✦ {currentXP.toLocaleString()} XP</Text>
        <Text style={styles.xpBarLabelRight}>→ {nextStageTitle}</Text>
      </View>
      <View style={styles.xpBarTrack}>
        <View style={[styles.xpBarFillWrap, { width: fillWidthPx }]}>
          <LinearGradient
            colors={["#5B21B6", "#8B5CF6", "#C084FC"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.xpBarFill}
          />
          {progress > 0.02 && <View style={styles.xpBarGlowDot} />}
        </View>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// STAGE ROW
// -----------------------------------------------------------------------------

function StageRow({
  stage,
  onPress,
}: {
  stage: TitleStage;
  onPress: () => void;
}) {
  const num = stage.stage_number as StageNum;
  const config = STAGE_CONFIG[num];
  const isLocked = stage.is_locked;
  const isSix = num === 6;

  const leftEdgeColors = config.leftEdge.length === 3
    ? (config.leftEdge as [string, string, string])
    : ([config.leftEdge[0], config.leftEdge[1]] as [string, string]);

  const rowStyle: any[] = [
    styles.stageRowBase,
    typeof config.rowBg === "string"
      ? { backgroundColor: config.rowBg }
      : {},
    { borderColor: config.rowBorder },
  ];
  if (config.rowShadow) rowStyle.push(config.rowShadow);
  if (isLocked) rowStyle.push(styles.stageRowLocked);

  return (
    <Pressable
      onPress={isLocked ? undefined : onPress}
      style={({ pressed }) => [...rowStyle, !isLocked && pressed && styles.stageRowPressed]}
      disabled={isLocked}
    >
      {isSix && config.rowAccentLine && (
        <LinearGradient
          colors={["transparent", "rgba(251,191,36,0.45)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.stageRowAccentLine}
        />
      )}
      {typeof config.rowBg === "object" && "colors" in config.rowBg && (
        <LinearGradient
          colors={config.rowBg.colors}
          start={config.rowBg.start}
          end={config.rowBg.end}
          style={StyleSheet.absoluteFill}
        />
      )}
      <LinearGradient
        colors={leftEdgeColors}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.stageRowLeftEdge}
      />
      <View style={[styles.stageThumb, { backgroundColor: config.thumbBg, borderColor: config.thumbBorder }]}>
        <Text style={[styles.stageThumbText, { color: config.accent, opacity: config.thumbTextOpacity }]}>
          S{num}
        </Text>
      </View>
      <View style={styles.stageInfo}>
        <Text style={[styles.stageName, { color: config.nameColor }]} numberOfLines={1}>
          {stage.title}
        </Text>
        <Text style={styles.stageSub}>
          {isLocked
            ? "Locked"
            : `Reached Day ${stage.reached_day} · ${stage.days_at_stage} days at stage`}
        </Text>
      </View>
      {isLocked ? (
        <Ionicons name="lock-closed-outline" size={14} color="#1F2937" />
      ) : (
        <Ionicons name="chevron-forward" size={14} color="#2D3146" />
      )}
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// ACHIEVEMENT CARD MODAL
// -----------------------------------------------------------------------------

function AchievementCardModal({
  visible,
  stage,
  onClose,
  username,
}: {
  visible: boolean;
  stage: TitleStage;
  onClose: () => void;
  username: string;
}) {
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const num = stage.stage_number as StageNum;
  const config = STAGE_CONFIG[num];
  const isSix = num === 6;

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
        message: `My ALTER EGO title: ${stage.title}`,
        title: "Title",
      });
    } catch (e) {
      if ((e as Error).message?.includes("User did not share")) return;
    } finally {
      setSharing(false);
    }
  };

  const xpLabel = stage.is_current ? "XP earned" : "XP to unlock";
  const xpValue = stage.is_current
    ? (stage.xp_earned_at_stage ?? 0).toLocaleString()
    : stage.xp_to_unlock.toLocaleString();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modalSheet, config.sheetShadow]}>
              <LinearGradient
                colors={config.sheetBg.colors}
                start={config.sheetBg.start}
                end={config.sheetBg.end}
                style={[StyleSheet.absoluteFill, { borderRadius: 24, overflow: "hidden" }]}
              />
              <View style={[styles.modalSheetBorder, { borderColor: config.sheetBorder }]} />
              <View style={styles.modalDragHandle} />
              <View style={styles.modalContent}>
                <View ref={cardRef} collapsable={false} style={[styles.shareCard, config.cardShadow]}>
                  <LinearGradient
                    colors={config.cardBg.colors}
                    start={config.cardBg.start}
                    end={config.cardBg.end}
                    style={[StyleSheet.absoluteFill, { borderRadius: 18, overflow: "hidden" }]}
                  />
                  <View style={[styles.shareCardBorder, { borderColor: config.cardBorder }]} />
                  <LinearGradient
                    colors={["transparent", config.accentGlow, "transparent"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.shareCardAccent}
                  />
                  <Text style={[styles.shareCardBrand, { color: config.accent }]}>ALTER EGO</Text>
                  <View style={styles.shareCardBody}>
                    <View style={[styles.shareCardChar, { backgroundColor: config.thumbBg, borderColor: config.cardBorder }]} />
                    <View style={styles.shareCardMeta}>
                      <Text style={[styles.shareCardStageNum, { color: config.accent }]}>STAGE {num}</Text>
                      <Text style={[styles.shareCardTitle, isSix && { color: "#FBBF24" }]}>{stage.title}</Text>
                      <Text style={styles.shareCardUsername}>{username}</Text>
                      <Text style={styles.shareCardReached}>
                        Reached Day {stage.reached_day ?? "—"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.shareCardStats}>
                    <View style={styles.shareCardStatCol}>
                      <Text style={[styles.shareCardStatValue, { color: config.accent }]}>
                        {stage.days_at_stage ?? "—"}
                      </Text>
                      <Text style={styles.shareCardStatLabel}>Days at stage</Text>
                    </View>
                    <View style={[styles.shareCardStatDivider]} />
                    <View style={styles.shareCardStatCol}>
                      <Text style={[styles.shareCardStatValue, { color: "#F97316" }]}>
                        {stage.peak_streak_at_stage != null ? `${stage.peak_streak_at_stage}🔥` : "—"}
                      </Text>
                      <Text style={styles.shareCardStatLabel}>Peak streak</Text>
                    </View>
                    <View style={styles.shareCardStatDivider} />
                    <View style={styles.shareCardStatCol}>
                      <Text style={[styles.shareCardStatValue, { color: config.accent }]}>{xpValue}</Text>
                      <Text style={styles.shareCardStatLabel}>{xpLabel}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.modalActions}>
                  <Pressable
                    onPress={handleShare}
                    disabled={sharing}
                    style={[styles.shareBtn, isSix && styles.shareBtnGold]}
                  >
                    <LinearGradient
                      colors={config.leftEdge as string[]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.shareBtnGrad}
                    >
                      <Text style={styles.shareBtnLabel}>↗ Share Title</Text>
                    </LinearGradient>
                  </Pressable>
                  <Pressable onPress={onClose} style={styles.closeBtn}>
                    <Ionicons name="close" size={16} color="#6B7280" />
                  </Pressable>
                </View>
              </View>
            </View>
      </View>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// SCREEN
// -----------------------------------------------------------------------------

export function ProfileTitlesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [data] = useState<TitlesScreenData>(PLACEHOLDER_TITLES);
  const [modalStage, setModalStage] = useState<TitleStage | null>(null);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#09091A", "#07080F"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + 10, paddingBottom: 14 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#6B7280" />
        </Pressable>
        <Text style={styles.headerTitle}>Titles</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero zone */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>CURRENT TITLE</Text>
          <View style={styles.characterPlaceholder}>
            <LinearGradient
              colors={["rgba(60,25,130,0.32)", "rgba(10,10,22,0.75)"]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={["transparent", "rgba(167,139,250,0.4)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.characterRim}
            />
          </View>
          <Text style={styles.heroStageName}>{data.current_stage_title}</Text>
          <HeroXPBar
            currentXP={data.current_xp}
            nextStageTitle={data.next_stage_title}
            nextStageXPRequired={data.next_stage_xp_required}
          />
        </View>

        <Text style={styles.sectionLabel}>STAGE HISTORY</Text>

        {data.stages.map((stage) => (
          <StageRow
            key={stage.stage_number}
            stage={stage}
            onPress={() => setModalStage(stage)}
          />
        ))}
      </ScrollView>

      {modalStage && (
        <AchievementCardModal
          visible={!!modalStage}
          stage={modalStage}
          onClose={() => setModalStage(null)}
          username={USERNAME_PLACEHOLDER}
        />
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// STYLES
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "rgba(9,9,26,0.85)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.35)",
    gap: 12,
  },
  backBtn: {},
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 0, paddingTop: 0 },
  hero: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    position: "relative",
  },
  heroLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(139,92,246,0.5)",
    marginBottom: 12,
    zIndex: 1,
  },
  characterPlaceholder: {
    width: 90,
    height: 136,
    borderRadius: 14,
    zIndex: 1,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.18)",
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(80,20,160,0.18)", shadowRadius: 32, shadowOffset: { width: 0, height: 0 } }
      : { elevation: 10 }),
  },
  characterRim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  heroStageName: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 12,
    zIndex: 1,
  },
  xpBarWrap: {
    width: 240,
    zIndex: 1,
  },
  xpBarLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  xpBarLabelLeft: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#A78BFA",
  },
  xpBarLabelRight: {
    fontSize: 10,
    color: "#4B5563",
  },
  xpBarTrack: {
    height: 5,
    borderRadius: 5,
    backgroundColor: "rgba(20,24,36,1)",
    overflow: "visible",
  },
  xpBarFillWrap: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 5,
    overflow: "visible",
  },
  xpBarFill: {
    flex: 1,
    height: 5,
    borderRadius: 5,
    minWidth: 0,
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(139,92,246,0.5)", shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }
      : { elevation: 6 }),
  },
  xpBarGlowDot: {
    position: "absolute",
    right: -4.5,
    top: -2,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#C084FC",
    borderWidth: 1.5,
    borderColor: "#09091A",
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(192,132,252,0.52)", shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }
      : { elevation: 6 }),
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#374151",
    paddingHorizontal: 16,
    marginBottom: 8,
    marginTop: 4,
  },
  stageRowBase: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 13,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
  },
  stageRowLocked: {
    opacity: 0.28,
  },
  stageRowPressed: {
    transform: [{ scale: 0.98 }],
  },
  stageRowAccentLine: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 1,
  },
  stageRowLeftEdge: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  stageThumb: {
    width: 40,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stageThumbText: {
    fontSize: 7,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  stageInfo: { flex: 1, minWidth: 0 },
  stageName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  stageSub: {
    fontSize: 11,
    color: "#4B5563",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  modalSheet: {
    width: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 32,
    position: "relative",
    overflow: "hidden",
  },
  modalSheetBorder: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    pointerEvents: "none",
  },
  modalDragHandle: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalContent: {},
  shareCard: {
    borderRadius: 18,
    padding: 20,
    paddingHorizontal: 18,
    paddingBottom: 16,
    marginBottom: 14,
    position: "relative",
    overflow: "hidden",
  },
  shareCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1,
    pointerEvents: "none",
  },
  shareCardAccent: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 1,
  },
  shareCardBrand: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 14,
    opacity: 0.6,
  },
  shareCardBody: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 14,
    marginBottom: 14,
  },
  shareCardChar: {
    width: 70,
    height: 105,
    borderRadius: 12,
    borderWidth: 1,
  },
  shareCardMeta: { flex: 1 },
  shareCardStageNum: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 4,
    opacity: 0.6,
  },
  shareCardTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
    marginBottom: 4,
  },
  shareCardUsername: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#6B7280",
    marginBottom: 2,
  },
  shareCardReached: {
    fontSize: 11,
    color: "#4B5563",
  },
  shareCardStats: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    paddingTop: 12,
  },
  shareCardStatCol: { flex: 1, alignItems: "center" },
  shareCardStatDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  shareCardStatValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  shareCardStatLabel: {
    fontSize: 10,
    color: "#4B5563",
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  shareBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    overflow: "hidden",
  },
  shareBtnGold: {
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(245,158,11,0.35)", shadowRadius: 16, shadowOffset: { width: 0, height: 0 } }
      : { elevation: 10 }),
  },
  shareBtnGrad: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtnLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
});
