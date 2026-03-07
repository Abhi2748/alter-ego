/**
 * Journal Editor Screen §26. Full-screen Daily Journal editor.
 * Header: back + "Today's Journal" + date + Save (disabled until 2 lines). Editor, line counter, previous entries.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS, SPACING, GRADIENTS } from "../constants/theme";
import type { MainStackParamList } from "../navigation/types";

const JOURNAL_PRIVACY_KEY = "@alter_ego_journal_privacy_seen";
const JOURNAL_ENTRIES_KEY = "@alter_ego_journal_entries";
const MIN_LINES = 2;

type JournalEntry = { date: string; firstLine: string; fullText?: string };

function countLines(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  const lines = t.split(/\n/);
  return lines.length;
}

function formatJournalDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function JournalEditorScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<MainStackParamList, "JournalEditor">>();
  const { width } = useWindowDimensions();

  const viewMode = route.params?.viewMode ?? "edit";
  const entryDate = route.params?.entryDate;
  const entryText = route.params?.entryText ?? "";
  const isReadOnly = viewMode === "read";

  const [text, setText] = useState(
    isReadOnly && entryText ? entryText : ""
  );
  const [privacySeen, setPrivacySeen] = useState(true);
  const [previousEntries, setPreviousEntries] = useState<JournalEntry[]>([]);

  const lineCount = countLines(text);
  const canSave = lineCount >= MIN_LINES;
  const todayLabel = formatJournalDate(new Date());

  useEffect(() => {
    (async () => {
      const seen = await AsyncStorage.getItem(JOURNAL_PRIVACY_KEY);
      setPrivacySeen(!!seen);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(JOURNAL_ENTRIES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as JournalEntry[];
          setPreviousEntries(parsed);
        }
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    if (isReadOnly && entryText) setText(entryText);
  }, [isReadOnly, entryText]);

  const dismissPrivacy = useCallback(() => {
    setPrivacySeen(true);
    AsyncStorage.setItem(JOURNAL_PRIVACY_KEY, "1");
  }, []);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    const trimmed = text.trim();
    const firstLine = trimmed.split(/\n/)[0]?.slice(0, 60) ?? "";
    const newEntry: JournalEntry = {
      date: todayLabel,
      firstLine: firstLine + (firstLine.length >= 60 ? "…" : ""),
      fullText: trimmed,
    };
    const updated = [newEntry, ...previousEntries.filter((e) => e.date !== todayLabel)];
    setPreviousEntries(updated);
    try {
      await AsyncStorage.setItem(JOURNAL_ENTRIES_KEY, JSON.stringify(updated));
    } catch (_) {}
    navigation.navigate("MainTabs", {
      screen: "Home",
      params: { journalJustCompleted: true },
    });
  }, [canSave, text, todayLabel, previousEntries, navigation]);

  const openPreviousEntry = useCallback(
    (entry: JournalEntry) => {
      navigation.push("JournalEditor", {
        viewMode: "read",
        entryDate: entry.date,
        entryText: entry.fullText ?? "",
      });
    },
    [navigation]
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={GRADIENTS.background.colors}
        start={GRADIENTS.background.start}
        end={GRADIENTS.background.end}
        style={StyleSheet.absoluteFill}
      />

      {/* Header — dark glass */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            paddingBottom: 12,
          },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {isReadOnly ? "Journal" : "Today's Journal"}
          </Text>
          <Text style={styles.headerDate}>
            {isReadOnly && entryDate ? entryDate : todayLabel}
          </Text>
        </View>
        {!isReadOnly ? (
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          >
            <Text
              style={[
                styles.saveBtnText,
                !canSave && styles.saveBtnTextDisabled,
              ]}
            >
              Save
            </Text>
          </Pressable>
        ) : (
          <View style={styles.saveBtnPlaceholder} />
        )}
      </View>

      {!privacySeen && !isReadOnly && (
        <Pressable onPress={dismissPrivacy} style={styles.privacyNote}>
          <Text style={styles.privacyNoteText}>
            Your journal is private. Only you can see it.
          </Text>
        </Pressable>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + SPACING.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.editorWrap}>
          <TextInput
            style={[styles.input, { width: width - SPACING.screenPadding * 2 }]}
            value={text}
            onChangeText={setText}
            placeholder="Write about today..."
            placeholderTextColor={COLORS.muted}
            multiline
            editable={!isReadOnly}
            autoFocus={!isReadOnly}
            fontFamily="Inter_400Regular"
          />
          {!isReadOnly && (
            <>
              {lineCount < MIN_LINES && (
                <Text style={styles.lineCounter}>
                  {lineCount} / {MIN_LINES} lines minimum
                </Text>
              )}
            </>
          )}
        </View>

        {previousEntries.length > 0 && (
          <View style={styles.previousSection}>
            <Text style={styles.previousHeader}>PREVIOUS ENTRIES</Text>
            {previousEntries.map((entry) => (
              <Pressable
                key={entry.date}
                onPress={() => openPreviousEntry(entry)}
                style={styles.previousRow}
              >
                <Text style={styles.previousDate}>{entry.date}</Text>
                <Text style={styles.previousPreview} numberOfLines={1}>
                  {entry.firstLine}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
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
    backgroundColor: "rgba(20,24,36,0.9)",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface2,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
  headerDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  saveBtn: {
    width: 80,
    height: 36,
    backgroundColor: COLORS.violet,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: COLORS.text,
  },
  saveBtnTextDisabled: {
    color: COLORS.text2,
  },
  saveBtnPlaceholder: { width: 80, height: 36 },
  privacyNote: {
    paddingHorizontal: SPACING.screenPadding,
    paddingVertical: 8,
  },
  privacyNoteText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    fontStyle: "italic",
    color: COLORS.muted,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: 24,
  },
  editorWrap: {
    marginBottom: 8,
  },
  input: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 26,
    minHeight: 120,
    padding: 0,
    textAlignVertical: "top",
  },
  lineCounter: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: COLORS.muted,
    textAlign: "right",
    marginTop: 4,
  },
  previousSection: {
    marginTop: 24,
  },
  previousHeader: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: COLORS.muted,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  previousRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  previousDate: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: COLORS.text,
  },
  previousPreview: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 4,
  },
});
