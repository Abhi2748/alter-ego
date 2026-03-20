/**
 * Full-screen milestone card modal. Opens when user taps an unlocked MilestoneRow.
 * M1–M7 variants with per-milestone backgrounds, stats, soul line, share button.
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import type { MilestoneDefinition, InterestMilestone, MilestoneStats } from "../constants/milestoneDefinitions";

const CARD_OPEN_DURATION = 220;
const CARD_CLOSE_DURATION = 160;
const EASE_OUT = Easing.out(Easing.ease);
const EASE_IN = Easing.in(Easing.ease);

const HEATMAP_COLORS = [
  "rgba(139,92,246,0.08)",
  "rgba(109,40,217,0.35)",
  "rgba(139,92,246,0.55)",
  "rgba(167,139,250,0.75)",
  "rgba(192,132,252,0.90)",
];

const CARD_STYLES: Record<
  number,
  { bg: string; border: string; topGlow: string | string[]; radialGlow: string }
> = {
  1: { bg: "#0C0A1A", border: "rgba(139,92,246,0.12)", topGlow: "rgba(139,92,246,0.15)", radialGlow: "rgba(109,40,217,0.05)" },
  2: { bg: "#0E0C20", border: "rgba(139,92,246,0.18)", topGlow: "rgba(139,92,246,0.22)", radialGlow: "rgba(109,40,217,0.08)" },
  3: { bg: "#100E24", border: "rgba(139,92,246,0.25)", topGlow: "rgba(139,92,246,0.32)", radialGlow: "rgba(109,40,217,0.12)" },
  4: { bg: "#130F28", border: "rgba(139,92,246,0.32)", topGlow: "rgba(139,92,246,0.44)", radialGlow: "rgba(109,40,217,0.16)" },
  5: { bg: "#16102E", border: "rgba(139,92,246,0.42)", topGlow: "rgba(139,92,246,0.56)", radialGlow: "rgba(109,40,217,0.20)" },
  6: { bg: "#1A1235", border: "rgba(139,92,246,0.55)", topGlow: "rgba(167,139,250,0.70)", radialGlow: "rgba(109,40,217,0.24)" },
  7: {
    bg: "#1E1438",
    border: "rgba(192,132,252,0.45)",
    topGlow: ["rgba(139,92,246,0.6)", "rgba(245,158,11,0.7)", "rgba(139,92,246,0.6)"],
    radialGlow: "rgba(192,132,252,0.22)",
  },
};

export interface MilestoneCardScreenProps {
  visible: boolean;
  onClose: () => void;
  milestone: InterestMilestone;
  definition: MilestoneDefinition;
  interestName: string;
}

function formatDateStamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatColumn({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.statColumn}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function MilestoneCardScreen({
  visible,
  onClose,
  milestone,
  definition,
  interestName,
}: MilestoneCardScreenProps) {
  const [showToast, setShowToast] = useState(false);
  const cardScale = useSharedValue(0.94);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      cardScale.value = withTiming(1, { duration: CARD_OPEN_DURATION, easing: EASE_OUT });
      cardOpacity.value = withTiming(1, { duration: CARD_OPEN_DURATION, easing: EASE_OUT });
    } else {
      cardScale.value = withTiming(0.94, { duration: CARD_CLOSE_DURATION, easing: EASE_IN });
      cardOpacity.value = withTiming(0, { duration: CARD_CLOSE_DURATION, easing: EASE_IN });
    }
  }, [visible]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const requestClose = () => {
    cardScale.value = withTiming(0.94, { duration: CARD_CLOSE_DURATION, easing: EASE_IN });
    cardOpacity.value = withTiming(
      0,
      { duration: CARD_CLOSE_DURATION, easing: EASE_IN },
      (finished) => {
        if (finished) runOnJS(onClose)();
      }
    );
  };

  const handleBackdropPress = () => {
    requestClose();
  };

  const handleShare = () => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log("Share milestone", definition.id, interestName);
    }
    if (Platform.OS === "android" && typeof (global as any).ToastAndroid !== "undefined") {
      (global as any).ToastAndroid.show("Sharing coming soon", (global as any).ToastAndroid.SHORT);
    } else {
      Alert.alert("", "Sharing coming soon");
    }
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  if (!visible) return null;

  const num = definition.number;
  const isM7 = definition.isRare;
  const cardStyle = CARD_STYLES[num] ?? CARD_STYLES[1];
  const stats = milestone.stats;
  const topGlowIsArray = Array.isArray(cardStyle.topGlow);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
        <Animated.View style={[styles.cardWrap, cardAnimatedStyle]}>
          <Pressable style={styles.cardPressable} onPress={(e) => e.stopPropagation()}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: cardStyle.bg,
                    borderColor: isM7 ? "rgba(245,158,11,0.15)" : cardStyle.border,
                  },
                ]}
              >
                {/* Top glow */}
                <View style={styles.topGlowWrap}>
                  {topGlowIsArray ? (
                    <LinearGradient
                      colors={cardStyle.topGlow as string[]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.topGlowLine}
                    />
                  ) : (
                    <View style={[styles.topGlowLine, { backgroundColor: cardStyle.topGlow as string }]} />
                  )}
                </View>

                {/* Radial glow */}
                <View
                  style={[
                    styles.radialGlow,
                    {
                      backgroundColor: cardStyle.radialGlow,
                    },
                  ]}
                  pointerEvents="none"
                />

                {/* Exit button */}
                <Pressable style={[styles.exitBtn, isM7 && styles.exitBtnM7]} onPress={requestClose}>
                  <Text style={styles.exitBtnText}>✕</Text>
                </Pressable>

                <Text style={styles.milestoneNumberLabel}>MILESTONE 0{num}</Text>

                {/* Icon zone */}
                {isM7 ? (
                  <View style={styles.iconZoneM7}>
                    <View style={styles.iconRingM7}>
                      <Text style={styles.iconEmojiM7}>👑</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.iconZone}>
                    <Text style={styles.iconEmoji}>{definition.id === "fifty_sessions" ? (milestone.interest_icon ?? "✨") : (definition.icon ?? "⚡")}</Text>
                  </View>
                )}

                <Text style={styles.title}>{definition.title}</Text>
                <Text style={[styles.interestTag, isM7 && styles.interestTagM7]}>{interestName}</Text>

                <View style={styles.dividerWrap}>
                  <LinearGradient
                    colors={isM7 ? ["transparent", "rgba(245,158,11,0.30)", "transparent"] : ["transparent", "rgba(139,92,246,0.25)", "transparent"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </View>

                {/* Soul line */}
                <View style={[styles.soulLine, isM7 && styles.soulLineM7]}>
                  <Text style={[styles.soulLineText, isM7 && styles.soulLineTextM7]}>{milestone.soul_line ?? ""}</Text>
                </View>

                {/* Stats — by milestone */}
                {stats && (
                  <View style={styles.statsSection}>
                    {num === 1 && (
                      <View style={styles.statsRow}>
                        <StatColumn value={stats.sessions_count} label="Sessions" />
                        <View style={styles.statDivider} />
                        <StatColumn value={stats.xp_total} label="XP Earned" />
                        <View style={styles.statDivider} />
                        <StatColumn value={stats.tier} label="Tier" />
                      </View>
                    )}
                    {num === 2 && (
                      <>
                        <View style={styles.statsRow}>
                          <StatColumn value={stats.sessions_count} label="Sessions" />
                          <View style={styles.statDivider} />
                          <StatColumn value={stats.streak_days ?? 0} label="Day Streak" />
                          <View style={styles.statDivider} />
                          <StatColumn value={stats.xp_total} label="XP Total" />
                        </View>
                        {stats.heatmap_days && stats.heatmap_days.length >= 7 && (
                          <View style={styles.heatmapRow7}>
                            {stats.heatmap_days.slice(0, 7).map((v, i) => (
                              <View key={i} style={[styles.heatmapCell, { backgroundColor: HEATMAP_COLORS[v] ?? HEATMAP_COLORS[0] }]} />
                            ))}
                          </View>
                        )}
                      </>
                    )}
                    {num === 3 && (
                      <>
                        <View style={styles.statsRow}>
                          <StatColumn value={stats.sessions_count} label="Sessions" />
                          <View style={styles.statDivider} />
                          <StatColumn value={stats.xp_total} label="XP Total" />
                          <View style={styles.statDivider} />
                          <StatColumn value={stats.tier} label="Tier" />
                        </View>
                        <View style={styles.tierBarWrap}>
                          <Text style={styles.tierBarLabel}>Current Tier</Text>
                          <Text style={styles.tierBarValue}>{stats.tier}</Text>
                        </View>
                        <View style={styles.tierBarTrack}>
                          <View style={[styles.tierBarFill, { width: `${stats.tier_bar_pct ?? 0}%` }]}>
                            <LinearGradient colors={["#6D28D9", "#A78BFA"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                          </View>
                        </View>
                      </>
                    )}
                    {num === 4 && (
                      <>
                        <View style={styles.statsRowTier}>
                          <View style={styles.statColumn}>
                            <Text style={styles.statValue}>{stats.old_tier ?? "Easy"}</Text>
                            <Text style={styles.statLabel}>Was</Text>
                          </View>
                          <View style={styles.statColumn}>
                            <Text style={styles.statValueViolet}>→ Tier Jump</Text>
                            <Text style={styles.statLabel}> </Text>
                          </View>
                          <View style={styles.statColumn}>
                            <Text style={styles.statValue}>{stats.new_tier ?? "Medium"}</Text>
                            <Text style={styles.statLabel}>Now</Text>
                          </View>
                        </View>
                        <View style={styles.tierBarTrack}>
                          <LinearGradient colors={["#6D28D9", "#C084FC"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.tierBarFull]} />
                        </View>
                      </>
                    )}
                    {num === 5 && (
                      <>
                        <View style={styles.statsRow}>
                          <StatColumn value={stats.days_since_start ?? 0} label="Days" />
                          <View style={styles.statDivider} />
                          <StatColumn value={stats.sessions_count} label="Sessions" />
                          <View style={styles.statDivider} />
                          <StatColumn value={stats.best_streak ?? 0} label="Best Streak" />
                        </View>
                        {stats.heatmap_month && stats.heatmap_month.length >= 30 && (
                          <View style={styles.heatmapMonthWrap}>
                            {Array.from({ length: 30 }, (_, i) => (
                              <View key={i} style={[styles.heatmapCellMonth, { backgroundColor: HEATMAP_COLORS[stats!.heatmap_month![i]] ?? HEATMAP_COLORS[0] }]} />
                            ))}
                          </View>
                        )}
                      </>
                    )}
                    {num === 6 && (
                      <>
                        <View style={styles.statsRow}>
                          <StatColumn value={stats.sessions_count} label="Sessions" />
                          <View style={styles.statDivider} />
                          <StatColumn value={stats.xp_total} label="XP Total" />
                          <View style={styles.statDivider} />
                          <StatColumn value={stats.tier} label="Tier" />
                        </View>
                        <View style={styles.tierBarWrap}>
                          <Text style={styles.tierBarLabel}>Current Tier</Text>
                          <Text style={styles.tierBarValue}>{stats.tier}</Text>
                        </View>
                        <View style={styles.tierBarTrack}>
                          <View style={[styles.tierBarFill, { width: `${stats.tier_bar_pct ?? 0}%` }]}>
                            <LinearGradient colors={["#6D28D9", "#A78BFA"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                          </View>
                        </View>
                      </>
                    )}
                    {num === 7 && (
                      <View style={styles.statsGridM7}>
                        <View style={styles.statsGridItem}>
                          <Text style={styles.statValueM7Gold}>{stats.sessions_count}</Text>
                          <Text style={styles.statLabel}>Sessions</Text>
                        </View>
                        <View style={styles.statsGridItem}>
                          <Text style={styles.statValueM7White}>{stats.days_since_start ?? 0}</Text>
                          <Text style={styles.statLabel}>Days Since Start</Text>
                        </View>
                        <View style={styles.statsGridItem}>
                          <Text style={styles.statValueM7Gold}>{stats.xp_total}</Text>
                          <Text style={styles.statLabel}>XP Earned</Text>
                        </View>
                        <View style={styles.statsGridItem}>
                          <Text style={styles.statValueM7White}>{stats.best_streak ?? 0}</Text>
                          <Text style={styles.statLabel}>Best Streak</Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {milestone.earned_at && (
                  <Text style={[styles.dateStamp, isM7 && styles.dateStampM7]}>{formatDateStamp(milestone.earned_at)}</Text>
                )}

                <View style={styles.shareBtnWrap}>
                  <Pressable style={[styles.shareBtn, isM7 && styles.shareBtnM7]} onPress={handleShare}>
                  <LinearGradient
                    colors={isM7 ? ["#B45309", "#F59E0B"] : ["#6D28D9", "#8B5CF6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.shareBtnGradient}
                  >
                    <Text style={styles.shareBtnText}>↗  Share this milestone</Text>
                  </LinearGradient>
                </Pressable>
                </View>
              </View>
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(5,6,12,0.92)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  cardWrap: {
    width: "100%",
    maxWidth: 400,
  },
  cardPressable: {
    width: "100%",
  },
  scroll: { maxHeight: "90%", width: "100%" },
  scrollContent: { paddingVertical: 24, paddingBottom: 48, flexGrow: 1 },
  card: {
    width: "100%",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 24,
    borderWidth: 1,
    position: "relative",
    overflow: "hidden",
  },
  topGlowWrap: {
    position: "absolute",
    top: 0,
    left: "50%",
    marginLeft: -60,
    width: 120,
    height: 2,
    borderRadius: 1,
    overflow: "hidden",
  },
  topGlowLine: {
    width: "100%",
    height: "100%",
    borderRadius: 1,
  },
  radialGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "55%",
    borderRadius: 20,
    opacity: 0.6,
    pointerEvents: "none",
  },
  exitBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(139,92,246,0.10)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  exitBtnM7: {
    backgroundColor: "rgba(245,158,11,0.08)",
    borderColor: "rgba(245,158,11,0.20)",
  },
  exitBtnText: {
    fontSize: 13,
    color: "#6B7280",
  },
  milestoneNumberLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#6B7280",
    marginBottom: 16,
  },
  iconZone: {
    alignItems: "center",
    marginBottom: 12,
  },
  iconEmoji: {
    fontSize: 34,
    textShadowColor: "rgba(139,92,246,0.50)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  iconZoneM7: {
    alignItems: "center",
    marginBottom: 12,
  },
  iconRingM7: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: "rgba(245,158,11,0.55)",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "ios"
      ? { shadowColor: "#F59E0B", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 16 }
      : { elevation: 12 }),
  },
  iconEmojiM7: {
    fontSize: 26,
    textShadowColor: "rgba(245,158,11,0.55)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#E5E7EB",
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  interestTag: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#8B5CF6",
    textAlign: "center",
    marginBottom: 14,
  },
  interestTagM7: {
    color: "#F59E0B",
  },
  dividerWrap: {
    height: 1,
    width: "100%",
    marginBottom: 14,
    overflow: "hidden",
    borderRadius: 1,
  },
  soulLine: {
    backgroundColor: "rgba(139,92,246,0.07)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.14)",
    borderLeftWidth: 3,
    borderLeftColor: "#8B5CF6",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  soulLineM7: {
    borderLeftColor: "#F59E0B",
    backgroundColor: "rgba(245,158,11,0.05)",
    borderColor: "rgba(245,158,11,0.14)",
  },
  soulLineText: {
    fontSize: 12,
    fontStyle: "italic",
    color: "#9CA3AF",
    lineHeight: 19,
  },
  soulLineTextM7: {
    color: "#FCD34D",
  },
  statsSection: {
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  statColumn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 10,
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(139,92,246,0.10)",
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#A78BFA",
  },
  statValueGold: {
    color: "#F59E0B",
  },
  statLabel: {
    fontSize: 8,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#6B7280",
    marginTop: 2,
  },
  heatmapRow7: {
    flexDirection: "row",
    gap: 3,
    marginTop: 8,
  },
  heatmapCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  tierBarWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  tierBarLabel: {
    fontSize: 9,
    color: "#6B7280",
  },
  tierBarValue: {
    fontSize: 9,
    color: "#8B5CF6",
  },
  tierBarTrack: {
    height: 5,
    backgroundColor: "rgba(139,92,246,0.10)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 14,
  },
  tierBarFill: {
    height: "100%",
    borderRadius: 4,
    overflow: "hidden",
  },
  tierBarFull: {
    width: "100%",
    height: 5,
    borderRadius: 4,
  },
  statsRowTier: {
    flexDirection: "row",
    marginBottom: 14,
  },
  statValueViolet: {
    fontSize: 16,
    fontWeight: "800",
    color: "#C084FC",
  },
  heatmapMonthWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    marginTop: 8,
  },
  heatmapCellMonth: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  statsGridM7: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statsGridItem: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.025)",
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.10)",
  },
  statValueM7Gold: {
    fontSize: 15,
    fontWeight: "800",
    color: "#F59E0B",
  },
  statValueM7White: {
    fontSize: 15,
    fontWeight: "800",
    color: "#E5E7EB",
  },
  dateStamp: {
    fontSize: 9,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 14,
  },
  dateStampM7: {
    color: "rgba(245,158,11,0.55)",
  },
  shareBtnWrap: {
    width: "100%",
    marginTop: 4,
  },
  shareBtn: {
    width: "100%",
    height: 46,
    borderRadius: 14,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(139,92,246,0.30)", shadowOffset: { width: 0, height: 0 }, shadowRadius: 16 }
      : { elevation: 8 }),
  },
  shareBtnM7: {
    ...(Platform.OS === "ios"
      ? { shadowColor: "rgba(245,158,11,0.28)", shadowOffset: { width: 0, height: 0 }, shadowRadius: 16 }
      : {}),
  },
  shareBtnGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});

export default MilestoneCardScreen;
