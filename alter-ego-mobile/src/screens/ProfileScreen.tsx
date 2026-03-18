/**
 * Profile Screen — Identity hero card + 4 nav rows to sub-screens.
 * No fixed header; hero bleeds edge to edge. Do NOT touch sub-screens or bottom nav.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Rect, Path, Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { PetAnimation } from "../components/PetAnimation";
import type { ProfileStackParamList } from "../navigation/types";
import { useUserStore } from "@/store/userStore";

const ARCHETYPE_DISPLAY: Record<string, string> = {
  restless_creator: "The Restless Creator",
  reluctant_achiever: "The Reluctant Achiever",
  structured_climber: "The Structured Climber",
  lone_wolf: "The Lone Wolf",
  social_performer: "The Social Performer",
};

type Nav = CompositeNavigationProp<
  StackNavigationProp<ProfileStackParamList, "ProfileMain">,
  StackNavigationProp<ProfileStackParamList>
>;

function StatsIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Rect x={1} y={10} width={4} height={7} rx={1} fill="#6D28D9" opacity={0.5} />
      <Rect x={7} y={6} width={4} height={11} rx={1} fill="#6D28D9" opacity={0.75} />
      <Rect x={13} y={2} width={4} height={15} rx={1} fill="#8B5CF6" />
    </Svg>
  );
}

function StreakIcon() {
  return (
    <Svg width={16} height={20} viewBox="0 0 16 20" fill="none">
      <Path
        d="M8 1C8 1 13 6.5 13 11C13 14 10.8 16.5 8 16.5C5.2 16.5 3 14 3 11C3 8.5 5 7 5.5 6C5.5 8 6.5 9 7 9.5C7 6.5 7.5 3.5 8 1Z"
        fill="#8B5CF6"
      />
      <Path
        d="M6.5 12C6.5 13.1 7.2 13.8 8 13.8C8.8 13.8 9.5 13.1 9.5 12C9.5 11 8.8 10.3 8 10C7.2 10.3 6.5 11 6.5 12Z"
        fill="#5B21B6"
        opacity={0.5}
      />
    </Svg>
  );
}

function JourneyIcon() {
  return (
    <Svg width={20} height={18} viewBox="0 0 20 18" fill="none">
      <Path
        d="M3 15C5 11 7 10 10 10C13 10 15 9 17 5"
        stroke="#8B5CF6"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Circle cx={10} cy={10} r={1.5} fill="#8B5CF6" />
      <Circle cx={17} cy={5} r={1.5} fill="#8B5CF6" opacity={0.6} />
      <Circle cx={3} cy={15} r={1.5} fill="#4B5563" />
    </Svg>
  );
}

function InterestsIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle cx={9} cy={8.5} r={2} fill="#8B5CF6" />
      <Path
        d="M9 2.5C9 2.5 12 5.5 12 8C12 9.7 10.7 11 9 11C7.3 11 6 9.7 6 8C6 5.5 9 2.5 9 2.5Z"
        fill="#8B5CF6"
        opacity={0.4}
      />
      <Path
        d="M4 13.5C4 11.6 6.2 10 9 10C11.8 10 14 11.6 14 13.5"
        stroke="#6D28D9"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Circle cx={3} cy={10} r={1.5} fill="#5B21B6" opacity={0.5} />
      <Circle cx={15} cy={10} r={1.5} fill="#5B21B6" opacity={0.5} />
    </Svg>
  );
}

function QuitsIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle cx={9} cy={9} r={7} stroke="#FB923C" strokeWidth={1.5} fill="none" />
      <Path d="M6 9h6" stroke="#FB923C" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

const NAV_ENTRIES: {
  key: keyof Omit<ProfileStackParamList, "ProfileMain">;
  label: string;
  Icon: React.FC;
}[] = [
  { key: "ProfileStats", label: "Stats", Icon: StatsIcon },
  { key: "ProfileStreak", label: "Streak", Icon: StreakIcon },
  { key: "ProfileIdentity", label: "Journey", Icon: JourneyIcon },
  { key: "ProfileInterests", label: "Interests", Icon: InterestsIcon },
  { key: "ProfileQuits", label: "Quits", Icon: QuitsIcon },
];

const PET_STAGE_NAMES: Record<number, string> = {
  1: "Cub",
  2: "Cat",
  3: "Fox",
  4: "Wolf",
  5: "Snow Leopard",
  6: "Panther",
  7: "Griffin",
  8: "Dragon",
};

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const profile = useUserStore((state) => state.profile);
  const profileLoading = useUserStore((state) => state.isLoading);
  const [journeyDropdownVisible, setJourneyDropdownVisible] = useState(false);
  const journeyDropdownTop = 260;

  const petFloat = useSharedValue(0);

  React.useEffect(() => {
    petFloat.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const petAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: petFloat.value }],
  }));

  const openSettings = () => {
    (navigation.getParent() as any)?.navigate("Settings");
  };

  const openRankCard = () => {
    (navigation.getParent() as any)?.navigate("RankCard");
  };

  const openEntry = (screen: keyof Omit<ProfileStackParamList, "ProfileMain">) => {
    navigation.navigate(screen);
  };

  const initial = profile?.username ? profile.username[0].toUpperCase() : "?";

  return (
    <LinearGradient
      colors={["#09091A", "#07080F"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card — full width zone */}
        <View style={styles.hero}>
          {/* Radial atmosphere */}
          <View style={styles.heroRadial} pointerEvents="none" />
          <LinearGradient
            colors={["#0D0A20", "#09091A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.heroGradient}
          />

          <View
            style={[
              styles.heroContent,
              {
                paddingTop: insets.top + 10,
                paddingHorizontal: 16,
              },
            ]}
          >
            {/* Top row: profile pic + settings */}
            <View style={styles.topRow}>
              {profile.profile_photo_url ? (
                <Image
                  source={{ uri: profile.profile_photo_url }}
                  style={styles.profilePic}
                />
              ) : (
                <LinearGradient
                  colors={["rgba(80,30,160,0.7)", "rgba(30,20,60,0.9)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.profilePic}
                >
                  <Text style={styles.profileInitial}>{initial}</Text>
                </LinearGradient>
              )}
              <Pressable
                onPress={openSettings}
                style={styles.settingsBtn}
                hitSlop={10}
              >
                <Ionicons name="settings-outline" size={18} color="#6B7280" />
              </Pressable>
            </View>

            {/* Stage badge */}
            <View style={styles.stageBadge}>
              <Text style={styles.stageBadgeText}>
                {profile ? `Stage ${profile.character_stage} · ${profile.character_stage_name}` : "—"}
              </Text>
            </View>

            {/* Character + pet row */}
            {profileLoading || !profile ? (
              <ActivityIndicator size="large" color="#8B5CF6" style={{ marginVertical: 24 }} />
            ) : (
              <>
                <View style={styles.charPetRow}>
                  <View style={styles.charWrap}>
                    <LinearGradient
                      colors={["transparent", "rgba(167,139,250,0.35)", "transparent"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.charRim}
                      pointerEvents="none"
                    />
                    <LinearGradient
                      colors={["rgba(60,25,130,0.32)", "rgba(10,10,22,0.75)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={styles.charPlaceholder}
                    />
                  </View>
                  <Animated.View style={[styles.petWrap, petAnimatedStyle]}>
                    <View style={styles.petCircle}>
                      <PetAnimation
                        stage={Math.min(8, Math.max(1, profile.pet_stage))}
                        isHappy
                        size={58}
                      />
                    </View>
                  </Animated.View>
                </View>

                {/* Username */}
                <Text style={styles.heroUsername}>{profile.username}</Text>

                {/* Power score + Share rank card — single row, clean fit */}
                <View style={styles.powerShareRow}>
                  <View style={styles.powerBlock}>
                    <Text style={styles.powerLabel}>POWER SCORE</Text>
                    <Text style={styles.powerValue} numberOfLines={1}>
                      {profile.power_score.toLocaleString()}
                    </Text>
                  </View>
                  <Pressable onPress={openRankCard} style={styles.shareRankRow} hitSlop={8}>
                    <Ionicons name="share-outline" size={12} color="#6D28D9" />
                    <Text style={styles.shareRankText}>Share rank card</Text>
                  </Pressable>
                </View>

                {/* Quick stat pills */}
                <View style={styles.pillsRow}>
                  <View style={styles.pill}>
                    <Text style={[styles.pillValue, { color: "#F97316" }]}>
                      {profile.current_streak}🔥
                    </Text>
                    <Text style={styles.pillLabel}>STREAK</Text>
                  </View>
                  <View style={styles.pill}>
                    <Text style={[styles.pillValue, { color: "#E5E7EB" }]}>
                      {profile.total_xp.toLocaleString()}
                    </Text>
                    <Text style={styles.pillLabel}>XP</Text>
                  </View>
                  <View style={styles.pill}>
                    <Text style={[styles.pillValue, styles.pillValuePet]}>
                      {profile.pet_name ?? "—"}
                    </Text>
                    <Text style={styles.pillLabel}>PET</Text>
                  </View>
                  <View style={styles.pill}>
                    <Text style={[styles.pillValue, styles.pillValuePet]}>
                      {"—"}
                    </Text>
                    <Text style={styles.pillLabel}>RANK</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Bottom edge line */}
          <LinearGradient
            colors={["transparent", "rgba(139,92,246,0.25)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.heroBottomLine}
          />
        </View>

        {/* Nav rows */}
        <View style={[styles.navSection, { paddingHorizontal: 16 }]}>
          {NAV_ENTRIES.map(({ key, label, Icon }) => {
            const isJourney = key === "ProfileIdentity";
            return (
              <Pressable
                key={key}
                style={({ pressed }) => [
                  styles.navRow,
                  pressed && styles.navRowPressed,
                ]}
                onPress={() =>
                  isJourney ? setJourneyDropdownVisible(true) : openEntry(key)
                }
              >
                <View style={styles.navIconWrap}>
                  <Icon />
                </View>
                {isJourney ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Text style={styles.navRowTitle}>Journey</Text>
                    <Ionicons
                      name="chevron-down"
                      size={10}
                      color="#6B7280"
                    />
                  </View>
                ) : (
                  <Text style={styles.navRowTitle}>{label}</Text>
                )}
                <Ionicons name="chevron-forward" size={16} color="#374151" />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {journeyDropdownVisible && (
        <>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setJourneyDropdownVisible(false)}
          >
            <BlurView intensity={6} tint="dark" style={StyleSheet.absoluteFill} />
          </Pressable>
          <View style={[styles.journeyDropdownCard, { top: journeyDropdownTop }]}>
            <LinearGradient
              colors={["transparent", "rgba(139,92,246,0.30)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.journeyDropdownAccent}
            />
            <Text style={styles.journeyDropdownTitle}>Journey</Text>
            <Pressable
              style={styles.journeyOption}
              onPress={() => {
                setJourneyDropdownVisible(false);
                navigation.navigate("ProfileIdentity");
              }}
            >
              <View style={styles.journeyIconBoxIdentity}>
                <Svg width={18} height={22} viewBox="0 0 18 22" fill="none">
                  <Path
                    d="M9 2.5C6.514 2.5 4.5 4.514 4.5 7C4.5 10.25 9 19.5 9 19.5C9 19.5 13.5 10.25 13.5 7C13.5 4.514 11.486 2.5 9 2.5Z"
                    stroke="#8B5CF6"
                    strokeWidth={1.4}
                  />
                  <Circle cx={9} cy={7} r={2} fill="#8B5CF6" />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.journeyOptionTitle}>Identity</Text>
                <Text style={styles.journeyOptionSub}>
                  Your character stages, XP progress & evolution history
                </Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.journeyOption, styles.journeyOptionLast]}
              onPress={() => {
                setJourneyDropdownVisible(false);
                navigation.navigate("ProfileCompanion");
              }}
            >
              <View style={styles.journeyIconBoxCompanion}>
                <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
                  <Path
                    d="M5 14C5 10 7 7 10 7C13 7 15 9 15 12C15 14.5 13.5 16 11.5 16C10 16 9 15 8.5 14"
                    stroke="#10B981"
                    strokeWidth={1.4}
                    strokeLinecap="round"
                  />
                  <Circle cx={7} cy={6} r={1.3} fill="#10B981" />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.journeyOptionTitle}>Companion</Text>
                <Text style={styles.journeyOptionSub}>
                  Your pet stages, Pet Food progress & companion history
                </Text>
              </View>
            </Pressable>
          </View>
        </>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  hero: {
    width: "100%",
    position: "relative",
  },
  heroRadial: {
    position: "absolute",
    top: 0,
    left: "5%",
    right: "5%",
    height: 280,
    backgroundColor: "rgba(80,20,160,0.22)",
    borderRadius: 9999,
    transform: [{ scaleX: 1.8 }, { scaleY: 1.2 }],
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    position: "relative",
    paddingBottom: 16,
  },
  heroBottomLine: {
    height: 1,
    width: "100%",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 0,
  },
  profilePic: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: "rgba(139,92,246,0.4)",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(109,40,217,0.25)", shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }
      : {}),
  },
  profileInitial: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "rgba(167,139,250,0.8)",
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  stageBadge: {
    alignSelf: "center",
    marginTop: 16,
    marginBottom: 10,
    backgroundColor: "rgba(139,92,246,0.10)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.20)",
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  stageBadgeText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    color: "rgba(167,139,250,0.6)",
  },
  charPetRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  charWrap: {
    width: 96,
    height: 144,
    borderRadius: 14,
    position: "relative",
  },
  charRim: {
    position: "absolute",
    top: 0,
    left: "15%",
    right: "15%",
    height: 1,
    zIndex: 1,
  },
  charPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.15)",
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(80,20,160,0.15)", shadowRadius: 30, shadowOffset: { width: 0, height: 0 } }
      : {}),
  },
  petWrap: {
    marginBottom: 14,
  },
  petCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1.5,
    borderColor: "rgba(139,92,246,0.35)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(109,40,217,0.22)", shadowRadius: 16, shadowOffset: { width: 0, height: 0 } }
      : {}),
  },
  heroUsername: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  powerShareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 12,
    gap: 12,
  },
  powerBlock: {
    alignItems: "flex-start",
    gap: 2,
    flexShrink: 0,
  },
  powerLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
    color: "#4B5563",
  },
  powerValue: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
    letterSpacing: -0.8,
    lineHeight: 28,
  },
  shareRankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  shareRankText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#6D28D9",
  },
  pillsRow: {
    flexDirection: "row",
    gap: 6,
    paddingBottom: 16,
  },
  pill: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.4)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minWidth: 0,
  },
  pillValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  pillValuePet: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
  },
  pillLabel: {
    fontSize: 8,
    color: "#374151",
    letterSpacing: 0.5,
  },
  navSection: {
    paddingTop: 24,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#111623",
    borderWidth: 1,
    borderColor: "#1A1F30",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  navRowPressed: {
    transform: [{ scale: 0.98 }],
  },
  navIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "rgba(139,92,246,0.10)",
    borderWidth: 1,
    borderColor: "rgba(109,40,217,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  navRowTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#E5E7EB",
  },
  journeyDropdownCard: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 260,
    backgroundColor: "#111623",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.60)",
    overflow: "hidden",
    shadowColor: "rgba(0,0,0,0.60)",
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 16 },
    elevation: 20,
  },
  journeyDropdownAccent: {
    position: "absolute",
    top: 0,
    left: "15%",
    right: "15%",
    height: 1,
  },
  journeyDropdownTitle: {
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 16,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#374151",
    textAlign: "center",
  },
  journeyOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.35)",
  },
  journeyOptionLast: {
    borderBottomWidth: 0,
  },
  journeyIconBoxIdentity: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(109,40,217,0.15)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.28)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  journeyIconBoxCompanion: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(6,78,59,0.20)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.28)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  journeyOptionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
    marginBottom: 2,
  },
  journeyOptionSub: {
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 16,
  },
});
