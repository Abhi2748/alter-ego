/**
 * Today's Story — Phase 2B dual timeline (GET /api/v1/twin/feed).
 * Replaces ShadowFeedScreen in MainTabNavigator. Tab name: "Today".
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "@react-navigation/native";
import { fetchShadowFeed, type FeedEntry } from "@/services/twin";
import {
  MAIN_TAB_TOP_BAR_MIN_HEIGHT,
  MAIN_TAB_TOP_BAR_PADDING_BOTTOM,
  MAIN_TAB_TOP_BAR_PADDING_H,
} from "@/constants/mainTabHeader";

const PILLAR_LABELS: Record<string, string> = {
  sleep: "Sleep",
  movement: "Movement",
  hydration: "Hydration",
  mindfulness: "Mindfulness",
  no_phone: "No Phone",
};

function pillarLabel(pillar: string | null | undefined): string {
  if (!pillar) return "Core";
  return PILLAR_LABELS[pillar.toLowerCase()] ?? pillar.charAt(0).toUpperCase() + pillar.slice(1);
}

const CHIP_CORE = {
  bg: "rgba(99,102,241,0.1)",
  border: "rgba(99,102,241,0.2)",
  text: "#818CF8",
};
const CHIP_INTEREST = {
  bg: "rgba(20,184,166,0.1)",
  border: "rgba(20,184,166,0.2)",
  text: "#2DD4BF",
};
const CHIP_RESISTANCE = {
  bg: "rgba(245,158,11,0.1)",
  border: "rgba(245,158,11,0.2)",
  text: "#FCD34D",
};
const CHIP_PERSONAL = {
  bg: "rgba(139,92,246,0.1)",
  border: "rgba(139,92,246,0.2)",
  text: "#A78BFA",
};

function TypeChip({
  missionType,
  corePillar,
  dimmed,
}: {
  missionType?: string | null;
  corePillar?: string | null;
  dimmed?: boolean;
}) {
  const mt = (missionType || "").toLowerCase();
  let colors = CHIP_CORE;
  let label = pillarLabel(corePillar).toUpperCase();
  if (mt === "interest") {
    colors = CHIP_INTEREST;
    label = "INTEREST";
  } else if (mt === "resistance") {
    colors = CHIP_RESISTANCE;
    label = "RESISTANCE";
  } else if (mt === "personal") {
    colors = CHIP_PERSONAL;
    label = "PERSONAL";
  } else if (mt === "core" || !mt) {
    colors = CHIP_CORE;
    label = pillarLabel(corePillar).toUpperCase();
  } else {
    colors = CHIP_CORE;
    label = pillarLabel(corePillar).toUpperCase();
  }
  return (
    <View style={dimmed ? { opacity: 0.35 } : undefined}>
      <View
        style={[
          styles.chip,
          { backgroundColor: colors.bg, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.chipText, { color: colors.text }]}>{label}</Text>
      </View>
    </View>
  );
}

const CONNECTOR_TWIN = ["rgba(139,92,246,0.5)", "rgba(139,92,246,0)"] as const;
const CONNECTOR_USER = ["rgba(249,115,22,0.5)", "rgba(249,115,22,0)"] as const;
const CONNECTOR_GREY = ["rgba(55,65,81,0.5)", "rgba(55,65,81,0)"] as const;

const TwinEntry = React.memo(function TwinEntry({ entry }: { entry: FeedEntry }) {
  return (
    <View style={[styles.entry, styles.twinEntryBg]}>
      <View style={styles.timeCol}>
        <Text style={styles.timeText}>{entry.display_time}</Text>
      </View>
      <View style={styles.dotCol}>
        <View style={styles.twinDot} />
        <LinearGradient colors={[...CONNECTOR_TWIN]} style={styles.connectorLine} />
      </View>
      <View style={styles.entryContent}>
        <Text style={styles.twinLabel}>TWIN</Text>
        <Text style={styles.missionTitle} numberOfLines={2}>
          {entry.mission_title}
        </Text>
        <TypeChip missionType={entry.mission_type} corePillar={entry.core_pillar} />
        {entry.is_shared_interest ? (
          <View style={styles.sharedBadge}>
            <Text style={styles.sharedBadgeText}>SAME INTEREST</Text>
          </View>
        ) : null}
        {entry.twin_note ? (
          <Text style={styles.twinNote}>&ldquo;{entry.twin_note}&rdquo;</Text>
        ) : null}
      </View>
    </View>
  );
});

const UserDoneEntry = React.memo(function UserDoneEntry({ entry }: { entry: FeedEntry }) {
  return (
    <View style={[styles.entry, styles.userDoneEntryBg]}>
      <View style={styles.timeCol}>
        <Text style={styles.timeText}>{entry.display_time}</Text>
      </View>
      <View style={styles.dotCol}>
        <View style={styles.userDoneDot} />
        <LinearGradient colors={[...CONNECTOR_USER]} style={styles.connectorLine} />
      </View>
      <View style={styles.entryContent}>
        <Text style={styles.userLabel}>YOU</Text>
        <Text style={[styles.missionTitle, { color: "#E5E7EB" }]} numberOfLines={2}>
          {entry.mission_title}
        </Text>
        <TypeChip missionType={entry.mission_type} corePillar={entry.core_pillar} />
        <Text style={styles.userDoneLabel}>✓ Completed</Text>
      </View>
    </View>
  );
});

const UserIncompleteEntry = React.memo(function UserIncompleteEntry({ entry }: { entry: FeedEntry }) {
  return (
    <View style={[styles.entry, styles.userIncompleteEntryBg]}>
      <View style={styles.timeCol} />
      <View style={styles.dotCol}>
        <View style={styles.userIncompleteDot} />
        <LinearGradient colors={[...CONNECTOR_GREY]} style={styles.connectorLine} />
      </View>
      <View style={styles.entryContent}>
        <Text style={styles.incompleteLabel}>YOU</Text>
        <Text style={styles.missionTitleDimmed} numberOfLines={2}>
          {entry.mission_title}
        </Text>
        <TypeChip missionType={entry.mission_type} corePillar={entry.core_pillar} dimmed />
        <Text style={styles.incompleteLabel2}>Not completed</Text>
      </View>
    </View>
  );
});

const TwinIncompleteEntry = React.memo(function TwinIncompleteEntry({ entry }: { entry: FeedEntry }) {
  return (
    <View style={[styles.entry, styles.twinIncompleteEntryBg]}>
      <View style={styles.timeCol} />
      <View style={styles.dotCol}>
        <View style={styles.twinIncompleteDot} />
        <LinearGradient colors={[...CONNECTOR_GREY]} style={styles.connectorLine} />
      </View>
      <View style={styles.entryContent}>
        <Text style={styles.twinLabel}>TWIN</Text>
        <Text style={styles.missionTitleDimmed} numberOfLines={2}>
          {entry.mission_title}
        </Text>
        <TypeChip missionType={entry.mission_type} corePillar={entry.core_pillar} dimmed />
        <Text style={styles.incompleteLabel2Twin}>Not completed</Text>
      </View>
    </View>
  );
});

const ObservationEntry = React.memo(function ObservationEntry({ entry }: { entry: FeedEntry }) {
  return (
    <View style={styles.obsCard}>
      <Text style={styles.obsText}>{entry.observation_text}</Text>
    </View>
  );
});

const DaySummaryEntry = React.memo(function DaySummaryEntry({ entry }: { entry: FeedEntry }) {
  return (
    <View style={styles.summaryCard}>
      <LinearGradient
        colors={["rgba(109,40,217,0.06)", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.summaryCardTopLine} />
      <View style={styles.summaryRow}>
        <Text style={styles.summaryTitle}>{entry.summary_date_label?.toUpperCase()}</Text>
        <View style={styles.summaryStats}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatVal}>{entry.summary_missions_done ?? 0}</Text>
            <Text style={styles.summaryStatLbl}>DONE</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatVal}>{entry.summary_xp ?? 0}</Text>
            <Text style={styles.summaryStatLbl}>XP</Text>
          </View>
        </View>
      </View>
      {entry.summary_twin_quote ? (
        <Text style={styles.summaryQuote}>&ldquo;{entry.summary_twin_quote}&rdquo;</Text>
      ) : null}
    </View>
  );
});

const PendingEntry = React.memo(function PendingEntry({ count }: { count: number }) {
  return (
    <View style={styles.pendingZone}>
      <View style={styles.pendingDot} />
      <Text style={styles.pendingTxt}>
        {count === 1
          ? "1 more completion will appear as the day unfolds…"
          : `${count} more completions will appear as the day unfolds…`}
      </Text>
    </View>
  );
});

const DayDivider = React.memo(function DayDivider({ label }: { label: string }) {
  return (
    <View style={styles.dayDivider}>
      <View style={styles.divLine} />
      <Text style={styles.divTxt}>{label}</Text>
      <View style={styles.divLine} />
    </View>
  );
});

type ListItem =
  | { type: "entry"; data: FeedEntry }
  | { type: "pending"; count: number }
  | { type: "divider"; label: string };

export function TodaysStoryScreen() {
  const insets = useSafeAreaInsets();

  const {
    data: feedData,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["twin", "feed"],
    queryFn: () => fetchShadowFeed(3),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
    retry: 1,
  });

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const entries = feedData?.entries ?? [];
  const pendingCount = feedData?.pending_count ?? 0;
  const twinDone = feedData?.today_twin_done ?? 0;
  const userDone = feedData?.today_user_done ?? 0;

  const listData: ListItem[] = useMemo(() => {
    const out: ListItem[] = [];
    let insertedPending = false;
    let insertedDivider = false;

    for (const entry of entries) {
      if (!insertedDivider && entry.entry_type === "day_summary") {
        if (!insertedPending && pendingCount > 0) {
          out.push({ type: "pending", count: pendingCount });
          insertedPending = true;
        }
        out.push({ type: "divider", label: "Earlier" });
        insertedDivider = true;
      }
      out.push({ type: "entry", data: entry });
    }

    if (!insertedPending && pendingCount > 0) {
      out.push({ type: "pending", count: pendingCount });
    }

    return out;
  }, [entries, pendingCount]);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === "pending") {
      return <PendingEntry count={item.count} />;
    }
    if (item.type === "divider") {
      return <DayDivider label={item.label} />;
    }
    const entry = item.data;
    switch (entry.entry_type) {
      case "twin_completion":
        return <TwinEntry entry={entry} />;
      case "user_completion":
        return <UserDoneEntry entry={entry} />;
      case "user_incomplete":
        return <UserIncompleteEntry entry={entry} />;
      case "twin_incomplete":
        return <TwinIncompleteEntry entry={entry} />;
      case "observation":
        return <ObservationEntry entry={entry} />;
      case "day_summary":
        return <DaySummaryEntry entry={entry} />;
      default:
        return null;
    }
  }, []);

  const keyExtractor = useCallback((item: ListItem, index: number) => {
    if (item.type === "entry") return `entry-${item.data.timestamp_iso}-${index}`;
    if (item.type === "pending") return "pending";
    if (item.type === "divider") return `divider-${index}`;
    return `row-${index}`;
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#09091A", "#06070E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            minHeight: MAIN_TAB_TOP_BAR_MIN_HEIGHT,
            paddingBottom: MAIN_TAB_TOP_BAR_PADDING_BOTTOM,
            paddingHorizontal: MAIN_TAB_TOP_BAR_PADDING_H,
          },
        ]}
      >
        <Text style={styles.headerTitle}>Today's story</Text>
        <View style={styles.headerSub}>
          <Text style={styles.headerDate}>
            {new Date()
              .toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })
              .toUpperCase()}
          </Text>
          <View style={styles.liveDot} />
          <Text style={styles.liveLabel}>Live</Text>
        </View>
      </View>

      <View style={styles.scoreBar}>
        <View style={[styles.scoreSide, styles.scoreTwinSide]}>
          <Text style={[styles.scoreNumber, styles.scoreTwinNumber]}>{twinDone}</Text>
          <Text style={styles.scoreSubLabel}>Twin done</Text>
        </View>
        <View style={styles.scoreDivider} />
        <View style={[styles.scoreSide, styles.scoreUserSide]}>
          <Text style={[styles.scoreNumber, styles.scoreUserNumber]}>{userDone}</Text>
          <Text style={styles.scoreSubLabel}>You done</Text>
        </View>
      </View>

      {isPending ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#8B5CF6" />
        </View>
      ) : isError && entries.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.errorTxt}>Could not load feed</Text>
          {error instanceof Error && error.message ? (
            <Text style={styles.errorDetail}>{error.message}</Text>
          ) : null}
          <Pressable onPress={() => void refetch()} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTxt}>
            Your shadow starts where you start.{"\n"}
            Check back after your Twin's first move.
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingBottom: insets.bottom + 88 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={8}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS === "android"}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor="#8B5CF6"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#06070E" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },

  // Header
  header: {
    justifyContent: "center",
    backgroundColor: "rgba(20,24,36,0.8)",
    borderBottomWidth: 1,
    borderBottomColor: "#2A3050",
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Inter_800ExtraBold",
    color: "#E5E7EB",
    letterSpacing: -0.5,
  },
  headerSub: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
  },
  headerDate: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#6B7280",
    letterSpacing: 1.5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#22C55E",
  },
  liveLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#22C55E",
  },

  // Score bar
  scoreBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#2A3050",
  },
  scoreSide: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  scoreTwinSide: {
    borderBottomWidth: 2,
    borderBottomColor: "#8B5CF6",
  },
  scoreUserSide: {
    borderBottomWidth: 2,
    borderBottomColor: "#F97316",
  },
  scoreDivider: {
    width: 1,
    backgroundColor: "#2A3050",
    marginVertical: 8,
  },
  scoreNumber: {
    fontSize: 22,
    fontFamily: "Inter_800ExtraBold",
    lineHeight: 26,
  },
  scoreTwinNumber: { color: "#8B5CF6" },
  scoreUserNumber: { color: "#F97316" },
  scoreSubLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#6B7280",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 3,
  },

  // Entry base (shared by all three types)
  entry: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.4)",
  },
  twinEntryBg: {
    backgroundColor: "rgba(139,92,246,0.03)",
    borderLeftWidth: 2,
    borderLeftColor: "rgba(139,92,246,0.18)",
    paddingHorizontal: 20,
  },
  userDoneEntryBg: {
    backgroundColor: "rgba(249,115,22,0.04)",
    borderLeftWidth: 2,
    borderLeftColor: "rgba(249,115,22,0.22)",
    paddingHorizontal: 20,
  },
  userIncompleteEntryBg: {
    backgroundColor: "transparent",
    borderLeftWidth: 2,
    borderLeftColor: "transparent",
    paddingHorizontal: 20,
  },
  twinIncompleteEntryBg: {
    backgroundColor: "rgba(139,92,246,0.02)",
    borderLeftWidth: 2,
    borderLeftColor: "rgba(139,92,246,0.15)",
    paddingHorizontal: 20,
  },

  // Column 1: time
  timeCol: {
    width: 52,
    alignItems: "flex-end",
    paddingTop: 1,
    justifyContent: "flex-start",
  },
  timeText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#4B5563",
    fontVariant: ["tabular-nums"],
  },

  // Column 2: dot + connector
  dotCol: {
    width: 18,
    alignItems: "center",
    alignSelf: "stretch",
    flexDirection: "column",
  },
  twinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#8B5CF6",
    borderWidth: 2,
    borderColor: "#A78BFA",
    marginTop: 2,
    flexShrink: 0,
  },
  userDoneDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F97316",
    borderWidth: 2,
    borderColor: "#FB923C",
    marginTop: 2,
    flexShrink: 0,
  },
  userIncompleteDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#374151",
    marginTop: 2,
    flexShrink: 0,
  },
  twinIncompleteDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "rgba(139,92,246,0.4)",
    marginTop: 2,
    flexShrink: 0,
  },
  connectorLine: {
    width: 1,
    flex: 1,
    minHeight: 16,
    marginTop: 2,
  },

  // Column 3: content
  entryContent: {
    flex: 1,
    paddingTop: 1,
    minWidth: 0,
  },
  twinLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    color: "#A78BFA",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  userLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    color: "#F97316",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  incompleteLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    color: "#374151",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  missionTitle: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#D1D5DB",
    lineHeight: 18,
  },
  missionTitleDimmed: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#4B5563",
    lineHeight: 18,
  },
  twinNote: {
    fontSize: 12,
    color: "#6D28D9",
    fontStyle: "italic",
    marginTop: 5,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
  },
  userDoneLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#9CA3AF",
    marginTop: 4,
  },
  incompleteLabel2: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#374151",
    marginTop: 4,
  },
  incompleteLabel2Twin: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(167,139,250,0.65)",
    marginTop: 4,
  },

  sharedBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(139,92,246,0.08)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 4,
    marginBottom: 2,
  },
  sharedBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    color: "#A78BFA",
    textTransform: "uppercase",
  },

  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    marginTop: 4,
  },
  chipText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  pendingZone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.3)",
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2A3050",
  },
  pendingTxt: {
    fontSize: 12,
    color: "#374151",
    fontStyle: "italic",
    fontFamily: "Inter_400Regular",
  },

  dayDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  divLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(42,48,80,0.3)",
  },
  divTxt: {
    fontSize: 9,
    color: "#374151",
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  summaryCard: {
    marginHorizontal: 14,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(109,40,217,0.15)",
    borderRadius: 12,
    padding: 13,
    position: "relative",
    overflow: "hidden",
  },
  summaryCardTopLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(139,92,246,0.15)",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  summaryTitle: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    color: "rgba(139,92,246,0.5)",
    textTransform: "uppercase",
  },
  summaryStats: { flexDirection: "row", gap: 12 },
  summaryStat: { alignItems: "center" },
  summaryStatVal: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#A78BFA",
  },
  summaryStatLbl: {
    fontSize: 8,
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  summaryQuote: {
    fontSize: 11,
    color: "rgba(167,139,250,0.65)",
    fontStyle: "italic",
    lineHeight: 17,
    borderTopWidth: 1,
    borderTopColor: "rgba(139,92,246,0.1)",
    paddingTop: 8,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },

  obsCard: {
    marginHorizontal: 14,
    marginVertical: 6,
    backgroundColor: "rgba(255,255,255,0.015)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.08)",
    borderLeftWidth: 2,
    borderLeftColor: "rgba(139,92,246,0.3)",
    borderRadius: 10,
    padding: 11,
  },
  obsText: {
    fontSize: 11,
    color: "rgba(229,231,235,0.6)",
    fontStyle: "italic",
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
  },

  errorTxt: {
    fontSize: 13,
    color: "#4B5563",
    textAlign: "center",
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 12,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "rgba(139,92,246,0.08)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.18)",
    borderRadius: 8,
  },
  retryTxt: {
    fontSize: 12,
    color: "#A78BFA",
    fontFamily: "Inter_600SemiBold",
  },
  emptyTxt: {
    fontSize: 13,
    color: "#374151",
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
});
