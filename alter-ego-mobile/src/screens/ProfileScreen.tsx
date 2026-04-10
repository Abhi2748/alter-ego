/**
 * Profile Screen — Screen title + identity hero card + nav rows to sub-screens.
 * Do NOT touch sub-screens or bottom nav.
 */

import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Circle } from "react-native-svg";
import type { ProfileStackParamList } from "../navigation/types";
import { useUserStore } from "@/store/userStore";
import { SkeletonBlock } from "@/components/SkeletonBlock";
import { SigilMiniPreview } from "@/components/sigil/SigilMiniPreview";
import { useSigilData } from "@/hooks/useSigil";
import { useQuery } from "@tanstack/react-query";
import { leaderboardService } from "@/services/leaderboard";
import { CHARACTER_IDENTITY_PAGE_IMAGE } from "@/constants/characterPetAssets";

/** Matches stage badge / "Stage 1 · The Awakened" accent on this screen */
const PROFILE_HERO_ACCENT = "rgba(167,139,250,0.95)";

/** Stack routes opened from nav rows (no params). Excludes detail routes. */
type ProfileNavRowKey = Exclude<
  keyof ProfileStackParamList,
  "ProfileMain" | "ProfileInterestDetail" | "QuitDetail"
>;

type Nav = CompositeNavigationProp<
  StackNavigationProp<ProfileStackParamList, "ProfileMain">,
  StackNavigationProp<ProfileStackParamList>
>;

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

function QuitsIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle cx={9} cy={9} r={7} stroke="#FB923C" strokeWidth={1.5} fill="none" />
      <Path d="M6 9h6" stroke="#FB923C" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function AetherSigilIcon() {
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: "rgba(167,139,250,0.13)",
        borderWidth: 1.5,
        borderColor: "#A78BFA",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#A78BFA" }} />
    </View>
  );
}

const PROFILE_NAV_ROWS: {
  kind: "sigil" | "stack" | "journey" | "quits" | "leaderboard";
  key?: ProfileNavRowKey;
  label: string;
  Icon: React.FC;
  iconWrap: "violet" | "ember" | "journey" | "quits";
}[] = [
  {
    kind: "stack",
    key: "ProfileStreak",
    label: "Streak",
    Icon: () => <Text style={{ fontSize: 18 }}>🔥</Text>,
    iconWrap: "ember",
  },
  {
    kind: "stack",
    key: "ProfileAbilities",
    label: "Abilities",
    Icon: () => <Text style={{ fontSize: 18 }}>⚡</Text>,
    iconWrap: "violet",
  },
  {
    kind: "stack",
    key: "ProfileInterests",
    label: "Interests",
    Icon: () => (
      <Text style={{ fontSize: 18, color: "#8B5CF6", fontWeight: "700" }}>
        ✦
      </Text>
    ),
    iconWrap: "violet",
  },
  { kind: "sigil", label: "Aether Sigil", Icon: AetherSigilIcon, iconWrap: "violet" },
  {
    kind: "leaderboard",
    label: "Leaderboard",
    Icon: () => <Text style={{ fontSize: 18 }}>🏆</Text>,
    iconWrap: "violet",
  },
  { kind: "journey", key: "ProfileIdentity", label: "Journey", Icon: JourneyIcon, iconWrap: "journey" },
  {
    kind: "stack",
    key: "ProfileWeeklyReport",
    label: "Weekly Report",
    Icon: () => <Ionicons name="bar-chart-outline" size={18} color="#8B5CF6" />,
    iconWrap: "violet",
  },
  { kind: "quits", key: "ProfileQuits", label: "Quits", Icon: QuitsIcon, iconWrap: "quits" },
];

function navIconWrapStyle(
  wrap: "violet" | "ember" | "journey" | "quits"
): typeof styles.navIconWrap {
  if (wrap === "ember") return styles.navIconWrapEmber;
  if (wrap === "journey") return styles.navIconWrapJourney;
  if (wrap === "quits") return styles.navIconWrapQuits;
  return styles.navIconWrap;
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const profile = useUserStore((state) => state.profile);
  const profileLoading = useUserStore((state) => state.isLoading);
  const { data: sigilData } = useSigilData();
  const sigilLevel = sigilData?.sigil_level ?? 1;
  const { data: lbData } = useQuery({
    queryKey: ["leaderboard", "profile-header"],
    queryFn: () => leaderboardService.getLeaderboard(),
    staleTime: 60_000,
  });
  const rankLabel =
    lbData?.current_user?.rank != null && lbData.current_user.rank > 0
      ? String(lbData.current_user.rank)
      : "—";
  const [journeyDropdownVisible, setJourneyDropdownVisible] = useState(false);
  const journeyDropdownTop = 260;

  const openSettings = () => {
    (navigation.getParent() as any)?.navigate("Settings");
  };

  const openMailInbox = () => {
    (navigation.getParent() as any)?.navigate("MailInbox");
  };

  const openSigil = () => {
    (navigation.getParent() as any)?.navigate("SigilScreen");
  };

  const openLeaderboard = () => {
    (navigation.getParent() as any)?.navigate("Leaderboard");
  };

  const openEntry = (screen: ProfileNavRowKey) => {
    navigation.navigate(screen);
  };

  const initial = profile?.username ? profile.username[0].toUpperCase() : "?";

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#09091A", "#07080F"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.fixedHeader,
          {
            paddingTop: insets.top + 10,
            paddingBottom: 12,
            paddingHorizontal: 16,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {profile?.profile_photo_url ? (
              <View style={styles.profilePicRing}>
                <Image
                  source={{ uri: profile.profile_photo_url }}
                  style={styles.profilePicImage}
                  resizeMode="cover"
                />
              </View>
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
            <Text style={styles.headerUsername} numberOfLines={1}>
              {profile?.username ?? "…"}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={openMailInbox} style={styles.settingsBtn} hitSlop={10}>
              <Ionicons name="mail-outline" size={18} color="#6B7280" />
              {(profile?.unread_mail_count ?? 0) > 0 ? <View style={styles.mailBadge} /> : null}
            </Pressable>
            <Pressable onPress={openSettings} style={[styles.settingsBtn, { marginLeft: 8 }]} hitSlop={10}>
              <Ionicons name="settings-outline" size={18} color="#6B7280" />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card — full width zone */}
        <View style={styles.hero}>
          <LinearGradient
            colors={["#09091A", "#07080F"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.heroGradient}
          />

          <View
            style={[
              styles.heroContent,
              {
                paddingTop: 12,
                paddingHorizontal: 16,
              },
            ]}
          >
            {/* Stage badge */}
            <View style={styles.stageBadge}>
              <Text style={styles.stageBadgeText}>
                {profile ? `Stage ${profile.character_stage} · ${profile.character_stage_name}` : "—"}
              </Text>
            </View>

            {/* Character + pet row */}
            {profileLoading || !profile ? (
              <View style={{ marginVertical: 24, width: "100%", alignItems: "center" }}>
                <SkeletonBlock width={120} height={18} />
                <View style={{ height: 10 }} />
                <SkeletonBlock width={80} height={12} delay={100} />
                <View style={{ height: 16 }} />
                <SkeletonBlock
                  width="100%"
                  height={8}
                  borderRadius={99}
                  delay={200}
                  style={{ marginHorizontal: 16 }}
                />
                <View style={{ height: 18 }} />
                <View style={{ flexDirection: "row", gap: 18 }}>
                  <SkeletonBlock width={40} height={20} />
                  <SkeletonBlock width={40} height={20} delay={50} />
                  <SkeletonBlock width={40} height={20} delay={100} />
                  <SkeletonBlock width={40} height={20} delay={150} />
                </View>
              </View>
            ) : (
              <>
                <View style={styles.charRow}>
                  <View style={styles.charWrap}>
                    <Image
                      source={CHARACTER_IDENTITY_PAGE_IMAGE}
                      style={styles.charHeroImage}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                    />
                  </View>
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
                    <Text style={[styles.pillValue, { color: PROFILE_HERO_ACCENT }]}>
                      {profile.total_xp.toLocaleString()}
                    </Text>
                    <Text style={styles.pillLabel}>XP</Text>
                  </View>
                  <View style={styles.pill}>
                    <Text style={[styles.pillValue, { color: PROFILE_HERO_ACCENT }]} numberOfLines={1}>
                      {profile.power_score.toLocaleString()}
                    </Text>
                    <Text style={styles.pillLabel}>POWER</Text>
                  </View>
                  <View style={styles.pill}>
                    <Text style={[styles.pillValue, { color: PROFILE_HERO_ACCENT }]}>{rankLabel}</Text>
                    <Text style={styles.pillLabel}>RANK</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.heroNavDividerWrap} pointerEvents="none">
          <LinearGradient
            colors={["transparent", "rgba(167,139,250,0.12)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.heroNavDividerGlow}
          />
          <LinearGradient
            colors={[
              "transparent",
              "rgba(42,48,80,0.35)",
              "rgba(109,40,217,0.55)",
              "rgba(167,139,250,0.45)",
              "rgba(109,40,217,0.55)",
              "rgba(42,48,80,0.35)",
              "transparent",
            ]}
            locations={[0, 0.12, 0.32, 0.5, 0.68, 0.88, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.heroNavDividerGrad}
          />
        </View>

        <View style={[styles.navSection, { paddingHorizontal: 16 }]}>
          {PROFILE_NAV_ROWS.map((row) => {
            const { kind, key, label, Icon, iconWrap } = row;
            const rowKey =
              kind === "sigil"
                ? "sigil"
                : kind === "leaderboard"
                  ? "leaderboard"
                  : key ?? label;
            const isJourney = kind === "journey";
            const onPress = () => {
              if (kind === "sigil") openSigil();
              else if (kind === "leaderboard") openLeaderboard();
              else if (kind === "journey") setJourneyDropdownVisible(true);
              else if (key) openEntry(key);
            };
            return (
              <Pressable
                key={rowKey}
                style={({ pressed }) => [styles.navRow, pressed && styles.navRowPressed]}
                onPress={onPress}
              >
                <View style={navIconWrapStyle(iconWrap)}>
                  <Icon />
                </View>
                {isJourney ? (
                  <View style={styles.navRowTitleWrap}>
                    <Text style={styles.navRowTitle}>Journey</Text>
                    <Ionicons name="chevron-down" size={10} color="#6B7280" />
                  </View>
                ) : (
                  <Text style={[styles.navRowTitle, styles.navRowTitleGrow]}>{label}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fixedHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(42,48,80,0.85)",
    backgroundColor: "rgba(7,8,15,0.92)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  headerUsername: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    color: PROFILE_HERO_ACCENT,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  scroll: { flex: 1 },
  hero: {
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    position: "relative",
    paddingBottom: 16,
  },
  profilePicRing: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(139,92,246,0.4)",
    overflow: "hidden",
    backgroundColor: "#141824",
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(109,40,217,0.25)", shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }
      : {}),
  },
  profilePicImage: {
    width: "100%",
    height: "100%",
  },
  profilePic: {
    width: 42,
    height: 42,
    borderRadius: 10,
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
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.5)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  mailBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#A78BFA",
    borderWidth: 1.5,
    borderColor: "#141824",
    ...Platform.select({
      ios: {
        shadowColor: "#8B5CF6",
        shadowOpacity: 1,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
      },
      android: {
        elevation: 6,
      },
    }),
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
  charRow: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  charWrap: {
    width: 168,
    height: 252,
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
  },
  charHeroImage: {
    width: "100%",
    height: "100%",
  },
  heroNavDividerWrap: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    height: 3,
    justifyContent: "center",
    position: "relative",
  },
  heroNavDividerGrad: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 1,
    height: 1,
    borderRadius: 1,
  },
  heroNavDividerGlow: {
    height: 3,
    borderRadius: 2,
    opacity: 0.9,
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
  pillLabel: {
    fontSize: 8,
    color: "#374151",
    letterSpacing: 0.5,
  },
  profileTabsSection: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  profileTabRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.5)",
    marginBottom: 4,
  },
  profileTabBtn: {
    flex: 1,
    alignItems: "center",
    paddingBottom: 8,
  },
  profileTabLbl: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#6B7280",
    marginBottom: 6,
  },
  profileTabLblActive: {
    color: "#A78BFA",
    fontFamily: "Inter_700Bold",
  },
  profileTabUnderline: {
    height: 2,
    width: "70%",
    borderRadius: 1,
    backgroundColor: "#8B5CF6",
  },
  profileTabUnderlineHidden: {
    opacity: 0,
  },
  statsTabBlock: {
    paddingVertical: 16,
  },
  statsTabHeading: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    color: "#4B5563",
    marginBottom: 12,
  },
  statsTabGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  miniStatCard: {
    width: "47%",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.4)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 4,
  },
  miniStatVal: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
  },
  miniStatLbl: {
    fontSize: 8,
    fontFamily: "Inter_600SemiBold",
    color: "#4B5563",
    letterSpacing: 0.5,
  },
  streakTeaser: {
    paddingVertical: 20,
    alignItems: "center",
    gap: 10,
  },
  streakTeaserTitle: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    color: "#4B5563",
  },
  streakTeaserVal: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#E5E7EB",
  },
  streakTeaserBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A3050",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  streakTeaserBtnTxt: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#A78BFA",
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
  navIconWrapEmber: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "rgba(249,115,22,0.10)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  navIconWrapJourney: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "rgba(139,92,246,0.10)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  navIconWrapQuits: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "rgba(251,146,60,0.10)",
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  navRowTitleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  navRowTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#E5E7EB",
  },
  navRowTitleGrow: { flex: 1 },
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
