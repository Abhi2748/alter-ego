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

const BG = "#030305";
const TEXT_MUTED = "#6B7280";
const TEXT_DIM = "#9CA3AF";
const CANVAS = DEFAULT_SIGIL_SIZE;

export function SigilScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { data: sigilData, isLoading, isError, refetch, error } = useSigilData();

  const currentLevel = sigilData?.sigil_level ?? 1;
  const totalAether = sigilData?.total_aether ?? 0;
  const apiProgress = sigilData?.progress;
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
