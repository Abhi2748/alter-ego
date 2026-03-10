/**
 * Journal Editor — Standalone (FAB from Home). Calendar strip + editor.
 * On mount: fetch last 90 days entries, store by date. Calendar: current month, 36px circles;
 * days with entries highlighted (#8B5CF6 fill), today has border if no entry. Tap day → load or edit.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING } from "../constants/theme";
import { supabase } from "../utils/supabase";
import { getJournalEntries, saveJournal } from "../utils/api";

const DAY_SIZE = 36;
const CALENDAR_DAY_GAP = 8;
const HEADER_HEIGHT = 56;

function dateToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatHeaderDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function getDaysInMonth(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: Date[] = [];
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

export function JournalEditorScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const inputRef = useRef<TextInput>(null);

  const [entriesByDate, setEntriesByDate] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(() => dateToKey(new Date()));
  const [text, setText] = useState("");
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [saving, setSaving] = useState(false);

  const todayKey = dateToKey(new Date());
  const selectedHasEntry = !!entriesByDate[selectedDate];
  const canSave = !isReadOnly && text.trim().length > 0;

  const loadEntries = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await getJournalEntries(session.access_token, undefined, undefined, 90);
      const map: Record<string, string> = {};
      (res.entries || []).forEach((e) => {
        map[e.date] = e.content ?? "";
      });
      setEntriesByDate(map);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    setText(entriesByDate[selectedDate] ?? "");
    setIsReadOnly(!!entriesByDate[selectedDate]);
  }, [selectedDate, entriesByDate]);

  useEffect(() => {
    if (!isReadOnly) {
      const t = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [isReadOnly]);

  const handleDayPress = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
  }, []);

  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await saveJournal(session.access_token, { date: selectedDate, content: text.trim() });
      setEntriesByDate((prev) => ({ ...prev, [selectedDate]: text.trim() }));
      setIsReadOnly(true);
    } catch (_) {}
    setSaving(false);
  }, [canSave, saving, selectedDate, text]);

  const handleEdit = useCallback(() => {
    setIsReadOnly(false);
  }, []);

  const now = new Date();
  const monthDays = getDaysInMonth(now.getFullYear(), now.getMonth());

  return (
    <View style={[styles.container, { backgroundColor: COLORS.bg1 }]}>
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + HEADER_HEIGHT }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{formatHeaderDate(selectedDate)}</Text>
        {isReadOnly ? (
          <Pressable onPress={handleEdit} style={styles.headerBtn} hitSlop={8}>
            <Text style={styles.saveLabel}>Edit</Text>
          </Pressable>
        ) : (
          <Pressable onPress={handleSave} disabled={!canSave || saving} style={styles.headerBtn} hitSlop={8}>
            <Text style={[styles.saveLabel, !canSave && styles.saveLabelDisabled]}>Save</Text>
          </Pressable>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.calendarStrip} contentContainerStyle={styles.calendarStripContent}>
        {monthDays.map((d) => {
          const key = dateToKey(d);
          const hasEntry = !!entriesByDate[key];
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          return (
            <Pressable
              key={key}
              onPress={() => handleDayPress(key)}
              style={[
                styles.dayCircle,
                hasEntry && styles.dayCircleFilled,
                isToday && !hasEntry && styles.dayCircleTodayBorder,
                isSelected && styles.dayCircleSelected,
              ]}
            >
              <Text style={[styles.dayNum, hasEntry && styles.dayNumWhite]}>{d.getDate()}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <KeyboardAvoidingView
        style={[styles.editorWrap, { paddingBottom: insets.bottom + SPACING.xl }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Write about today..."
          placeholderTextColor={COLORS.muted}
          multiline
          editable={!isReadOnly}
          autoFocus={!isReadOnly}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBtn: {
    minWidth: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
    textAlign: "center",
  },
  saveLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.violet,
  },
  saveLabelDisabled: {
    color: COLORS.muted,
  },
  calendarStrip: {
    maxHeight: DAY_SIZE + 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  calendarStripContent: {
    paddingVertical: 12,
    paddingHorizontal: SPACING.screenPadding,
    gap: CALENDAR_DAY_GAP,
    flexDirection: "row",
    alignItems: "center",
  },
  dayCircle: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    backgroundColor: COLORS.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircleFilled: {
    backgroundColor: COLORS.violet,
  },
  dayCircleTodayBorder: {
    borderWidth: 2,
    borderColor: COLORS.violet,
  },
  dayCircleSelected: {
    borderWidth: 2,
    borderColor: COLORS.violetGlow,
  },
  dayNum: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: COLORS.text,
  },
  dayNumWhite: {
    color: "#FFFFFF",
  },
  editorWrap: {
    flex: 1,
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  input: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 26,
    minHeight: 120,
    padding: 0,
    textAlignVertical: "top",
    backgroundColor: COLORS.bg1,
  },
});
