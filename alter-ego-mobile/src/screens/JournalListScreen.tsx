/**
 * Journal List — Premium dark journal list with filter chips, grouped by date, FAB.
 * Spec: §2 — gradient #09091A → #07080F, atmosphere glow, chips All/Bookmarked/This month.
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import {
  getJournalEntries,
  toggleBookmark as storeToggleBookmark,
  subscribe as storeSubscribe,
  type JournalEntry,
} from "../utils/journalStore";

// Design tokens — spec §1
const BG_GRADIENT = ["#09091A", "#07080F"] as const;
const SURFACE_CARD = "#111623";
const BORDER_CARD = "#1A1F30";
const ACCENT_LEFT = "rgba(139,92,246,0.35)";
const ACCENT_LEFT_ACTIVE = "#8B5CF6";
const VIOLET = "#8B5CF6";
const VIOLET_GLOW = "#A78BFA";
const TEXT_PRIMARY = "#E5E7EB";
const TEXT_SECONDARY = "#9CA3AF";
const MUTED = "#6B7280";
const DIM = "#374151";
const VERY_DIM = "#2D3146";

function dateToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatEntryDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function previewText(content: string, maxLines = 2): string {
  const t = content.replace(/\n/g, " ").trim();
  if (!t) return "";
  const lines = t.split(/\s+/).reduce(
    (acc, word) => {
      if (acc.length === 0) return [word];
      const last = acc[acc.length - 1];
      if (last.split(" ").length < 6) acc[acc.length - 1] = last + " " + word;
      else acc.push(word);
      return acc;
    },
    [] as string[]
  );
  return lines.slice(0, maxLines).join(" ") + (lines.length > maxLines ? "…" : "");
}

function getGroupLabel(dateStr: string): string {
  const today = dateToKey(new Date());
  if (dateStr === today) return "Today";
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  if (d >= weekAgo && dateStr !== today) return "This week";
  return "Earlier";
}

type Filter = "all" | "bookmarked" | "month";

export function JournalListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [entries, setEntries] = useState<JournalEntry[]>(() => getJournalEntries());
  const [filter, setFilter] = useState<Filter>("all");
  const [menuVisible, setMenuVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setEntries(getJournalEntries());
      const unsub = storeSubscribe(() => setEntries(getJournalEntries()));
      return unsub;
    }, [])
  );

  const toggleBookmark = useCallback((id: string) => {
    storeToggleBookmark(id);
    setEntries(getJournalEntries());
  }, []);

  const filtered = useMemo(() => {
    const today = dateToKey(new Date());
    const monthStart = today.slice(0, 7); // "2026-03"
    if (filter === "bookmarked") return entries.filter((e) => e.bookmarked);
    if (filter === "month") return entries.filter((e) => e.date.startsWith(monthStart));
    return entries;
  }, [entries, filter]);

  const grouped = useMemo(() => {
    const groups: { label: string; items: JournalEntry[] }[] = [];
    let currentLabel = "";
    const sorted = [...filtered].sort((a, b) => (a.date > b.date ? -1 : 1));
    for (const e of sorted) {
      const label = getGroupLabel(e.date);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, items: [e] });
      } else groups[groups.length - 1].items.push(e);
    }
    return groups;
  }, [filtered]);

  const openEditor = (entryId: string | null, readOnly: boolean) => {
    setMenuVisible(false);
    (navigation as any).navigate("JournalEditor", { entry_id: entryId, read_only: readOnly });
  };

  const openCalendar = () => {
    setMenuVisible(false);
    (navigation as any).navigate("JournalCalendar");
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
      {/* Atmosphere glow — spec §2.1 */}
      <View style={styles.atmosphere} pointerEvents="none">
        <LinearGradient
          colors={["rgba(60,15,120,0.15)", "transparent"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

      {/* Header — spec §2.2 */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={MUTED} />
          </Pressable>
          <View style={styles.headerCenter} pointerEvents="none">
            <Text style={styles.headerTitle}>Journal</Text>
          </View>
          <Pressable
            onPress={() => setMenuVisible(true)}
            style={[styles.menuBtn, menuVisible && styles.menuBtnActive]}
            hitSlop={8}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={14}
              color={menuVisible ? VIOLET : MUTED}
            />
          </Pressable>
        </View>
      </View>

      {/* Filter chips — spec §2.3 */}
      <View style={styles.chipsRow}>
        {(["all", "bookmarked", "month"] as const).map((key) => (
          <Pressable
            key={key}
            onPress={() => setFilter(key)}
            style={[styles.chip, filter === key && styles.chipActive]}
          >
            <Text style={[styles.chipText, filter === key && styles.chipTextActive]}>
              {key === "all" ? "All entries" : key === "bookmarked" ? "Bookmarked" : "This month"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* List — spec §2.4 */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {grouped.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="journal-outline" size={48} color="#1E2333" />
            <Text style={styles.emptyTitle}>No entries yet</Text>
            <Text style={styles.emptySub}>Your thoughts belong here.</Text>
            {filter === "all" && (
              <Text style={styles.emptyPrivacy}>Your journal is private. Only you can see it.</Text>
            )}
          </View>
        ) : (
          grouped.map(({ label, items }) => (
            <View key={label}>
              <Text style={styles.groupLabel}>{label}</Text>
              {items.map((entry) => (
                <Pressable
                  key={entry.id}
                  style={({ pressed }) => [
                    styles.entryCard,
                    { borderLeftColor: entry.bookmarked ? ACCENT_LEFT_ACTIVE : ACCENT_LEFT },
                    pressed && styles.entryCardPressed,
                  ]}
                  onPress={() => openEditor(entry.id, false)}
                >
                  <View style={styles.entrySheen}>
                    <LinearGradient
                      colors={["rgba(139,92,246,0.08)", "transparent"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </View>
                  <View style={styles.entryBody}>
                    <View style={styles.entryHeaderRow}>
                      <Text style={styles.entryTitle} numberOfLines={1}>
                        {entry.title || "Untitled"}
                      </Text>
                      <Pressable
                        onPress={() => toggleBookmark(entry.id)}
                        hitSlop={8}
                        style={styles.bookmarkBtn}
                      >
                        <Ionicons
                          name={entry.bookmarked ? "bookmark" : "bookmark-outline"}
                          size={16}
                          color={entry.bookmarked ? VIOLET : VERY_DIM}
                        />
                      </Pressable>
                    </View>
                    <Text style={styles.entryPreview} numberOfLines={2} ellipsizeMode="tail">
                      {previewText(entry.content, 2) || "No content"}
                    </Text>
                    <View style={styles.entryFooter}>
                      <Text style={styles.entryDate}>{formatEntryDate(entry.date)}</Text>
                      <Text style={styles.entryWords}>{entry.word_count} words</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB — spec §2.5 */}
      <Pressable
        style={[styles.fab, { bottom: 88 }]}
        onPress={() => openEditor(null, false)}
      >
        <LinearGradient
          colors={["#5B21B6", "#8B5CF6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>

      {/* Dropdown — spec §2.6 */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuBox, { top: insets.top + 56 }]}>
            <Pressable style={styles.menuItem} onPress={openCalendar}>
              <Ionicons name="calendar-outline" size={16} color={VIOLET} />
              <Text style={styles.menuItemText}>Calendar</Text>
            </Pressable>
            <Pressable
              style={[styles.menuItem, styles.menuItemLast]}
              onPress={() => {
                setFilter("bookmarked");
                setMenuVisible(false);
              }}
            >
              <Ionicons name="bookmark-outline" size={16} color={VIOLET} />
              <Text style={styles.menuItemText}>Bookmarked only</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  atmosphere: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  header: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.35)",
    position: "relative",
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: { minWidth: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerCenter: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    letterSpacing: -0.3,
  },
  menuBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.50)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuBtnActive: {
    backgroundColor: "rgba(139,92,246,0.10)",
    borderColor: "rgba(139,92,246,0.25)",
  },
  chipsRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexShrink: 0,
  },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.40)",
  },
  chipActive: {
    backgroundColor: "rgba(139,92,246,0.15)",
    borderColor: "rgba(139,92,246,0.35)",
  },
  chipText: { fontSize: 11, fontWeight: "500", color: DIM },
  chipTextActive: { color: VIOLET_GLOW },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  groupLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: VERY_DIM,
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  entryCard: {
    backgroundColor: SURFACE_CARD,
    borderWidth: 1,
    borderColor: BORDER_CARD,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT_LEFT,
    borderRadius: 14,
    padding: 14,
    paddingBottom: 12,
    marginBottom: 8,
    position: "relative",
    overflow: "hidden",
  },
  entryCardPressed: { transform: [{ scale: 0.98 }] },
  entrySheen: {
    position: "absolute",
    top: 0,
    left: 3,
    right: 0,
    height: 1,
    backgroundColor: "transparent",
  },
  entryBody: {},
  entryHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 5,
  },
  entryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    flex: 1,
    marginRight: 8,
  },
  bookmarkBtn: { padding: 4 },
  entryPreview: {
    fontSize: 12,
    color: DIM,
    lineHeight: 18,
    marginBottom: 8,
  },
  entryFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  entryDate: { fontSize: 10, color: VERY_DIM, letterSpacing: 0.3 },
  entryWords: { fontSize: 10, color: VERY_DIM },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: TEXT_PRIMARY, marginBottom: 6 },
  emptySub: { fontSize: 13, color: MUTED },
  emptyPrivacy: {
    fontSize: 12,
    fontStyle: "italic",
    color: DIM,
    marginTop: 24,
  },
  fab: {
    position: "absolute",
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    shadowColor: "rgba(139,92,246,0.45)",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
    shadowOpacity: 1,
    elevation: 12,
  },
  fabGradient: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.20)",
    borderRadius: 26,
  },
  menuBackdrop: { flex: 1, backgroundColor: "transparent" },
  menuBox: {
    position: "absolute",
    right: 16,
    backgroundColor: "#1A1F30",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.60)",
    borderRadius: 14,
    overflow: "hidden",
    minWidth: 180,
    shadowColor: "rgba(0,0,0,0.50)",
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 },
    elevation: 24,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.40)",
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuItemText: { fontSize: 14, fontWeight: "500", color: TEXT_PRIMARY },
});
