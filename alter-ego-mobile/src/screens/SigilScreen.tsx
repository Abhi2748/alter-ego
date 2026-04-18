import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { Ionicons } from "@expo/vector-icons";
import { SIGIL_LEVELS } from "@/constants/sigils";
import { useSigilData } from "@/hooks/useSigil";
import { SigilGlow } from "@/components/sigil/SigilGlow";
import { SigilRenderer } from "@/components/sigil/SigilRenderer";
import { SigilAmbientOrb } from "@/components/sigil/SigilAmbientOrb";
import { DEFAULT_SIGIL_SIZE } from "@/components/sigil/sigilTypes";
import { getErrorMessage } from "@/services/api";
import { useUserStore } from "@/store/userStore";

const BG = "#030305";
const TEXT_MUTED = "#6B7280";
const TEXT_DIM = "#9CA3AF";
const CANVAS = DEFAULT_SIGIL_SIZE;

function DormantSigilScreen({
  insets,
  onBack,
  capPct,
  xpToday,
  dailyCap,
}: {
  insets: { top: number; bottom: number };
  onBack: () => void;
  capPct: number;
  xpToday: number;
  dailyCap: number;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Top bar */}
      <View
        style={[
          styles.topBar,
          { paddingTop: insets.top + 8 },
        ]}
      >
        <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#3D4570" />
        </Pressable>
        <Text style={[styles.title, { color: "#3D4570" }]}>AETHER SIGIL</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          alignItems: "center",
          paddingBottom: 40 + insets.bottom,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Dormant orb */}
        <View style={dormantStyles.orbWrap}>
          {/* Outer ring */}
          <View style={dormantStyles.ring1} />
          {/* Mid ring */}
          <View style={dormantStyles.ring2} />
          {/* Inner ring */}
          <View style={dormantStyles.ring3} />
          {/* Core */}
          <View style={dormantStyles.core}>
            <View style={dormantStyles.coreDot} />
          </View>
        </View>

        {/* Dormant label */}
        <Text style={dormantStyles.dormantTitle}>Dormant</Text>
        <Text style={dormantStyles.dormantSub}>Sigil not yet awakened</Text>

        {/* Explanation cards */}
        <View style={dormantStyles.card}>
          {/* What is Aether */}
          <View style={dormantStyles.cardRow}>
            <View style={[dormantStyles.cardIcon, dormantStyles.iconAether]}>
              <Text style={dormantStyles.iconGlyph}>⬡</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={dormantStyles.cardTitle}>What is Aether</Text>
              <Text style={dormantStyles.cardDesc}>
                A rare currency earned only when you push beyond your daily XP
                limit. It cannot be bought or earned any other way.
              </Text>
            </View>
          </View>

          {/* What is Surge */}
          <View style={dormantStyles.cardRow}>
            <View style={[dormantStyles.cardIcon, dormantStyles.iconSurge]}>
              <Text style={dormantStyles.iconGlyph}>◈</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={dormantStyles.cardTitle}>What is Surge Mode</Text>
              <Text style={dormantStyles.cardDesc}>
                When you complete your daily XP cap, Surge activates. Every
                mission completed after the cap earns bonus Aether.
              </Text>
            </View>
          </View>

          {/* What is the Sigil */}
          <View style={[dormantStyles.cardRow, { marginBottom: 0 }]}>
            <View style={[dormantStyles.cardIcon, dormantStyles.iconSigil]}>
              <Text style={dormantStyles.iconGlyph}>✦</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={dormantStyles.cardTitle}>What is the Sigil</Text>
              <Text style={dormantStyles.cardDesc}>
                10 levels of visual identity. Each one evolves as your Aether
                grows — a permanent mark of everything you push beyond.
              </Text>
            </View>
          </View>
        </View>

        {/* How to unlock steps */}
        <View style={dormantStyles.stepsSection}>
          <Text style={dormantStyles.stepsHeader}>How to unlock</Text>
          <View style={dormantStyles.stepRow}>
            <View style={dormantStyles.stepNum}>
              <Text style={dormantStyles.stepN}>1</Text>
            </View>
            <Text style={dormantStyles.stepDesc}>
              Complete enough missions today to hit your{" "}
              <Text style={dormantStyles.stepEmphasis}>daily XP cap</Text>
            </Text>
          </View>
          <View style={dormantStyles.stepRow}>
            <View style={dormantStyles.stepNum}>
              <Text style={dormantStyles.stepN}>2</Text>
            </View>
            <Text style={dormantStyles.stepDesc}>
              Keep going — complete any mission after the cap to{" "}
              <Text style={dormantStyles.stepEmphasis}>enter Surge Mode</Text>
            </Text>
          </View>
          <View style={dormantStyles.stepRow}>
            <View style={dormantStyles.stepNum}>
              <Text style={dormantStyles.stepN}>3</Text>
            </View>
            <Text style={dormantStyles.stepDesc}>
              Your{" "}
              <Text style={dormantStyles.stepEmphasis}>
                first Sigil awakens
              </Text>{" "}
              — The Ember — and Aether begins accumulating
            </Text>
          </View>
        </View>

        {/* Today's cap progress */}
        <View style={dormantStyles.capCard}>
          <View style={dormantStyles.capLabelRow}>
            <Text style={dormantStyles.capLabel}>Today&apos;s XP Cap</Text>
            <Text style={dormantStyles.capVal}>
              {xpToday} / {dailyCap} XP
            </Text>
          </View>
          <View style={dormantStyles.capTrack}>
            <View
              style={[dormantStyles.capFill, { width: `${capPct}%` }]}
            />
          </View>
          <Text style={dormantStyles.capSub}>
            Hit{" "}
            <Text style={dormantStyles.capSubEmphasis}>
              {dailyCap} XP today
            </Text>{" "}
            then complete one more mission to ignite Surge
          </Text>
        </View>

        {/* Footer note */}
        <Text style={dormantStyles.footerNote}>
          Your Sigil is permanent. It grows across every day you push past the
          limit — across every season.
        </Text>
      </ScrollView>
    </View>
  );
}

export function SigilScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { data: sigilData, isLoading, isError, refetch, error } = useSigilData();
  const profile = useUserStore((s) => s.profile);

  const currentLevel = sigilData?.sigil_level ?? 1;
  const totalAether = sigilData?.total_aether ?? 0;
  const apiProgress = sigilData?.progress;
  const hasEverSurged = sigilData?.has_ever_surged ?? false;
  // For the dormant screen — how close the user is to hitting the cap today.
  const xpToday =
    sigilData?.aether_today === 0 ? (profile?.xp_today ?? 0) : 0;
  const dailyCap = Math.max(1, profile?.daily_xp_cap ?? 100);
  const capPct = Math.min(100, Math.round((xpToday / dailyCap) * 100));
  const [viewingLevel, setViewingLevel] = useState(currentLevel);

  useEffect(() => {
    setViewingLevel(currentLevel);
  }, [currentLevel]);

  const meta = SIGIL_LEVELS[viewingLevel - 1];
  const isLocked = viewingLevel > currentLevel;
  const maxAether = SIGIL_LEVELS[9].aetherRequired;

  const subtitle = useMemo(() => {
    if (isLocked) {
      return `Requires ${SIGIL_LEVELS[viewingLevel - 1].aetherRequired.toLocaleString()} Aether`;
    }
    if (viewingLevel === 1) return "0 Aether · Starting Point";
    if (viewingLevel === 10) return "70,000 Aether · Maximum";
    return `${SIGIL_LEVELS[viewingLevel - 1].aetherRequired.toLocaleString()} Aether`;
  }, [isLocked, viewingLevel]);

  const barDisplay = useMemo(() => {
    if (isLocked) {
      const need = SIGIL_LEVELS[viewingLevel - 1].aetherRequired;
      return {
        fillPercent: 0,
        leftNum: 0,
        rightLabel: need.toLocaleString(),
      };
    }
    if (viewingLevel < currentLevel) {
      const milestone = SIGIL_LEVELS[viewingLevel].aetherRequired;
      return {
        fillPercent: 100,
        leftNum: milestone,
        rightLabel: milestone.toLocaleString(),
      };
    }
    if (viewingLevel === 10) {
      if (totalAether >= maxAether) {
        return {
          fillPercent: 100,
          leftNum: maxAether,
          rightLabel: "Maximum",
        };
      }
      return {
        fillPercent: Math.min(100, Math.max(0, (totalAether / maxAether) * 100)),
        leftNum: totalAether,
        rightLabel: maxAether.toLocaleString(),
      };
    }
    const denom =
      viewingLevel === currentLevel && apiProgress != null && apiProgress.aether_for_next > 0
        ? apiProgress.aether_for_next
        : SIGIL_LEVELS[viewingLevel].aetherRequired;
    const pct =
      viewingLevel === currentLevel && apiProgress != null
        ? Math.min(100, Math.max(0, apiProgress.progress_percent))
        : Math.min(100, Math.max(0, (totalAether / denom) * 100));
    return {
      fillPercent: pct,
      leftNum: totalAether,
      rightLabel: denom.toLocaleString(),
    };
  }, [isLocked, viewingLevel, currentLevel, apiProgress, totalAether, maxAether]);

  const descParts = useMemo(() => {
    const d = meta.description;
    const idx = d.indexOf(".");
    if (idx === -1) return { lead: d, rest: "" };
    return { lead: d.slice(0, idx + 1), rest: d.slice(idx + 1).trim() };
  }, [meta.description]);

  const barGradientColors = useMemo(() => {
    if (viewingLevel >= 10) {
      return ["#92400E", "#F59E0B", "#FDE68A", "#FFFFFF"] as const;
    }
    if (viewingLevel === 9) {
      return ["#92400E", "#F59E0B", "#FDE68A", "#FFFBEB"] as const;
    }
    return [meta.accentColor2, meta.accentColor] as const;
  }, [viewingLevel, meta.accentColor, meta.accentColor2]);

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, backgroundColor: BG }]}>
        <ActivityIndicator color="#A78BFA" size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, backgroundColor: BG, padding: 24 }]}>
        <Text style={styles.errText}>Couldn&apos;t load your Sigil.</Text>
        <Text style={[styles.errSub, { marginTop: 8 }]}>{getErrorMessage(error)}</Text>
        <Pressable onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryTxt}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // Show dormant intro screen until the user has ever entered Surge Mode
  if (!isLoading && !isError && !hasEverSurged) {
    return (
      <DormantSigilScreen
        insets={insets}
        onBack={() => navigation.goBack()}
        capPct={capPct}
        xpToday={xpToday}
        dailyCap={dailyCap}
      />
    );
  }

  const isL10Page = viewingLevel === 10;

  const screenContent = (
    <>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={meta.accentColor} />
        </Pressable>
        <Text style={[styles.title, { color: meta.accentColor }]}>AETHER SIGIL</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          alignItems: "center",
          paddingBottom: 40 + insets.bottom,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.scrollInner}>
          <View style={styles.lvHeader}>
            <Text style={[styles.levelNum, { color: meta.accentColor }]}>
              LEVEL {String(viewingLevel).padStart(2, "0")}
            </Text>

            {isLocked ? (
              <Text style={styles.lockedName}>— — —</Text>
            ) : isL10Page ? (
              <MaskedView
                style={{ height: 44, width: Dimensions.get("window").width - 32, marginBottom: 8 }}
                maskElement={
                  <Text style={[styles.levelName, { color: "#000", textAlign: "center" }]}>
                    {meta.name}
                  </Text>
                }
              >
                <LinearGradient
                  colors={["#FEF3C7", "#FDE68A", "#FFFFFF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </MaskedView>
            ) : (
              <Text style={styles.levelName}>{meta.name}</Text>
            )}

            <Text
              style={[
                styles.lvAether,
                {
                  color:
                    isLocked
                      ? "rgba(107,114,128,0.45)"
                      : isL10Page
                        ? "rgba(248,250,252,0.6)"
                        : meta.accentColor,
                },
              ]}
            >
              {subtitle}
            </Text>
          </View>

          <View style={styles.canvasWrap}>
            {!isLocked ? (
              <>
                <SigilAmbientOrb tintColor={meta.accentColor} />
                <SigilGlow layer="glow1" tintColor={meta.glowColor} />
                <SigilGlow layer="glow2" tintColor={meta.glowColor2} delayMs={1000} />
                {viewingLevel >= 9 ? (
                  <SigilGlow
                    layer="halo"
                    tintColor={viewingLevel === 10 ? "#FDE68A" : meta.glowColor}
                  />
                ) : null}
                <View style={styles.sigilSvgLayer} pointerEvents="box-none">
                  <SigilRenderer
                    level={viewingLevel}
                    size={CANVAS}
                    accentColor={meta.accentColor}
                    accentColor2={meta.accentColor2}
                  />
                </View>
              </>
            ) : (
              <View style={styles.fog}>
                <View
                  style={[styles.fogTint, { shadowColor: meta.accentColor }]}
                  pointerEvents="none"
                />
                <Text style={styles.fogQ}>?</Text>
                <Text style={styles.fogLocked}>LOCKED</Text>
              </View>
            )}
          </View>

          <View
            style={[
              styles.descBlock,
              isL10Page && { borderTopColor: "rgba(255,255,255,0.08)" },
            ]}
          >
            {isLocked ? (
              <Text style={styles.lockedDesc}>
                Earn {SIGIL_LEVELS[viewingLevel - 1].aetherRequired.toLocaleString()} Aether to
                reveal this sigil.
              </Text>
            ) : (
              <Text style={styles.descText}>
                <Text style={styles.descLead}>{descParts.lead}</Text>
                {descParts.rest ? ` ${descParts.rest}` : ""}
              </Text>
            )}
          </View>

          <View style={styles.barSection}>
            <View style={styles.barLabelRow}>
              <Text style={[styles.barLbl, { color: isL10Page ? "rgba(248,250,252,0.6)" : meta.accentColor }]}>
                AETHER
              </Text>
              <Text
                style={[
                  styles.barLbl,
                  { color: isL10Page ? "rgba(248,250,252,0.6)" : meta.accentColor },
                ]}
              >
                {barDisplay.rightLabel === "Maximum"
                  ? `${barDisplay.leftNum.toLocaleString()} / Maximum`
                  : `${barDisplay.leftNum.toLocaleString()} / ${barDisplay.rightLabel}`}
              </Text>
            </View>
            <View
              style={[
                styles.track,
                isL10Page && { backgroundColor: "rgba(255,255,255,0.06)" },
              ]}
            >
              {!isLocked && barDisplay.fillPercent > 0 ? (
                <View style={[styles.fillOuter, { width: `${barDisplay.fillPercent}%` }]}>
                  <LinearGradient
                    colors={[...barGradientColors]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View
                    style={[
                      styles.fillCap,
                      {
                        backgroundColor: isL10Page ? "#FFFFFF" : meta.accentColor,
                        shadowColor: isL10Page ? "#FDE68A" : meta.accentColor,
                      },
                    ]}
                  />
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.dotsRow}>
            {SIGIL_LEVELS.map((s) => {
              const n = s.level;
              const active = n === viewingLevel;
              const unlocked = n <= currentLevel;
              const dm = SIGIL_LEVELS[n - 1];
              return (
                <Pressable key={n} onPress={() => setViewingLevel(n)} hitSlop={6}>
                  <View
                    style={[
                      unlocked ? styles.dotUnlocked : styles.dotLocked,
                      active && {
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: dm.accentColor,
                        shadowColor: dm.accentColor,
                        shadowOpacity: 0.5,
                        shadowRadius: 6,
                      },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </>
  );

  if (isL10Page) {
    return (
      <LinearGradient
        colors={["#030305", "#080810", "#030305"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1 }}
      >
        <LinearGradient
          colors={["rgba(255,255,255,0.05)", "transparent"]}
          start={{ x: 0.5, y: 0.35 }}
          end={{ x: 0.5, y: 0.85 }}
          style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
        />
        <View style={{ flex: 1 }}>{screenContent}</View>
      </LinearGradient>
    );
  }

  return <View style={{ flex: 1, backgroundColor: BG }}>{screenContent}</View>;
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  errText: { color: "#E5E7EB", textAlign: "center", fontWeight: "600", fontSize: 16 },
  errSub: { color: "#6B7280", textAlign: "center", fontSize: 13, marginBottom: 16 },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, backgroundColor: "#1E2333" },
  retryTxt: { color: "#A78BFA", fontWeight: "700" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  backBtn: { width: 28, height: 28, justifyContent: "center" },
  title: { fontSize: 10, fontWeight: "700", letterSpacing: 4 },
  scrollInner: {
    width: "100%",
    alignItems: "center",
    position: "relative",
    zIndex: 1,
    paddingTop: 8,
  },
  lvHeader: {
    alignItems: "center",
    marginBottom: 48,
    zIndex: 2,
  },
  levelNum: { fontSize: 10, fontWeight: "700", letterSpacing: 5, marginBottom: 10, textTransform: "uppercase" },
  levelName: {
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -1.2,
    color: "#E5E7EB",
    textAlign: "center",
    marginBottom: 8,
  },
  lvAether: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
    textAlign: "center",
  },
  lockedName: {
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -1.2,
    color: "rgba(229,231,235,0.15)",
    marginBottom: 8,
  },
  canvasWrap: {
    width: CANVAS,
    height: CANVAS,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 48,
    zIndex: 2,
    overflow: "visible",
  },
  sigilSvgLayer: {
    zIndex: 10,
    position: "relative",
  },
  fog: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3,3,5,0.97)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  fogTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(139,92,246,0.04)",
  },
  fogQ: { fontSize: 56, fontWeight: "900", color: "rgba(255,255,255,0.07)" },
  fogLocked: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 4,
    color: "rgba(255,255,255,0.10)",
    marginTop: 4,
  },
  barSection: { width: 280, marginTop: 20, zIndex: 2 },
  barLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  barLbl: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  track: {
    height: 3,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.05)",
    overflow: "visible",
    position: "relative",
  },
  fillOuter: {
    height: "100%",
    borderRadius: 3,
    overflow: "visible",
    position: "relative",
  },
  fillCap: {
    position: "absolute",
    right: -3,
    top: -2,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    shadowOpacity: 0.65,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  descBlock: {
    paddingTop: 28,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    width: "100%",
    maxWidth: 360,
    zIndex: 2,
  },
  descText: { fontSize: 15, color: TEXT_MUTED, lineHeight: 27, textAlign: "center" },
  descLead: { color: TEXT_DIM, fontWeight: "600" },
  lockedDesc: { fontSize: 15, lineHeight: 27, textAlign: "center", color: "rgba(107,114,128,0.35)" },
  dotsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 24,
    zIndex: 2,
  },
  dotLocked: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  dotUnlocked: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
});

const dormantStyles = StyleSheet.create({
  orbWrap: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
    marginBottom: 14,
  },
  ring1: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: "#151830",
  },
  ring2: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: "#1A1D38",
  },
  ring3: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: "#1E2245",
  },
  core: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0C0E1E",
    borderWidth: 1.5,
    borderColor: "#252850",
    alignItems: "center",
    justifyContent: "center",
  },
  coreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1E2450",
  },
  dormantTitle: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.8,
    color: "#2A3060",
    textAlign: "center",
  },
  dormantSub: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    color: "#1C2045",
    textTransform: "uppercase",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#0B0D1E",
    borderWidth: 1,
    borderColor: "#161935",
    borderRadius: 16,
    padding: 14,
    width: "100%",
    marginBottom: 16,
  },
  cardRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  iconAether: {
    backgroundColor: "#0F1235",
    borderWidth: 1,
    borderColor: "#1E2450",
  },
  iconSurge: {
    backgroundColor: "#140F25",
    borderWidth: 1,
    borderColor: "#2A1860",
  },
  iconSigil: {
    backgroundColor: "#0F1520",
    borderWidth: 1,
    borderColor: "#182840",
  },
  iconGlyph: {
    fontSize: 12,
    color: "#2A3570",
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#3A4580",
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 12,
    color: "#252C60",
    lineHeight: 18,
  },
  stepsSection: {
    width: "100%",
    marginBottom: 14,
  },
  stepsHeader: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#2A3060",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  stepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1E2250",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepN: {
    fontSize: 9,
    color: "#303870",
    fontWeight: "700",
  },
  stepDesc: {
    fontSize: 12,
    color: "#252C60",
    lineHeight: 18,
    flex: 1,
    paddingTop: 1,
  },
  stepEmphasis: {
    color: "#3A4580",
    fontWeight: "700",
  },
  capCard: {
    backgroundColor: "#0B0D1E",
    borderWidth: 1,
    borderColor: "#161935",
    borderRadius: 12,
    padding: 14,
    width: "100%",
    marginBottom: 20,
  },
  capLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  capLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#2A3060",
    textTransform: "uppercase",
  },
  capVal: {
    fontSize: 10,
    color: "#2E3870",
    fontWeight: "600",
  },
  capTrack: {
    height: 4,
    backgroundColor: "#0F1230",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 8,
  },
  capFill: {
    height: "100%",
    backgroundColor: "#1E2450",
    borderRadius: 2,
  },
  capSub: {
    fontSize: 11,
    color: "#1C2450",
    lineHeight: 16,
  },
  capSubEmphasis: {
    color: "#2E3870",
    fontWeight: "600",
  },
  footerNote: {
    fontSize: 11,
    color: "#151830",
    textAlign: "center",
    lineHeight: 17,
    paddingHorizontal: 8,
  },
});
