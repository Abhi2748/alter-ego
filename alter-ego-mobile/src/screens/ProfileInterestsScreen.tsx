/**
 * Profile → Interests (paths, quests, manage sheets).
 */

import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { InterestsTab } from "@/components/profile/InterestsTab";

export function ProfileInterestsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

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
        <InterestsTab />
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
