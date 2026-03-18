/**
 * Profile → Interests. Header + ProfileInterestsTab (interest cards, milestones, add/edit sheets).
 * Spec: Interests tab with premium dark cinematic UI.
 */

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useProfileInterests } from "@/hooks/useProfile";
import { SkeletonBlock } from "@/components/SkeletonBlock";

const BG_GRADIENT = ["#09091A", "#07080F"] as const;
const TEXT = "#E5E7EB";

export function ProfileInterestsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const { data, isLoading, error, refetch } = useProfileInterests() as {
    data: { interests: Array<Record<string, any>> } | undefined;
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
  };

  const interests = data?.interests ?? [];

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
        <Text style={styles.title}>Interests</Text>
        <View style={styles.headerRight} />
      </View>

      {isLoading && interests.length === 0 ? (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 80 + insets.bottom }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                backgroundColor: "#141824",
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                gap: 10,
              }}
            >
              <SkeletonBlock width={140} height={16} delay={i * 100} />
              <SkeletonBlock width={80} height={10} delay={i * 100 + 50} />
              <SkeletonBlock width="100%" height={6} borderRadius={99} delay={i * 100 + 100} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[0, 1, 2].map((j) => (
                  <SkeletonBlock
                    key={j}
                    width={60}
                    height={22}
                    borderRadius={10}
                    delay={i * 100 + j * 50}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>
            {error instanceof Error ? error.message : "Could not load interests"}
          </Text>
          <Pressable onPress={() => refetch()} style={{ marginTop: 10 }}>
            <Text style={[styles.loadingText, { color: "#8B5CF6" }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 80 + insets.bottom }}>
          <Text style={styles.sectionLabel}>YOUR INTERESTS</Text>
          {interests.length === 0 ? (
            <Text style={styles.loadingText}>No interests added yet.</Text>
          ) : (
            interests.map((it) => (
              <View key={String(it.id)} style={styles.card}>
                <Text style={styles.cardTitle}>{String(it.name ?? "")}</Text>
                <Text style={styles.cardSub}>
                  {String(it.category ?? "")}
                  {it.level_text ? ` · ${String(it.level_text)}` : ""}
                </Text>
                <Text style={styles.cardMeta}>
                  {typeof it.total_sessions === "number" ? `${it.total_sessions} sessions` : ""}
                </Text>
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
  cardSub: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  cardMeta: { fontSize: 11, color: "#4B5563", marginTop: 10 },
});
