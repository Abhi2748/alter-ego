import React from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { QuitTarget } from "@/types/quits";
import { QUIT_ORANGE } from "@/constants/missionColors";

/** Positive trend copy — violet (no green in app palette). */
const URGE_EASING = "#A78BFA";

interface QuitDetailScreenProps {
  visible: boolean;
  target: QuitTarget | null;
  onClose: () => void;
  onInsightPress: (title: string, body: string) => void;
  onLogSlip: () => void;
  onAdvancePhase: () => void;
  onUpdateTriggers: () => void;
  onDelete: () => void;
  advancing: boolean;
}

function displayTag(raw: string): string {
  const s = raw.replace(/_/g, " ");
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function QuitDetailScreen({
  visible,
  target,
  onClose,
  onInsightPress,
  onLogSlip,
  onAdvancePhase,
  onUpdateTriggers,
  onDelete,
  advancing,
}: QuitDetailScreenProps) {
  const insets = useSafeAreaInsets();

  if (!visible || !target) return null;

  const phase = target.current_phase;
  const phaseLabels: Record<string, string> = {
    mapping: "Mapping",
    disruption: "Disruption",
    consolidation: "Consolidation",
  };
  const phaseDesc: Record<string, string> = {
    mapping: "Understanding when and why this urge appears.",
    disruption: "Actively replacing the habit with competing responses.",
    consolidation: "Solidifying the new pattern. The habit is losing its grip.",
  };

  const topTriggers = target.top_triggers?.length
    ? target.top_triggers
    : (target.trigger_profile.contexts || []).map((c) => ({ tag: c, count: 0 }));

  const maxTriggerCount = Math.max(...topTriggers.map((t) => t.count), 1);

  const urgeTrend = target.urge_trend || [];
  const maxUrge = Math.max(...urgeTrend.map((u) => u.level), 1);

  const isConquered = target.status === "completed";
  const canAdvance = target.status === "active" && phase !== "consolidation";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <LinearGradient colors={["#0D0906", "#060301"]} style={StyleSheet.absoluteFill} />

        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color="#6B7280" />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerName} numberOfLines={1}>
              {target.habit_name}
            </Text>
            <Text style={styles.headerSub}>
              {isConquered
                ? "✓ CONQUERED"
                : `${phaseLabels[phase] ?? phase} · Day ${target.days_active}`}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <Text style={styles.ghostNum}>{target.days_active}</Text>
            <View style={styles.heroInner}>
              <View style={styles.dayRow}>
                <Text style={styles.dayNum}>{target.days_active}</Text>
                <Text style={styles.dayUnit}>days</Text>
              </View>
              <View style={styles.phasePill}>
                <Text style={styles.phasePillText}>{phaseLabels[phase] ?? phase}</Text>
              </View>
              {isConquered ? (
                <Text style={styles.conqueredBadge}>✓ Self-declared conquered</Text>
              ) : null}
              <Text style={styles.phaseDesc}>{phaseDesc[phase] ?? ""}</Text>
            </View>
          </View>

          {urgeTrend.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Urge Trend</Text>
              <View style={styles.trendChart}>
                {urgeTrend.map((u, i) => (
                  <View key={i} style={styles.tcCol}>
                    <View
                      style={[
                        styles.tcBar,
                        {
                          height: Math.max(4, (u.level / maxUrge) * 52),
                          backgroundColor: `rgba(249,115,22,${0.3 + (u.level / 5) * 0.55})`,
                        },
                      ]}
                    />
                    <Text style={[styles.tcLabel, i === urgeTrend.length - 1 && styles.tcLabelNow]}>
                      {u.week_label}
                    </Text>
                  </View>
                ))}
              </View>
              {urgeTrend.length >= 2 ? (
                <Text
                  style={[
                    styles.trendVerdict,
                    {
                      color:
                        urgeTrend[urgeTrend.length - 1].level < urgeTrend[0].level
                          ? URGE_EASING
                          : "#9CA3AF",
                    },
                  ]}
                >
                  {urgeTrend[urgeTrend.length - 1].level < urgeTrend[0].level - 0.5
                    ? "↓ Urges getting easier"
                    : urgeTrend[urgeTrend.length - 1].level > urgeTrend[0].level + 0.5
                      ? "↑ Urges increasing — review triggers"
                      : "→ Urge level stable"}
                </Text>
              ) : null}
            </View>
          ) : null}

          {topTriggers.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Triggers</Text>
              {topTriggers.slice(0, 5).map((t, i) => (
                <View key={`${t.tag}-${i}`} style={styles.trigRow}>
                  <Text style={styles.trigName}>{displayTag(t.tag)}</Text>
                  <View style={styles.trigTrack}>
                    <View
                      style={[
                        styles.trigFill,
                        { width: `${Math.max(8, (t.count / maxTriggerCount) * 100)}%` },
                      ]}
                    />
                  </View>
                  {t.count > 0 ? <Text style={styles.trigCount}>{t.count}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}

          {target.frequency_history.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>How many times you logged urges</Text>
              <Text style={styles.sectionNote}>
                Each tap on Log counted one time you felt the urge and couldn't control it. This
                history shows your progress over time.
              </Text>
              <View style={styles.histBars}>
                {target.frequency_history.slice(-14).map((h, i) => {
                  const maxCount = Math.max(...target.frequency_history.map((x) => x.count), 1);
                  return (
                    <View key={i} style={styles.histCol}>
                      <View
                        style={[
                          styles.histBar,
                          {
                            height: Math.max(3, (h.count / maxCount) * 48),
                            opacity: 0.3 + (h.count / maxCount) * 0.6,
                          },
                        ]}
                      />
                      {i % 7 === 0 ? (
                        <Text style={styles.histLabel}>
                          {h.log_date ?? h.date
                            ? new Date(h.log_date ?? h.date ?? "").toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {target.insights.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Insights ({target.insights.length})</Text>
              {target.insights.map((ins) => (
                <Pressable
                  key={`${ins.title}-${ins.unlocked_at}`}
                  style={styles.insightRow}
                  onPress={() => onInsightPress(ins.title, ins.body)}
                >
                  <View style={styles.insightIcon}>
                    <Text style={{ fontSize: 14 }}>💡</Text>
                  </View>
                  <Text style={styles.insightTitle} numberOfLines={2}>
                    {ins.title}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color="#374151" />
                </Pressable>
              ))}
            </View>
          ) : null}

          {!isConquered ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Actions</Text>
              <View style={styles.actionRow}>
                <Pressable style={styles.actBtn} onPress={onLogSlip}>
                  <Ionicons name="flame" size={14} color={QUIT_ORANGE.primary} />
                  <Text style={[styles.actBtnText, { color: QUIT_ORANGE.primary }]}>Log Slip</Text>
                </Pressable>
                <Pressable style={styles.actBtn} onPress={onUpdateTriggers}>
                  <Ionicons name="location" size={14} color="#FCD34D" />
                  <Text style={[styles.actBtnText, { color: "#FCD34D" }]}>Update Triggers</Text>
                </Pressable>
              </View>
              {canAdvance ? (
                <Pressable
                  style={[styles.advanceBtn, advancing && { opacity: 0.6 }]}
                  onPress={onAdvancePhase}
                  disabled={advancing}
                >
                  {advancing ? (
                    <ActivityIndicator color="#A78BFA" size="small" />
                  ) : (
                    <Text style={styles.advanceBtnText}>Advance Phase →</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <Pressable style={styles.deleteBtn} onPress={onDelete}>
            <Text style={styles.deleteBtnText}>Delete this quit target</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(249,115,22,0.1)",
    backgroundColor: "rgba(8,5,2,0.9)",
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1 },
  headerName: { fontSize: 18, fontWeight: "800", color: "#E5E7EB" },
  headerSub: {
    fontSize: 9,
    color: "rgba(249,115,22,0.5)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 2,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },

  heroCard: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#0E0804",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.12)",
    marginBottom: 14,
    position: "relative",
  },
  ghostNum: {
    position: "absolute",
    right: -8,
    top: -4,
    fontSize: 140,
    fontWeight: "900",
    lineHeight: 140,
    color: "rgba(249,115,22,0.05)",
    letterSpacing: -6,
    pointerEvents: "none",
  },
  heroInner: { padding: 18 },
  dayRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 8 },
  dayNum: {
    fontSize: 72,
    fontWeight: "900",
    color: "#F97316",
    lineHeight: 72,
    letterSpacing: -3,
  },
  dayUnit: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(249,115,22,0.4)",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  phasePill: {
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 20,
    backgroundColor: "rgba(249,115,22,0.1)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.25)",
    marginBottom: 8,
  },
  phasePillText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "rgba(253,186,116,0.8)",
  },
  conqueredBadge: { fontSize: 11, color: "#A78BFA", fontWeight: "700", marginBottom: 6 },
  phaseDesc: { fontSize: 12, color: "#6B7280", lineHeight: 18 },

  section: {
    backgroundColor: "#0E0804",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.10)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(249,115,22,0.4)",
    marginBottom: 12,
  },
  sectionNote: { fontSize: 11, color: "#374151", lineHeight: 16, marginBottom: 10 },

  trendChart: { flexDirection: "row", gap: 6, alignItems: "flex-end", height: 56, marginBottom: 8 },
  tcCol: { flex: 1, alignItems: "center", gap: 4 },
  tcBar: { width: "100%", borderRadius: 3, backgroundColor: QUIT_ORANGE.primary },
  tcLabel: { fontSize: 8, color: "#374151" },
  tcLabelNow: { color: "rgba(249,115,22,0.6)" },
  trendVerdict: { fontSize: 11, fontWeight: "600" },

  trigRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 9 },
  trigName: { fontSize: 11, color: "#9CA3AF", width: 80, flexShrink: 0 },
  trigTrack: {
    flex: 1,
    height: 5,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 5,
    overflow: "hidden",
  },
  trigFill: { height: "100%", borderRadius: 5, backgroundColor: "#EA580C" },
  trigCount: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(251,146,60,0.8)",
    minWidth: 18,
    textAlign: "right",
  },

  histBars: { flexDirection: "row", gap: 3, alignItems: "flex-end", height: 52 },
  histCol: { flex: 1, alignItems: "center", gap: 3 },
  histBar: { width: "100%", borderRadius: 2, backgroundColor: QUIT_ORANGE.primary },
  histLabel: { fontSize: 7, color: "#374151" },

  insightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  insightIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(249,115,22,0.08)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  insightTitle: { flex: 1, fontSize: 12, color: "#9CA3AF" },

  actionRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  actBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.35)",
  },
  actBtnText: { fontSize: 11, fontWeight: "700" },
  advanceBtn: {
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(139,92,246,0.08)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  advanceBtnText: { fontSize: 12, fontWeight: "700", color: "#A78BFA" },

  deleteBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "rgba(127,29,29,0.06)",
    borderWidth: 1,
    borderColor: "rgba(127,29,29,0.18)",
    alignItems: "center",
    marginBottom: 24,
  },
  deleteBtnText: { fontSize: 13, color: "rgba(239,68,68,0.5)", fontWeight: "600" },
});
