/**
 * Settings → Contact Us. Intro, FAQs, Suggestions, Concerns, Report a Bug.
 * Shared header + gradient bg. Spec: Contact Us.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Svg, { Path, Circle } from "react-native-svg";
import { supabase } from "@/utils/supabase";
import Constants from "expo-constants";

const BG_GRADIENT = ["#09091A", "#07080F"] as const;
const SURFACE = "#111623";
const BORDER = "#1A1F30";
const GROUP_BORDER = "rgba(42,48,80,0.40)";
const VIOLET = "#8B5CF6";
const TEXT = "#E5E7EB";
const MUTED = "#6B7280";
const DIM = "#374151";
const VERY_DIM = "#2D3146";

const FAQ_URL = "https://alterego.app/faq";
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

function IconInfo() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle cx={9} cy={9} r={7} stroke={VIOLET} strokeWidth={1.3} fill="none" />
      <Path d="M9 8v4M9 6v1" stroke={VIOLET} strokeWidth={1.3} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
function IconStar() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M9 2l1.8 5.5H17l-4.2 3 1.6 5.2L9 12.2l-4.4 3.5 1.6-5.2L1 7.5h6.2L9 2z"
        stroke={VIOLET}
        strokeWidth={1.3}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
function IconBubble() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M3 3h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6l-3 3V4a1 1 0 0 1 1-1Z"
        stroke={VIOLET}
        strokeWidth={1.3}
        fill="none"
      />
    </Svg>
  );
}
function IconBug() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M9 4v2M6 6l-1.5 1.5M4 9H2M6 12l-1.5 1.5M9 14v2M12 12l1.5 1.5M14 9h2M12 6l1.5-1.5"
        stroke={VIOLET}
        strokeWidth={1.3}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={9} cy={9} r={3} stroke={VIOLET} strokeWidth={1.3} fill="none" />
    </Svg>
  );
}
function IconCheck() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path
        d="M2 7l3 3 6-6"
        stroke={VIOLET}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
        fill="none"
      />
    </Svg>
  );
}

type FeedbackSubject = "Suggestion" | "Concern" | "Bug Report";

export function ContactUsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [subject, setSubject] = useState<FeedbackSubject>("Suggestion");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const openFAQs = useCallback(() => {
    try {
      const Linking = require("expo-linking").default;
      Linking.openURL(FAQ_URL);
    } catch (_) {}
  }, []);

  const openFeedback = useCallback((subj: FeedbackSubject) => {
    setSubject(subj);
    setMessage("");
    setSheetVisible(true);
  }, []);

  const sendFeedback = useCallback(async () => {
    const trimmed = message.trim();
    if (trimmed.length < 10) {
      Alert.alert("Too short", "Enter at least 10 characters.");
      return;
    }
    setSending(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in");
      const appVersion = Constants.expoConfig?.version ?? "1.0.0";
      const res = await fetch(`${API_BASE}/api/v1/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          subject,
          message: trimmed,
          platform: Platform.OS,
          app_version: appVersion,
        }),
      });
      if (!res.ok) throw new Error("Send failed");
      setSheetVisible(false);
      Alert.alert("Sent — thank you", "We typically respond within 24 hours.");
    } catch (e) {
      Alert.alert("Couldn't send", e instanceof Error ? e.message : "Try again.");
    } finally {
      setSending(false);
    }
  }, [subject, message]);

  const isBugReport = subject === "Bug Report";
  const charCount = message.trim().length;

  return (
    <View style={styles.container}>
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        {Platform.OS === "ios" ? <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} /> : null}
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={MUTED} />
          </Pressable>
          <Text style={styles.headerTitle}>Contact Us</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          We read everything. If something's broken, unclear, or could be better — tell us.
        </Text>

        <View style={styles.groupCard}>
          <Pressable
            onPress={openFAQs}
            style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}
          >
            <View style={styles.optionIconBox}>
              <IconInfo />
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>FAQs</Text>
              <Text style={styles.optionSub}>Common questions answered</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={VERY_DIM} />
          </Pressable>
          <View style={styles.optionDivider} />
          <Pressable
            onPress={() => openFeedback("Suggestion")}
            style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}
          >
            <View style={styles.optionIconBox}>
              <IconStar />
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>Suggestions</Text>
              <Text style={styles.optionSub}>Ideas to make ALTER EGO better</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={VERY_DIM} />
          </Pressable>
          <View style={styles.optionDivider} />
          <Pressable
            onPress={() => openFeedback("Concern")}
            style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}
          >
            <View style={styles.optionIconBox}>
              <IconBubble />
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>Concerns</Text>
              <Text style={styles.optionSub}>Something doesn't feel right</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={VERY_DIM} />
          </Pressable>
          <View style={styles.optionDivider} />
          <Pressable
            onPress={() => openFeedback("Bug Report")}
            style={({ pressed }) => [styles.optionRow, styles.optionRowLast, pressed && styles.optionRowPressed]}
          >
            <View style={styles.optionIconBox}>
              <IconBug />
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>Report a Bug</Text>
              <Text style={styles.optionSub}>Something's broken — tell us</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={VERY_DIM} />
          </Pressable>
        </View>

        <View style={styles.responseNote}>
          <IconCheck />
          <Text style={styles.responseText}>We typically respond within 24 hours.</Text>
        </View>
      </ScrollView>

      <Modal visible={sheetVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.sheetBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !sending && setSheetVisible(false)} />
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + 32 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.sheetTitle}>{subject}</Text>
            <TextInput
              style={styles.sheetInput}
              value={message}
              onChangeText={setMessage}
              placeholder="Describe your feedback..."
              placeholderTextColor={VERY_DIM}
              multiline
              minHeight={120}
              textAlignVertical="top"
              editable={!sending}
            />
            {isBugReport && (
              <Text style={styles.sheetHint}>
                Device info (platform, app version) will be included automatically.
              </Text>
            )}
            <Pressable
              onPress={sendFeedback}
              disabled={charCount < 10 || sending}
              style={styles.sheetSubmitWrap}
            >
              {charCount >= 10 && !sending ? (
                <LinearGradient
                  colors={["#5B21B6", "#8B5CF6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sheetSubmitGradient}
                >
                  <Text style={styles.sheetSubmitText}>Send Feedback</Text>
                </LinearGradient>
              ) : (
                <View style={styles.sheetSubmitDisabled}>
                  <Text style={styles.sheetSubmitTextDisabled}>Send Feedback</Text>
                </View>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: "rgba(9,9,26,0.85)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.35)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    position: "relative",
    overflow: "hidden",
  },
  headerRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: TEXT },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  intro: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  groupCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    overflow: "hidden",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: GROUP_BORDER,
  },
  optionRowLast: { borderBottomWidth: 0 },
  optionRowPressed: { backgroundColor: "rgba(255,255,255,0.02)" },
  optionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "rgba(109,40,217,0.12)",
    borderWidth: 1,
    borderColor: "rgba(109,40,217,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  optionInfo: { flex: 1 },
  optionTitle: { fontSize: 14, fontWeight: "600", color: TEXT },
  optionSub: { fontSize: 11, color: "#4B5563", marginTop: 1 },
  optionDivider: {
    height: 1,
    backgroundColor: GROUP_BORDER,
    marginLeft: 16 + 36 + 12,
  },
  responseNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "rgba(139,92,246,0.05)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.10)",
    borderRadius: 12,
    marginTop: 16,
  },
  responseText: { fontSize: 11, color: "#4B5563" },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingHorizontal: 16,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: TEXT, marginBottom: 16 },
  sheetInput: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: GROUP_BORDER,
    borderRadius: 12,
    padding: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: TEXT,
    lineHeight: 22,
    minHeight: 120,
    marginBottom: 12,
  },
  sheetHint: { fontSize: 11, color: VERY_DIM, marginBottom: 12 },
  sheetSubmitWrap: { height: 52, borderRadius: 16, overflow: "hidden" },
  sheetSubmitGradient: {
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  sheetSubmitDisabled: {
    height: "100%",
    backgroundColor: "rgba(42,48,80,0.40)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
  },
  sheetSubmitTextDisabled: { fontSize: 15, fontWeight: "600", color: DIM },
  sheetSubmitText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },
});
