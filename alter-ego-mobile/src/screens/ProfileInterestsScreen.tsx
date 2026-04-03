/**
 * Profile → Interests (paths, quests, manage sheets).
 */

import React, { useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { InterestsTab } from "@/components/profile/InterestsTab";
import type { ProfileStackParamList } from "@/navigation/types";

export function ProfileInterestsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ProfileStackParamList, "ProfileInterests">>();
  const pendingSheet = route.params?.pendingSheet;
  const pathIdParam = route.params?.pathId;
  const pendingSheetIntent =
    pendingSheet && pathIdParam ? { sheet: pendingSheet, pathId: pathIdParam } : null;

  const consumePendingSheet = useCallback(() => {
    navigation.setParams({ pendingSheet: undefined, pathId: undefined } as never);
  }, [navigation]);

  return (
    <LinearGradient
      colors={["#09091A", "#07080F"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.root}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {Platform.OS === "ios" ? <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} /> : null}
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color="#6B7280" />
          </Pressable>
          <Text style={styles.headerTitle}>Interests</Text>
          <View style={styles.backBtn} />
        </View>
      </View>
      <View style={styles.body}>
        <InterestsTab
          pendingSheetIntent={pendingSheetIntent}
          onPendingSheetConsumed={consumePendingSheet}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, minHeight: 0 },
  header: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.35)",
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#E5E7EB",
    fontFamily: "Inter_700Bold",
  },
});
