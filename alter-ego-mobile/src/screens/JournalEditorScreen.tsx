/**
 * Journal Editor — loads/saves via API. Mission completes when entry meets length rules (server + client aligned).
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import type { MainStackParamList } from "../navigation/types";
import { useTodayMissions } from "@/hooks/useMissions";
import { useJournalEntry, useSaveJournal } from "@/hooks/useJournal";
import {
  combinedJournalText,
  effectiveLineCount,
  journalMeetsSaveMinimum,
} from "@/utils/journalValidation";
import { getErrorMessage } from "@/services/api";

const BG_GRADIENT = ["#09091A", "#07080F"] as const;
const TEXT_PRIMARY = "#E5E7EB";
const MUTED = "#6B7280";
const DIM = "#374151";
const VERY_DIM = "#2D3146";
const VIOLET = "#8B5CF6";

function dateToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatHeaderDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function JournalEditorScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<MainStackParamList, "JournalEditor">>();
  const { entry_id, read_only, mission_date: routeMissionDate } = route.params ?? {
    entry_id: null as string | null,
    read_only: false,
  };

  const { data: todayData } = useTodayMissions();
  const calendarDate =
    routeMissionDate ?? todayData?.date ?? dateToKey(new Date());

  const {
    data: remoteEntry,
    isLoading: loadingEntry,
    isError: loadError,
    refetch: refetchEntry,
  } = useJournalEntry(entry_id);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [bookmarked, setBookmarked] = useState(false);
  const { mutateAsync: saveJournal, isPending: saving } = useSaveJournal();

  const dateStr = remoteEntry?.date ?? calendarDate;
  const combined = useMemo(() => combinedJournalText(title, content), [title, content]);
  const effectiveLines = useMemo(() => effectiveLineCount(combined), [combined]);
  const wordCount = useMemo(() => countWords(combined), [combined]);
  const canSave =
    !read_only && journalMeetsSaveMinimum(title, content) && !saving;

  useEffect(() => {
    if (!entry_id) {
      setTitle("");
      setContent("");
      setBookmarked(false);
    }
  }, [entry_id, calendarDate]);

  useEffect(() => {
    if (entry_id && remoteEntry) {
      setTitle(remoteEntry.title ?? "");
      setContent(remoteEntry.content ?? "");
      setBookmarked(!!remoteEntry.bookmarked);
    }
  }, [entry_id, remoteEntry]);

  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;
    try {
      await saveJournal({
        content: content.trim(),
        date: dateStr,
        title: title.trim(),
        bookmarked,
      });
      // useSaveJournal invalidates today's missions — Home updates when you return.
      navigation.goBack();
    } catch (e) {
      Alert.alert("Couldn't save", getErrorMessage(e));
    }
  }, [canSave, saving, saveJournal, content, dateStr, title, bookmarked, navigation]);

  const toggleBookmark = useCallback(() => {
    if (read_only) return;
    setBookmarked((prev) => !prev);
  }, [read_only]);

  const todayKey = dateToKey(new Date());
  const headerTitle = dateStr === todayKey ? "Today's Journal" : formatHeaderDate(dateStr);
  const headerDateStr = formatHeaderDate(dateStr);

  if (entry_id && loadingEntry) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <ActivityIndicator color={VIOLET} />
          <Text style={styles.loadHint}>Loading entry…</Text>
        </View>
      </View>
    );
  }

  if (entry_id && loadError) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
        <View style={[styles.centered, { paddingTop: insets.top, paddingHorizontal: 24 }]}>
          <Text style={styles.errorTitle}>Couldn't load journal</Text>
          <Pressable onPress={() => refetchEntry()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
          <Pressable onPress={() => navigation.goBack()} style={styles.retryBtn}>
            <Text style={[styles.retryBtnText, { color: MUTED }]}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        {Platform.OS === "ios" ? <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} /> : null}
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={MUTED} />
          </Pressable>
          <View style={styles.headerCenter} pointerEvents="none">
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <Text style={styles.headerDate}>{headerDateStr}</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable onPress={toggleBookmark} style={styles.headerBtn} hitSlop={8} disabled={read_only}>
              <Ionicons name={bookmarked ? "bookmark" : "bookmark-outline"} size={18} color={bookmarked ? VIOLET : DIM} />
            </Pressable>
            {!read_only && (
              <Pressable
                onPress={handleSave}
                disabled={!canSave}
                style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
              >
                <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>
                  {saving ? "…" : "Save"}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 80 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {read_only ? (
            <>
              <Text style={styles.titleReadOnly}>{title || "Untitled"}</Text>
              <View style={styles.divider} />
              <Text style={styles.bodyReadOnly}>{content || ""}</Text>
            </>
          ) : (
            <>
              <TextInput
                style={styles.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Title"
                placeholderTextColor="#1F2937"
                maxLength={120}
                autoFocus={!entry_id}
              />
              <View style={styles.divider} />
              <TextInput
                style={styles.bodyInput}
                value={content}
                onChangeText={setContent}
                placeholder="Write about today..."
                placeholderTextColor={VERY_DIM}
                multiline
                textAlignVertical="top"
                scrollEnabled={false}
              />
              {!journalMeetsSaveMinimum(title, content) && (title.trim().length > 0 || content.trim().length > 0) ? (
                <Text style={styles.minLines}>
                  {effectiveLines} / 2 lines · {wordCount} / 5 words minimum (wrapped text counts as multiple lines)
                </Text>
              ) : null}
              <Text style={styles.wordCount}>{wordCount} words</Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  loadHint: { fontSize: 14, color: MUTED, marginTop: 8 },
  errorTitle: { fontSize: 16, color: TEXT_PRIMARY, textAlign: "center", marginBottom: 8 },
  retryBtn: { paddingVertical: 12, paddingHorizontal: 20 },
  retryBtnText: { fontSize: 15, fontWeight: "600", color: VIOLET },
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
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  headerBtn: { minWidth: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerCenter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 12,
    alignItems: "center",
  },
  headerTitle: { fontSize: 15, fontWeight: "700", color: TEXT_PRIMARY },
  headerDate: { fontSize: 11, color: DIM, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  saveBtn: {
    height: 32,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: "rgba(139,92,246,0.15)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.30)",
  },
  saveBtnDisabled: {
    backgroundColor: "transparent",
    borderColor: "rgba(42,48,80,0.30)",
  },
  saveBtnText: { fontSize: 13, fontWeight: "600", color: VIOLET },
  saveBtnTextDisabled: { color: DIM },
  keyboard: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  titleInput: {
    fontSize: 26,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    letterSpacing: -0.5,
    lineHeight: 34,
    padding: 0,
    marginBottom: 14,
  },
  titleReadOnly: {
    fontSize: 26,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: 14,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(42,48,80,0.35)",
    marginBottom: 18,
  },
  bodyInput: {
    fontSize: 16,
    fontWeight: "400",
    color: TEXT_PRIMARY,
    lineHeight: 27,
    letterSpacing: 0.1,
    minHeight: 200,
    padding: 0,
  },
  bodyReadOnly: {
    fontSize: 16,
    fontWeight: "400",
    color: TEXT_PRIMARY,
    lineHeight: 27,
    letterSpacing: 0.1,
  },
  minLines: { fontSize: 10, color: VERY_DIM, textAlign: "right", marginTop: 4 },
  wordCount: { fontSize: 10, color: VERY_DIM, textAlign: "right", marginTop: 4 },
});
