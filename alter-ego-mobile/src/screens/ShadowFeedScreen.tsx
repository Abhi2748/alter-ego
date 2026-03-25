/**
 * Shadow Feed — merged Twin / user activity timeline (GET /api/v1/twin/feed).
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

/** Matches backend TWIN_FEED_REACTION_USER_BEATS — user finished before Twin on this title. */
const USER_BEAT_REACTIONS = new Set([
  "You got there first.",
  "Ahead of me on this one.",
  "Noted.",
  "I'll catch up.",
]);

function TwinCompletionEntry({ entry }: { entry: FeedEntry }) {
  return (
    <View style={styles.entry}>
      <Text style={styles.entryTime}>{entry.display_time}</Text>
      <View style={[styles.entryIcon, styles.entryIconTwin]}>
        <Text style={styles.entryIconSymbol}>✦</Text>
      </View>
      <View style={styles.entryBody}>
        <Text style={styles.entryLabel}>TWIN COMPLETED</Text>
        <Text style={styles.entryTitle} numberOfLines={2}>
          {entry.mission_title}
        </Text>
        {entry.twin_note ? <Text style={styles.entryNote}>&ldquo;{entry.twin_note}&rdquo;</Text> : null}
      </View>
    </View>
  );
}

function UserCompletionEntry({ entry }: { entry: FeedEntry }) {
  const isBeat = entry.twin_note ? USER_BEAT_REACTIONS.has(entry.twin_note.trim()) : false;
  const noteStyle = isBeat ? styles.entryNoteAhead : styles.entryNoteReaction;

  return (
    <View style={styles.entry}>
      <Text style={styles.entryTime}>{entry.display_time}</Text>
      <View style={[styles.entryIcon, styles.entryIconUser]}>
        <Text style={styles.entryIconSymbolUser}>◇</Text>
      </View>
      <View style={styles.entryBody}>
        <Text style={[styles.entryLabel, styles.entryLabelUser]}>YOU COMPLETED</Text>
        <Text style={styles.entryTitle} numberOfLines={2}>
          {entry.mission_title}
        </Text>
        {entry.twin_note ? (
          <Text style={[styles.entryNote, noteStyle]}>&ldquo;{entry.twin_note}&rdquo;</Text>
        ) : null}
      </View>
      {entry.xp_earned ? (
        <Text style={styles.entryXpUser}>+{entry.xp_earned} XP</Text>
      ) : null}
    </View>
  );
}

function ObservationEntry({ entry }: { entry: FeedEntry }) {
  return (
    <View style={styles.obsCard}>
      <View style={styles.obsAccent} />
      <Text style={styles.obsText}>{entry.observation_text}</Text>
    </View>
  );
}

function DaySummaryEntry({ entry }: { entry: FeedEntry }) {
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
}

function PendingEntry({ count }: { count: number }) {
  return (
    <View style={styles.pendingZone}>
      <View style={styles.pendingDot} />
      <Text style={styles.pendingTxt}>
        {count === 1
          ? "1 more completion will appear later today..."
          : `${count} more completions will appear as the day progresses...`}
      </Text>
    </View>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <View style={styles.dayDivider}>
      <View style={styles.divLine} />
      <Text style={styles.divTxt}>{label}</Text>
      <View style={styles.divLine} />
    </View>
  );
}

type ListItem =
  | { type: "entry"; data: FeedEntry }
  | { type: "pending"; count: number }
  | { type: "divider"; label: string };

export function ShadowFeedScreen() {
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
    let seenSummary = false;

    for (const entry of entries) {
      if (entry.entry_type === "day_summary" && !seenSummary) {
        if (pendingCount > 0) {
          out.push({ type: "pending", count: pendingCount });
        }
        out.push({ type: "divider", label: "Earlier" });
        seenSummary = true;
      }
      out.push({ type: "entry", data: entry });
    }

    if (!seenSummary && pendingCount > 0) {
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
        return <TwinCompletionEntry entry={entry} />;
      case "user_completion":
        return <UserCompletionEntry entry={entry} />;
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
    return `divider-${index}`;
  }, []);

  const liveDotStyle = useMemo(
    () => [
      styles.liveDot,
      Platform.OS === "ios" && {
        shadowColor: "#A78BFA",
        shadowOpacity: 0.85,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 0 },
      },
    ],
    []
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#09091A", "#06070E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.headerTitle}>Shadow Feed</Text>
          <Text style={styles.headerSubtitle}>YOUR TWIN · TODAY</Text>
        </View>
        <View style={styles.liveRow}>
          <View style={liveDotStyle} />
          <Text style={styles.liveTxt}>LIVE</Text>
        </View>
      </View>

      <View style={styles.dateStrip}>
        <Text style={styles.dateLbl}>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </Text>
        <Text style={styles.dateStat}>{`Twin: ${twinDone} done · You: ${userDone} done`}</Text>
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

  header: {
    paddingBottom: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.3)",
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(167,139,250,0.45)",
    letterSpacing: 2,
    marginTop: 2,
  },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#A78BFA",
  },
  liveTxt: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(167,139,250,0.5)",
    letterSpacing: 1.5,
  },

  dateStrip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "rgba(9,9,26,0.6)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.2)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateLbl: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    color: "#4B5563",
    textTransform: "uppercase",
  },
  dateStat: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(139,92,246,0.5)",
  },

  entry: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.1)",
  },
  entryTime: {
    fontSize: 9,
    color: "#374151",
    fontFamily: "Inter_600SemiBold",
    width: 38,
    flexShrink: 0,
    paddingTop: 2,
    textAlign: "right",
  },
  entryIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  entryIconTwin: {
    backgroundColor: "rgba(139,92,246,0.12)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
  },
  entryIconUser: {
    backgroundColor: "rgba(229,231,235,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  entryIconSymbol: {
    fontSize: 10,
    color: "rgba(167,139,250,0.7)",
  },
  entryIconSymbolUser: {
    fontSize: 10,
    color: "rgba(229,231,235,0.4)",
  },
  entryBody: { flex: 1, minWidth: 0 },
  entryLabel: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    color: "rgba(167,139,250,0.45)",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  entryLabelUser: { color: "rgba(229,231,235,0.25)" },
  entryTitle: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(229,231,235,0.75)",
    marginBottom: 2,
  },
  entryNote: {
    fontSize: 11,
    color: "rgba(167,139,250,0.55)",
    fontStyle: "italic",
    lineHeight: 16,
    fontFamily: "Inter_400Regular",
  },
  entryNoteReaction: {
    color: "rgba(239,68,68,0.5)",
  },
  /** User ahead on this mission — violet (no green per product tokens). */
  entryNoteAhead: {
    color: "rgba(167,139,250,0.85)",
  },
  entryXpUser: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(167,139,250,0.65)",
    paddingTop: 2,
    flexShrink: 0,
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
  obsAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "rgba(139,92,246,0.3)",
    borderRadius: 2,
  },
  obsText: {
    fontSize: 11,
    color: "rgba(229,231,235,0.6)",
    fontStyle: "italic",
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
  },

  pendingZone: {
    marginHorizontal: 14,
    marginVertical: 8,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.01)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.2)",
    borderStyle: "dashed",
    borderRadius: 10,
  },
  pendingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2D3146",
    flexShrink: 0,
  },
  pendingTxt: {
    fontSize: 11,
    color: "#6B7280",
    fontStyle: "italic",
    fontFamily: "Inter_400Regular",
  },

  dayDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  divLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(42,48,80,0.2)",
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
