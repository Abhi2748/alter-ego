import React, { useEffect, useState } from "react";
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
import { supabase } from "../utils/supabase";
import { getHome } from "../utils/api";
import { AchievementCardModal, type TitleStage } from "./ProfileTitlesScreen";

interface StageHistoryItem {
  stage: number;
  name: string;
  status: "current" | "completed" | "locked";
  reached_day: number | null;
  left_day: number | null;
  days_spent: number | null;
  xp_required: number;
}

interface IdentityData {
  current_stage: number;
  current_stage_name: string;
  current_xp: number;
  next_stage_xp_threshold: number;
  total_xp: number;
  days_active: number;
  days_to_next_stage_estimate: number;
  stage_history: StageHistoryItem[];
}

const PLACEHOLDER_IDENTITY: IdentityData = {
  current_stage: 2,
  current_stage_name: "The Focused",
  current_xp: 3240,
  next_stage_xp_threshold: 10000,
  total_xp: 3240,
  days_active: 45,
  days_to_next_stage_estimate: 18,
  stage_history: [
    {
      stage: 1,
      name: "The Awakened",
      status: "completed",
      reached_day: 1,
      left_day: 27,
      days_spent: 27,
      xp_required: 0,
    },
    {
      stage: 2,
      name: "The Focused",
      status: "current",
      reached_day: 28,
      left_day: null,
      days_spent: 18,
      xp_required: 10000,
    },
    {
      stage: 3,
      name: "The Burning",
      status: "locked",
      reached_day: null,
      left_day: null,
      days_spent: null,
      xp_required: 50000,
    },
    {
      stage: 4,
      name: "The Relentless",
      status: "locked",
      reached_day: null,
      left_day: null,
      days_spent: null,
      xp_required: 200000,
    },
    {
      stage: 5,
      name: "The Formidable",
      status: "locked",
      reached_day: null,
      left_day: null,
      days_spent: null,
      xp_required: 600000,
    },
    {
      stage: 6,
      name: "The Sovereign",
      status: "locked",
      reached_day: null,
      left_day: null,
      days_spent: null,
      xp_required: 1500000,
    },
  ],
};

export function ProfileIdentityScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [data, setData] = useState<IdentityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string>("preview_user");
  const [shareStage, setShareStage] = useState<TitleStage | null>(null);

  useEffect(() => {
    setData(PLACEHOLDER_IDENTITY);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const home = await getHome(session.access_token);
        if (home.username) setUsername(home.username);
      } catch (_) {}
    })();
  }, []);

  const toTitleStage = (st: StageHistoryItem): TitleStage => {
    const isCurrent = st.status === "current";
    const isLocked = st.status === "locked";
    return {
      stage_number: st.stage,
      title: st.name,
      reached_day: st.reached_day,
      days_at_stage: st.days_spent,
      is_current: isCurrent,
      is_locked: isLocked,
      xp_to_unlock: st.xp_required,
      peak_streak_at_stage: null,
      xp_earned_at_stage: isCurrent ? (data?.total_xp ?? null) : null,
    };
  };

  const current = data;
  const currentStage = current?.current_stage ?? 1;
  const xpThreshold = current?.next_stage_xp_threshold ?? 10000;
  const xpPct =
    current && xpThreshold > 0
      ? Math.min(1, current.current_xp / xpThreshold)
      : 0;

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
                  {`Day ${current.days_active} · ${current.total_xp.toLocaleString()} XP total`}
                </Text>

                <View style={styles.xpRow}>
                  <Text style={styles.xpLabelLeft}>
                    {`★ ${current.current_xp.toLocaleString()} / ${xpThreshold.toLocaleString()} XP`}
                  </Text>
                  <Text style={styles.xpLabelRight}>{`→ S${currentStage + 1}`}</Text>
                </View>

                <View style={styles.xpTrackBg}>
                  <LinearGradient
                    colors={["#5B21B6", "#8B5CF6", "#C084FC"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.xpTrackFill, { width: `${xpPct * 100}%` }]}
                  />
                </View>

                <Text style={styles.daysEstimate}>
                  {`~${current.days_to_next_stage_estimate} days to next stage at current pace`}
                </Text>

                <View style={styles.statsRow}>
                  <View style={styles.statsPill}>
                    <Text style={styles.statsValue}>{current.days_active}</Text>
                    <Text style={styles.statsLabel}>DAYS ACTIVE</Text>
                  </View>
                  <View style={styles.statsPill}>
                    <Text style={styles.statsValue}>
                      {current.total_xp.toLocaleString()}
                    </Text>
                    <Text style={styles.statsLabel}>TOTAL XP</Text>
                  </View>
                  <View style={styles.statsPill}>
                    <Text style={styles.statsValue}>
                      {(xpThreshold - current.current_xp).toLocaleString()}
                    </Text>
                    <Text style={styles.statsLabel}>XP TO NEXT</Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={styles.historyLabel}>ALL STAGES</Text>

            {current.stage_history.map((st, idx) => {
              const isLast = idx === current.stage_history.length - 1;
              const isCurrent = st.status === "current";
              const isLocked = st.status === "locked";
              const isCompleted = st.status === "completed";

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
                        ? `Day ${st.reached_day} → Day ${st.left_day} · ${st.days_spent} days`
                        : isCurrent
                        ? `Day ${st.reached_day} → now · current`
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
            stage={shareStage ?? toTitleStage(current.stage_history[0])}
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

