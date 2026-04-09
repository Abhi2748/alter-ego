/**
 * Settings → Contact → FAQs. Loads copy from GET /api/v1/settings/faq (no external URL).
 */

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { MainStackParamList } from "@/navigation/types";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useQuery } from "@tanstack/react-query";
import { apiClient, getErrorMessage } from "@/services/api";

const BG_GRADIENT = ["#09091A", "#07080F"] as const;
const TEXT = "#E5E7EB";
const MUTED = "#6B7280";
const VIOLET = "#8B5CF6";
const BORDER = "rgba(42,48,80,0.35)";

type FaqItem = { q: string; a: string };

async function fetchFaq(): Promise<FaqItem[]> {
  const res = await apiClient.get<{ faq: FaqItem[] }>("/api/v1/settings/faq");
  return Array.isArray(res?.faq) ? res.faq : [];
}

type FaqNav = StackNavigationProp<MainStackParamList, "SettingsFaq">;

export function SettingsFaqScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<FaqNav>();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["settings", "faq"],
    queryFn: fetchFaq,
    staleTime: 10 * 60 * 1000,
  });

  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("ContactUs");
    }
  }, [navigation]);

  const FAQ_CATEGORIES = [
    { label: "Getting Started", count: 4 },
    { label: "Shadow Twin", count: 3 },
    { label: "Growth & Abilities", count: 4 },
    { label: "Features", count: 4 },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        {Platform.OS === "ios" ? <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} /> : null}
        <View style={styles.headerRow}>
          <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={MUTED} />
          </Pressable>
          <Text style={styles.headerTitle}>FAQs</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      {isPending ? (
        <View style={styles.centered}>
          <ActivityIndicator color={VIOLET} />
        </View>
      ) : isError ? (
        <View style={[styles.centered, styles.errorPad]}>
          <Text style={styles.errorText}>{getErrorMessage(error)}</Text>
          <Pressable onPress={onRetry} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {(() => {
            const items = data ?? [];
            let cursor = 0;
            return FAQ_CATEGORIES.map((cat) => {
              const catItems = items.slice(cursor, cursor + cat.count);
              const catStart = cursor;
              cursor += cat.count;

              return (
                <View key={cat.label} style={{ marginBottom: 8 }}>
                  <View style={styles.catHeader}>
                    <Text style={styles.catLabel}>{cat.label}</Text>
                    <View style={styles.catLine} />
                  </View>

                  {catItems.map((item, i) => {
                    const globalIdx = catStart + i;
                    const isOpen = openIndex === globalIdx;
                    return (
                      <View
                        key={globalIdx}
                        style={[styles.faqCard, isOpen && styles.faqCardOpen]}
                      >
                        <Pressable
                          style={styles.faqQuestion}
                          onPress={() => setOpenIndex(isOpen ? null : globalIdx)}
                        >
                          <Text style={[styles.q, isOpen && styles.qOpen]}>{item.q}</Text>
                          <Ionicons
                            name={isOpen ? "chevron-up" : "chevron-down"}
                            size={16}
                            color={isOpen ? "#8B5CF6" : "#374151"}
                          />
                        </Pressable>
                        {isOpen ? (
                          <View style={styles.faqAnswer}>
                            <Text style={styles.a}>{item.a}</Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              );
            });
          })()}
        </ScrollView>
      )}
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
    borderBottomColor: BORDER,
    position: "relative",
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerSpacer: { width: 44, height: 44 },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: TEXT,
    textAlign: "center",
    fontFamily: "Inter_700Bold",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  catLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.2)",
    fontFamily: "Inter_700Bold",
    flexShrink: 0,
  },
  catLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(42,48,80,0.4)",
  },
  faqCard: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.35)",
    borderRadius: 14,
    marginBottom: 7,
    overflow: "hidden",
  },
  faqCardOpen: {
    backgroundColor: "rgba(139,92,246,0.05)",
    borderColor: "rgba(139,92,246,0.2)",
  },
  faqQuestion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  faqAnswer: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(42,48,80,0.3)",
    paddingTop: 12,
  },
  q: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#E5E7EB",
    lineHeight: 18,
    fontFamily: "Inter_600SemiBold",
  },
  qOpen: {
    color: "#C4B5FD",
  },
  a: {
    fontSize: 12,
    color: "#9CA3AF",
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorPad: { paddingHorizontal: 24 },
  errorText: { color: MUTED, textAlign: "center", marginBottom: 16 },
  retryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A3050",
    backgroundColor: "#141824",
  },
  retryText: { color: VIOLET, fontWeight: "600" },
});
