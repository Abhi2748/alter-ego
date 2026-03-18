import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useProfileIdentity } from "@/hooks/useProfile";
import { useUserStore } from "@/store/userStore";
import { AchievementCardModal, type TitleStage } from "./ProfileTitlesScreen";

type IdentityStage = {
  stage: number;
  name: string;
  xp_required: number;
  xp_next: number | null;
  unlocked: boolean;
  current: boolean;
  earned_at: string | null;
};

type IdentityResponse = {
  current_stage: number;
  current_stage_name: string;
  total_xp: number;
  xp_to_next: number;
  progress_pct: number;
  stages: IdentityStage[];
};

export function ProfileIdentityScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [shareStage, setShareStage] = useState<TitleStage | null>(null);

  const username = useUserStore((state) => state.profile?.username) ?? "";

  const {
    data,
    isLoading: loading,
    error,
    refetch,
  } = useProfileIdentity() as {
    data: IdentityResponse | undefined;
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
  };

  const toTitleStage = useMemo(
    () => (st: IdentityStage): TitleStage => ({
      stage_number: st.stage,
      title: st.name,
      reached_day: null,
      days_at_stage: null,
      is_current: st.current,
      is_locked: !st.unlocked,
      xp_to_unlock: st.xp_required,
      peak_streak_at_stage: null,
      xp_earned_at_stage: st.current ? (data?.total_xp ?? null) : null,
    }),
    [data?.total_xp]
  );

  const current = data;
  const currentStage = current?.current_stage ?? 1;
  const xpToNext = current?.xp_to_next ?? 0;
  const progressPct = current?.progress_pct ?? 0;

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
          styles.header,
          {
            paddingTop: insets.top + 10,
            paddingBottom: 14,
          },
        ]}
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#6B7280" />
        </Pressable>
        <Text style={styles.headerTitle}>Identity</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading || !current ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#8B5CF6" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.currentCard}>
            <LinearGradient
              colors={["transparent", "rgba(139,92,246,0.25)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.currentTopAccent}
            />

            <View style={styles.currentRow}>
              <View style={styles.stageArtWrap}>
                <LinearGradient
                  colors={
                    currentStage === 1
                      ? ["rgba(50,20,90,0.55)", "rgba(10,10,20,0.90)"]
                      : currentStage === 2
                      ? ["rgba(70,20,130,0.65)", "rgba(10,10,25,0.92)"]
                      : ["rgba(90,35,160,0.70)", "rgba(12,10,30,0.95)"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.stageArt}
                />
                <View style={styles.stageArtBorder} />
                <Text style={styles.stageArtLabel}>{`STAGE ${currentStage}`}</Text>
              </View>

              <View style={styles.metaCol}>
                <Text style={styles.stageBadgeTextLabel}>{`STAGE ${currentStage} · CURRENT`}</Text>
                <Text style={styles.stageName}>{current.current_stage_name}</Text>
                <Text style={styles.stageSub}>
                  {`${current.total_xp.toLocaleString()} XP total`}
                </Text>

                <View style={styles.xpRow}>
                  <Text style={styles.xpLabelLeft}>
                    {`★ ${current.total_xp.toLocaleString()} · ${xpToNext.toLocaleString()} XP to next`}
                  </Text>
                  <Text style={styles.xpLabelRight}>{`→ S${currentStage + 1}`}</Text>
                </View>

                <View style={styles.xpTrackBg}>
                  <LinearGradient
                    colors={["#5B21B6", "#8B5CF6", "#C084FC"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.xpTrackFill, { width: `${Math.max(0, Math.min(100, progressPct))}%` }]}
                  />
                </View>

                {error ? (
                  <Pressable onPress={() => refetch()} hitSlop={8} style={{ alignSelf: "flex-end", marginTop: 6 }}>
                    <Text style={[styles.daysEstimate, { color: "#8B5CF6" }]}>Retry</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.daysEstimate}>{`Progress: ${progressPct.toFixed(1)}%`}</Text>
                )}

                <View style={styles.statsRow}>
                  <View style={styles.statsPill}>
                    <Text style={styles.statsValue}>{currentStage}</Text>
                    <Text style={styles.statsLabel}>STAGE</Text>
                  </View>
                  <View style={styles.statsPill}>
                    <Text style={styles.statsValue}>
                      {current.total_xp.toLocaleString()}
                    </Text>
                    <Text style={styles.statsLabel}>TOTAL XP</Text>
                  </View>
                  <View style={styles.statsPill}>
                    <Text style={styles.statsValue}>
                      {xpToNext.toLocaleString()}
                    </Text>
                    <Text style={styles.statsLabel}>XP TO NEXT</Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={styles.historyLabel}>ALL STAGES</Text>

            {current.stages.map((st, idx) => {
              const isLast = idx === current.stages.length - 1;
              const isCurrent = st.current;
              const isLocked = !st.unlocked;
              const isCompleted = st.unlocked && !st.current;

              const opacity =
                isLocked && st.stage > currentStage
                  ? 0.3 - 0.05 * Math.max(0, st.stage - currentStage - 1)
                  : 1;

              return (
                <Pressable
                  key={st.stage}
                  style={[
                    styles.stageRow,
                    !isLast && styles.stageRowBorder,
                    { opacity },
                  ]}
                  onPress={() => {
                    if (isLocked) return;
                    setShareStage(toTitleStage(st));
                  }}
                >
                  {isCurrent && <View style={styles.stageCurrentAccent} />}
                  <View
                    style={[
                      styles.stageThumb,
                      isCurrent
                        ? styles.stageThumbCurrent
                        : isLocked
                        ? styles.stageThumbLocked
                        : styles.stageThumbDone,
                    ]}
                  >
                    <Text
                      style={[
                        styles.stageThumbText,
                        isLocked && styles.stageThumbTextLocked,
                      ]}
                    >
                      {`S${st.stage}`}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.stageRowName,
                        isCurrent
                          ? styles.stageRowNameCurrent
                          : isLocked
                          ? styles.stageRowNameLocked
                          : styles.stageRowNameDone,
                      ]}
                    >
                      {st.name}
                    </Text>
                    <Text
                      style={[
                        styles.stageRowSub,
                        isLocked && styles.stageRowSubLocked,
                      ]}
                    >
                      {isCompleted
                        ? `Unlocked${st.earned_at ? ` · ${new Date(st.earned_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}`
                        : isCurrent
                        ? `Current · ${xpToNext.toLocaleString()} XP to next`
                        : `${st.xp_required.toLocaleString()} XP needed`}
                    </Text>
                  </View>
                  {isCurrent ? (
                    <View style={styles.nowBadge}>
                      <Text style={styles.nowBadgeText}>NOW</Text>
                    </View>
                  ) : isLocked ? (
                    <Ionicons
                      name="lock-closed-outline"
                      size={14}
                      color="#1A1F30"
                    />
                  ) : (
                    <View style={styles.rowRightWrap}>
                      <Pressable
                        onPress={() => setShareStage(toTitleStage(st))}
                        hitSlop={10}
                        style={({ pressed }) => [
                          styles.shareIconBtn,
                          pressed && { transform: [{ scale: 0.97 }] },
                        ]}
                      >
                        <Ionicons name="share-outline" size={14} color="#A78BFA" />
                      </Pressable>
                      <Ionicons name="checkmark" size={14} color="#8B5CF6" />
                    </View>
                  )}
                </Pressable>
              );
            })}

            <View style={styles.sovereignCard}>
              <LinearGradient
                colors={["rgba(109,40,217,0.15)", "rgba(59,7,100,0.25)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.sovereignIconBox}>
                <Text style={styles.sovereignIconText}>S6</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sovereignTitle}>The Sovereign · Stage 6</Text>
                <Text style={styles.sovereignBody}>
                  1,500,000 XP. The final form. Fewer than 1 in 1,000 users will reach this.
                </Text>
              </View>
            </View>
          </View>

          <AchievementCardModal
            visible={shareStage != null}
              stage={shareStage ?? toTitleStage(current.stages[0])}
            onClose={() => setShareStage(null)}
            username={username}
          />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.35)",
    backgroundColor: "rgba(9,9,26,0.96)",
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#E5E7EB",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  currentCard: {
    backgroundColor: "rgba(14,13,28,0.90)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.50)",
    padding: 18,
    marginTop: 16,
    marginBottom: 14,
    overflow: "hidden",
  },
  currentTopAccent: {
    position: "absolute",
    top: 0,
    left: "15%",
    right: "15%",
    height: 1,
  },
  currentRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    columnGap: 16,
    marginBottom: 16,
  },
  stageArtWrap: {
    width: 90,
    height: 120,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  stageArt: {
    flex: 1,
    borderRadius: 14,
  },
  stageArtBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.28)",
  },
  stageArtLabel: {
    position: "absolute",
    bottom: 6,
    left: 8,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1,
    color: "rgba(139,92,246,0.40)",
  },
  metaCol: { flex: 1 },
  stageBadgeTextLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "rgba(139,92,246,0.60)",
    marginBottom: 4,
  },
  stageName: {
    fontSize: 24,
    fontWeight: "900",
    color: "#E5E7EB",
    letterSpacing: -0.4,
    marginBottom: 3,
  },
  stageSub: {
    fontSize: 11,
    color: "#4B5563",
    marginBottom: 12,
  },
  xpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  xpLabelLeft: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(167,139,250,0.65)",
  },
  xpLabelRight: {
    fontSize: 10,
    color: "#2D3146",
  },
  xpTrackBg: {
    height: 6,
    borderRadius: 4,
    backgroundColor: "rgba(20,20,40,0.90)",
    overflow: "hidden",
  },
  xpTrackFill: {
    height: "100%",
    borderRadius: 4,
    shadowColor: "rgba(139,92,246,0.35)",
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    ...Platform.select({
      android: { elevation: 4 },
    }),
  },
  daysEstimate: {
    fontSize: 10,
    color: "#2D3146",
    textAlign: "right",
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    columnGap: 8,
    marginTop: 12,
  },
  statsPill: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.30)",
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  statsValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#8B5CF6",
  },
  statsLabel: {
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#374151",
    marginTop: 2,
  },
  historyLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#2D3146",
    borderTopWidth: 1,
    borderTopColor: "rgba(42,48,80,0.30)",
    paddingTop: 12,
    marginBottom: 10,
  },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingLeft: 10,
    columnGap: 12,
    position: "relative",
  },
  rowRightWrap: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  shareIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "rgba(109,40,217,0.12)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  stageRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.15)",
  },
  stageCurrentAccent: {
    position: "absolute",
    left: 0,
    top: 6,
    bottom: 6,
    width: 2,
    backgroundColor: "#8B5CF6",
  },
  stageThumb: {
    width: 44,
    height: 58,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  stageThumbDone: {
    backgroundColor: "rgba(42,28,80,0.30)",
    borderWidth: 1,
    borderColor: "rgba(109,40,217,0.20)",
  },
  stageThumbCurrent: {
    backgroundColor: "rgba(60,20,110,0.40)",
    borderWidth: 1.5,
    borderColor: "rgba(139,92,246,0.45)",
  },
  stageThumbLocked: {
    backgroundColor: "rgba(10,10,22,0.50)",
    borderWidth: 1,
    borderColor: "rgba(20,20,40,0.40)",
  },
  stageThumbText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(167,139,250,0.65)",
  },
  stageThumbTextLocked: {
    color: "#1A1F30",
  },
  stageRowName: {
    fontSize: 13,
    fontWeight: "600",
  },
  stageRowNameDone: {
    color: "#6B7280",
  },
  stageRowNameCurrent: {
    color: "#E5E7EB",
  },
  stageRowNameLocked: {
    color: "#1A1F30",
  },
  stageRowSub: {
    fontSize: 11,
    color: "#374151",
  },
  stageRowSubLocked: {
    color: "#111827",
  },
  nowBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.25)",
    backgroundColor: "rgba(139,92,246,0.10)",
  },
  nowBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#A78BFA",
  },
  sovereignCard: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.22)",
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    overflow: "hidden",
    position: "relative",
  },
  sovereignIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(109,40,217,0.25)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  sovereignIconText: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(167,139,250,0.45)",
  },
  sovereignTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(167,139,250,0.65)",
    marginBottom: 3,
  },
  sovereignBody: {
    fontSize: 11,
    color: "#374151",
    lineHeight: 16,
  },
});

