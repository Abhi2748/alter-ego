/**
 * Journal Editor — Single entry: title + body. iPhone Journal style.
 * Content stored as "title\n\nbody". Date from params or today.
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING } from "../constants/theme";
import { supabase } from "../utils/supabase";
import { getJournalEntries, saveJournal } from "../utils/api";
import { getJournalBookmarks, setJournalBookmarks } from "../utils/journalBookmarks";
import type { MainStackParamList } from "../navigation/types";

function dateToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatHeaderDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function parseTitleAndBody(content: string): { title: string; body: string } {
  const idx = content.indexOf("\n\n");
  if (idx === -1) return { title: "", body: content.trim() };
  return {
    title: content.slice(0, idx).trim(),
    body: content.slice(idx + 2).trim(),
  };
}

export function JournalEditorScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<MainStackParamList, "JournalEditor">>();
  const paramDate = route.params?.date;
  const selectedDate = paramDate || dateToKey(new Date());

  const titleRef = useRef<TextInput>(null);
  const bodyRef = useRef<TextInput>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const canSave = (title.trim() || body.trim()).length > 0;

  const loadEntry = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionRes, bookmarks] = await Promise.all([
        supabase.auth.getSession(),
        getJournalBookmarks(),
      ]);
      const { data: { session } } = sessionRes;
      setIsBookmarked(bookmarks.includes(selectedDate));
      if (!session?.access_token) return;
      const res = await getJournalEntries(session.access_token, selectedDate, selectedDate, 1);
      const entry = res.entries?.[0];
      if (entry?.content) {
        const { title: t, body: b } = parseTitleAndBody(entry.content);
        setTitle(t);
        setBody(b);
      } else {
        setTitle("");
        setBody("");
      }
    } catch (_) {
      setTitle("");
      setBody("");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadEntry();
  }, [loadEntry]);

  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const content = title.trim() ? `${title.trim()}\n\n${body.trim()}` : body.trim();
      await saveJournal(session.access_token, { date: selectedDate, content });
      navigation.goBack();
    } catch (_) {}
    setSaving(false);
  }, [canSave, saving, selectedDate, title, body, navigation]);

  const toggleBookmark = useCallback(async () => {
    const bookmarks = await getJournalBookmarks();
    const set = new Set(bookmarks);
    if (set.has(selectedDate)) set.delete(selectedDate);
    else set.add(selectedDate);
    const next = Array.from(set);
    await setJournalBookmarks(next);
    setIsBookmarked(next.includes(selectedDate));
  }, [selectedDate]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.bg1, COLORS.bg0]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 56 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerDate} numberOfLines={1}>{formatHeaderDate(selectedDate)}</Text>
        <View style={styles.headerRight}>
          <Pressable onPress={toggleBookmark} style={styles.headerBtn} hitSlop={12}>
            <Ionicons
              name={isBookmarked ? "bookmark" : "bookmark-outline"}
              size={22}
              color={isBookmarked ? COLORS.violet : COLORS.text}
            />
          </Pressable>
          <Pressable onPress={handleSave} disabled={!canSave || saving} style={styles.headerBtn} hitSlop={12}>
            <Text style={[styles.saveLabel, (!canSave || saving) && styles.saveLabelDisabled]}>Save</Text>
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TextInput
            ref={titleRef}
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor={COLORS.muted}
            editable={!loading}
          />
          <View style={styles.titleBodyDivider} />
          <TextInput
            ref={bodyRef}
            style={styles.bodyInput}
            value={body}
            onChangeText={setBody}
            placeholder="What's on your mind?"
            placeholderTextColor={COLORS.muted}
            multiline
            editable={!loading}
          />
        </ScrollView>
      </KeyboardAvoidingView>
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
  headerRight: { flexDirection: "row", alignItems: "center" },
  headerDate: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: COLORS.text,
    textAlign: "center",
    marginHorizontal: SPACING.sm,
  },
  saveLabel: { fontFamily: "Inter_500Medium", fontSize: 16, color: COLORS.violet },
  saveLabelDisabled: { color: COLORS.muted },
  keyboard: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  titleInput: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 22,
    color: COLORS.text,
    paddingVertical: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  titleBodyDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  bodyInput: {
    fontFamily: "Inter_400Regular",
    fontSize: 17,
    color: COLORS.text,
    lineHeight: 26,
    minHeight: 260,
    padding: 0,
    textAlignVertical: "top",
  },
});
