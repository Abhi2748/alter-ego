/**
 * Past weekly report by id — same card layout as current week.
 */

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { MainStackParamList } from "../navigation/types";
import { reportsService } from "@/services/reports";
import { mapRowToWeeklyReportData, weeklyDetailToRow } from "@/utils/weeklyReportMapper";
import type { WeeklyReportData } from "@/types/weeklyReportUi";
import { ReportCard } from "./WeeklyReportScreen";
import { getErrorMessage } from "@/services/api";

export function PastReportDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<MainStackParamList, "PastReportDetail">>();
  const reportId = route.params?.report_id ?? "";

  const [data, setData] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!reportId) {
      setError("Missing report.");
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await reportsService.getWeeklyById(reportId);
      if (!res.available) {
        setData(null);
        setError("This report is no longer available.");
        return;
      }
      const row = weeklyDetailToRow(res as unknown as Record<string, unknown>);
      setData(mapRowToWeeklyReportData(row, []));
    } catch (e) {
      setError(getErrorMessage(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#09091A", "#07080F"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#E5E7EB" />
        </Pressable>
        <Text style={styles.headerTitle}>Past Report</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.err}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.retry}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : data ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 + insets.bottom, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
        >
          <ReportCard data={data} onReturn={() => navigation.goBack()} />
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.35)",
  },
  backBtn: { marginRight: 12 },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  err: { color: "#9CA3AF", textAlign: "center", marginBottom: 12 },
  retry: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: "rgba(139,92,246,0.2)", borderRadius: 12 },
  retryTxt: { color: "#A78BFA", fontFamily: "Inter_600SemiBold" },
});
