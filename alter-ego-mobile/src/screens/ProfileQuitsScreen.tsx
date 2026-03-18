/**
 * Profile → Quits. Header + ProfileQuitsTab (quit cards, add, conquer, slip recovery).
 * Spec: Quits tab with ember/amber accent. No schedule. No shame.
 */

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useProfileQuits } from "@/hooks/useProfile";
import { SkeletonBlock } from "@/components/SkeletonBlock";

const BG_GRADIENT = ["#09091A", "#07080F"] as const;
const TEXT = "#E5E7EB";

export function ProfileQuitsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const { data, isLoading, error, refetch } = useProfileQuits() as {
    data: { quit_targets: Array<Record<string, any>> } | undefined;
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
  };

  const targets = data?.quit_targets ?? [];

  return (
    <LinearGradient
      colors={BG_GRADIENT}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#6B7280" />
        </Pressable>
        <Text style={styles.title}>Quits</Text>
        <View style={styles.headerRight} />
      </View>

      {isLoading && targets.length === 0 ? (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 80 + insets.bottom }}>
          {[0, 1].map((i) => (
            <View
              key={i}
              style={{
                backgroundColor: "#141824",
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                gap: 12,
              }}
            >
              <SkeletonBlock width={160} height={16} delay={i * 100} />
              <SkeletonBlock width={80} height={32} borderRadius={8} delay={i * 100 + 50} />
              <View style={{ flexDirection: "row", gap: 4 }}>
                {[0, 1, 2, 3, 4].map((j) => (
                  <SkeletonBlock
                    key={j}
                    width="20%"
                    height={6}
                    borderRadius={3}
                    delay={i * 100 + j * 30}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>
            {error instanceof Error ? error.message : "Could not load quits"}
          </Text>
          <Pressable onPress={() => refetch()} style={{ marginTop: 10 }}>
            <Text style={[styles.loadingText, { color: "#8B5CF6" }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 80 + insets.bottom }}>
          <Text style={styles.sectionLabel}>RESISTANCE TARGETS</Text>
          {targets.length === 0 ? (
            <Text style={styles.loadingText}>
              You haven't added any resistance targets.
            </Text>
          ) : (
            targets.map((qt) => (
              <View key={String(qt.id)} style={styles.card}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                  <Text style={styles.cardTitle}>{String(qt.name ?? "")}</Text>
                  <Text style={styles.cardHeroNumber}>
                    {typeof qt.clean_days === "number" ? qt.clean_days.toLocaleString() : "0"}
                  </Text>
                </View>
                <Text style={styles.cardSub}>
                  {qt.conquered ? "Conquered" : String(qt.current_phase ?? "")}
                  {qt.last_slip_date ? ` · last slip ${String(qt.last_slip_date)}` : ""}
                </Text>

                <View style={styles.phaseRow}>
                  {(qt.phases ?? []).map((p: any) => (
                    <View
                      key={String(p.key)}
                      style={[
                        styles.phaseDot,
                        p.completed ? styles.phaseDotDone : p.active ? styles.phaseDotActive : styles.phaseDotOff,
                      ]}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.35)",
  },
  backBtn: { padding: 4, marginRight: 8 },
  title: { flex: 1, fontSize: 22, fontWeight: "700", color: TEXT },
  headerRight: { width: 40 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { fontSize: 14, color: "#6B7280" },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#374151",
    marginBottom: 10,
  },
  card: {
    backgroundColor: "rgba(14,13,28,0.90)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.50)",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 18, fontWeight: "800", color: TEXT, letterSpacing: -0.3 },
  cardHeroNumber: { fontSize: 22, fontWeight: "900", color: "#E5E7EB", letterSpacing: -0.4 },
  cardSub: { fontSize: 12, color: "#6B7280", marginTop: 6 },
  phaseRow: { flexDirection: "row", columnGap: 6, marginTop: 12 },
  phaseDot: { width: 10, height: 10, borderRadius: 999 },
  phaseDotOff: { backgroundColor: "rgba(30,35,51,1)", borderWidth: 1, borderColor: "rgba(42,48,80,0.5)" },
  phaseDotActive: { backgroundColor: "rgba(139,92,246,0.35)", borderWidth: 1, borderColor: "rgba(139,92,246,0.6)" },
  phaseDotDone: { backgroundColor: "rgba(139,92,246,0.75)" },
});
