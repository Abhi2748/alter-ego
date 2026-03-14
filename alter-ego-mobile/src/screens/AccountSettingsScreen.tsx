/**
 * Account Settings — Placeholder. Connect Email, Sign in with Google, Sign in with Apple.
 */

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

export function AccountSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <LinearGradient
      colors={["#09091A", "#07080F"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10, paddingBottom: 14, paddingHorizontal: 16 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#6B7280" />
        </Pressable>
        <Text style={styles.title}>Account</Text>
      </View>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Connect Email, Google, Apple — coming soon</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(9,9,26,0.85)", borderBottomWidth: 1, borderBottomColor: "rgba(42,48,80,0.4)" },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#E5E7EB", letterSpacing: -0.3 },
  placeholder: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  placeholderText: { fontSize: 14, color: "#6B7280" },
});
