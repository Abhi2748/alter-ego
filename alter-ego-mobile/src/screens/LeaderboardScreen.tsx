/**
 * Leaderboard Screen — Tab 2. Global ranking. Fetches from GET /leaderboard.
 * User visible after 7 consecutive days (on leaderboard_scores). Empty state when not yet visible.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ListRenderItem,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LeaderboardRowCard } from "../components/LeaderboardRowCard";
import { LeaderboardSkeleton } from "../components/LeaderboardSkeleton";
import { COLORS, SPACING, GRADIENTS } from "../constants/theme";
import { supabase } from "../utils/supabase";
import { getLeaderboard, type LeaderboardEntryOut } from "../utils/api";

const STAGE_NAMES = ["The Awakened", "The Focused", "The Burning", "The Relentless", "The Formidable", "The Sovereign"];

const HEADER_HEIGHT = 56;
const BANNER_HEIGHT = 44;
const ROW_GAP = 8;
const CONTENT_PADDING_BOTTOM = 96;

export type LeaderboardEntry = {
  rank: number;
  username: string;
  stageTitle: string;
  characterStage: number;
  petStage: number;
  streak: number;
  powerScore: number;
  isOwnRow?: boolean;
};

function mapEntry(e: LeaderboardEntryOut): LeaderboardEntry {
  return {
    rank: e.rank,
    username: e.username,
    stageTitle: STAGE_NAMES[Math.max(0, (e.character_stage ?? 1) - 1)] ?? "The Awakened",
    characterStage: e.character_stage ?? 1,
    petStage: e.pet_stage ?? 0,
    streak: e.streak,
    powerScore: e.power_score,
    isOwnRow: e.is_own,
  };
}

export function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myEntry, setMyEntry] = useState<LeaderboardEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }
      const data = await getLeaderboard(session.access_token);
      setEntries((data.entries ?? []).map(mapEntry));
      setMyRank(data.my_rank ?? null);
      setMyEntry(data.my_entry ? mapEntry(data.my_entry) : null);
    } catch (e) {
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

  const userVisible = myEntry != null;
  const userStreak = myEntry?.streak ?? 0;
  const userRank = myRank ?? 0;
  const userInTop10 = userVisible && userRank >= 1 && userRank <= 10;
  const showShareStrip = userInTop10;

  const renderItem: ListRenderItem<LeaderboardEntry> = useCallback(
    ({ item, index }) => (
      <LeaderboardRowCard
        rank={item.rank}
        username={item.username}
        stageTitle={item.stageTitle}
        characterStage={item.characterStage}
        petStage={item.petStage}
        streak={item.streak}
        powerScore={item.powerScore}
        isOwnRow={item.isOwnRow}
        animationIndex={index}
      />
    ),
    []
  );

  const keyExtractor = useCallback((item: LeaderboardEntry) => `${item.rank}-${item.username}`, []);

  const goToRankCard = () => {
    navigation.getParent()?.navigate("RankCard" as never);
  };

  return (
    <LinearGradient
      colors={GRADIENTS.background.colors}
      start={GRADIENTS.background.start}
      end={GRADIENTS.background.end}
      style={styles.container}
    >
      {/* Fixed header: Leaderboard + Global chip */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            height: insets.top + HEADER_HEIGHT,
          },
        ]}
      >
        <View style={styles.headerGlass} />
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Leaderboard</Text>
          <View style={styles.globalChip}>
            <Text style={styles.globalChipText}>Global</Text>
          </View>
        </View>
      </View>

      {/* User rank banner — rank left (beside "Your rank"), Share your rank card right only */}
      <View style={styles.banner}>
        <View style={styles.bannerInner}>
          <View style={styles.bannerLeft}>
            <Text style={styles.bannerLabel}>Your rank</Text>
            {userVisible && (
              <Text style={styles.bannerValue}>{userRank > 0 ? `#${userRank}` : "On the board"}</Text>
            )}
          </View>
          {userVisible ? (
            showShareStrip ? (
              <Pressable onPress={goToRankCard} style={styles.bannerShare}>
                <Text style={styles.bannerShareText}>Share your rank card</Text>
                <Ionicons name="share-outline" size={14} color={COLORS.violet} />
              </Pressable>
            ) : (
              <View style={styles.bannerSpacer} />
            )
          ) : (
            <View style={styles.bannerNotVisible}>
              <Text style={styles.bannerNotVisibleText}>
                Keep going — visible after 7 consecutive days
              </Text>
              <Text style={styles.bannerStreak}>🔥{userStreak}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Content: loading skeleton, error, empty state, or list */}
      <View style={styles.content}>
        {loading ? (
          <LeaderboardSkeleton />
        ) : error ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptySub}>{error}</Text>
          </View>
        ) : !userVisible && entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={64} color={COLORS.surface2} />
            <Text style={styles.emptyTitle}>Global ranking</Text>
            <Text style={styles.emptySub}>
              Here you'll see everyone ranked by Power Score. Complete 7 consecutive days to appear on the leaderboard.
            </Text>
          </View>
        ) : !userVisible ? (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={64} color={COLORS.surface2} />
            <Text style={styles.emptyTitle}>Keep going.</Text>
            <Text style={styles.emptySub}>
              You appear on the leaderboard after 7 consecutive days.
            </Text>
            <Text style={styles.emptyStreak}>🔥{userStreak} day streak</Text>
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Your rank</Text>
            <Text style={styles.emptySub}>You're on the board. More people will appear as they hit 7 days.</Text>
          </View>
        ) : (
          <FlatList
            data={entries}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: CONTENT_PADDING_BOTTOM },
            ]}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: "relative",
    justifyContent: "flex-end",
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.glass,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: COLORS.text,
  },
  globalChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  globalChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.text2,
  },
  banner: {
    height: BANNER_HEIGHT,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
    paddingHorizontal: SPACING.screenPadding,
    justifyContent: "center",
  },
  bannerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bannerSpacer: { minWidth: 1 },
  bannerShare: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  bannerShareText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: COLORS.violet,
  },
  bannerLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.text2,
  },
  bannerValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: COLORS.violet,
  },
  bannerNotVisible: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bannerNotVisibleText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.text2,
  },
  bannerStreak: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: COLORS.ember,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.screenPadding,
  },
  listContent: {
    paddingTop: SPACING.sm,
  },
  separator: {
    height: ROW_GAP,
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
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: COLORS.text2,
    textAlign: "center",
    marginTop: SPACING.sm,
  },
  emptyStreak: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: COLORS.ember,
    marginTop: SPACING.md,
  },
});
