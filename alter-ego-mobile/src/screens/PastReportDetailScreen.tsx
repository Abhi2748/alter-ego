/**
 * Past Report Detail — Stub. Opens from Weekly Report "Past Reports" list.
 * TODO: Full layout mirroring main report card for a given report_id.
 */

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

type PastReportDetailParams = { report_id: string };

export function PastReportDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ PastReportDetail: PastReportDetailParams }, "PastReportDetail">>();
  const reportId = route.params?.report_id ?? "—";

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
      <View style={styles.body}>
        <Text style={styles.placeholder}>Report {reportId}</Text>
        <Text style={styles.sub}>Full detail view coming soon.</Text>
      </View>
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
  body: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  placeholder: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#E5E7EB", marginBottom: 8 },
  sub: { fontSize: 13, color: "#6B7280" },
});
