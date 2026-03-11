/**
 * Profile — Main screen. Fetches user + home for username, stage, power score, pet.
 */

import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { PetAnimation } from "../components/PetAnimation";
import { COLORS, SPACING, GRADIENTS, RADIUS } from "../constants/theme";
import type { ProfileStackParamList } from "../navigation/types";
import { supabase } from "../utils/supabase";
import { getUserMe, getHome } from "../utils/api";

const HEADER_HEIGHT = 56;
const CHAR_WIDTH = 120;
const CHAR_HEIGHT = 160;
const PET_SIZE = 56;
const SETTINGS_HIT = 44;
const BUTTON_GAP = 12;

type Nav = CompositeNavigationProp<
  StackNavigationProp<ProfileStackParamList, "ProfileMain">,
  StackNavigationProp<ProfileStackParamList>
>;

const ENTRIES: { key: keyof Omit<ProfileStackParamList, "ProfileMain">; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "ProfileStats", label: "Stats", icon: "stats-chart" },
  { key: "ProfileStreak", label: "Streak", icon: "flame" },
  { key: "ProfileTitles", label: "Titles", icon: "ribbon" },
  { key: "ProfileInterests", label: "Interests", icon: "heart" },
];

const STAGE_NAMES: Record<string, string> = {
  "The Awakened": "The Awakened",
  "The Focused": "The Focused",
  "The Burning": "The Burning",
  "The Relentless": "The Relentless",
  "The Formidable": "The Formidable",
  "The Sovereign": "The Sovereign",
};

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [stageTitle, setStageTitle] = useState("");
  const [powerScore, setPowerScore] = useState<number>(0);
  const [petStage, setPetStage] = useState(0);

  const fetchProfile = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }
      const [user, home] = await Promise.all([
        getUserMe(session.access_token),
        getHome(session.access_token),
      ]);
      setUsername(
        (user.username && String(user.username).trim()) ||
        (user.email ? String(user.email).split("@")[0] : "") ||
        "—"
      );
      setStageTitle(
        (user.archetype && STAGE_NAMES[user.archetype]) || user.archetype || "The Awakened"
      );
      setPowerScore(home.power_score ?? 0);
      setPetStage(home.pet_state?.stage ?? 0);
    } catch (_) {
      setUsername("—");
      setStageTitle("The Awakened");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  const openSettings = () => {
    navigation.getParent()?.navigate("Settings" as never);
  };

  const openRankCard = () => {
    navigation.getParent()?.navigate("RankCard" as never);
  };

  const openEntry = (screen: keyof ProfileStackParamList) => {
    navigation.navigate(screen);
  };

  return (
    <LinearGradient
      colors={GRADIENTS.background.colors}
      start={GRADIENTS.background.start}
      end={GRADIENTS.background.end}
      style={styles.container}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, height: insets.top + HEADER_HEIGHT },
        ]}
      >
        <View style={styles.headerGlass} />
        <View style={styles.headerLeft}>
          <Text style={styles.username} numberOfLines={1}>
            {loading ? "…" : username}
          </Text>
          <Text style={styles.stageTitle} numberOfLines={1}>
            {loading ? "…" : stageTitle}
          </Text>
        </View>
        <Pressable onPress={openSettings} style={styles.settingsButton} hitSlop={10}>
          <Ionicons name="settings-outline" size={24} color={COLORS.text2} />
        </Pressable>
      </View>

      {/* Character + power zone */}
      <View style={styles.heroZone}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.violet} style={{ marginVertical: 24 }} />
        ) : (
          <>
            <View style={styles.heroRow}>
              <View style={styles.characterPlaceholder} />
              <View style={styles.petWrap}>
                <PetAnimation stage={petStage || 1} isHappy={true} size={PET_SIZE} />
              </View>
            </View>
            <Text style={styles.powerLabel}>POWER SCORE</Text>
            <Text style={styles.powerValue}>
              {powerScore.toLocaleString()}
            </Text>
            <Pressable onPress={openRankCard} style={styles.shareRankRow} hitSlop={8}>
              <Ionicons name="share-outline" size={14} color={COLORS.violet} />
              <Text style={styles.shareRankText}>Share rank card</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Four entry buttons */}
      <View style={[styles.entries, { paddingBottom: insets.bottom + 24 }]}>
        {ENTRIES.map(({ key, label, icon }) => (
          <Pressable
            key={key}
            style={({ pressed }) => [
              styles.entryButton,
              pressed && styles.entryButtonPressed,
            ]}
            onPress={() => openEntry(key)}
          >
            <Ionicons
              name={icon as any}
              size={22}
              color={COLORS.violet}
              style={styles.entryIcon}
            />
            <Text style={styles.entryLabel}>{label}</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
          </Pressable>
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: "relative",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.glass,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  username: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: COLORS.text,
  },
  stageTitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },
  settingsButton: {
    width: SETTINGS_HIT,
    height: SETTINGS_HIT,
    alignItems: "center",
    justifyContent: "center",
  },
  heroZone: {
    paddingTop: 24,
    alignItems: "center",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  characterPlaceholder: {
    width: CHAR_WIDTH,
    height: CHAR_HEIGHT,
    borderRadius: 8,
    backgroundColor: COLORS.surface2,
  },
  petWrap: { justifyContent: "center" },
  powerLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 16,
    textTransform: "uppercase",
  },
  powerValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    color: COLORS.violet,
    marginTop: 4,
  },
  shareRankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  shareRankText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.violet,
  },
  entries: {
    flex: 1,
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: SPACING.lg,
    gap: BUTTON_GAP,
  },
  entryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surface2,
    borderRadius: RADIUS.card,
    paddingVertical: 16,
    paddingHorizontal: SPACING.md,
  },
  entryButtonPressed: {
    backgroundColor: COLORS.surface2,
  },
  entryIcon: {
    marginRight: 12,
  },
  entryLabel: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.text,
  },
});
