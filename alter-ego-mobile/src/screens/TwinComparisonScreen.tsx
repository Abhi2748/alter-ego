/**
 * Twin Comparison Screen — Redesign. Tab 3.
 * Header + Arena (230) + Stats row + Gap description + Twin dialogue + Twin's Day timeline + Chat FAB.
 */

import React, { useState, useMemo } from "react";
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
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTwinState, useTwinStrip } from "@/hooks/useTwin";
import type { TwinActivity, TwinComparisonOut } from "../utils/api";
import { TwinComparisonShareCard } from "../components/TwinComparisonShareCard";
import { SkeletonBlock } from "@/components/SkeletonBlock";
import { useUserStore } from "@/store/userStore";

const ARENA_HEIGHT = 230;
const CHAR_CARD_W = 96;
const CHAR_CARD_H = 140;
const PET_CIRCLE = 30;
const STATS_ROW_HEIGHT = 56;
const CHAT_FAB_BOTTOM = 8;
const CHAT_FAB_RIGHT = 16;
const CHAT_FAB_SIZE = 56;

/** When strip_message is still empty (legacy rows), keep the screen from feeling broken. */
const DEFAULT_TWIN_DIALOGUE =
  "Your rival is you — one week ahead. Same starting line. Different choices. Show up and the gap tells the truth.";

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function TwinComparisonScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [shareVisible, setShareVisible] = useState(false);

  const {
    data: twinData,
    isLoading: loading,
    error,
    refetch,
  } = useTwinState();

  const { data: stripData } = useTwinStrip();
  const profile = useUserStore((s) => s.profile);

  const comparison: TwinComparisonOut | null = useMemo(() => {
    if (!twinData) return null;

    const user = twinData.user;
    const twin = twinData.twin;
    const gap = twinData.gap;

    const inferredGapDays = gap.user_is_ahead ? -Math.abs(gap.days_user_ahead) : gap.days_user_ahead;

    const timeline = twinData.twin_timeline ?? [];
    const activities: TwinActivity[] = timeline.map((row) => {
      const d = String(row.difficulty ?? "medium").toLowerCase();
      const difficulty: TwinActivity["difficulty"] =
        d === "easy" ? "Easy" : d === "hard" || d === "elite" ? "Hard" : "Medium";
      const mt = String(row.mission_type ?? "core").toLowerCase();
      const mission_type: TwinActivity["mission_type"] =
        mt === "interest" ? "focus" : mt === "personal" ? "personal" : "core";
      return {
        mission_title: row.mission_title,
        mission_type,
        difficulty,
        xp_earned: row.xp_earned,
        completed_at: row.completed_at,
      };
    });

    const stripMessage =
      twinData.strip_message?.trim() ||
      stripData?.strip_message?.trim() ||
      null;

    return {
      user_xp: user.total_xp,
      user_pet_stage: user.pet_stage,
      user_pet_stage_name: user.pet_name ?? "",
      user_streak: user.current_streak,
      user_power_score: user.power_score,

      twin_xp: twin.twin_xp,
      twin_pet_stage: twin.pet_stage,
      twin_pet_stage_name: twin.pet_name ?? "",
      twin_streak: twin.streak,
      twin_power_score: twin.power_score,

      current_gap_state: twin.gap_state,
      gap_line: "",
      strip_message: stripMessage,
      gap_days: inferredGapDays,
      username: user.username,
      twin_today_activities: activities,
    };
  }, [stripData?.strip_message, twinData, profile?.current_streak, profile?.power_score]);

  const openTwinChat = () => {
    (navigation as any).navigate("TwinChat");
  };

  const activities: TwinActivity[] = comparison?.twin_today_activities ?? [];
  const completedCount =
    twinData?.twin.missions_completed_today ??
    activities.filter((a) => a.completed_at != null).length;
  const totalXp =
    twinData?.twin.xp_earned_today ?? activities.reduce((s, a) => s + a.xp_earned, 0);
  const gapDays = comparison?.gap_days ?? null;
  const gapLabel = gapDays != null ? `${gapDays} Day${Math.abs(gapDays) !== 1 ? "s" : ""}` : "—";

  if (loading && !comparison) {
    return (
      <LinearGradient
        colors={["#09091A", "#06070E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.container, styles.centered]}
      >
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + 10, paddingBottom: 14, paddingHorizontal: 16 },
          ]}
        >
          <View
            style={[
              styles.headerTitleWrap,
              { top: insets.top + 10, bottom: 14 },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.headerTitle}>Shadow Twin</Text>
          </View>
          <View style={styles.shareBtn} />
        </View>

        {/* Skeleton layout — approximate comparison screen */}
        <View style={{ flex: 1, width: "100%" }}>
          {/* Top bar area — approximate */}
          <View
            style={{
              height: 56,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <SkeletonBlock width={80} height={14} />
            <SkeletonBlock width={60} height={14} />
          </View>

          {/* Character zone — two columns */}
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 32,
              paddingHorizontal: 24,
            }}
          >
            {/* User side */}
            <View style={{ alignItems: "center", gap: 12, flex: 1 }}>
              <SkeletonBlock width={80} height={120} borderRadius={12} />
              <SkeletonBlock width={70} height={12} delay={100} />
              <SkeletonBlock width={50} height={10} delay={150} />
              <SkeletonBlock width={60} height={14} borderRadius={10} delay={200} />
            </View>

            {/* Center fracture line — keep it simple */}
            <View
              style={{
                width: 2,
                height: 120,
                backgroundColor: "#1E2333",
                opacity: 0.5,
              }}
            />

            {/* Twin side */}
            <View style={{ alignItems: "center", gap: 12, flex: 1 }}>
              <SkeletonBlock width={80} height={120} borderRadius={12} delay={50} />
              <SkeletonBlock width={70} height={12} delay={150} />
              <SkeletonBlock width={50} height={10} delay={200} />
              <SkeletonBlock width={60} height={14} borderRadius={10} delay={250} />
            </View>
          </View>

          {/* Stats row */}
          <View style={{ paddingHorizontal: 24, gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <SkeletonBlock width={80} height={12} delay={100} />
              <SkeletonBlock width={80} height={12} delay={150} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <SkeletonBlock width={64} height={12} delay={200} />
              <SkeletonBlock width={64} height={12} delay={250} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <SkeletonBlock width={72} height={12} delay={300} />
              <SkeletonBlock width={72} height={12} delay={350} />
            </View>
          </View>

          {/* Gap indicator area */}
          <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
            <SkeletonBlock width="100%" height={48} borderRadius={12} delay={200} />
          </View>

          {/* Chat button area */}
          <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
            <SkeletonBlock width="100%" height={56} borderRadius={16} delay={300} />
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#09091A", "#06070E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Header — title absolutely centred over full header; share button right */}
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
        <View
          style={[
            styles.headerTitleWrap,
            { top: insets.top + 10, bottom: 14 },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.headerTitle}>Shadow Twin</Text>
        </View>
        <Pressable
          onPress={() => setShareVisible(true)}
          style={styles.shareBtn}
          hitSlop={12}
          accessibilityLabel="Share comparison"
        >
          <Ionicons name="share-outline" size={18} color="#8B5CF6" />
        </Pressable>
      </View>

      {error && !comparison ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : "Could not load comparison"}
          </Text>
          <Pressable
            onPress={() => {
              refetch();
            }}
            style={styles.retryButton}
          >
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: CHAT_FAB_BOTTOM + CHAT_FAB_SIZE + insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Arena zone — 230px */}
        <View style={[styles.arena, { height: ARENA_HEIGHT }]}>
          {/* Atmosphere glows */}
          <View style={styles.glowLeft} pointerEvents="none" />
          <View style={styles.glowRight} pointerEvents="none" />

          {/* User side */}
          <View style={[styles.arenaHalf, styles.arenaUser]}>
            <Text style={[styles.arenaLabel, styles.arenaLabelYou]}>YOU</Text>
            <View style={styles.charCardWrap}>
              <LinearGradient
                colors={["rgba(40,20,80,0.4)", "rgba(8,8,18,0.85)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={[styles.charCard, styles.charCardUser]}
              />
              <View style={[styles.petCircle, styles.petCircleUser]}>
                <LinearGradient
                  colors={["#E8E8ED", "#FFFFFF"]}
                  style={styles.petCircleInner}
                />
              </View>
            </View>
            <Text style={styles.charNameUser}>
              {comparison?.username ?? "You"}
            </Text>
            <Text style={styles.charStageUser}>
              {twinData?.user.character_stage_name ?? "—"}
            </Text>
          </View>

          {/* Fracture line with gap pill in the middle — line behind pill so it doesn't show on text */}
          <View style={styles.fractureWrap} pointerEvents="none">
            <LinearGradient
              colors={[
                "transparent",
                "rgba(192,132,252,0.8)",
                "rgba(220,180,255,1)",
                "rgba(192,132,252,0.8)",
                "transparent",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.fractureLine}
            />
            <View style={styles.gapPill} pointerEvents="none">
              <Ionicons name="time-outline" size={11} color="#C084FC" />
              <Text style={styles.gapPillText}>{gapLabel}</Text>
            </View>
          </View>

          {/* Twin side */}
          <View style={[styles.arenaHalf, styles.arenaTwin]}>
            <Text style={[styles.arenaLabel, styles.arenaLabelTwin]}>TWIN</Text>
            <View style={styles.charCardWrap}>
              <LinearGradient
                colors={["rgba(80,30,160,0.5)", "rgba(10,8,25,0.88)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={[styles.charCard, styles.charCardTwin]}
              />
              <View style={[styles.petCircle, styles.petCircleTwin]}>
                <LinearGradient
                  colors={["rgba(100,40,200,0.8)", "rgba(25,15,50,0.95)"]}
                  style={styles.petCircleInner}
                />
              </View>
            </View>
            <Text style={styles.charNameTwin}>Twin</Text>
            <Text style={styles.charStageTwin}>
              {twinData?.twin.character_stage_name ?? "—"}
            </Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={styles.statValueUser}>{comparison?.user_streak ?? 0}</Text>
            <Text style={styles.statValueTwin}>{comparison?.twin_streak ?? 0}</Text>
            <Text style={styles.statLabel}>STREAK</Text>
          </View>
          <View style={[styles.statCol, styles.statColCenter]}>
            <Text style={styles.statPowerUser}>
              {comparison?.user_power_score != null
                ? Math.round(comparison.user_power_score).toLocaleString()
                : "—"}
            </Text>
            <Text style={styles.statValueTwin}>
              {comparison?.twin_power_score != null
                ? Math.round(comparison.twin_power_score).toLocaleString()
                : "—"}
            </Text>
            <Text style={styles.statLabel}>POWER SCORE</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={styles.statCompanionUser}>{comparison?.user_pet_stage_name ?? "—"}</Text>
            <Text style={styles.statCompanionTwin}>{comparison?.twin_pet_stage_name ?? "—"}</Text>
            <Text style={styles.statLabel}>COMPANION</Text>
          </View>
        </View>

        {/* Gap description */}
        <Text style={styles.gapDesc}>
          {twinData
            ? `Twin has ${twinData.twin.pet_name ?? "no companion"} and ${Math.round(
                twinData.twin.twin_xp
              ).toLocaleString()} XP. You have ${
                twinData.user.pet_name ?? "no companion"
              } and ${Math.round(twinData.user.total_xp).toLocaleString()} XP.`
            : "—"}
        </Text>

        {/* Twin dialogue card */}
        <View style={styles.dialogueCard}>
          <Text style={styles.dialogueLabel}>YOUR TWIN</Text>
          <Text style={styles.dialogueMessage}>
            {comparison?.strip_message?.trim() ? comparison.strip_message : DEFAULT_TWIN_DIALOGUE}
          </Text>
        </View>

        {/* Twin's Day activity timeline */}
        <View style={styles.timelineSection}>
          <View style={styles.timelineHeader}>
            <View style={styles.timelineHeaderLeft}>
              <View style={styles.timelineDotPulse} />
              <Text style={styles.timelineTitle}>TWIN'S DAY</Text>
            </View>
            <Text style={styles.timelineDate}>
              {new Date().toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </Text>
          </View>
          <View style={styles.timelineContainer}>
            <LinearGradient
              colors={["rgba(139,92,246,0.5)", "rgba(139,92,246,0.15)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.timelineLine}
            />
            {activities.length === 0 ? (
              <Text style={styles.timelineEmpty}>
                {
                  "Your Twin runs through the same mission set you see today. After today's plan is synced, you'll see their pace here — usually within your first open. A full refresh also runs overnight in your timezone."
                }
              </Text>
            ) : null}
            {activities.map((item, i) => {
              const completed = item.completed_at != null;
              return (
                <View key={`${item.mission_title}-${i}`} style={styles.timelineItem}>
                  <View
                    style={[
                      styles.timelineItemDot,
                      completed ? styles.timelineItemDotDone : styles.timelineItemDotPending,
                    ]}
                  />
                  <Text
                    style={[styles.timelineItemTitle, completed ? styles.timelineItemTitleDone : styles.timelineItemTitlePending]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.mission_title}
                  </Text>
                  <View style={styles.timelineItemRight}>
                    {completed ? (
                      <>
                        <Text style={styles.timelineItemXp}>+{item.xp_earned} XP</Text>
                        <Text style={styles.timelineItemTime}>{formatTime(item.completed_at!)}</Text>
                      </>
                    ) : (
                      <Text style={styles.timelineItemPending}>pending</Text>
                    )}
                  </View>
                </View>
              );
            })}
            <View style={styles.timelineSummary}>
              <Text style={styles.timelineSummaryText}>
                <Text style={styles.timelineSummaryHighlight}>{completedCount} done</Text>
                {" · "}
                <Text style={styles.timelineSummaryHighlight}>+{totalXp} XP</Text>
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Chat FAB — same position as Home journal (right 16, bottom 8) */}
      <Pressable
        style={({ pressed }) => [
          styles.chatFab,
          { bottom: CHAT_FAB_BOTTOM, right: CHAT_FAB_RIGHT },
          pressed && styles.chatFabPressed,
        ]}
        onPress={openTwinChat}
      >
        <LinearGradient
          colors={["#5B21B6", "#8B5CF6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.chatFabGradient}
        >
          <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>

      {/* Share card modal */}
      <TwinComparisonShareCard
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        comparison={comparison}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center" },
  loader: { marginTop: 24 },
  errorWrap: { padding: 16, alignItems: "center", justifyContent: "center" },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 14, color: "#9CA3AF", textAlign: "center" },
  retryButton: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 16 },
  retryLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#8B5CF6" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 0 },

  header: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: "rgba(9,9,26,0.7)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.4)",
  },
  headerTitleWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: "#E5E7EB",
  },
  shareBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(139,92,246,0.10)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },

  arena: {
    flexDirection: "row",
    position: "relative",
  },
  glowLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "55%",
    height: 300,
    backgroundColor: "transparent",
    ...(Platform.OS === "ios" && {
      // radial-gradient approximated with opacity overlay
    }),
  },
  glowRight: {
    position: "absolute",
    right: 0,
    top: 0,
    width: "55%",
    height: 300,
    backgroundColor: "transparent",
  },
  arenaHalf: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 12,
    gap: 5,
  },
  arenaUser: { paddingRight: 20 },
  arenaTwin: { paddingLeft: 20 },
  arenaLabel: {
    position: "absolute",
    top: 14,
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2.5,
  },
  arenaLabelYou: { color: "#4B5563" },
  arenaLabelTwin: { color: "rgba(139,92,246,0.5)" },
  charCardWrap: {
    width: CHAR_CARD_W,
    height: CHAR_CARD_H,
    borderRadius: 12,
    overflow: "visible",
    position: "relative",
  },
  charCard: {
    width: CHAR_CARD_W,
    height: CHAR_CARD_H,
    borderRadius: 12,
    borderWidth: 1,
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(0,0,0,0.4)", shadowRadius: 24, shadowOffset: { width: 0, height: 0 } }
      : { elevation: 8 }),
  },
  charCardUser: {
    borderColor: "rgba(139,92,246,0.12)",
  },
  charCardTwin: {
    borderColor: "rgba(139,92,246,0.25)",
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(100,30,200,0.18)", shadowRadius: 30, shadowOffset: { width: 0, height: 0 } }
      : {}),
  },
  petCircle: {
    position: "absolute",
    bottom: -12,
    width: PET_CIRCLE,
    height: PET_CIRCLE,
    borderRadius: PET_CIRCLE / 2,
    borderWidth: 2,
    borderColor: "#09091A",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  petCircleUser: { left: 6 },
  petCircleTwin: {
    right: 6,
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(139,92,246,0.2)", shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }
      : {}),
  },
  petCircleInner: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  charNameUser: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#9CA3AF",
    marginTop: 6,
  },
  charStageUser: { fontSize: 9, color: "#4B5563" },
  charNameTwin: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#A78BFA",
    marginTop: 6,
  },
  charStageTwin: { fontSize: 9, color: "#6D28D9" },

  fractureWrap: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 80,
    marginLeft: -40,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  fractureLine: {
    position: "absolute",
    left: 39,
    top: 0,
    bottom: 0,
    width: 1.5,
    ...(Platform.OS === "ios"
      ? { shadowColor: "#C084FC", shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }
      : { elevation: 6 }),
  },
  gapPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#09091A",
    borderWidth: 1,
    borderColor: "rgba(192,132,252,0.35)",
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 10,
    position: "relative",
    zIndex: 4,
  },
  gapPillText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#C084FC",
  },

  statsRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "rgba(12,12,26,0.6)",
    borderTopWidth: 1,
    borderTopColor: "rgba(42,48,80,0.3)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.3)",
  },
  statCol: {
    flex: 1,
    alignItems: "center",
    gap: 1,
  },
  statColCenter: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: "rgba(42,48,80,0.5)",
    borderRightColor: "rgba(42,48,80,0.5)",
  },
  statValueUser: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#F97316",
  },
  statPowerUser: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#8B5CF6",
  },
  statValueTwin: { fontSize: 10, color: "#4B5563" },
  statCompanionUser: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
  },
  statCompanionTwin: { fontSize: 10, color: "#4B5563" },
  statLabel: {
    fontSize: 8,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    color: "#374151",
    marginTop: 1,
  },

  gapDesc: {
    fontSize: 10,
    color: "#4B5563",
    textAlign: "center",
    paddingHorizontal: 20,
    paddingTop: 6,
    lineHeight: 15,
  },

  dialogueCard: {
    marginHorizontal: 14,
    marginTop: 8,
    backgroundColor: "rgba(14,12,28,0.7)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.4)",
    borderLeftWidth: 3,
    borderLeftColor: "#8B5CF6",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  dialogueLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "#8B5CF6",
    letterSpacing: 1,
    marginBottom: 3,
  },
  dialogueMessage: {
    fontSize: 11.5,
    color: "#C4B5FD",
    fontStyle: "italic",
    lineHeight: 16,
  },

  timelineSection: {
    marginHorizontal: 16,
    marginTop: 8,
    flex: 1,
    minHeight: 120,
  },
  timelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  timelineHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  timelineDotPulse: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#8B5CF6",
    ...(Platform.OS === "ios"
      ? { shadowColor: "#8B5CF6", shadowOpacity: 0.6, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }
      : {}),
  },
  timelineTitle: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.8,
    color: "#6B7280",
  },
  timelineDate: { fontSize: 9, color: "#374151" },
  timelineEmpty: {
    fontSize: 11,
    lineHeight: 17,
    color: "#9CA3AF",
    marginBottom: 10,
    paddingRight: 8,
  },
  timelineContainer: {
    flex: 1,
    position: "relative",
    paddingLeft: 16,
  },
  timelineLine: {
    position: "absolute",
    left: 4,
    top: 7,
    bottom: 16,
    width: 1,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5,
    position: "relative",
  },
  timelineItemDot: {
    position: "absolute",
    left: -13,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timelineItemDotDone: {
    backgroundColor: "#8B5CF6",
    borderWidth: 2,
    borderColor: "#09091A",
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(139,92,246,0.6)", shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }
      : {}),
  },
  timelineItemDotPending: {
    backgroundColor: "#0F1020",
    borderWidth: 2,
    borderColor: "rgba(42,48,80,0.6)",
  },
  timelineItemTitle: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  timelineItemTitleDone: { color: "rgba(167,139,250,0.78)" },
  timelineItemTitlePending: { color: "#2D3146" },
  timelineItemRight: {
    flexDirection: "row",
    gap: 6,
    flexShrink: 0,
  },
  timelineItemXp: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(139,92,246,0.5)",
  },
  timelineItemTime: { fontSize: 9, color: "#2D3146" },
  timelineItemPending: {
    fontSize: 9,
    color: "#2D3146",
    fontStyle: "italic",
  },
  timelineSummary: {
    marginTop: 5,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(139,92,246,0.06)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.12)",
    borderRadius: 7,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  timelineSummaryText: {
    fontSize: 9,
    color: "#6B7280",
  },
  timelineSummaryHighlight: {
    fontFamily: "Inter_600SemiBold",
    color: "#A78BFA",
  },

  chatFab: {
    position: "absolute",
    width: CHAT_FAB_SIZE,
    height: CHAT_FAB_SIZE,
    borderRadius: CHAT_FAB_SIZE / 2,
    overflow: "hidden",
    zIndex: 10,
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(139,92,246,0.45)", shadowRadius: 16, shadowOffset: { width: 0, height: 4 } }
      : { elevation: 10 }),
  },
  chatFabPressed: { transform: [{ scale: 0.93 }] },
  chatFabGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
