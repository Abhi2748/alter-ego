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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { LeaderboardSkeleton } from "../components/LeaderboardSkeleton";
import { COLORS, SPACING, GRADIENTS } from "../constants/theme";
import { supabase } from "@/utils/supabase";
import { getLeaderboard, type LeaderboardEntryOut } from "../utils/api";

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

const PET_EMOJI: Record<number, string> = {
  0: "🐻",
  1: "🐻",
  2: "🐱",
  3: "🦊",
  4: "🐺",
  5: "🐆",
  6: "🐈‍⬛",
  7: "🦅",
  8: "🐉",
};

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  stage: number;
  stage_title: string;
  pet_stage: number;
  streak: number;
  power_score: number;
  is_own_row: boolean;
  character_image_url: string | null;
  pet_image_url: string | null;
}

function mapEntry(e: LeaderboardEntryOut): LeaderboardEntry {
  const stage = Math.min(6, Math.max(1, e.character_stage ?? 1));
  return {
    rank: e.rank,
    user_id: e.user_id ?? "",
    username: e.username ?? "—",
    stage,
    stage_title: STAGE_NAMES[stage - 1] ?? "The Awakened",
    pet_stage: Math.min(8, Math.max(0, e.pet_stage ?? 0)),
    streak: e.streak ?? 0,
    power_score: e.power_score ?? 0,
    is_own_row: e.is_own ?? false,
    character_image_url: null,
    pet_image_url: null,
  };
}

// Placeholder when API unavailable
const PLACEHOLDER_ENTRIES: LeaderboardEntry[] = [
  { rank: 1, user_id: "u1", username: "iron_phoenix_9", stage: 6, stage_title: "The Sovereign", pet_stage: 8, streak: 62, power_score: 9840, is_own_row: false, character_image_url: null, pet_image_url: null },
  { rank: 2, user_id: "u2", username: "silent_ember", stage: 5, stage_title: "The Formidable", pet_stage: 7, streak: 48, power_score: 8210, is_own_row: false, character_image_url: null, pet_image_url: null },
  { rank: 3, user_id: "u3", username: "zero_day_zara", stage: 4, stage_title: "The Relentless", pet_stage: 6, streak: 41, power_score: 6890, is_own_row: false, character_image_url: null, pet_image_url: null },
  { rank: 4, user_id: "u4", username: "ghost_mode_k", stage: 3, stage_title: "The Burning", pet_stage: 4, streak: 33, power_score: 5440, is_own_row: false, character_image_url: null, pet_image_url: null },
  { rank: 5, user_id: "u5", username: "mindset_forge", stage: 3, stage_title: "The Burning", pet_stage: 3, streak: 28, power_score: 4920, is_own_row: false, character_image_url: null, pet_image_url: null },
  { rank: 6, user_id: "u6", username: "cold_focus_rx", stage: 2, stage_title: "The Focused", pet_stage: 2, streak: 19, power_score: 3780, is_own_row: false, character_image_url: null, pet_image_url: null },
  { rank: 7, user_id: "u7", username: "nova_discipline", stage: 2, stage_title: "The Focused", pet_stage: 2, streak: 15, power_score: 3100, is_own_row: false, character_image_url: null, pet_image_url: null },
  { rank: 8, user_id: "u8", username: "steady_rise_42", stage: 2, stage_title: "The Focused", pet_stage: 1, streak: 12, power_score: 2650, is_own_row: false, character_image_url: null, pet_image_url: null },
  { rank: 47, user_id: "me", username: "preview_user", stage: 2, stage_title: "The Focused", pet_stage: 2, streak: 5, power_score: 1240, is_own_row: true, character_image_url: null, pet_image_url: null },
];
const PLACEHOLDER_MY_RANK = 47;
const PLACEHOLDER_TOTAL = 312;

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
    petBg: string;
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
    petBg: "rgba(32,26,6,0.95)",
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
    petBg: "rgba(18,18,28,0.95)",
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
    petBg: "rgba(22,14,6,0.95)",
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
            <View style={[styles.top3PetDot, { backgroundColor: config.petBg }]}>
              <Text style={styles.top3PetEmoji}>{PET_EMOJI[entry.pet_stage] ?? PET_EMOJI[1]}</Text>
            </View>
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
            <View style={[styles.standardPetDot, isOwnRow && styles.ownPetDot]}>
              <Text style={styles.standardPetEmoji}>{PET_EMOJI[entry.pet_stage] ?? PET_EMOJI[1]}</Text>
            </View>
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
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usePlaceholder, setUsePlaceholder] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setEntries(PLACEHOLDER_ENTRIES);
        setMyRank(PLACEHOLDER_MY_RANK);
        setTotalUsers(PLACEHOLDER_TOTAL);
        setUsePlaceholder(true);
        setLoading(false);
        return;
      }
      const data = await getLeaderboard(session.access_token);
      const out = data.entries ?? [];
      const mapped = out.map(mapEntry);
      const myEntry: LeaderboardEntry | null = data.my_entry ? mapEntry(data.my_entry) : null;
      const rank = data.my_rank ?? null;
      const total = data.total_users ?? null;

      if (rank != null && rank > 100 && myEntry) {
        setEntries([...mapped, myEntry]);
      } else {
        setEntries(mapped);
      }
      setMyRank(rank);
      setTotalUsers(total ?? mapped.length);
      setUsePlaceholder(false);
    } catch (e) {
      setEntries(PLACEHOLDER_ENTRIES);
      setMyRank(PLACEHOLDER_MY_RANK);
      setTotalUsers(PLACEHOLDER_TOTAL);
      setUsePlaceholder(true);
      setError(e instanceof Error ? e.message : "Failed to load leaderboard");
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
    (navigation.getParent() as any)?.navigate("RankCard", {
      rankPosition,
    });
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
        <View>
          <Text style={styles.headerTitle}>Leaderboard</Text>
          <Text style={styles.headerSubtitle}>{displayTotal} competing</Text>
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
          ) : (
            <Text style={styles.rankStripNotVisible}>Keep going — visible after 7 consecutive days</Text>
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
      ) : error && !usePlaceholder ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptySub}>{error}</Text>
        </View>
      ) : !userVisible && entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No competitors yet</Text>
          <Text style={styles.emptySub}>Be the first to hit 7 days</Text>
        </View>
      ) : !userVisible ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Keep going.</Text>
          <Text style={styles.emptySub}>You appear on the leaderboard after 7 consecutive days.</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Your rank</Text>
          <Text style={styles.emptySub}>You're on the board. More people will appear as they hit 7 days.</Text>
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
    alignItems: "flex-end",
    justifyContent: "space-between",
    backgroundColor: "rgba(6,7,14,0.6)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.6)",
    zIndex: 1,
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
    borderRadius: 23,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  top3Avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  top3AvatarImg: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  top3StageNum: {
    fontSize: 16,
    fontWeight: "800",
    color: "rgba(229,231,235,0.7)",
  },
  top3PetDot: {
    position: "absolute",
    bottom: -3,
    right: -5,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: SCREEN_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  top3PetEmoji: {
    fontSize: 14,
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
    borderRadius: 19,
  },
  ownAvatarWrap: {
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.4)",
  },
  standardAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
  },
  standardAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  standardStageNum: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(167,139,250,0.7)",
  },
  standardPetDot: {
    position: "absolute",
    bottom: -2,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  ownPetDot: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surface2,
  },
  standardPetEmoji: {
    fontSize: 10,
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
