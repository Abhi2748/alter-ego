/**
 * Milestone detail modal — full-screen overlay, bottom sheet. Spec §3.
 * 8 milestone themes (MS01–MS08), SVG icons, quote card, share via view-shot.
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
import { BlurView } from "expo-blur";
import ViewShot from "react-native-view-shot";
import { Ionicons } from "@expo/vector-icons";
import type { MilestoneOut } from "../utils/api";
import { MilestoneIcon } from "./MilestoneIcons";

const TEXT = "#E5E7EB";
const VERY_DIM = "#2D3146";

type MilestoneTheme = {
  accent: string;
  accent2?: string;
  sheetColors: readonly [string, string];
  sheetBorder: string;
  cardColors: readonly [string, string];
  cardBorder: string;
  shareColors: readonly string[];
  quoteBg: string;
  quoteBorder: string;
  quoteLeft: string;
  quoteColor: string;
  labelSuffix?: string;
  shareLabel: string;
  shareHeight: number;
  shareRadius: number;
  shadowRadius?: number;
};

const THEMES: Record<number, MilestoneTheme> = {
  1: {
    accent: "#6366F1",
    accent2: "#4338CA",
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
  2: {
    accent: "#8B5CF6",
    accent2: "#5B21B6",
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
  3: {
    accent: "#F97316",
    accent2: "#C2410C",
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
  4: {
    accent: "#F59E0B",
    accent2: "#92400E",
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
  5: {
    accent: "#D946EF",
    accent2: "#86198F",
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
  6: {
    accent: "#FBBF24",
    accent2: "#F59E0B",
    sheetColors: ["#1C1204", "#120C04"],
    sheetBorder: "rgba(245,158,11,0.45)",
    cardColors: ["#201504", "#150E03"],
    cardBorder: "rgba(245,158,11,0.50)",
    shareColors: ["#92400E", "#F59E0B", "#FBBF24"],
    quoteBg: "rgba(245,158,11,0.08)",
    quoteBorder: "rgba(245,158,11,0.15)",
    quoteLeft: "#FBBF24",
    quoteColor: "#FCD34D",
    shareLabel: "↗ Share this milestone",
    shareHeight: 44,
    shareRadius: 13,
    shadowRadius: 16,
  },
  7: {
    accent: "#FBBF24",
    sheetColors: ["#1A1508", "#100E03"],
    sheetBorder: "rgba(251,191,36,0.55)",
    cardColors: ["#1A1508", "#100E03"],
    cardBorder: "rgba(251,191,36,0.55)",
    shareColors: ["#78350F", "#D97706", "#FBBF24"],
    quoteBg: "rgba(245,158,11,0.10)",
    quoteBorder: "rgba(251,191,36,0.20)",
    quoteLeft: "#FBBF24",
    quoteColor: "#FCD34D",
    shareLabel: "↗ Share this milestone",
    shareHeight: 44,
    shareRadius: 13,
    shadowRadius: 20,
  },
  8: {
    accent: "#FBBF24",
    sheetColors: ["#1C1200", "#120A00"],
    sheetBorder: "rgba(251,191,36,0.55)",
    cardColors: ["#1C1200", "#120A00"],
    cardBorder: "rgba(251,191,36,0.65)",
    shareColors: ["#78350F", "#B45309", "#F59E0B", "#FBBF24"],
    quoteBg: "rgba(245,158,11,0.12)",
    quoteBorder: "rgba(251,191,36,0.25)",
    quoteLeft: "#FBBF24",
    quoteColor: "#FEF3C7",
    labelSuffix: "LEGENDARY",
    shareLabel: "✦ Share this milestone",
    shareHeight: 50,
    shareRadius: 14,
    shadowRadius: 24,
  },
};

interface MilestoneDetailModalProps {
  visible: boolean;
  milestone: MilestoneOut;
  interestName: string;
  onClose: () => void;
}

export function MilestoneDetailModal({
  visible,
  milestone,
  interestName,
  onClose,
}: MilestoneDetailModalProps) {
  const insets = useSafeAreaInsets();
  const viewShotRef = useRef<ViewShot>(null);
  const num = milestone.milestone_number;
  const theme = THEMES[num] ?? THEMES[1];
  const isGold = num >= 6;

  const handleShare = async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (uri) {
        await Share.share({
          url: Platform.OS === "ios" ? uri : `file://${uri}`,
          message: `ALTER EGO · ${milestone.name} · ${interestName}`,
          title: "Milestone",
        });
      }
    } catch (e) {
      Alert.alert("Share", "Could not share.");
    }
  };

  if (!visible) return null;

  const brandLine = `ALTER EGO · MILESTONE ${String(num).padStart(2, "0")}`;
  const dateStr = milestone.earned_at
    ? new Date(milestone.earned_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        {Platform.OS === "ios" && <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 32 }]}>
          <LinearGradient
            colors={[...theme.sheetColors]}
            style={[styles.sheetGradient, { borderColor: theme.sheetBorder }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <View style={styles.handle} />
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <ViewShot
                ref={viewShotRef}
                options={{ format: "png", quality: 1 }}
                style={styles.viewShotWrap}
              >
                <View style={[styles.cardWrap, { borderColor: theme.cardBorder }]}>
                  <LinearGradient
                    colors={[...theme.cardColors]}
                    style={styles.cardGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                  >
                    <Text style={[styles.brandLine, { color: theme.accent }]}>{brandLine}</Text>
                    {theme.labelSuffix && (
                      <Text style={[styles.legendaryBadge, { color: theme.accent }]}>{theme.labelSuffix}</Text>
                    )}
                    <View style={[styles.iconBoxLarge, { backgroundColor: `${theme.accent}20`, borderColor: `${theme.accent}40` }]}>
                      <MilestoneIcon number={num} color={theme.accent} size={num === 8 ? 28 : 26} />
                    </View>
                    <Text style={[styles.milestoneName, isGold && styles.milestoneNameGold]}>
                      {milestone.name}
                    </Text>
                    <Text style={[styles.interestTrigger, { color: theme.accent }]}>
                      {interestName} · {milestone.trigger_label}
                    </Text>

                    <View style={styles.statsRow}>
                      <View style={styles.statCol}>
                        <Text style={[styles.statValue, { color: theme.accent }]}>
                          {milestone.sessions_at_earn ?? milestone.xp_total_at_earn ?? "—"}
                        </Text>
                        <Text style={styles.statLabel}>SESSIONS</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statCol}>
                        <Text style={[styles.statValue, { color: theme.accent }]}>
                          {milestone.xp_total_at_earn ?? "—"}
                        </Text>
                        <Text style={styles.statLabel}>XP TOTAL</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statCol}>
                        <Text style={[styles.statValue, { color: theme.accent }]}>
                          {milestone.tier_at_earn ?? "—"}
                        </Text>
                        <Text style={styles.statLabel}>TIER</Text>
                      </View>
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
                  {
                    height: theme.shareHeight,
                    borderRadius: theme.shareRadius,
                    shadowRadius: theme.shadowRadius ?? 12,
                  },
                ]}
              >
                <LinearGradient
                  colors={[...theme.shareColors]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.shareBtn, { borderRadius: theme.shareRadius }]}
                >
                  <Text style={styles.shareBtnText}>{theme.shareLabel}</Text>
                </LinearGradient>
              </Pressable>
            </ScrollView>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sheet: {
    width: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    maxHeight: "90%",
  },
  sheetGradient: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
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
  cardWrap: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardGradient: {
    padding: 20,
    paddingBottom: 14,
  },
  brandLine: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  legendaryBadge: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  iconBoxLarge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  milestoneName: {
    fontSize: 24,
    fontWeight: "900",
    color: TEXT,
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  milestoneNameGold: { color: "#FBBF24" },
  interestTrigger: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(42,48,80,0.30)",
    paddingTop: 12,
    marginBottom: 8,
  },
  statCol: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 8, fontWeight: "700", letterSpacing: 1, color: VERY_DIM, marginTop: 2 },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(42,48,80,0.30)",
  },
  quoteCard: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  quoteText: {
    fontStyle: "italic",
    lineHeight: 20,
    fontSize: 12,
  },
  dateText: {
    fontSize: 11,
    color: VERY_DIM,
    textAlign: "center",
    marginBottom: 14,
  },
  shareBtnWrap: {
    overflow: "hidden",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    elevation: 8,
  },
  shareBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
