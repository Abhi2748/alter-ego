/**
 * QuitDetailScreen — Trigger breakdown, urge trend, manage actions.
 */
import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { QuitTarget } from "@/types/quits";
import { PHASE_CONFIG } from "@/types/quits";
import { QUIT_ORANGE } from "@/constants/missionColors";

/** Urge health: declining urges = good (green), not discipline violet */
const URGE_DECLINING = "#4ADE80";
const URGE_INCREASING = "#F87171";

interface Props {
  visible: boolean;
  target: QuitTarget | null;
  onClose: () => void;
  onAdvancePhase: () => void;
  onUpdateTriggers: () => void;
  onDelete: () => void;
  onLogSlip: () => void;
  onInsightPress?: (title: string, body: string) => void;
  advancing?: boolean;
}

export function QuitDetailScreen({
  visible,
  target,
  onClose,
  onAdvancePhase,
  onUpdateTriggers,
  onDelete,
  onLogSlip,
  onInsightPress,
  advancing,
}: Props) {
  const insets = useSafeAreaInsets();
  if (!visible || !target) return null;

  const cfg = PHASE_CONFIG[target.current_phase];
  const urgeTrend = target.urge_trend || [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient colors={["#0D0906", "#060301"]} style={StyleSheet.absoluteFill} />

        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.headerBack} hitSlop={12}>
            <Ionicons name="chevron-down" size={22} color="#6B7280" />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerName}>{target.habit_name}</Text>
            <Text style={styles.headerSub}>
              {cfg.name} · Day {target.days_active}
            </Text>
          </View>
          <View style={styles.headerDays}>
            <Text style={styles.headerDaysNum}>{target.days_active}</Text>
            <Text style={styles.headerDaysLbl}>days</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {target.top_triggers && target.top_triggers.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {target.has_checkin_data ? "Trigger Frequency · Last 30 days" : "Trigger Profile"}
              </Text>
              {target.top_triggers.map((t, i) => {
                const maxCount = Math.max(...target.top_triggers!.map((x) => x.count), 1);
                const barPct = t.count > 0 ? Math.max(0.15, t.count / maxCount) : 0.1;
                return (
                  <View key={t.tag} style={styles.trigRow}>
                    <Text style={styles.trigName}>{t.tag}</Text>
                    <View style={styles.trigTrack}>
                      <View
                        style={[
                          styles.trigFill,
                          { width: `${Math.round(barPct * 100)}%`, opacity: 0.6 - i * 0.1 },
                        ]}
                      />
                    </View>
                    {t.count > 0 ? <Text style={styles.trigCount}>{t.count}</Text> : null}
                  </View>
                );
              })}
              {!target.has_checkin_data ? (
                <Text style={styles.noDataNote}>Log a slip context to build your live trigger profile</Text>
              ) : null}
            </View>
          ) : null}

          {urgeTrend.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Weekly Urge Trend</Text>
              <View style={styles.trendChart}>
                {urgeTrend.map((u, i) => {
                  const isNow = i === urgeTrend.length - 1;
                  const barH = Math.max(8, (u.level / 5) * 56);
                  return (
                    <View key={i} style={styles.tCol}>
                      <View
                        style={[
                          styles.tBar,
                          {
                            height: barH,
                            backgroundColor: isNow ? QUIT_ORANGE.primary : "rgba(249,115,22,0.38)",
                            shadowColor: isNow ? "rgba(249,115,22,0.5)" : "transparent",
                            shadowOpacity: isNow ? 1 : 0,
                            shadowRadius: isNow ? 8 : 0,
                            elevation: isNow ? 3 : 0,
                          },
                        ]}
                      />
                      <Text style={[styles.tLbl, isNow && styles.tLblNow]}>{u.week_label}</Text>
                    </View>
                  );
                })}
              </View>
              {urgeTrend.length >= 2
                ? (() => {
                    const delta = urgeTrend[0].level - urgeTrend[urgeTrend.length - 1].level;
                    if (delta > 0.5) {
                      return (
                        <View style={styles.verdictRow}>
                          <Text style={[styles.verdictArrow, { color: URGE_DECLINING }]}>↓</Text>
                          <Text style={[styles.verdictText, { color: URGE_DECLINING }]}>Declining</Text>
                          <Text style={styles.verdictSub}> — getting easier over time</Text>
                        </View>
                      );
                    }
                    if (delta < -0.5) {
                      return (
                        <View style={styles.verdictRow}>
                          <Text style={[styles.verdictArrow, { color: URGE_INCREASING }]}>↑</Text>
                          <Text style={[styles.verdictText, { color: URGE_INCREASING }]}>Increasing</Text>
                          <Text style={styles.verdictSub}> — check in with your triggers</Text>
                        </View>
                      );
                    }
                    return (
                      <View style={styles.verdictRow}>
                        <Text style={styles.verdictArrow}>→</Text>
                        <Text style={styles.verdictText}>Stable</Text>
                      </View>
                    );
                  })()
                : null}
            </View>
          ) : null}

          {target.insights.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Insights</Text>
              <View style={styles.insightChips}>
                {target.insights.map((ins) => (
                  <Pressable
                    key={ins.title + ins.unlocked_at}
                    style={styles.insightChip}
                    onPress={() => onInsightPress?.(ins.title, ins.body)}
                  >
                    <Text style={styles.insightChipTxt} numberOfLines={1}>
                      💡 {ins.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.actionsSection}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.actRow}>
              <Pressable style={[styles.actBtn, styles.actPrimary]} onPress={onLogSlip}>
                <Text style={styles.actIcon}>🔥</Text>
                <Text style={styles.actPrimaryText}>Log a slip</Text>
              </Pressable>
              <Pressable
                style={[styles.actBtn, styles.actAmber]}
                onPress={onAdvancePhase}
                disabled={advancing}
              >
                <Text style={styles.actAmberText}>Advance phase →</Text>
              </Pressable>
            </View>
            <View style={[styles.actRow, { marginTop: 8 }]}>
              <Pressable style={[styles.actBtn, styles.actGhost]} onPress={onUpdateTriggers}>
                <Text style={styles.actGhostText}>Update triggers</Text>
              </Pressable>
              <Pressable style={[styles.actBtn, styles.actDanger]} onPress={onDelete}>
                <Text style={styles.actDangerText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(249,115,22,0.07)",
    backgroundColor: "rgba(8,5,2,0.9)",
  },
  headerBack: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1 },
  headerName: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 18,
    fontWeight: "800",
    color: "#E5E7EB",
  },
  headerSub: {
    fontSize: 9,
    color: "rgba(249,115,22,0.4)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  headerDays: { alignItems: "flex-end" },
  headerDaysNum: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 32,
    fontWeight: "900",
    color: "rgba(249,115,22,0.6)",
    lineHeight: 34,
    letterSpacing: -1,
  },
  headerDaysLbl: {
    fontSize: 7,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "rgba(249,115,22,0.3)",
    fontFamily: "Inter_600SemiBold",
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },
  section: {
    backgroundColor: "rgba(14,8,4,0.9)",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.1)",
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(249,115,22,0.3)",
    fontFamily: "Inter_700Bold",
    marginBottom: 14,
  },
  trigRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 9 },
  trigName: {
    fontSize: 11,
    fontWeight: "500",
    color: "#9CA3AF",
    minWidth: 72,
    fontFamily: "Inter_500Medium",
  },
  trigTrack: {
    flex: 1,
    height: 5,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 5,
    overflow: "hidden",
  },
  trigFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: QUIT_ORANGE.primary,
  },
  trigCount: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    fontWeight: "700",
    color: "rgba(251,146,60,0.8)",
    minWidth: 16,
    textAlign: "right",
  },
  noDataNote: {
    fontSize: 10,
    color: "rgba(249,115,22,0.25)",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 4,
    fontFamily: "Inter_400Regular",
  },
  trendChart: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
    height: 64,
    marginBottom: 10,
  },
  tCol: { flex: 1, alignItems: "center", gap: 4 },
  tBar: { width: "100%", borderRadius: 4 },
  tLbl: {
    fontSize: 8,
    color: "#374151",
    fontFamily: "Inter_500Medium",
  },
  tLblNow: { color: "rgba(249,115,22,0.6)" },
  verdictRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  verdictArrow: { fontSize: 18, color: "#9CA3AF" },
  verdictText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    fontFamily: "Inter_600SemiBold",
  },
  verdictSub: {
    fontSize: 10,
    color: "#374151",
    fontFamily: "Inter_400Regular",
  },
  insightChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  insightChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(249,115,22,0.08)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.2)",
    maxWidth: "100%",
  },
  insightChipTxt: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#9CA3AF",
  },
  actionsSection: { marginTop: 4 },
  actRow: { flexDirection: "row", gap: 8 },
  actBtn: {
    flex: 1,
    height: 42,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actPrimary: {
    backgroundColor: "rgba(234,88,12,0.9)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.3)",
    shadowColor: "rgba(249,115,22,0.3)",
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  actIcon: { fontSize: 14 },
  actPrimaryText: { fontSize: 11, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold" },
  actAmber: {
    backgroundColor: "rgba(245,158,11,0.08)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.22)",
  },
  actAmberText: { fontSize: 11, fontWeight: "700", color: "#FCD34D", fontFamily: "Inter_700Bold" },
  actGhost: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.35)",
  },
  actGhostText: { fontSize: 11, fontWeight: "600", color: "#4B5563", fontFamily: "Inter_600SemiBold" },
  actDanger: {
    backgroundColor: "rgba(127,29,29,0.07)",
    borderWidth: 1,
    borderColor: "rgba(127,29,29,0.2)",
  },
  actDangerText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(239,68,68,0.4)",
    fontFamily: "Inter_600SemiBold",
  },
});
