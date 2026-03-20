/**
 * Settings → Tone History. Tones you've rated, progress bars, current blend.
 * Shared header + gradient bg. Spec: Tone History.
 */

import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Pressable } from "react-native";
import { useUserStore } from "@/store/userStore";

const BG_GRADIENT = ["#09091A", "#07080F"] as const;
const SURFACE = "#111623";
const BORDER = "#1A1F30";
const VIOLET = "#8B5CF6";
const VIOLET_DEEP = "#5B21B6";
const VIOLET_GLOW = "#A78BFA";
const TEXT = "#E5E7EB";
const MUTED = "#6B7280";
const DIM = "#374151";
const VERY_DIM = "#2D3146";

export interface ToneRating {
  tone_id: string;
  tone_name: string;
  tone_emoji: string;
  rating: "positive" | "neutral" | "negative";
  count: number;
  percentage: number;
}

export interface ToneHistoryData {
  ratings: ToneRating[];
  total_ratings: number;
  current_blend: string[];
}

function toneLabelFromKey(key: string): { name: string; emoji: string } {
  const k = key.toLowerCase();
  if (k === "philosopher") return { name: "Philosopher", emoji: "◇" };
  if (k === "silent_force" || k === "silent force") return { name: "Silent Force", emoji: "◆" };
  return { name: "Rival", emoji: "✦" };
}

function getRatingLabel(rating: ToneRating["rating"]) {
  if (rating === "positive") return "Rated 👍";
  if (rating === "neutral") return "Rated —";
  return "Rated 👎";
}

function ToneRow({ item, total }: { item: ToneRating; total: number }) {
  const fillPct = total > 0 ? (item.count / total) * 100 : 0;
  const isPositive = item.rating === "positive";
  const isNegative = item.rating === "negative";
  const accentColor = item.rating === "negative" ? "#7F1D1D" : VIOLET;
  const trackColor = "rgba(30,35,51,0.90)";

  return (
    <View style={styles.toneRow}>
      <View style={[styles.toneIconBox, { backgroundColor: `${accentColor}20`, borderColor: `${accentColor}30` }]}>
        <Text style={styles.toneEmoji}>{item.tone_emoji}</Text>
      </View>
      <View style={styles.toneInfo}>
        <Text style={styles.toneName}>{item.tone_name}</Text>
        <Text style={styles.toneCount}>
          {getRatingLabel(item.rating)} · {item.count} times
        </Text>
      </View>
      <View style={styles.progressCol}>
        <View style={[styles.progressTrack, { backgroundColor: trackColor }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${fillPct}%`,
                backgroundColor: isPositive ? undefined : isNegative ? "#7F1D1D" : DIM,
              },
            ]}
          >
            {isPositive && (
              <LinearGradient
                colors={[VIOLET_DEEP, VIOLET]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            )}
          </View>
        </View>
        <Text
          style={[
            styles.progressPct,
            isPositive && styles.progressPctPositive,
            (isNegative || item.rating === "neutral") && styles.progressPctDim,
          ]}
        >
          {item.percentage}%
        </Text>
      </View>
    </View>
  );
}

export function ToneHistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const profile = useUserStore((s) => s.profile);

  const data = useMemo((): ToneHistoryData => {
    const toneKey = (profile?.twin_tone_type ?? "rival").toLowerCase();
    const { name, emoji } = toneLabelFromKey(toneKey);
    const intensity = profile?.twin_intensity ?? 3;
    return {
      ratings: [],
      total_ratings: 0,
      current_blend: [name, `Intensity ${intensity}/5`],
    };
  }, [profile?.twin_tone_type, profile?.twin_intensity]);

  const total = data.total_ratings;
  const positiveRatings = data.ratings.filter((r) => r.rating === "positive").sort((a, b) => b.count - a.count);
  const currentBlend = data.current_blend.length >= 2 ? data.current_blend : positiveRatings.slice(0, 2).map((r) => r.tone_name);
  const topPositive = currentBlend[0];
  const secondTone = currentBlend[1];
  const hasEnoughRatings = total >= 5;
  const empty = data.ratings.length === 0 || data.ratings.every((r) => r.count === 0);

  return (
    <View style={styles.container}>
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        {Platform.OS === "ios" ? <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} /> : null}
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={MUTED} />
          </Pressable>
          <Text style={styles.headerTitle}>Tone History</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.explanationCard}>
          <Text style={styles.explanationText}>
            Your Twin voice is set from your archetype and recalibrates as you use the app. Per-response ratings will
            appear here when that feedback loop ships.
          </Text>
        </View>

        <View style={[styles.explanationCard, { marginBottom: 20, borderColor: "rgba(139,92,246,0.22)" }]}>
          <Text style={[styles.sectionLabel, { marginBottom: 6, color: VIOLET_GLOW }]}>CURRENT VOICE</Text>
          <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT }}>
            {topPositive ?? "Twin"}
          </Text>
          <Text style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{secondTone ?? ""}</Text>
        </View>

        {empty ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="chatbubble-ellipses-outline" size={48} color="#1E2333" />
            <Text style={styles.emptyTitle}>No rating history yet</Text>
            <Text style={styles.emptySub}>
              Pull to refresh your profile after onboarding — tone and intensity come from your live Twin settings.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>YOU RESPONDED POSITIVELY TO</Text>
            {data.ratings
              .filter((r) => r.rating === "positive" && r.count > 0)
              .map((r) => (
                <ToneRow key={r.tone_id} item={r} total={total} />
              ))}

            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>YOU RESPONDED NEUTRALLY TO</Text>
            {data.ratings
              .filter((r) => r.rating === "neutral" && r.count > 0)
              .map((r) => (
                <ToneRow key={r.tone_id} item={r} total={total} />
              ))}

            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>YOU RESPONDED NEGATIVELY TO</Text>
            {data.ratings
              .filter((r) => r.rating === "negative" && r.count > 0)
              .map((r) => (
                <ToneRow key={r.tone_id} item={r} total={total} />
              ))}

            <View style={styles.blendCard}>
              {hasEnoughRatings && topPositive && secondTone ? (
                <Text style={styles.blendText}>
                  Your Twin is currently blending{" "}
                  <Text style={styles.blendHighlight}>{topPositive}</Text> with{" "}
                  <Text style={styles.blendHighlight}>{secondTone}</Text>. Keep rating to sharpen its voice.
                </Text>
              ) : (
                <Text style={styles.blendTextItalic}>
                  Voice blend refines every few weeks from how you show up — not from mock data.
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
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
  explanationCard: {
    backgroundColor: "rgba(139,92,246,0.06)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.12)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  explanationText: { fontSize: 12, color: MUTED, lineHeight: 19 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: DIM,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionLabelSpaced: { marginTop: 16 },
  toneRow: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toneIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  toneEmoji: { fontSize: 20 },
  toneInfo: { flex: 1 },
  toneName: { fontSize: 14, fontWeight: "600", color: TEXT },
  toneCount: { fontSize: 11, color: "#4B5563", marginTop: 2 },
  progressCol: { width: 60, flexShrink: 0 },
  progressTrack: {
    height: 4,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressPct: { fontSize: 10, textAlign: "right", marginTop: 3, color: MUTED },
  progressPctPositive: { color: MUTED },
  progressPctDim: { color: VERY_DIM },
  blendCard: {
    marginTop: 16,
    backgroundColor: "rgba(139,92,246,0.05)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.10)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  blendText: { fontSize: 12, color: MUTED, lineHeight: 19 },
  blendHighlight: { color: VIOLET_GLOW, fontWeight: "600" },
  blendTextItalic: { fontSize: 12, color: DIM, fontStyle: "italic", lineHeight: 19 },
  emptyWrap: { padding: 32, alignItems: "center" },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: TEXT, marginBottom: 6 },
  emptySub: { fontSize: 13, color: MUTED },
});
