/**
 * Journal Editor — Full-screen editor with large title + body. Spec §3.
 * Params: entry_id (string | null), read_only (boolean).
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import type { MainStackParamList } from "../navigation/types";
import {
  getJournalEntry,
  createOrUpdateEntry,
  toggleBookmark as storeToggleBookmark,
  type JournalEntry,
} from "../utils/journalStore";

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

function lineCount(text: string): number {
  const lines = text.split(/\n/).filter((l) => l.trim().length > 0);
  if (lines.length > 0) return lines.length;
  return text.trim().length > 0 ? 1 : 0;
}

export function JournalEditorScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<MainStackParamList, "JournalEditor">>();
  const { entry_id, read_only } = route.params ?? { entry_id: null as string | null, read_only: false };

  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [bookmarked, setBookmarked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const bodyRef = useRef<TextInput>(null);

  const dateStr = entry?.date ?? dateToKey(new Date());
  const wordCount = countWords(title + " " + content);
  const bodyLines = lineCount(content);
  const canSave = !read_only && (title.trim().length > 0 || content.trim().length > 0) && bodyLines >= 2;

  useEffect(() => {
    if (entry_id) {
      const e = getJournalEntry(entry_id);
      if (e) {
        setEntry(e);
        setTitle(e.title || "");
        setContent(e.content || "");
        setBookmarked(e.bookmarked);
      } else {
        setEntry(null);
        setTitle("");
        setContent("");
        setBookmarked(false);
      }
    } else {
      setEntry(null);
      setTitle("");
      setContent("");
      setBookmarked(false);
    }
  }, [entry_id]);

  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setSaveStatus("idle");
    try {
      createOrUpdateEntry(entry_id, dateStr, title.trim(), content.trim(), bookmarked);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
      navigation.goBack();
    } catch {
      setSaveStatus("error");
      Alert.alert("Couldn't save", "Try again.");
    } finally {
      setSaving(false);
    }
  }, [canSave, saving, entry_id, dateStr, title, content, bookmarked, navigation]);

  const toggleBookmark = useCallback(() => {
    if (entry_id) {
      storeToggleBookmark(entry_id);
      setBookmarked((prev) => !prev);
    } else {
      setBookmarked((prev) => !prev);
    }
  }, [entry_id]);

  const todayKey = dateToKey(new Date());
  const headerTitle =
    entry && entry.date !== todayKey ? formatHeaderDate(entry.date) : "Today's Journal";
  const headerDateStr = formatHeaderDate(dateStr);

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
            <Pressable onPress={toggleBookmark} style={styles.headerBtn} hitSlop={8}>
              <Ionicons name={bookmarked ? "bookmark" : "bookmark-outline"} size={18} color={bookmarked ? VIOLET : DIM} />
            </Pressable>
            {!read_only && (
              <Pressable
                onPress={handleSave}
                disabled={!canSave}
                style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
              >
                <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>Save</Text>
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
                ref={bodyRef}
                style={styles.bodyInput}
                value={content}
                onChangeText={setContent}
                placeholder="Write about today..."
                placeholderTextColor={VERY_DIM}
                multiline
                textAlignVertical="top"
                scrollEnabled={false}
              />
              {bodyLines < 2 && (
                <Text style={styles.minLines}>{bodyLines} / 2 lines minimum</Text>
              )}
              <Text style={styles.wordCount}>{wordCount} words</Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      {saveStatus === "saved" && (
        <View style={[styles.statusWrap, { top: insets.top + 50 }]}>
          <Text style={styles.statusText}>Saved ✓</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  statusWrap: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(20,24,36,0.9)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statusText: { fontSize: 13, color: VIOLET, fontWeight: "600" },
});
