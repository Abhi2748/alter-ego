/**
 * InterestPlanScreen — shown after interest creation to confirm the
 * achievable outcome, skill roadmap, and resources.
 *
 * Also shown on first visit to Interests tab if plan hasn't been seen.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const VIOLET = "#8B5CF6";
const VDEEP = "#5B21B6";
const BG: readonly [string, string] = ["#09091A", "#07080F"];
const S2 = "#111522";
const BORDER = "rgba(42,48,80,0.45)";
const TEXT = "#E5E7EB";
const TEXT2 = "#9CA3AF";
const MUTED = "#6B7280";
const DIM = "#374151";

type Props = {
  interest: {
    name: string;
    level_label: string;
    timeline_label: string;
    achievable_outcome?: string;
    progression_milestones?: string[];
    recommended_resources?: Array<{
      type: string;
      title?: string;
      name?: string;
      author?: string;
      why?: string;
    }>;
  };
  onConfirm: () => void;
  ctaLabel?: string;
};

export function InterestPlanScreen({ interest, onConfirm, ctaLabel }: Props) {
  const insets = useSafeAreaInsets();

  const outcome = interest.achievable_outcome?.trim() || "";
  const milestones = interest.progression_milestones ?? [];
  const resources = interest.recommended_resources ?? [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient colors={BG} style={StyleSheet.absoluteFill} />

      <View style={styles.hdr}>
        <Text style={styles.hdrTitle}>Here&apos;s your plan</Text>
        <Text style={styles.hdrSub}>Review before you start</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <View style={styles.domainCard}>
          <View style={styles.domainIcon}>
            <Text style={{ fontSize: 20 }}>✦</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.domainName}>{interest.name}</Text>
            <Text style={styles.domainMeta}>
              {interest.level_label}
              {interest.timeline_label ? ` · ${interest.timeline_label}` : ""}
            </Text>
          </View>
        </View>

        {outcome.length > 0 ? (
          <View style={styles.outcomeCard}>
            <View style={styles.outcomeCardGlow} />
            <Text style={styles.outcomeTag}>What you&apos;ll actually reach</Text>
            <Text style={styles.outcomeTitle}>Your honest goal</Text>
            <Text style={styles.outcomeText}>{outcome}</Text>
          </View>
        ) : null}

        {milestones.length > 0 ? (
          <View style={styles.roadmapCard}>
            <Text style={styles.cardHdr}>
              Your skill roadmap · {milestones.length} milestones
            </Text>
            {milestones.map((m, i) => (
              <View key={i} style={styles.milestoneRow}>
                <View style={styles.milestoneNum}>
                  <Text style={styles.milestoneNumTxt}>{i + 1}</Text>
                </View>
                <Text style={styles.milestoneText}>{m}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {resources.length > 0 ? (
          <View style={styles.resourcesCard}>
            <Text style={styles.cardHdr}>Recommended for your journey</Text>
            {resources.map((r, i) => {
              const displayName = r.title || r.name || "Resource";
              const typeLabel = (r.type || "resource").toLowerCase();
              const icon = typeLabel === "book" ? "📖" : typeLabel === "youtube_channel" ? "▶" : "🔗";
              const iconStyle = typeLabel === "book" ? styles.resIconBook : styles.resIconVideo;
              return (
                <View key={i} style={styles.resItem}>
                  <View style={[styles.resIcon, iconStyle]}>
                    <Text style={{ fontSize: 13 }}>{icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resName}>
                      {displayName}
                      {r.author ? ` · ${r.author}` : ""}
                    </Text>
                    {r.why ? <Text style={styles.resWhy}>{r.why}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <Pressable style={styles.ctaWrap} onPress={onConfirm}>
          <LinearGradient
            colors={[VDEEP, VIOLET]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaTxt}>{ctaLabel ?? "Start my journey"}</Text>
            <Text style={styles.ctaSub}>Daily missions begin tomorrow</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hdr: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: "rgba(9,9,26,0.7)",
  },
  hdrTitle: { fontSize: 17, fontWeight: "700", color: TEXT },
  hdrSub: { fontSize: 11, color: MUTED, marginTop: 2 },
  scroll: { padding: 16, gap: 10 },
  domainCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: S2,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 13,
  },
  domainIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: "rgba(20,184,166,0.12)",
    borderWidth: 1,
    borderColor: "rgba(20,184,166,0.2)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  domainName: { fontSize: 14, fontWeight: "700", color: TEXT },
  domainMeta: { fontSize: 11, color: MUTED, marginTop: 2 },
  outcomeCard: {
    backgroundColor: "rgba(20,184,166,0.06)",
    borderWidth: 1,
    borderColor: "rgba(20,184,166,0.22)",
    borderRadius: 16,
    padding: 14,
    position: "relative",
    overflow: "hidden",
    gap: 6,
  },
  outcomeCardGlow: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 1,
    backgroundColor: "rgba(20,184,166,0.3)",
  },
  outcomeTag: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(20,184,166,0.65)",
  },
  outcomeTitle: { fontSize: 13, fontWeight: "700", color: TEXT },
  outcomeText: { fontSize: 12.5, color: TEXT2, lineHeight: 19 },
  roadmapCard: {
    backgroundColor: S2,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  cardHdr: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: MUTED,
    marginBottom: 2,
  },
  milestoneRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  milestoneNum: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  milestoneNumTxt: { fontSize: 9, fontWeight: "700", color: DIM },
  milestoneText: { fontSize: 12, color: TEXT2, flex: 1, lineHeight: 17 },
  resourcesCard: {
    backgroundColor: S2,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  resItem: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  resIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  resIconBook: {
    backgroundColor: "rgba(99,102,241,0.12)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.2)",
  },
  resIconVideo: {
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
  },
  resName: { fontSize: 12, fontWeight: "600", color: TEXT, lineHeight: 16 },
  resWhy: { fontSize: 10.5, color: MUTED, marginTop: 2, lineHeight: 15 },
  ctaWrap: { borderRadius: 16, overflow: "hidden", marginTop: 4 },
  ctaGradient: { paddingVertical: 16, alignItems: "center", gap: 3 },
  ctaTxt: { fontSize: 15, fontWeight: "800", color: TEXT },
  ctaSub: { fontSize: 10, color: "rgba(229,231,235,0.55)", fontWeight: "500" },
});
