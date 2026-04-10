/**
 * Leaderboard Screen — Premium dark cinematic leaderboard.
 * Top-3 podium (gold/silver/bronze), RANKS 4–100, user's own row in position (or after 100).
 * Fetches from GET /leaderboard. Visible after 7 consecutive days.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { MainStackParamList } from "@/navigation/types";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LeaderboardSkeleton } from "../components/LeaderboardSkeleton";
import { COLORS, SPACING, GRADIENTS } from "../constants/theme";
import { leaderboardService, type LeaderboardEntryApi } from "@/services/leaderboard";
import { isApiError } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

// Screen background (premium dark)
const SCREEN_BG = "#06070E";
// Podium colors — distinct gold (rank 1) vs silver/bronze for 2–3
const GOLD = "#FFD700"; // Bright yellow-gold so it clearly differs from bronze
const SILVER = "#C0C0C0";
const SILVER_PS = "#C0C0DC";
const BRONZE = "#CD7F32";
const BRONZE_PS = "#CD9060";

const STAGE_NAMES = [
  "The Awakened",
  "The Focused",
  "The Burning",
  "The Relentless",
  "The Formidable",
  "The Sovereign",
];

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  stage: number;
  stage_title: string;
  streak: number;
  power_score: number;
  is_own_row: boolean;
  character_image_url: string | null;
  avatar_url: string | null;
}

function mapEntryApi(e: LeaderboardEntryApi): LeaderboardEntry {
  const stage = Math.min(6, Math.max(1, e.character_stage ?? 1));
  return {
    rank: e.rank,
    user_id: e.user_id ?? "",
    username: e.username ?? "—",
    stage,
    stage_title: e.character_stage_name ?? STAGE_NAMES[stage - 1] ?? "The Awakened",
    streak: e.current_streak ?? 0,
    power_score: e.power_score ?? 0,
    is_own_row: Boolean(e.is_current_user),
    character_image_url: e.avatar_url ?? null,
    avatar_url: e.avatar_url ?? null,
  };
}

const ROW_STAGGER_MS = 45;
const ROW_ANIM_MS = 280;
const OWN_ROW_PULSE_DELAY_MS = 400;
const OWN_ROW_PULSE_MS = 500;

function formatPowerScore(n: number): string {
  return n.toLocaleString();
}

// --- Atmospheric glow (absolute, behind everything) ---
function GlowLayer() {
  return (
    <View style={styles.glowLayer} pointerEvents="none">
      <View
        style={[
          styles.glowShadow,
          {
            shadowColor: COLORS.violetDeep,
            shadowOpacity: 0.25,
            shadowRadius: 120,
          },
        ]}
      />
      <LinearGradient
        colors={["rgba(109,40,217,0.18)", "rgba(80,20,160,0.08)", "transparent"]}
        locations={[0, 0.4, 0.7]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

// --- Top 3 row (gold / silver / bronze) ---
type PodiumRank = 1 | 2 | 3;
const TOP3_CONFIG: Record<
  PodiumRank,
  {
    bgColors: readonly [string, string];
    borderColor: string;
    shadowColor: string;
    shadowRadius: number;
    accentColors: readonly [string, string, string];
    badgeBg: string;
    badgeBorder: string;
    rankColor: string;
    psColor: string;
    avatarBg: readonly [string, string];
    avatarBorder: string;
    avatarShadow: string;
  }
> = {
  1: {
    bgColors: ["rgba(35,28,6,0.95)", "rgba(22,18,4,0.98)"],
    borderColor: "rgba(255,215,0,0.32)",
    shadowColor: "rgba(255,215,0,0.12)",
    shadowRadius: 20,
    accentColors: ["transparent", "rgba(255,215,0,0.55)", "transparent"],
    badgeBg: "rgba(255,215,0,0.16)",
    badgeBorder: "rgba(255,215,0,0.38)",
    rankColor: GOLD,
    psColor: GOLD,
    avatarBg: ["rgba(90,70,15,0.9)", "rgba(45,35,8,1)"],
    avatarBorder: "rgba(255,215,0,0.45)",
    avatarShadow: "rgba(255,215,0,0.18)",
  },
  2: {
    bgColors: ["rgba(18,20,30,0.95)", "rgba(14,16,24,0.98)"],
    borderColor: "rgba(192,192,192,0.18)",
    shadowColor: "rgba(160,160,180,0.06)",
    shadowRadius: 16,
    accentColors: ["transparent", "rgba(200,200,220,0.45)", "transparent"],
    badgeBg: "rgba(200,200,220,0.10)",
    badgeBorder: "rgba(200,200,220,0.25)",
    rankColor: SILVER,
    psColor: SILVER_PS,
    avatarBg: ["rgba(40,40,60,0.9)", "rgba(20,20,35,1)"],
    avatarBorder: "rgba(180,180,200,0.3)",
    avatarShadow: "rgba(160,160,180,0.12)",
  },
  3: {
    bgColors: ["rgba(24,16,10,0.95)", "rgba(16,12,8,0.98)"],
    borderColor: "rgba(180,90,30,0.22)",
    shadowColor: "rgba(180,90,30,0.06)",
    shadowRadius: 16,
    accentColors: ["transparent", "rgba(200,100,40,0.45)", "transparent"],
    badgeBg: "rgba(180,90,30,0.14)",
    badgeBorder: "rgba(180,90,30,0.28)",
    rankColor: BRONZE,
    psColor: BRONZE_PS,
    avatarBg: ["rgba(60,35,15,0.9)", "rgba(30,18,8,1)"],
    avatarBorder: "rgba(180,100,40,0.3)",
    avatarShadow: "rgba(180,100,40,0.10)",
  },
};

function Top3Row({
  entry,
  index,
}: {
  entry: LeaderboardEntry;
  index: number;
}) {
  const rank = Math.min(3, Math.max(1, entry.rank)) as PodiumRank;
  const config = TOP3_CONFIG[rank];
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    const delay = index * ROW_STAGGER_MS;
    opacity.value = withDelay(delay, withTiming(1, { duration: ROW_ANIM_MS, easing: Easing.out(Easing.quad) }));
    translateY.value = withDelay(delay, withTiming(0, { duration: ROW_ANIM_MS, easing: Easing.out(Easing.quad) }));
  }, [entry.rank, index]);

  const animatedRow = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animatedRow}>
      <Pressable
        style={({ pressed }) => [
          styles.top3Card,
          {
            backgroundColor: "transparent",
            borderColor: config.borderColor,
            shadowColor: config.shadowColor,
            shadowRadius: config.shadowRadius,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <LinearGradient
          colors={[...config.bgColors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Top accent — fixed color; do not change for gold/silver/bronze */}
        <View style={[styles.top3Accent, { overflow: "hidden" }]}>
          <LinearGradient
            colors={["transparent", "rgba(139,92,246,0.35)", "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View style={styles.top3Inner}>
          <View style={[styles.top3Badge, { backgroundColor: config.badgeBg, borderColor: config.badgeBorder }]}>
            <Text style={[styles.top3BadgeText, { color: config.rankColor }]}>{rank}</Text>
          </View>
          <View style={[styles.top3AvatarWrap, { shadowColor: config.avatarShadow, shadowRadius: rank === 1 ? 12 : 10 }]}>
            <LinearGradient
              colors={[...config.avatarBg]}
              style={[styles.top3Avatar, { borderColor: config.avatarBorder }]}
            >
              {entry.character_image_url ? (
                <Image source={{ uri: entry.character_image_url }} style={styles.top3AvatarImg} resizeMode="cover" />
              ) : (
                <Text style={styles.top3StageNum}>{entry.stage}</Text>
              )}
            </LinearGradient>
          </View>
          <View style={styles.top3Info}>
            <Text style={styles.top3Username} numberOfLines={1} ellipsizeMode="tail">{entry.username}</Text>
            <Text style={styles.top3StageTitle}>{entry.stage_title}</Text>
          </View>
          <View style={styles.top3Right}>
            <View style={styles.streakRow}>
              <Text style={styles.streakNum}>🔥{entry.streak}</Text>
            </View>
            <Text style={[styles.top3PowerScore, { color: config.psColor }]}>
              {formatPowerScore(entry.power_score)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// --- Divider "RANKS 4–100" ---
function DividerRanks4To100() {
  return (
    <View style={styles.dividerWrap}>
      <LinearGradient
        colors={["transparent", "rgba(42,48,80,0.8)", "transparent"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.dividerLine}
      />
      <Text style={styles.dividerLabel}>RANKS 4–100</Text>
      <LinearGradient
        colors={["transparent", "rgba(42,48,80,0.8)", "transparent"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.dividerLine}
      />
    </View>
  );
}

// --- Standard row (rank 4+) ---
function StandardRow({
  entry,
  index,
  isOwnRow,
}: {
  entry: LeaderboardEntry;
  index: number;
  isOwnRow: boolean;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    const delay = (3 + 1 + index) * ROW_STAGGER_MS; // after top3 + divider
    opacity.value = withDelay(delay, withTiming(1, { duration: ROW_ANIM_MS, easing: Easing.out(Easing.quad) }));
    translateY.value = withDelay(delay, withTiming(0, { duration: ROW_ANIM_MS, easing: Easing.out(Easing.quad) }));
  }, [index, isOwnRow]);

  const animatedRow = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animatedRow}>
      <Pressable
        style={({ pressed }) => [
          styles.standardCard,
          isOwnRow && styles.ownCard,
          pressed && { transform: [{ scale: 0.98 }] },
        ]}
      >
        {isOwnRow && <View style={styles.ownCardEdge} />}
        <View style={styles.standardInner}>
          <View style={styles.standardRankWrap}>
            <Text style={[styles.standardRank, isOwnRow && { color: COLORS.violet }]}>{entry.rank}</Text>
          </View>
          <View style={[styles.standardAvatarWrap, isOwnRow && styles.ownAvatarWrap]}>
            <LinearGradient
              colors={isOwnRow ? ["rgba(100,50,200,0.9)", "rgba(40,20,80,1)"] : ["rgba(60,35,110,0.8)", "rgba(20,15,40,1)"]}
              style={[styles.standardAvatar, isOwnRow && styles.ownAvatar]}
            >
              {entry.character_image_url ? (
                <Image source={{ uri: entry.character_image_url }} style={styles.standardAvatarImg} resizeMode="cover" />
              ) : (
                <Text style={styles.standardStageNum}>{entry.stage}</Text>
              )}
            </LinearGradient>
          </View>
          <View style={styles.standardInfo}>
            <Text style={[styles.standardUsername, isOwnRow && styles.ownUsername]} numberOfLines={1} ellipsizeMode="tail">{entry.username}</Text>
            <Text style={styles.standardStageTitle}>{entry.stage_title}</Text>
          </View>
          <View style={styles.standardRight}>
            <View style={styles.streakRow}>
              <Text style={[styles.streakNum, isOwnRow && { color: COLORS.ember }]}>🔥{entry.streak}</Text>
            </View>
            <Text style={[styles.standardPowerScore, isOwnRow && { color: COLORS.violetGlow }]}>
              {formatPowerScore(entry.power_score)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<StackNavigationProp<MainStackParamList, "Leaderboard">>();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockHint, setLockHint] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLocked(false);
    setLockHint(null);
    const authed = useAuthStore.getState().isAuthenticated;
    if (!authed) {
      setEntries([]);
      setMyRank(null);
      setTotalUsers(null);
      setError("Sign in to view the leaderboard.");
      setLoading(false);
      return;
    }
    try {
      const data = await leaderboardService.getLeaderboard();
      const mapped = (data.entries ?? []).map(mapEntryApi);
      const me = data.current_user;
      let list = mapped;
      if (!me.in_top_100 && me.rank > 100) {
        const stage = Math.min(6, Math.max(1, me.character_stage ?? 1));
        const ownRow: LeaderboardEntry = {
          rank: me.rank,
          user_id: "",
          username: me.username ?? "You",
          stage,
          stage_title: STAGE_NAMES[stage - 1] ?? "The Awakened",
          streak: 0,
          power_score: me.power_score ?? 0,
          is_own_row: true,
          character_image_url: null,
          avatar_url: null,
        };
        list = [...mapped, ownRow];
      }
      setEntries(list);
      setMyRank(me.rank);
      setTotalUsers(data.total_users ?? list.length);
    } catch (e) {
      if (isApiError(e) && e.status === 403) {
        setLocked(true);
        const detail = e.data as { detail?: { message?: string; streak_needed?: number; current_streak?: number } };
        const msg = detail?.detail?.message ?? "Complete a 3-day streak to unlock the leaderboard.";
        setLockHint(msg);
        setEntries([]);
        setMyRank(null);
        setTotalUsers(null);
      } else {
        setError(e instanceof Error ? e.message : "Failed to load leaderboard");
        setEntries([]);
        setMyRank(null);
        setTotalUsers(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLeaderboard();
    }, [fetchLeaderboard])
  );

  const userVisible = myRank != null;
  const displayTotal = totalUsers ?? entries.length;
  const goToRankCard = () => {
    const rankPosition =
      myRank != null && myRank >= 1 && myRank <= 3
        ? (myRank as 1 | 2 | 3)
        : undefined;
    // Leaderboard is a MainStack screen; do not use getParent() — that is RootStack and has no RankCard.
    navigation.navigate("RankCard", { rankPosition });
  };
  const showShare = userVisible;

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <View style={styles.container}>
      <GlowLayer />
      <LinearGradient
        colors={[SCREEN_BG, SCREEN_BG]}
        style={StyleSheet.absoluteFill}
      />

      {/* Fixed header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.headerBackBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.muted} />
        </Pressable>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Leaderboard</Text>
          <Text style={styles.headerSubtitle}>
            {locked ? "—" : `${displayTotal} competing`}
          </Text>
        </View>
        <View style={styles.globalChip}>
          <Text style={styles.globalChipText}>Global</Text>
        </View>
      </View>

      {/* Your rank strip */}
      <View style={styles.rankStrip}>
        <View style={styles.rankStripLeft}>
          {userVisible ? (
            <>
              <Text style={styles.rankStripLabel}>Your rank</Text>
              <Text style={styles.rankStripValue}>#{myRank}</Text>
            </>
          ) : locked ? (
            <Text style={styles.rankStripNotVisible}>Unlock with a 3-day streak</Text>
          ) : (
            <Text style={styles.rankStripNotVisible}>Sign in to see your rank</Text>
          )}
        </View>
        {showShare && (
          <Pressable onPress={goToRankCard} style={styles.rankStripShare}>
            <Text style={styles.rankStripShareText}>Share rank card ↗</Text>
          </Pressable>
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.skeletonWrap}>
          <LeaderboardSkeleton />
        </View>
      ) : locked ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Leaderboard locked</Text>
          <Text style={styles.emptySub}>{lockHint ?? "Keep your streak to unlock."}</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptySub}>{error}</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No entries yet</Text>
          <Text style={styles.emptySub}>Competitors appear here as more users unlock the board.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionLabel}>TOP DISCIPLINE</Text>
          {top3.map((entry, i) => (
            <View key={`top3-${entry.rank}-${entry.user_id}`} style={styles.rowSpacer}>
              <Top3Row entry={entry} index={i} />
            </View>
          ))}
          <View style={styles.rowSpacer}>
            <DividerRanks4To100 />
          </View>
          {rest.map((entry, i) => (
            <View key={`std-${entry.rank}-${entry.user_id}`} style={styles.rowSpacer}>
              <StandardRow entry={entry} index={i} isOwnRow={entry.is_own_row} />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  glowLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    zIndex: 0,
  },
  glowShadow: {
    ...StyleSheet.absoluteFillObject,
    height: 280,
    backgroundColor: "transparent",
  },
  header: {
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: "rgba(6,7,14,0.6)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.6)",
    zIndex: 1,
  },
  headerBackBtn: {
    padding: 4,
    marginLeft: -4,
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "400",
    color: COLORS.muted,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  globalChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  globalChipText: {
    fontSize: 11,
    fontWeight: "500",
    color: COLORS.text2,
  },
  rankStrip: {
    height: 40,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(139,92,246,0.07)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139,92,246,0.15)",
    zIndex: 1,
  },
  rankStripLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rankStripLabel: {
    fontSize: 12,
    fontWeight: "400",
    color: COLORS.text2,
  },
  rankStripValue: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.violet,
  },
  rankStripNotVisible: {
    fontSize: 12,
    color: COLORS.text2,
  },
  rankStripShare: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  rankStripShareText: {
    fontSize: 11,
    fontWeight: "500",
    color: COLORS.violet,
  },
  skeletonWrap: {
    flex: 1,
    paddingHorizontal: 14,
  },
  scroll: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 80,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    color: COLORS.muted,
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  rowSpacer: {
    marginBottom: 8,
  },
  top3Card: {
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  top3Accent: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    borderRadius: 1,
  },
  top3Inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  top3Badge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  top3BadgeText: {
    fontSize: 13,
    fontWeight: "800",
  },
  top3AvatarWrap: {
    position: "relative",
    width: 46,
    height: 46,
    borderRadius: 10,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  top3Avatar: {
    width: 46,
    height: 46,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  top3AvatarImg: {
    width: "100%",
    height: "100%",
  },
  top3StageNum: {
    fontSize: 16,
    fontWeight: "800",
    color: "rgba(229,231,235,0.7)",
  },
  top3Info: {
    flex: 1,
    minWidth: 0,
  },
  top3Username: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2,
  },
  top3StageTitle: {
    fontSize: 11,
    fontWeight: "400",
    color: COLORS.muted,
  },
  top3Right: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 3,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  streakNum: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  top3PowerScore: {
    fontSize: 17,
    fontWeight: "800",
  },
  dividerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerLabel: {
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#4B5563",
  },
  standardCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surface2,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    position: "relative",
    overflow: "hidden",
  },
  ownCard: {
    backgroundColor: "#16192A",
    borderColor: "rgba(139,92,246,0.45)",
    shadowColor: "rgba(139,92,246,0.12)",
    shadowRadius: 16,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  ownCardEdge: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: COLORS.violet,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  standardInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  standardRankWrap: {
    width: 24,
    alignItems: "center",
    flexShrink: 0,
  },
  standardRank: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.muted,
  },
  standardAvatarWrap: {
    position: "relative",
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  ownAvatarWrap: {
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.4)",
  },
  standardAvatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
  },
  standardAvatarImg: {
    width: "100%",
    height: "100%",
  },
  standardStageNum: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(167,139,250,0.7)",
  },
  standardInfo: {
    flex: 1,
    minWidth: 0,
  },
  standardUsername: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  ownUsername: {
    fontWeight: "700",
  },
  standardStageTitle: {
    fontSize: 11,
    fontWeight: "400",
    color: COLORS.muted,
  },
  standardRight: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 3,
  },
  standardPowerScore: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.violet,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  emptySub: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: SPACING.sm,
  },
});
