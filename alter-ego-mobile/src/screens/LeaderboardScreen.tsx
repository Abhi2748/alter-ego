/**
 * Leaderboard Screen — Part 3B Screen 19.
 * Tab 2. Global ranking. User invisible until 7 consecutive days.
 * Header + Global chip, user rank banner, FlatList of LeaderboardRowCard,
 * loading skeleton §2.12, empty state §2.13, Share rank strip when in top 10.
 */

import React, { useState, useCallback } from "react";
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
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LeaderboardRowCard } from "../components/LeaderboardRowCard";
import { LeaderboardSkeleton } from "../components/LeaderboardSkeleton";
import {
  COLORS,
  SPACING,
  GRADIENTS,
} from "../constants/theme";

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

const PLACEHOLDER_ENTRIES: LeaderboardEntry[] = [
  { rank: 1, username: "iron_phoenix_9", stageTitle: "The Sovereign", characterStage: 6, petStage: 8, streak: 62, powerScore: 9840 },
  { rank: 2, username: "silent_ember", stageTitle: "The Formidable", characterStage: 5, petStage: 7, streak: 48, powerScore: 8210 },
  { rank: 3, username: "zero_day_zara", stageTitle: "The Relentless", characterStage: 4, petStage: 6, streak: 41, powerScore: 6890 },
  { rank: 4, username: "steady_hand_42", stageTitle: "The Relentless", characterStage: 4, petStage: 5, streak: 38, powerScore: 5920 },
  { rank: 5, username: "dawn_runner", stageTitle: "The Burning", characterStage: 3, petStage: 5, streak: 31, powerScore: 4850 },
  { rank: 6, username: "night_owl_7", stageTitle: "The Burning", characterStage: 3, petStage: 4, streak: 28, powerScore: 4120 },
  { rank: 7, username: "shadow_wolf_77", stageTitle: "The Focused", characterStage: 2, petStage: 3, streak: 12, powerScore: 3240, isOwnRow: true },
  { rank: 8, username: "frost_byte", stageTitle: "The Focused", characterStage: 2, petStage: 3, streak: 19, powerScore: 2980 },
  { rank: 9, username: "ember_rise", stageTitle: "The Awakened", characterStage: 1, petStage: 2, streak: 9, powerScore: 2150 },
  { rank: 10, username: "quiet_storm", stageTitle: "The Awakened", characterStage: 1, petStage: 1, streak: 5, powerScore: 1820 },
];

export function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [userVisible, setUserVisible] = useState(true);
  const userStreak = 12;
  const userRank = 7;
  const totalUsers = 312;
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

      {/* User rank banner */}
      <View style={styles.banner}>
        <View style={styles.bannerInner}>
          <Text style={styles.bannerLabel}>Your rank</Text>
          {userVisible ? (
            <Text style={styles.bannerValue}>#{userRank} of {totalUsers} users</Text>
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

      {/* Content: loading skeleton, empty state, or list */}
      <View style={styles.content}>
        {loading ? (
          <LeaderboardSkeleton />
        ) : !userVisible ? (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={64} color={COLORS.surface2} />
            <Text style={styles.emptyTitle}>Keep going.</Text>
            <Text style={styles.emptySub}>
              You appear on the leaderboard after 7 consecutive days.
            </Text>
            <Text style={styles.emptyStreak}>🔥{userStreak} day streak</Text>
          </View>
        ) : (
          <FlatList
            data={PLACEHOLDER_ENTRIES}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: CONTENT_PADDING_BOTTOM + (showShareStrip ? BANNER_HEIGHT + 12 : 0) },
            ]}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Share your rank strip — only if user in top 10 */}
      {showShareStrip && !loading && (
        <Pressable style={styles.shareStrip} onPress={goToRankCard}>
          <Text style={styles.shareStripText}>Share your rank</Text>
          <Ionicons name="share-outline" size={16} color={COLORS.violet} />
        </Pressable>
      )}
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
  shareStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    paddingVertical: 12,
    paddingHorizontal: SPACING.screenPadding,
    borderTopWidth: 1,
    borderTopColor: "rgba(139, 92, 246, 0.15)",
  },
  shareStripText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: COLORS.violet,
  },
});
