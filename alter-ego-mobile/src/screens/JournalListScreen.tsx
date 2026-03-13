/**
 * Journal List — iPhone Journal style. Recent entries with title, preview, date.
 * Plus button bottom-right to add new. Three dots top-right → Calendar.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, RADIUS } from "../constants/theme";
import { supabase } from "../utils/supabase";
import { getJournalEntries } from "../utils/api";
import { getJournalBookmarks, setJournalBookmarks } from "../utils/journalBookmarks";

function dateToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatEntryDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const today = dateToKey(new Date());
  if (dateStr === today) return "Today";
  const yesterday = dateToKey(new Date(Date.now() - 86400000));
  if (dateStr === yesterday) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function parseTitleAndBody(content: string): { title: string; body: string } {
  const idx = content.indexOf("\n\n");
  if (idx === -1) return { title: "", body: content.trim() };
  return {
    title: content.slice(0, idx).trim(),
    body: content.slice(idx + 2).trim(),
  };
}

function previewText(body: string, maxLen: number): string {
  const t = body.replace(/\n/g, " ").trim();
  if (t.length <= maxLen) return t || "No content";
  return t.slice(0, maxLen) + "…";
}

type EntryItem = {
  date: string;
  content: string;
  title: string;
  body: string;
  preview: string;
};

export function JournalListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [entries, setEntries] = useState<EntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [bookmarkedSet, setBookmarkedSet] = useState<Set<string>>(new Set());
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionRes, bookmarks] = await Promise.all([
        supabase.auth.getSession(),
        getJournalBookmarks(),
      ]);
      const { data: { session } } = sessionRes;
      setBookmarkedSet(new Set(bookmarks));
      if (!session?.access_token) {
        setEntries([]);
        return;
      }
      const res = await getJournalEntries(session.access_token, undefined, undefined, 100);
      const list: EntryItem[] = (res.entries || [])
        .map((e) => {
          const { title, body } = parseTitleAndBody(e.content || "");
          return {
            date: e.date,
            content: e.content || "",
            title: title || "Untitled",
            body,
            preview: previewText(body || title || "", 80),
          };
        })
        .sort((a, b) => (a.date > b.date ? -1 : 1));
      setEntries(list);
    } catch (_) {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries])
  );

  const openEditor = (date?: string) => {
    setMenuVisible(false);
    (navigation as any).navigate("JournalEditor", { date: date || dateToKey(new Date()) });
  };

  const openCalendar = () => {
    setMenuVisible(false);
    (navigation as any).navigate("JournalCalendar");
  };

  const toggleShowBookmarkedOnly = () => {
    setShowBookmarkedOnly((prev) => !prev);
    setMenuVisible(false);
  };

  const toggleBookmark = async (date: string) => {
    const next = new Set(bookmarkedSet);
    if (next.has(date)) next.delete(date);
    else next.add(date);
    setBookmarkedSet(next);
    await setJournalBookmarks(Array.from(next));
  };

  const displayEntries = showBookmarkedOnly
    ? entries.filter((e) => bookmarkedSet.has(e.date))
    : entries;

  const renderItem = ({ item }: { item: EntryItem }) => {
    const isBookmarked = bookmarkedSet.has(item.date);
    return (
      <View style={styles.entryCard}>
        <Pressable
          style={styles.entryCardContent}
          onPress={() => openEditor(item.date)}
        >
          <Text style={styles.entryTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.entryPreview} numberOfLines={2}>{item.preview}</Text>
          <View style={styles.entryDateDivider} />
          <Text style={styles.entryDate}>{formatEntryDate(item.date)}</Text>
        </Pressable>
        <Pressable
          style={styles.bookmarkBtn}
          onPress={() => toggleBookmark(item.date)}
          hitSlop={8}
        >
          <Ionicons
            name={isBookmarked ? "bookmark" : "bookmark-outline"}
            size={22}
            color={isBookmarked ? COLORS.violet : COLORS.muted}
          />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.bg1, COLORS.bg0]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Journal</Text>
        <Pressable onPress={() => setMenuVisible(true)} style={styles.headerBtn} hitSlop={12}>
          <Ionicons name="ellipsis-horizontal" size={24} color={COLORS.text} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.violet} />
        </View>
      ) : (
        <FlatList
          data={displayEntries}
          renderItem={renderItem}
          keyExtractor={(item) => item.date}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                {showBookmarkedOnly ? "No bookmarked entries" : "No entries yet"}
              </Text>
              <Text style={styles.emptyHint}>
                {showBookmarkedOnly
                  ? "Bookmark entries from the list to see them here"
                  : "Tap + to write your first entry"}
              </Text>
            </View>
          }
        />
      )}

      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={() => openEditor()}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

      <Modal visible={menuVisible} transparent animationType="fade">
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuBox, { top: insets.top + 56 }]}>
            <Pressable style={styles.menuItem} onPress={openCalendar}>
              <Ionicons name="calendar-outline" size={20} color={COLORS.text} />
              <Text style={styles.menuItemText}>Calendar</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={toggleShowBookmarkedOnly}>
              <Ionicons
                name={showBookmarkedOnly ? "list" : "bookmark-outline"}
                size={20}
                color={COLORS.text}
              />
              <Text style={styles.menuItemText}>
                {showBookmarkedOnly ? "Show all entries" : "Show bookmarked only"}
              </Text>
            </Pressable>
          </View>
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
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBtn: { minWidth: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: COLORS.text,
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { paddingHorizontal: SPACING.screenPadding, paddingTop: SPACING.md },
  entryCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: SPACING.cardPadding,
    marginBottom: SPACING.cardGap,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  entryCardContent: { flex: 1, minWidth: 0 },
  bookmarkBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginRight: -8,
    marginTop: -4,
  },
  entryTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: COLORS.text,
    marginBottom: 4,
  },
  entryPreview: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.text2,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  entryDateDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  entryDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.muted,
  },
  emptyWrap: { paddingTop: 48, alignItems: "center" },
  emptyText: { fontFamily: "Inter_500Medium", fontSize: 16, color: COLORS.text2, marginBottom: 4 },
  emptyHint: { fontFamily: "Inter_400Regular", fontSize: 14, color: COLORS.muted },
  fab: {
    position: "absolute",
    right: SPACING.screenPadding,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.violet,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.violet,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  menuBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  menuBox: {
    position: "absolute",
    right: SPACING.screenPadding,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 160,
    paddingVertical: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    gap: 12,
  },
  menuItemText: { fontFamily: "Inter_500Medium", fontSize: 16, color: COLORS.text },
});
