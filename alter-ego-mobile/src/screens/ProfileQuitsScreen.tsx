/**
 * Profile → Quits. Header + ProfileQuitsTab (quit cards, add, conquer, slip recovery).
 * Spec: Quits tab with ember/amber accent. No schedule. No shame.
 */

import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { ProfileQuitsTab } from "./ProfileQuitsTab";
import { supabase } from "../utils/supabase";
import {
  getQuitTargets,
  postQuitTarget,
  postQuitTargetConquer,
  type QuitTargetOut,
  type PostQuitTargetPayload,
} from "../utils/api";

const BG_GRADIENT = ["#09091A", "#07080F"] as const;
const TEXT = "#E5E7EB";

export function ProfileQuitsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [targets, setTargets] = useState<QuitTargetOut[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setTargets([]);
        return;
      }
      const res = await getQuitTargets(session.access_token);
      setTargets(res.targets ?? []);
    } catch (_) {
      setTargets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      refetch();
    }, [refetch])
  );

  const handleAddQuit = useCallback(async (payload: PostQuitTargetPayload) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not signed in");
    await postQuitTarget(session.access_token, payload);
  }, []);

  const handleConquer = useCallback(
    async (
      targetId: string,
      payload: { conquered_at: string; final_clean_days: number; cravings_resisted: number }
    ) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in");
      await postQuitTargetConquer(session.access_token, targetId, payload);
    },
    []
  );

  const handleOpenTwinChat = useCallback(
    (initialMessage: string) => {
      (navigation.getParent() as any)?.navigate("TwinChat", { initialMessage });
    },
    [navigation]
  );

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

      {loading && targets.length === 0 ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : (
        <ProfileQuitsTab
          targets={targets}
          onRefetch={refetch}
          onAddQuit={handleAddQuit}
          onConquer={handleConquer}
          onOpenTwinChat={handleOpenTwinChat}
        />
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
});
