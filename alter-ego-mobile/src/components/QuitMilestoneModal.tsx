/**
 * Quit milestone detail modal — 9 standard + Comeback + Conquered. Spec §5.
 * Stats: Clean Days / Cravings Resisted / Phase. Share via view-shot.
 */

import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  Share,
  Alert,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";
import type { QuitMilestoneOut } from "../utils/api";
import { QuitMilestoneIcon } from "./QuitMilestoneIcons";
import type { QuitPhase } from "../types/quits";
import { getPhaseLabel, getPhaseShortLabel } from "../types/quits";

type QuitTheme = {
  accent: string;
  sheetColors: readonly [string, string];
  sheetBorder: string;
  cardColors: readonly [string, string];
  cardBorder: string;
  shareColors: readonly string[];
  quoteBg: string;
  quoteBorder: string;
  quoteLeft: string;
  quoteColor: string;
  shareLabel: string;
  shareHeight: number;
  shareRadius: number;
};

const QUIT_THEMES: Record<string, QuitTheme> = {
  day_1: {
    accent: "#6366F1",
    sheetColors: ["#0F0E1E", "#0A0A18"],
    sheetBorder: "rgba(99,102,241,0.25)",
    cardColors: ["#12112A", "#0C0B1C"],
    cardBorder: "rgba(99,102,241,0.20)",
    shareColors: ["#3730A3", "#4338CA"],
    quoteBg: "rgba(67,56,202,0.10)",
    quoteBorder: "rgba(99,102,241,0.20)",
    quoteLeft: "rgba(99,102,241,0.55)",
    quoteColor: "#A5B4FC",
    shareLabel: "↗ Share this milestone",
    shareHeight: 44,
    shareRadius: 13,
  },
  day_3: {
    accent: "#8B5CF6",
    sheetColors: ["#110E22", "#0C0A1A"],
    sheetBorder: "rgba(139,92,246,0.30)",
    cardColors: ["#160F2E", "#0E0B22"],
    cardBorder: "rgba(139,92,246,0.28)",
    shareColors: ["#5B21B6", "#8B5CF6"],
    quoteBg: "rgba(10,8,22,0.60)",
    quoteBorder: "rgba(139,92,246,0.20)",
    quoteLeft: "rgba(139,92,246,0.55)",
    quoteColor: "#C4B5FD",
    shareLabel: "↗ Share this milestone",
    shareHeight: 44,
    shareRadius: 13,
  },
  day_7: {
    accent: "#F97316",
    sheetColors: ["#1A0C06", "#100806"],
    sheetBorder: "rgba(249,115,22,0.25)",
    cardColors: ["#1E0E04", "#130A04"],
    cardBorder: "rgba(249,115,22,0.25)",
    shareColors: ["#C2410C", "#F97316"],
    quoteBg: "rgba(194,65,12,0.08)",
    quoteBorder: "rgba(249,115,22,0.18)",
    quoteLeft: "rgba(249,115,22,0.55)",
    quoteColor: "#FDBA74",
    shareLabel: "↗ Share this milestone",
    shareHeight: 44,
    shareRadius: 13,
  },
  day_14: {
    accent: "#F59E0B",
    sheetColors: ["#1C1204", "#120C04"],
    sheetBorder: "rgba(245,158,11,0.30)",
    cardColors: ["#201504", "#150E03"],
    cardBorder: "rgba(245,158,11,0.32)",
    shareColors: ["#92400E", "#F59E0B"],
    quoteBg: "rgba(146,64,14,0.10)",
    quoteBorder: "rgba(245,158,11,0.18)",
    quoteLeft: "rgba(245,158,11,0.55)",
    quoteColor: "#FCD34D",
    shareLabel: "↗ Share this milestone",
    shareHeight: 44,
    shareRadius: 13,
  },
  day_30: {
    accent: "#D946EF",
    sheetColors: ["#16081A", "#0E0612"],
    sheetBorder: "rgba(217,70,239,0.30)",
    cardColors: ["#1A0820", "#100614"],
    cardBorder: "rgba(217,70,239,0.30)",
    shareColors: ["#86198F", "#D946EF"],
    quoteBg: "rgba(134,25,143,0.10)",
    quoteBorder: "rgba(217,70,239,0.18)",
    quoteLeft: "rgba(217,70,239,0.55)",
    quoteColor: "#F0ABFC",
    shareLabel: "↗ Share this milestone",
    shareHeight: 44,
    shareRadius: 13,
  },
  day_60: {
    accent: "#FBBF24",
    sheetColors: ["#1C1406", "#120E03"],
    sheetBorder: "rgba(245,158,11,0.45)",
    cardColors: ["#201508", "#160E04"],
    cardBorder: "rgba(245,158,11,0.50)",
    shareColors: ["#92400E", "#F59E0B", "#FBBF24"],
    quoteBg: "rgba(245,158,11,0.08)",
    quoteBorder: "rgba(245,158,11,0.15)",
    quoteLeft: "#FBBF24",
    quoteColor: "#FCD34D",
    shareLabel: "↗ Share this milestone",
    shareHeight: 44,
    shareRadius: 13,
  },
  day_90: {
    accent: "#FBBF24",
    sheetColors: ["#201808", "#160E04"],
    sheetBorder: "rgba(251,191,36,0.55)",
    cardColors: ["#221A0A", "#180E04"],
    cardBorder: "rgba(251,191,36,0.55)",
    shareColors: ["#78350F", "#D97706", "#FBBF24"],
    quoteBg: "rgba(245,158,11,0.10)",
    quoteBorder: "rgba(251,191,36,0.20)",
    quoteLeft: "#FBBF24",
    quoteColor: "#FCD34D",
    shareLabel: "✦ Share this milestone",
    shareHeight: 44,
    shareRadius: 13,
  },
  day_365: {
    accent: "#FBBF24",
    sheetColors: ["#201808", "#160E04"],
    sheetBorder: "rgba(251,191,36,0.55)",
    cardColors: ["#1A1000", "#100A00"],
    cardBorder: "rgba(251,191,36,0.65)",
    shareColors: ["#78350F", "#B45309", "#F59E0B", "#FBBF24"],
    quoteBg: "rgba(245,158,11,0.12)",
    quoteBorder: "rgba(251,191,36,0.25)",
    quoteLeft: "#FBBF24",
    quoteColor: "#FEF3C7",
    shareLabel: "✦ Share this milestone",
    shareHeight: 50,
    shareRadius: 14,
  },
  comeback: {
    accent: "#10B981",
    sheetColors: ["#0A1A0E", "#060E08"],
    sheetBorder: "rgba(16,185,129,0.25)",
    cardColors: ["#0A1A0E", "#060E08"],
    cardBorder: "rgba(16,185,129,0.22)",
    shareColors: ["#064E3B", "#059669", "#10B981"],
    quoteBg: "rgba(6,78,59,0.15)",
    quoteBorder: "rgba(16,185,129,0.22)",
    quoteLeft: "#10B981",
    quoteColor: "#6EE7B7",
    shareLabel: "↗ Share this milestone",
    shareHeight: 44,
    shareRadius: 13,
  },
  conquered: {
    accent: "#10B981",
    sheetColors: ["#0A100E", "#060C08"],
    sheetBorder: "rgba(16,185,129,0.40)",
    cardColors: ["#0A100E", "#060C08"],
    cardBorder: "rgba(16,185,129,0.35)",
    shareColors: ["#064E3B", "#059669", "#10B981"],
    quoteBg: "rgba(6,78,59,0.18)",
    quoteBorder: "rgba(16,185,129,0.22)",
    quoteLeft: "#10B981",
    quoteColor: "#6EE7B7",
    shareLabel: "✦ Share this milestone",
    shareHeight: 50,
    shareRadius: 14,
  },
};

const MILESTONE_LABELS: Record<string, string> = {
  day_1: "First Day",
  day_3: "Three Days",
  day_7: "One Week",
  day_14: "Two Weeks",
  day_30: "One Month",
  day_60: "Two Months",
  day_90: "Three Months",
  day_365: "One Year",
  comeback: "Comeback",
  conquered: "I'm Done With This",
};

interface QuitMilestoneModalProps {
  visible: boolean;
  milestone: QuitMilestoneOut;
  quitName: string;
  onClose: () => void;
}

export function QuitMilestoneModal({ visible, milestone, quitName, onClose }: QuitMilestoneModalProps) {
  const insets = useSafeAreaInsets();
  const viewShotRef = useRef<ViewShot>(null);
  const type = milestone.milestone_type;
  const theme = QUIT_THEMES[type] ?? QUIT_THEMES.day_1;

  const handleShare = async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (uri) {
        await Share.share({
          url: Platform.OS === "ios" ? uri : `file://${uri}`,
          message: `ALTER EGO · ${MILESTONE_LABELS[type] ?? type} · ${quitName}`,
          title: "Quit Milestone",
        });
      }
    } catch (e) {
      Alert.alert("Share", "Could not share.");
    }
  };

  if (!visible) return null;

  const brandLine =
    type === "conquered" ? "ALTER EGO · CONQUERED" : `ALTER EGO · MILESTONE ${type.toUpperCase().replace("_", " ")}`;
  const dateStr = milestone.earned_at
    ? new Date(milestone.earned_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  const isComeback = type === "comeback";
  const isConquered = type === "conquered";

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 32 }]}>
          <LinearGradient
            colors={[...theme.sheetColors]}
            style={[styles.sheetGradient, { borderColor: theme.sheetBorder }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <View style={styles.handle} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1 }} style={styles.viewShotWrap}>
                <View style={[styles.cardWrap, { borderColor: theme.cardBorder }]}>
                  <LinearGradient
                    colors={[...theme.cardColors]}
                    style={styles.cardGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                  >
                    {isConquered && (
                      <Text style={[styles.subBrand, { color: "rgba(16,185,129,0.35)" }]}>✦ I DID IT</Text>
                    )}
                    <Text style={[styles.brandLine, { color: theme.accent }]}>{brandLine}</Text>
                    <View style={[styles.iconBoxLarge, { backgroundColor: `${theme.accent}20`, borderColor: `${theme.accent}40` }]}>
                      <QuitMilestoneIcon type={type} color={theme.accent} size={28} />
                    </View>
                    <Text style={[styles.milestoneName, { color: isConquered ? "#6EE7B7" : "#E5E7EB" }]}>
                      {MILESTONE_LABELS[type] ?? type}
                    </Text>
                    <Text style={[styles.interestTrigger, { color: theme.accent }]}>
                      {quitName} {isConquered ? "· Self-declared" : `· ${milestone.clean_days_at_earn ?? 0}d clean`}
                    </Text>

                    <View style={styles.statsRow}>
                      {isComeback ? (
                        <>
                          <View style={styles.statCol}>
                            <Text style={[styles.statValue, { color: theme.accent }]}>
                              {milestone.slip_duration_hours != null ? `${Math.round(milestone.slip_duration_hours / 24)}d` : "—"}
                            </Text>
                            <Text style={styles.statLabel}>DAYS GAP</Text>
                          </View>
                          <View style={styles.statDivider} />
                          <View style={styles.statCol}>
                            <Text style={[styles.statValue, { color: theme.accent }]}>
                              {milestone.return_speed === "strong" ? "<24h" : "<48h"}
                            </Text>
                            <Text style={styles.statLabel}>RETURN</Text>
                          </View>
                          <View style={styles.statDivider} />
                          <View style={styles.statCol}>
                            <Text style={[styles.statValue, { color: theme.accent }]}>
                              {milestone.return_speed === "strong" ? "Strong" : "Good"}
                            </Text>
                            <Text style={styles.statLabel}>—</Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <View style={styles.statCol}>
                            <Text style={[styles.statValue, { color: theme.accent }]}>
                              {milestone.clean_days_at_earn ?? "—"}
                            </Text>
                            <Text style={styles.statLabel}>CLEAN DAYS</Text>
                          </View>
                          <View style={styles.statDivider} />
                          <View style={styles.statCol}>
                            <Text style={[styles.statValue, { color: theme.accent }]}>
                              {milestone.cravings_at_earn ?? "—"}
                            </Text>
                            <Text style={styles.statLabel}>CRAVINGS RESISTED</Text>
                          </View>
                          <View style={styles.statDivider} />
                          <View style={styles.statCol}>
                            <Text
                              style={[styles.statValue, styles.statValuePhase, { color: theme.accent }]}
                              numberOfLines={1}
                            >
                              {milestone.phase_at_earn ? getPhaseShortLabel(milestone.phase_at_earn as QuitPhase) : "—"}
                            </Text>
                            <Text style={styles.statLabel}>PHASE</Text>
                          </View>
                        </>
                      )}
                    </View>

                    {milestone.quote && (
                      <View
                        style={[
                          styles.quoteCard,
                          {
                            backgroundColor: theme.quoteBg,
                            borderColor: theme.quoteBorder,
                            borderLeftColor: theme.quoteLeft,
                          },
                        ]}
                      >
                        <Text style={[styles.quoteText, { color: theme.quoteColor }]}>{milestone.quote}</Text>
                      </View>
                    )}
                    <Text style={styles.dateText}>{dateStr}</Text>
                  </LinearGradient>
                </View>
              </ViewShot>

              <Pressable
                onPress={handleShare}
                style={[
                  styles.shareBtnWrap,
                  { height: theme.shareHeight, borderRadius: theme.shareRadius },
                ]}
              >
                <LinearGradient
                  colors={[...theme.shareColors]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.shareBtnText}>{theme.shareLabel}</Text>
              </Pressable>
            </ScrollView>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "flex-end", alignItems: "center" },
  sheet: { width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  sheetGradient: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, paddingTop: 20, paddingHorizontal: 20 },
  handle: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignSelf: "center",
    marginBottom: 16,
  },
  scrollContent: { paddingBottom: 24 },
  viewShotWrap: { marginBottom: 16 },
  cardWrap: { borderRadius: 20, overflow: "hidden", borderWidth: 1 },
  cardGradient: { padding: 20, borderRadius: 20 },
  subBrand: { fontSize: 10, fontWeight: "700", letterSpacing: 2, textAlign: "center", marginBottom: 4 },
  brandLine: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 4,
  },
  iconBoxLarge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  milestoneName: { fontSize: 24, fontWeight: "900", textAlign: "center", letterSpacing: -0.4, marginBottom: 4 },
  interestTrigger: { fontSize: 11, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase", textAlign: "center", marginBottom: 14 },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(42,48,80,0.30)",
    paddingTop: 12,
  },
  statCol: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "800" },
  statValuePhase: { fontSize: 12 },
  statLabel: { fontSize: 8, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", color: "#374151", marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: "rgba(42,48,80,0.40)" },
  quoteCard: {
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  quoteText: { fontSize: 12, fontStyle: "italic", lineHeight: 19 },
  dateText: { fontSize: 11, color: "#2D3146", textAlign: "center", marginTop: 12, marginBottom: 14 },
  shareBtnWrap: { overflow: "hidden", alignSelf: "stretch" },
  shareBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF", textAlign: "center", paddingVertical: 14 },
});
