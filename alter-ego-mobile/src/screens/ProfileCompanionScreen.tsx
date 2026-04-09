import React, { useMemo, useRef, useState } from "react";
import type { UserProfile } from "@/store/userStore";
import {
  PET_PF_THRESHOLDS,
  PET_STAGE_NAMES,
  TOTAL_PET_STAGES,
} from "@/constants/petProgression";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Pressable,
  Modal,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { CompanionShareCard } from "../components/CompanionShareCard";
import { useProfileCompanion } from "@/hooks/useProfile";
import { useUserStore } from "@/store/userStore";
import { SkeletonBlock } from "@/components/SkeletonBlock";
import { getPetImageSource } from "@/constants/characterPetAssets";

interface PetStageHistoryItem {
  stage: number;
  name: string;
  pf_required: number;
  pf_next: number | null;
  unlocked: boolean;
  current: boolean;
  earned_at: string | null;
}

interface CompanionData {
  pet_unlocked: boolean;
  current_pet_stage: number;
  current_pet_name: string | null;
  total_pf: number;
  pf_to_next: number;
  progress_pct: number;
  companions: PetStageHistoryItem[];
}

/** When /profile/companion fails, use cached overview profile so the screen still opens. */
function buildCompanionFromProfile(p: UserProfile): CompanionData {
  const current_pet = Math.min(
    TOTAL_PET_STAGES,
    Math.max(0, p.pet_stage ?? 0)
  );
  const total_pf = p.total_pf ?? 0;
  const pet_unlocked = p.pet_unlocked ?? false;
  const companions: PetStageHistoryItem[] = [];
  for (let i = 1; i <= TOTAL_PET_STAGES; i++) {
    const threshold = PET_PF_THRESHOLDS[i - 1];
    const next_threshold =
      i < TOTAL_PET_STAGES ? PET_PF_THRESHOLDS[i] : null;
    companions.push({
      stage: i,
      name: PET_STAGE_NAMES[i - 1],
      pf_required: threshold,
      pf_next: next_threshold,
      unlocked: pet_unlocked && i <= current_pet,
      current: i === current_pet,
      earned_at: null,
    });
  }
  return {
    pet_unlocked,
    current_pet_stage: current_pet,
    current_pet_name: p.pet_name ?? (current_pet > 0 ? PET_STAGE_NAMES[current_pet - 1] : null),
    total_pf,
    pf_to_next: p.pf_to_next_pet ?? 0,
    progress_pct: p.pf_progress_pct ?? 0,
    companions,
  };
}

export function ProfileCompanionScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [cardVisible, setCardVisible] = useState(false);
  const [selectedStage, setSelectedStage] = useState<number>(1);
  const [selectedPetName, setSelectedPetName] = useState<string>("Cat");
  const [selectedUnlocked, setSelectedUnlocked] = useState(true);
  const cardRef = useRef<View>(null);
  const profile = useUserStore((state) => state.profile);
  const username = profile?.username ?? "";

  const {
    data,
    isPending,
    isError,
    refetch,
  } = useProfileCompanion() as {
    data: CompanionData | undefined;
    isPending: boolean;
    isError: boolean;
    refetch: () => void;
  };

  const fallbackCompanion = useMemo(
    () => (profile ? buildCompanionFromProfile(profile) : null),
    [profile]
  );

  const display = data ?? (isError ? fallbackCompanion : null);
  const usingCachedFallback = isError && !data && !!fallbackCompanion;
  const loading = isPending && !display;

  const current = display;

  /** Merge profile when API omits pet_stage (keeps hero + list in sync with overview). */
  const currentStage = useMemo(() => {
    if (!current) return 0;
    const api = Number(current.current_pet_stage ?? 0);
    if (api > 0) return Math.min(8, api);
    const unlocked = current.pet_unlocked ?? profile?.pet_unlocked ?? false;
    const ps = Number(profile?.pet_stage ?? 0);
    if (unlocked && ps > 0) return Math.min(8, ps);
    return 0;
  }, [current, profile]);

  const heroPetStage = useMemo(() => {
    if (!current) return 1;
    const unlocked = current.pet_unlocked ?? profile?.pet_unlocked ?? false;
    if (!unlocked) return 1;
    return Math.min(8, Math.max(1, currentStage > 0 ? currentStage : 1));
  }, [current, currentStage, profile]);

  const pfThreshold =
    current?.companions?.find((c) => c.stage === currentStage)?.pf_next ??
    current?.companions?.find((c) => c.stage === Math.max(1, currentStage))?.pf_required ??
    0;
  const pfPct = current ? Math.max(0, Math.min(1, (current.progress_pct ?? 0) / 100)) : 0;

  const openShareCardFor = (st: PetStageHistoryItem) => {
    setSelectedStage(st.stage);
    setSelectedPetName(st.name);
    setSelectedUnlocked(st.unlocked);
    setCardVisible(true);
  };

  const tierLabelForStage = (stage: number): string => {
    const tiers = [
      "Gift",
      "Easy",
      "Medium",
      "Med-Hard",
      "Hard",
      "Very Hard",
      "Hellish",
      "Monument",
    ];
    return tiers[Math.min(7, Math.max(0, stage - 1))] ?? "Gift";
  };

  const reachedDateFor = (_st: PetStageHistoryItem) => {
    // Phase 1: we don't have a real reached_date in backend yet.
    const d = new Date();
    return d.toLocaleDateString(undefined, { month: "long", day: "2-digit", year: "numeric" });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={["#060E08", "#030A06", "#060E08"]}
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
            <Ionicons name="chevron-back" size={22} color="#6EE7B7" />
          </Pressable>
          <Text style={styles.headerTitle}>Companion</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ marginTop: 16 }}>
            <SkeletonBlock width={120} height={120} borderRadius={60} style={{ alignSelf: "center" }} />
            <View style={{ height: 14 }} />
            <SkeletonBlock width={100} height={20} style={{ alignSelf: "center" }} delay={100} />
            <View style={{ height: 14 }} />
            <SkeletonBlock width="100%" height={8} borderRadius={99} delay={150} />

            <View style={{ marginTop: 16 }}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 10,
                  }}
                >
                  <SkeletonBlock width={40} height={40} borderRadius={20} delay={i * 50} />
                  <SkeletonBlock width={100} height={14} delay={i * 50 + 20} />
                  <SkeletonBlock
                    width={50}
                    height={10}
                    delay={i * 50 + 40}
                    style={{ marginLeft: "auto" }}
                  />
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#060E08", "#030A06", "#060E08"]}
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
          <Ionicons name="chevron-back" size={22} color="#6EE7B7" />
        </Pressable>
        <Text style={styles.headerTitle}>Companion</Text>
        <View style={{ width: 40 }} />
      </View>

      {!current ? (
        <View style={styles.loadingWrap}>
          {isError ? (
            <View style={{ paddingHorizontal: 24, alignItems: "center" }}>
              <Text style={{ color: "#9CA3AF", textAlign: "center", marginBottom: 16 }}>
                Couldn&apos;t load companion from the server. Check your connection or try again.
              </Text>
              <Pressable
                onPress={() => refetch()}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  backgroundColor: "#0f1f14",
                  borderWidth: 1,
                  borderColor: "#14532d",
                }}
              >
                <Text style={{ color: "#6EE7B7", fontFamily: "Inter_600SemiBold" }}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <ActivityIndicator color="#10B981" />
          )}
        </View>
      ) : (
        <>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {usingCachedFallback ? (
            <View
              style={{
                marginBottom: 12,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: "rgba(16,185,129,0.12)",
                borderWidth: 1,
                borderColor: "#14532d",
              }}
            >
              <Text style={{ color: "#6EE7B7", fontSize: 13, textAlign: "center" }}>
                Showing saved companion — server unavailable. Tap Retry in the card area or pull to refresh.
              </Text>
            </View>
          ) : null}
          <View style={styles.currentCard}>
            <LinearGradient
              colors={["transparent", "rgba(52,211,153,0.30)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.currentTopAccent}
            />

            <View style={styles.currentRow}>
              <View style={styles.petArtWrap}>
                <Image
                  source={getPetImageSource(heroPetStage)}
                  style={[styles.petArtImage, !current.pet_unlocked && styles.petArtLocked]}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
              </View>

              <View style={styles.metaCol}>
                <Text style={styles.stageBadge}>{`STAGE ${Math.max(0, currentStage)} · CURRENT`}</Text>
                <Text style={styles.petName}>{current.current_pet_name ?? "—"}</Text>
                <Text style={styles.petSub}>
                  {current.pet_unlocked
                    ? `${current.total_pf.toLocaleString()} PF reached`
                    : "Your companion unlocks on Day 6"}
                </Text>

                <View style={styles.pfRow}>
                  <Text style={styles.pfLabelLeft}>
                    {`🌿 ${current.total_pf.toLocaleString()} / ${pfThreshold.toLocaleString()} PF`}
                  </Text>
                  <Text style={styles.pfLabelRight}>{`→ ${nextPetName(currentStage + 1)}`}</Text>
                </View>

                <View style={styles.pfTrackBg}>
                  <LinearGradient
                    colors={["#059669", "#10B981", "#34D399"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.pfTrackFill, { width: `${pfPct * 100}%` }]}
                  />
                </View>

                {isError ? (
                  <Pressable onPress={() => refetch()} hitSlop={8} style={{ alignSelf: "flex-end", marginTop: 6 }}>
                    <Text style={[styles.daysEstimate, { color: "#34D399" }]}>Retry</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.daysEstimate}>{`Progress: ${(current.progress_pct ?? 0).toFixed(1)}%`}</Text>
                )}
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statsPill}>
                <Text style={styles.statsValue}>
                  {current.total_pf.toLocaleString()}
                </Text>
                <Text style={styles.statsLabel}>TOTAL PF</Text>
              </View>
              <View style={styles.statsPill}>
                <Text style={styles.statsValue}>
                  {current.pf_to_next.toLocaleString()}
                </Text>
                <Text style={styles.statsLabel}>PF TO NEXT</Text>
              </View>
              <View style={styles.statsPill}>
                <Text style={styles.statsValue}>
                  {Math.max(0, Math.min(8, currentStage)).toString()}
                </Text>
                <Text style={styles.statsLabel}>STAGE</Text>
              </View>
            </View>

            <Text style={styles.historyLabel}>ALL COMPANIONS</Text>

            {current.companions.map((st, idx) => {
              const isLast = idx === current.companions.length - 1;
              const isCurrent = st.current;
              const isLocked = !st.unlocked;
              const isCompleted = st.unlocked && !st.current;
              const canOpen = st.unlocked;

              return (
                <Pressable
                  key={st.stage}
                  style={[
                    styles.stageRow,
                    !isLast && styles.stageRowBorder,
                    isLocked && styles.stageRowLocked,
                  ]}
                  onPress={canOpen ? () => openShareCardFor(st) : undefined}
                  disabled={!canOpen}
                >
                  {isCurrent && <View style={styles.currentAccentBar} />}
                  <View style={[styles.stageThumb, isLocked && styles.stageThumbLocked]}>
                    {isLocked ? (
                      <Ionicons name="lock-closed" size={18} color="rgba(16,185,129,0.45)" />
                    ) : (
                      <Image
                        source={getPetImageSource(st.stage)}
                        style={styles.stageThumbImage}
                        resizeMode="contain"
                        accessibilityIgnoresInvertColors
                      />
                    )}
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
                      {isLocked ? "Locked companion" : st.name}
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
                        ? `Current · ${current.pf_to_next.toLocaleString()} PF to next`
                        : `Reach ${st.pf_required.toLocaleString()} PF to unlock`}
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
                      color="#0A1A0C"
                    />
                  ) : (
                    <View style={styles.stageRightWrap}>
                      <Pressable
                        onPress={() => openShareCardFor(st)}
                        hitSlop={10}
                        style={({ pressed }) => [
                          styles.shareIconBtn,
                          pressed && { transform: [{ scale: 0.97 }] },
                        ]}
                      >
                        <Ionicons name="share-outline" size={14} color="#34D399" />
                      </Pressable>
                      <Ionicons name="checkmark" size={14} color="#10B981" />
                    </View>
                  )}
                </Pressable>
              );
            })}

          </View>
        </ScrollView>

        <Modal
          visible={cardVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCardVisible(false)}
        >
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.88)" }]}
            onPress={() => setCardVisible(false)}
          />
          <View style={styles.cardContainer} pointerEvents="box-none">
            <View style={styles.cardInner}>
              <CompanionShareCard
                ref={cardRef}
                stage={selectedStage}
                petName={selectedPetName}
                username={username}
                reachedDay={
                  0
                }
                reachedDate={
                  reachedDateFor(
                    current.companions.find((s) => s.stage === selectedStage) ??
                      current.companions[0]
                  )
                }
                totalDays={
                  0
                }
                totalPF={current.total_pf}
                tierLabel={tierLabelForStage(selectedStage)}
                lockedPreview={!selectedUnlocked}
                unlockPfRequired={
                  current.companions.find((s) => s.stage === selectedStage)?.pf_required ?? 0
                }
              />
              <Pressable onPress={() => setCardVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>
          </View>
        </Modal>
        </>
      )}
    </View>
  );
}

function nextPetName(stage: number): string {
  return PET_STAGE_NAMES[Math.min(PET_STAGE_NAMES.length - 1, Math.max(0, stage - 1))];
}

function roughTimeForPf(pf: number): string {
  if (pf >= 150000) return "years";
  if (pf >= 80000) return "many months";
  if (pf >= 40000) return "months";
  if (pf >= 2000) return "weeks";
  return "days";
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(16,185,129,0.15)",
    backgroundColor: "rgba(4,12,6,0.92)",
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#D1FAE5",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  currentCard: {
    backgroundColor: "rgba(6,78,59,0.15)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.20)",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    marginTop: 12,
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
    alignItems: "flex-start",
    columnGap: 16,
    marginBottom: 12,
  },
  petArtWrap: {
    width: 100,
    height: 100,
    overflow: "visible",
    position: "relative",
  },
  petArtImage: {
    width: "100%",
    height: "100%",
  },
  petArtLocked: {
    opacity: 0.42,
  },
  metaCol: { flex: 1, minWidth: 0, paddingTop: 0 },
  stageBadge: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "rgba(52,211,153,0.65)",
    marginBottom: 4,
  },
  petName: {
    fontSize: 24,
    fontWeight: "900",
    color: "#E5E7EB",
    letterSpacing: -0.4,
  },
  petSub: {
    fontSize: 11,
    color: "rgba(52,211,153,0.50)",
    marginBottom: 12,
  },
  pfRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  pfLabelLeft: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(52,211,153,0.70)",
  },
  pfLabelRight: {
    fontSize: 10,
    color: "rgba(16,185,129,0.30)",
  },
  pfTrackBg: {
    height: 6,
    borderRadius: 4,
    backgroundColor: "rgba(5,20,10,0.90)",
    overflow: "hidden",
  },
  pfTrackFill: {
    height: "100%",
    borderRadius: 4,
    shadowColor: "rgba(16,185,129,0.35)",
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    ...Platform.select({
      android: { elevation: 4 },
    }),
  },
  daysEstimate: {
    fontSize: 10,
    color: "rgba(16,185,129,0.30)",
    textAlign: "right",
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    columnGap: 8,
    marginTop: 4,
    marginBottom: 4,
    width: "100%",
    alignSelf: "stretch",
  },
  statsPill: {
    flex: 1,
    backgroundColor: "rgba(6,78,59,0.20)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.15)",
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  statsValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#34D399",
  },
  statsLabel: {
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "rgba(16,185,129,0.40)",
    marginTop: 2,
  },
  historyLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "rgba(16,185,129,0.25)",
    borderTopWidth: 1,
    borderTopColor: "rgba(16,185,129,0.12)",
    paddingTop: 12,
    marginBottom: 10,
    marginTop: 12,
  },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingLeft: 10,
    columnGap: 12,
    position: "relative",
  },
  stageRowLocked: {
    opacity: 0.95,
  },
  stageRightWrap: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  shareIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "rgba(6,78,59,0.20)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  stageRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(10,25,12,0.35)",
  },
  currentAccentBar: {
    position: "absolute",
    left: 0,
    top: 6,
    bottom: 6,
    width: 2,
    backgroundColor: "#10B981",
  },
  stageThumb: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  stageThumbLocked: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.14)",
    backgroundColor: "rgba(5,20,10,0.55)",
  },
  stageThumbImage: {
    width: "100%",
    height: "100%",
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
    color: "#0A1A0C",
  },
  stageRowSub: {
    fontSize: 11,
    color: "rgba(16,185,129,0.35)",
  },
  stageRowSubLocked: {
    color: "rgba(16,185,129,0.20)",
  },
  nowBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.28)",
    backgroundColor: "rgba(16,185,129,0.12)",
  },
  nowBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#34D399",
  },
  cardContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  cardInner: {
    width: "100%",
  },
  closeBtn: {
    position: "absolute",
    top: -10,
    right: -6,
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(4,12,6,0.92)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
});

